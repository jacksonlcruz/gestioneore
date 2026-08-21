"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Clock, LogOut, Menu, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

const navLinks = [
  { href: "/", label: "Nuovo Inserimento" },
  { href: "/registro", label: "Registro" },
  { href: "/report", label: "Report" },
  { href: "/gestione", label: "Gestione" },
  { href: "/admin", label: "Area Admin" },
]

const publicRoute = "/login"

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [userName, setUserName] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const loadUser = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", user.id)
          .single()
        if (profile) {
          setUserName(profile.full_name ?? user.email ?? null)
          setIsAdmin(profile.role === "admin")
        }
      }
    }
    loadUser()
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  const filteredLinks = isAdmin
    ? navLinks
    : navLinks.filter(
        (l) =>
          l.href !== "/gestione" &&
          l.href !== "/admin"
      )

  // Não mostrar navbar na página de login
  if (pathname === publicRoute) return null

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        {/* Logo / Titolo */}
        <Link href="/" className="flex items-center gap-2">
          <Clock className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold tracking-tight">
            Gestione Ore
          </span>
        </Link>

        {/* Navigazione desktop */}
        <nav className="hidden items-center gap-1 md:flex">
          {filteredLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                buttonVariants({
                  variant: pathname === link.href ? "secondary" : "ghost",
                  size: "sm",
                })
              )}
            >
              {link.label}
            </Link>
          ))}
          {userName && (
            <span className="mx-2 text-sm text-muted-foreground">
              {userName}
            </span>
          )}
          <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Esci">
            <LogOut className="h-4 w-4" />
          </Button>
        </nav>

        {/* Pulsante menu mobile */}
        <button
          type="button"
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "md:hidden"
          )}
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Chiudi menu" : "Apri menu"}
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Menu mobile */}
      {isOpen && (
        <nav className="border-t bg-background px-4 py-2 md:hidden">
          {filteredLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className={cn(
                buttonVariants({
                  variant: pathname === link.href ? "secondary" : "ghost",
                }),
                "w-full justify-start"
              )}
            >
              {link.label}
            </Link>
          ))}
          {userName && (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              {userName}
            </p>
          )}
          <Button
            variant="ghost"
            className="w-full justify-start text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Esci
          </Button>
        </nav>
      )}
    </header>
  )
}