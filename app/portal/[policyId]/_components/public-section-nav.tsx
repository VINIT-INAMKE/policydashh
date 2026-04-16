'use client'

import { useEffect, useRef, useState } from 'react'

interface PublicSectionNavProps {
  sections: Array<{ sectionId: string; title: string }>
  mobile?: boolean
}

export function PublicSectionNav({ sections, mobile }: PublicSectionNavProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    if (mobile) return // Skip observer for mobile select

    const headings = sections
      .map((s) => document.getElementById(`section-${s.sectionId}`))
      .filter(Boolean) as HTMLElement[]

    if (headings.length === 0) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        }
      },
      { rootMargin: '-64px 0px -80% 0px', threshold: 0 }
    )

    for (const heading of headings) {
      observerRef.current.observe(heading)
    }

    return () => {
      observerRef.current?.disconnect()
    }
  }, [sections, mobile])

  if (sections.length === 0) return null

  // Mobile: render a select element for "Jump to section"
  if (mobile) {
    return (
      <div className="lg:hidden">
        <select
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          onChange={(e) => {
            const el = document.getElementById(e.target.value)
            if (el) el.scrollIntoView({ behavior: 'smooth' })
          }}
          defaultValue=""
        >
          <option value="" disabled>Jump to section</option>
          {sections.map((s) => (
            <option key={s.sectionId} value={`section-${s.sectionId}`}>
              {s.title}
            </option>
          ))}
        </select>
      </div>
    )
  }

  // Desktop: sticky sidebar nav
  return (
    <nav aria-label="Policy sections" className="sticky top-6">
      <div className="border-r bg-muted/50 rounded-md p-4 space-y-1">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
          Contents
        </h2>
        {sections.map((s) => {
          const isActive = activeId === `section-${s.sectionId}`
          return (
            <a
              key={s.sectionId}
              href={`#section-${s.sectionId}`}
              onClick={(e) => {
                e.preventDefault()
                const el = document.getElementById(`section-${s.sectionId}`)
                if (el) el.scrollIntoView({ behavior: 'smooth' })
              }}
              className={`block text-sm px-3 py-2 rounded-md transition-colors ${
                isActive
                  ? 'bg-background font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {s.title}
            </a>
          )
        })}
      </div>
    </nav>
  )
}
