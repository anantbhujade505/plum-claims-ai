'use client';

import { useState } from 'react';

interface EvalResult {
  case_id: string;
  case_name: string;
  description: string;
  expected: Record<string, unknown>;
  actual: Record<string, unknown>;
  passed: boolean;
  notes: string;
}

interface EvalResponse {
  summary: { total: number; passed: number; failed: number; pass_rate: string };
  results: EvalResult[];
}

export default function EvalDashboard() {
  const [evalData, setEvalData] = useState<EvalResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedCase, setExpandedCase] = useState<string | null>(null);

  const runEval = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/eval', { method: 'POST' });
      const data = await res.json();
      setEvalData(data);
    } catch (err) {
      console.error('Eval error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="gradient-text" style={{ fontSize: 32, fontWeight: 800 }}>
            Evaluation Dashboard
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
            Run all 12 test cases through the multi-agent pipeline and compare with expected outcomes.
          </p>
        </div>
        <button className="btn-primary" onClick={runEval} disabled={loading}>
          {loading ? (
            <span className="flex items-center gap-2">
              <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              Running...
            </span>
          ) : (
            '▶ Run All Test Cases'
          )}
        </button>
      </div>

      {evalData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="glass-card p-5 text-center">
              <div style={{ fontSize: 32, fontWeight: 800 }}>{evalData.summary.total}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Total Tests</div>
            </div>
            <div className="glass-card p-5 text-center">
              <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--success)' }}>{evalData.summary.passed}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Passed</div>
            </div>
            <div className="glass-card p-5 text-center">
              <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--error)' }}>{evalData.summary.failed}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Failed</div>
            </div>
            <div className="glass-card p-5 text-center pulse-glow">
              <div className="gradient-text" style={{ fontSize: 32, fontWeight: 800 }}>{evalData.summary.pass_rate}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Pass Rate</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ height: 6, background: 'var(--bg-card)', borderRadius: 3, marginBottom: 24, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: evalData.summary.pass_rate,
              background: 'var(--gradient-plum)',
              borderRadius: 3,
              transition: 'width 1s ease',
            }} />
          </div>

          {/* Test Case Results */}
          <div className="space-y-3">
            {evalData.results.map(tc => (
              <div
                key={tc.case_id}
                className="glass-card"
                style={{ overflow: 'hidden' }}
              >
                <div
                  className="flex items-center justify-between p-4 cursor-pointer"
                  onClick={() => setExpandedCase(expandedCase === tc.case_id ? null : tc.case_id)}
                  style={{ transition: 'background 0.2s' }}
                >
                  <div className="flex items-center gap-3">
                    <span className={`badge ${tc.passed ? 'badge-passed' : 'badge-failed'}`}>
                      {tc.passed ? '✓ PASS' : '✗ FAIL'}
                    </span>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{tc.case_id}</span>
                      <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 13 }}>{tc.case_name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {typeof tc.actual.decision === 'string' && (
                      <span className={`badge badge-${tc.actual.decision.toLowerCase().replace('_', '-')}`}>
                        {tc.actual.decision}
                      </span>
                    )}
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {String(tc.actual.processing_time_ms ?? 0)}ms
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 16, transition: 'transform 0.2s', transform: expandedCase === tc.case_id ? 'rotate(180deg)' : 'none' }}>
                      ▾
                    </span>
                  </div>
                </div>

                {expandedCase === tc.case_id && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '12px 0', lineHeight: 1.5 }}>
                      {tc.description}
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Expected</h4>
                        <pre style={{ fontSize: 11, background: 'var(--bg-secondary)', padding: 12, borderRadius: 8, overflowX: 'auto', color: 'var(--text-secondary)' }}>
                          {JSON.stringify(tc.expected, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <h4 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Actual</h4>
                        <pre style={{ fontSize: 11, background: 'var(--bg-secondary)', padding: 12, borderRadius: 8, overflowX: 'auto', color: 'var(--text-secondary)' }}>
                          {JSON.stringify(tc.actual, null, 2)}
                        </pre>
                      </div>
                    </div>

                    <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-secondary)', borderRadius: 8 }}>
                      <h4 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>Notes</h4>
                      <pre style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                        {tc.notes}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {!evalData && !loading && (
        <div className="glass-card p-12 text-center">
          <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Click &ldquo;Run All Test Cases&rdquo; to execute all 12 test scenarios and generate the eval report.
          </p>
        </div>
      )}
    </div>
  );
}
