import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const { identifier } = await request.json()

  if (!identifier || identifier.includes("@")) {
    return NextResponse.json({ email: identifier })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Buscar profiles pelo username ou full_name
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id")
    .or(`username.ilike.${identifier},full_name.ilike.${identifier}`)
    .limit(1)

  if (error || !profiles || profiles.length === 0) {
    return NextResponse.json({ email: null }, { status: 404 })
  }

  // Buscar o email do auth.users pelo ID
  const { data: user } = await supabase.auth.admin.getUserById(profiles[0].id)

  if (!user?.user?.email) {
    return NextResponse.json({ email: null }, { status: 404 })
  }

  return NextResponse.json({ email: user.user.email })
}