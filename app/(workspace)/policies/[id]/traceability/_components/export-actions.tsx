'use client'

import { useState } from 'react'
import { Download, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export interface TraceabilityFilterState {
  orgTypes: string[]
  sectionId?: string
  decisionOutcomes: string[]
  versionFrom?: string
  versionTo?: string
}

interface ExportActionsProps {
  documentId: string
  filters: TraceabilityFilterState
}

function buildQueryParams(documentId: string, filters: TraceabilityFilterState): string {
  const params = new URLSearchParams()
  params.set('documentId', documentId)
  if (filters.sectionId) params.set('sectionId', filters.sectionId)
  if (filters.orgTypes.length > 0) params.set('orgType', filters.orgTypes[0])
  if (filters.decisionOutcomes.length > 0) params.set('decisionOutcome', filters.decisionOutcomes[0])
  if (filters.versionFrom) params.set('versionFromLabel', filters.versionFrom)
  if (filters.versionTo) params.set('versionToLabel', filters.versionTo)
  return params.toString()
}

async function downloadFile(url: string, filename: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Export failed')
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export function ExportActions({ documentId, filters }: ExportActionsProps) {
  const [csvLoading, setCsvLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)

  const handleExportCSV = async () => {
    setCsvLoading(true)
    try {
      const qs = buildQueryParams(documentId, filters)
      await downloadFile(`/api/export/traceability/csv?${qs}`, 'traceability.csv')
    } catch {
      toast.error('Export failed. Check your connection and try again.')
    } finally {
      setCsvLoading(false)
    }
  }

  const handleExportPDF = async () => {
    setPdfLoading(true)
    try {
      const qs = buildQueryParams(documentId, filters)
      await downloadFile(`/api/export/traceability/pdf?${qs}`, 'traceability.pdf')
    } catch {
      toast.error('Export failed. Check your connection and try again.')
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="default"
        size="sm"
        onClick={handleExportCSV}
        disabled={csvLoading}
        aria-label="Export traceability matrix as CSV"
      >
        {csvLoading ? (
          <Loader2 className="animate-spin" />
        ) : (
          <Download />
        )}
        {csvLoading ? 'Exporting\u2026' : 'Export CSV'}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportPDF}
        disabled={pdfLoading}
        aria-label="Export traceability matrix as PDF"
      >
        {pdfLoading ? (
          <Loader2 className="animate-spin" />
        ) : (
          <FileText />
        )}
        {pdfLoading ? 'Generating\u2026' : 'Export PDF'}
      </Button>
    </div>
  )
}
