import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 9,
    fontFamily: 'Helvetica',
  },
  title: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#666',
    marginBottom: 16,
  },
  truncationBanner: {
    fontSize: 9,
    color: '#8a2c0d',
    backgroundColor: '#fef3ed',
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingVertical: 6,
    paddingHorizontal: 4,
    fontFamily: 'Helvetica-Bold',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0e0e0',
  },
  tableRowAlt: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fafafa',
  },
  // R13: add Org Type column; rebalance widths so the row still fits
  // landscape A4 without overflow.
  cellFeedbackId: { width: '9%' },
  cellTitle: { width: '16%' },
  cellStatus: { width: '9%' },
  cellOrgType: { width: '10%' },
  cellCrId: { width: '9%' },
  cellSection: { width: '13%' },
  cellVersion: { width: '8%' },
  cellRationale: { width: '26%' },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    fontSize: 8,
    color: '#999',
    textAlign: 'center',
  },
})

interface MatrixRow {
  feedbackReadableId: string | null
  feedbackTitle: string | null
  feedbackStatus: string | null
  crReadableId: string | null
  sectionTitle: string | null
  versionLabel: string | null
  feedbackDecisionRationale: string | null
  // R13: org type of the submitter (null when anonymity / identity rules
  // suppress identity, or when the user has not set their org type).
  submitterOrgType: string | null
}

interface TraceabilityPDFProps {
  rows: MatrixRow[]
  documentTitle: string
  // R16: tell the PDF to render a truncation banner when the caller
  // capped rows. Both flags default to safe values for older callers.
  truncated?: boolean
  rowLimit?: number
}

function truncate(text: string | null, maxLen: number): string {
  if (!text) return '--'
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen) + '...'
}

export default function TraceabilityPDF({
  rows,
  documentTitle,
  truncated = false,
  rowLimit,
}: TraceabilityPDFProps) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>Traceability Matrix</Text>
        <Text style={styles.subtitle}>{documentTitle}</Text>

        {truncated && rowLimit && (
          <Text style={styles.truncationBanner}>
            Export truncated to the first {rowLimit.toLocaleString()} rows. Narrow your filters or request a CSV export for the full data set.
          </Text>
        )}

        {/* R17: wrap the table in a <View wrap> so @react-pdf/renderer
            auto-paginates rows that overflow a single A4 landscape page.
            Without this, rows beyond ~40 were silently clipped and
            absent from the download. The outer View with `wrap` lets
            the renderer break between rows across multiple pages. */}
        <View wrap>
          {/* Table header - repeat on each page via `fixed`. */}
          <View style={styles.tableHeader} fixed>
            <Text style={styles.cellFeedbackId}>Feedback ID</Text>
            <Text style={styles.cellTitle}>Title</Text>
            <Text style={styles.cellStatus}>Status</Text>
            <Text style={styles.cellOrgType}>Org Type</Text>
            <Text style={styles.cellCrId}>CR ID</Text>
            <Text style={styles.cellSection}>Section</Text>
            <Text style={styles.cellVersion}>Version</Text>
            <Text style={styles.cellRationale}>Rationale</Text>
          </View>

          {/* Table rows. Each row uses `wrap={false}` so a single row
              never splits across a page boundary (rationale can be
              long). If the renderer needs to paginate mid-table it
              starts the next page with the fixed header above. */}
          {rows.map((row, i) => (
            <View
              key={`${row.feedbackReadableId}-${row.crReadableId}-${i}`}
              style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
              wrap={false}
            >
              <Text style={styles.cellFeedbackId}>{row.feedbackReadableId ?? '--'}</Text>
              <Text style={styles.cellTitle}>{truncate(row.feedbackTitle, 40)}</Text>
              <Text style={styles.cellStatus}>{row.feedbackStatus ?? '--'}</Text>
              <Text style={styles.cellOrgType}>{row.submitterOrgType ?? '--'}</Text>
              <Text style={styles.cellCrId}>{row.crReadableId ?? '--'}</Text>
              <Text style={styles.cellSection}>{truncate(row.sectionTitle, 30)}</Text>
              <Text style={styles.cellVersion}>{row.versionLabel ?? '--'}</Text>
              <Text style={styles.cellRationale}>{truncate(row.feedbackDecisionRationale, 100)}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer} fixed>
          Generated {new Date().toISOString().split('T')[0]} -- Civilization Lab Traceability Export
        </Text>
      </Page>
    </Document>
  )
}
