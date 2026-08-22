import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const { currentPassword, newPassword } = await request.json()

  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
    return NextResponse.json(
      { message: "La nuova password deve avere almeno 6 caratteri" },
      { status: 400 }
    )
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component - can be ignored
          }
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { message: "Utente non autenticato" },
      { status: 401 }
    )
  }

  // Verifica la password attuale
  if (currentPassword) {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    })

    if (signInError) {
      return NextResponse.json(
        { message: "Password attuale non corretta" },
        { status: 400 }
      )
    }
  }

  // Aggiorna la password
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (error) {
    return NextResponse.json(
      { message: error.message },
      { status: 400 }
    )
  }

  return NextResponse.json(
    { message: "Password aggiornata con successo" },
    { status: 200 }
  )
}