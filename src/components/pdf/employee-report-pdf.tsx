import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer"

export type EmployeeReportRow = {
  date: string
  clientName: string
  startTime: string
  endTime: string
  durationHours: number
  observation: string | null
}

type EmployeeReportPDFProps = {
  workerName: string
  monthLabel: string
  rows: EmployeeReportRow[]
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    textAlign: "center",
    marginBottom: 4,
  },
  meta: {
    fontSize: 10,
    textAlign: "center",
    color: "#555",
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    paddingVertical: 4,
    fontSize: 9,
    fontWeight: "bold",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ccc",
    paddingVertical: 4,
    fontSize: 9,
  },
  colDate: { width: "12%" },
  colClient: { width: "25%" },
  colTime: { width: "18%" },
  colDuration: { width: "12%" },
  colNote: { width: "33%" },
  footer: {
    marginTop: 24,
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "right",
  },
})

export function EmployeeReportPDF({
  workerName,
  monthLabel,
  rows,
}: EmployeeReportPDFProps) {
  const totalHours = rows.reduce(
    (sum, row) => sum + row.durationHours,
    0
  )

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Rapporto Mensile Dipendente</Text>
          <Text style={styles.subtitle}>Dipendente: {workerName}</Text>
          <Text style={styles.meta}>Mese/Anno: {monthLabel}</Text>
        </View>

        <View style={styles.tableHeader}>
          <Text style={styles.colDate}>Data</Text>
          <Text style={styles.colClient}>Cliente</Text>
          <Text style={styles.colTime}>Orario (Inizio - Fine)</Text>
          <Text style={styles.colDuration}>Durata (ore)</Text>
          <Text style={styles.colNote}>Note/Ubicazione</Text>
        </View>

        {rows.map((row, index) => (
          <View key={index} style={styles.tableRow}>
            <Text style={styles.colDate}>{row.date}</Text>
            <Text style={styles.colClient}>{row.clientName}</Text>
            <Text style={styles.colTime}>
              {row.startTime} - {row.endTime}
            </Text>
            <Text style={styles.colDuration}>{row.durationHours.toFixed(2)}</Text>
            <Text style={styles.colNote}>{row.observation || "-"}</Text>
          </View>
        ))}

        <Text style={styles.footer}>
          Totale Ore Lavorate nel Mese: {totalHours.toFixed(2)} ore
        </Text>
      </Page>
    </Document>
  )
}