// ============================================================
// API: POST /api/eval — Run all 12 test cases and generate eval report
// ============================================================

import { NextResponse } from 'next/server';
import { processClaim } from '@/agents/orchestrator';
import type { ClaimSubmission } from '@/lib/types';
import testCasesData from '@/data/test_cases.json';

interface TestCase {
  case_id: string;
  case_name: string;
  description: string;
  input: Record<string, unknown>;
  expected: Record<string, unknown>;
}

interface EvalResult {
  case_id: string;
  case_name: string;
  description: string;
  expected: Record<string, unknown>;
  actual: Record<string, unknown>;
  passed: boolean;
  notes: string;
}

export async function POST() {
  try {
    const testCases = (testCasesData as { test_cases: TestCase[] }).test_cases;
    const results: EvalResult[] = [];

    for (const tc of testCases) {
      const input = tc.input as unknown as ClaimSubmission;
      
      // Map test case input to ClaimSubmission format
      const claim: ClaimSubmission = {
        member_id: input.member_id,
        policy_id: input.policy_id,
        claim_category: input.claim_category,
        treatment_date: input.treatment_date,
        claimed_amount: input.claimed_amount,
        hospital_name: input.hospital_name,
        ytd_claims_amount: input.ytd_claims_amount,
        documents: input.documents || [],
        claims_history: input.claims_history,
        simulate_component_failure: input.simulate_component_failure,
      };

      const result = await processClaim(claim);
      const expected = tc.expected;

      // Check if result matches expected
      let passed = true;
      const notes: string[] = [];

      if (expected.decision !== null && expected.decision !== undefined) {
        if (result.decision !== expected.decision) {
          passed = false;
          notes.push(`Decision mismatch: expected ${expected.decision}, got ${result.decision}`);
        } else {
          notes.push(`✓ Decision matches: ${result.decision}`);
        }
      }

      if (expected.approved_amount !== undefined) {
        if (result.approved_amount !== expected.approved_amount) {
          passed = false;
          notes.push(`Amount mismatch: expected ₹${expected.approved_amount}, got ₹${result.approved_amount}`);
        } else {
          notes.push(`✓ Amount matches: ₹${result.approved_amount}`);
        }
      }

      if (expected.confidence_score) {
        const threshold = parseFloat((expected.confidence_score as string).replace('above ', ''));
        if (result.confidence_score < threshold) {
          notes.push(`⚠ Confidence ${result.confidence_score.toFixed(2)} below expected ${threshold}`);
        } else {
          notes.push(`✓ Confidence ${result.confidence_score.toFixed(2)} above ${threshold}`);
        }
      }

      if (expected.system_must) {
        notes.push(`System requirements: ${(expected.system_must as string[]).join('; ')}`);
      }

      if (expected.decision === null) {
        // Early stop cases (TC001-TC003): should not produce APPROVED/PARTIAL
        if (result.decision === 'APPROVED' || result.decision === 'PARTIAL') {
          passed = false;
          notes.push('Should have stopped early but approved/partially approved');
        } else {
          notes.push('✓ System correctly stopped before making a decision');
        }
      }

      results.push({
        case_id: tc.case_id,
        case_name: tc.case_name,
        description: tc.description,
        expected: expected,
        actual: {
          decision: result.decision,
          approved_amount: result.approved_amount,
          confidence_score: result.confidence_score,
          reason: result.reason,
          member_message: result.member_message,
          warnings: result.warnings,
          processing_time_ms: result.processing_time_ms,
          trace_steps: result.trace.steps.length,
        },
        passed,
        notes: notes.join('\n'),
      });
    }

    const summary = {
      total: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      pass_rate: `${((results.filter(r => r.passed).length / results.length) * 100).toFixed(0)}%`,
    };

    return NextResponse.json({ summary, results }, { status: 200 });
  } catch (error) {
    console.error('Eval error:', error);
    return NextResponse.json(
      { error: 'Eval run failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
