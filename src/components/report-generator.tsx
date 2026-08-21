"use client"

import { useEffect, useMemo, useState } from "react"
import { PDFDownloadLink } from "@react-pdf/renderer"
import { Building2, CalendarDays, Check, Download, User, X } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/types/database.types"

import { cn } from "@/lib/utils"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AutocompleteInput } from "@/components/ui/autocomplete-input"
import {
  EmployeeReportPDF,
  type EmployeeReportRow,
  type WorkerReportData,
} from "@/components/pdf/employee-report-pdf"
import {
  ClientReportPDF,
  type ClientReportRow,
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

export function ReportGenerator() {
  const supabase = useMemo(() => createClient(), [])

  const [clients, setClients] = useState<Client[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [freelancers, setFreelancers] = useState<Freelancer[]>([])

  // Employee report state
  const [employeeMonth, setEmployeeMonth] = useState(currentMonthLabel())
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<Set<string>>(new Set())
  const [workerDataMap, setWorkerDataMap] = useState<Map<string, EmployeeReportRow[]>>(new Map())
  const [employeeLoaded, setEmployeeLoaded] = useState(false)

  // Client report state
  const [clientMonth, setClientMonth] = useState(currentMonthLabel())
  const [selectedClientId, setSelectedClientId] = useState("")
  const [clientRows, setClientRows] = useState<ClientReportRow[]>([])
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

  function selectAll() {
    setSelectedWorkerIds(new Set(workers.map((w) => w.id)))
  }

  function deselectAll() {
    setSelectedWorkerIds(new Set())
  }

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
      const { start, end } = monthBounds(employeeMonth)

      // Fetch all participants for the selected workers first
      const empIds: string[] = []
      const frlIds: string[] = []

      for (const wid of selectedWorkerIds) {
        const [type, id] = wid.split(":")
        if (type === "emp") empIds.push(id)
        else frlIds.push(id)
      }

      // Fetch service_records for the month period
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

      // Group records by worker in JS
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
  }, [supabase, selectedWorkerIds, employeeMonth])

  // Load client report when client or month changes
  useEffect(() => {
    if (!selectedClientId) return

    let cancelled = false

    const run = async () => {
      const { start, end } = monthBounds(clientMonth)

      const { data, error } = await supabase
        .from("service_records")
        .select(
          "date, start_time, end_time, observation, service_participants(profile_id, freelancer_id, profiles(full_name), freelancers(name))"
        )
        .eq("client_id", selectedClientId)
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
        setClientRows([])
      } else {
        const rows = ((data ?? []) as Array<{
          date: string
          start_time: string
          end_time: string
          observation: string | null
          service_participants: Array<{
            profiles: { full_name: string | null } | null
            freelancers: { name: string } | null
          }>
        }>).map((r) => {
          const participants = r.service_participants.map((p) => {
            if (p.profiles?.full_name) return p.profiles.full_name
            if (p.freelancers?.name) return p.freelancers.name
            return "Sconosciuto"
          })
          const shiftHours = toDurationHours(r.start_time, r.end_time)
          return {
            date: formatDateDDMMYYYY(r.date),
            participants,
            startTime: formatTime(r.start_time),
            endTime: formatTime(r.end_time),
            durationHours: shiftHours * participants.length,
            observation: r.observation,
          }
        })
        setClientRows(rows)
      }
      setClientLoaded(true)
    }

    run()
    return () => {
      cancelled = true
    }
  }, [supabase, selectedClientId, clientMonth])

  const selectedClients = clients.find((c) => c.id === selectedClientId)
  const clientTotal = clientRows.reduce((sum, r) => sum + r.durationHours, 0)

  // Build worker data for PDF
  const workersData: WorkerReportData[] = useMemo(() => {
    return Array.from(selectedWorkerIds)
      .map((wid) => {
        const worker = workers.find((w) => w.id === wid)
        if (!worker) return null
        return {
          workerName: worker.name,
          workerType: worker.type,
          monthLabel: employeeMonth,
          rows: workerDataMap.get(wid) ?? [],
        }
      })
      .filter((d): d is WorkerReportData => d !== null)
  }, [selectedWorkerIds, workers, workerDataMap, employeeMonth])

  // Total hours across all selected workers
  const totalAllWorkers = useMemo(() => {
    let total = 0
    for (const rows of workerDataMap.values()) {
      total += rows.reduce((sum, r) => sum + r.durationHours, 0)
    }
    return total
  }, [workerDataMap])

  const selectedWorkersList = useMemo(
    () => workers.filter((w) => selectedWorkerIds.has(w.id)),
    [workers, selectedWorkerIds]
  )

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Generazione Report</h1>
        <p className="text-muted-foreground">
          Genera report mensili per dipendenti, collaboratori e clienti
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
                Seleziona mese e lavoratori per generare il report
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
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
              </div>

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
                    onClick={selectAll}
                    className="rounded-lg text-xs"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Seleziona Tutti
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={deselectAll}
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

          {selectedWorkerIds.size > 0 && employeeLoaded && (
            <Card className="shadow-md border-border/50 rounded-2xl overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Anteprima Report</CardTitle>
                <CardDescription>
                  {employeeMonth} — {selectedWorkerIds.size} lavoratore{(selectedWorkerIds.size > 1 ? " selezionati" : " selezionato")}
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
                        monthLabel={employeeMonth}
                      />
                    }
                    fileName={`report-mensile-cumulativo-${employeeMonth.replace(/\s+/g, "-").toLowerCase()}.pdf`}
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
                Seleziona mese e cliente per generare il report
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
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
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Cliente</Label>
                  <Select
                    items={clients.map((c) => ({
                      label: c.name,
                      value: c.id,
                    }))}
                    value={selectedClientId || null}
                    onValueChange={(value) => setSelectedClientId(value ?? "")}
                  >
                    <SelectTrigger className="w-full rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedClientId && clientLoaded && selectedClients && (
            <Card className="shadow-md border-border/50 rounded-2xl overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Anteprima Report</CardTitle>
                <CardDescription>
                  {selectedClients.name} — {clientMonth}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {clientRows.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                      <CalendarDays className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">
                      Nessun dato trovato per il periodo selezionato.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto rounded-xl border border-border/50">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableHead className="font-semibold">Data</TableHead>
                            <TableHead className="font-semibold">Partecipanti</TableHead>
                            <TableHead className="font-semibold">Orario / Durata</TableHead>
                            <TableHead className="font-semibold">Note</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {clientRows.map((row, i) => (
                            <TableRow key={i} className={i % 2 === 1 ? "bg-muted/20" : ""}>
                              <TableCell className="whitespace-nowrap">{row.date}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1.5">
                                  {row.participants.map((p, j) => (
                                    <Badge key={j} variant="secondary" className="rounded-lg text-xs font-normal">
                                      {p}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {row.startTime} - {row.endTime} (
                                <span className="font-medium">{row.durationHours.toFixed(2)} ore</span>)
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate">
                                {row.observation || (
                                  <span className="text-xs text-muted-foreground">
                                    —
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="flex flex-col gap-4 rounded-xl bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between border border-border/50">
                      <p className="text-sm font-semibold">
                        Totale Ore Servizio nel Mese:{" "}
                        <span className="text-primary">
                          {clientTotal.toFixed(2)} ore
                        </span>
                      </p>
                      <PDFDownloadLink
                        document={
                          <ClientReportPDF
                            clientName={selectedClients.name}
                            monthLabel={clientMonth}
                            rows={clientRows}
                          />
                        }
                        fileName={`report-cliente-${selectedClients.name.replace(/\s+/g, "-").toLowerCase()}-${clientMonth.replace(/\s+/g, "-").toLowerCase()}.pdf`}
                      >
                        {({ loading }) => (
                          <Button disabled={loading} className="rounded-xl shadow-sm">
                            <Download className="h-4 w-4" />
                            {loading ? "Generazione PDF..." : "Scarica PDF"}
                          </Button>
                        )}
                      </PDFDownloadLink>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}