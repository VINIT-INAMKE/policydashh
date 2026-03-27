import { renderTiptapToHtml } from '@/src/lib/tiptap-html-renderer'
import type { SectionSnapshot } from '@/src/server/services/version.service'

interface PublicPolicyContentProps {
  sections: SectionSnapshot[]
}

export function PublicPolicyContent({ sections }: PublicPolicyContentProps) {
  if (sections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <h2 className="text-lg font-semibold">No sections available</h2>
        <p className="text-sm text-muted-foreground">
          This policy version has no sections to display.
        </p>
      </div>
    )
  }

  return (
    <div>
      {sections.map((section, index) => (
        <div key={section.sectionId}>
          <section id={`section-${section.sectionId}`}>
            <h2 className="text-[20px] font-semibold leading-[1.2] mb-4">
              {section.title}
            </h2>
            <div
              className="text-[16px] font-normal leading-[1.8] prose prose-neutral prose-lg dark:prose-invert max-w-none text-justify"
              dangerouslySetInnerHTML={{
                __html: renderTiptapToHtml(section.content),
              }}
            />
          </section>
          {index < sections.length - 1 && (
            <hr className="border-border my-12" />
          )}
        </div>
      ))}
    </div>
  )
}
