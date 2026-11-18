"use client"

import { useEffect, useState } from "react"
import { Mail, ShieldCheck, User as UserIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { initialsOf } from "@/lib/initials"
import { cn } from "@/lib/utils"

type Info = { name: string; role: string; email: string }

export function ProfileHeader() {
  const [info, setInfo] = useState<Info | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .single()
      setInfo({
        name: profile?.full_name ?? user.email ?? "Utente",
        role: (profile?.role ?? "employee").toLowerCase(),
        email: user.email ?? "",
      })
    }
    load()
  }, [])

  if (!info) {
    return (
      <Card className="rounded-2xl border-border/60">
        <CardContent className="flex items-center gap-4 py-6">
          <div className="h-14 w-14 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    )
  }

  const isAdmin = info.role === "admin"

  return (
    <Card className="rounded-2xl border-border/60 bg-card/80 shadow-none">
      <CardContent className="flex items-center gap-4 py-6">
        <div
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold",
            isAdmin
              ? "bg-violet-500/20 text-violet-700 dark:text-violet-200 ring-2 ring-violet-400/60"
              : "bg-primary/15 text-primary ring-1 ring-border"
          )}
          aria-hidden="true"
        >
          {initialsOf(info.name)}
        </div>
        <div className="min-w-0 space-y-1">
          <p className="truncate text-lg font-semibold tracking-tight">{info.name}</p>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {isAdmin ? <ShieldCheck className="h-3.5 w-3.5 shrink-0" /> : <UserIcon className="h-3.5 w-3.5 shrink-0" />}
            {isAdmin ? "Amministratore" : "Dipendente"}
          </p>
          {info.email && (
            <p className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{info.email}</span>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
