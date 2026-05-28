# Architecture Document
## Plum Claims AI — Multi-Agent Claims Processing System

---

## 1. System Overview

The system is a **multi-agent pipeline** where each agent has a single responsibility and a well-defined contract. An Orchestrator coordinates the agents sequentially, building an observability trace at every step.

```
                 ┌─────────────────────────────────┐
                 │        API Gateway               │
                 │    POST /api/claims              │
                 └────────────┬────────────────────┘
                              │
                 ┌────────────▼────────────────────┐
                 │        ORCHESTRATOR              │
                 │   • Manages pipeline flow        │
                 │   • Builds trace                 │
                 │   • Handles failures             │
                 └────────────┬────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                      │
   ┌────▼────┐          ┌────▼────┐           ┌────▼────┐
   │  Stage 1 │          │ Stage 2 │           │ Stage 3 │
   │  Doc     │    →     │  Doc    │     →     │Eligibil-│
   │  Verify  │          │ Parse   │           │  ity    │
   └────┬────┘          └────┬────┘           └────┬────┘
        │                     │                      │
        │ early stop          │ LLM fallback         │
        │ if invalid          │ if timeout           │
        │                     │                      │
   ┌────▼────┐          ┌────▼────┐           ┌────▼────┐
   │ Stage 4 │          │ Stage 5 │           │ Stage 6 │
   │  Calc   │    →     │  Fraud  │     →     │Decision │
   │ Engine  │          │ Detect  │           │  Agent  │
   └─────────┘          └─────────┘           └─────────┘
```

---

## 2. Component Design

### 2.1 Orchestrator (`orchestrator.ts`)
**Role**: Pipeline controller.

- Receives `ClaimSubmission`, assigns a claim ID
- Calls agents in sequence: Verify → Parse → Eligibility → Calculate → Fraud → Decision
- If any stage fails, returns early with specific error and full trace
- Builds a `ProcessingTrace` across all stages
- Handles `simulate_component_failure` for graceful degradation testing

**Key decision**: The orchestrator uses a linear pipeline (not parallel) because each stage depends on the previous stage's output. This keeps the logic simple and the trace sequential.

### 2.2 Document Verification Agent (`document-verification.ts`)
**Role**: Validate documents before any processing begins.

Checks:
1. **Document type matching** — are the required document types present for this claim category?
2. **Quality assessment** — is any document unreadable?
3. **Patient name cross-validation** — do all documents belong to the same patient?

**Error messages are specific**: "You uploaded a prescription, but a hospital bill is required for consultation claims" — never "Invalid document."

### 2.3 Document Parsing Agent (`document-parsing.ts`)
**Role**: Extract structured data from medical documents.

- In production: would use Claude Vision API for OCR + extraction
- For this assignment: extracts from the structured `content` field
- **Graceful degradation**: if parsing fails, falls back to basic extraction with reduced confidence (0.92 → 0.45)
- Adjusts confidence based on missing critical fields

### 2.4 Eligibility Engine (`eligibility-engine.ts`)
**Role**: Check policy rules against the claim.

Sequential checks:
1. Member exists in roster
2. Policy is active for treatment date
3. Initial waiting period (30 days)
4. Condition-specific waiting periods (diabetes: 90 days, etc.)
5. Treatment exclusions (bariatric, cosmetic, etc.)
6. Category coverage
7. Pre-authorization requirements (MRI > ₹10,000)
8. Minimum claim amount
9. Per-claim limit

Each check is a `EligibilityReason` with pass/fail status and specific message.

### 2.5 Calculation Engine (`calculation-engine.ts`)
**Role**: Compute the approved amount.

**Order is critical** (tested by TC010):
1. Line-item exclusions (teeth whitening, cosmetic procedures)
2. Sub-limit tracking
3. **Network discount** (20% for Apollo, etc.) — applied FIRST
4. **Co-pay** (10% for consultation) — applied AFTER discount
5. Per-claim limit enforcement

The calculation engine is a **pure function** — no external dependencies, no LLM calls, deterministic output. This makes it testable and auditable.

### 2.6 Fraud Detection Agent (`fraud-detection.ts`)
**Role**: Detect suspicious patterns.

Signals:
- Same-day claims exceeding limit (2)
- Monthly frequency exceeding limit (6)
- Multiple providers on same day
- High-value claims above threshold (₹25,000)

Returns a risk score. If flagged, recommends `MANUAL_REVIEW` rather than auto-rejecting.

---

## 3. Data Flow

```
ClaimSubmission
    │
    ▼
DocumentVerificationResult  ─── if errors → STOP (specific error message)
    │
    ▼
ExtractedData               ─── if LLM fails → fallback with low confidence
    │
    ▼
EligibilityResult           ─── if ineligible → REJECTED (specific reason)
    │
    ▼
CalculationResult           ─── approved amount with breakdown
    │
    ▼
FraudCheckResult            ─── if flagged → MANUAL_REVIEW
    │
    ▼
ClaimDecisionResult         ─── APPROVED / PARTIAL / REJECTED / MANUAL_REVIEW
    + ProcessingTrace       ─── every step recorded
    + member_message        ─── human-readable explanation
```

---

## 4. Observability

The `TraceBuilder` records every agent step:

```typescript
{
  agent: "EligibilityEngine",
  step: "condition_waiting",
  status: "FAILED",
  message: "diabetes waiting period not met (45/90 days)",
  timestamp: "2024-11-01T10:30:00Z"
}
```

This allows ops teams to:
- Reconstruct exactly why any claim got any decision
- Identify which step caused a rejection
- See confidence adjustments and warnings
- Debug issues without reading code

---

## 5. Design Decisions & Alternatives Considered

| Decision | Chosen | Alternative Considered | Why |
|----------|--------|----------------------|-----|
| Pipeline type | Sequential | Parallel agents | Dependencies between stages; trace clarity |
| State management | In-memory | Database | Sufficient for assignment scope |
| LLM integration | Structured extraction | RAG pipeline | Direct extraction is simpler and more reliable for known document types |
| Error handling | Graceful degradation | Hard fail | Assignment requires resilience (TC011) |
| Calculation order | Discount → copay | Copay → discount | TC010 explicitly tests this order |

---

## 6. Scaling to 10x (75,000 → 750,000 claims/year)

### Short-term
- **PostgreSQL** for claim persistence and member data
- **Redis** for policy rule caching and session state
- **BullMQ** for async claim processing queue

### Medium-term
- **LLM response caching** — similar documents produce similar extractions
- **Horizontal scaling** — agents are stateless, deploy multiple instances
- **Batch processing** — process multiple claims in parallel

### Long-term
- **Model fine-tuning** — train specialized models for Indian medical document extraction
- **Real-time monitoring** — Prometheus/Grafana for pipeline metrics
- **A/B testing** — compare different LLM prompts and extraction strategies

---

## 7. Limitations

1. **No persistence**: Claims are lost on server restart
2. **No real document parsing**: Uses structured content from test cases
3. **No authentication**: All endpoints are public
4. **Single-threaded**: No async processing queue
5. **No rate limiting**: API can be overwhelmed

These are conscious trade-offs for a 2-3 day assignment. Each would be addressed in a production system.
