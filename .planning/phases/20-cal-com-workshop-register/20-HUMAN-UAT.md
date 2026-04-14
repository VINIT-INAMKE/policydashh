---
status: partial
phase: 20-cal-com-workshop-register
source: [20-VERIFICATION.md]
started: 2026-04-14T00:00:00Z
updated: 2026-04-14T00:00:00Z
---

## Current Test

[awaiting milestone v0.2 end-of-cycle smoke walk per user preference — deferred, not blocking]

## Tests

### 1. Real Cal.com booking via embed creates workshopRegistrations row
expected: BOOKING_CREATED webhook fires, registration row appears in DB, confirmation email arrives via Resend
result: pending

### 2. Real MEETING_ENDED webhook fires when a cal.com meeting ends
expected: Workshop transitions to completed, attendedAt populated on registration rows, feedback-invite emails delivered to attendees
result: pending

### 3. Post-workshop feedback deep-link round-trip end-to-end
expected: Clicking the emailed link opens /participate in feedback mode, form submits, feedbackItems and workshopFeedbackLinks rows created, success toast shown
result: pending

### 4. @calcom/embed-react renders correctly after npm install
expected: Cal embed iframe appears inside the modal, cal.com booking UI loads, user can complete a booking
result: pending

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
