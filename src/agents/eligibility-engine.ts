// ============================================================
// AGENT 3: ELIGIBILITY ENGINE
// ============================================================
// Input:  ClaimSubmission + ExtractedData
// Output: EligibilityResult
// Checks: Member validity, waiting periods, exclusions, pre-auth
// ============================================================

import type { ClaimSubmission, ExtractedData, EligibilityResult, EligibilityReason } from '../lib/types';
import { getMember, getOPDCategory, getPolicy, isExcludedCondition, getWaitingPeriodDays } from '../lib/policy-loader';
import { TraceBuilder } from '../lib/trace-builder';

const AGENT_NAME = 'EligibilityEngine';

export function checkEligibility(
  claim: ClaimSubmission,
  extractedData: ExtractedData,
  trace: TraceBuilder
): EligibilityResult {
  const reasons: EligibilityReason[] = [];
  const policy = getPolicy();

  // 1. Member lookup
  const member = getMember(claim.member_id);
  if (!member) {
    trace.fail(AGENT_NAME, 'member_lookup', `Member ${claim.member_id} not found`);
    reasons.push({ check: 'Member Lookup', passed: false, message: `Member ID ${claim.member_id} not found in policy roster.` });
    return { eligible: false, member_found: false, reasons };
  }
  trace.pass(AGENT_NAME, 'member_lookup', `Member found: ${member.name} (${member.member_id})`);
  reasons.push({ check: 'Member Lookup', passed: true, message: `Member ${member.name} found and active.` });

  // 2. Policy active check
  const treatmentDate = new Date(claim.treatment_date);
  const policyStart = new Date(policy.policy_holder.policy_start_date);
  const policyEnd = new Date(policy.policy_holder.policy_end_date);
  
  if (treatmentDate < policyStart || treatmentDate > policyEnd) {
    trace.fail(AGENT_NAME, 'policy_active', 'Treatment date outside policy period');
    reasons.push({ check: 'Policy Period', passed: false, message: `Treatment date ${claim.treatment_date} is outside the policy period (${policy.policy_holder.policy_start_date} to ${policy.policy_holder.policy_end_date}).` });
    return { eligible: false, member_found: true, member_name: member.name, reasons };
  }
  trace.pass(AGENT_NAME, 'policy_active', 'Treatment within policy period');
  reasons.push({ check: 'Policy Period', passed: true, message: 'Treatment date within active policy period.' });

  // 3. Initial waiting period
  const joinDate = new Date(member.join_date);
  const daysSinceJoin = Math.floor((treatmentDate.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysSinceJoin < policy.waiting_periods.initial_waiting_period_days) {
    trace.fail(AGENT_NAME, 'initial_waiting', `Only ${daysSinceJoin} days since joining (required: ${policy.waiting_periods.initial_waiting_period_days})`);
    const eligibleDate = new Date(joinDate);
    eligibleDate.setDate(eligibleDate.getDate() + policy.waiting_periods.initial_waiting_period_days);
    reasons.push({ check: 'Initial Waiting Period', passed: false, message: `Member joined on ${member.join_date}. Initial waiting period of ${policy.waiting_periods.initial_waiting_period_days} days not completed. Eligible from ${eligibleDate.toISOString().split('T')[0]}.` });
    return { eligible: false, member_found: true, member_name: member.name, reasons };
  }
  trace.pass(AGENT_NAME, 'initial_waiting', `Initial waiting period satisfied (${daysSinceJoin} days)`);
  reasons.push({ check: 'Initial Waiting Period', passed: true, message: `${daysSinceJoin} days since joining — waiting period of ${policy.waiting_periods.initial_waiting_period_days} days satisfied.` });

  // 4. Condition-specific waiting period
  const diagnosis = extractedData.diagnosis || '';
  const treatment = extractedData.treatment || '';
  const conditionText = `${diagnosis} ${treatment}`.toLowerCase();
  
  for (const [condition, waitDays] of Object.entries(policy.waiting_periods.specific_conditions)) {
    if (conditionText.includes(condition.toLowerCase()) || 
        condition.toLowerCase().split('_').every(w => conditionText.includes(w))) {
      if (daysSinceJoin < waitDays) {
        const eligibleDate = new Date(joinDate);
        eligibleDate.setDate(eligibleDate.getDate() + waitDays);
        trace.fail(AGENT_NAME, 'condition_waiting', `${condition} waiting period not met (${daysSinceJoin}/${waitDays} days)`);
        reasons.push({
          check: 'Condition-Specific Waiting Period',
          passed: false,
          message: `${condition.replace(/_/g, ' ')} has a waiting period of ${waitDays} days. Member joined ${member.join_date} (${daysSinceJoin} days ago). Claims for this condition will be eligible from ${eligibleDate.toISOString().split('T')[0]}.`,
        });
        return { eligible: false, member_found: true, member_name: member.name, reasons };
      }
      trace.pass(AGENT_NAME, 'condition_waiting', `${condition} waiting period satisfied`);
      reasons.push({ check: 'Condition-Specific Waiting Period', passed: true, message: `Waiting period for ${condition.replace(/_/g, ' ')} satisfied.` });
    }
  }

  // 5. Exclusion check
  const exclusion = isExcludedCondition(diagnosis, treatment);
  if (exclusion) {
    trace.fail(AGENT_NAME, 'exclusion_check', `Excluded condition: ${exclusion}`);
    reasons.push({ check: 'Exclusion Check', passed: false, message: `"${exclusion}" is explicitly excluded under this policy. This claim cannot be approved.` });
    return { eligible: false, member_found: true, member_name: member.name, reasons };
  }
  trace.pass(AGENT_NAME, 'exclusion_check', 'No policy exclusions apply');
  reasons.push({ check: 'Exclusion Check', passed: true, message: 'Treatment is not in the exclusions list.' });

  // 6. Category coverage & pre-auth check
  const category = getOPDCategory(claim.claim_category);
  if (!category || !category.covered) {
    trace.fail(AGENT_NAME, 'category_check', `Category ${claim.claim_category} not covered`);
    reasons.push({ check: 'Category Coverage', passed: false, message: `${claim.claim_category} is not covered under this policy.` });
    return { eligible: false, member_found: true, member_name: member.name, reasons };
  }
  trace.pass(AGENT_NAME, 'category_check', `Category ${claim.claim_category} is covered`);
  reasons.push({ check: 'Category Coverage', passed: true, message: `${claim.claim_category} is a covered OPD category.` });

  // 7. Pre-authorization check
  let requiresPreAuth = false;
  if (category.high_value_tests_requiring_pre_auth) {
    const lineItems = extractedData.line_items || [];
    const testsOrdered = extractedData.tests_ordered || [];
    const allItems = [...lineItems.map(li => li.description), ...testsOrdered];
    
    for (const item of allItems) {
      for (const test of category.high_value_tests_requiring_pre_auth) {
        if (item.toLowerCase().includes(test.toLowerCase())) {
          if (category.pre_auth_threshold && claim.claimed_amount > category.pre_auth_threshold) {
            requiresPreAuth = true;
            trace.fail(AGENT_NAME, 'pre_auth_check', `${test} requires pre-authorization for amounts above ₹${category.pre_auth_threshold}`);
            reasons.push({
              check: 'Pre-Authorization',
              passed: false,
              message: `${test} costing ₹${claim.claimed_amount.toLocaleString('en-IN')} requires pre-authorization (threshold: ₹${category.pre_auth_threshold.toLocaleString('en-IN')}). Please obtain pre-authorization before resubmitting. Pre-authorization is valid for ${policy.pre_authorization.validity_days} days.`,
            });
            return { eligible: false, member_found: true, member_name: member.name, reasons, requires_pre_auth: true };
          }
        }
      }
    }
  }

  if (!requiresPreAuth) {
    trace.pass(AGENT_NAME, 'pre_auth_check', 'No pre-authorization required');
    reasons.push({ check: 'Pre-Authorization', passed: true, message: 'No pre-authorization required for this claim.' });
  }

  // 8. Submission deadline (non-blocking warning for test data with old dates)
  const deadlineDays = policy.submission_rules.deadline_days_from_treatment;
  const now = new Date();
  const daysSinceTreatment = Math.floor((now.getTime() - treatmentDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysSinceTreatment > deadlineDays) {
    trace.warn(AGENT_NAME, 'deadline_check', `Submitted ${daysSinceTreatment} days after treatment (limit: ${deadlineDays}). Flagged but not blocking.`);
    reasons.push({ check: 'Submission Deadline', passed: true, message: `Claim submitted ${daysSinceTreatment} days after treatment (deadline: ${deadlineDays} days). Flagged for review.` });
  } else {
    trace.pass(AGENT_NAME, 'deadline_check', 'Within submission deadline');
    reasons.push({ check: 'Submission Deadline', passed: true, message: 'Claim submitted within deadline.' });
  }

  // 9. Minimum claim amount
  if (claim.claimed_amount < policy.submission_rules.minimum_claim_amount) {
    trace.fail(AGENT_NAME, 'min_amount', `₹${claim.claimed_amount} below minimum ₹${policy.submission_rules.minimum_claim_amount}`);
    reasons.push({ check: 'Minimum Amount', passed: false, message: `Claimed amount ₹${claim.claimed_amount} is below the minimum claim amount of ₹${policy.submission_rules.minimum_claim_amount}.` });
    return { eligible: false, member_found: true, member_name: member.name, reasons };
  }

  // 10. Per-claim limit check
  // NOTE: For categories with line-item level exclusions (DENTAL, etc.), the per-claim limit
  // is checked against the NET eligible amount in the CalculationEngine, not the gross claimed amount.
  // Only reject here if no line-item processing is possible (simple claim categories).
  const hasLineItems = extractedData.line_items && extractedData.line_items.length > 0;
  const categoryHasExclusions = category.excluded_procedures || category.excluded_items;
  
  if (claim.claimed_amount > policy.coverage.per_claim_limit && !hasLineItems && !categoryHasExclusions) {
    trace.fail(AGENT_NAME, 'per_claim_limit', `₹${claim.claimed_amount} exceeds per-claim limit ₹${policy.coverage.per_claim_limit}`);
    reasons.push({
      check: 'Per-Claim Limit',
      passed: false,
      message: `Claimed amount of ₹${claim.claimed_amount.toLocaleString('en-IN')} exceeds the per-claim limit of ₹${policy.coverage.per_claim_limit.toLocaleString('en-IN')}. The maximum claimable amount per claim is ₹${policy.coverage.per_claim_limit.toLocaleString('en-IN')}.`,
    });
    return { eligible: false, member_found: true, member_name: member.name, reasons };
  }
  
  if (claim.claimed_amount > policy.coverage.per_claim_limit) {
    trace.warn(AGENT_NAME, 'per_claim_limit', `Claimed ₹${claim.claimed_amount} exceeds per-claim limit ₹${policy.coverage.per_claim_limit} — will be capped in calculation`);
    reasons.push({ check: 'Per-Claim Limit', passed: true, message: `Claimed amount exceeds per-claim limit. Eligible amount will be capped at ₹${policy.coverage.per_claim_limit.toLocaleString('en-IN')}.` });
  } else {
    trace.pass(AGENT_NAME, 'per_claim_limit', `Within per-claim limit (₹${claim.claimed_amount} ≤ ₹${policy.coverage.per_claim_limit})`);
    reasons.push({ check: 'Per-Claim Limit', passed: true, message: `Claimed amount within per-claim limit.` });
  }

  return {
    eligible: true,
    member_found: true,
    member_name: member.name,
    reasons,
    applicable_sub_limit: category.sub_limit,
    copay_percent: category.copay_percent,
    network_discount_percent: category.network_discount_percent,
  };
}
