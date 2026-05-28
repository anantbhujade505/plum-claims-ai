// ============================================================
// AGENT 4: CALCULATION ENGINE
// ============================================================
// Input:  ClaimSubmission + ExtractedData + EligibilityResult
// Output: CalculationResult
// 
// CRITICAL: Network discount → Co-pay → Sub-limit → Per-claim limit
// This order is tested by TC010.
// ============================================================

import type {
  ClaimSubmission,
  ExtractedData,
  EligibilityResult,
  CalculationResult,
  LineItemDecision,
  CalculationBreakdown,
} from '../lib/types';
import { getOPDCategory, isNetworkHospital, getPolicy } from '../lib/policy-loader';
import { TraceBuilder } from '../lib/trace-builder';

const AGENT_NAME = 'CalculationEngine';

export function calculateClaim(
  claim: ClaimSubmission,
  extractedData: ExtractedData,
  eligibility: EligibilityResult,
  trace: TraceBuilder
): CalculationResult {
  const category = getOPDCategory(claim.claim_category);
  const steps: string[] = [];
  let amount = claim.claimed_amount;
  const breakdown: CalculationBreakdown = {
    original_amount: amount,
    after_exclusions: amount,
    after_sub_limit: amount,
    after_network_discount: amount,
    after_copay: amount,
    after_per_claim_limit: amount,
    final_amount: amount,
    steps: [],
  };

  // Step 1: Line-item level exclusions (for DENTAL, VISION, etc.)
  let lineItemDecisions: LineItemDecision[] | undefined;
  let excludedAmount = 0;

  if (extractedData.line_items && category) {
    const excluded = category.excluded_procedures || category.excluded_items || [];
    lineItemDecisions = extractedData.line_items.map(item => {
      const isExcluded = excluded.some(
        ex => item.description.toLowerCase().includes(ex.toLowerCase()) ||
              ex.toLowerCase().includes(item.description.toLowerCase())
      );
      if (isExcluded) {
        excludedAmount += item.amount;
        trace.fail(AGENT_NAME, 'line_item_check', `Excluded: ${item.description} (₹${item.amount})`, {
          reason: 'Cosmetic/excluded procedure',
        });
        return {
          description: item.description,
          amount: item.amount,
          approved: false,
          approved_amount: 0,
          reason: `"${item.description}" is excluded under the ${claim.claim_category.toLowerCase()} category as a cosmetic/non-covered procedure.`,
        };
      }
      trace.pass(AGENT_NAME, 'line_item_check', `Approved: ${item.description} (₹${item.amount})`);
      return {
        description: item.description,
        amount: item.amount,
        approved: true,
        approved_amount: item.amount,
      };
    });

    if (excludedAmount > 0) {
      amount -= excludedAmount;
      steps.push(`Excluded items deducted: -₹${excludedAmount.toLocaleString('en-IN')} → ₹${amount.toLocaleString('en-IN')}`);
      trace.pass(AGENT_NAME, 'exclusion_deduction', `Deducted ₹${excludedAmount} for excluded items`);
    }
  }
  breakdown.after_exclusions = amount;

  // Step 2: Sub-limit tracking (informational — the per-claim limit handles overall capping)
  // Sub-limits in OPD categories are per-procedure guidance, not per-claim-total caps.
  if (category) {
    trace.pass(AGENT_NAME, 'sub_limit_info', `Category sub-limit: ₹${category.sub_limit.toLocaleString('en-IN')} (informational)`);
  }
  breakdown.after_sub_limit = amount;

  // Step 3: Network discount (applied BEFORE co-pay — this is critical for TC010)
  let networkDiscount = 0;
  const hospitalName = claim.hospital_name || extractedData.hospital_name;
  const isNetwork = hospitalName ? isNetworkHospital(hospitalName) : false;
  const discountPercent = category?.network_discount_percent || 0;

  if (isNetwork && discountPercent > 0) {
    networkDiscount = Math.round(amount * (discountPercent / 100));
    amount -= networkDiscount;
    steps.push(`Network hospital discount (${discountPercent}%): -₹${networkDiscount.toLocaleString('en-IN')} → ₹${amount.toLocaleString('en-IN')}`);
    trace.pass(AGENT_NAME, 'network_discount', `${hospitalName} is a network hospital — ${discountPercent}% discount applied (₹${networkDiscount})`);
  } else if (hospitalName) {
    trace.pass(AGENT_NAME, 'network_discount', `${hospitalName} is not a network hospital — no discount`);
  }
  breakdown.after_network_discount = amount;

  // Step 4: Co-pay deduction (applied AFTER network discount)
  let copayDeducted = 0;
  const copayPercent = category?.copay_percent || 0;

  if (copayPercent > 0) {
    copayDeducted = Math.round(amount * (copayPercent / 100));
    amount -= copayDeducted;
    steps.push(`Co-pay (${copayPercent}%): -₹${copayDeducted.toLocaleString('en-IN')} → ₹${amount.toLocaleString('en-IN')}`);
    trace.pass(AGENT_NAME, 'copay', `${copayPercent}% co-pay applied: ₹${copayDeducted} deducted`);
  }
  breakdown.after_copay = amount;

  // Step 5: Per-claim limit enforcement
  // The per-claim limit applies when the category's sub-limit <= per-claim limit.
  // For categories with higher sub-limits (dental: ₹10,000), the sub-limit is the binding cap.
  const policy = getPolicy();
  const perClaimLimit = policy.coverage.per_claim_limit;
  const categorySubLimit = category?.sub_limit || perClaimLimit;
  
  // If the category sub-limit is higher than per-claim limit, the category sub-limit takes precedence
  const effectiveLimit = categorySubLimit > perClaimLimit ? categorySubLimit : perClaimLimit;
  
  let perClaimLimitApplied = false;
  // Only flag per-claim-exceeded if all line items are approved (no exclusions caused partial)
  // If there are excluded line items, the partial approval is due to exclusions, not per-claim limit
  const allLineItemsApproved = !lineItemDecisions || lineItemDecisions.every(li => li.approved);
  
  if (claim.claimed_amount > perClaimLimit && allLineItemsApproved && categorySubLimit <= perClaimLimit) {
    // This is a hard rejection — claimed amount exceeds per-claim limit with no mitigating factors
    perClaimLimitApplied = true;
    amount = 0; // Will be rejected by orchestrator
    steps.push(`Per-claim limit exceeded: claimed ₹${claim.claimed_amount.toLocaleString('en-IN')} > limit ₹${perClaimLimit.toLocaleString('en-IN')}`);
    trace.fail(AGENT_NAME, 'per_claim_limit', `Claimed ₹${claim.claimed_amount} exceeds per-claim limit ₹${perClaimLimit}. Claim will be rejected.`);
  } else if (amount > effectiveLimit) {
    const excess = amount - effectiveLimit;
    amount = effectiveLimit;
    steps.push(`Effective limit applied (₹${effectiveLimit.toLocaleString('en-IN')}): -₹${excess.toLocaleString('en-IN')} → ₹${amount.toLocaleString('en-IN')}`);
    trace.warn(AGENT_NAME, 'per_claim_limit', `Amount capped at ₹${effectiveLimit}`);
  }

  breakdown.after_per_claim_limit = amount;
  breakdown.final_amount = amount;
  breakdown.steps = steps;

  trace.pass(AGENT_NAME, 'final_calculation', `Final approved amount: ₹${amount.toLocaleString('en-IN')}`, {
    original: claim.claimed_amount,
    final: amount,
    network_discount: networkDiscount,
    copay: copayDeducted,
    excluded: excludedAmount,
  });

  return {
    claimed_amount: claim.claimed_amount,
    approved_amount: amount,
    network_discount_applied: networkDiscount,
    copay_deducted: copayDeducted,
    sub_limit_applied: breakdown.after_sub_limit < breakdown.after_exclusions,
    per_claim_limit_applied: perClaimLimitApplied,
    annual_limit_applied: false,
    line_item_decisions: lineItemDecisions,
    breakdown,
  };
}
