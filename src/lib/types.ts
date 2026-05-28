// ============================================================
// CORE TYPE DEFINITIONS — Claims Processing System
// ============================================================
// These types form the contract layer between all components.
// Any engineer can reimplement a component using only these types.
// ============================================================

// --- Enums ---

export type ClaimCategory =
  | 'CONSULTATION'
  | 'DIAGNOSTIC'
  | 'PHARMACY'
  | 'DENTAL'
  | 'VISION'
  | 'ALTERNATIVE_MEDICINE';

export type DocumentType =
  | 'PRESCRIPTION'
  | 'HOSPITAL_BILL'
  | 'LAB_REPORT'
  | 'PHARMACY_BILL'
  | 'DIAGNOSTIC_REPORT'
  | 'DISCHARGE_SUMMARY'
  | 'DENTAL_REPORT'
  | 'UNKNOWN';

export type ClaimDecision = 'APPROVED' | 'PARTIAL' | 'REJECTED' | 'MANUAL_REVIEW';

export type DocumentQuality = 'GOOD' | 'FAIR' | 'POOR' | 'UNREADABLE';

export type TraceStepStatus = 'PASSED' | 'FAILED' | 'WARNING' | 'SKIPPED' | 'ERROR';

// --- Document Types ---

export interface UploadedDocument {
  file_id: string;
  file_name: string;
  actual_type?: DocumentType;
  quality?: DocumentQuality;
  content?: DocumentContent;
  patient_name_on_doc?: string;
}

export interface DocumentContent {
  doctor_name?: string;
  doctor_registration?: string;
  patient_name?: string;
  date?: string;
  diagnosis?: string;
  treatment?: string;
  medicines?: string[];
  tests_ordered?: string[];
  hospital_name?: string;
  line_items?: LineItem[];
  total?: number;
  test_name?: string;
  specialization?: string;
  age?: number;
  gender?: string;
}

export interface LineItem {
  description: string;
  amount: number;
}

// --- Claim Input ---

export interface ClaimSubmission {
  claim_id?: string;
  member_id: string;
  policy_id: string;
  claim_category: ClaimCategory;
  treatment_date: string;
  claimed_amount: number;
  hospital_name?: string;
  ytd_claims_amount?: number;
  documents: UploadedDocument[];
  claims_history?: ClaimHistoryEntry[];
  simulate_component_failure?: boolean;
}

export interface ClaimHistoryEntry {
  claim_id: string;
  date: string;
  amount: number;
  provider: string;
}

// --- Trace System ---

export interface TraceStep {
  agent: string;
  step: string;
  status: TraceStepStatus;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
  duration_ms?: number;
}

export interface ProcessingTrace {
  claim_id: string;
  steps: TraceStep[];
  started_at: string;
  completed_at?: string;
  total_duration_ms?: number;
}

// --- Agent Results ---

export interface DocumentVerificationResult {
  passed: boolean;
  verified_documents: VerifiedDocument[];
  errors: DocumentError[];
  warnings: string[];
}

export interface VerifiedDocument {
  file_id: string;
  file_name: string;
  detected_type: DocumentType;
  quality: DocumentQuality;
  patient_name?: string;
  confidence: number;
}

export interface DocumentError {
  file_id?: string;
  file_name?: string;
  error_type: 'WRONG_TYPE' | 'MISSING_REQUIRED' | 'UNREADABLE' | 'PATIENT_MISMATCH';
  message: string;
  expected_type?: DocumentType;
  actual_type?: DocumentType;
  details?: Record<string, unknown>;
}

export interface ExtractedData {
  patient_name?: string;
  patient_age?: number;
  patient_gender?: string;
  doctor_name?: string;
  doctor_registration?: string;
  doctor_specialization?: string;
  hospital_name?: string;
  diagnosis?: string;
  treatment?: string;
  medicines?: string[];
  tests_ordered?: string[];
  line_items?: LineItem[];
  total_amount?: number;
  treatment_date?: string;
  confidence: number;
}

export interface EligibilityResult {
  eligible: boolean;
  member_found: boolean;
  member_name?: string;
  reasons: EligibilityReason[];
  applicable_sub_limit?: number;
  copay_percent?: number;
  network_discount_percent?: number;
  requires_pre_auth?: boolean;
}

