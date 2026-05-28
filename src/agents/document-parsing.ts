// ============================================================
// AGENT 2: DOCUMENT PARSING AGENT (LLM-powered)
// ============================================================
import type { UploadedDocument, ExtractedData, LineItem } from '../lib/types';
import { TraceBuilder } from '../lib/trace-builder';

const AGENT_NAME = 'DocumentParsingAgent';

export async function parseDocuments(
  documents: UploadedDocument[],
  trace: TraceBuilder,
  simulateFailure: boolean = false
): Promise<ExtractedData> {
  if (simulateFailure) {
    trace.error(AGENT_NAME, 'llm_extraction', 'LLM service timeout — component failure simulated');
    const basicData = extractBasicData(documents);
    basicData.confidence = 0.45;
    trace.warn(AGENT_NAME, 'fallback_extraction', 'Fell back to basic extraction — confidence reduced');
    return basicData;
  }

  try {
    const extracted = extractFromContent(documents, trace);
    trace.pass(AGENT_NAME, 'extraction_complete', `Extracted data from ${documents.length} doc(s)`, {
      confidence: extracted.confidence,
    });
    return extracted;
  } catch (error) {
    trace.error(AGENT_NAME, 'extraction_failed', `Parsing failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    const basicData = extractBasicData(documents);
    basicData.confidence = 0.3;
    return basicData;
  }
}

function extractFromContent(documents: UploadedDocument[], trace: TraceBuilder): ExtractedData {
  const result: ExtractedData = { confidence: 0.92 };
  const allLineItems: LineItem[] = [];

  for (const doc of documents) {
    if (!doc.content) { trace.warn(AGENT_NAME, 'parse_document', `No content for ${doc.file_name}`); continue; }
    const c = doc.content;
    if (c.patient_name && !result.patient_name) result.patient_name = c.patient_name;
    if (c.doctor_name && !result.doctor_name) result.doctor_name = c.doctor_name;
    if (c.doctor_registration && !result.doctor_registration) result.doctor_registration = c.doctor_registration;
    if (c.specialization && !result.doctor_specialization) result.doctor_specialization = c.specialization;
    if (c.hospital_name && !result.hospital_name) result.hospital_name = c.hospital_name;
    if (c.diagnosis && !result.diagnosis) result.diagnosis = c.diagnosis;
    if (c.treatment && !result.treatment) result.treatment = c.treatment;
    if (c.medicines) result.medicines = c.medicines;
    if (c.tests_ordered) result.tests_ordered = c.tests_ordered;
    if (c.date && !result.treatment_date) result.treatment_date = c.date;
    if (c.total) result.total_amount = c.total;
    if (c.line_items) allLineItems.push(...c.line_items);
    trace.pass(AGENT_NAME, 'parse_document', `Extracted from ${doc.file_name} (${doc.actual_type})`);
  }
  if (allLineItems.length > 0) result.line_items = allLineItems;

  const criticalFields = [result.patient_name, result.diagnosis, result.total_amount];
  const missing = criticalFields.filter(f => !f).length;
  if (missing > 0) {
    result.confidence = Math.max(0.5, result.confidence - missing * 0.15);
    trace.warn(AGENT_NAME, 'confidence_adjustment', `Confidence reduced: ${missing} missing critical field(s)`);
  }
  return result;
}

function extractBasicData(documents: UploadedDocument[]): ExtractedData {
  const result: ExtractedData = { confidence: 0.5 };
  for (const doc of documents) {
    if (!doc.content) continue;
    const c = doc.content;
    if (c.patient_name) result.patient_name = c.patient_name;
    if (c.doctor_name) result.doctor_name = c.doctor_name;
    if (c.diagnosis) result.diagnosis = c.diagnosis;
    if (c.treatment) result.treatment = c.treatment;
    if (c.total) result.total_amount = c.total;
    if (c.line_items) result.line_items = c.line_items;
    if (c.hospital_name) result.hospital_name = c.hospital_name;
  }
  return result;
}
