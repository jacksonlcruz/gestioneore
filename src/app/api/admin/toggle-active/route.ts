import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const { userId, isActive } = await request.json()

  if (!userId || isActive === undefined) {
    return NextResponse.json(
      { message: "Parametri mancanti" },
      { status: 400 }
    )
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    if (isActive) {
      // Re-enable user
      const { error: authError } = await supabase.auth.admin.updateUserById(
        userId,
        { ban_duration: "none" }
      )
      if (authError) {
        return NextResponse.json(
          { message: authError.message },
          { status: 400 }
        )
      }
    } else {
      // Disable user
      const { error: authError } = await supabase.auth.admin.updateUserById(
        userId,
        { ban_duration: "0" }
      )
      if (authError) {
        return NextResponse.json(
          { message: authError.message },
          { status: 400 }
        )
      }
    }

    // Update profile
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ is_active: isActive })
      .eq("id", userId)

    if (profileError) {
      return NextResponse.json(
        { message: profileError.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { message: isActive ? "Utente riattivato" : "Utente disattivato" },
      { status: 200 }
    )
  } catch {
    return NextResponse.json(
      { message: "Errore durante l'operazione" },
      { status: 500 }
    )
  }
}