import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()

  // Verifica autenticação
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 })
  }

  // Verifica se o usuário é admin
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profileError || !profile || profile.role?.toLowerCase() !== "admin") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 })
  }

  try {
    // Coleta todos os dados em paralelo
    const [
      clientsRes,
      profilesRes,
      freelancersRes,
      serviceRecordsRes,
      serviceParticipantsRes,
      extraCostsRes,
    ] = await Promise.all([
      supabase.from("clients").select("*").order("name"),
      supabase.from("profiles").select("id, full_name, username, email, role, is_active, created_at").order("full_name"),
      supabase.from("freelancers").select("*").order("name"),
      supabase.from("service_records").select("*").order("date"),
      supabase.from("service_participants").select("*"),
      supabase.from("extra_costs").select("*").order("date"),
    ])

    // Verifica erros
    const errors = [
      clientsRes.error,
      profilesRes.error,
      freelancersRes.error,
      serviceRecordsRes.error,
      serviceParticipantsRes.error,
      extraCostsRes.error,
    ].filter(Boolean)

    if (errors.length > 0) {
      console.error("Errore durante il backup:", errors)
      return NextResponse.json(
        { error: "Errore durante il backup" },
        { status: 500 }
      )
    }

    // Monta o payload do backup
    const backup = {
      export_date: new Date().toISOString(),
      version: "1.0",
      data: {
        clients: clientsRes.data ?? [],
        profiles: profilesRes.data ?? [],
        freelancers: freelancersRes.data ?? [],
        service_records: serviceRecordsRes.data ?? [],
        service_participants: serviceParticipantsRes.data ?? [],
        extra_costs: extraCostsRes.data ?? [],
      },
    }

    // Gera o nome do arquivo com a data atual
    const today = new Date().toISOString().split("T")[0]
    const filename = `gestione_ore_backup_${today}.json`

    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("Errore durante il backup:", error)
    return NextResponse.json(
      { error: "Errore durante il backup" },
      { status: 500 }
    )
  }
}