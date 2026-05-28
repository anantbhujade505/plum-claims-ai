// ============================================================
// API: POST /api/claims — Submit and process a claim
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { processClaim } from '@/agents/orchestrator';
import type { ClaimSubmission } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ClaimSubmission;

    // Basic input validation
    if (!body.member_id || !body.policy_id || !body.claim_category || !body.treatment_date || !body.claimed_amount) {
      return NextResponse.json(
        { error: 'Missing required fields: member_id, policy_id, claim_category, treatment_date, claimed_amount' },
        { status: 400 }
      );
    }

    if (!body.documents || body.documents.length === 0) {
      return NextResponse.json(
        { error: 'At least one document must be uploaded with the claim.' },
        { status: 400 }
      );
    }

    const result = await processClaim(body);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Claim processing error:', error);
    return NextResponse.json(
      { error: 'Internal server error during claim processing.', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
