// ============================================================
// AGENT 1: DOCUMENT VERIFICATION AGENT
// ============================================================
// Input:  ClaimSubmission (documents + claim_category)
// Output: DocumentVerificationResult
// Errors: WRONG_TYPE, MISSING_REQUIRED, UNREADABLE, PATIENT_MISMATCH
// 
// This agent runs BEFORE any processing. If verification fails,
// the pipeline stops immediately with a specific, actionable error.
// ============================================================

import type {
  ClaimSubmission,
  DocumentVerificationResult,
  VerifiedDocument,
  DocumentError,
  DocumentType,
} from '../lib/types';
import { getDocumentRequirements } from '../lib/policy-loader';
import { TraceBuilder } from '../lib/trace-builder';

const AGENT_NAME = 'DocumentVerificationAgent';

export function verifyDocuments(
  claim: ClaimSubmission,
  trace: TraceBuilder
): DocumentVerificationResult {
  const errors: DocumentError[] = [];
  const warnings: string[] = [];
  const verifiedDocs: VerifiedDocument[] = [];

  // Step 1: Get required documents for this claim category
  const requirements = getDocumentRequirements(claim.claim_category);
  if (!requirements) {
    trace.fail(AGENT_NAME, 'load_requirements', `Unknown claim category: ${claim.claim_category}`);
    errors.push({
      error_type: 'MISSING_REQUIRED',
      message: `Unknown claim category: ${claim.claim_category}. Valid categories are: CONSULTATION, DIAGNOSTIC, PHARMACY, DENTAL, VISION, ALTERNATIVE_MEDICINE.`,
    });
    return { passed: false, verified_documents: verifiedDocs, errors, warnings };
  }

  trace.pass(AGENT_NAME, 'load_requirements', `Loaded document requirements for ${claim.claim_category}`, {
    required: requirements.required,
    optional: requirements.optional,
  });

  // Step 2: Classify each uploaded document
  for (const doc of claim.documents) {
    const detectedType = doc.actual_type || detectDocumentType(doc);
    const quality = doc.quality || 'GOOD';
    const patientName = doc.patient_name_on_doc || doc.content?.patient_name;

    verifiedDocs.push({
      file_id: doc.file_id,
      file_name: doc.file_name,
      detected_type: detectedType,
      quality: quality,
      patient_name: patientName,
      confidence: quality === 'GOOD' ? 0.95 : quality === 'FAIR' ? 0.75 : quality === 'POOR' ? 0.5 : 0.1,
    });

    // Check for unreadable documents
    if (quality === 'UNREADABLE') {
      trace.fail(AGENT_NAME, 'quality_check', `Document "${doc.file_name}" is unreadable`, {
        file_id: doc.file_id,
        quality,
      });
      errors.push({
        file_id: doc.file_id,
        file_name: doc.file_name,
        error_type: 'UNREADABLE',
        message: `The document "${doc.file_name}" could not be read. It appears to be blurry or low quality. Please re-upload a clearer photo or scan of your ${detectedType.toLowerCase().replace(/_/g, ' ')}.`,
      });
    } else {
      trace.pass(AGENT_NAME, 'quality_check', `Document "${doc.file_name}" is readable (quality: ${quality})`);
    }
  }

  // Step 3: Check if all required documents are present
  const uploadedTypes = verifiedDocs.map(d => d.detected_type);
  
  for (const requiredType of requirements.required) {
    const found = uploadedTypes.includes(requiredType as DocumentType);
    if (!found) {
      // Check if there's a similar-but-wrong document
      const uploadedTypeNames = uploadedTypes.map(t => t.toLowerCase().replace(/_/g, ' '));
      const requiredTypeName = requiredType.toLowerCase().replace(/_/g, ' ');
      
      trace.fail(AGENT_NAME, 'required_doc_check', `Missing required document: ${requiredType}`, {
        required: requiredType,
        uploaded: uploadedTypes,
      });

      // Find what was uploaded instead (for specific error message)
      const extraDocs = verifiedDocs.filter(d => 
        !requirements.required.includes(d.detected_type) || 
        uploadedTypes.filter(t => t === d.detected_type).length > 1
      );

      if (extraDocs.length > 0) {
        const extraDoc = extraDocs[0];
        errors.push({
          file_id: extraDoc.file_id,
          file_name: extraDoc.file_name,
          error_type: 'WRONG_TYPE',
          message: `You uploaded a ${extraDoc.detected_type.toLowerCase().replace(/_/g, ' ')} ("${extraDoc.file_name}"), but a ${requiredTypeName} is required for ${claim.claim_category.toLowerCase()} claims. Please upload your ${requiredTypeName} instead.`,
          expected_type: requiredType as DocumentType,
          actual_type: extraDoc.detected_type,
        });
      } else {
        errors.push({
          error_type: 'MISSING_REQUIRED',
          message: `A ${requiredTypeName} is required for ${claim.claim_category.toLowerCase()} claims but was not uploaded. Please upload your ${requiredTypeName} to proceed.`,
          expected_type: requiredType as DocumentType,
        });
      }
    } else {
      trace.pass(AGENT_NAME, 'required_doc_check', `Required document found: ${requiredType}`);
    }
  }

  // Step 4: Cross-validate patient names across documents
  const patientNames = verifiedDocs
    .map(d => d.patient_name)
    .filter((name): name is string => !!name);

  if (patientNames.length >= 2) {
    const uniqueNames = [...new Set(patientNames.map(n => n.toLowerCase().trim()))];
    if (uniqueNames.length > 1) {
      trace.fail(AGENT_NAME, 'patient_name_check', 'Documents belong to different patients', {
        names_found: patientNames,
      });
      
      const nameDetails = verifiedDocs
        .filter(d => d.patient_name)
        .map(d => `"${d.file_name}" shows patient name "${d.patient_name}"`)
        .join(', ');

      errors.push({
        error_type: 'PATIENT_MISMATCH',
        message: `The uploaded documents appear to belong to different patients. ${nameDetails}. All documents must belong to the same patient. Please verify and re-upload the correct documents.`,
        details: {
          names_found: patientNames,
          documents: verifiedDocs.filter(d => d.patient_name).map(d => ({
            file_name: d.file_name,
            patient_name: d.patient_name,
          })),
        },
      });
    } else {
      trace.pass(AGENT_NAME, 'patient_name_check', `All documents belong to: ${patientNames[0]}`);
    }
  } else if (patientNames.length === 1) {
    trace.pass(AGENT_NAME, 'patient_name_check', `Patient name found: ${patientNames[0]}`);
  } else {
    trace.warn(AGENT_NAME, 'patient_name_check', 'Could not extract patient names from documents for cross-validation');
    warnings.push('Patient name could not be verified across documents');
  }

  const passed = errors.length === 0;
  if (passed) {
    trace.pass(AGENT_NAME, 'final_verdict', 'All document verifications passed');
  } else {
    trace.fail(AGENT_NAME, 'final_verdict', `Document verification failed with ${errors.length} error(s)`);
  }

  return { passed, verified_documents: verifiedDocs, errors, warnings };
}

function detectDocumentType(doc: { file_name: string; content?: { test_name?: string; line_items?: unknown[]; total?: number; medicines?: string[]; doctor_name?: string } }): DocumentType {
  const name = doc.file_name.toLowerCase();
  
  if (name.includes('prescription') || name.includes('rx')) return 'PRESCRIPTION';
  if (name.includes('bill') || name.includes('invoice')) {
    if (name.includes('pharmacy') || name.includes('medical_store')) return 'PHARMACY_BILL';
    return 'HOSPITAL_BILL';
  }
  if (name.includes('lab') || name.includes('report') || name.includes('diagnostic')) return 'LAB_REPORT';
  if (name.includes('discharge')) return 'DISCHARGE_SUMMARY';
  if (name.includes('dental')) return 'DENTAL_REPORT';

  // Fallback: check content
  if (doc.content) {
    if (doc.content.test_name) return 'LAB_REPORT';
    if (doc.content.line_items && doc.content.total) return 'HOSPITAL_BILL';
    if (doc.content.medicines || doc.content.doctor_name) return 'PRESCRIPTION';
  }

  return 'UNKNOWN';
}
