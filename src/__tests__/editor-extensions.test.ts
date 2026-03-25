import { describe, it, expect } from 'vitest'
import { Callout } from '@/src/lib/tiptap-extensions/callout-node'
import { SlashCommands, getSlashCommandItems } from '@/src/lib/tiptap-extensions/slash-command-extension'
import { LinkPreview } from '@/src/lib/tiptap-extensions/link-preview-node'
import { buildExtensions } from '@/src/lib/tiptap-extensions/build-extensions'

describe('buildExtensions', () => {
  it('returns an array with no duplicate extension names', () => {
    const extensions = buildExtensions()
    const names = extensions.map((ext) => ext.name)
    const unique = new Set(names)
    expect(unique.size).toBe(names.length)
  })

  it('includes all required extensions', () => {
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
      'codeBlockLowlight',
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

  it('returns more than 15 extensions', () => {
    const extensions = buildExtensions()
    expect(extensions.length).toBeGreaterThanOrEqual(15)
  })
})

describe('Callout node', () => {
  it('has name "callout"', () => {
    expect(Callout.name).toBe('callout')
  })

  it('has group "block" and content "block+"', () => {
    expect(Callout.config.group).toBe('block')
    expect(Callout.config.content).toBe('block+')
  })

  it('parseHTML recognizes div[data-type="callout"]', () => {
    const parseRules = Callout.config.parseHTML!()
    expect(parseRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tag: 'div[data-type="callout"]' }),
      ]),
    )
  })

  it('has type attribute with default "info"', () => {
    const attrs = Callout.config.addAttributes!()
    expect(attrs.type.default).toBe('info')
  })

  it('has emoji attribute with default lightbulb', () => {
    const attrs = Callout.config.addAttributes!()
    expect(attrs.emoji.default).toBe('\u{1F4A1}')
  })
})

describe('SlashCommands extension', () => {
  it('has name "slashCommands"', () => {
    expect(SlashCommands.name).toBe('slashCommands')
  })

  it('uses suggestion char "/"', () => {
    const options = SlashCommands.options
    expect(options.suggestion.char).toBe('/')
  })
})

describe('getSlashCommandItems', () => {
  it('returns all items when query is empty', () => {
    const items = getSlashCommandItems('')
    expect(items.length).toBeGreaterThanOrEqual(15)
  })

  it('filters items by title', () => {
    const items = getSlashCommandItems('heading')
    expect(items.length).toBeGreaterThanOrEqual(1)
    for (const item of items) {
      const matches =
        item.title.toLowerCase().includes('heading') ||
        item.searchTerms.some((t: string) => t.includes('heading'))
      expect(matches).toBe(true)
    }
  })

  it('filters items by search terms', () => {
    const items = getSlashCommandItems('divider')
    expect(items.length).toBeGreaterThanOrEqual(1)
  })
})

describe('LinkPreview node', () => {
  it('has name "linkPreview"', () => {
    expect(LinkPreview.name).toBe('linkPreview')
  })

  it('has group "block" and atom true', () => {
    expect(LinkPreview.config.group).toBe('block')
    expect(LinkPreview.config.atom).toBe(true)
  })

  it('parseHTML recognizes div[data-type="link-preview"]', () => {
    const parseRules = LinkPreview.config.parseHTML!()
    expect(parseRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tag: 'div[data-type="link-preview"]' }),
      ]),
    )
  })

  it('has url attribute with default null', () => {
    const attrs = LinkPreview.config.addAttributes!()
    expect(attrs.url.default).toBeNull()
  })
})
