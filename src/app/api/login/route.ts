import { createClient as createAdminClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

import { createClient as createServerClient } from "@/lib/supabase/server"

// Escapa curingas do LIKE/ILIKE para que a busca seja exata
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}

const INVALID = { message: "Credenziali non valide. Riprova." }

export async function POST(request: Request) {
  let body: { identifier?: unknown; password?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(INVALID, { status: 400 })
  }

  const identifier = typeof body.identifier === "string" ? body.identifier.trim() : ""
  const password = typeof body.password === "string" ? body.password : ""

  if (!identifier || !password) {
    return NextResponse.json(INVALID, { status: 400 })
  }

  // Resolve o e-mail somente no servidor. Nunca devolvido ao navegador.
  let email: string | null = identifier.includes("@") ? identifier : null

  if (!email) {
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
    const pattern = escapeLike(identifier)

    const { data: byUsername } = await admin
      .from("profiles")
      .select("id")
      .ilike("username", pattern)
      .limit(2)

    const candidates =
      byUsername && byUsername.length > 0
        ? byUsername
        : (
            await admin
              .from("profiles")
              .select("id")
              .ilike("full_name", pattern)
              .limit(2)
          ).data ?? []

    // Nome ambíguo (dois perfis) não é resolvido: falha genérica
    if (candidates.length !== 1) {
      return NextResponse.json(INVALID, { status: 401 })
    }

    const { data: userData } = await admin.auth.admin.getUserById(candidates[0].id)
    email = userData?.user?.email ?? null
    if (!email) {
      return NextResponse.json(INVALID, { status: 401 })
    }
  }

  // Login com o cliente de servidor: grava os cookies de sessão
  const supabase = await createServerClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    return NextResponse.json(INVALID, { status: 401 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
