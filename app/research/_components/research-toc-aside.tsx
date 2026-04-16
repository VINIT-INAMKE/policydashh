'use client'

import { useEffect, useState } from 'react'

const ITEMS = [
  { id: 'overview', label: 'Overview' },
  { id: 'key-themes', label: 'Key Themes' },
  { id: 'outputs', label: 'Outputs' },
  { id: 'join-consultation', label: 'Join Consultation' },
] as const

export function ResearchTocAside() {
  const [activeId, setActiveId] = useState<string>(ITEMS[0].id)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        }
      },
      { rootMargin: '-64px 0px -80% 0px', threshold: 0 },
    )

    for (const item of ITEMS) {
      const el = document.getElementById(item.id)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [])

  const handleClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <nav aria-label="Research sections" className="sticky top-6">
      <div className="border-r bg-muted/50 rounded-md p-4 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Contents
        </p>
        {ITEMS.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            onClick={(e) => handleClick(e, item.id)}
            className={
              activeId === item.id
                ? 'block rounded px-2 py-1 text-sm bg-background font-semibold text-foreground'
                : 'block rounded px-2 py-1 text-sm text-muted-foreground hover:text-foreground'
            }
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  )
}
