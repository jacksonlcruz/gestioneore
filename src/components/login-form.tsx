"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Clock, LogIn } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
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
      let email = identifier.trim()

      // Se identifier não contiver "@", resolver via API route
      if (!email.includes("@")) {
        const res = await fetch("/api/resolve-identifier", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: email }),
        })

        if (!res.ok) {
          toast.add({
            title: "Credenziali non valide. Riprova.",
            type: "error",
          })
          setIsLoading(false)
          return
        }

        const data = await res.json()
        email = data.email
      }

      const supabase = createClient()

      const { data: signInData, error } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        })

      if (error || !signInData.user) {
        toast.add({
          title: "Credenziali non valide. Riprova.",
          type: "error",
        })
        setIsLoading(false)
        return
      }

      // Buscar o perfil para redirecionar baseado na role
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", signInData.user.id)
        .single()

      if (profile?.role === "admin") {
        router.push("/gestione")
      } else {
        router.push("/")
      }
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