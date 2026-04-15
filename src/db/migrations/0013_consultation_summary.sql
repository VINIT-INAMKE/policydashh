-- Phase 21: consultation_summary JSONB on document_versions
-- LLM-05 — Per-version cached consultation summary JSONB; structure
-- defined in src/server/services/consultation-summary.service.ts
-- (ConsultationSummaryJson).

ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS consultation_summary JSONB;
