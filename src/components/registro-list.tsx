"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarDays, Eraser, Trash2 } from "lucide-react"

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

  const [filterClientId, setFilterClientId] = useState<string>("")
  const [filterStartDate, setFilterStartDate] = useState<string>("")
  const [filterEndDate, setFilterEndDate] = useState<string>("")

  const [deleteTarget, setDeleteTarget] = useState<ServiceRecord | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

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
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtri</CardTitle>
          <CardDescription>
            Filtra le registrazioni per cliente e periodo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Filtra per cliente</Label>
              <Select
                items={clients.map((c) => ({ label: c.name, value: c.id }))}
                value={filterClientId || null}
                onValueChange={(value) => setFilterClientId(value ?? "")}
              >
                <SelectTrigger className="w-full">
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
              <Label htmlFor="start-date">Data inizio</Label>
              <Input
                id="start-date"
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-date">Data fine</Label>
              <Input
                id="end-date"
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
              />
            </div>
          </div>

          {hasFilters && (
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={clearFilters}>
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
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <CalendarDays className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              Nessuna registrazione trovata.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: Cards */}
          <div className="space-y-4 md:hidden">
            {records.map((record) => (
              <Card key={record.id}>
                <CardContent className="space-y-3 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="font-medium">{record.clients?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(record.date)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(record)}
                      aria-label="Elimina registrazione"
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <p className="text-sm">
                    {formatTime(record.start_time)} - {formatTime(record.end_time)}{" "}
                    <span className="text-muted-foreground">
                      ({calculateDuration(record.start_time, record.end_time)})
                    </span>
                  </p>

                  {record.service_participants.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {record.service_participants.map((p) => (
                        <Badge key={p.id} variant="secondary">
                          {participantName(p)}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {record.observation && (
                    <p className="text-sm text-muted-foreground">
                      {record.observation}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop: Table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Orario</TableHead>
                    <TableHead>Partecipanti</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="w-[50px] text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id}>
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
                              <Badge key={p.id} variant="secondary">
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
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(record)}
                          aria-label="Elimina registrazione"
                          className="text-destructive"
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