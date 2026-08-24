"use client"

import { useState } from "react"
import { Calculator, Clock, RotateCcw } from "lucide-react"

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

const DEFAULT_VALUES = {
  oraInizio: "08:00",
  oraFine: "12:00",
  numeroPersone: "1",
  tariffaOraria: "25.00",
}

function parseTime(time: string): number {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value)
}

function formatDecimal(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export default function CalcoloRapidoPage() {
  const [oraInizio, setOraInizio] = useState(DEFAULT_VALUES.oraInizio)
  const [oraFine, setOraFine] = useState(DEFAULT_VALUES.oraFine)
  const [numeroPersone, setNumeroPersone] = useState(DEFAULT_VALUES.numeroPersone)
  const [tariffaOraria, setTariffaOraria] = useState(DEFAULT_VALUES.tariffaOraria)

  const startMinutes = parseTime(oraInizio)
  const endMinutes = parseTime(oraFine)
  const persone = Math.max(1, Number(numeroPersone) || 1)
  const tariffa = Math.max(0, Number(tariffaOraria) || 0)

  let durationMinutes = endMinutes - startMinutes
  let isInvalidInterval = false

  if (durationMinutes === 0) {
    isInvalidInterval = true
  } else if (durationMinutes < 0) {
    // Turno notturno: il fine è il giorno successivo
    durationMinutes += 24 * 60
  }

  const durationHours = durationMinutes / 60
  const oreTotaliPersone = durationHours * persone
  const totalePreventivo = durationHours * persone * tariffa

  function handleReset() {
    setOraInizio(DEFAULT_VALUES.oraInizio)
    setOraFine(DEFAULT_VALUES.oraFine)
    setNumeroPersone(DEFAULT_VALUES.numeroPersone)
    setTariffaOraria(DEFAULT_VALUES.tariffaOraria)
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Calcolo Rapido</h1>
        <p className="text-muted-foreground">
          Simula il valore di un preventivo in tempo reale
        </p>
      </div>

      <Card className="shadow-md border-border/50 rounded-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            Dati del Servizio
          </CardTitle>
          <CardDescription>
            Inserisci orari, numero di persone e tariffa oraria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ora-inizio">Ora Inizio</Label>
              <Input
                id="ora-inizio"
                type="time"
                value={oraInizio}
                onChange={(e) => setOraInizio(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ora-fine">Ora Fine</Label>
              <Input
                id="ora-fine"
                type="time"
                value={oraFine}
                onChange={(e) => setOraFine(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="numero-persone">Numero Persone</Label>
              <Input
                id="numero-persone"
                type="number"
                min={1}
                value={numeroPersone}
                onChange={(e) => setNumeroPersone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tariffa-oraria">Tariffa Oraria a Persona (€/h)</Label>
              <Input
                id="tariffa-oraria"
                type="number"
                step="0.50"
                min={0}
                value={tariffaOraria}
                onChange={(e) => setTariffaOraria(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-md border-border/50 rounded-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Riepilogo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isInvalidInterval ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              Intervallo non valido: l'ora di inizio e l'ora di fine coincidono.
              Imposta un intervallo di durata maggiore di zero.
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-muted/50 p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Durata
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatDuration(durationMinutes)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDecimal(durationHours)} ore
                  </p>
                </div>
                <div className="rounded-xl bg-muted/50 p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Ore Totali Persone
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatDecimal(oreTotaliPersone)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {persone} {persone === 1 ? "persona" : "persone"}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-primary/10 p-6 text-center ring-1 ring-primary/20">
                <p className="text-sm font-medium text-primary uppercase tracking-wide">
                  Totale Preventivo
                </p>
                <p className="mt-2 text-4xl font-bold text-primary md:text-5xl">
                  {formatCurrency(totalePreventivo)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatDuration(durationMinutes)} × {persone}{" "}
                  {persone === 1 ? "persona" : "persone"} ×{" "}
                  {formatCurrency(tariffa)}/h
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          className="rounded-xl"
        >
          <RotateCcw className="h-4 w-4" />
          Azzera
        </Button>
      </div>
    </div>
  )
}