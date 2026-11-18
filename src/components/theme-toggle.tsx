"use client"

import { useSyncExternalStore } from "react"
import { Monitor, Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type Theme = "dark" | "light" | "system"

const STORAGE_KEY = "theme"
const listeners = new Set<() => void>()

function resolveDark(theme: Theme): boolean {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
  }
  return theme === "dark"
}

function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === "light" || saved === "system" ? saved : "dark"
  } catch {
    return "dark"
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback)
  window.addEventListener("storage", callback)
  return () => {
    listeners.delete(callback)
    window.removeEventListener("storage", callback)
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", resolveDark(theme))
}

function setTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Sem armazenamento disponível: o tema vale só nesta sessão
  }
  applyTheme(theme)
  listeners.forEach((listener) => listener())
}

const OPTIONS: { value: Theme; label: string; icon: typeof Moon }[] = [
  { value: "dark", label: "Scuro", icon: Moon },
  { value: "light", label: "Chiaro", icon: Sun },
  { value: "system", label: "Sistema", icon: Monitor },
]

export function ThemeToggle() {
  // No servidor usa "dark" (padrão); no navegador lê a escolha salva, sem erro de hidratação
  const theme = useSyncExternalStore(subscribe, readTheme, () => "dark" as Theme)

  return (
    <div role="group" aria-label="Aspetto" className="grid grid-cols-3 gap-2">
      {OPTIONS.map((option) => {
        const Icon = option.icon
        const active = theme === option.value
        return (
          <Button
            key={option.value}
            type="button"
            variant={active ? "default" : "outline"}
            aria-pressed={active}
            onClick={() => setTheme(option.value)}
            className={cn("h-12 rounded-xl", active && "shadow-md")}
          >
            <Icon className="h-4 w-4" />
            {option.label}
          </Button>
        )
      })}
    </div>
  )
}
