"use client"

import { useEffect, useMemo, useState } from "react"
import { PDFDownloadLink } from "@react-pdf/renderer"
import { Building2, Check, Download, User, X } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/types/database.types"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AutocompleteInput } from "@/components/ui/autocomplete-input"
import {
  EmployeeReportPDF,
  type EmployeeReportRow,
  type WorkerReportData,
} from "@/components/pdf/employee-report-pdf"
import {
  ClientReportPDF,
  type ClientReportRow,
  type ClientReportData,
} from "@/components/pdf/client-report-pdf"
import { toast } from "@/components/ui/toast"

type Client = Database["public"]["Tables"]["clients"]["Row"]
type Freelancer = Database["public"]["Tables"]["freelancers"]["Row"]
type Profile = Database["public"]["Tables"]["profiles"]["Row"]

type Worker = {
  id: string
  name: string
  type: "employee" | "freelancer"
}

type PeriodType = "mensile" | "giornaliero" | "personalizzato"

const MONTHS_IT = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
]

function currentMonthLabel(): string {
  const now = new Date()
  return `${MONTHS_IT[now.getMonth()]} ${now.getFullYear()}`
}

function currentDateISO(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

function parseMonthLabel(label: string): { month: number; year: number } {
  const parts = label.split(" ")
  const month = MONTHS_IT.indexOf(parts[0])
  const year = Number(parts[1])
  return { month, year }
}

function monthBounds(label: string): { start: string; end: string } {
  const { month, year } = parseMonthLabel(label)
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`
  const endDate = new Date(year, month + 1, 0)
  const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`
  return { start, end }
}

function toDurationHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number)
  const [eh, em] = endTime.split(":").map(Number)
  return (eh * 60 + em - (sh * 60 + sm)) / 60
}

function formatTime(time: string): string {
  return time.slice(0, 5)
}

function formatDateDDMMYYYY(isoDate: string): string {
  const [year, month, day] = isoDate.split("-")
  return `${day}/${month}/${year}`
}

function formatPeriodLabel(
  type: PeriodType,
  monthLabel: string,
  date: string,
  startDate: string,
  endDate: string
): string {
  switch (type) {
    case "mensile":
      return `Mese: ${monthLabel}`
    case "giornaliero":
      return `Data: ${formatDateDDMMYYYY(date)}`
    case "personalizzato":
      return `Periodo: ${formatDateDDMMYYYY(startDate)} - ${formatDateDDMMYYYY(endDate)}`
  }
}

function mergeObservations(observations: Array<string | null>): string {
  const unique = Array.from(
    new Set(
      observations
        .filter((o): o is string => !!o && o.trim() !== "" && o.trim() !== "-")
        .map((o) => o.trim())
    )
  )
  return unique.join(" / ")
}

function groupClientRecords(
  records: Array<{
    client_id: string
    date: string
    start_time: string
    end_time: string
    observation: string | null
    service_participants: Array<{
      profiles: { full_name: string | null } | null
      freelancers: { name: string } | null
    }>
  }>
): ClientReportRow[] {
  const groups = new Map<
    string,
    {
      date: string
      start_time: string
      end_time: string
      observations: Array<string | null>
      participants: string[]
    }
  >()

  for (const r of records) {
    const key = `${r.date}|${r.start_time}|${r.end_time}`
    const existing = groups.get(key)
    const participantNames = r.service_participants.map((p) => {
      if (p.profiles?.full_name) return p.profiles.full_name
      if (p.freelancers?.name) return p.freelancers.name
      return "Sconosciuto"
    })

    if (existing) {
      existing.observations.push(r.observation)
      for (const name of participantNames) {
        if (!existing.participants.includes(name)) {
          existing.participants.push(name)
        }
      }
    } else {
      groups.set(key, {
        date: r.date,
        start_time: r.start_time,
        end_time: r.end_time,
        observations: [r.observation],
        participants: participantNames,
      })
    }
  }

  return Array.from(groups.values()).map((g) => {
    const shiftHours = toDurationHours(g.start_time, g.end_time)
    return {
      date: formatDateDDMMYYYY(g.date),
      participants: g.participants,
      startTime: formatTime(g.start_time),
      endTime: formatTime(g.end_time),
      durationHours: shiftHours * g.participants.length,
      observation: mergeObservations(g.observations) || null,
    }
  })
}

