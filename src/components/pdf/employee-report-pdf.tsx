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

export type WorkerReportData = {
  workerName: string
  workerType: "employee" | "freelancer"
  periodLabel: string
  rows: EmployeeReportRow[]
}

type EmployeeReportPDFProps = {
  workersData: WorkerReportData[]
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

function WorkerPage({ data }: { data: WorkerReportData }) {
  const isFreelancer = data.workerType === "freelancer"
  const totalHours = data.rows.reduce(
    (sum, row) => sum + row.durationHours,
    0
  )

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {isFreelancer
            ? "Rapporto Mensile Collaboratore Occasionale"
            : "Rapporto Mensile Dipendente"}
        </Text>
        <Text style={styles.subtitle}>
          {isFreelancer
            ? `Collaboratore: ${data.workerName}`
            : `Dipendente: ${data.workerName}`}
        </Text>
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
            <Text style={styles.colClient}>Cliente</Text>
            <Text style={styles.colTime}>Orario / Durata</Text>
            <Text style={styles.colDuration}>Durata (ore)</Text>
            <Text style={styles.colNote}>Note / Ubicazione</Text>
          </View>

          {data.rows.map((row, index) => (
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
            Totale Ore Lavorate nel Periodo: {formatDuration(totalHours)}
          </Text>
        </>
      )}
    </Page>
  )
}

export function EmployeeReportPDF({
  workersData,
  periodLabel,
}: EmployeeReportPDFProps) {
  return (
    <Document>
      {workersData.map((data, index) => (
        <WorkerPage key={index} data={data} />
      ))}
    </Document>
  )
}