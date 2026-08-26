"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Building2,
  Clock,
  Euro,
  UserCheck,
  Users,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/types/database.types"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

type Client = Database["public"]["Tables"]["clients"]["Row"]
type Profile = Database["public"]["Tables"]["profiles"]["Row"]
type Freelancer = Database["public"]["Tables"]["freelancers"]["Row"]

type ServiceRecord = Database["public"]["Tables"]["service_records"]["Row"] & {
  clients: { name: string; hourly_rate: number } | null
  service_participants: Array<{
    worker_type: "employee" | "freelancer"
    profile_id: string | null
    freelancer_id: string | null
    profiles: { full_name: string | null; role: "admin" | "employee" } | null
    freelancers: { name: string } | null
  }>
}

type ExtraCost = Database["public"]["Tables"]["extra_costs"]["Row"] & {
  clients: { name: string } | null
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

function currentMonthValue(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

function monthLabel(value: string): string {
  const [year, month] = value.split("-")
  return `${MONTHS_IT[Number(month) - 1]} ${year}`
}

function toDurationHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number)
  const [eh, em] = endTime.split(":").map(Number)
  let diffMinutes = eh * 60 + em - (sh * 60 + sm)
  if (diffMinutes < 0) diffMinutes += 24 * 60
  return diffMinutes / 60
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value)
}

function formatHours(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)
}

