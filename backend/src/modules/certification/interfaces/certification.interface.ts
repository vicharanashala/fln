import { Document } from 'mongoose';
import { EligibilityDecision } from '../services/eligibility.service';

/**
 * SRS R-7 — Certification record.
 *
 * One row per (studentId, classNumber, level). If a student moves between
 * classes (e.g. class 3 → class 4), a new row opens for the new class;
 * the old row stays immutable as an audit record of what they earned.
 *
 * `decisionSnapshot` stores the full EligibilityDecision verbatim, so the
 * audit trail answers "why was this cert granted/reviewed?" without joining
 * back to the EvaluationReport that produced it (which may itself have been
 * corrected later).
 *
 * `version` is monotonic per (studentId, classNumber) — every re-evaluation
 * that mutates the cert increments it, providing an audit chain.
 */
export type CertificationStatus = 'active' | 'review_needed' | 'revoked';

export interface ICertification {
  studentId: string;
  classNumber: number;          // 2, 3, 4
  level: number;                // 1-59 (typically 5 — see competencyRequirements.seed.json)
  decisionSnapshot: EligibilityDecision;
  status: CertificationStatus;
  version: number;              // monotonic; starts at 1
  issuedAt?: string;            // ISO; set when status first becomes 'active'
  certificateId?: string;       // public-facing ID, populated when issued
  reviewReason?: string;        // populated when status='review_needed'
  reviewedBy?: string;          // populated when admin resolves (deferred)
  reviewDate?: string;          // populated when admin resolves (deferred)
}

export interface ICertificationDocument extends ICertification, Document {
  // createdAt / updatedAt come from Document via Mongoose's `timestamps: true`
  // (typed as Date, serialised to ISO strings by the toJSON transform).
}