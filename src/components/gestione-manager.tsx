"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Building2,
  Pencil,
  Plus,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  Users,
} from "lucide-react"

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
import { toast } from "@/components/ui/toast"

type Client = Database["public"]["Tables"]["clients"]["Row"]
type Freelancer = Database["public"]["Tables"]["freelancers"]["Row"]
type Profile = Database["public"]["Tables"]["profiles"]["Row"]

type EntityKind = "client" | "freelancer"

interface EntityDialogState {
  open: boolean
  mode: "create" | "edit"
  kind: EntityKind
  name: string
  notes: string
  editId: string | null
}

type DeleteTarget =
  | { kind: "client"; id: string; name: string }
  | { kind: "freelancer"; id: string; name: string }
  | null

interface EmployeeDialogState {
  open: boolean
  mode: "create" | "edit"
  editId: string | null
  fullName: string
  username: string
  email: string
  password: string
  role: "employee" | "admin"
  isActive: boolean
}

const initialEntityDialog: EntityDialogState = {
  open: false,
  mode: "create",
  kind: "client",
  name: "",
  notes: "",
  editId: null,
}

const initialEmployeeDialog: EmployeeDialogState = {
  open: false,
  mode: "create",
  editId: null,
  fullName: "",
  username: "",
  email: "",
  password: "",
  role: "employee",
  isActive: true,
}

