"use client"

import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Clock2, Plus, Save, UserPlus, Users, X } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/types/database.types"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Form } from "@/components/ui/form"
import { toast } from "@/components/ui/toast"
import { AutocompleteInput } from "@/components/ui/autocomplete-input"

type Client = Database["public"]["Tables"]["clients"]["Row"]
type Freelancer = Database["public"]["Tables"]["freelancers"]["Row"]
type Profile = Database["public"]["Tables"]["profiles"]["Row"]

const formSchema = z
  .object({
    clientId: z.string().min(1, "Seleziona un cliente"),
    date: z.string().min(1, "Seleziona una data"),
    startTime: z.string().min(1, "Seleziona l'ora di inizio"),
    endTime: z.string().min(1, "Seleziona l'ora di fine"),
    observation: z.string().optional(),
  })
  .refine(
    (data) => {
      if (!data.startTime || !data.endTime) return true
      return data.endTime > data.startTime
    },
    {
      path: ["endTime"],
      message: "L'ora di fine deve essere successiva all'ora di inizio",
    }
  )

type FormValues = z.infer<typeof formSchema>

function todayISO() {
  return new Date().toISOString().split("T")[0]
}

function calculateDuration(start: string, end: string): string | null {
  if (!start || !end) return null
  const [sh, sm] = start.split(":").map(Number)
  const [eh, em] = end.split(":").map(Number)
  const totalMinutes = eh * 60 + em - (sh * 60 + sm)
  if (totalMinutes <= 0) return null
  const hours = Math.floor(totalMinutes / 60)
  const min = totalMinutes % 60
  if (hours > 0 && min > 0) return `${hours} ore e ${min} minuti`
  if (hours > 0) return `${hours} ore`
  return `${min} minuti`
}

