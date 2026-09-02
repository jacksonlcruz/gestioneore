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
    // ── Validação de duplicidade (normalizada: trim + lowercase) ──
    const normalizedEmail =
      email && typeof email === "string" && email.trim()
        ? email.trim().toLowerCase()
        : null
    const normalizedUsername =
      username && typeof username === "string" && username.trim()
        ? username.trim().toLowerCase()
        : null

    // Verifica se o email (normalizado) já existe em profiles (excluindo o próprio usuário)
    if (normalizedEmail) {
      const { data: profilesByEmail, error: emailQueryError } = await supabase
        .from("profiles")
        .select("id, email")
        .ilike("email", normalizedEmail)

      if (
        !emailQueryError &&
        profilesByEmail?.some(
          (p) =>
            p.id !== userId &&
            p.email?.trim().toLowerCase() === normalizedEmail
        )
      ) {
        return NextResponse.json(
          { message: "Un utente con questa email o username esiste già." },
          { status: 400 }
        )
      }
    }

    // Verifica se o email (normalizado) já existe em auth.users (excluindo o próprio usuário)
    if (normalizedEmail) {
      const { data: authUsers, error: listUsersError } =
        await supabase.auth.admin.listUsers()

      if (
        !listUsersError &&
        authUsers?.users?.some(
          (u) =>
            u.id !== userId &&
            u.email?.trim().toLowerCase() === normalizedEmail
        )
      ) {
        return NextResponse.json(
          { message: "Un utente con questa email o username esiste già." },
          { status: 400 }
        )
      }
    }

    // Verifica se o username (normalizado) já existe em profiles (excluindo o próprio usuário)
    if (normalizedUsername) {
      const { data: profilesByUsername, error: usernameQueryError } =
        await supabase
          .from("profiles")
          .select("id, username")
          .ilike("username", normalizedUsername)

      if (
        !usernameQueryError &&
        profilesByUsername?.some(
          (p) =>
            p.id !== userId &&
            p.username?.trim().toLowerCase() === normalizedUsername
        )
      ) {
        return NextResponse.json(
          { message: "Un utente con questa email o username esiste già." },
          { status: 400 }
        )
      }
    }
    // Update auth user
    const updateData: Record<string, unknown> = {
      user_metadata: { full_name: fullName, username, role },
    }
    if (email && typeof email === "string" && email.trim()) {
      updateData.email = email.trim()
    }
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

    // Update auth user ban status if isActive is provided
    if (isActive !== undefined) {
      if (isActive) {
        const { error: banError } = await supabase.auth.admin.updateUserById(
          userId,
          { ban_duration: "none" }
        )
        if (banError) {
          return NextResponse.json(
            { message: banError.message },
            { status: 400 }
          )
        }
      } else {
        const { error: banError } = await supabase.auth.admin.updateUserById(
          userId,
          { ban_duration: "0" }
        )
        if (banError) {
          return NextResponse.json(
            { message: banError.message },
            { status: 400 }
          )
        }
      }
    }

    // Update profile in public.profiles
    const profileUpdate: Record<string, unknown> = {
      full_name: fullName,
      role,
    }
    if (username !== undefined) profileUpdate.username = username
    if (isActive !== undefined) profileUpdate.is_active = isActive
    if (email && typeof email === "string" && email.trim()) {
      profileUpdate.email = email.trim()
    }

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