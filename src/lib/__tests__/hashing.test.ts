import { describe, it, expect } from 'vitest'
import {
  canonicalize,
  sha256Hex,
  hashPolicyVersion,
  hashWorkshop,
  hashFeedbackItem,
  hashEvidenceArtifact,
  hashEvidenceBundle,
  hashMilestone,
  type PolicyVersionHashInput,
  type WorkshopHashInput,
  type FeedbackItemHashInput,
  type EvidenceArtifactHashInput,
  type MilestoneHashInput,
} from '@/src/lib/hashing'
import policyVersionFixture from './fixtures/hashing/policy-version.json'
import workshopFixture from './fixtures/hashing/workshop.json'
import feedbackItemFixture from './fixtures/hashing/feedback-item.json'
import evidenceArtifactFixture from './fixtures/hashing/evidence-artifact.json'
import evidenceBundleFixture from './fixtures/hashing/evidence-bundle.json'
import milestoneFixture from './fixtures/hashing/milestone.json'

const HEX_64 = /^[0-9a-f]{64}$/

describe('canonicalize wrapper (VERIFY-05)', () => {
  it('sorts object keys per RFC 8785 JCS', () => {
    expect(canonicalize({ b: 2, a: 1 })).toBe('{"a":1,"b":2}')
  })

  it('sorts nested object keys at every level', () => {
    expect(canonicalize({ outer: { z: 1, a: 2 }, first: 0 }))
      .toBe('{"first":0,"outer":{"a":2,"z":1}}')
  })

  it('preserves array order (JCS MUST preserve array order)', () => {
    expect(canonicalize([3, 1, 2])).toBe('[3,1,2]')
  })

  it('throws on circular references', () => {
    const a: Record<string, unknown> = {}
    a.self = a
    expect(() => canonicalize(a)).toThrow()
  })
})

describe('sha256Hex primitive (VERIFY-04)', () => {
  it('hashes empty string to known SHA256 value', () => {
    expect(sha256Hex(''))
      .toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })

  it('returns 64-char lowercase hex for any input', () => {
    expect(sha256Hex('policydash')).toMatch(HEX_64)
  })
})

describe('hashPolicyVersion (VERIFY-04, VERIFY-05)', () => {
  it('returns 64-char lowercase hex', () => {
    expect(hashPolicyVersion(policyVersionFixture.input as PolicyVersionHashInput)).toMatch(HEX_64)
  })

  it('is stable across key permutations', () => {
    const { input } = policyVersionFixture
    const permuted: PolicyVersionHashInput = {
      createdBy:        input.createdBy,
      publishedAt:      input.publishedAt,
      versionLabel:     input.versionLabel,
      sectionsSnapshot: input.sectionsSnapshot,
      changelog:        input.changelog,
      documentId:       input.documentId,
      id:               input.id,
    }
    expect(hashPolicyVersion(permuted))
      .toBe(hashPolicyVersion(input as PolicyVersionHashInput))
  })

  it('is stable with null publishedAt', () => {
    const input = { ...policyVersionFixture.input, publishedAt: null } as PolicyVersionHashInput
    expect(hashPolicyVersion(input)).toMatch(HEX_64)
  })

  it('matches golden fixture expectedHash', () => {
    expect(hashPolicyVersion(policyVersionFixture.input as PolicyVersionHashInput))
      .toBe(policyVersionFixture.expectedHash)
  })
})

describe('hashWorkshop (VERIFY-04, VERIFY-05)', () => {
  it('returns 64-char hex', () => {
    expect(hashWorkshop(workshopFixture.input as WorkshopHashInput)).toMatch(HEX_64)
  })

  it('is stable when linkedArtifactIds arrive shuffled then caller re-sorts', () => {
    const sortedInput = workshopFixture.input as WorkshopHashInput
    const shuffled = [...sortedInput.linkedArtifactIds].reverse()
    const reSorted = [...shuffled].sort()
    const shuffledInput: WorkshopHashInput = { ...sortedInput, linkedArtifactIds: reSorted }
    expect(hashWorkshop(shuffledInput)).toBe(hashWorkshop(sortedInput))
  })

  it('is stable when linkedFeedbackIds arrive shuffled then caller re-sorts', () => {
    const sortedInput = workshopFixture.input as WorkshopHashInput
    const shuffled = [...sortedInput.linkedFeedbackIds].reverse()
    const reSorted = [...shuffled].sort()
    expect(hashWorkshop({ ...sortedInput, linkedFeedbackIds: reSorted }))
      .toBe(hashWorkshop(sortedInput))
  })

  it('matches golden fixture expectedHash', () => {
    expect(hashWorkshop(workshopFixture.input as WorkshopHashInput))
      .toBe(workshopFixture.expectedHash)
  })
})

