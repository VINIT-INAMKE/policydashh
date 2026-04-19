-- G8: Document-version FK to change_requests should preserve the version
-- when its originating CR is (rarely) deleted. The original constraint
-- fk_dv_cr in 0003_change_requests.sql used ON DELETE NO ACTION which
-- blocks CR deletion even when the version is safe to keep; switch to
-- ON DELETE SET NULL so orphaned versions stay readable and auditable.

ALTER TABLE document_versions
  DROP CONSTRAINT IF EXISTS fk_dv_cr;

ALTER TABLE document_versions
  ADD CONSTRAINT fk_dv_cr FOREIGN KEY (cr_id)
    REFERENCES change_requests(id)
    ON DELETE SET NULL;
