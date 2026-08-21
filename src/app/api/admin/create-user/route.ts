import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const { email, password, fullName, username, role } = await request.json()

  if (!email || !password || !fullName || !role) {
    return NextResponse.json(
      { message: "Campi obbligatori mancanti" },
      { status: 400 }
    )
  }

  if (!["admin", "employee"].includes(role)) {
    return NextResponse.json(
      { message: "Ruolo non valido" },
      { status: 400 }
    )
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const { data: userData, error: createError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          username,
          role,
        },
      })

    if (createError) {
      return NextResponse.json(
        { message: createError.message },
        { status: 400 }
      )
    }

    // Update profile with email and other fields
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        username: username || null,
        email,
        role,
        is_active: true,
      })
      .eq("id", userData.user!.id)

    if (profileError) {
      return NextResponse.json(
        { message: profileError.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { user: userData.user, message: "Utente creato con successo" },
      { status: 201 }
    )
  } catch {
    return NextResponse.json(
      { message: "Errore durante la creazione dell'utente" },
      { status: 500 }
    )
  }
}