import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

const protectedRoutes = ["/", "/registro", "/report", "/gestione", "/admin"]
const adminRoutes = ["/gestione", "/report", "/admin"]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Se não estiver logado e tentar acessar rota protegida → /login
  if (!user && protectedRoutes.includes(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // Se estiver logado e tentar acessar /login → redirecionar
  if (user && pathname === "/login") {
    // Buscar role para redirecionamento adequado
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    const url = request.nextUrl.clone()
    url.pathname = profile?.role === "admin" ? "/gestione" : "/"
    return NextResponse.redirect(url)
  }

  // Se for employee tentando acessar /gestione ou /report → redirecionar
  if (user && adminRoutes.includes(pathname)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profile?.role !== "admin") {
      const url = request.nextUrl.clone()
      url.pathname = "/"
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}