export function InsertionForm() {
  const supabase = useMemo(() => createClient(), [])

  const [clients, setClients] = useState<Client[]>([])
  const [employees, setEmployees] = useState<Profile[]>([])
  const [freelancers, setFreelancers] = useState<Freelancer[]>([])

  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([])
  const [selectedFreelancerIds, setSelectedFreelancerIds] = useState<string[]>([])
  const [participantsError, setParticipantsError] = useState<string | null>(null)
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [isNewClientOpen, setIsNewClientOpen] = useState(false)
  const [newClientName, setNewClientName] = useState("")
  const [isNewFreelancerOpen, setIsNewFreelancerOpen] = useState(false)
  const [newFreelancerName, setNewFreelancerName] = useState("")

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientId: "",
      date: todayISO(),
      startTime: "",
      endTime: "",
      observation: "",
    },
  })

  const startTime = form.watch("startTime")
  const endTime = form.watch("endTime")
  const duration = calculateDuration(startTime, endTime)

  useEffect(() => {
    const loadData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const [clientsRes, employeesRes, freelancersRes] = await Promise.all([
        supabase.from("clients").select("*").order("name"),
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("freelancers").select("*").order("name"),
      ])

      if (clientsRes.data) setClients(clientsRes.data)
      if (employeesRes.data) setEmployees(employeesRes.data)
      if (freelancersRes.data) setFreelancers(freelancersRes.data)

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single()

        if (profile) {
          setCurrentUserProfile(profile)
          // Pré-seleciona o usuário logado na lista de participantes
          setSelectedEmployeeIds([profile.id])
        }
      }
    }
    loadData()
  }, [supabase])

  const clientItems = useMemo(
    () => clients.map((c) => ({ label: c.name, value: c.id })),
    [clients]
  )
  const employeeItems = useMemo(
    () =>
      employees
        .filter((e) => e.full_name)
        .map((e) => ({ label: e.full_name!, value: e.id })),
    [employees]
  )
  const freelancerItems = useMemo(
    () => freelancers.map((f) => ({ label: f.name, value: f.id })),
    [freelancers]
  )

  const selectedEmployees = useMemo(
    () => employeeItems.filter((e) => selectedEmployeeIds.includes(e.value)),
    [employeeItems, selectedEmployeeIds]
  )
  const selectedFreelancers = useMemo(
    () => freelancerItems.filter((f) => selectedFreelancerIds.includes(f.value)),
    [freelancerItems, selectedFreelancerIds]
  )

  function handleRemoveEmployee(id: string) {
    setSelectedEmployeeIds((prev) => prev.filter((eid) => eid !== id))
  }

  function handleRemoveFreelancer(id: string) {
    setSelectedFreelancerIds((prev) => prev.filter((fid) => fid !== id))
  }

  async function handleAddClient() {
    const name = newClientName.trim()
    if (!name) return

    const { data, error } = await supabase
      .from("clients")
      .insert({ name })
      .select()
      .single()

    if (error) {
      toast.add({
        title: "Errore",
        description: "Impossibile creare il cliente",
        type: "error",
      })
      return
    }

    setClients((prev) => [...prev, data])
    form.setValue("clientId", data.id)
    setNewClientName("")
    setIsNewClientOpen(false)
    toast.add({
      title: "Cliente creato",
      description: `"${name}" è stato aggiunto`,
      type: "success",
    })
  }

  async function handleAddFreelancer() {
    const name = newFreelancerName.trim()
    if (!name) return

    const { data, error } = await supabase
      .from("freelancers")
      .insert({ name })
      .select()
      .single()

    if (error) {
      toast.add({
        title: "Errore",
        description: "Impossibile creare il collaboratore occasionale",
        type: "error",
      })
      return
    }

    setFreelancers((prev) => [...prev, data])
    setSelectedFreelancerIds((prev) => [...prev, data.id])
    setNewFreelancerName("")
    setIsNewFreelancerOpen(false)
    setParticipantsError("")
    toast.add({
      title: "Collaboratore creato",
      description: `"${name}" è stato aggiunto`,
      type: "success",
    })
  }

  async function handleSubmit(values: FormValues) {
    // Garantisce che il currentUserProfile sia sempre presente nei partecipanti
    const finalEmployeeIds = selectedEmployeeIds.includes(currentUserProfile?.id ?? "")
      ? selectedEmployeeIds
      : currentUserProfile
        ? [currentUserProfile.id, ...selectedEmployeeIds]
        : selectedEmployeeIds

    if (finalEmployeeIds.length === 0 && selectedFreelancerIds.length === 0) {
      setParticipantsError("Seleziona almeno un partecipante")
      return
    }

    setIsSubmitting(true)

    const { data: record, error: recordError } = await supabase
      .from("service_records")
      .insert({
        client_id: values.clientId,
        date: values.date,
        start_time: values.startTime,
        end_time: values.endTime,
        observation: values.observation || null,
      })
      .select()
      .single()

    if (recordError || !record) {
      toast.add({
        title: "Errore",
        description: "Si è verificato un errore durante il salvataggio",
        type: "error",
      })
      setIsSubmitting(false)
      return
    }

    const participants = [
      ...finalEmployeeIds.map((profileId) => ({
        service_record_id: record.id,
        worker_type: "employee" as const,
        profile_id: profileId,
      })),
      ...selectedFreelancerIds.map((freelancerId) => ({
        service_record_id: record.id,
        worker_type: "freelancer" as const,
        freelancer_id: freelancerId,
      })),
    ]

    const { error: participantsInsertError } = await supabase
      .from("service_participants")
      .insert(participants)

    if (participantsInsertError) {
      toast.add({
        title: "Errore",
        description: "Si è verificato un errore durante il salvataggio",
        type: "error",
      })
      setIsSubmitting(false)
      return
    }

    toast.add({
      title: "Registrazione salvata con successo!",
      description: "Le ore lavorative sono state registrate",
      type: "success",
    })

    form.reset({
      clientId: "",
      date: todayISO(),
      startTime: "",
      endTime: "",
      observation: "",
    })
    // Mantiene l'utente logato preselezionato dopo il reset
    setSelectedEmployeeIds(currentUserProfile ? [currentUserProfile.id] : [])
    setSelectedFreelancerIds([])
    setParticipantsError("")
    setIsSubmitting(false)
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl md:text-2xl">
            <Clock2 className="h-6 w-6 text-primary" />
            Nuovo Inserimento
          </CardTitle>
          <CardDescription>
            Registra le ore lavorative svolte per un cliente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-6"
            >
              {/* Cliente */}
              <div className="space-y-2">
                <Label>Cliente</Label>
                <AutocompleteInput
                  items={clientItems}
                  value={form.watch("clientId") ?? ""}
                  onValueChange={(value) => form.setValue("clientId", value)}
                  placeholder="Inizia a digitare il nome del cliente..."
                  emptyMessage="Nessun risultato trovato."
                  actionButton={
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setIsNewClientOpen(true)}
                      aria-label="Nuovo cliente"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  }
                />
                {form.formState.errors.clientId && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.clientId.message}
                  </p>
                )}
              </div>

              {/* Data e Orari */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Data</Label>
                  <Input
                    id="date"
                    type="date"
                    {...form.register("date")}
                  />
                  {form.formState.errors.date && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.date.message}
                    </p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="start-time">Ora Inizio</Label>
                    <Input
                      id="start-time"
                      type="time"
                      {...form.register("startTime")}
                    />
                    {form.formState.errors.startTime && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.startTime.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="end-time">Ora Fine</Label>
                    <Input
                      id="end-time"
                      type="time"
                      {...form.register("endTime")}
                    />
                    {form.formState.errors.endTime && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.endTime.message}
                      </p>
                    )}
                  </div>
                </div>

                {duration && (
                  <p className="text-sm font-medium text-primary">
                    Durata calcolata: {duration}
                  </p>
                )}
              </div>

              {/* Partecipanti */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <Label>Chi ha lavorato?</Label>
                </div>

                <div className="space-y-2">
                  <Label>Dipendenti</Label>
                  <AutocompleteInput
                    items={employeeItems}
                    placeholder="Inizia a digitare il nome..."
                    emptyMessage="Nessun risultato trovato."
                    clearOnSelect
                    filterSelected={(item) =>
                      !selectedEmployeeIds.includes(item.value)
                    }
                    onSelect={(item) => {
                      setSelectedEmployeeIds((prev) => [...prev, item.value])
                      setParticipantsError("")
                    }}
                  />
                  {selectedEmployees.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedEmployees.map((emp) => (
                        <Badge
                          key={emp.value}
                          variant="secondary"
                          className="gap-1 pr-1"
                        >
                          {emp.label}
                          <button
                            type="button"
                            onClick={() => handleRemoveEmployee(emp.value)}
                            className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                            aria-label={`Rimuovi ${emp.label}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Collaboratori Occasionali</Label>
                  <AutocompleteInput
                    items={freelancerItems}
                    placeholder="Inizia a digitare il nome..."
                    emptyMessage="Nessun risultato trovato."
                    clearOnSelect
                    filterSelected={(item) =>
                      !selectedFreelancerIds.includes(item.value)
                    }
                    onSelect={(item) => {
                      setSelectedFreelancerIds((prev) => [...prev, item.value])
                      setParticipantsError("")
                    }}
                    actionButton={
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setIsNewFreelancerOpen(true)}
                        aria-label="Nuovo collaboratore occasionale"
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    }
                  />
                  {selectedFreelancers.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedFreelancers.map((frl) => (
                        <Badge
                          key={frl.value}
                          variant="secondary"
                          className="gap-1 pr-1"
                        >
                          {frl.label}
                          <button
                            type="button"
                            onClick={() => handleRemoveFreelancer(frl.value)}
                            className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                            aria-label={`Rimuovi ${frl.label}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {participantsError && (
                  <p className="text-sm text-destructive">
                    {participantsError}
                  </p>
                )}
              </div>

              {/* Note */}
              <div className="space-y-2">
                <Label htmlFor="observation">Note / Ubicazione</Label>
                <Input
                  id="observation"
                  {...form.register("observation")}
                  placeholder="Es. Casa 1, Pod 2"
                  className="h-auto min-h-[80px] py-2"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isSubmitting}
              >
                <Save className="h-4 w-4" />
                {isSubmitting ? "Salvataggio..." : "Salva Registrazione"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Dialog Nuovo Cliente */}
      <Dialog open={isNewClientOpen} onOpenChange={setIsNewClientOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuovo Cliente</DialogTitle>
            <DialogDescription>
              Inserisci il nome del nuovo cliente
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-client">Nome cliente</Label>
            <Input
              id="new-client"
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              placeholder="Es. Campeggio Max"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsNewClientOpen(false)}
            >
              Annulla
            </Button>
            <Button
              type="button"
              onClick={handleAddClient}
              disabled={!newClientName.trim()}
            >
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Nuovo Collaboratore */}
      <Dialog open={isNewFreelancerOpen} onOpenChange={setIsNewFreelancerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuovo Collaboratore Occasionale</DialogTitle>
            <DialogDescription>
              Inserisci il nome del collaboratore occasionale
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-freelancer">Nome completo</Label>
            <Input
              id="new-freelancer"
              value={newFreelancerName}
              onChange={(e) => setNewFreelancerName(e.target.value)}
              placeholder="Es. Mario Verdi"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsNewFreelancerOpen(false)}
            >
              Annulla
            </Button>
            <Button
              type="button"
              onClick={handleAddFreelancer}
              disabled={!newFreelancerName.trim()}
            >
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}