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
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    observation: z.string().optional(),
    extraCostDescription: z.string().optional(),
    extraCostAmount: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Validação dos horários (apenas no modo "Servizio Ore")
    if (data.startTime && data.endTime && data.endTime <= data.startTime) {
      ctx.addIssue({
        path: ["endTime"],
        message: "L'ora di fine deve essere successiva all'ora di inizio",
        code: z.ZodIssueCode.custom,
      })
    }

    // Se informado um valor extra > 0, a descrição é obrigatória
    const amount = data.extraCostAmount ? parseFloat(data.extraCostAmount) : 0
    if (amount > 0 && !data.extraCostDescription?.trim()) {
      ctx.addIssue({
        path: ["extraCostDescription"],
        message: "Inserisci una descrizione per il costo extra",
        code: z.ZodIssueCode.custom,
      })
    }

    // Se informada uma descrição, o importo é obrigatório e deve ser > 0
    if (data.extraCostDescription?.trim() && amount <= 0) {
      ctx.addIssue({
        path: ["extraCostAmount"],
        message: "Inserisci un importo valido",
        code: z.ZodIssueCode.custom,
      })
    }
  })

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

type EntryMode = "hours" | "extra"

export function InsertionForm() {
  const supabase = useMemo(() => createClient(), [])

  const [entryMode, setEntryMode] = useState<EntryMode>("hours")

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
      extraCostDescription: "",
      extraCostAmount: "",
    },
  })

  const startTime = form.watch("startTime") ?? ""
  const endTime = form.watch("endTime") ?? ""
  const duration = calculateDuration(startTime, endTime)

  useEffect(() => {
    const loadData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const [clientsRes, employeesRes, freelancersRes] = await Promise.all([
        supabase.from("clients").select("*").eq("active", true).order("name"),
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
    // Modo "Solo Costo Extra": grava diretamente em extra_costs sem service_record
    if (entryMode === "extra") {
      const amount = values.extraCostAmount ? parseFloat(values.extraCostAmount) : 0
      if (!values.extraCostDescription?.trim() || amount <= 0) {
        toast.add({
          title: "Errore",
          description: "Inserisci una descrizione e un importo valido per il costo extra",
          type: "error",
        })
        return
      }

      setIsSubmitting(true)

      const { error } = await supabase.from("extra_costs").insert({
        client_id: values.clientId,
        date: values.date,
        description: values.extraCostDescription.trim(),
        amount,
        service_record_id: null,
        created_by: currentUserProfile?.id ?? null,
      })

      if (error) {
        console.error("Errore Supabase Insert (extra_costs):", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        })
        toast.add({
          title: "Errore durante il salvataggio",
          description: error.message || "Si è verificato un errore durante la registrazione.",
          type: "error",
        })
        setIsSubmitting(false)
        return
      }

      toast.add({
        title: "Costo Extra registrato con successo",
        description: `"${values.extraCostDescription.trim()}" è stato aggiunto`,
        type: "success",
      })

      form.reset({
        clientId: "",
        date: todayISO(),
        startTime: "",
        endTime: "",
        observation: "",
        extraCostDescription: "",
        extraCostAmount: "",
      })
      setIsSubmitting(false)
      return
    }

    // Modo "Servizio Ore": valida os horários obrigatórios
    if (!values.startTime || !values.endTime) {
      setParticipantsError("Seleziona l'ora di inizio e di fine")
      return
    }

    if (selectedEmployeeIds.length === 0 && selectedFreelancerIds.length === 0) {
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
        created_by: currentUserProfile?.id ?? null,
      })
      .select()
      .single()

    if (recordError || !record) {
      console.error("Errore Supabase Insert (service_records):", {
        message: recordError?.message,
        details: recordError?.details,
        hint: recordError?.hint,
        code: recordError?.code,
      })
      toast.add({
        title: "Errore durante il salvataggio",
        description: recordError?.message || "Si è verificato un errore durante la registrazione.",
        type: "error",
      })
      setIsSubmitting(false)
      return
    }

    const participants = [
      ...selectedEmployeeIds.map((profileId) => ({
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
      console.error("Errore Supabase Insert (service_participants):", {
        message: participantsInsertError.message,
        details: participantsInsertError.details,
        hint: participantsInsertError.hint,
        code: participantsInsertError.code,
      })
      toast.add({
        title: "Errore durante il salvataggio",
        description: participantsInsertError.message || "Si è verificato un errore durante la registrazione.",
        type: "error",
      })
      setIsSubmitting(false)
      return
    }

    // Se um custo extra foi informado, vincula ao service_record criado
    const extraAmount = values.extraCostAmount ? parseFloat(values.extraCostAmount) : 0
    if (extraAmount > 0 && values.extraCostDescription?.trim()) {
      const { error: extraCostInsertError } = await supabase
        .from("extra_costs")
        .insert({
          client_id: values.clientId,
          date: values.date,
          description: values.extraCostDescription.trim(),
          amount: extraAmount,
          service_record_id: record.id,
          created_by: currentUserProfile?.id ?? null,
        })

      if (extraCostInsertError) {
        console.error("Errore Supabase Insert (extra_costs):", {
          message: extraCostInsertError.message,
          details: extraCostInsertError.details,
          hint: extraCostInsertError.hint,
          code: extraCostInsertError.code,
        })
        toast.add({
          title: "Errore durante il salvataggio",
          description: extraCostInsertError.message || "Il servizio è stato salvato ma il costo extra non è stato registrato.",
          type: "error",
        })
      }
    }

    toast.add({
      title: "Ore registrate con successo",
      description: "Le ore lavorative sono state registrate",
      type: "success",
    })

    form.reset({
      clientId: "",
      date: todayISO(),
      startTime: "",
      endTime: "",
      observation: "",
      extraCostDescription: "",
      extraCostAmount: "",
    })
    // Mantiene l'utente logato preselezionato dopo il reset
    setSelectedEmployeeIds(currentUserProfile ? [currentUserProfile.id] : [])
    setSelectedFreelancerIds([])
    setParticipantsError("")
    setIsSubmitting(false)
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Card className="shadow-md border-border/50 rounded-2xl">
        <CardHeader className="space-y-1 pb-6">
          <CardTitle className="flex items-center gap-2.5 text-xl md:text-2xl">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Clock2 className="h-5 w-5 text-primary" />
            </div>
            Nuovo Inserimento
          </CardTitle>
          <CardDescription>
            {entryMode === "hours"
              ? "Registra le ore lavorative svolte per un cliente"
              : "Registra un costo extra o materiale per un cliente"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-6"
            >
              {/* Modo di inserimento */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tipo di Registrazione</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={entryMode === "hours" ? "secondary" : "outline"}
                    onClick={() => setEntryMode("hours")}
                    className="rounded-xl h-12"
                  >
                    <Clock2 className="h-4 w-4" />
                    Servizio Ore
                  </Button>
                  <Button
                    type="button"
                    variant={entryMode === "extra" ? "secondary" : "outline"}
                    onClick={() => setEntryMode("extra")}
                    className="rounded-xl h-12"
                  >
                    <Plus className="h-4 w-4" />
                    Solo Costo Extra
                  </Button>
                </div>
              </div>

              {/* Cliente */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Cliente</Label>
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
                      className="rounded-lg"
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

              {/* Data */}
              <div className="space-y-2">
                <Label htmlFor="date" className="text-sm font-medium">Data</Label>
                <Input
                  id="date"
                  type="date"
                  {...form.register("date")}
                  className="rounded-lg h-12 text-base"
                />
                {form.formState.errors.date && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.date.message}
                  </p>
                )}
              </div>

              {entryMode === "hours" && (
                <>
                  {/* Orari */}
                  <div className="rounded-xl bg-muted/30 p-4 space-y-4 border border-border/50">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="start-time" className="text-sm font-medium">Ora Inizio</Label>
                        <Input
                          id="start-time"
                          type="time"
                          {...form.register("startTime")}
                          className="rounded-lg h-12 text-base"
                        />
                        {form.formState.errors.startTime && (
                          <p className="text-sm text-destructive">
                            {form.formState.errors.startTime.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="end-time" className="text-sm font-medium">Ora Fine</Label>
                        <Input
                          id="end-time"
                          type="time"
                          {...form.register("endTime")}
                          className="rounded-lg h-12 text-base"
                        />
                        {form.formState.errors.endTime && (
                          <p className="text-sm text-destructive">
                            {form.formState.errors.endTime.message}
                          </p>
                        )}
                      </div>
                    </div>

                    {duration && (
                      <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
                        <Clock2 className="h-4 w-4" />
                        Durata calcolata: {duration}
                      </div>
                    )}
                  </div>

                  {/* Lavoratore Principale */}
                  {currentUserProfile && (
                    <div className="rounded-xl bg-primary/5 p-4 space-y-2 border border-primary/20">
                      <Label className="text-sm font-medium">Lavoratore Principale</Label>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                          <Users className="h-4 w-4 text-primary" />
                        </div>
                        <p className="text-sm font-semibold">
                          {currentUserProfile.full_name ?? "Utente"}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Partecipanti al Servizio */}
                  <div className="rounded-xl bg-muted/30 p-4 space-y-4 border border-border/50">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Partecipanti al Servizio</Label>
                        <p className="text-xs text-muted-foreground">
                          Seleziona colleghi o collaboratori che hanno lavorato insieme
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Dipendenti</Label>
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
                              variant="team"
                              className="gap-1.5 pr-1.5 py-1 rounded-lg text-sm font-normal"
                            >
                              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10">
                                <Users className="h-3 w-3 text-primary" />
                              </div>
                              {emp.label}
                              {currentUserProfile?.role === "admin" || emp.value !== currentUserProfile?.id ? (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveEmployee(emp.value)}
                                  className="ml-0.5 rounded-full p-1.5 h-7 w-7 flex items-center justify-center hover:bg-destructive/20 hover:text-destructive transition-colors"
                                  aria-label={`Rimuovi ${emp.label}`}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Collaboratori Occasionali</Label>
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
                            className="rounded-lg"
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
                              variant="freelancer"
                              className="gap-1.5 pr-1.5 py-1 rounded-lg text-sm font-normal"
                            >
                              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10">
                                <UserPlus className="h-3 w-3 text-primary" />
                              </div>
                              {frl.label}
                              <button
                                type="button"
                                onClick={() => handleRemoveFreelancer(frl.value)}
                                className="ml-0.5 rounded-full p-1.5 h-7 w-7 flex items-center justify-center hover:bg-destructive/20 hover:text-destructive transition-colors"
                                aria-label={`Rimuovi ${frl.label}`}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {participantsError && (
                      <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {participantsError}
                      </div>
                    )}
                  </div>

                  {/* Note */}
                  <div className="space-y-2">
                    <Label htmlFor="observation" className="text-sm font-medium">Note / Ubicazione</Label>
                    <Input
                      id="observation"
                      {...form.register("observation")}
                      placeholder="Es. Casa 1, Pod 2"
                      className="h-auto min-h-[80px] py-2 rounded-lg resize-none"
                    />
                  </div>
                </>
              )}

              {/* Costo Extra / Materiale Opzionale */}
              {entryMode === "hours" && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 p-4 space-y-4 border border-amber-200 dark:border-amber-800/40">
                  <div>
                    <Label className="text-sm font-medium">
                      Aggiungi Costo Extra / Materiale (Opzionale)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Es. Lavaggio Biancheria, materiali extra, ecc.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="extra-cost-description" className="text-sm font-medium">
                      Descrizione Costo
                    </Label>
                    <Input
                      id="extra-cost-description"
                      type="text"
                      {...form.register("extraCostDescription")}
                      placeholder="Es. Lavaggio Biancheria"
                      className="rounded-lg h-12"
                    />
                    {form.formState.errors.extraCostDescription && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.extraCostDescription.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="extra-cost-amount" className="text-sm font-medium">
                      Importo (€)
                    </Label>
                    <Input
                      id="extra-cost-amount"
                      type="number"
                      step="0.01"
                      min="0"
                      {...form.register("extraCostAmount")}
                      placeholder="Es. 25.00"
                      className="rounded-lg h-12"
                    />
                    {form.formState.errors.extraCostAmount && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.extraCostAmount.message}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {entryMode === "extra" && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 p-4 space-y-4 border border-amber-200 dark:border-amber-800/40">
                  <div>
                    <Label className="text-sm font-medium">Costo Extra / Materiale</Label>
                    <p className="text-xs text-muted-foreground">
                      Registra un costo extra o materiale senza ore lavorative
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="extra-cost-desc-standalone" className="text-sm font-medium">
                      Descrizione Costo
                    </Label>
                    <Input
                      id="extra-cost-desc-standalone"
                      type="text"
                      {...form.register("extraCostDescription")}
                      placeholder="Es. Lavaggio Biancheria"
                      className="rounded-lg h-12"
                    />
                    {form.formState.errors.extraCostDescription && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.extraCostDescription.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="extra-cost-amount-standalone" className="text-sm font-medium">
                      Importo (€)
                    </Label>
                    <Input
                      id="extra-cost-amount-standalone"
                      type="number"
                      step="0.01"
                      min="0"
                      {...form.register("extraCostAmount")}
                      placeholder="Es. 25.00"
                      className="rounded-lg h-12"
                    />
                    {form.formState.errors.extraCostAmount && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.extraCostAmount.message}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full rounded-xl h-14 text-lg font-bold shadow-md transition-all duration-150 hover:shadow-lg"
                size="lg"
                disabled={isSubmitting}
              >
                <Save className="h-5 w-5" />
                {isSubmitting
                  ? "Salvataggio..."
                  : entryMode === "extra"
                    ? "Registra Solo Costo Extra"
                    : "Registra Ore"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Dialog Nuovo Cliente */}
      <Dialog open={isNewClientOpen} onOpenChange={setIsNewClientOpen}>
        <DialogContent className="w-[95vw] max-w-lg">
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
          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsNewClientOpen(false)}
              className="w-full sm:w-auto min-h-[44px]"
            >
              Annulla
            </Button>
            <Button
              type="button"
              onClick={handleAddClient}
              disabled={!newClientName.trim()}
              className="w-full sm:w-auto min-h-[44px]"
            >
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Nuovo Collaboratore */}
      <Dialog open={isNewFreelancerOpen} onOpenChange={setIsNewFreelancerOpen}>
        <DialogContent className="w-[95vw] max-w-lg">
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
          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsNewFreelancerOpen(false)}
              className="w-full sm:w-auto min-h-[44px]"
            >
              Annulla
            </Button>
            <Button
              type="button"
              onClick={handleAddFreelancer}
              disabled={!newFreelancerName.trim()}
              className="w-full sm:w-auto min-h-[44px]"
            >
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}