// ============================================================
// POLICY LOADER — Reads and provides access to policy_terms.json
// ============================================================
// Input:  None (reads from bundled JSON)
// Output: PolicyTerms object + lookup helpers
// Errors: Throws if policy file is malformed
// ============================================================

import policyData from '@/data/policy_terms.json';
import type { PolicyTerms, Member, OPDCategory, DocumentRequirement } from './types';

const policy = policyData as unknown as PolicyTerms;

export function getPolicy(): PolicyTerms {
  return policy;
}

export function getMember(memberId: string): Member | undefined {
  return policy.members.find(m => m.member_id === memberId);
}

export function getOPDCategory(category: string): OPDCategory | undefined {
  const key = category.toLowerCase().replace(/_/g, '_');
  // Map claim categories to OPD category keys
  const categoryMap: Record<string, string> = {
    'consultation': 'consultation',
    'diagnostic': 'diagnostic',
    'pharmacy': 'pharmacy',
    'dental': 'dental',
    'vision': 'vision',
    'alternative_medicine': 'alternative_medicine',
  };
  const mappedKey = categoryMap[key] || key;
  return policy.opd_categories[mappedKey];
}

export function getDocumentRequirements(category: string): DocumentRequirement | undefined {
  return policy.document_requirements[category];
}

export function isNetworkHospital(hospitalName: string): boolean {
  if (!hospitalName) return false;
  const normalizedInput = hospitalName.toLowerCase().trim();
  return policy.network_hospitals.some(h => 
    normalizedInput.includes(h.toLowerCase()) || h.toLowerCase().includes(normalizedInput)
  );
}

export function getWaitingPeriodDays(condition: string): number | undefined {
  const normalized = condition.toLowerCase();
  for (const [key, days] of Object.entries(policy.waiting_periods.specific_conditions)) {
    if (normalized.includes(key.toLowerCase()) || key.toLowerCase().includes(normalized)) {
      return days;
    }
  }
  return undefined;
}

export function isExcludedCondition(diagnosis: string, treatment?: string): string | null {
  const text = `${diagnosis || ''} ${treatment || ''}`.toLowerCase();
  
  for (const exclusion of policy.exclusions.conditions) {
    if (text.includes(exclusion.toLowerCase()) || 
        exclusion.toLowerCase().split(' ').every(word => text.includes(word))) {
      return exclusion;
    }
  }
  
  // Check specific keywords
  const exclusionKeywords: Record<string, string> = {
    'bariatric': 'Bariatric surgery',
    'obesity': 'Obesity and weight loss programs',
    'weight loss': 'Obesity and weight loss programs',
    'cosmetic': 'Cosmetic or aesthetic procedures',
    'infertility': 'Infertility and assisted reproduction',
    'ivf': 'Infertility and assisted reproduction',
    'self-inflicted': 'Self-inflicted injuries',
    'substance abuse': 'Substance abuse treatment',
    'diet plan': 'Obesity and weight loss programs',
    'diet program': 'Obesity and weight loss programs',
  };
  
  for (const [keyword, exclusion] of Object.entries(exclusionKeywords)) {
    if (text.includes(keyword)) {
      return exclusion;
    }
  }
  
  return null;
}
