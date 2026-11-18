"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Clock, LogIn } from "lucide-react"

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

export function LoginForm() {
  const router = useRouter()

  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Login feito no servidor: o e-mail do usuário nunca chega ao navegador
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      })

      if (!res.ok) {
        toast.add({
          title: "Credenziali non valide. Riprova.",
          type: "error",
        })
        setIsLoading(false)
        return
      }

      // Todos os usuários desembarcam na página inicial de lançamento de horas
      router.push("/")
      router.refresh()
    } catch {
      toast.add({
        title: "Errore di connessione. Riprova.",
        type: "error",
      })
    }

    setIsLoading(false)
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex items-center justify-center">
            <Clock className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-xl">Accedi a Gestione Ore</CardTitle>
          <CardDescription>
            Inserisci le tue credenziali per accedere
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">Email o Nome Utente</Label>
              <Input
                id="identifier"
                type="text"
                placeholder="mario.rossi@email.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isLoading}
            >
              <LogIn className="h-4 w-4" />
              {isLoading ? "Accesso in corso..." : "Accedi"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}