function getPeriodBounds(
  type: PeriodType,
  monthLabel: string,
  singleDate: string,
  startDate: string,
  endDate: string
): { start: string; end: string } {
  switch (type) {
    case "mensile":
      return monthBounds(monthLabel)
    case "giornaliero":
      return { start: singleDate, end: singleDate }
    case "personalizzato":
      return { start: startDate, end: endDate }
  }
}

export function ReportGenerator() {
  const supabase = useMemo(() => createClient(), [])

  const [clients, setClients] = useState<Client[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [freelancers, setFreelancers] = useState<Freelancer[]>([])

  // Employee report state
  const [employeePeriodType, setEmployeePeriodType] = useState<PeriodType>("mensile")
  const [employeeMonth, setEmployeeMonth] = useState(currentMonthLabel())
  const [employeeDate, setEmployeeDate] = useState(currentDateISO())
  const [employeeStartDate, setEmployeeStartDate] = useState(currentDateISO())
  const [employeeEndDate, setEmployeeEndDate] = useState(currentDateISO())
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<Set<string>>(new Set())
  const [workerDataMap, setWorkerDataMap] = useState<Map<string, EmployeeReportRow[]>>(new Map())
  const [employeeLoaded, setEmployeeLoaded] = useState(false)

  // Client report state
  const [clientPeriodType, setClientPeriodType] = useState<PeriodType>("mensile")
  const [clientMonth, setClientMonth] = useState(currentMonthLabel())
  const [clientDate, setClientDate] = useState(currentDateISO())
  const [clientStartDate, setClientStartDate] = useState(currentDateISO())
  const [clientEndDate, setClientEndDate] = useState(currentDateISO())
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set())
  const [clientDataMap, setClientDataMap] = useState<Map<string, ClientReportRow[]>>(new Map())
  const [clientLoaded, setClientLoaded] = useState(false)

  const workers: Worker[] = useMemo(() => {
    const employeeWorkers = profiles
      .filter((p) => p.full_name)
      .map((p) => ({
        id: `emp:${p.id}`,
        name: p.full_name!,
        type: "employee" as const,
      }))
    const freelancerWorkers = freelancers.map((f) => ({
      id: `frl:${f.id}`,
      name: f.name,
      type: "freelancer" as const,
    }))
    return [...employeeWorkers, ...freelancerWorkers].sort((a, b) =>
      a.name.localeCompare(b.name)
    )
  }, [profiles, freelancers])

  const workerItems = useMemo(
    () =>
      workers.map((w) => ({
        label: w.type === "freelancer" ? `${w.name} (Collaboratore)` : w.name,
        value: w.id,
      })),
    [workers]
  )

  const clientItems = useMemo(
    () =>
      clients.map((c) => ({
        label: c.name,
        value: c.id,
      })),
    [clients]
  )

  useEffect(() => {
    const loadData = async () => {
      const [clientsRes, profilesRes, freelancersRes] = await Promise.all([
        supabase.from("clients").select("*").order("name"),
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("freelancers").select("*").order("name"),
      ])
      if (clientsRes.data) setClients(clientsRes.data)
      if (profilesRes.data) setProfiles(profilesRes.data)
      if (freelancersRes.data) setFreelancers(freelancersRes.data)
    }
    loadData()
  }, [supabase])

  function addWorker(id: string) {
    setSelectedWorkerIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }

  function removeWorker(id: string) {
    setSelectedWorkerIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  function selectAllWorkers() {
    setSelectedWorkerIds(new Set(workers.map((w) => w.id)))
  }

  function deselectAllWorkers() {
    setSelectedWorkerIds(new Set())
  }

  function addClient(id: string) {
    setSelectedClientIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }

  function removeClient(id: string) {
    setSelectedClientIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  function selectAllClients() {
    setSelectedClientIds(new Set(clients.map((c) => c.id)))
  }

  function deselectAllClients() {
    setSelectedClientIds(new Set())
  }

  const employeePeriodLabel = formatPeriodLabel(
    employeePeriodType,
    employeeMonth,
    employeeDate,
    employeeStartDate,
    employeeEndDate
  )

  const clientPeriodLabel = formatPeriodLabel(
    clientPeriodType,
    clientMonth,
    clientDate,
    clientStartDate,
    clientEndDate
  )

  const employeeDateInvalid =
    employeePeriodType === "personalizzato" &&
    employeeEndDate < employeeStartDate

  const clientDateInvalid =
    clientPeriodType === "personalizzato" &&
    clientEndDate < clientStartDate

  // Load employee data for all selected workers
  useEffect(() => {
    if (selectedWorkerIds.size === 0) {
      setWorkerDataMap(new Map())
      setEmployeeLoaded(true)
      return
    }

    let cancelled = false

    const run = async () => {
      setEmployeeLoaded(false)
      const { start, end } = getPeriodBounds(
        employeePeriodType,
        employeeMonth,
        employeeDate,
        employeeStartDate,
        employeeEndDate
      )

      const { data: records, error } = await supabase
        .from("service_records")
        .select(
          "*, clients(name), service_participants(profile_id, freelancer_id)"
        )
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true })

      if (cancelled) return

      if (error) {
        toast.add({
          title: "Errore",
          description: "Impossibile caricare i dati del report",
          type: "error",
        })
        setWorkerDataMap(new Map())
        setEmployeeLoaded(true)
        return
      }

      const map = new Map<string, EmployeeReportRow[]>()
      const allRecords = (records ?? []) as Array<{
        date: string
        start_time: string
        end_time: string
        observation: string | null
        clients: { name: string } | null
        service_participants: Array<{
          profile_id: string | null
          freelancer_id: string | null
        }>
      }>

      for (const wid of selectedWorkerIds) {
        const [type, id] = wid.split(":")
        const matchingRecords = allRecords.filter((r) =>
          r.service_participants.some((p) =>
            type === "emp"
              ? p.profile_id === id
              : p.freelancer_id === id
          )
        )
        const rows = matchingRecords.map((r) => ({
          date: formatDateDDMMYYYY(r.date),
          clientName: r.clients?.name ?? "-",
          startTime: formatTime(r.start_time),
          endTime: formatTime(r.end_time),
          durationHours: toDurationHours(r.start_time, r.end_time),
          observation: r.observation,
        }))
        map.set(wid, rows)
      }
      setWorkerDataMap(map)
      setEmployeeLoaded(true)
    }

    run()
    return () => {
      cancelled = true
    }
  }, [supabase, selectedWorkerIds, employeePeriodType, employeeMonth, employeeDate, employeeStartDate, employeeEndDate])

  // Load client data for all selected clients
  useEffect(() => {
    if (selectedClientIds.size === 0) {
      setClientDataMap(new Map())
      setClientLoaded(true)
      return
    }

    let cancelled = false

    const run = async () => {
      setClientLoaded(false)
      const { start, end } = getPeriodBounds(
        clientPeriodType,
        clientMonth,
        clientDate,
        clientStartDate,
        clientEndDate
      )

      const { data, error } = await supabase
        .from("service_records")
        .select(
          "client_id, date, start_time, end_time, observation, clients(name), service_participants(profile_id, freelancer_id, profiles(full_name), freelancers(name))"
        )
        .in("client_id", Array.from(selectedClientIds))
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true })

      if (cancelled) return

      if (error) {
        toast.add({
          title: "Errore",
          description: "Impossibile caricare i dati del report",
          type: "error",
        })
        setClientDataMap(new Map())
        setClientLoaded(true)
        return
      }

      const allRecords = (data ?? []) as Array<{
        client_id: string
        date: string
        start_time: string
        end_time: string
        observation: string | null
        clients: { name: string } | null
        service_participants: Array<{
          profiles: { full_name: string | null } | null
          freelancers: { name: string } | null
        }>
      }>

      const map = new Map<string, ClientReportRow[]>()
      for (const cid of selectedClientIds) {
        const matchingRecords = allRecords.filter((r) => r.client_id === cid)
        const rows = groupClientRecords(matchingRecords)
        map.set(cid, rows)
      }
      setClientDataMap(map)
      setClientLoaded(true)
    }

    run()
    return () => {
      cancelled = true
    }
  }, [supabase, selectedClientIds, clientPeriodType, clientMonth, clientDate, clientStartDate, clientEndDate])

  // Build worker data for PDF
  const workersData: WorkerReportData[] = useMemo(() => {
    return Array.from(selectedWorkerIds)
      .map((wid) => {
        const worker = workers.find((w) => w.id === wid)
        if (!worker) return null
        return {
          workerName: worker.name,
          workerType: worker.type,
          periodLabel: employeePeriodLabel,
          rows: workerDataMap.get(wid) ?? [],
        }
      })
      .filter((d): d is WorkerReportData => d !== null)
  }, [selectedWorkerIds, workers, workerDataMap, employeePeriodLabel])

  // Build client data for PDF
  const clientsData: ClientReportData[] = useMemo(() => {
    return Array.from(selectedClientIds)
      .map((cid) => {
        const client = clients.find((c) => c.id === cid)
        if (!client) return null
        return {
          clientName: client.name,
          periodLabel: clientPeriodLabel,
          rows: clientDataMap.get(cid) ?? [],
        }
      })
      .filter((d): d is ClientReportData => d !== null)
  }, [selectedClientIds, clients, clientDataMap, clientPeriodLabel])

  // Total hours across all selected workers
  const totalAllWorkers = useMemo(() => {
    let total = 0
    for (const rows of workerDataMap.values()) {
      total += rows.reduce((sum, r) => sum + r.durationHours, 0)
    }
    return total
  }, [workerDataMap])

  // Total hours across all selected clients
  const totalAllClients = useMemo(() => {
    let total = 0
    for (const rows of clientDataMap.values()) {
      total += rows.reduce((sum, r) => sum + r.durationHours, 0)
    }
    return total
  }, [clientDataMap])

  const selectedWorkersList = useMemo(
    () => workers.filter((w) => selectedWorkerIds.has(w.id)),
    [workers, selectedWorkerIds]
  )

  const selectedClientsList = useMemo(
    () => clients.filter((c) => selectedClientIds.has(c.id)),
    [clients, selectedClientIds]
  )

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Generazione Report</h1>
        <p className="text-muted-foreground">
          Genera report per dipendenti, collaboratori e clienti
        </p>
      </div>

      <Tabs defaultValue="employee">
        <TabsList className="w-full md:w-auto rounded-xl p-1 bg-muted/50">
          <TabsTrigger value="employee" className="flex-1 md:flex-none rounded-lg data-[state=active]:shadow-sm">
            <User className="h-4 w-4" />
            Report per Dipendente / Collaboratore
          </TabsTrigger>
          <TabsTrigger value="client" className="flex-1 md:flex-none rounded-lg data-[state=active]:shadow-sm">
            <Building2 className="h-4 w-4" />
            Report per Cliente
          </TabsTrigger>
        </TabsList>

        {/* Employee tab */}
        <TabsContent value="employee" className="space-y-4">
          <Card className="shadow-md border-border/50 rounded-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Filtri Report</CardTitle>
              <CardDescription>
                Seleziona tipo di periodo e lavoratori per generare il report
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tipo Periodo</Label>
                <div className="flex flex-wrap gap-2">
                  {(["mensile", "giornaliero", "personalizzato"] as PeriodType[]).map((type) => (
                    <Button
                      key={type}
                      type="button"
                      variant={employeePeriodType === type ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setEmployeePeriodType(type)}
                      className="rounded-lg"
                    >
                      {type === "mensile" ? "Mensile" : type === "giornaliero" ? "Giornaliero" : "Personalizzato"}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {employeePeriodType === "mensile" && (
                  <div className="space-y-2">
                    <Label htmlFor="employee-month" className="text-sm font-medium">Mese/Anno</Label>
                    <Input
                      id="employee-month"
                      type="month"
                      className="rounded-lg"
                      value={`${parseMonthLabel(employeeMonth).year}-${String(parseMonthLabel(employeeMonth).month + 1).padStart(2, "0")}`}
                      onChange={(e) => {
                        const [year, month] = e.target.value.split("-")
                        setEmployeeMonth(`${MONTHS_IT[Number(month) - 1]} ${year}`)
                      }}
                    />
                  </div>
                )}

                {employeePeriodType === "giornaliero" && (
                  <div className="space-y-2">
                    <Label htmlFor="employee-date" className="text-sm font-medium">Data</Label>
                    <Input
                      id="employee-date"
                      type="date"
                      className="rounded-lg"
                      value={employeeDate}
                      onChange={(e) => setEmployeeDate(e.target.value)}
                    />
                  </div>
                )}

                {employeePeriodType === "personalizzato" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="employee-start-date" className="text-sm font-medium">Data Inizio</Label>
                      <Input
                        id="employee-start-date"
                        type="date"
                        className="rounded-lg"
                        value={employeeStartDate}
                        onChange={(e) => setEmployeeStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="employee-end-date" className="text-sm font-medium">Data Fine</Label>
                      <Input
                        id="employee-end-date"
                        type="date"
                        className="rounded-lg"
                        value={employeeEndDate}
                        onChange={(e) => setEmployeeEndDate(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>

              {employeeDateInvalid && (
                <p className="text-sm text-destructive">
                  La data di fine deve essere maggiore o uguale alla data di inizio.
                </p>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Lavoratori</Label>
                  <span className="text-sm text-muted-foreground">
                    Selezionati: {selectedWorkerIds.size} / {workers.length}
                  </span>
                </div>

                <AutocompleteInput
                  items={workerItems}
                  placeholder="Cerca lavoratore per nome..."
                  emptyMessage="Nessun lavoratore trovato."
                  clearOnSelect
                  filterSelected={(item) => !selectedWorkerIds.has(item.value)}
                  onSelect={(item) => addWorker(item.value)}
                />

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={selectAllWorkers}
                    className="rounded-lg text-xs"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Seleziona Tutti
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={deselectAllWorkers}
                    className="rounded-lg text-xs"
                  >
                    Deseleziona Tutti
                  </Button>
                </div>

                {selectedWorkersList.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedWorkersList.map((w) => (
                      <Badge
                        key={w.id}
                        variant="secondary"
                        className="gap-1.5 pr-1.5 py-1 rounded-lg text-sm font-normal"
                      >
                        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10">
                          <User className="h-3 w-3 text-primary" />
                        </div>
                        {w.name}
                        <span className="text-[10px] text-muted-foreground ml-0.5">
                          {w.type === "freelancer" ? "Collaboratore" : "Dipendente"}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeWorker(w.id)}
                          className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive transition-colors"
                          aria-label={`Rimuovi ${w.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {selectedWorkerIds.size > 0 && employeeLoaded && !employeeDateInvalid && (
            <Card className="shadow-md border-border/50 rounded-2xl overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Anteprima Report</CardTitle>
                <CardDescription>
                  {employeePeriodLabel} — {selectedWorkerIds.size} lavoratore{(selectedWorkerIds.size > 1 ? " selezionati" : " selezionato")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {Array.from(selectedWorkerIds).map((wid) => {
                  const worker = workers.find((w) => w.id === wid)
                  if (!worker) return null
                  const rows = workerDataMap.get(wid) ?? []
                  const total = rows.reduce((s, r) => s + r.durationHours, 0)

                  return (
                    <div key={wid} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                          <User className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{worker.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {worker.type === "freelancer" ? "Collaboratore" : "Dipendente"}
                          </p>
                        </div>
                      </div>

                      {rows.length === 0 ? (
                        <p className="text-sm text-muted-foreground pl-9">
                          Nessuna registrazione trovata per il periodo selezionato.
                        </p>
                      ) : (
                        <>
                          <div className="overflow-x-auto rounded-lg border border-border/50 ml-9">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/30 hover:bg-muted/30">
                                  <TableHead className="font-semibold text-xs">Data</TableHead>
                                  <TableHead className="font-semibold text-xs">Cliente</TableHead>
                                  <TableHead className="font-semibold text-xs">Orario</TableHead>
                                  <TableHead className="font-semibold text-xs">Durata (ore)</TableHead>
                                  <TableHead className="font-semibold text-xs">Note</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {rows.map((row, i) => (
                                  <TableRow key={i} className={i % 2 === 1 ? "bg-muted/20" : ""}>
                                    <TableCell className="text-xs whitespace-nowrap">{row.date}</TableCell>
                                    <TableCell className="text-xs font-medium">{row.clientName}</TableCell>
                                    <TableCell className="text-xs whitespace-nowrap">
                                      {row.startTime} - {row.endTime}
                                    </TableCell>
                                    <TableCell className="text-xs font-medium">{row.durationHours.toFixed(2)}</TableCell>
                                    <TableCell className="text-xs max-w-[150px] truncate">
                                      {row.observation || <span className="text-muted-foreground">—</span>}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                          <p className="text-xs font-semibold text-right ml-9">
                            Totale: <span className="text-primary">{total.toFixed(2)} ore</span>
                          </p>
                        </>
                      )}
                    </div>
                  )
                })}

                <div className="flex flex-col gap-4 rounded-xl bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between border border-border/50">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">
                      Totale Generale:{" "}
                      <span className="text-primary">
                        {totalAllWorkers.toFixed(2)} ore
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {workersData.length} report generati
                    </p>
                  </div>
                  <PDFDownloadLink
                    document={
                      <EmployeeReportPDF
                        workersData={workersData}
                        periodLabel={employeePeriodLabel}
                      />
                    }
                    fileName={`report-${employeePeriodType}-cumulativo-${employeePeriodLabel.replace(/\s+/g, "-").toLowerCase()}.pdf`}
                  >
                    {({ loading }) => (
                      <Button disabled={loading} className="rounded-xl shadow-sm">
                        <Download className="h-4 w-4" />
                        {loading ? "Generazione PDF..." : "Scarica Tutti i Report (PDF)"}
                      </Button>
                    )}
                  </PDFDownloadLink>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Client tab */}
        <TabsContent value="client" className="space-y-4">
          <Card className="shadow-md border-border/50 rounded-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Filtri Report Cliente</CardTitle>
              <CardDescription>
                Seleziona tipo de periodo e clienti per generare il report
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tipo Periodo</Label>
                <div className="flex flex-wrap gap-2">
                  {(
                    ["mensile", "giornaliero", "personalizzato"] as PeriodType[]
                  ).map((type) => (
                    <Button
                      key={type}
                      type="button"
                      variant={clientPeriodType === type ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setClientPeriodType(type)}
                      className="rounded-lg"
                    >
                      {type === "mensile" ? "Mensile" : type === "giornaliero" ? "Giornaliero" : "Personalizzato"}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {clientPeriodType === "mensile" && (
                  <div className="space-y-2">
                    <Label htmlFor="client-month" className="text-sm font-medium">Mese/Anno</Label>
                    <Input
                      id="client-month"
                      type="month"
                      className="rounded-lg"
                      value={`${parseMonthLabel(clientMonth).year}-${String(parseMonthLabel(clientMonth).month + 1).padStart(2, "0")}`}
                      onChange={(e) => {
                        const [year, month] = e.target.value.split("-")
                        setClientMonth(`${MONTHS_IT[Number(month) - 1]} ${year}`)
                      }}
                    />
                  </div>
                )}

                {clientPeriodType === "giornaliero" && (
                  <div className="space-y-2">
                    <Label htmlFor="client-date" className="text-sm font-medium">Data</Label>
                    <Input
                      id="client-date"
                      type="date"
                      className="rounded-lg"
                      value={clientDate}
                      onChange={(e) => setClientDate(e.target.value)}
                    />
                  </div>
                )}

                {clientPeriodType === "personalizzato" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="client-start-date" className="text-sm font-medium">Data Inizio</Label>
                      <Input
                        id="client-start-date"
                        type="date"
                        className="rounded-lg"
                        value={clientStartDate}
                        onChange={(e) => setClientStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="client-end-date" className="text-sm font-medium">Data Fine</Label>
                      <Input
                        id="client-end-date"
                        type="date"
                        className="rounded-lg"
                        value={clientEndDate}
                        onChange={(e) => setClientEndDate(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>

              {clientDateInvalid && (
                <p className="text-sm text-destructive">
                  La data di fine deve essere maggiore o uguale alla data di inizio.
                </p>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Clienti</Label>
                  <span className="text-sm text-muted-foreground">
                    Selezionati: {selectedClientIds.size} / {clients.length}
                  </span>
                </div>

                <AutocompleteInput
                  items={clientItems}
                  placeholder="Cerca cliente per nome..."
                  emptyMessage="Nessun cliente trovato."
                  clearOnSelect
                  filterSelected={(item) => !selectedClientIds.has(item.value)}
                  onSelect={(item) => addClient(item.value)}
                />

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={selectAllClients}
                    className="rounded-lg text-xs"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Seleziona Tutti
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={deselectAllClients}
                    className="rounded-lg text-xs"
                  >
                    Deseleziona Tutti
                  </Button>
                </div>

                {selectedClientsList.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedClientsList.map((c) => (
                      <Badge
                        key={c.id}
                        variant="secondary"
                        className="gap-1.5 pr-1.5 py-1 rounded-lg text-sm font-normal"
                      >
                        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10">
                          <Building2 className="h-3 w-3 text-primary" />
                        </div>
                        {c.name}
                        <button
                          type="button"
                          onClick={() => removeClient(c.id)}
                          className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive transition-colors"
                          aria-label={`Rimuovi ${c.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {selectedClientIds.size > 0 && clientLoaded && !clientDateInvalid && (
            <Card className="shadow-md border-border/50 rounded-2xl overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Anteprima Report</CardTitle>
                <CardDescription>
                  {clientPeriodLabel} — {selectedClientIds.size} cliente{(selectedClientIds.size > 1 ? " selezionati" : " selezionato")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {Array.from(selectedClientIds).map((cid) => {
                  const client = clients.find((c) => c.id === cid)
                  if (!client) return null
                  const rows = clientDataMap.get(cid) ?? []
                  const total = rows.reduce((s, r) => s + r.durationHours, 0)

                  return (
                    <div key={cid} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                          <Building2 className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{client.name}</p>
                        </div>
                      </div>

                      {rows.length === 0 ? (
                        <p className="text-sm text-muted-foreground pl-9">
                          Nessuna registrazione trovata per il periodo selezionato.
                        </p>
                      ) : (
                        <>
                          <div className="overflow-x-auto rounded-xl border border-border/50 ml-9">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                  <TableHead className="font-semibold text-xs">Data</TableHead>
                                  <TableHead className="font-semibold text-xs">Partecipanti</TableHead>
                                  <TableHead className="font-semibold text-xs">Orario / Durata</TableHead>
                                  <TableHead className="font-semibold text-xs">Note</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {rows.map((row, i) => (
                                  <TableRow key={i} className={i % 2 === 1 ? "bg-muted/20" : ""}>
                                    <TableCell className="text-xs whitespace-nowrap">{row.date}</TableCell>
                                    <TableCell>
                                      <div className="flex flex-wrap gap-1.5">
                                        {row.participants.map((p, j) => (
                                          <Badge key={j} variant="secondary" className="rounded-lg text-[10px] font-normal">
                                            {p}
                                          </Badge>
                                        ))}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-xs whitespace-nowrap">
                                      {row.startTime} - {row.endTime} (
                                      <span className="font-medium">{row.durationHours.toFixed(2)} ore</span>)
                                    </TableCell>
                                    <TableCell className="text-xs max-w-[150px] truncate">
                                      {row.observation || <span className="text-muted-foreground">—</span>}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                          <p className="text-xs font-semibold text-right ml-9">
                            Totale: <span className="text-primary">{total.toFixed(2)} ore</span>
                          </p>
                        </>
                      )}
                    </div>
                  )
                })}

                <div className="flex flex-col gap-4 rounded-xl bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between border border-border/50">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">
                      Totale Generale:{" "}
                      <span className="text-primary">
                        {totalAllClients.toFixed(2)} ore
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {clientsData.length} report generati
                    </p>
                  </div>
                  <PDFDownloadLink
                    document={
                      <ClientReportPDF
                        clientsData={clientsData}
                        periodLabel={clientPeriodLabel}
                      />
                    }
                    fileName={`report-${clientPeriodType}-clienti-cumulativo-${clientPeriodLabel.replace(/\s+/g, "-").toLowerCase()}.pdf`}
                  >
                    {({ loading }) => (
                      <Button disabled={loading} className="rounded-xl shadow-sm">
                        <Download className="h-4 w-4" />
                        {loading ? "Generazione PDF..." : "Scarica Tutti i Report (PDF)"}
                      </Button>
                    )}
                  </PDFDownloadLink>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}