import { NextResponse } from 'next/server';
import testCasesData from '@/data/test_cases.json';

export async function GET() {
  return NextResponse.json(testCasesData);
}
