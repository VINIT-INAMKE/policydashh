# Instance Structure

### 1. Public site

This should be 5 pages only.

**/india-blockchain-policy**

Hero, project purpose, why India, milestone status, stakeholder paths.

**/research**

Initial research report, key findings, policy gaps, download links. Your research already frames India as having meaningful tax, AML/CFT, and data-protection touchpoints, but still lacking a cohesive framework that distinguishes blockchain infrastructure from speculative crypto activity.

**/framework**

Current draft policy structure, scope, consultation status, section summaries. The draft already positions itself as consultative, non-binding, and focused on legality/classification, data security, taxation/compliance, and innovation enablement.

**/workshops**

Upcoming sessions, themes, registration CTA, who should attend.

**/participate**

Single intake form that routes users by type:

- regulator / government
- industry / startup
- legal / compliance
- academia / research
- civil society / public interest

### 2. Internal ops layer

This can be lightweight but must feel structured.

**/ops/dashboard**

Internal team-only page with:

- stakeholder tracker
- workshop tracker
- response counts
- artifact checklist

**/ops/feedback**

Pulled from Tally / Sheets / Airtable:

- raw responses
- section-wise tagging
- accepted / rejected / pending
- quote approval status

**/ops/revisions**

Revision matrix and version comparison. Our platform doc already specifies APIs and logic for linked feedback, section changes, public exports, and milestone pack generation.

**/ops/evidence**

Per-workshop artifact slots:

- registration export
- screenshot
- recording
- attendance
- summary
- Tally responses
- expert review
- final export zip

## Smooth stakeholder UX

The mistake would be to make everyone land on the same generic page.

Instead, homepage should immediately split people into 4 paths:

**I’m here to understand the policy**

→ research + framework

**I’m here to contribute expert feedback**

→ workshop registration + consultation form

**I’m here as an institution / regulator**

→ request briefing + roundtable invite

**I’m here to track progress transparently**

→ milestones + published outputs

That matches your actual project logic: consultation is central, and evidence must be visible and structured.

## Webflow / Framer-ready sitemap

```
/
└── /india-blockchain-policy
    ├── /research
    ├── /framework
    ├── /workshops
    ├── /participate
    ├── /about
    └── /ops
        ├── /dashboard
        ├── /stakeholders
        ├── /feedback
        ├── /revisions
        ├── /evidence
        └── /exports
```

## CMS collections

You only need 6 collections to start:

- Stakeholders
- Workshops
- Policy Sections
- Feedback Entries
- Revisions / Change Log
- Outputs / Evidence Artifacts

## Recommended page-by-page UX

### Homepage

Sections:

- project purpose
- why this matters for India
- milestone strip
- choose your path
- active consultation CTA
- latest outputs

### Research page

Sections:

- executive summary
- current Indian landscape
- key gap clusters
- downloadable report
- CTA: join consultation

### Framework page

Sections:

- what the framework covers
- section cards
- consultation status
- “what changed” log
- CTA: validate this draft

### Workshops page

Sections:

- upcoming workshops
- workshop themes
- who should attend
- what participants receive
- register CTA

### Participate page

Single form with role-based routing and optional calendar booking.

## Design direction

For this instance, keep it more **policy-grade** than startup-grade.

Use:

- white / off-white base
- dark blue / slate typography
- muted saffron or teal as accent
- simple charts and milestone bars
- document cards, not flashy product cards

This should look closer to a **research-policy portal** than a Web3 landing page.

## n8n / Make flow stack

Your current execution model is already ideal for automation.

### Flow 1: stakeholder intake

Form submit → classify by role and domain → store in Airtable/Supabase → send tailored email → add to workshop invite list.

### Flow 2: workshop registration

Registration → confirmation email → calendar invite → reminder 48h before → reminder 2h before → send Zoom link + Tally form.

### Flow 3: post-workshop evidence

Workshop marked complete → create evidence checklist row → request screenshot/recording upload → attach artifacts to workshop record.

### Flow 4: feedback normalization

Tally responses → map to section codes → tag by issue type (classification, taxation, data security, governance) → push into feedback table. Your docs already use structured section-wise capture and decision mapping.

### Flow 5: revision engine

When policy lead marks feedback accepted/rejected → generate revision row → update change log → attach driver feedback codes → surface “what changed”.

### Flow 6: expert review

Mark framework ready for expert review → send reviewer packet → collect written response → attach to milestone evidence.

### Flow 7: milestone export

Click “Build milestone pack” → generate zip/folder containing:

- stakeholder list
- workshop summaries
- screenshots
- recordings
- feedback matrix
- revision matrix
- latest draft PDFs

That mirrors the submission logic already defined in your docs.

## Recommended stack for speed

For a fast launch:

- **Frontend:** Framer if speed matters most, Webflow if CMS depth matters more
- **Database / lightweight CRM:** Airtable or Supabase
- **Automation:** n8n
- **Forms:** Tally
- **Scheduling:** Calendly
- **Meetings:** Zoom or Google Meet
- **Document source of truth:** Notion or Google Drive
- **Internal evidence hub:** Airtable + Drive, or your PolicyDash if ready

## What this becomes later

This quick instance is actually your first **Civilization Lab micro-instance**:

a bounded, domain-specific socio-technical system with clear roles, feedback loops, evidence, and governance traceability — very much in line with the MyOS framing of domain instances and cross-domain fabrics.

## Recommendation

Build this in two layers:

**Phase 1**

Public pages + intake + workshop registration + research/framework publishing.

**Phase 2**

Internal ops dashboard + revision matrix + evidence exports.