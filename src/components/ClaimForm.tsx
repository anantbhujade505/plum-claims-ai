'use client';

import { useState } from 'react';
import type { ClaimDecisionResult, ClaimCategory, ClaimSubmission } from '@/lib/types';

// Pre-built test case scenarios for quick testing
const TEST_SCENARIOS: { label: string; data: Partial<ClaimSubmission> }[] = [
  {
    label: 'TC001 — Wrong Document',
    data: {
      member_id: 'EMP001', policy_id: 'PLUM_GHI_2024', claim_category: 'CONSULTATION',
      treatment_date: '2024-11-01', claimed_amount: 1500,
      documents: [
        { file_id: 'F001', file_name: 'dr_sharma_prescription.jpg', actual_type: 'PRESCRIPTION' },
        { file_id: 'F002', file_name: 'another_prescription.jpg', actual_type: 'PRESCRIPTION' },
      ],
    },
  },
  {
    label: 'TC002 — Unreadable Doc',
    data: {
      member_id: 'EMP004', policy_id: 'PLUM_GHI_2024', claim_category: 'PHARMACY',
      treatment_date: '2024-10-25', claimed_amount: 800,
      documents: [
        { file_id: 'F003', file_name: 'prescription.jpg', actual_type: 'PRESCRIPTION', quality: 'GOOD' },
        { file_id: 'F004', file_name: 'blurry_bill.jpg', actual_type: 'PHARMACY_BILL', quality: 'UNREADABLE' },
      ],
    },
  },
  {
    label: 'TC003 — Patient Mismatch',
    data: {
      member_id: 'EMP001', policy_id: 'PLUM_GHI_2024', claim_category: 'CONSULTATION',
      treatment_date: '2024-11-01', claimed_amount: 1500,
      documents: [
        { file_id: 'F005', file_name: 'prescription_rajesh.jpg', actual_type: 'PRESCRIPTION', patient_name_on_doc: 'Rajesh Kumar' },
        { file_id: 'F006', file_name: 'bill_arjun.jpg', actual_type: 'HOSPITAL_BILL', patient_name_on_doc: 'Arjun Mehta' },
      ],
    },
  },
  {
    label: 'TC004 — Full Approval ✅',
    data: {
      member_id: 'EMP001', policy_id: 'PLUM_GHI_2024', claim_category: 'CONSULTATION',
      treatment_date: '2024-11-01', claimed_amount: 1500, ytd_claims_amount: 5000,
      documents: [
        { file_id: 'F007', actual_type: 'PRESCRIPTION', content: { doctor_name: 'Dr. Arun Sharma', doctor_registration: 'KA/45678/2015', patient_name: 'Rajesh Kumar', date: '2024-11-01', diagnosis: 'Viral Fever', medicines: ['Paracetamol 650mg', 'Vitamin C 500mg'] }, file_name: 'prescription.jpg' },
        { file_id: 'F008', actual_type: 'HOSPITAL_BILL', content: { hospital_name: 'City Clinic, Bengaluru', patient_name: 'Rajesh Kumar', date: '2024-11-01', line_items: [{ description: 'Consultation Fee', amount: 1000 }, { description: 'CBC Test', amount: 300 }, { description: 'Dengue NS1 Test', amount: 200 }], total: 1500 }, file_name: 'hospital_bill.jpg' },
      ],
    },
  },
  {
    label: 'TC005 — Waiting Period',
    data: {
      member_id: 'EMP005', policy_id: 'PLUM_GHI_2024', claim_category: 'CONSULTATION',
      treatment_date: '2024-10-15', claimed_amount: 3000,
      documents: [
        { file_id: 'F009', actual_type: 'PRESCRIPTION', content: { doctor_name: 'Dr. Sunil Mehta', doctor_registration: 'GJ/56789/2014', patient_name: 'Vikram Joshi', diagnosis: 'Type 2 Diabetes Mellitus', medicines: ['Metformin 500mg', 'Glimepiride 1mg'] }, file_name: 'rx.jpg' },
        { file_id: 'F010', actual_type: 'HOSPITAL_BILL', content: { patient_name: 'Vikram Joshi', date: '2024-10-15', total: 3000 }, file_name: 'bill.jpg' },
      ],
    },
  },
  {
    label: 'TC006 — Dental Partial',
    data: {
      member_id: 'EMP002', policy_id: 'PLUM_GHI_2024', claim_category: 'DENTAL',
      treatment_date: '2024-10-15', claimed_amount: 12000,
      documents: [
        { file_id: 'F011', actual_type: 'HOSPITAL_BILL', content: { hospital_name: 'Smile Dental Clinic', patient_name: 'Priya Singh', line_items: [{ description: 'Root Canal Treatment', amount: 8000 }, { description: 'Teeth Whitening', amount: 4000 }], total: 12000 }, file_name: 'dental_bill.jpg' },
      ],
    },
  },
  {
    label: 'TC007 — MRI No Pre-Auth',
    data: {
      member_id: 'EMP007', policy_id: 'PLUM_GHI_2024', claim_category: 'DIAGNOSTIC',
      treatment_date: '2024-11-02', claimed_amount: 15000,
      documents: [
        { file_id: 'F012', actual_type: 'PRESCRIPTION', content: { doctor_name: 'Dr. Venkat Rao', doctor_registration: 'AP/67890/2017', diagnosis: 'Suspected Lumbar Disc Herniation', tests_ordered: ['MRI Lumbar Spine'] }, file_name: 'rx.jpg' },
        { file_id: 'F013', actual_type: 'LAB_REPORT', content: { test_name: 'MRI Lumbar Spine' }, file_name: 'mri_report.pdf' },
        { file_id: 'F014', actual_type: 'HOSPITAL_BILL', content: { line_items: [{ description: 'MRI Lumbar Spine', amount: 15000 }], total: 15000 }, file_name: 'bill.jpg' },
      ],
    },
  },
  {
    label: 'TC008 — Per-Claim Exceeded',
    data: {
      member_id: 'EMP003', policy_id: 'PLUM_GHI_2024', claim_category: 'CONSULTATION',
      treatment_date: '2024-10-20', claimed_amount: 7500, ytd_claims_amount: 10000,
      documents: [
        { file_id: 'F015', actual_type: 'PRESCRIPTION', content: { doctor_name: 'Dr. R. Gupta', doctor_registration: 'DL/34567/2016', diagnosis: 'Gastroenteritis', medicines: ['Antibiotics', 'Probiotics', 'ORS'] }, file_name: 'rx.jpg' },
        { file_id: 'F016', actual_type: 'HOSPITAL_BILL', content: { line_items: [{ description: 'Consultation Fee', amount: 2000 }, { description: 'Medicines', amount: 5500 }], total: 7500 }, file_name: 'bill.jpg' },
      ],
    },
  },
  {
    label: 'TC009 — Fraud Signal',
    data: {
      member_id: 'EMP008', policy_id: 'PLUM_GHI_2024', claim_category: 'CONSULTATION',
      treatment_date: '2024-10-30', claimed_amount: 4800,
      claims_history: [
        { claim_id: 'CLM_0081', date: '2024-10-30', amount: 1200, provider: 'City Clinic A' },
        { claim_id: 'CLM_0082', date: '2024-10-30', amount: 1800, provider: 'City Clinic B' },
        { claim_id: 'CLM_0083', date: '2024-10-30', amount: 2100, provider: 'Wellness Center' },
      ],
      documents: [
        { file_id: 'F017', actual_type: 'PRESCRIPTION', content: { diagnosis: 'Migraine', doctor_name: 'Dr. S. Khan' }, file_name: 'rx.jpg' },
        { file_id: 'F018', actual_type: 'HOSPITAL_BILL', content: { total: 4800 }, file_name: 'bill.jpg' },
      ],
    },
  },
  {
    label: 'TC010 — Network Discount',
    data: {
      member_id: 'EMP010', policy_id: 'PLUM_GHI_2024', claim_category: 'CONSULTATION',
      treatment_date: '2024-11-03', claimed_amount: 4500, hospital_name: 'Apollo Hospitals', ytd_claims_amount: 8000,
      documents: [
        { file_id: 'F019', actual_type: 'PRESCRIPTION', content: { doctor_name: 'Dr. S. Iyer', doctor_registration: 'TN/56789/2013', patient_name: 'Deepak Shah', diagnosis: 'Acute Bronchitis', medicines: ['Amoxicillin 500mg', 'Salbutamol Inhaler'] }, file_name: 'rx.jpg' },
        { file_id: 'F020', actual_type: 'HOSPITAL_BILL', content: { hospital_name: 'Apollo Hospitals', patient_name: 'Deepak Shah', line_items: [{ description: 'Consultation Fee', amount: 1500 }, { description: 'Medicines', amount: 3000 }], total: 4500 }, file_name: 'bill.jpg' },
      ],
    },
  },
  {
    label: 'TC011 — Component Failure',
    data: {
      member_id: 'EMP006', policy_id: 'PLUM_GHI_2024', claim_category: 'ALTERNATIVE_MEDICINE',
      treatment_date: '2024-10-28', claimed_amount: 4000, simulate_component_failure: true,
      documents: [
        { file_id: 'F021', actual_type: 'PRESCRIPTION', content: { doctor_name: 'Vaidya T. Krishnan', doctor_registration: 'AYUR/KL/2345/2019', diagnosis: 'Chronic Joint Pain', treatment: 'Panchakarma Therapy' }, file_name: 'rx.jpg' },
        { file_id: 'F022', actual_type: 'HOSPITAL_BILL', content: { hospital_name: 'Ayur Wellness Centre', total: 4000, line_items: [{ description: 'Panchakarma Therapy (5 sessions)', amount: 3000 }, { description: 'Consultation', amount: 1000 }] }, file_name: 'bill.jpg' },
      ],
    },
  },
  {
    label: 'TC012 — Excluded Treatment',
    data: {
      member_id: 'EMP009', policy_id: 'PLUM_GHI_2024', claim_category: 'CONSULTATION',
      treatment_date: '2024-10-18', claimed_amount: 8000,
      documents: [
        { file_id: 'F023', actual_type: 'PRESCRIPTION', content: { doctor_name: 'Dr. P. Banerjee', doctor_registration: 'WB/34567/2015', diagnosis: 'Morbid Obesity — BMI 37', treatment: 'Bariatric Consultation and Customised Diet Plan' }, file_name: 'rx.jpg' },
        { file_id: 'F024', actual_type: 'HOSPITAL_BILL', content: { line_items: [{ description: 'Bariatric Consultation', amount: 3000 }, { description: 'Personalised Diet and Nutrition Program', amount: 5000 }], total: 8000 }, file_name: 'bill.jpg' },
      ],
    },
  },
];

