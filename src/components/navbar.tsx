"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Clock, LogOut, Menu, User, X } from "lucide-react"

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
  { href: "/profilo", label: "Profilo" },
]

const publicRoute = "/login"

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [userName, setUserName] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

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
      setIsLoading(false)
    }
    loadUser()
  }, [])

  // Enquanto carrega, não mostrar links admin
  const filteredLinks = isLoading
    ? navLinks.filter((l) => l.href !== "/gestione" && l.href !== "/admin")
    : isAdmin
      ? navLinks
      : navLinks.filter(
          (l) =>
            l.href !== "/gestione" &&
            l.href !== "/admin"
        )

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  // Não mostrar navbar na página de login
  if (pathname === publicRoute) return null

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        {/* Logo / Titolo */}
        <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Clock className="h-5 w-5 text-primary" />
          </div>
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
                }),
                "min-h-[44px] rounded-lg px-4 text-sm font-medium transition-all duration-150",
                pathname === link.href && "shadow-sm"
              )}
            >
              {link.label}
            </Link>
          ))}
          {userName && (
            <span className="mx-2 px-2 py-1 text-sm text-muted-foreground rounded-md bg-muted/50">
              {userName}
            </span>
          )}
          <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Esci" className="rounded-lg min-h-[44px] min-w-[44px]">
            <LogOut className="h-4 w-4" />
          </Button>
        </nav>

        {/* Pulsante menu mobile */}
        <button
          type="button"
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "md:hidden rounded-lg min-h-[44px] min-w-[44px]"
          )}
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Chiudi menu" : "Apri menu"}
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Menu mobile */}
      {isOpen && (
        <nav className="animate-slide-in-top border-t border-border/40 bg-background/95 backdrop-blur-xl px-4 py-3 md:hidden">
          <div className="space-y-1">
            {filteredLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  buttonVariants({
                    variant: pathname === link.href ? "secondary" : "ghost",
                  }),
                  "w-full justify-start min-h-[44px] rounded-lg text-sm font-medium"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
          {userName && (
            <div className="mt-3 border-t border-border/40 pt-3">
              <p className="px-3 py-2 text-sm text-muted-foreground rounded-md bg-muted/50">
                {userName}
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            className="mt-2 w-full justify-start min-h-[44px] rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
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