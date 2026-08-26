import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer"

export type ExtraCostRow = {
  date: string
  description: string
  amount: number
}

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
  extraCosts: ExtraCostRow[]
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
  extraCostHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    paddingVertical: 4,
    fontSize: 9,
    fontWeight: "bold",
    backgroundColor: "#fef3c7",
  },
  extraCostRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ccc",
    paddingVertical: 4,
    fontSize: 9,
  },
  extraCostColDate: { width: "20%" },
  extraCostColDesc: { width: "55%" },
  extraCostColAmount: { width: "25%", textAlign: "right" },
  extraCostSectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 8,
  },
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

function formatEuro(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value)
}

function ClientPage({ data }: { data: ClientReportData }) {
  const totalHours = data.rows.reduce(
    (sum, row) => sum + row.durationHours,
    0
  )
  const totalExtraCosts = data.extraCosts.reduce(
    (sum, cost) => sum + cost.amount,
    0
  )

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>Rapporto Mensile Cliente</Text>
        <Text style={styles.subtitle}>Cliente: {data.clientName}</Text>
        <Text style={styles.meta}>{data.periodLabel}</Text>
      </View>

      {data.rows.length === 0 && data.extraCosts.length === 0 ? (
        <Text style={styles.emptyState}>
          Nessuna registrazione trovata per il periodo selezionato.
        </Text>
      ) : (
        <>
          {data.rows.length > 0 && (
            <>
              <View style={styles.tableHeader}>
                <Text style={styles.colDate}>Data</Text>
                <Text style={styles.colParticipants}>Partecipanti</Text>
                <Text style={styles.colTime}>Orario / Durata</Text>
                <Text style={styles.colNote}>Note / Ubicazione</Text>
              </View>

              {data.rows.map((row, index) => (
                <View key={`row-${index}`} style={styles.tableRow}>
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

          {data.extraCosts.length > 0 && (
            <>
              <Text style={styles.extraCostSectionTitle}>
                Costi Extra / Materiali
              </Text>
              <View style={styles.extraCostHeader}>
                <Text style={styles.extraCostColDate}>Data</Text>
                <Text style={styles.extraCostColDesc}>Descrizione</Text>
                <Text style={styles.extraCostColAmount}>Importo (€)</Text>
              </View>

              {data.extraCosts.map((cost, index) => (
                <View key={`extra-${index}`} style={styles.extraCostRow}>
                  <Text style={styles.extraCostColDate}>{cost.date}</Text>
                  <Text style={styles.extraCostColDesc}>{cost.description}</Text>
                  <Text style={styles.extraCostColAmount}>
                    {formatEuro(cost.amount)}
                  </Text>
                </View>
              ))}

              <Text style={styles.footer}>
                Totale Costi Extra: {formatEuro(totalExtraCosts)}
              </Text>
            </>
          )}
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