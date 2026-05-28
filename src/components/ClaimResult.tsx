'use client';

import { useState } from 'react';
import type { ClaimDecisionResult, TraceStep } from '@/lib/types';

interface ClaimResultProps {
  result: ClaimDecisionResult | null;
}

export default function ClaimResult({ result }: ClaimResultProps) {
  const [activeView, setActiveView] = useState<'summary' | 'trace' | 'raw'>('summary');

  if (!result) {
    return (
      <div className="glass-card p-6 flex items-center justify-center" style={{ minHeight: 400 }}>
        <div className="text-center">
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏥</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Submit a claim or select a test scenario to see the AI decision and full processing trace.
          </p>
        </div>
      </div>
    );
  }

  const decisionBadge = `badge-${result.decision.toLowerCase().replace('_', '-')}`;
  const decisionEmoji = {
    APPROVED: '✅', PARTIAL: '⚠️', REJECTED: '❌', MANUAL_REVIEW: '🔍',
  }[result.decision] || '❓';

  return (
    <div className="glass-card p-6 animate-fade-in-up">
      {/* Decision Header */}
      <div style={{
        padding: '20px',
        borderRadius: 12,
        background: result.decision === 'APPROVED' ? 'var(--success-bg)' :
                     result.decision === 'PARTIAL' ? 'var(--warning-bg)' :
                     result.decision === 'REJECTED' ? 'var(--error-bg)' : 'var(--info-bg)',
        marginBottom: 20,
      }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 28 }}>{decisionEmoji}</span>
            <div>
              <span className={`badge ${decisionBadge}`}>{result.decision}</span>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Claim {result.claim_id}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div style={{ fontSize: 24, fontWeight: 800 }}>
              ₹{result.approved_amount.toLocaleString('en-IN')}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              of ₹{result.claimed_amount.toLocaleString('en-IN')} claimed
            </p>
          </div>
        </div>

        {/* Confidence + Processing Time */}
        <div className="flex gap-4">
          <div style={{ fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>Confidence: </span>
            <span style={{ fontWeight: 700, color: result.confidence_score >= 0.8 ? 'var(--success)' : result.confidence_score >= 0.5 ? 'var(--warning)' : 'var(--error)' }}>
              {(result.confidence_score * 100).toFixed(0)}%
            </span>
          </div>
          <div style={{ fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>Processed in: </span>
            <span style={{ fontWeight: 600 }}>{result.processing_time_ms}ms</span>
          </div>
          <div style={{ fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>Steps: </span>
            <span style={{ fontWeight: 600 }}>{result.trace.steps.length}</span>
          </div>
        </div>
      </div>

      {/* Member Message */}
      <div style={{
        padding: '14px 16px',
        background: 'var(--bg-secondary)',
        borderRadius: 10,
        borderLeft: '3px solid var(--plum-500)',
        marginBottom: 16,
        fontSize: 13,
        lineHeight: 1.5,
        color: 'var(--text-secondary)',
      }}>
        💬 {result.member_message}
      </div>

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {result.warnings.map((w, i) => (
            <div key={i} style={{
              padding: '8px 12px',
              background: 'var(--warning-bg)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--warning)',
              marginBottom: 4,
            }}>
              ⚠️ {w}
            </div>
          ))}
        </div>
      )}

      {/* Line Item Decisions */}
      {result.line_item_decisions && result.line_item_decisions.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-muted)' }}>LINE ITEM BREAKDOWN</h4>
          {result.line_item_decisions.map((li, i) => (
            <div key={i} className="flex items-center justify-between" style={{
              padding: '10px 12px',
              background: li.approved ? 'var(--success-bg)' : 'var(--error-bg)',
              borderRadius: 8,
              marginBottom: 4,
              fontSize: 13,
            }}>
              <div className="flex items-center gap-2">
                <span>{li.approved ? '✅' : '❌'}</span>
                <span>{li.description}</span>
              </div>
              <div className="text-right">
                <span style={{ fontWeight: 700 }}>₹{li.approved_amount.toLocaleString('en-IN')}</span>
                {!li.approved && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>of ₹{li.amount.toLocaleString('en-IN')}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Tabs */}
      <div className="flex gap-1 mb-4" style={{ background: 'var(--bg-secondary)', padding: 3, borderRadius: 8 }}>
        {(['summary', 'trace', 'raw'] as const).map(view => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className={`tab ${activeView === view ? 'active' : ''}`}
            style={{ flex: 1, textAlign: 'center' }}
          >
            {view === 'summary' ? '📋 Summary' : view === 'trace' ? '🔍 Full Trace' : '{ } Raw JSON'}
          </button>
        ))}
      </div>

      {/* View Content */}
      {activeView === 'summary' && (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <p><strong>Reason:</strong> {result.reason}</p>
          {result.rejection_reasons && (
            <p style={{ marginTop: 8 }}><strong>Rejection Codes:</strong> {result.rejection_reasons.join(', ')}</p>
          )}
        </div>
      )}

      {activeView === 'trace' && (
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {result.trace.steps.map((step, i) => (
            <TraceStepRow key={i} step={step} index={i} />
          ))}
        </div>
      )}

      {activeView === 'raw' && (
        <pre style={{
          background: 'var(--bg-secondary)',
          padding: 16,
          borderRadius: 10,
          fontSize: 11,
          overflowX: 'auto',
          maxHeight: 400,
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
        }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}

function TraceStepRow({ step, index }: { step: TraceStep; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const statusColor = {
    PASSED: 'var(--success)',
    FAILED: 'var(--error)',
    WARNING: 'var(--warning)',
    SKIPPED: 'var(--text-muted)',
    ERROR: 'var(--error)',
  }[step.status];

  return (
    <div
      className="trace-line animate-slide-in"
      style={{
        paddingBottom: 12,
        marginBottom: 4,
        cursor: step.details ? 'pointer' : 'default',
        animationDelay: `${index * 30}ms`,
      }}
      onClick={() => step.details && setExpanded(!expanded)}
    >
      <div className={`trace-dot ${step.status.toLowerCase()}`} />
      <div>
        <div className="flex items-center gap-2" style={{ fontSize: 12 }}>
          <span style={{ color: statusColor, fontWeight: 700 }}>
            {step.status === 'PASSED' ? '✓' : step.status === 'FAILED' ? '✗' : step.status === 'WARNING' ? '⚠' : step.status === 'ERROR' ? '✗' : '○'}
          </span>
          <span style={{ color: 'var(--plum-400)', fontWeight: 600, fontSize: 11 }}>{step.agent}</span>
          <span style={{ color: 'var(--text-muted)' }}>›</span>
          <span style={{ color: 'var(--text-secondary)' }}>{step.step}</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, marginLeft: 16 }}>
          {step.message}
        </p>
        {expanded && step.details && (
          <pre style={{
            fontSize: 10,
            background: 'var(--bg-secondary)',
            padding: 8,
            borderRadius: 6,
            marginTop: 4,
            marginLeft: 16,
            color: 'var(--text-muted)',
            overflowX: 'auto',
          }}>
            {JSON.stringify(step.details, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