const CATEGORIES: ClaimCategory[] = ['CONSULTATION', 'DIAGNOSTIC', 'PHARMACY', 'DENTAL', 'VISION', 'ALTERNATIVE_MEDICINE'];

interface ClaimFormProps {
  onResult: (result: ClaimDecisionResult) => void;
}

export default function ClaimForm({ onResult }: ClaimFormProps) {
  const [loading, setLoading] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    member_id: '',
    policy_id: 'PLUM_GHI_2024',
    claim_category: 'CONSULTATION' as ClaimCategory,
    treatment_date: '',
    claimed_amount: 0,
    hospital_name: '',
  });

  const handleScenarioSelect = (index: number) => {
    setSelectedScenario(index);
    const scenario = TEST_SCENARIOS[index];
    setFormData({
      member_id: scenario.data.member_id || '',
      policy_id: scenario.data.policy_id || 'PLUM_GHI_2024',
      claim_category: scenario.data.claim_category || 'CONSULTATION',
      treatment_date: scenario.data.treatment_date || '',
      claimed_amount: scenario.data.claimed_amount || 0,
      hospital_name: scenario.data.hospital_name || '',
    });
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      let body: ClaimSubmission;

      if (selectedScenario !== null) {
        body = TEST_SCENARIOS[selectedScenario].data as ClaimSubmission;
      } else {
        body = {
          ...formData,
          documents: [],
        };
      }

      const res = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await res.json();
      onResult(result);
    } catch (err) {
      console.error('Submit error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-6">
      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
        📝 Submit Claim
      </h3>

      {/* Quick Test Scenarios */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
          Quick Test Scenarios
        </label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {TEST_SCENARIOS.map((scenario, i) => (
            <button
              key={i}
              onClick={() => handleScenarioSelect(i)}
              className={selectedScenario === i ? '' : ''}
              style={{
                padding: '8px 12px',
                fontSize: 12,
                borderRadius: 8,
                border: selectedScenario === i ? '1px solid var(--plum-500)' : '1px solid var(--border-subtle)',
                background: selectedScenario === i ? 'rgba(168,85,247,0.1)' : 'var(--bg-secondary)',
                color: selectedScenario === i ? 'var(--plum-400)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'left',
                fontWeight: selectedScenario === i ? 600 : 400,
              }}
            >
              {scenario.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '20px 0' }} />

      {/* Manual Form */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Member ID</label>
            <input
              className="input-field"
              placeholder="EMP001"
              value={formData.member_id}
              onChange={e => setFormData(d => ({ ...d, member_id: e.target.value }))}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Category</label>
            <select
              className="select-field"
              value={formData.claim_category}
              onChange={e => setFormData(d => ({ ...d, claim_category: e.target.value as ClaimCategory }))}
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Treatment Date</label>
            <input
              className="input-field"
              type="date"
              value={formData.treatment_date}
              onChange={e => setFormData(d => ({ ...d, treatment_date: e.target.value }))}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Amount (₹)</label>
            <input
              className="input-field"
              type="number"
              placeholder="1500"
              value={formData.claimed_amount || ''}
              onChange={e => setFormData(d => ({ ...d, claimed_amount: Number(e.target.value) }))}
            />
          </div>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Hospital Name (optional)</label>
          <input
            className="input-field"
            placeholder="Apollo Hospitals"
            value={formData.hospital_name}
            onChange={e => setFormData(d => ({ ...d, hospital_name: e.target.value }))}
          />
        </div>
      </div>

      <button
        className="btn-primary w-full mt-6"
        onClick={handleSubmit}
        disabled={loading}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
        {loading ? (
          <>
            <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            Processing Claim...
          </>
        ) : (
          '🚀 Process Claim'
        )}
      </button>
    </div>
  );
}
