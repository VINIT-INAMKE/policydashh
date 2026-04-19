'use client'

// D14: shared pending-save tracker used by block-editor.tsx to report whether
// the autosave pipeline has in-flight work, and consumed by
// create-version-dialog.tsx so we never snapshot a stale document state.
//
// Uses a tiny pub/sub so React components can subscribe without pulling in
// Zustand/Jotai etc. Keys are section IDs so multiple editors can coexist.

type Listener = (pendingCount: number) => void

const pending = new Set<string>()
const listeners = new Set<Listener>()

function notify() {
  const count = pending.size
  for (const l of listeners) l(count)
}

export function markSectionPending(sectionId: string) {
  pending.add(sectionId)
  notify()
}

export function markSectionFlushed(sectionId: string) {
  pending.delete(sectionId)
  notify()
}

export function hasPendingSectionSaves(): boolean {
  return pending.size > 0
}

export function subscribePendingCount(listener: Listener): () => void {
  listeners.add(listener)
  listener(pending.size)
  return () => {
    listeners.delete(listener)
  }
}
