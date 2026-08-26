"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarDays, Clock, Eraser, Pencil, Search, Trash2, User } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/types/database.types"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { AutocompleteInput } from "@/components/ui/autocomplete-input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { toast } from "@/components/ui/toast"

type Client = Database["public"]["Tables"]["clients"]["Row"]
type Profile = Database["public"]["Tables"]["profiles"]["Row"]
type Freelancer = Database["public"]["Tables"]["freelancers"]["Row"]
type ExtraCost = Database["public"]["Tables"]["extra_costs"]["Row"] & {
  clients: { name: string } | null
}

type Worker = {
  id: string
  name: string
  type: "employee" | "freelancer"
}

type ServiceRecord =
  Database["public"]["Tables"]["service_records"]["Row"] & {
    clients: { name: string } | null
    service_participants: Array<{
      id: string
      worker_type: "employee" | "freelancer"
      profile_id: string | null
      freelancer_id: string | null
      profiles: { full_name: string | null } | null
      freelancers: { name: string } | null
    }>
  }

type Participant = ServiceRecord["service_participants"][number]

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-")
  return `${day}/${month}/${year}`
}

function formatTime(time: string): string {
  return time.slice(0, 5)
}

function calculateDuration(start: string, end: string): string {
  const [sh, sm] = start.split(":").map(Number)
  const [eh, em] = end.split(":").map(Number)
  const totalMinutes = eh * 60 + em - (sh * 60 + sm)
  const hours = Math.floor(totalMinutes / 60)
  const min = totalMinutes % 60
  if (hours > 0 && min > 0) return `${hours} ore e ${min} min`
  if (hours > 0) return `${hours} ore`
  return `${min} min`
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value)
}

function participantName(p: Participant): string {
  if (p.worker_type === "employee") {
    return p.profiles?.full_name ?? "Dipendente"
  }
  return p.freelancers?.name ?? "Collaboratore"
}

