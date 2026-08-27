import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  // Proteção de acesso: valida o header Authorization com CRON_SECRET
  const authHeader = request.headers.get("Authorization")
  const expectedToken = `Bearer ${process.env.CRON_SECRET}`

  if (!process.env.CRON_SECRET || authHeader !== expectedToken) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 })
  }

  const supabase = await createClient()

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
      console.error("Errore durante il backup automatico:", errors)
      return NextResponse.json(
        { error: "Errore durante il backup automatico" },
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

    const backupJson = JSON.stringify(backup, null, 2)
    const today = new Date().toISOString().split("T")[0]
    const filename = `gestione_ore_backup_${today}.json`

    // Verifica se as variáveis de ambiente do Resend estão configuradas
    if (!process.env.RESEND_API_KEY || !process.env.ADMIN_BACKUP_EMAIL) {
      console.error("Variabili di ambiente Resend non configurate")
      return NextResponse.json(
        { error: "Variabili di ambiente Resend non configurate" },
        { status: 500 }
      )
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || "Gestione Ore <onboarding@resend.dev>"

    // Corpo do e-mail em italiano
    const emailBody = `Ciao Admin,

In allegato trovi il backup automatico settimanale del sistema Gestione Ore generato il ${today}.

Questo file contiene lo stato completo di clienti, utenti, collaboratori, registri ore e costi extra.

Distinti saluti,
Sistema Gestione Ore`

    // Envia o e-mail via API do Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [process.env.ADMIN_BACKUP_EMAIL],
        subject: `[Gestione Ore] Backup Automatico Settimanale - ${today}`,
        text: emailBody,
        attachments: [
          {
            filename,
            content: Buffer.from(backupJson).toString("base64"),
          },
        ],
      }),
    })

    if (!resendRes.ok) {
      const errorData = await resendRes.text()
      console.error("Errore invio email Resend:", resendRes.status, errorData)
      return NextResponse.json(
        { error: "Errore durante l'invio dell'email" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: "Backup automatico inviato con successo" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Errore durante il backup automatico:", error)
    return NextResponse.json(
      { error: "Errore durante il backup automatico" },
      { status: 500 }
    )
  }
}