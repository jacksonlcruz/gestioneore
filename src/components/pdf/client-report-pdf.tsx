import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer"

export type ClientReportRow = {
  date: string
  participants: string[]
  startTime: string
  endTime: string
  durationHours: number
  observation: string | null
}

export type ClientReportData = {
  clientName: string
  periodLabel: string
  rows: ClientReportRow[]
}

type ClientReportPDFProps = {
  clientsData: ClientReportData[]
  periodLabel: string
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
  colParticipants: { width: "30%" },
  colTime: { width: "22%" },
  colNote: { width: "36%" },
  footer: {
    marginTop: 24,
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "right",
  },
  emptyState: {
    marginTop: 40,
    fontSize: 12,
    textAlign: "center",
    color: "#888",
  },
})

function formatDuration(totalDecimal: number): string {
  let hours = Math.floor(totalDecimal)
  let minutes = Math.round((totalDecimal - hours) * 60)

  // Ajustar si los minutos llegan a 60
  if (minutes === 60) {
    hours += 1
    minutes = 0
  }

  const decimalFormatted = totalDecimal.toFixed(2).replace(".", ",")
  const clockFormatted = minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`

  return `${decimalFormatted} ore (${clockFormatted})`
}

function ClientPage({ data }: { data: ClientReportData }) {
  const totalHours = data.rows.reduce(
    (sum, row) => sum + row.durationHours,
    0
  )

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>Rapporto Mensile Cliente</Text>
        <Text style={styles.subtitle}>Cliente: {data.clientName}</Text>
        <Text style={styles.meta}>{data.periodLabel}</Text>
      </View>

      {data.rows.length === 0 ? (
        <Text style={styles.emptyState}>
          Nessuna registrazione trovata per il periodo selezionato.
        </Text>
      ) : (
        <>
          <View style={styles.tableHeader}>
            <Text style={styles.colDate}>Data</Text>
            <Text style={styles.colParticipants}>Partecipanti</Text>
            <Text style={styles.colTime}>Orario / Durata</Text>
            <Text style={styles.colNote}>Note / Ubicazione</Text>
          </View>

          {data.rows.map((row, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.colDate}>{row.date}</Text>
              <Text style={styles.colParticipants}>
                {row.participants.join(", ")}
              </Text>
              <Text style={styles.colTime}>
                {row.startTime} - {row.endTime} ({row.durationHours.toFixed(2)} ore)
              </Text>
              <Text style={styles.colNote}>{row.observation || "-"}</Text>
            </View>
          ))}

          <Text style={styles.footer}>
            Totale Ore Servizio nel Periodo: {formatDuration(totalHours)}
          </Text>
        </>
      )}
    </Page>
  )
}

export function ClientReportPDF({
  clientsData,
  periodLabel,
}: ClientReportPDFProps) {
  return (
    <Document>
      {clientsData.map((data, index) => (
        <ClientPage key={index} data={data} />
      ))}
    </Document>
  )
}