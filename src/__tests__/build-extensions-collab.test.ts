import { describe, it, expect } from 'vitest'
import { buildExtensions } from '@/src/lib/tiptap-extensions/build-extensions'

describe('buildExtensions with collaboration', () => {
  it('includes Collaboration and CollaborationCaret when collaboration option provided', () => {
    // Create minimal mock objects
    const mockDoc = {} as any
    const mockProvider = {} as any
    const mockUser = { name: 'Test User', color: '#ff0000' }

    const extensions = buildExtensions({
      collaboration: {
        doc: mockDoc,
        provider: mockProvider,
        user: mockUser,
      },
    })

    const names = extensions.map((ext) => ext.name)
    expect(names).toContain('collaboration')
    expect(names).toContain('collaborationCaret')
  })

  it('does NOT include Collaboration extensions when collaboration option is absent', () => {
    const extensions = buildExtensions()
    const names = extensions.map((ext) => ext.name)
    expect(names).not.toContain('collaboration')
    expect(names).not.toContain('collaborationCaret')
  })

  it('always includes inlineComment mark (even without collaboration)', () => {
    const extensions = buildExtensions()
    const names = extensions.map((ext) => ext.name)
    expect(names).toContain('inlineComment')
  })

  it('backward compat: no duplicate extension names without collaboration', () => {
    const extensions = buildExtensions()
    const names = extensions.map((ext) => ext.name)
    const unique = new Set(names)
    expect(unique.size).toBe(names.length)
  })

  it('backward compat: includes all required extensions from before', () => {
    const extensions = buildExtensions()
    const names = extensions.map((ext) => ext.name)

    const required = [
      'starterKit',
      'image',
      'table',
      'tableRow',
      'tableCell',
      'tableHeader',
      'details',
      'detailsSummary',
      'detailsContent',
      'codeBlock',
      'nodeRange',
      'callout',
      'slashCommands',
      'linkPreview',
      'placeholder',
    ]

    for (const name of required) {
      expect(names).toContain(name)
    }
  })
})
