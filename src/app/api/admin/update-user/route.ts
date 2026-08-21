import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const { userId, email, password, fullName, username, role, isActive } = await request.json()

  if (!userId) {
    return NextResponse.json(
      { message: "ID utente mancante" },
      { status: 400 }
    )
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // Update auth user
    const updateData: Record<string, unknown> = {
      user_metadata: { full_name: fullName, username, role },
    }
    if (email) updateData.email = email
    if (password) updateData.password = password

    const { error: authError } = await supabase.auth.admin.updateUserById(
      userId,
      updateData
    )

    if (authError) {
      return NextResponse.json(
        { message: authError.message },
        { status: 400 }
      )
    }

    // Update profile in public.profiles
    const profileUpdate: Record<string, unknown> = {
      full_name: fullName,
      role,
    }
    if (username !== undefined) profileUpdate.username = username

    const { error: profileError } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("id", userId)

    if (profileError) {
      return NextResponse.json(
        { message: profileError.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { message: "Utente aggiornato con successo" },
      { status: 200 }
    )
  } catch {
    return NextResponse.json(
      { message: "Errore durante l'aggiornamento dell'utente" },
      { status: 500 }
    )
  }
}