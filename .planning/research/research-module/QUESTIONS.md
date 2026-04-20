# Open Decisions: Research Module

**Project:** PolicyDash Research Module
**Date:** 2026-04-19

These are questions that require explicit user input before a phase plan can be written.
Each question has a recommended default — accept the default or override it.

---

## Q1: Scope of "research item" — broad or India-blockchain-only?

**Context:** The current `/research` page is specific to the India Blockchain Policy
consultation. The platform is designed as a general-purpose tool for any policy domain.

**Question:** Should the research module support items per policy document (general), or
is it scoped to the current single policy?

**Why it matters:** Determines whether `documentId` is `NOT NULL` (every research item
must belong to a policy document) or can be NULL (platform-level research, not policy-specific).

**Recommendation:** Require `documentId NOT NULL`. This keeps the data model clean and
consistent with how `milestones` and `workshops` are scoped. Cross-document research
items can be duplicated or linked via external URL.

**Accept or override?**

---

## Q2: Who can create research items — only research_lead, or also policy_lead/admin?

**Context:** The `research_lead` role exists specifically for this. But `admin` and
`policy_lead` can do almost everything else. If only `research_lead` can create items,
admins need a second role to manage research — or need to be assigned `research_lead`.

**Question:** Should `admin` and `policy_lead` be able to create and manage research
items directly, or must they go through a user with `research_lead` role?

**Why it matters:** Affects the `research:create` and `research:manage_own` permission
grants and the workflow for solo-operator deployments where one person runs everything.

**Recommendation:** Grant `research:create` to `admin` + `policy_lead` + `research_lead`.
Restrict `research:submit_review` similarly. `research:publish` stays with `admin` +
`policy_lead` only. This matches how workshop management works (`workshop:manage` is
admin + workshop_moderator, not research_lead).

**Accept or override?**

---

## Q3: Is the moderation gate (pending_review → published) required, or can research_lead self-publish?

**Context:** The draft → pending_review → published three-step gate adds a review burden.
For a small team running a single consultation, the research_lead may be the same person
as the policy_lead.

**Question:** Must publication always require a second person's approval, or can an admin
bypass the review gate for trusted research_lead users?

**Why it matters:** If self-publish is allowed, the state machine simplifies to
`draft → published` with an optional review step. If not, the system must enforce
two-person rule.

**Recommendation:** Keep the gate as designed (research_lead cannot self-publish). This
is consistent with how workshop artifacts require `artifactReviewStatus: 'approved'`
before appearing in evidence packs, and how consultation summaries require moderator
approval before going public. The audit trail value outweighs the small friction cost.

**Accept or override?**

---

## Q4: Should research items be anchored on Cardano individually, or only via milestones?

**Context:** PolicyDash already anchors `documentVersions` individually (via
`versionAnchorFn`) AND includes them in milestone manifests. The same dual-anchor
pattern could apply to research items.

**Question:** Should a published research item trigger its own Cardano anchor transaction,
or should it only contribute to milestone anchoring when the milestone is ready?

**Why it matters:** Individual anchoring costs one Cardano tx per research item publication.
Milestone-only anchoring costs nothing extra but means the anchor proof is not available
until the milestone is completed (potentially months later).

**Options:**
- A. Individual anchor on publish (same as `documentVersions`)
- B. Milestone-only (same as `evidence_artifacts`)
- C. No anchoring at all (research items stay off-chain)

**Recommendation:** Option B for v0.2. Research items are evidence, not first-class
governance decisions. Milestone anchoring is sufficient to prove "this item was part of
the evidence set at milestone X." Individual anchoring can be added in v0.3 if the use
case justifies the cost.

**Accept or override?**

---

## Q5: How granular are section links — per-version or per-current-sections?

**Context:** `policy_sections` rows have stable UUIDs across versions (this is a core
design principle in PolicyDash). However, a research item uploaded in January might be
linked to a section that is significantly reworded by March. The link to the `sectionId`
remains valid, but the link to a specific *version* of that section is lost.

**Question:** Is section-level linking (FK to `policy_sections`) sufficient, or do you
need version-level section linking (FK to a specific `sectionsSnapshot` entry)?

