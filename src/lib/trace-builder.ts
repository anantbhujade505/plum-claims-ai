// ============================================================
// TRACE BUILDER — Builds observability traces for claim processing
// ============================================================
// Input:  claim_id
// Output: Mutable trace object with helper methods
// ============================================================

import type { ProcessingTrace, TraceStep, TraceStepStatus } from './types';

export class TraceBuilder {
  private trace: ProcessingTrace;
  
  constructor(claimId: string) {
    this.trace = {
      claim_id: claimId,
      steps: [],
      started_at: new Date().toISOString(),
    };
  }

  addStep(
    agent: string,
    step: string,
    status: TraceStepStatus,
    message: string,
    details?: Record<string, unknown>,
    durationMs?: number
  ): void {
    this.trace.steps.push({
      agent,
      step,
      status,
      message,
      details,
      timestamp: new Date().toISOString(),
      duration_ms: durationMs,
    });
  }

  pass(agent: string, step: string, message: string, details?: Record<string, unknown>): void {
    this.addStep(agent, step, 'PASSED', message, details);
  }

  fail(agent: string, step: string, message: string, details?: Record<string, unknown>): void {
    this.addStep(agent, step, 'FAILED', message, details);
  }

  warn(agent: string, step: string, message: string, details?: Record<string, unknown>): void {
    this.addStep(agent, step, 'WARNING', message, details);
  }

  skip(agent: string, step: string, message: string, details?: Record<string, unknown>): void {
    this.addStep(agent, step, 'SKIPPED', message, details);
  }

  error(agent: string, step: string, message: string, details?: Record<string, unknown>): void {
    this.addStep(agent, step, 'ERROR', message, details);
  }

  complete(): ProcessingTrace {
    this.trace.completed_at = new Date().toISOString();
    const start = new Date(this.trace.started_at).getTime();
    const end = new Date(this.trace.completed_at).getTime();
    this.trace.total_duration_ms = end - start;
    return this.trace;
  }

  getTrace(): ProcessingTrace {
    return { ...this.trace };
  }

  getSteps(): TraceStep[] {
    return [...this.trace.steps];
  }

  hasFailures(): boolean {
    return this.trace.steps.some(s => s.status === 'FAILED' || s.status === 'ERROR');
  }

  hasWarnings(): boolean {
    return this.trace.steps.some(s => s.status === 'WARNING');
  }
}
