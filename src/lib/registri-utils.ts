// Utility helpers for consolidating duplicate time-log entries across the app.
// Shared by the insertion form (auto-merge), the registry list and the reports.

/**
 * Join distinct observation/note strings using " | " as separator.
 * Empty, "null" and duplicate values are skipped.
 */
export function mergeObservations(
  observations: Array<string | null | undefined>
): string | null {
  const seen = new Set<string>()
  const parts: string[] = []
  for (const obs of observations) {
    const trimmed = (obs ?? "").trim()
    if (!trimmed || trimmed === "-") continue
    if (seen.has(trimmed)) continue
    seen.add(trimmed)
    parts.push(trimmed)
  }
  return parts.length > 0 ? parts.join(" | ") : null
}

/**
 * Merge unique participant names across records, preserving insertion order.
 */
export function mergeParticipants(groups: string[][]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const group of groups) {
    for (const name of group) {
      const trimmed = (name ?? "").trim()
      if (!trimmed || seen.has(trimmed)) continue
      seen.add(trimmed)
      result.push(trimmed)
    }
  }
  return result
}

/**
 * Compute a slot duration in hours from start/end times.
 * Handles "HH:MM:SS" values coming from the DB by ignoring seconds.
 */
export function toDurationHours(start: string, end: string): number {
  const toMinutes = (t: string): number => {
    const [h, m] = t.slice(0, 5).split(":").map(Number)
    return (h ?? 0) * 60 + (m ?? 0)
  }
  const diffMinutes = toMinutes(end) - toMinutes(start)
  return diffMinutes > 0 ? diffMinutes / 60 : 0
}

/** Minimum shape a record must expose to be grouped as (potentially) duplicate. */
export type GroupableRecord = {
  client_id: string
  date: string
  start_time: string
  end_time: string
  observation?: string | null
  participants?: string[]
}

/** One consolidated entry produced by {@link groupDuplicateEntries}. */
export type GroupedEntry = {
  client_id: string
  date: string
  start_time: string
  end_time: string
  durationHours: number
  observation: string | null
  participants: string[]
}

/**
 * Aggregate legacy duplicate DB entries by client_id + date + start_time + end_time.
 * - Merges unique team member tags.
 * - Deduplicates and joins notes with " | ".
 * - Computes the slot duration once, preventing inflated client hours.
 */
export function groupDuplicateEntries<T extends GroupableRecord>(
  records: T[]
): GroupedEntry[] {
  const groups = new Map<
    string,
    {
      client_id: string
      date: string
      start_time: string
      end_time: string
      observations: Array<string | null | undefined>
      participants: string[]
    }
  >()

  for (const r of records) {
    const key = `${r.client_id}|${r.date}|${r.start_time}|${r.end_time}`
    const existing = groups.get(key)
    if (existing) {
      existing.observations.push(r.observation)
      existing.participants = mergeParticipants([
        existing.participants,
        r.participants ?? [],
      ])
    } else {
      groups.set(key, {
        client_id: r.client_id,
        date: r.date,
        start_time: r.start_time,
        end_time: r.end_time,
        observations: [r.observation],
        participants: mergeParticipants([r.participants ?? []]),
      })
    }
  }

  return Array.from(groups.values()).map((g) => ({
    client_id: g.client_id,
    date: g.date,
    start_time: g.start_time,
    end_time: g.end_time,
    durationHours: toDurationHours(g.start_time, g.end_time),
    observation: mergeObservations(g.observations),
    participants: g.participants,
  }))
}