// ============================================================
// ORCHESTRATOR — Multi-Agent Pipeline Controller
// ============================================================
// Connects all agents in sequence, builds the trace, handles
// failures gracefully, and produces the final ClaimDecisionResult.
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import type { ClaimSubmission, ClaimDecisionResult, ClaimDecision } from '../lib/types';
import { TraceBuilder } from '../lib/trace-builder';
import { verifyDocuments } from './document-verification';
import { parseDocuments } from './document-parsing';
import { checkEligibility } from './eligibility-engine';
import { calculateClaim } from './calculation-engine';
import { checkFraud } from './fraud-detection';

const AGENT_NAME = 'Orchestrator';

export async function processClaim(claim: ClaimSubmission): Promise<ClaimDecisionResult> {
  const startTime = Date.now();
  const claimId = claim.claim_id || `CLM_${uuidv4().substring(0, 8).toUpperCase()}`;
  const trace = new TraceBuilder(claimId);

  trace.pass(AGENT_NAME, 'pipeline_start', `Processing claim ${claimId}`, {
    member_id: claim.member_id,
    category: claim.claim_category,
    amount: claim.claimed_amount,
  });

  const warnings: string[] = [];
  let componentFailure = false;

  // ========== STAGE 1: Document Verification ==========
  trace.pass(AGENT_NAME, 'stage_1_start', '→ Stage 1: Document Verification');
  const docResult = verifyDocuments(claim, trace);

  if (!docResult.passed) {
    const errorMessages = docResult.errors.map(e => e.message).join(' ');
    trace.fail(AGENT_NAME, 'pipeline_stopped', 'Pipeline stopped at Document Verification');
    
    return {
      claim_id: claimId,
      decision: 'REJECTED' as ClaimDecision,
      approved_amount: 0,
      claimed_amount: claim.claimed_amount,
      confidence_score: 0.95,
      reason: 'Document verification failed',
      rejection_reasons: docResult.errors.map(e => e.error_type),
      trace: trace.complete(),
      warnings: docResult.warnings,
      processing_time_ms: Date.now() - startTime,
      member_message: errorMessages,
    };
  }

  // ========== STAGE 2: Document Parsing ==========
  trace.pass(AGENT_NAME, 'stage_2_start', '→ Stage 2: Document Parsing');
  const extractedData = await parseDocuments(
    claim.documents,
    trace,
    claim.simulate_component_failure || false
  );

  if (claim.simulate_component_failure) {
    componentFailure = true;
    warnings.push('A processing component failed. Results are based on partial data. Manual review is recommended.');
  }

  // ========== STAGE 3: Eligibility Check ==========
  trace.pass(AGENT_NAME, 'stage_3_start', '→ Stage 3: Eligibility Check');
  const eligibility = checkEligibility(claim, extractedData, trace);

  if (!eligibility.eligible) {
    const failedReasons = eligibility.reasons.filter(r => !r.passed);
    trace.fail(AGENT_NAME, 'pipeline_rejected', 'Claim rejected at eligibility check');

    return {
      claim_id: claimId,
      decision: 'REJECTED',
      approved_amount: 0,
      claimed_amount: claim.claimed_amount,
      confidence_score: componentFailure ? 0.65 : 0.92,
      reason: failedReasons.map(r => r.message).join(' '),
      rejection_reasons: failedReasons.map(r => r.check.toUpperCase().replace(/[\s-]/g, '_')),
      trace: trace.complete(),
      warnings,
      processing_time_ms: Date.now() - startTime,
      member_message: failedReasons.map(r => r.message).join(' '),
    };
  }

  // ========== STAGE 4: Amount Calculation ==========
  trace.pass(AGENT_NAME, 'stage_4_start', '→ Stage 4: Amount Calculation');
  const calculation = calculateClaim(claim, extractedData, eligibility, trace);

  // ========== STAGE 5: Fraud Detection ==========
  trace.pass(AGENT_NAME, 'stage_5_start', '→ Stage 5: Fraud Detection');
  const fraudResult = checkFraud(claim, trace);

  // ========== STAGE 6: Final Decision ==========
  trace.pass(AGENT_NAME, 'stage_6_start', '→ Stage 6: Final Decision');

  let decision: ClaimDecision;
  let confidence: number;
  let reason: string;

  if (calculation.per_claim_limit_applied) {
    // Per-claim limit exceeded — hard rejection (TC008)
    const policy = (await import('../lib/policy-loader')).getPolicy();
    decision = 'REJECTED';
    confidence = 0.95;
    reason = `Claimed amount of ₹${claim.claimed_amount.toLocaleString('en-IN')} exceeds the per-claim limit of ₹${policy.coverage.per_claim_limit.toLocaleString('en-IN')}. The maximum claimable amount per claim is ₹${policy.coverage.per_claim_limit.toLocaleString('en-IN')}.`;
    trace.fail(AGENT_NAME, 'decision', `REJECTED: per-claim limit exceeded`);
  } else if (fraudResult.recommendation === 'MANUAL_REVIEW') {
    decision = 'MANUAL_REVIEW';
    confidence = componentFailure ? 0.4 : 0.7;
    reason = `Fraud signals detected: ${fraudResult.signals.map(s => s.message).join('; ')}. Routed to manual review.`;
    warnings.push(...fraudResult.signals.map(s => s.message));
    trace.warn(AGENT_NAME, 'decision', 'Routed to MANUAL_REVIEW due to fraud signals');
  } else if (calculation.line_item_decisions?.some(li => !li.approved)) {
    decision = 'PARTIAL';
    confidence = componentFailure ? 0.55 : 0.88;
    const approved = calculation.line_item_decisions.filter(li => li.approved);
    const rejected = calculation.line_item_decisions.filter(li => !li.approved);
    reason = `Partial approval: ${approved.map(li => `${li.description} (₹${li.approved_amount})`).join(', ')} approved. ${rejected.map(li => `${li.description} rejected — ${li.reason}`).join('; ')}`;
    trace.pass(AGENT_NAME, 'decision', `PARTIAL approval: ₹${calculation.approved_amount}`);
  } else if (calculation.approved_amount > 0) {
    decision = 'APPROVED';
    confidence = componentFailure ? 0.55 : 0.92;
    const breakdownSteps = calculation.breakdown.steps.join('; ');
    reason = breakdownSteps || `Claim approved for ₹${calculation.approved_amount.toLocaleString('en-IN')}`;
    trace.pass(AGENT_NAME, 'decision', `APPROVED: ₹${calculation.approved_amount}`);
  } else {
    decision = 'REJECTED';
    confidence = componentFailure ? 0.5 : 0.9;
    reason = 'Approved amount is zero after applying all deductions.';
    trace.fail(AGENT_NAME, 'decision', 'REJECTED: approved amount is zero');
  }

  if (componentFailure) {
    trace.warn(AGENT_NAME, 'component_failure_note', 'Confidence reduced due to component failure. Manual review recommended.');
    warnings.push('Manual review is recommended due to incomplete processing.');
  }

  trace.pass(AGENT_NAME, 'pipeline_complete', `Pipeline complete: ${decision} — ₹${calculation.approved_amount}`);

  return {
    claim_id: claimId,
    decision,
    approved_amount: calculation.approved_amount,
    claimed_amount: claim.claimed_amount,
    confidence_score: confidence,
    reason,
    rejection_reasons: calculation.per_claim_limit_applied ? ['PER_CLAIM_EXCEEDED'] : undefined,
    line_item_decisions: calculation.line_item_decisions,
    trace: trace.complete(),
    warnings,
    processing_time_ms: Date.now() - startTime,
    member_message: generateMemberMessage(decision, calculation.approved_amount, claim.claimed_amount, reason),
  };
}

function generateMemberMessage(
  decision: ClaimDecision,
  approved: number,
  claimed: number,
  reason: string
): string {
  switch (decision) {
    case 'APPROVED':
      return `Your claim has been approved for ₹${approved.toLocaleString('en-IN')}. ${reason}`;
    case 'PARTIAL':
      return `Your claim has been partially approved for ₹${approved.toLocaleString('en-IN')} out of ₹${claimed.toLocaleString('en-IN')}. ${reason}`;
    case 'REJECTED':
      return `Your claim for ₹${claimed.toLocaleString('en-IN')} has been rejected. ${reason}`;
    case 'MANUAL_REVIEW':
      return `Your claim for ₹${claimed.toLocaleString('en-IN')} has been sent for manual review. A team member will review it shortly.`;
    default:
      return reason;
  }
}
