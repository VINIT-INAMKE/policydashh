# Authoring Flows Review

---

## A1: Dropped/pasted image nodes are never uploaded — saved as empty `src: ""`
**File:** `app/policies/[id]/_components/block-editor.tsx:196-228`
**Severity:** HIGH
**Impact:** When a user drops or pastes an image file onto the editor, the `onDrop`/`onPaste` handler inserts an image node with `src: ''` and leaves it there. `ImageBlockView` starts in `idle` state (because `src` is falsy), which shows the "click to upload" UI — but the `File` object from the drop/paste event is **never passed** to `handleFiles`. The user sees an empty upload placeholder instead of their image. Content autosaves this empty node, so the blank image block is persisted to the DB.
**Suggested fix:** Pass the `File` to the NodeView (e.g. store it in node attrs or fire a custom event) so `ImageBlockView` can auto-start the upload immediately after insertion, rather than waiting for a second user click.

---

## A2: `debouncedSave.cancel()` never called on unmount — in-flight save can write to wrong section
**File:** `app/policies/[id]/_components/block-editor.tsx:264-272`
**Severity:** HIGH
**Impact:** The cleanup `useEffect` calls `markSectionFlushed(sectionId)` but does **not** call `debouncedSave.cancel()`. When the user switches sections quickly (before the 1 500 ms debounce fires), the pending save for the old section fires after the new section is mounted — writing the old section's content to `document.updateSectionContent` with the old `section.id`. Because the new editor (for the new section) has already incremented `isDirtyRef` for the new section, the autosave for the new section also fires, resulting in two concurrent mutations for different sections. No concurrency error is surfaced; the old section write silently overwrites whatever was there.
**Suggested fix:** Add `debouncedSave.cancel()` to the unmount cleanup effect alongside `markSectionFlushed`.

---

## A3: `reorderSections` mutation lacks the B4 published-version guard
**File:** `src/server/routers/document.ts:562-600`
**Severity:** HIGH
**Impact:** `createSection`, `renameSection`, `updateSectionContent`, and `deleteSection` all call `hasPublishedVersion()` and throw `FORBIDDEN` once any version is published. `reorderSections` does not. A policy_lead can still drag-and-drop to reorder sections on a policy that has a published version, silently mutating the canonical section order without going through a change request. This undermines the immutability guarantee of published versions and produces inconsistent snapshots.
**Suggested fix:** Add `if (await hasPublishedVersion(input.documentId)) throw FORBIDDEN` at the top of the `reorderSections` mutation body, consistent with sibling mutations.

---

## A4: `canManage` is hardcoded `true` on MilestoneDetailPage — any authenticated user can click "Mark ready"
**File:** `app/policies/[id]/milestones/[milestoneId]/page.tsx:64`
**Severity:** HIGH
**Impact:** `canManage` is passed as the literal `true` to `MilestoneDetailHeader` and `MilestoneDetailTabs` without any role check. A stakeholder or workshop_moderator visiting the milestone detail page sees and can click "Mark ready" and all attach/detach checkboxes. The router procedure (`milestone:manage`) will reject them server-side, but the UI shows no role-gated affordances and gives a confusing error toast on click. Contrast with `MilestonesPage` (list) which correctly derives `canManage` from `trpc.user.getMe`.
**Suggested fix:** Load `trpc.user.getMe` in `MilestoneDetailPage` and derive `canManage = role === 'admin' || role === 'policy_lead'` before passing to children.

---

## A5: `MilestoneEntityTab.onMutated` is a no-op `() => {}` — slot-status badge never re-evaluates after attach/detach
**File:** `app/policies/[id]/milestones/[milestoneId]/page.tsx:71`
**Severity:** HIGH
**Impact:** `MilestoneDetailTabs` passes `onMutated={() => {}}` (a no-op). `MilestoneEntityTab` calls `utils.milestone.getById.invalidate()` on settle, which correctly re-fetches the `getById` query including `slotStatus`. However the invalidation is keyed by `{ milestoneId }` inside the tab component, and `slotStatus` lives in `MilestoneDetailPage`'s `data` destructure from the same query — so the re-fetch **does** propagate. The actual bug is more subtle: `milestone-detail-header` uses `props.slotStatus` passed at render time. Because `MilestoneDetailPage` correctly re-renders on cache invalidation, the slot badge does update — but only if the invalidation fires. If `attachMutation` or `detachMutation` errors before `onSettled`, the invalidation still fires via `onSettled` (correct). This item is lower severity than listed — see A4 and A3 for blocking issues. Re-evaluating...

