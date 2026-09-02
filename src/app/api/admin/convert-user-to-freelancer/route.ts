import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const { userId } = await request.json()

  if (!userId) {
    return NextResponse.json(
      { error: "ID utente mancante" },
      { status: 400 }
    )
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // 1. Busca o perfil do usuário
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Utente non trovato" },
        { status: 400 }
      )
    }

    const fullName = profile.full_name?.trim()

    // Busca um freelancer existente com o mesmo nome normalizado (mesmo inativo)
    let freelancerId: string | null = null
    if (fullName) {
      const normalizedName = fullName.toLowerCase()
      const { data: existingFreelancers } = await supabase
        .from("freelancers")
        .select("*")
        .ilike("name", fullName)

      const existing = existingFreelancers?.find(
        (f) => f.name.trim().toLowerCase() === normalizedName
      )

      if (existing) {
        freelancerId = existing.id
        // Reativa o freelancer se estiver inativo
        if (existing.active === false) {
          const { error: reactivateError } = await supabase
            .from("freelancers")
            .update({ active: true })
            .eq("id", existing.id)

          if (reactivateError) {
            return NextResponse.json(
              { error: reactivateError.message },
              { status: 400 }
            )
          }
        }
      }
    }

    // Se não existir, cria um novo freelancer
    if (!freelancerId) {
      const { data: newFreelancer, error: createError } = await supabase
        .from("freelancers")
        .insert({ name: fullName || "Collaboratore" })
        .select()
        .single()

      if (createError || !newFreelancer) {
        return NextResponse.json(
          { error: createError?.message || "Errore durante la creazione del collaboratore" },
          { status: 400 }
        )
      }

      freelancerId = newFreelancer.id
    }

    // 2. Desativa o perfil do usuário e revoga o acesso no Auth
    const { error: deactivateError } = await supabase
      .from("profiles")
      .update({ is_active: false })
      .eq("id", userId)

    if (deactivateError) {
      return NextResponse.json(
        { error: deactivateError.message },
        { status: 400 }
      )
    }

    const { error: banError } = await supabase.auth.admin.updateUserById(
      userId,
      { ban_duration: "0" }
    )

    if (banError) {
      return NextResponse.json(
        { error: banError.message },
        { status: 400 }
      )
    }

    // 3. Migra o histórico: atualiza service_participants
    const { error: participantsError } = await supabase
      .from("service_participants")
      .update({
        freelancer_id: freelancerId,
        profile_id: null,
        worker_type: "freelancer",
      })
      .eq("profile_id", userId)

    if (participantsError) {
      return NextResponse.json(
        { error: participantsError.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: true, message: "Convertito con successo in Collaboratore Esterno" },
      { status: 200 }
    )
  } catch {
    return NextResponse.json(
      { error: "Errore durante la conversione dell'utente" },
      { status: 500 }
    )
  }
}