describe('hashFeedbackItem (VERIFY-04, VERIFY-05)', () => {
  it('returns 64-char hex', () => {
    expect(hashFeedbackItem(feedbackItemFixture.input as FeedbackItemHashInput)).toMatch(HEX_64)
  })

  it('is stable with all-nullable fields set to null', () => {
    const input: FeedbackItemHashInput = {
      ...(feedbackItemFixture.input as FeedbackItemHashInput),
      suggestedChange: null,
      decisionRationale: null,
      reviewedBy: null,
      reviewedAt: null,
      resolvedInVersionId: null,
    }
    expect(hashFeedbackItem(input)).toMatch(HEX_64)
  })

  it('matches golden fixture expectedHash', () => {
    expect(hashFeedbackItem(feedbackItemFixture.input as FeedbackItemHashInput))
      .toBe(feedbackItemFixture.expectedHash)
  })
})

describe('hashEvidenceArtifact (VERIFY-04, VERIFY-05)', () => {
  it('returns 64-char hex', () => {
    expect(hashEvidenceArtifact(evidenceArtifactFixture.input as EvidenceArtifactHashInput)).toMatch(HEX_64)
  })

  it('produces different hashes for type file vs type link', () => {
    const fileInput = { ...evidenceArtifactFixture.input, type: 'file' } as EvidenceArtifactHashInput
    const linkInput = { ...evidenceArtifactFixture.input, type: 'link' } as EvidenceArtifactHashInput
    expect(hashEvidenceArtifact(fileInput))
      .not.toBe(hashEvidenceArtifact(linkInput))
  })

  it('matches golden fixture expectedHash', () => {
    expect(hashEvidenceArtifact(evidenceArtifactFixture.input as EvidenceArtifactHashInput))
      .toBe(evidenceArtifactFixture.expectedHash)
  })
})

describe('hashEvidenceBundle (VERIFY-04, VERIFY-05)', () => {
  it('returns 64-char hex', () => {
    expect(hashEvidenceBundle(evidenceBundleFixture.input as EvidenceArtifactHashInput[])).toMatch(HEX_64)
  })

  it('is order-independent - shuffled array produces same hash', () => {
    const sorted = evidenceBundleFixture.input as EvidenceArtifactHashInput[]
    const shuffled = [...sorted].reverse()
    expect(hashEvidenceBundle(shuffled)).toBe(hashEvidenceBundle(sorted))
  })

  it('matches golden fixture expectedHash', () => {
    expect(hashEvidenceBundle(evidenceBundleFixture.input as EvidenceArtifactHashInput[]))
      .toBe(evidenceBundleFixture.expectedHash)
  })
})

describe('hashMilestone (VERIFY-04, VERIFY-05)', () => {
  it('returns 64-char hex', () => {
    expect(hashMilestone(milestoneFixture.input as MilestoneHashInput)).toMatch(HEX_64)
  })

  it('is stable across permuted manifest entry order (sorted by entityType,entityId)', () => {
    const sorted = milestoneFixture.input as MilestoneHashInput
    const permuted: MilestoneHashInput = {
      ...sorted,
      manifest: [...sorted.manifest].reverse(),
    }
    expect(hashMilestone(permuted)).toBe(hashMilestone(sorted))
  })

  it('matches golden fixture expectedHash', () => {
    expect(hashMilestone(milestoneFixture.input as MilestoneHashInput))
      .toBe(milestoneFixture.expectedHash)
  })
})

describe('D-01a position-independence (VERIFY-04)', () => {
  it('hashPolicyVersion standalone equals per-child hash inside milestone manifest', () => {
    const versionHash = hashPolicyVersion(policyVersionFixture.input as PolicyVersionHashInput)
    const manifestEntryForSameVersion = (milestoneFixture.input as MilestoneHashInput).manifest
      .find((e) => e.entityType === 'version' && e.entityId === policyVersionFixture.input.id)
    // Requires milestone.json fixture to reuse policy-version.json.input.id in its manifest
    expect(manifestEntryForSameVersion?.contentHash).toBe(versionHash)
  })
})
