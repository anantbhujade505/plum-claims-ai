# Plum Claims AI — Intelligent Health Insurance Claims Processing

> Multi-agent AI system for automated health insurance claim processing with explainable decisions, real-time document verification, and comprehensive audit trails.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Test Pass Rate](https://img.shields.io/badge/Tests-12%2F12%20Passing-brightgreen)

## 🎯 What This Does

When an employee submits a health insurance claim, they upload medical documents (bills, prescriptions, lab reports). This system **automatically**:

1. **Verifies documents** — catches wrong types, unreadable files, patient mismatches
2. **Extracts structured data** — parses medical info from messy documents
3. **Checks eligibility** — validates member, waiting periods, exclusions, pre-auth
4. **Calculates amounts** — applies network discounts, co-pay, limits in correct order
5. **Detects fraud patterns** — flags suspicious same-day claims and high-value anomalies
6. **Makes an explainable decision** — APPROVED / PARTIAL / REJECTED / MANUAL_REVIEW with full trace

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     ORCHESTRATOR                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Document  │→│ Document │→│Eligibility│→│Calculation│      │
│  │Verification│ │ Parsing  │ │ Engine   │ │ Engine   │      │
│  │  Agent    │ │  Agent   │ │          │ │          │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│       ↓ early stop    ↓ LLM         ↓                      │
│  ┌──────────┐                       ┌──────────┐           │
│  │  Fraud   │───────────────────────│ Decision │           │
│  │Detection │                       │  Agent   │           │
│  └──────────┘                       └──────────┘           │
│                                                             │
│  TraceBuilder ─── records every step for full observability │
└─────────────────────────────────────────────────────────────┘
```

**6 agents** process each claim sequentially. If any agent fails, the pipeline degrades gracefully instead of crashing.

## 🚀 Quick Start

```bash
# Clone and install
git clone <repo-url>
cd plum-claims
npm install

# Run dev server
npm run dev
# Open http://localhost:3000
```

**No API keys needed** — the system works with structured test data out of the box.

## 📊 Test Results

All 12 test cases from `test_cases.json` pass:

| TC | Name | Decision | Amount | Status |
|----|------|----------|--------|--------|
| TC001 | Wrong Document | REJECTED | ₹0 | ✅ |
| TC002 | Unreadable Doc | REJECTED | ₹0 | ✅ |
| TC003 | Patient Mismatch | REJECTED | ₹0 | ✅ |
| TC004 | Full Approval | APPROVED | ₹1,350 | ✅ |
| TC005 | Waiting Period | REJECTED | ₹0 | ✅ |
| TC006 | Dental Partial | PARTIAL | ₹8,000 | ✅ |
| TC007 | MRI No Pre-Auth | REJECTED | ₹0 | ✅ |
| TC008 | Per-Claim Exceeded | REJECTED | ₹0 | ✅ |
| TC009 | Fraud Signal | MANUAL_REVIEW | ₹4,320 | ✅ |
| TC010 | Network Discount | APPROVED | ₹3,240 | ✅ |
| TC011 | Component Failure | APPROVED | ₹4,000 | ✅ |
| TC012 | Excluded Treatment | REJECTED | ₹0 | ✅ |

## 🛠️ Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Next.js 16 + TypeScript | Full-stack in one repo, React-based |
| Styling | Tailwind CSS + custom CSS | Premium dark UI with glassmorphism |
| Backend | Next.js API Routes | Serverless-ready, same deployment |
| Deployment | Github |

## 📁 Project Structure

```
src/
├── agents/                    # Multi-agent pipeline
│   ├── document-verification.ts  # Stage 1: Doc type/quality/patient checks
│   ├── document-parsing.ts       # Stage 2: LLM-powered data extraction
│   ├── eligibility-engine.ts     # Stage 3: Policy rule checks
│   ├── calculation-engine.ts     # Stage 4: Amount calculation
│   ├── fraud-detection.ts        # Stage 5: Fraud pattern detection
│   └── orchestrator.ts           # Pipeline controller
├── lib/
│   ├── types.ts                  # All TypeScript interfaces (contracts)
│   ├── policy-loader.ts          # Policy data access layer
│   └── trace-builder.ts          # Observability trace builder
├── data/
│   ├── policy_terms.json         # Policy configuration
│   └── test_cases.json           # 12 test scenarios
├── components/
│   ├── ClaimForm.tsx             # Claim submission UI
│   ├── ClaimResult.tsx           # Decision display with trace
│   └── EvalDashboard.tsx         # Test runner dashboard
└── app/
    ├── page.tsx                  # Main page (3 tabs)
    ├── layout.tsx                # Root layout
    ├── globals.css               # Premium design system
    └── api/
        ├── claims/route.ts       # POST /api/claims
        ├── eval/route.ts         # POST /api/eval
        └── test-cases/route.ts   # GET /api/test-cases
```

## 📐 Component Contracts

| Component | Input | Output | Errors |
|-----------|-------|--------|--------|
| DocumentVerificationAgent | `ClaimSubmission` | `DocumentVerificationResult` | WRONG_TYPE, MISSING_REQUIRED, UNREADABLE, PATIENT_MISMATCH |
| DocumentParsingAgent | `UploadedDocument[]` | `ExtractedData` | LLM timeout → fallback with low confidence |
| EligibilityEngine | `ClaimSubmission + ExtractedData` | `EligibilityResult` | MEMBER_NOT_FOUND, WAITING_PERIOD, EXCLUSION, PRE_AUTH_MISSING |
| CalculationEngine | `Claim + Extracted + Eligibility` | `CalculationResult` | Pure function — deterministic, no errors |
| FraudDetectionAgent | `ClaimSubmission` | `FraudCheckResult` | Always returns result with risk score |
| Orchestrator | `ClaimSubmission` | `ClaimDecisionResult` | Never crashes — wraps all errors |

## 🔑 Key Design Decisions

### 1. Network Discount Before Co-pay
The calculation order is: **exclusions → network discount → co-pay → per-claim limit**. This is critical — applying co-pay before discount gives a different (incorrect) result.

### 2. Early Stop on Document Issues
If documents are wrong/missing/unreadable, the pipeline stops immediately with a **specific, actionable** error message. No generic errors.

### 3. Graceful Degradation
If the LLM parsing agent fails (TC011), the system:
- Falls back to basic extraction
- Reduces confidence score (0.92 → 0.55)
- Adds warning about incomplete processing
- Recommends manual review
- **Never crashes**

### 4. Per-Claim Limit Logic
The per-claim limit (₹5,000) applies to claims where all items are eligible. For categories with their own higher sub-limits (dental: ₹10,000), the category sub-limit takes precedence.

## ⚡ Scaling to 10x

1. **PostgreSQL + Redis** — replace in-memory state with persistent storage and caching
2. **Message Queue** — SQS/BullMQ for async claim processing
3. **LLM Response Caching** — cache similar document extractions
4. **Horizontal Scaling** — agents are stateless, scale independently

## 📝 Limitations & Trade-offs

- **In-memory state**: Claims don't persist across server restarts
- **Document parsing**: Uses structured JSON content from test cases. In production, would use Claude Vision API for actual image/PDF extraction
- **Submission deadline**: Made non-blocking since test data uses 2024 dates
- **No authentication**: Out of scope for this assignment

## 👤 Author

Built by **Anant N.** for the AI Engineer role at Plum.

Built using **Antigravity (Claude AI)** — demonstrating the JD's principle of "Use AI to build AI."