export function DashboardOverview() {
  const supabase = useMemo(() => createClient(), [])
  const [selectedMonth, setSelectedMonth] = useState(currentMonthValue())
  const [records, setRecords] = useState<ServiceRecord[]>([])
  const [extraCosts, setExtraCosts] = useState<ExtraCost[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [freelancers, setFreelancers] = useState<Freelancer[]>([])
  const [loading, setLoading] = useState(true)

  // Load reference data (clients, profiles, freelancers)
  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      const [clientsRes, profilesRes, freelancersRes] = await Promise.all([
        supabase.from("clients").select("*").order("name"),
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("freelancers").select("*").order("name"),
      ])
      if (cancelled) return
      if (clientsRes.data) setClients(clientsRes.data)
      if (profilesRes.data) setProfiles(profilesRes.data)
      if (freelancersRes.data) setFreelancers(freelancersRes.data)
    }
    loadData()
    return () => { cancelled = true }
  }, [supabase])

  // Load records for selected month
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      const [year, month] = selectedMonth.split("-")
      const startDate = `${year}-${month}-01`
      const endDate = new Date(Number(year), Number(month), 0)
      const endDateStr = `${year}-${month}-${String(endDate.getDate()).padStart(2, "0")}`

      const [recordsRes, extraCostsRes] = await Promise.all([
        supabase
          .from("service_records")
          .select(
            "*, clients(name, hourly_rate), service_participants(worker_type, profile_id, freelancer_id, profiles(full_name, role), freelancers(name))"
          )
          .gte("date", startDate)
          .lte("date", endDateStr)
          .order("date", { ascending: true }),
        supabase
          .from("extra_costs")
          .select("*, clients(name)")
          .gte("date", startDate)
          .lte("date", endDateStr)
          .order("date", { ascending: true }),
      ])

      if (cancelled) return
      if (!recordsRes.error && recordsRes.data) {
        setRecords(recordsRes.data as ServiceRecord[])
      }
      if (!extraCostsRes.error && extraCostsRes.data) {
        setExtraCosts(extraCostsRes.data as ExtraCost[])
      }
      setLoading(false)
    }
    run()
    return () => { cancelled = true }
  }, [supabase, selectedMonth])

  // ── Metrics ──
  const metrics = useMemo(() => {
    let totalHours = 0
    let totalRevenue = 0
    const clientIds = new Set<string>()
    const workerIds = new Set<string>()

    for (const r of records) {
      const duration = toDurationHours(r.start_time, r.end_time)
      const participantCount = r.service_participants.length
      const serviceHours = duration * participantCount
      const hourlyRate = r.clients?.hourly_rate ?? 0
      totalHours += serviceHours
      totalRevenue += serviceHours * hourlyRate
      if (r.client_id) clientIds.add(r.client_id)
      for (const p of r.service_participants) {
        if (p.worker_type === "employee" && p.profile_id) {
          workerIds.add(`emp:${p.profile_id}`)
        } else if (p.worker_type === "freelancer" && p.freelancer_id) {
          workerIds.add(`frl:${p.freelancer_id}`)
        }
      }
    }

    // Adiciona os custos extras ao faturamento estimado
    for (const ec of extraCosts) {
      totalRevenue += Number(ec.amount)
      if (ec.client_id) clientIds.add(ec.client_id)
    }

    return {
      totalHours,
      totalRevenue,
      clientCount: clientIds.size,
      workerCount: workerIds.size,
    }
  }, [records, extraCosts])

  // ── Revenue/Costs per client ──
  const clientRanking = useMemo(() => {
    const map = new Map<string, { name: string; hours: number; revenue: number; extraCosts: number }>()
    for (const r of records) {
      const duration = toDurationHours(r.start_time, r.end_time)
      const participantCount = r.service_participants.length
      const serviceHours = duration * participantCount
      const hourlyRate = r.clients?.hourly_rate ?? 0
      const clientId = r.client_id
      const existing = map.get(clientId)
      if (existing) {
        existing.hours += serviceHours
        existing.revenue += serviceHours * hourlyRate
      } else {
        map.set(clientId, {
          name: r.clients?.name ?? "Sconosciuto",
          hours: serviceHours,
          revenue: serviceHours * hourlyRate,
          extraCosts: 0,
        })
      }
    }

    // Adiciona os custos extras ao ranking por cliente
    for (const ec of extraCosts) {
      const existing = map.get(ec.client_id)
      if (existing) {
        existing.extraCosts += Number(ec.amount)
        existing.revenue += Number(ec.amount)
      } else {
        map.set(ec.client_id, {
          name: ec.clients?.name ?? "Sconosciuto",
          hours: 0,
          revenue: Number(ec.amount),
          extraCosts: Number(ec.amount),
        })
      }
    }

    return Array.from(map.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [records, extraCosts])

  const maxClientHours = clientRanking.length > 0 ? clientRanking[0].hours : 0

  // ── Hours per worker ──
  const workerRanking = useMemo(() => {
    const map = new Map<string, { name: string; hours: number; role: string }>()
    for (const r of records) {
      const duration = toDurationHours(r.start_time, r.end_time)
      for (const p of r.service_participants) {
        if (p.worker_type === "employee" && p.profile_id) {
          const key = `emp:${p.profile_id}`
          const existing = map.get(key)
          if (existing) {
            existing.hours += duration
          } else {
            map.set(key, {
              name: p.profiles?.full_name ?? "Dipendente",
              hours: duration,
              role: p.profiles?.role ?? "employee",
            })
          }
        } else if (p.worker_type === "freelancer" && p.freelancer_id) {
          const key = `frl:${p.freelancer_id}`
          const existing = map.get(key)
          if (existing) {
            existing.hours += duration
          } else {
            map.set(key, {
              name: p.freelancers?.name ?? "Collaboratore",
              hours: duration,
              role: "freelancer",
            })
          }
        }
      }
    }
    return Array.from(map.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.hours - a.hours)
  }, [records])

  const maxWorkerHours = workerRanking.length > 0 ? workerRanking[0].hours : 0

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Dashboard Panoramica</h1>
          <p className="text-muted-foreground">
            Panoramica delle operazioni mensili
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <Label htmlFor="month-selector" className="text-sm font-medium">
            Seleziona Mese
          </Label>
          <Input
            id="month-selector"
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="mt-1 rounded-lg h-12 w-full sm:w-48"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Ore Totali Mese
                </p>
                <p className="text-2xl font-bold">
                  {formatHours(metrics.totalHours)} h
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                <Euro className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Fatturato Stimato
                </p>
                <p className="text-2xl font-bold">
                  {formatCurrency(metrics.totalRevenue)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100">
                <Building2 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Clienti Serviti
                </p>
                <p className="text-2xl font-bold">{metrics.clientCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                <Users className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Lavoratori Attivi
                </p>
                <p className="text-2xl font-bold">{metrics.workerCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail sections */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue per client */}
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Riepilogo Ore per Cliente
            </CardTitle>
            <CardDescription>
              {monthLabel(selectedMonth)} — include costi extra e materiali
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Caricamento dati...
              </p>
            ) : clientRanking.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nessun dato per il mese selezionato.
              </p>
            ) : (
              clientRanking.map((client) => (
                <div key={client.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{client.name}</p>
                    <div className="flex items-center gap-3 shrink-0">
                      {client.extraCosts > 0 && (
                        <Badge variant="secondary" className="rounded-full text-[10px]">
                          +{formatCurrency(client.extraCosts)}
                        </Badge>
                      )}
                      <span className="text-sm font-semibold">
                        {formatHours(client.hours)} h
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {formatCurrency(client.revenue)}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{
                        width: maxClientHours > 0
                          ? `${(client.hours / maxClientHours) * 100}%`
                          : "0%",
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Hours per worker */}
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-primary" />
              Ore per Lavoratore
            </CardTitle>
            <CardDescription>
              {monthLabel(selectedMonth)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Caricamento dati...
              </p>
            ) : workerRanking.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nessun dato per il mese selezionato.
              </p>
            ) : (
              workerRanking.map((worker) => (
                <div key={worker.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-sm font-medium truncate">{worker.name}</p>
                      <Badge
                        variant={
                          worker.role === "admin"
                            ? "admin"
                            : worker.role === "freelancer"
                              ? "freelancer"
                              : "employee"
                        }
                        className="rounded-full text-[10px] shrink-0"
                      >
                        {worker.role === "admin"
                          ? "Admin"
                          : worker.role === "freelancer"
                            ? "Collaboratore"
                            : "Dipendente"}
                      </Badge>
                    </div>
                    <span className="text-sm font-semibold shrink-0">
                      {formatHours(worker.hours)} h
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{
                        width: maxWorkerHours > 0
                          ? `${(worker.hours / maxWorkerHours) * 100}%`
                          : "0%",
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}