_(Downgraded after verification; slot status updates correctly via getById invalidation. Keeping as LOW below.)_

---

## A5: Section diff uses `JSON.stringify` of Tiptap JSON as input to `diffWords` — produces JSON-noise diffs
**File:** `src/server/services/version.service.ts:89-101`
**Severity:** MEDIUM
**Impact:** `computeSectionDiff` stringifies the raw Tiptap JSON object and calls `diffWords(contentA, contentB)`. The resulting diff contains JSON syntax characters (`{`, `"type"`, `"attrs"`, `}`, etc.) interspersed with actual text content. The `SectionDiffView` renders these `Change[]` tokens as-is in a `font-mono` block. Authors reading the diff see `{"type":"paragraph","content":[{"type":"text","text":"` instead of readable prose differences. A section with a minor wording change (one word added) produces a huge noisy diff of re-serialised JSON keys.
**Suggested fix:** Extract plain text from both snapshots (walk the Tiptap tree collecting `node.text` values) before calling `diffWords`, so the diff is over human-readable prose.

---

## A6: `PublicDraftToggle` switch shows stale state after mutation — no optimistic update or local state sync
**File:** `app/policies/[id]/_components/public-draft-toggle.tsx:31-37`
**Severity:** MEDIUM
**Impact:** On mutation success the component calls `utils.document.getById.invalidate({ id: documentId })`. The `Switch` is bound to the `isPublicDraft` prop coming from the parent query. Between the mutation firing and the invalidation completing, the switch snaps back to the old value for ~100–300 ms (until the refetch finishes), causing a visible flicker. On mutation error, the switch stays in the position the user clicked, even though the server rejected the change — there is no rollback to the pre-click value.
**Suggested fix:** Add optimistic local state: `const [localValue, setLocalValue] = useState(isPublicDraft)` and update it immediately on `handleChange`, rolling back in `onError`.

---

## A7: `REQUEST_CHANGES` rationale is silently discarded — not stored anywhere retrievable
**File:** `src/server/services/changeRequest.service.ts:125-127`
**Severity:** MEDIUM
**Impact:** The `transitionCR` function writes `closureRationale` only when `event.type === 'CLOSE'`. For `REQUEST_CHANGES`, the rationale is logged to `workflowTransitions.metadata` (line 149) but is **not** stored on the `changeRequests` row itself. `CRDecisionLog` renders `metadata.rationale` from `workflowTransitions`, so it does appear in the decision log — but the CR detail header's "Approval / merge / closure" metadata block (cr-detail.tsx:134) only shows `closureRationale`. An owner who receives a "Request Changes" notification has no prominent on-page display of the reviewer's rationale outside the decision log, which is below the fold and requires scrolling.
**Suggested fix:** Store the `REQUEST_CHANGES` rationale in a dedicated column (e.g. `requestChangesRationale`) or surface it prominently in `cr-detail.tsx` by scanning `listTransitions` for the most recent `REQUEST_CHANGES` transition and displaying its `metadata.rationale` near the top of the page.

---

## A8: `milestone.list` has no sort order — list is non-deterministic across Postgres restarts
**File:** `src/server/routers/milestone.ts:208-216`
**Severity:** MEDIUM
**Impact:** The `list` query issues `SELECT * FROM milestones WHERE documentId = ?` with no `ORDER BY`. Postgres does not guarantee row order without an explicit clause. On table vacuums or page rewrites the order changes silently. The milestones list UI renders whatever order the DB returns, so milestones can appear in random order between page loads — particularly confusing when a user creates several milestones in sequence and expects to see them newest-first or by name.
**Suggested fix:** Add `.orderBy(asc(milestones.createdAt))` (or `desc`) to the `list` query.

---

## A9: Version diff section selector compares live sections against snapshot section IDs — deleted sections break the diff
**File:** `app/policies/[id]/versions/_components/version-comparison-selector.tsx:36-44`
**Severity:** MEDIUM
**Impact:** `VersionComparisonSelector` fetches the live `document.getSections` query to populate the section dropdown. The `sectionId` is then passed to `SectionDiffView`, which filters `data.diff` (computed from historical `sectionsSnapshot`) by `d.sectionId === sectionId`. If a section was deleted after the versions being compared were created, it exists in both snapshots but not in the live sections list — so it never appears in the dropdown. Conversely, if a section was created after both versions were snapshotted, it appears in the dropdown but `allDiffs.find(d => d.sectionId === sectionId)` returns `undefined`, and the UI renders "Snapshot not available" — which is misleading.
**Suggested fix:** Derive the section list from the union of sectionIds in both snapshots (`data.diff`) rather than from the live sections query.

