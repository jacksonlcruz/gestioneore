"use client"

import { useEffect, useMemo, useState } from "react"
import { PDFDownloadLink } from "@react-pdf/renderer"
import { Building2, CalendarDays, Download, User } from "lucide-react"

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  EmployeeReportPDF,
  type EmployeeReportRow,
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
  // Calculate last day of month
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
  const [selectedWorkerId, setSelectedWorkerId] = useState("")
  const [employeeRows, setEmployeeRows] = useState<EmployeeReportRow[]>([])
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

  // Load employee report when worker or month changes
  useEffect(() => {
    if (!selectedWorkerId) return

    let cancelled = false

    const run = async () => {
      const { start, end } = monthBounds(employeeMonth)
      const [type, id] = selectedWorkerId.split(":")

      let query = supabase
        .from("service_records")
        .select(
          "*, clients(name), service_participants(profile_id, freelancer_id)"
        )
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true })

      if (type === "emp") {
        query = query.eq("service_participants.profile_id", id)
      } else {
        query = query.eq("service_participants.freelancer_id", id)
      }

      const { data, error } = await query

      if (cancelled) return

      if (error) {
        toast.add({
          title: "Errore",
          description: "Impossibile caricare i dati del report",
          type: "error",
        })
        setEmployeeRows([])
      } else {
        const rows = ((data ?? []) as Array<{
          date: string
          start_time: string
          end_time: string
          observation: string | null
          clients: { name: string } | null
        }>).map((r) => ({
          date: formatDateDDMMYYYY(r.date),
          clientName: r.clients?.name ?? "-",
          startTime: formatTime(r.start_time),
          endTime: formatTime(r.end_time),
          durationHours: toDurationHours(r.start_time, r.end_time),
          observation: r.observation,
        }))
        setEmployeeRows(rows)
      }
      setEmployeeLoaded(true)
    }

    run()
    return () => {
      cancelled = true
    }
  }, [supabase, selectedWorkerId, employeeMonth])

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

  const selectedWorker = workers.find((w) => w.id === selectedWorkerId)
  const selectedClient = clients.find((c) => c.id === selectedClientId)

  const employeeTotal = employeeRows.reduce((sum, r) => sum + r.durationHours, 0)
  const clientTotal = clientRows.reduce((sum, r) => sum + r.durationHours, 0)

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
              <CardTitle className="text-base">Filtri Report Dipendente</CardTitle>
              <CardDescription>
                Seleziona mese e lavoratore per generare il report
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Lavoratore</Label>
                  <Select
                    items={workers.map((w) => ({
                      label: w.name,
                      value: w.id,
                    }))}
                    value={selectedWorkerId || null}
                    onValueChange={(value) => setSelectedWorkerId(value ?? "")}
                  >
                    <SelectTrigger className="w-full rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {workers.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedWorkerId && employeeLoaded && selectedWorker && (
            <Card className="shadow-md border-border/50 rounded-2xl overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Anteprima Report</CardTitle>
                <CardDescription>
                  {selectedWorker.name} — {employeeMonth}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {employeeRows.length === 0 ? (
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
                            <TableHead className="font-semibold">Cliente</TableHead>
                            <TableHead className="font-semibold">Orario</TableHead>
                            <TableHead className="font-semibold">Durata (ore)</TableHead>
                            <TableHead className="font-semibold">Note</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {employeeRows.map((row, i) => (
                            <TableRow key={i} className={i % 2 === 1 ? "bg-muted/20" : ""}>
                              <TableCell className="whitespace-nowrap">{row.date}</TableCell>
                              <TableCell className="font-medium">{row.clientName}</TableCell>
                              <TableCell className="whitespace-nowrap">
                                {row.startTime} - {row.endTime}
                              </TableCell>
                              <TableCell className="font-medium">{row.durationHours.toFixed(2)}</TableCell>
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
                        Totale Ore Lavorate nel Mese:{" "}
                        <span className="text-primary">
                          {employeeTotal.toFixed(2)} ore
                        </span>
                      </p>
                      <PDFDownloadLink
                        document={
                          <EmployeeReportPDF
                            workerName={selectedWorker.name}
                            monthLabel={employeeMonth}
                            rows={employeeRows}
                          />
                        }
                        fileName={`report-dipendente-${selectedWorker.name.replace(/\s+/g, "-").toLowerCase()}-${employeeMonth.replace(/\s+/g, "-").toLowerCase()}.pdf`}
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

          {selectedClientId && clientLoaded && selectedClient && (
            <Card className="shadow-md border-border/50 rounded-2xl overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Anteprima Report</CardTitle>
                <CardDescription>
                  {selectedClient.name} — {clientMonth}
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
                            clientName={selectedClient.name}
                            monthLabel={clientMonth}
                            rows={clientRows}
                          />
                        }
                        fileName={`report-cliente-${selectedClient.name.replace(/\s+/g, "-").toLowerCase()}-${clientMonth.replace(/\s+/g, "-").toLowerCase()}.pdf`}
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