export interface EligibilityReason {
  check: string;
  passed: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface CalculationResult {
  claimed_amount: number;
  approved_amount: number;
  network_discount_applied: number;
  copay_deducted: number;
  sub_limit_applied: boolean;
  per_claim_limit_applied: boolean;
  annual_limit_applied: boolean;
  line_item_decisions?: LineItemDecision[];
  breakdown: CalculationBreakdown;
}

export interface LineItemDecision {
  description: string;
  amount: number;
  approved: boolean;
  approved_amount: number;
  reason?: string;
}

export interface CalculationBreakdown {
  original_amount: number;
  after_exclusions: number;
  after_sub_limit: number;
  after_network_discount: number;
  after_copay: number;
  after_per_claim_limit: number;
  final_amount: number;
  steps: string[];
}

export interface FraudCheckResult {
  flagged: boolean;
  risk_score: number;
  signals: FraudSignal[];
  recommendation: 'PROCEED' | 'MANUAL_REVIEW';
}

export interface FraudSignal {
  signal_type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  message: string;
  details?: Record<string, unknown>;
}

// --- Final Decision ---

export interface ClaimDecisionResult {
  claim_id: string;
  decision: ClaimDecision;
  approved_amount: number;
  claimed_amount: number;
  confidence_score: number;
  reason: string;
  rejection_reasons?: string[];
  line_item_decisions?: LineItemDecision[];
  trace: ProcessingTrace;
  warnings: string[];
  processing_time_ms: number;
  member_message: string;
}

// --- Policy Types ---

export interface PolicyTerms {
  policy_id: string;
  policy_name: string;
  insurer: string;
  policy_holder: PolicyHolder;
  coverage: Coverage;
  opd_categories: Record<string, OPDCategory>;
  waiting_periods: WaitingPeriods;
  exclusions: Exclusions;
  pre_authorization: PreAuthorization;
  network_hospitals: string[];
  submission_rules: SubmissionRules;
  document_requirements: Record<string, DocumentRequirement>;
  fraud_thresholds: FraudThresholds;
  members: Member[];
}

export interface PolicyHolder {
  company_name: string;
  employee_count: number;
  policy_start_date: string;
  policy_end_date: string;
  renewal_status: string;
}

export interface Coverage {
  sum_insured_per_employee: number;
  annual_opd_limit: number;
  per_claim_limit: number;
  family_floater: {
    enabled: boolean;
    combined_limit: number;
    covered_relationships: string[];
  };
}

export interface OPDCategory {
  sub_limit: number;
  copay_percent: number;
  network_discount_percent?: number;
  requires_prescription: boolean;
  requires_pre_auth?: boolean;
  pre_auth_threshold?: number;
  high_value_tests_requiring_pre_auth?: string[];
  requires_dental_report?: boolean;
  requires_registered_practitioner?: boolean;
  max_sessions_per_year?: number;
  branded_drug_copay_percent?: number;
  generic_mandatory?: boolean;
  covered: boolean;
  covered_procedures?: string[];
  excluded_procedures?: string[];
  covered_items?: string[];
  excluded_items?: string[];
  covered_systems?: string[];
}

export interface WaitingPeriods {
  initial_waiting_period_days: number;
  pre_existing_conditions_days: number;
  specific_conditions: Record<string, number>;
}

export interface Exclusions {
  conditions: string[];
  dental_exclusions: string[];
  vision_exclusions: string[];
}

export interface PreAuthorization {
  required_for: string[];
  validity_days: number;
}

export interface SubmissionRules {
  deadline_days_from_treatment: number;
  minimum_claim_amount: number;
  currency: string;
}

export interface DocumentRequirement {
  required: string[];
  optional: string[];
}

export interface FraudThresholds {
  same_day_claims_limit: number;
  monthly_claims_limit: number;
  high_value_claim_threshold: number;
  auto_manual_review_above: number;
  fraud_score_manual_review_threshold: number;
}

export interface Member {
  member_id: string;
  name: string;
  date_of_birth: string;
  gender: string;
  relationship: string;
  join_date: string;
  dependents?: string[];
  primary_member_id?: string;
}
