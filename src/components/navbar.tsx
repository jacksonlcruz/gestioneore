"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Calculator, Clock, FileText, LayoutDashboard, LogOut, Menu, Settings, User, Users, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

const navLinks = [
  { href: "/", label: "Nuovo Inserimento", icon: LayoutDashboard },
  { href: "/registro", label: "Registro", icon: FileText },
  { href: "/report", label: "Report", icon: Clock },
  { href: "/calcolo-rapido", label: "Calcolo Rapido", icon: Calculator },
  { href: "/gestione", label: "Gestione", icon: Settings },
  { href: "/admin", label: "Area Admin", icon: Users },
  { href: "/profilo", label: "Profilo", icon: User },
]

const publicRoute = "/login"

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [userName, setUserName] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
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
          setUserRole(profile.role)
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
            <span className="mx-2 flex items-center gap-1.5 px-2 py-1 text-sm text-muted-foreground rounded-md bg-muted/50">
              {userName}
              {userRole && (
                <span className={`inline-flex h-4 items-center rounded-full px-1.5 text-[10px] font-semibold uppercase tracking-wide ${
                  userRole === "admin"
                    ? "bg-purple-100 text-purple-800"
                    : "bg-slate-100 text-slate-700"
                }`}>
                  {userRole === "admin" ? "Admin" : "Dip."}
                </span>
              )}
            </span>
          )}
          <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Esci" className="rounded-lg min-h-[44px] min-w-[44px]">
            <LogOut className="h-4 w-4" />
          </Button>
        </nav>

        {/* Pulsante menu mobile */}
        <div className="flex items-center gap-1.5 md:hidden">
          {userName && (
            <span className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground rounded-md bg-muted/50 max-w-[120px]">
              <span className="truncate">{userName}</span>
              {userRole && (
                <span className={`inline-flex h-4 shrink-0 items-center rounded-full px-1.5 text-[9px] font-semibold uppercase tracking-wide ${
                  userRole === "admin"
                    ? "bg-purple-100 text-purple-800"
                    : "bg-slate-100 text-slate-700"
                }`}>
                  {userRole === "admin" ? "A" : "D"}
                </span>
              )}
            </span>
          )}
          <button
            type="button"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "rounded-lg min-h-[44px] min-w-[44px]"
            )}
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? "Chiudi menu" : "Apri menu"}
            aria-expanded={isOpen}
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Menu mobile */}
      {isOpen && (
        <nav className="animate-slide-in-top border-t border-border/40 bg-background/95 backdrop-blur-xl px-4 py-4 md:hidden max-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="space-y-1.5">
            {filteredLinks.map((link) => {
              const Icon = link.icon
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    buttonVariants({
                      variant: isActive ? "secondary" : "ghost",
                    }),
                    "w-full justify-start min-h-[48px] rounded-xl text-base font-medium px-4 gap-3",
                    isActive && "shadow-sm"
                  )}
                >
                  <Icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-muted-foreground")} />
                  {link.label}
                </Link>
              )
            })}
          </div>
          <div className="mt-3 border-t border-border/40 pt-3 space-y-1.5">
            <p className="flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground rounded-xl bg-muted/50">
              <User className="h-4 w-4 shrink-0" />
              <span className="truncate">{userName}</span>
              {userRole && (
                <span className={`inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[10px] font-semibold uppercase tracking-wide ${
                  userRole === "admin"
                    ? "bg-purple-100 text-purple-800"
                    : "bg-slate-100 text-slate-700"
                }`}>
                  {userRole === "admin" ? "Admin" : "Dip."}
                </span>
              )}
            </p>
            <Button
              variant="ghost"
              className="w-full justify-start min-h-[48px] rounded-xl text-base text-destructive hover:text-destructive hover:bg-destructive/10 gap-3 px-4"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5" />
              Esci
            </Button>
          </div>
        </nav>
      )}
    </header>
  )
}