---

## A10: `"Save changes"` button exits edit mode without waiting for the debounced save to flush
**File:** `app/policies/[id]/_components/section-content-view.tsx:101-105`
**Severity:** MEDIUM
**Impact:** Clicking "Save changes" calls `setIsEditing(false)`, which unmounts `BlockEditor`. The `BlockEditor` unmount cleanup marks the section flushed and clears the timeout — but does **not** call `debouncedSave.flush()` before unmounting. If the user typed something and immediately clicked "Save changes" within the 1 500 ms debounce window, the in-progress debounce is cancelled at unmount without firing. The content appears to have been saved (the button disappears and the view reverts to read-only), but the last edit is silently lost. The `beforeunload` guard also won't help here because no page navigation occurs.
**Suggested fix:** Call `debouncedSave.flush()` (or expose a `flushAndExit` handler) before setting `isEditing(false)`.

---

## A11: CR error message on lifecycle action failures doesn't distinguish server rejection from network error
**File:** `app/policies/[id]/change-requests/_components/cr-lifecycle-actions.tsx:47-49`, `56-58`
**Severity:** MEDIUM
**Impact:** Both `submitForReviewMutation.onError` and `approveMutation.onError` show the same static string: `"Couldn't update the change request status. Your changes were not saved."` This message is shown whether the rejection was due to a self-approval attempt (FORBIDDEN), an invalid state transition (BAD_REQUEST from XState), or a network timeout. When a reviewer gets FORBIDDEN from the self-approval guard, they see a misleading "your changes were not saved" message rather than "you cannot approve your own CR". The same applies to the merge/close/requestChanges dialogs, all of which use static error strings that mask informative server errors.
**Suggested fix:** Pass `err.message` from `onError` to `toast.error` for lifecycle actions so server-provided messages (e.g., "Cannot approve your own change request CR-007") are surfaced.

---

## A12: `"Save changes"` button label implies a manual save but the editor autosaves — false affordance
**File:** `app/policies/[id]/_components/section-content-view.tsx:102-105`
**Severity:** MEDIUM
**Impact:** The button is labeled "Save changes" and shows a checkmark icon, strongly implying a manual save action. In reality, clicking it just calls `setIsEditing(false)` — it does not trigger any save. The actual saving is done by the debounce autosave. A user who clicks "Save changes" while the autosave is still pending gets no feedback that the save is still in progress (the button disappears), and the save state indicator in the editor header is also unmounted at that point. This is directly related to A10.
**Suggested fix:** Rename the button to "Done editing" or "Close editor", or wire it to flush + confirm before exiting.

---

## A13: `CRDetail` shows no error state — query failure renders a blank "Change request not found" message with no retry
**File:** `app/policies/[id]/change-requests/_components/cr-detail.tsx:69-81`
**Severity:** MEDIUM
**Impact:** When `crQuery.isLoading` is false and `!cr`, the component renders a plain `<p>Change request not found.</p>` regardless of whether the failure was a 404 (truly not found), a network error, or a permission error. There is no distinction between `crQuery.isError` and `!crQuery.data`. A transient network error on load shows "not found" to the user with no retry button, no indication that a reload may fix it, and no way to recover other than manually refreshing.
**Suggested fix:** Check `crQuery.isError` separately and render a retry button (`crQuery.refetch()`) with an appropriate error message for non-404 errors.

---

## A14: `MilestoneDetailPage` calls `notFound()` on any tRPC error — transient errors get 404'd
**File:** `app/policies/[id]/milestones/[milestoneId]/page.tsx:34-36`
**Severity:** MEDIUM
**Impact:** `if (error || !data) { return notFound() }` — any tRPC query failure (network timeout, INTERNAL_SERVER_ERROR from Inngest, temporary DB connectivity) causes the page to render the Next.js 404 page. The user has no way to know whether the milestone actually doesn't exist or whether a transient error occurred. There is no retry mechanism and no informative error message.
**Suggested fix:** Distinguish `error.data?.code === 'NOT_FOUND'` from other errors; render a retryable error state for non-404 failures instead of delegating to `notFound()`.

---

