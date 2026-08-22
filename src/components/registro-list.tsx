"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarDays, Clock, Eraser, Trash2 } from "lucide-react"

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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "@/components/ui/toast"

type Client = Database["public"]["Tables"]["clients"]["Row"]

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

function participantName(p: Participant): string {
  if (p.worker_type === "employee") {
    return p.profiles?.full_name ?? "Dipendente"
  }
  return p.freelancers?.name ?? "Collaboratore"
}

export function RegistroList() {
  const supabase = useMemo(() => createClient(), [])

  const [records, setRecords] = useState<ServiceRecord[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loaded, setLoaded] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const [filterClientId, setFilterClientId] = useState<string>("")
  const [filterStartDate, setFilterStartDate] = useState<string>("")
  const [filterEndDate, setFilterEndDate] = useState<string>("")

  const [deleteTarget, setDeleteTarget] = useState<ServiceRecord | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

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
        setIsAdmin(profile.role === "admin")
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

  // Load records whenever filters change
  useEffect(() => {
    let cancelled = false

    const run = async () => {
      let query = supabase
        .from("service_records")
        .select(
          "*, clients(name), service_participants(*, profiles(full_name), freelancers(name))"
        )
        .order("date", { ascending: false })
        .order("start_time", { ascending: false })

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
  }, [supabase, filterClientId, filterStartDate, filterEndDate])

  function clearFilters() {
    setFilterClientId("")
    setFilterStartDate("")
    setFilterEndDate("")
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
        title: "Registrazione eliminata con successo!",
        type: "success",
      })
      setRecords((prev) => prev.filter((r) => r.id !== deleteTarget.id))
    }
    setIsDeleting(false)
    setDeleteTarget(null)
  }

  function canDelete(record: ServiceRecord): boolean {
    if (isAdmin) return true
    if (!currentUserId) return false
    return record.service_participants.some(
      (p) => p.worker_type === "employee" && p.profile_id === currentUserId
    )
  }

  const hasFilters = filterClientId || filterStartDate || filterEndDate
  const showEmptyState = loaded && records.length === 0

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Registro Ore</h1>
        <p className="text-muted-foreground">
          Consulta e gestisci le ore lavorative registrate
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
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Label className="text-sm font-medium">Filtra per cliente</Label>
              <Select
                items={clients.map((c) => ({ label: c.name, value: c.id }))}
                value={filterClientId || null}
                onValueChange={(value) => setFilterClientId(value ?? "")}
              >
                <SelectTrigger className="w-full rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tutti i clienti</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="start-date" className="text-sm font-medium">Data inizio</Label>
              <Input
                id="start-date"
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-date" className="text-sm font-medium">Data fine</Label>
              <Input
                id="end-date"
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="rounded-lg"
              />
            </div>
          </div>

          {hasFilters && (
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={clearFilters} className="rounded-lg">
                <Eraser className="h-4 w-4" />
                Pulisci filtri
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

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
              Nessuna registrazione trovata.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: Cards */}
          <div className="space-y-3 md:hidden">
            {records.map((record) => (
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
                    {canDelete(record) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(record)}
                        aria-label="Elimina registrazione"
                        className="text-destructive rounded-lg min-h-[44px] min-w-[44px]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
                        <Badge key={p.id} variant="secondary" className="rounded-lg text-xs font-normal">
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
                    <TableHead className="w-[50px] text-right font-semibold">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record, index) => (
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
                              <Badge key={p.id} variant="secondary" className="rounded-lg text-xs font-normal">
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
                        {canDelete(record) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(record)}
                            aria-label="Elimina registrazione"
                            className="text-destructive rounded-lg"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      {/* Dialog di conferma eliminazione */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              {`Sei sicuro di voler eliminare questa registrazione? L'azione non può essere annullata.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Eliminazione..." : "Elimina"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}