'use client';

import { useState } from 'react';
import ClaimForm from '@/components/ClaimForm';
import ClaimResult from '@/components/ClaimResult';
import EvalDashboard from '@/components/EvalDashboard';
import type { ClaimDecisionResult } from '@/lib/types';

type Tab = 'submit' | 'eval' | 'architecture';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('submit');
  const [result, setResult] = useState<ClaimDecisionResult | null>(null);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <header style={{ 
        borderBottom: '1px solid var(--border-subtle)',
        background: 'rgba(10, 10, 15, 0.9)',
        backdropFilter: 'blur(20px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'var(--gradient-plum)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 16,
            }}>P</div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.5px' }}>
                Plum Claims <span className="gradient-text">AI</span>
              </h1>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -2 }}>
                Multi-Agent Claims Processing Engine
              </p>
            </div>
          </div>

          <nav className="flex gap-1" style={{ background: 'var(--bg-secondary)', padding: 4, borderRadius: 10 }}>
            {[
              { id: 'submit' as Tab, label: '🏥 Submit Claim' },
              { id: 'eval' as Tab, label: '📊 Eval Dashboard' },
              { id: 'architecture' as Tab, label: '🏗️ Architecture' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'submit' && (
          <div className="animate-fade-in-up">
            {/* Hero */}
            <div className="text-center mb-10">
              <h2 className="gradient-text" style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1px', marginBottom: 8 }}>
                Intelligent Claims Processing
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 16, maxWidth: 600, margin: '0 auto' }}>
                Submit a health insurance claim and watch our multi-agent AI system verify documents, 
                check eligibility, calculate amounts, and deliver an explainable decision in seconds.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <ClaimForm onResult={setResult} />
              <ClaimResult result={result} />
            </div>
          </div>
        )}

        {activeTab === 'eval' && (
          <div className="animate-fade-in-up">
            <EvalDashboard />
          </div>
        )}

        {activeTab === 'architecture' && (
          <div className="animate-fade-in-up">
            <ArchitecturePage />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-subtle)', padding: '24px 0', marginTop: 60 }}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Built by Anant N. · AI Engineer Assignment · Plum
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Powered by Multi-Agent Architecture + Claude AI
          </p>
        </div>
      </footer>
    </div>
  );
}

function ArchitecturePage() {
  return (
    <div>
      <h2 className="gradient-text" style={{ fontSize: 32, fontWeight: 800, marginBottom: 24 }}>
        System Architecture
      </h2>

      {/* Pipeline Visualization */}
      <div className="glass-card p-8 mb-8">
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Multi-Agent Processing Pipeline</h3>
        <div className="flex flex-wrap gap-4 items-center justify-center">
          {[
            { icon: '📄', name: 'Document\nVerification', desc: 'Type + quality + patient match' },
            { icon: '🔍', name: 'Document\nParsing', desc: 'LLM-powered extraction' },
            { icon: '✅', name: 'Eligibility\nEngine', desc: 'Policy rules + waiting periods' },
            { icon: '💰', name: 'Calculation\nEngine', desc: 'Discounts → co-pay → limits' },
            { icon: '🛡️', name: 'Fraud\nDetection', desc: 'Pattern analysis + thresholds' },
            { icon: '⚖️', name: 'Decision\nAgent', desc: 'Final verdict + confidence' },
          ].map((agent, i) => (
            <div key={agent.name} className="flex items-center gap-4">
              <div className="glass-card p-4 text-center" style={{ minWidth: 140 }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>{agent.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'pre-line', lineHeight: 1.3 }}>{agent.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{agent.desc}</div>
              </div>
              {i < 5 && <div style={{ fontSize: 20, color: 'var(--plum-500)' }}>→</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Design Decisions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          {
            title: '🎯 Why Multi-Agent?',
            content: 'Each agent has a single responsibility and a well-defined contract. This allows: independent testing, graceful degradation (if one agent fails, others continue), and easy extensibility (swap or add agents without rewriting the pipeline).'
          },
          {
            title: '📐 Calculation Order',
            content: 'Network discount is applied BEFORE co-pay, not after. This is critical for correctness (tested by TC010). The order is: exclusions → sub-limit → network discount → co-pay → per-claim limit.'
          },
          {
            title: '🔍 Observability',
            content: 'Every agent writes to a shared TraceBuilder. Each step records: what was checked, whether it passed/failed, the specific reason, and relevant data. The full trace is returned with every decision.'
          },
          {
            title: '🛡️ Graceful Degradation',
            content: 'If the LLM parsing agent fails (TC011), the system falls back to basic extraction, reduces confidence, and adds warnings. It never crashes. The trace shows exactly what failed.'
          },
          {
            title: '⚡ Scaling to 10x',
            content: '1) Move to PostgreSQL + Redis for state. 2) Add message queue (SQS/BullMQ) for async processing. 3) Cache LLM responses for similar documents. 4) Horizontal scaling of stateless agents.'
          },
          {
            title: '🔐 Limitations & Trade-offs',
            content: 'Current system uses in-memory state (no persistence across restarts). Document parsing uses structured content from test cases — in production, would use Claude Vision API for actual image/PDF extraction.'
          },
        ].map(card => (
          <div key={card.title} className="glass-card p-6">
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{card.title}</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{card.content}</p>
          </div>
        ))}
      </div>

      {/* Component Contracts */}
      <div className="glass-card p-8 mt-8">
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Component Contracts</h3>
        <div className="space-y-4">
          {[
            { name: 'DocumentVerificationAgent', input: 'ClaimSubmission', output: 'DocumentVerificationResult', errors: 'WRONG_TYPE, MISSING_REQUIRED, UNREADABLE, PATIENT_MISMATCH' },
            { name: 'DocumentParsingAgent', input: 'UploadedDocument[]', output: 'ExtractedData', errors: 'LLM timeout → fallback to basic extraction with low confidence' },
            { name: 'EligibilityEngine', input: 'ClaimSubmission + ExtractedData', output: 'EligibilityResult', errors: 'MEMBER_NOT_FOUND, WAITING_PERIOD, EXCLUSION, PRE_AUTH_MISSING' },
            { name: 'CalculationEngine', input: 'ClaimSubmission + ExtractedData + EligibilityResult', output: 'CalculationResult', errors: 'Pure function — no errors, deterministic' },
            { name: 'FraudDetectionAgent', input: 'ClaimSubmission', output: 'FraudCheckResult', errors: 'None — always returns a result with risk score' },
            { name: 'Orchestrator', input: 'ClaimSubmission', output: 'ClaimDecisionResult', errors: 'Never crashes — wraps all agent errors gracefully' },
          ].map(contract => (
            <div key={contract.name} style={{ 
              padding: '16px', 
              background: 'var(--bg-secondary)', 
              borderRadius: 10,
              borderLeft: '3px solid var(--plum-500)',
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--plum-400)' }}>{contract.name}</div>
              <div className="grid grid-cols-3 gap-4 mt-2">
                <div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>INPUT</span>
                  <div style={{ fontSize: 13 }}>{contract.input}</div>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>OUTPUT</span>
                  <div style={{ fontSize: 13 }}>{contract.output}</div>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>ERRORS</span>
                  <div style={{ fontSize: 13 }}>{contract.errors}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