export function GestioneManager() {
  const supabase = useMemo(() => createClient(), [])

  const [clients, setClients] = useState<Client[]>([])
  const [freelancers, setFreelancers] = useState<Freelancer[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])

  const [entityDialog, setEntityDialog] = useState<EntityDialogState>(initialEntityDialog)
  const [employeeDialog, setEmployeeDialog] = useState<EmployeeDialogState>(initialEmployeeDialog)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isToggling, setIsToggling] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      const [clientsRes, freelancersRes, profilesRes] = await Promise.all([
        supabase.from("clients").select("*").order("name"),
        supabase.from("freelancers").select("*").order("name"),
        supabase.from("profiles").select("*").order("full_name"),
      ])
      if (cancelled) return
      if (clientsRes.data) setClients(clientsRes.data)
      if (freelancersRes.data) setFreelancers(freelancersRes.data)
      if (profilesRes.data) setProfiles(profilesRes.data)
    }
    loadData()
    return () => { cancelled = true }
  }, [supabase])

  // ── Entity (Client / Freelancer) ──

  function openCreateEntity(kind: EntityKind) {
    setEntityDialog({ ...initialEntityDialog, open: true, kind })
  }

  function openEditEntity(kind: EntityKind, item: Client | Freelancer) {
    setEntityDialog({
      open: true,
      mode: "edit",
      kind,
      name: item.name,
      notes: "",
      editId: item.id,
    })
  }

  async function handleSaveEntity() {
    const name = entityDialog.name.trim()
    if (!name) return

    setIsSaving(true)

    if (entityDialog.mode === "create") {
      const table = entityDialog.kind === "client" ? "clients" : "freelancers"
      const { data, error } = await supabase
        .from(table)
        .insert({ name })
        .select()
        .single()

      if (error) {
        toast.add({ title: "Errore", description: `Errore durante la creazione`, type: "error" })
      } else if (entityDialog.kind === "client") {
        setClients((prev) => [...prev, data as Client])
        toast.add({ title: "Cliente creato con successo!", type: "success" })
        setEntityDialog((p) => ({ ...p, open: false }))
      } else {
        setFreelancers((prev) => [...prev, data as Freelancer])
        toast.add({ title: "Collaboratore creato con successo!", type: "success" })
        setEntityDialog((p) => ({ ...p, open: false }))
      }
    } else {
      const table = entityDialog.kind === "client" ? "clients" : "freelancers"
      const { error } = await supabase
        .from(table)
        .update({ name })
        .eq("id", entityDialog.editId!)

      if (error) {
        toast.add({ title: "Errore", description: `Errore durante l'aggiornamento`, type: "error" })
      } else if (entityDialog.kind === "client") {
        setClients((prev) => prev.map((c) => c.id === entityDialog.editId ? { ...c, name } : c))
        toast.add({ title: "Cliente aggiornato con successo!", type: "success" })
        setEntityDialog((p) => ({ ...p, open: false }))
      } else {
        setFreelancers((prev) => prev.map((f) => f.id === entityDialog.editId ? { ...f, name } : f))
        toast.add({ title: "Collaboratore aggiornato con successo!", type: "success" })
        setEntityDialog((p) => ({ ...p, open: false }))
      }
    }

    setIsSaving(false)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setIsDeleting(true)

    const table = deleteTarget.kind === "client" ? "clients" : "freelancers"
    const { error } = await supabase.from(table).delete().eq("id", deleteTarget.id)

    if (error) {
      toast.add({
        title: "Errore",
        description: `Errore durante l'eliminazione. Potrebbe essere collegato a registrazioni.`,
        type: "error",
      })
    } else if (deleteTarget.kind === "client") {
      setClients((prev) => prev.filter((c) => c.id !== deleteTarget.id))
      toast.add({ title: "Cliente eliminato con successo!", type: "success" })
    } else {
      setFreelancers((prev) => prev.filter((f) => f.id !== deleteTarget.id))
      toast.add({ title: "Collaboratore eliminato con successo!", type: "success" })
    }

    setIsDeleting(false)
    setDeleteTarget(null)
  }

  // ── Employees ──

  function openCreateEmployee() {
    setEmployeeDialog({ ...initialEmployeeDialog, open: true })
  }

  function openEditEmployee(profile: Profile) {
    setEmployeeDialog({
      open: true,
      mode: "edit",
      editId: profile.id,
      fullName: profile.full_name ?? "",
      username: profile.username ?? "",
      email: profile.email ?? "",
      password: "",
      role: profile.role,
      isActive: profile.is_active ?? true,
    })
  }

  async function handleSaveEmployee() {
    const d = employeeDialog

    if (!d.fullName.trim()) {
      toast.add({ title: "Errore", description: "Il nome è obbligatorio", type: "error" })
      return
    }

    if (d.mode === "create" && !d.email.trim()) {
      toast.add({ title: "Errore", description: "Nome e email sono obbligatori", type: "error" })
      return
    }

    if (d.mode === "create" && !d.password.trim()) {
      toast.add({ title: "Errore", description: "La password è obbligatoria", type: "error" })
      return
    }

    setIsSaving(true)

    try {
      if (d.mode === "create") {
        const res = await fetch("/api/admin/create-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: d.email.trim(),
            password: d.password,
            fullName: d.fullName.trim(),
            username: d.username.trim() || null,
            role: d.role,
          }),
        })

        if (!res.ok) {
          const data = await res.json()
          toast.add({ title: "Errore", description: data.message || "Errore durante la creazione", type: "error" })
          return
        }

        toast.add({ title: "Dipendente creato con successo!", type: "success" })
      } else {
        // Edit mode
        const res = await fetch("/api/admin/update-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: d.editId,
            email: d.email.trim() || undefined,
            password: d.password || undefined,
            fullName: d.fullName.trim(),
            username: d.username.trim() || null,
            role: d.role,
            isActive: d.isActive,
          }),
        })

        if (!res.ok) {
          const data = await res.json()
          toast.add({ title: "Errore", description: data.message || "Errore durante l'aggiornamento", type: "error" })
          return
        }

        // Update local state
        const emailToUpdate = d.email.trim() || undefined
        setProfiles((prev) =>
          prev.map((p) =>
            p.id === d.editId
              ? {
                  ...p,
                  is_active: d.isActive,
                  ...(emailToUpdate !== undefined ? { email: emailToUpdate } : {}),
                }
              : p
          )
        )

        toast.add({ title: "Dipendente aggiornato con successo!", type: "success" })
      }

      setEmployeeDialog(initialEmployeeDialog)
      const { data: profilesData } = await supabase.from("profiles").select("*").order("full_name")
      if (profilesData) setProfiles(profilesData)
    } catch {
      toast.add({ title: "Errore", description: "Errore di connessione", type: "error" })
    }

    setIsSaving(false)
  }

  async function handleToggleActive(profile: Profile) {
    setIsToggling(profile.id)

    try {
      const res = await fetch("/api/admin/toggle-active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: profile.id,
          isActive: !profile.is_active,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.add({ title: "Errore", description: data.message || "Operazione fallita", type: "error" })
        return
      }

      setProfiles((prev) =>
        prev.map((p) =>
          p.id === profile.id ? { ...p, is_active: !p.is_active } : p
        )
      )

      toast.add({
        title: profile.is_active ? "Utente disattivato" : "Utente riattivato",
        type: "success",
      })
    } catch {
      toast.add({ title: "Errore", description: "Errore di connessione", type: "error" })
    }

    setIsToggling(null)
  }

  // ── Dialog Labels ──

  const entityDialogTitle =
    entityDialog.mode === "create"
      ? entityDialog.kind === "client"
        ? "Nuovo Cliente"
        : "Nuovo Collaboratore"
      : entityDialog.kind === "client"
        ? "Modifica Cliente"
        : "Modifica Collaboratore"

  const employeeDialogTitle =
    employeeDialog.mode === "create" ? "Nuovo Dipendente" : "Modifica Dipendente"

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Area Admin</h1>
        <p className="text-muted-foreground">
          Gestisci utenti, clienti e collaboratori del sistema
        </p>
      </div>

      <Tabs defaultValue="employees">
        <TabsList className="w-full md:w-auto rounded-xl p-1 bg-muted/50">
          <TabsTrigger value="employees" className="flex-1 md:flex-none">
            <Users className="h-4 w-4" />
            Gestione Utenti
          </TabsTrigger>
          <TabsTrigger value="clients" className="flex-1 md:flex-none">
            <Building2 className="h-4 w-4" />
            Gestione Clienti
          </TabsTrigger>
          <TabsTrigger value="freelancers" className="flex-1 md:flex-none">
            <UserPlus className="h-4 w-4" />
            Collaboratori Esterni
          </TabsTrigger>
        </TabsList>

        {/* 👥 Gestione Utenti */}
        <TabsContent value="employees" className="space-y-4">
          <Card className="shadow-md border-border/50 rounded-2xl overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Gestione Utenti</CardTitle>
                <CardDescription>
                  Elenco degli utenti del sistema
                </CardDescription>
              </div>
              <Button onClick={openCreateEmployee}>
                <Plus className="h-4 w-4" />
                Nuovo Utente
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Ruolo</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead className="w-[140px] text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        Nessun utente registrato.
                      </TableCell>
                    </TableRow>
                  ) : (
                    profiles.map((profile) => (
                      <TableRow key={profile.id}>
                        <TableCell className="font-medium">
                          {profile.full_name || "Senza nome"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {profile.email || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={profile.role === "admin" ? "admin" : "employee"}>
                            {profile.role === "admin" ? "Admin" : "Dipendente"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={(profile.is_active ?? true) ? "success" : "error"} className="gap-1">
                            {(profile.is_active ?? true) ? (
                              <><UserCheck className="h-3 w-3" /> Attivo</>
                            ) : (
                              <><UserX className="h-3 w-3" /> Inattivo</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditEmployee(profile)}
                              aria-label={`Modifica ${profile.full_name || "utente"}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleActive(profile)}
                              disabled={isToggling === profile.id}
                              aria-label={(profile.is_active ?? true) ? "Disattiva" : "Attiva"}
                            >
                              {(profile.is_active ?? true) ? (
                                <UserX className="h-4 w-4 text-destructive" />
                              ) : (
                                <UserCheck className="h-4 w-4 text-green-600" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 🏢 Gestione Clienti */}
        <TabsContent value="clients" className="space-y-4">
          <Card className="shadow-md border-border/50 rounded-2xl overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Gestione Clienti</CardTitle>
                <CardDescription>
                  Elenco dei clienti registrati
                </CardDescription>
              </div>
              <Button onClick={() => openCreateEntity("client")}>
                <Plus className="h-4 w-4" />
                Nuovo Cliente
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="w-[120px] text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="py-8 text-center text-muted-foreground">
                        Nessun cliente registrato.
                      </TableCell>
                    </TableRow>
                  ) : (
                    clients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditEntity("client", client)}
                              aria-label={`Modifica ${client.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() =>
                                setDeleteTarget({ kind: "client", id: client.id, name: client.name })
                              }
                              aria-label={`Elimina ${client.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 👤 Collaboratori Esterni */}
        <TabsContent value="freelancers" className="space-y-4">
          <Card className="shadow-md border-border/50 rounded-2xl overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Collaboratori Esterni</CardTitle>
                <CardDescription>
                  Elenco dei collaboratori avulsi senza account di accesso
                </CardDescription>
              </div>
              <Button onClick={() => openCreateEntity("freelancer")}>
                <Plus className="h-4 w-4" />
                Aggiungi Collaboratore
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="w-[120px] text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {freelancers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="py-8 text-center text-muted-foreground">
                        Nessun collaboratore registrato.
                      </TableCell>
                    </TableRow>
                  ) : (
                    freelancers.map((freelancer) => (
                      <TableRow key={freelancer.id}>
                        <TableCell className="font-medium">{freelancer.name}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditEntity("freelancer", freelancer)}
                              aria-label={`Modifica ${freelancer.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() =>
                                setDeleteTarget({ kind: "freelancer", id: freelancer.id, name: freelancer.name })
                              }
                              aria-label={`Elimina ${freelancer.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 🟦 Dialog Cliente / Collaboratore */}
      <Dialog open={entityDialog.open} onOpenChange={(o) => setEntityDialog((p) => ({ ...p, open: o }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{entityDialogTitle}</DialogTitle>
            <DialogDescription>
              {entityDialog.mode === "create"
                ? `Inserisci i dati del nuovo ${entityDialog.kind === "client" ? "cliente" : "collaboratore"}`
                : `Modifica i dati del ${entityDialog.kind === "client" ? "cliente" : "collaboratore"}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="entity-name">Nome</Label>
            <Input
              id="entity-name"
              value={entityDialog.name}
              onChange={(e) => setEntityDialog((p) => ({ ...p, name: e.target.value }))}
              placeholder="Inserisci il nome"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntityDialog((p) => ({ ...p, open: false }))}>
              Annulla
            </Button>
            <Button onClick={handleSaveEntity} disabled={!entityDialog.name.trim() || isSaving}>
              {isSaving ? "Salvataggio..." : "Salva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 🟦 Dialog Dipendente (Create / Edit) */}
      <Dialog
        open={employeeDialog.open}
        onOpenChange={(o) => !o && setEmployeeDialog(initialEmployeeDialog)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{employeeDialogTitle}</DialogTitle>
            <DialogDescription>
              {employeeDialog.mode === "create"
                ? "Inserisci i dati del nuovo utente"
                : "Modifica i dati dell'utente"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="emp-full-name">Nome e Cognome</Label>
              <Input
                id="emp-full-name"
                value={employeeDialog.fullName}
                onChange={(e) => setEmployeeDialog((p) => ({ ...p, fullName: e.target.value }))}
                placeholder="Mario Rossi"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-username">Nome Utente</Label>
              <Input
                id="emp-username"
                value={employeeDialog.username}
                onChange={(e) => setEmployeeDialog((p) => ({ ...p, username: e.target.value }))}
                placeholder="mario.rossi"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-email">Email</Label>
              <Input
                id="emp-email"
                type="email"
                value={employeeDialog.email}
                onChange={(e) => setEmployeeDialog((p) => ({ ...p, email: e.target.value }))}
                placeholder="mario.rossi@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-password">
                Password {employeeDialog.mode === "edit" && <span className="text-muted-foreground text-xs">(lascia vuoto per non cambiare)</span>}
              </Label>
              <Input
                id="emp-password"
                type="password"
                value={employeeDialog.password}
                onChange={(e) => setEmployeeDialog((p) => ({ ...p, password: e.target.value }))}
                placeholder={employeeDialog.mode === "create" ? "••••••••" : "Nuova password (opzionale)"}
              />
            </div>
            <div className="space-y-2">
              <Label>Ruolo</Label>
              <Select
                value={employeeDialog.role}
                onValueChange={(value) =>
                  setEmployeeDialog((p) => ({ ...p, role: (value ?? "employee") as "employee" | "admin" }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Dipendente</SelectItem>
                  <SelectItem value="admin">Amministratore</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Stato</Label>
              <Select
                value={employeeDialog.isActive ? "true" : "false"}
                onValueChange={(value) =>
                  setEmployeeDialog((p) => ({ ...p, isActive: value === "true" }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Attivo</SelectItem>
                  <SelectItem value="false">Inattivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmployeeDialog(initialEmployeeDialog)}>
              Annulla
            </Button>
            <Button
              onClick={handleSaveEmployee}
              disabled={
                !employeeDialog.fullName.trim() ||
                (employeeDialog.mode === "create" && !employeeDialog.email.trim()) ||
                isSaving
              }
            >
              {isSaving ? "Salvataggio..." : "Salva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 🟥 AlertDialog conferma eliminazione */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              {`Sei sicuro di voler eliminare "${deleteTarget?.name ?? ""}"? L'azione non può essere annullata.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Eliminazione..." : "Elimina"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}