**Why it matters:** Version-level linking requires querying the `sectionsSnapshot` JSONB
in `document_versions` and is significantly more complex. Section-level linking is clean
and consistent with `workshopSectionLinks` and `crSectionLinks`.

**Recommendation:** Section-level linking only for v0.2. If a research item informed a
specific version, the `research_item_version_links` table captures that — the combination
of (sectionId, versionId) through two join tables is sufficient for the traceability
narrative without storing denormalised section-version snapshots.

**Accept or override?**

---

## Q6: Should the public `/research/items` listing be filterable by policy document, or only one policy is shown?

**Context:** The platform currently has one active policy document (India Blockchain
Policy). The public `/research` page hardcodes this. The new listing could either assume
one policy context or be document-aware from the start.

**Question:** Should `/research/items` show items for all published policies, or
scoped to the currently active document?

**Why it matters:** Building a document-scoped filter facet now avoids a rewrite when a
second policy document is onboarded. But if there will only ever be one policy, the
extra facet adds UI complexity for no benefit.

**Recommendation:** Include a document filter facet even for one document. It costs
almost nothing in implementation and future-proofs the listing page. The existing
`/portal` listing already shows all published documents, establishing the precedent.

**Accept or override?**

---

## Q7: Anonymous authorship — should research items allow suppressed author names?

**Context:** PolicyDash has `isAnonymous` on `feedbackItems` to protect stakeholder
identity. A research item's `authors` field is a text array (not linked to the `users`
table). There is no identity exposure risk from author names on academic papers. But
for internal policy memos or interview transcripts, the research_lead may want to
publish without revealing the source organisation.

**Question:** Should research items have an `isAuthorAnonymous` flag that hides the
`authors` field on the public listing and detail page?

**Why it matters:** If yes, adds one boolean column and conditional rendering logic.
If no, all author information is public once the item is published.

**Recommendation:** Yes — add `isAuthorAnonymous boolean NOT NULL DEFAULT false`. This
is especially relevant for `interview_transcript` and `memo` types. The public page
shows "Source: Confidential" instead of the author names. Consistent with the
platform's privacy-first stance on stakeholder data.

**Accept or override?**

---

## Q8: Should authorship transfer be supported?

**Context:** If a research_lead who created a draft leaves the organisation, can
ownership of their draft items be transferred to another user?

**Question:** Should the system support transferring `createdBy` (and effectively
the management rights) on a research item to a different user?

**Why it matters:** Without transfer support, items owned by a departed user can only
be managed by an admin. With transfer support, the system needs an explicit transfer
mutation and audit log entry.

**Recommendation:** Defer transfer support. Admin can always manage any research item
regardless of `createdBy`. A transfer mutation can be added in v0.3 when the need
is demonstrated by real usage.

**Accept or override?**

---

## Q9: What is the minimum viable public listing — items only, or also with linked sections visible?

**Context:** A public visitor landing on `/research/items` could see either:
- (A) Simple card list: title, type, authors, date, download — no section context
- (B) Section-aware list: cards also show which policy sections this item informs

**Question:** Does the v0.2 public listing need to surface section links, or is that
a detail-page-only concern?

**Why it matters:** Section-aware listing requires joining `research_item_section_links`
and `policy_sections` on the listing query. It is more complex and slower but gives
public users direct navigation to related framework sections.

**Recommendation:** (A) for v0.2 public listing; section links visible on detail page
only. This matches how `/framework` shows section status without surfacing every
evidence source in the listing. Cross-linking can go from the detail page to the
framework section and vice versa.

**Accept or override?**

---

## Q10: DOI — stored as text or validated against an external DOI resolver?

**Context:** Research items can optionally carry a DOI (e.g. `10.1234/abc`). The DOI
could be stored as plain text (no validation), or the system could validate it against
`https://doi.org/{doi}` at submission time to confirm it resolves.

**Question:** Should DOI input be validated externally at submission time, or accepted
as plain text?

**Why it matters:** External validation adds a network call during the create/update
mutation and a new external dependency (doi.org). Plain text is simpler and sufficient
for display purposes — the public page renders it as a link anyway.

**Recommendation:** Store as plain text. Render as `https://doi.org/{doi}` on the
public detail page. Let the browser's link follow handle resolution. No external
validation call needed in the backend.

**Accept or override?**
