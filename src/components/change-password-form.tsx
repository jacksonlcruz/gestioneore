"use client"

import { useState } from "react"
import { KeyRound, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { toast } from "@/components/ui/toast"

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (newPassword.length < 6) {
      toast.add({
        title: "Errore",
        description: "La nuova password deve avere almeno 6 caratteri",
        type: "error",
      })
      return
    }

    if (newPassword !== confirmPassword) {
      toast.add({
        title: "Errore",
        description: "Le password non coincidono",
        type: "error",
      })
      return
    }

    setIsSaving(true)

    try {
      const res = await fetch("/api/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.add({
          title: "Errore",
          description: data.message || "Errore durante il cambio password",
          type: "error",
        })
        return
      }

      toast.add({
        title: "Password aggiornata con successo!",
        type: "success",
      })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch {
      toast.add({
        title: "Errore",
        description: "Errore di connessione",
        type: "error",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="shadow-md border-border/50 rounded-2xl">
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          Cambia Password
        </CardTitle>
        <CardDescription>
          Aggiorna la tua password di accesso
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Password Attuale</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Nuova Password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimo 6 caratteri"
              required
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Conferma Nuova Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ripeti la nuova password"
              required
              autoComplete="new-password"
            />
          </div>
          <Button
            type="submit"
            disabled={isSaving || !currentPassword || !newPassword || !confirmPassword}
            className="w-full rounded-xl shadow-sm"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvataggio...
              </>
            ) : (
              "Aggiorna Password"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}