export function RegistroList() {
  const supabase = useMemo(() => createClient(), [])

  const [records, setRecords] = useState<ServiceRecord[]>([])
  const [extraCosts, setExtraCosts] = useState<ExtraCost[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loaded, setLoaded] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const [filterClientId, setFilterClientId] = useState<string>("")
  const [filterStartDate, setFilterStartDate] = useState<string>("")
  const [filterEndDate, setFilterEndDate] = useState<string>("")
  const [filterParticipantId, setFilterParticipantId] = useState<string>("")
  const [filterSearchText, setFilterSearchText] = useState<string>("")

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [freelancers, setFreelancers] = useState<Freelancer[]>([])

  const [deleteTarget, setDeleteTarget] = useState<ServiceRecord | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [deleteExtraCostTarget, setDeleteExtraCostTarget] = useState<ExtraCost | null>(null)
  const [isDeletingExtraCost, setIsDeletingExtraCost] = useState(false)

  const [editTarget, setEditTarget] = useState<ServiceRecord | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    date: "",
    client_id: "",
    start_time: "",
    end_time: "",
    observation: "",
  })

  // Load current user and role
  useEffect(() => {
    let cancelled = false
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled || !user) return
      setCurrentUserId(user.id)
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()
      if (!cancelled && profile) {
        setIsAdmin(profile.role?.toLowerCase() === "admin")
      }
    }
    loadUser()
    return () => {
      cancelled = true
    }
  }, [supabase])

  // Load clients once on mount
  useEffect(() => {
    let cancelled = false
    const loadClients = async () => {
      const { data } = await supabase.from("clients").select("*").order("name")
      if (!cancelled && data) setClients(data)
    }
    loadClients()
    return () => {
      cancelled = true
    }
  }, [supabase])

  // Load workers (profiles and freelancers) for participant filter
  useEffect(() => {
    let cancelled = false
    const loadWorkers = async () => {
      const [profilesRes, freelancersRes] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("freelancers").select("*").order("name"),
      ])
      if (cancelled) return
      if (profilesRes.data) setProfiles(profilesRes.data)
      if (freelancersRes.data) setFreelancers(freelancersRes.data)
    }
    loadWorkers()
    return () => { cancelled = true }
  }, [supabase])

  // Load records whenever filters change
  useEffect(() => {
    if (!currentUserId) return

    let cancelled = false

    const run = async () => {
      let query = supabase
        .from("service_records")
        .select(
          "*, clients(name), service_participants!inner(*, profiles(full_name), freelancers(name))"
        )
        .order("date", { ascending: false })
        .order("start_time", { ascending: false })

      // Funcionários veem apenas registros onde são participantes (INNER JOIN)
      if (!isAdmin) {
        query = query.eq("service_participants.profile_id", currentUserId)
      }

      if (filterClientId) {
        query = query.eq("client_id", filterClientId)
      }
      if (filterStartDate) {
        query = query.gte("date", filterStartDate)
      }
      if (filterEndDate) {
        query = query.lte("date", filterEndDate)
      }
      if (filterParticipantId) {
        const [type, id] = filterParticipantId.split(":")
        if (type === "emp") {
          query = query.eq("service_participants.profile_id", id)
        } else if (type === "frl") {
          query = query.eq("service_participants.freelancer_id", id)
        }
      }

      const { data, error } = await query

      if (cancelled) return

      if (error) {
        toast.add({
          title: "Errore",
          description: "Impossibile caricare le registrazioni",
          type: "error",
        })
      } else {
        setRecords((data ?? []) as ServiceRecord[])
      }
      setLoaded(true)
    }

    run()
    return () => {
      cancelled = true
    }
  }, [supabase, currentUserId, isAdmin, filterClientId, filterStartDate, filterEndDate, filterParticipantId])

  // Load extra costs whenever filters change (admin sees all, employees see none by design - extra costs are client-billing only)
  useEffect(() => {
    if (!currentUserId || !isAdmin) {
      setExtraCosts([])
      return
    }

    let cancelled = false

    const run = async () => {
      let query = supabase
        .from("extra_costs")
        .select("*, clients(name)")
        .order("date", { ascending: false })

      if (filterClientId) {
        query = query.eq("client_id", filterClientId)
      }
      if (filterStartDate) {
        query = query.gte("date", filterStartDate)
      }
      if (filterEndDate) {
        query = query.lte("date", filterEndDate)
      }

      const { data, error } = await query

      if (cancelled) return

      if (error) {
        toast.add({
          title: "Errore",
          description: "Impossibile caricare i costi extra",
          type: "error",
        })
      } else {
        setExtraCosts((data ?? []) as ExtraCost[])
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [supabase, currentUserId, isAdmin, filterClientId, filterStartDate, filterEndDate])

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

  // Apply note search filter client-side for better UX
  const filteredRecords = useMemo(() => {
    if (!filterSearchText) return records
    const searchLower = filterSearchText.toLowerCase()
    return records.filter((r) =>
      (r.observation ?? "").toLowerCase().includes(searchLower)
    )
  }, [records, filterSearchText])

  // Apply description search filter client-side for extra costs
  const filteredExtraCosts = useMemo(() => {
    if (!filterSearchText) return extraCosts
    const searchLower = filterSearchText.toLowerCase()
    return extraCosts.filter((c) =>
      (c.description ?? "").toLowerCase().includes(searchLower)
    )
  }, [extraCosts, filterSearchText])

  function clearFilters() {
    setFilterClientId("")
    setFilterStartDate("")
    setFilterEndDate("")
    setFilterParticipantId("")
    setFilterSearchText("")
  }

  function canManage(record: ServiceRecord): boolean {
    if (isAdmin) return true
    if (!currentUserId) return false
    return record.service_participants.some(
      (p) => p.worker_type === "employee" && p.profile_id === currentUserId
    )
  }

  function openEditDialog(record: ServiceRecord) {
    setEditTarget(record)
    setEditForm({
      date: record.date,
      client_id: record.client_id,
      start_time: record.start_time.slice(0, 5),
      end_time: record.end_time.slice(0, 5),
      observation: record.observation ?? "",
    })
  }

  async function handleSaveEdit() {
    if (!editTarget) return

    setIsSaving(true)
    const { error } = await supabase
      .from("service_records")
      .update({
        date: editForm.date,
        client_id: editForm.client_id,
        start_time: editForm.start_time,
        end_time: editForm.end_time,
        observation: editForm.observation || null,
      })
      .eq("id", editTarget.id)

    if (error) {
      toast.add({
        title: "Errore",
        description: "Impossibile aggiornare la registrazione",
        type: "error",
      })
    } else {
      toast.add({
        title: "Registro aggiornato con successo",
        type: "success",
      })
      // Update local state
      setRecords((prev) =>
        prev.map((r) =>
          r.id === editTarget.id
            ? {
                ...r,
                date: editForm.date,
                client_id: editForm.client_id,
                start_time: editForm.start_time,
                end_time: editForm.end_time,
                observation: editForm.observation || null,
                clients: clients.find((c) => c.id === editForm.client_id) ?? null,
              }
            : r
        )
      )
      setEditTarget(null)
    }
    setIsSaving(false)
  }

  async function handleDelete() {
    if (!deleteTarget) return

    setIsDeleting(true)
    const { error } = await supabase
      .from("service_records")
      .delete()
      .eq("id", deleteTarget.id)

    if (error) {
      toast.add({
        title: "Errore",
        description: "Impossibile eliminare la registrazione",
        type: "error",
      })
    } else {
      toast.add({
        title: "Registro eliminato con successo",
        type: "success",
      })
      setRecords((prev) => prev.filter((r) => r.id !== deleteTarget.id))
    }
    setIsDeleting(false)
    setDeleteTarget(null)
  }

  async function handleDeleteExtraCost() {
    if (!deleteExtraCostTarget) return

    setIsDeletingExtraCost(true)
    const { error } = await supabase
      .from("extra_costs")
      .delete()
      .eq("id", deleteExtraCostTarget.id)

    if (error) {
      toast.add({
        title: "Errore",
        description: "Impossibile eliminare il costo extra",
        type: "error",
      })
    } else {
      toast.add({
        title: "Costo extra eliminato con successo",
        type: "success",
      })
      setExtraCosts((prev) => prev.filter((c) => c.id !== deleteExtraCostTarget.id))
    }
    setIsDeletingExtraCost(false)
    setDeleteExtraCostTarget(null)
  }

  const hasFilters = filterClientId || filterStartDate || filterEndDate || filterParticipantId || filterSearchText
  const showEmptyState = loaded && filteredRecords.length === 0

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Registro Ore</h1>
        <p className="text-muted-foreground">
          Consulta e gestisci le ore lavorative registrate e i costi extra
        </p>
      </div>

      {/* Filtri */}
      <Card className="shadow-md border-border/50 rounded-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Filtri</CardTitle>
          <CardDescription>
            Filtra le registrazioni per cliente e periodo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Filtra per cliente</Label>
              <AutocompleteInput
                items={clients.map((c) => ({ label: c.name, value: c.id }))}
                value={filterClientId}
                onValueChange={(value) => setFilterClientId(value)}
                placeholder="Cerca o seleziona cliente..."
                emptyMessage="Nessun cliente trovato."
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Filtra per partecipante</Label>
              <AutocompleteInput
                items={workers.map((w) => ({
                  label: w.type === "freelancer" ? `${w.name} (Collaboratore)` : w.name,
                  value: w.id,
                }))}
                value={filterParticipantId}
                onValueChange={(value) => setFilterParticipantId(value)}
                placeholder="Tutti i partecipanti"
                emptyMessage="Nessun partecipante trovato."
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="start-date" className="text-sm font-medium">Data inizio</Label>
              <Input
                id="start-date"
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="rounded-lg h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-date" className="text-sm font-medium">Data fine</Label>
              <Input
                id="end-date"
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="rounded-lg h-12"
              />
            </div>

            <div className="space-y-2 sm:col-span-2 lg:col-span-4">
              <Label htmlFor="search-notes" className="text-sm font-medium">Cerca nelle note o descrizioni</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="search-notes"
                  type="text"
                  value={filterSearchText}
                  onChange={(e) => setFilterSearchText(e.target.value)}
                  placeholder="Cerca nelle note o descrizioni..."
                  className="rounded-lg h-12 pl-9"
                />
              </div>
            </div>
          </div>

          {hasFilters && (
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={clearFilters} className="rounded-lg min-h-[44px]">
                <Eraser className="h-4 w-4" />
                Azzera filtri
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="ore">
        <TabsList className="flex flex-col sm:flex-row w-full sm:w-auto bg-slate-100 p-1.5 rounded-xl border border-slate-200/80 sm:inline-flex gap-1.5 h-auto">
          <TabsTrigger
            value="ore"
            className="w-full sm:w-auto justify-center rounded-lg px-4 py-2.5 text-xs sm:text-sm font-medium transition-all duration-150 data-active:!bg-blue-600 data-active:!text-white data-active:!shadow-md !bg-transparent !text-slate-600 hover:bg-slate-200/60 flex items-center gap-2"
          >
            <Clock className="h-4 w-4 data-active:!text-white shrink-0" />
            <span>Registro Ore</span>
          </TabsTrigger>
          <TabsTrigger
            value="extra"
            className="w-full sm:w-auto justify-center rounded-lg px-4 py-2.5 text-xs sm:text-sm font-medium transition-all duration-150 data-active:!bg-amber-600 data-active:!text-white data-active:!shadow-md !bg-transparent !text-slate-600 hover:bg-slate-200/60 flex items-center gap-2"
          >
            <CalendarDays className="h-4 w-4 data-active:!text-white shrink-0" />
            <span>Costi Extra e Materiali</span>
          </TabsTrigger>
        </TabsList>

        {/* Ore tab */}
        <TabsContent value="ore" className="space-y-4">
          {/* Lista Registrazioni */}
          {!loaded ? (
            <p className="text-center text-muted-foreground py-8">
              Caricamento registrazioni...
            </p>
          ) : showEmptyState ? (
            <Card className="shadow-md border-border/50 rounded-2xl">
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                  <CalendarDays className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">
                  Nessun registro di lavoro trovato.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Mobile: Cards */}
              <div className="space-y-3 md:hidden">
                {filteredRecords.map((record) => (
                  <Card key={record.id} className="shadow-sm border-border/50 rounded-xl overflow-hidden">
                    <CardContent className="space-y-3 pt-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <p className="font-semibold text-[15px]">{record.clients?.name}</p>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {formatDate(record.date)}
                          </div>
                        </div>
                        {canManage(record) && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(record)}
                              aria-label="Modifica registrazione"
                              className="rounded-lg min-h-[44px] min-w-[44px]"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget(record)}
                              aria-label="Elimina registrazione"
                              className="text-destructive rounded-lg min-h-[44px] min-w-[44px]"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
                        <Clock className="h-4 w-4 text-primary" />
                        <p className="text-sm font-medium">
                          {formatTime(record.start_time)} - {formatTime(record.end_time)}{" "}
                          <span className="text-muted-foreground font-normal">
                            ({calculateDuration(record.start_time, record.end_time)})
                          </span>
                        </p>
                      </div>

                      {record.service_participants.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {record.service_participants.map((p) => (
                            <Badge
                              key={p.id}
                              variant={p.worker_type === "employee" ? "team" : "freelancer"}
                              className="rounded-lg text-xs font-normal"
                            >
                              {participantName(p)}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {record.observation && (
                        <p className="text-sm text-muted-foreground border-t border-border/40 pt-2">
                          {record.observation}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Desktop: Table */}
              <Card className="hidden md:block shadow-md border-border/50 rounded-2xl overflow-hidden">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="font-semibold">Data</TableHead>
                        <TableHead className="font-semibold">Cliente</TableHead>
                        <TableHead className="font-semibold">Orario</TableHead>
                        <TableHead className="font-semibold">Partecipanti</TableHead>
                        <TableHead className="font-semibold">Note</TableHead>
                        <TableHead className="w-[100px] text-right font-semibold">Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRecords.map((record, index) => (
                        <TableRow key={record.id} className={index % 2 === 1 ? "bg-muted/20" : ""}>
                          <TableCell className="whitespace-nowrap">
                            {formatDate(record.date)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {record.clients?.name}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatTime(record.start_time)} -{" "}
                            {formatTime(record.end_time)}
                            <span className="block text-xs text-muted-foreground">
                              {calculateDuration(record.start_time, record.end_time)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1.5">
                              {record.service_participants.length > 0 ? (
                                record.service_participants.map((p) => (
                                  <Badge
                                    key={p.id}
                                    variant={p.worker_type === "employee" ? "team" : "freelancer"}
                                    className="rounded-lg text-xs font-normal"
                                  >
                                    {participantName(p)}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  Nessun partecipante
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {record.observation || (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {canManage(record) && (
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditDialog(record)}
                                  aria-label="Modifica registrazione"
                                  className="rounded-lg"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeleteTarget(record)}
                                  aria-label="Elimina registrazione"
                                  className="text-destructive rounded-lg"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Extra Costs tab */}
        <TabsContent value="extra" className="space-y-4">
          {!isAdmin ? (
            <Card className="shadow-md border-border/50 rounded-2xl">
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                <p className="text-muted-foreground">
                  Solo gli amministratori possono visualizzare i costi extra.
                </p>
              </CardContent>
            </Card>
          ) : filteredExtraCosts.length === 0 ? (
            <Card className="shadow-md border-border/50 rounded-2xl">
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                  <CalendarDays className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">
                  Nessun costo extra trovato.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Mobile: Cards */}
              <div className="space-y-3 md:hidden">
                {filteredExtraCosts.map((cost) => (
                  <Card key={cost.id} className="shadow-sm border-border/50 rounded-xl overflow-hidden">
                    <CardContent className="space-y-3 pt-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <p className="font-semibold text-[15px]">{cost.clients?.name}</p>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {formatDate(cost.date)}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteExtraCostTarget(cost)}
                          aria-label="Elimina costo extra"
                          className="text-destructive rounded-lg min-h-[44px] min-w-[44px]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 px-3 py-2 border border-amber-200 dark:border-amber-800/40">
                        <p className="text-sm font-medium">{cost.description}</p>
                        <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                          {formatCurrency(Number(cost.amount))}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Desktop: Table */}
              <Card className="hidden md:block shadow-md border-border/50 rounded-2xl overflow-hidden">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="font-semibold">Data</TableHead>
                        <TableHead className="font-semibold">Cliente</TableHead>
                        <TableHead className="font-semibold">Descrizione</TableHead>
                        <TableHead className="font-semibold text-right">Importo (€)</TableHead>
                        <TableHead className="w-[80px] text-right font-semibold">Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredExtraCosts.map((cost, index) => (
                        <TableRow key={cost.id} className={index % 2 === 1 ? "bg-muted/20" : ""}>
                          <TableCell className="whitespace-nowrap">
                            {formatDate(cost.date)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {cost.clients?.name}
                          </TableCell>
                          <TableCell>
                            {cost.description}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(Number(cost.amount))}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteExtraCostTarget(cost)}
                              aria-label="Elimina costo extra"
                              className="text-destructive rounded-lg"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog di modifica */}
      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null)
        }}
      >
        <DialogContent className="w-[95vw] max-w-lg sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifica Registro</DialogTitle>
            <DialogDescription>
              Aggiorna i dati della registrazione
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-date" className="text-sm font-medium">Data</Label>
              <Input
                id="edit-date"
                type="date"
                value={editForm.date}
                onChange={(e) => setEditForm((prev) => ({ ...prev, date: e.target.value }))}
                className="rounded-lg h-12 text-base"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Cliente</Label>
              <Select
                items={clients.map((c) => ({ label: c.name, value: c.id }))}
                value={editForm.client_id || null}
                onValueChange={(value) => setEditForm((prev) => ({ ...prev, client_id: value ?? "" }))}
              >
                <SelectTrigger className="w-full rounded-lg h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-start-time" className="text-sm font-medium">Ora Inizio</Label>
                <Input
                  id="edit-start-time"
                  type="time"
                  value={editForm.start_time}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, start_time: e.target.value }))}
                  className="rounded-lg h-12 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-end-time" className="text-sm font-medium">Ora Fine</Label>
                <Input
                  id="edit-end-time"
                  type="time"
                  value={editForm.end_time}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, end_time: e.target.value }))}
                  className="rounded-lg h-12 text-base"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-observation" className="text-sm font-medium">Note / Ubicazione</Label>
              <Input
                id="edit-observation"
                type="text"
                value={editForm.observation}
                onChange={(e) => setEditForm((prev) => ({ ...prev, observation: e.target.value }))}
                placeholder="Note o ubicazione del servizio"
                className="rounded-lg h-12"
              />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setEditTarget(null)}
              className="rounded-lg w-full sm:w-auto min-h-[44px]"
            >
              Annulla
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={isSaving || !editForm.date || !editForm.client_id || !editForm.start_time || !editForm.end_time}
              className="rounded-lg w-full sm:w-auto min-h-[44px]"
            >
              {isSaving ? "Salvataggio..." : "Salva Modifiche"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog di conferma eliminazione registro */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent className="w-[95vw] max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              {`Sei sicuro di voler eliminare questo registro? L'azione non può essere annullata.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <AlertDialogCancel className="w-full sm:w-auto min-h-[44px]">Annulla</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-full sm:w-auto min-h-[44px]"
            >
              {isDeleting ? "Eliminazione..." : "Conferma"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog di conferma eliminazione costo extra */}
      <AlertDialog
        open={deleteExtraCostTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteExtraCostTarget(null)
        }}
      >
        <AlertDialogContent className="w-[95vw] max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              {`Sei sicuro di voler eliminare questo costo extra? L'azione non può essere annullata.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <AlertDialogCancel className="w-full sm:w-auto min-h-[44px]">Annulla</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeleteExtraCost}
              disabled={isDeletingExtraCost}
              className="w-full sm:w-auto min-h-[44px]"
            >
              {isDeletingExtraCost ? "Eliminazione..." : "Conferma"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}