## A15: `SectionDiffView` error state shows no retry button
**File:** `app/policies/[id]/versions/_components/section-diff-view.tsx:52-57`
**Severity:** LOW
**Impact:** When `diffQuery.error` is truthy the view renders `"Couldn't load the diff. Try selecting the sections again."` — which is misleading because re-selecting sections will call the same query with the same arguments (the diff is keyed by versionAId + versionBId, not by section). There is no "Retry" button linked to `diffQuery.refetch()`. Users with a transient network error have to navigate away and return.
**Suggested fix:** Add a `<Button onClick={() => diffQuery.refetch()}>Retry</Button>` to the error state.

---

## A16: Block editor toolbar "Insert image" button inserts empty `src: ""` node — same dead-node problem as drag/paste
**File:** `app/policies/[id]/_components/editor-toolbar.tsx:257-262`
**Severity:** LOW
**Impact:** The toolbar's "Insert image" handler calls `editor?.chain().focus().setImage({ src: '' }).run()`. This inserts an image node with `src: ''`. `ImageBlockView` initializes to `idle` state (correct) and shows the upload placeholder — the user must manually pick a file. This is an intentional UX flow. However, if the user immediately navigates away or clicks "Save changes" before uploading, a blank image node with `src: ''` is autosaved to the DB. On re-render `ReadOnlyEditor` passes it to the HTML renderer which outputs `<img src="#" alt="">` (sanitizeHref maps `''` to `'#'`). This is benign but creates a ghost image element in published PDFs/exports.
**Suggested fix:** Don't autosave until `src` is populated; or filter out image nodes with `src: ''` in the `getJSON()` call before passing to `updateSectionContent`.

---

## A17: `computeSectionDiff` uses `Set` iteration over a `Map` — section ordering in diff is non-deterministic
**File:** `src/server/services/version.service.ts:61-65`
**Severity:** LOW
**Impact:** `const allIds = new Set([...mapA.keys(), ...mapB.keys()])` collects section IDs and iterates them in insertion order (deterministic per Map spec). However, when the snapshot arrays have different orderings of the same section IDs, the diff result array order reflects `mapA` insertion order first, then extra `mapB` IDs — which may differ from the user-visible section order (determined by `orderIndex`). The `SectionDiffView` displays whatever order the diff returns when no sectionId is selected (falls back to `allDiffs[0]`). Users viewing a "whole document" diff might not see the first section first.
**Suggested fix:** Sort the diff results by `orderIndex` from either snapshot before returning.

---

## A18: `getNextVersionLabel` always produces `v0.N` — version schema has no path to `v1.0`
**File:** `src/server/services/version.service.ts:138-145`
**Severity:** LOW
**Impact:** The version label regex only matches `v0.N` and increments the minor component. After a major policy milestone (marking a policy as officially approved, for example), there is no way to create `v1.0` — the next version will always be `v0.(N+1)`. If a manually-supplied label like `v1.0` is ever inserted (e.g., via direct DB writes or future admin tooling), the `match` fails and the next autogenerated label silently falls back to `v0.1`, creating a duplicate if `v0.1` already exists (and triggering the retry loop in `createManualVersion`).
**Suggested fix:** Expand the regex to handle `vMAJOR.MINOR` and increment minor, or document that major-version bumping is out of scope.

---

## A19: `createManualVersion` retry loop swallows non-duplicate-key Postgres errors
**File:** `src/server/services/version.service.ts:289-294`
**Severity:** LOW
**Impact:** The catch block checks `pgError.code === '23505'` and re-tries up to `maxRetries`. Any other Postgres error (e.g., FK violation, constraint check failure, serialization error) on the first or second attempt is caught by the same `catch`, but since `attempt < maxRetries - 1` is true, the loop `continue`s and retries — re-issuing the same failing insert. Only on the final attempt does it `throw`. This masks the actual error for up to `maxRetries - 1` iterations and delays the surface of a real bug.
**Suggested fix:** Re-throw non-23505 errors immediately rather than retrying.

---

## A20: `addSection` / `removeSection` tRPC procs on CRs lack ownership check — any `cr:manage` user can add/remove sections from another user's CR in `drafting` state
**File:** `src/server/routers/changeRequest.ts:497-536`, `539-582`
**Severity:** LOW
**Impact:** `addSection` and `removeSection` verify that the CR is in `drafting` state, but do not check that `ctx.user.id === cr.ownerId`. Any user with `cr:manage` permission (admin or policy_lead) can add or remove sections from any CR that is still in drafting — not just their own. This is a low-severity data-integrity issue since the same roles can also close or approve the CR, but it differs from the intent ("only the owner can modify a draft CR").
**Suggested fix:** Add an ownership check consistent with the self-approval/self-merge guards in `approve` and `merge`.
