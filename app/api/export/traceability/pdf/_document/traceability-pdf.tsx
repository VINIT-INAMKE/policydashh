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
  cellFeedbackId: { width: '10%' },
  cellTitle: { width: '18%' },
  cellStatus: { width: '10%' },
  cellCrId: { width: '10%' },
  cellSection: { width: '14%' },
  cellVersion: { width: '8%' },
  cellRationale: { width: '30%' },
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
}

interface TraceabilityPDFProps {
  rows: MatrixRow[]
  documentTitle: string
}

function truncate(text: string | null, maxLen: number): string {
  if (!text) return '--'
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen) + '...'
}

export default function TraceabilityPDF({ rows, documentTitle }: TraceabilityPDFProps) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>Traceability Matrix</Text>
        <Text style={styles.subtitle}>{documentTitle}</Text>

        {/* Table header */}
        <View style={styles.tableHeader}>
          <Text style={styles.cellFeedbackId}>Feedback ID</Text>
          <Text style={styles.cellTitle}>Title</Text>
          <Text style={styles.cellStatus}>Status</Text>
          <Text style={styles.cellCrId}>CR ID</Text>
          <Text style={styles.cellSection}>Section</Text>
          <Text style={styles.cellVersion}>Version</Text>
          <Text style={styles.cellRationale}>Rationale</Text>
        </View>

        {/* Table rows */}
        {rows.map((row, i) => (
          <View
            key={`${row.feedbackReadableId}-${row.crReadableId}-${i}`}
            style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
          >
            <Text style={styles.cellFeedbackId}>{row.feedbackReadableId ?? '--'}</Text>
            <Text style={styles.cellTitle}>{truncate(row.feedbackTitle, 40)}</Text>
            <Text style={styles.cellStatus}>{row.feedbackStatus ?? '--'}</Text>
            <Text style={styles.cellCrId}>{row.crReadableId ?? '--'}</Text>
            <Text style={styles.cellSection}>{truncate(row.sectionTitle, 30)}</Text>
            <Text style={styles.cellVersion}>{row.versionLabel ?? '--'}</Text>
            <Text style={styles.cellRationale}>{truncate(row.feedbackDecisionRationale, 100)}</Text>
          </View>
        ))}

        <Text style={styles.footer}>
          Generated {new Date().toISOString().split('T')[0]} -- PolicyDash Traceability Export
        </Text>
      </Page>
    </Document>
  )
}
