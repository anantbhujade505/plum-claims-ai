// ============================================================
// AGENT 5: FRAUD DETECTION AGENT
// ============================================================
// Input:  ClaimSubmission
// Output: FraudCheckResult
// Checks: Same-day claims, monthly frequency, high-value threshold
// ============================================================

import type { ClaimSubmission, FraudCheckResult, FraudSignal } from '../lib/types';
import { getPolicy } from '../lib/policy-loader';
import { TraceBuilder } from '../lib/trace-builder';

const AGENT_NAME = 'FraudDetectionAgent';

export function checkFraud(
  claim: ClaimSubmission,
  trace: TraceBuilder
): FraudCheckResult {
  const policy = getPolicy();
  const thresholds = policy.fraud_thresholds;
  const signals: FraudSignal[] = [];
  let riskScore = 0;

  // 1. Same-day claims check
  if (claim.claims_history) {
    const sameDayClaims = claim.claims_history.filter(c => c.date === claim.treatment_date);
    if (sameDayClaims.length >= thresholds.same_day_claims_limit) {
      riskScore += 0.4;
      const signal: FraudSignal = {
        signal_type: 'SAME_DAY_CLAIMS',
        severity: 'HIGH',
        message: `Member has ${sameDayClaims.length} previous claims on ${claim.treatment_date} (limit: ${thresholds.same_day_claims_limit}). This is claim #${sameDayClaims.length + 1} for the same day.`,
        details: {
          existing_claims: sameDayClaims.map(c => ({
            claim_id: c.claim_id,
            amount: c.amount,
            provider: c.provider,
          })),
          total_same_day_amount: sameDayClaims.reduce((sum, c) => sum + c.amount, 0) + claim.claimed_amount,
        },
      };
      signals.push(signal);
      trace.warn(AGENT_NAME, 'same_day_check', signal.message, signal.details);
    } else {
      trace.pass(AGENT_NAME, 'same_day_check', `Same-day claims within limit (${sameDayClaims.length}/${thresholds.same_day_claims_limit})`);
    }

    // 2. Monthly claims check
    const claimMonth = claim.treatment_date.substring(0, 7);
    const monthClaims = claim.claims_history.filter(c => c.date.startsWith(claimMonth));
    if (monthClaims.length >= thresholds.monthly_claims_limit) {
      riskScore += 0.3;
      signals.push({
        signal_type: 'MONTHLY_FREQUENCY',
        severity: 'MEDIUM',
        message: `Member has ${monthClaims.length} claims this month (limit: ${thresholds.monthly_claims_limit}).`,
      });
      trace.warn(AGENT_NAME, 'monthly_check', `High monthly claim frequency: ${monthClaims.length}`);
    } else {
      trace.pass(AGENT_NAME, 'monthly_check', `Monthly claims within limit`);
    }

    // 3. Multiple providers same day
    const providers = new Set(sameDayClaims.map(c => c.provider));
    if (providers.size > 1) {
      riskScore += 0.2;
      signals.push({
        signal_type: 'MULTIPLE_PROVIDERS_SAME_DAY',
        severity: 'MEDIUM',
        message: `Claims from ${providers.size} different providers on the same day: ${[...providers].join(', ')}.`,
      });
      trace.warn(AGENT_NAME, 'provider_check', `Multiple providers on same day: ${[...providers].join(', ')}`);
    }
  } else {
    trace.pass(AGENT_NAME, 'history_check', 'No claims history — no pattern-based fraud signals');
  }

  // 4. High-value claim check
  if (claim.claimed_amount >= thresholds.high_value_claim_threshold) {
    riskScore += 0.15;
    signals.push({
      signal_type: 'HIGH_VALUE_CLAIM',
      severity: 'MEDIUM',
      message: `Claim amount ₹${claim.claimed_amount.toLocaleString('en-IN')} exceeds high-value threshold of ₹${thresholds.high_value_claim_threshold.toLocaleString('en-IN')}.`,
    });
    trace.warn(AGENT_NAME, 'high_value_check', `High-value claim: ₹${claim.claimed_amount}`);
  } else {
    trace.pass(AGENT_NAME, 'high_value_check', 'Claim amount below high-value threshold');
  }

  const flagged = riskScore >= thresholds.fraud_score_manual_review_threshold || signals.some(s => s.severity === 'HIGH');
  const recommendation = flagged ? 'MANUAL_REVIEW' : 'PROCEED';

  if (flagged) {
    trace.warn(AGENT_NAME, 'final_verdict', `Fraud signals detected (score: ${riskScore.toFixed(2)}) — recommending manual review`, {
      risk_score: riskScore,
      signal_count: signals.length,
    });
  } else {
    trace.pass(AGENT_NAME, 'final_verdict', `No significant fraud signals (score: ${riskScore.toFixed(2)})`);
  }

  return { flagged, risk_score: riskScore, signals, recommendation };
}
