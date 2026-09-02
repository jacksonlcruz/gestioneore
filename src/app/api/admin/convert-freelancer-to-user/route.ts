import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const { freelancerId, email, username, password, fullName } = await request.json()

  if (!freelancerId || !email || !password || !fullName) {
    return NextResponse.json(
      { error: "Campi obbligatori mancanti" },
      { status: 400 }
    )
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // 1. Verifica se email ou username já existem em profiles (normalizado)
    const normalizedEmail = email.trim().toLowerCase()
    const normalizedUsername = username ? username.trim().toLowerCase() : null

    const { data: profilesByEmail, error: emailQueryError } = await supabase
      .from("profiles")
      .select("id, email, username, is_active")
      .ilike("email", normalizedEmail)

    const { data: profilesByUsername, error: usernameQueryError } =
      normalizedUsername
        ? await supabase
            .from("profiles")
            .select("id, email, username, is_active")
            .ilike("username", normalizedUsername)
        : { data: null, error: null }

    if (!emailQueryError && !usernameQueryError) {
      const matchedByEmail = profilesByEmail?.find(
        (p) => p.email?.trim().toLowerCase() === normalizedEmail
      )
      const matchedByUsername = normalizedUsername
        ? profilesByUsername?.find(
            (p) => p.username?.trim().toLowerCase() === normalizedUsername
          )
        : null

      const existingProfile = matchedByEmail || matchedByUsername

      // Se existe um usuário ATIVO com o email/username → bloqueia
      if (existingProfile && existingProfile.is_active) {
        return NextResponse.json(
          { error: "Un utente attivo con questa email o username esiste già." },
          { status: 400 }
        )
      }

      // Se existe um usuário INATIVO → reativa e migra
      if (existingProfile && !existingProfile.is_active) {
        const existingUserId = existingProfile.id

        // Reativa o perfil e atualiza os dados
        const { error: reactivateError } = await supabase
          .from("profiles")
          .update({
            full_name: fullName.trim(),
            username: username || null,
            email: normalizedEmail,
            role: "employee",
            is_active: true,
          })
          .eq("id", existingUserId)

        if (reactivateError) {
          return NextResponse.json(
            { error: "Errore durante l'aggiornamento del profilo utente." },
            { status: 400 }
          )
        }

        // Atualiza a senha no Supabase Auth
        const { error: passwordError } = await supabase.auth.admin.updateUserById(
          existingUserId,
          { password }
        )

        if (passwordError) {
          return NextResponse.json(
            { error: passwordError.message },
            { status: 400 }
          )
        }

        // Remove o banimento (caso a conta tivesse sido banida)
        const { error: unbanError } = await supabase.auth.admin.updateUserById(
          existingUserId,
          { ban_duration: "none" }
        )

        if (unbanError) {
          return NextResponse.json(
            { error: unbanError.message },
            { status: 400 }
          )
        }

        // Migra o histórico: atualiza service_participants
        const { error: participantsError } = await supabase
          .from("service_participants")
          .update({
            profile_id: existingUserId,
            freelancer_id: null,
            worker_type: "employee",
          })
          .eq("freelancer_id", freelancerId)

        if (participantsError) {
          return NextResponse.json(
            { error: participantsError.message },
            { status: 400 }
          )
        }

        // Desativa o colaborador em freelancers
        const { error: freelancerError } = await supabase
          .from("freelancers")
          .update({ active: false })
          .eq("id", freelancerId)

        if (freelancerError) {
          return NextResponse.json(
            { error: freelancerError.message },
            { status: 400 }
          )
        }

        return NextResponse.json(
          { success: true, message: "Utente riattivato e convertito con successo." },
          { status: 200 }
        )
      }
    }

    // 2. Nenhum usuário existente → cria novo usuário no Supabase Auth
    const { data: userData, error: createError } =
      await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName.trim(),
          username,
          role: "employee",
        },
      })

    if (createError) {
      return NextResponse.json(
        { error: createError.message },
        { status: 400 }
      )
    }

    const newUserId = userData.user!.id

    // Atualiza o perfil em profiles (a trigger do Supabase Auth já criou o registro)
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: newUserId,
          full_name: fullName.trim(),
          username: username || null,
          email: normalizedEmail,
          role: "employee",
          is_active: true,
        },
        { onConflict: "id" }
      )

    if (profileError) {
      return NextResponse.json(
        { error: "Errore durante l'aggiornamento del profilo utente." },
        { status: 400 }
      )
    }

    // 3. Migra o histórico: atualiza service_participants
    const { error: participantsError } = await supabase
      .from("service_participants")
      .update({
        profile_id: newUserId,
        freelancer_id: null,
        worker_type: "employee",
      })
      .eq("freelancer_id", freelancerId)

    if (participantsError) {
      return NextResponse.json(
        { error: participantsError.message },
        { status: 400 }
      )
    }

    // 4. Desativa o colaborador em freelancers
    const { error: freelancerError } = await supabase
      .from("freelancers")
      .update({ active: false })
      .eq("id", freelancerId)

    if (freelancerError) {
      return NextResponse.json(
        { error: freelancerError.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: true, message: "Convertito con successo in Dipendente" },
      { status: 200 }
    )
  } catch {
    return NextResponse.json(
      { error: "Errore durante la conversione del collaboratore" },
      { status: 500 }
    )
  }
}