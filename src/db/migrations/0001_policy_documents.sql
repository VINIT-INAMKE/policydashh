-- Policy Documents table
CREATE TABLE "policy_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" text NOT NULL,
  "description" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Policy Sections table (child of policy_documents, cascades on delete)
CREATE TABLE "policy_sections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "document_id" uuid NOT NULL REFERENCES "policy_documents"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "order_index" integer NOT NULL,
  "content" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Indexes for efficient section queries
CREATE INDEX idx_policy_sections_document_id ON policy_sections(document_id);
CREATE INDEX idx_policy_sections_order ON policy_sections(document_id, order_index);
