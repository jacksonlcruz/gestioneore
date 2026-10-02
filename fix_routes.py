import os

files_to_fix = [
    r"D:\GESTIONEORE\src\app\api\admin\convert-freelancer-to-user\route.ts",
    r"D:\GESTIONEORE\src\app\api\admin\convert-user-to-freelancer\route.ts",
    r"D:\GESTIONEORE\src\app\api\admin\create-user\route.ts",
    r"D:\GESTIONEORE\src\app\api\admin\toggle-active\route.ts",
    r"D:\GESTIONEORE\src\app\api\admin\update-user\route.ts",
]

auth_snippet = """
  // --- AUTH CHECK ---
  const supabaseServer = await createServerClient()
  const { data: { user } } = await supabaseServer.auth.getUser()
  if (!user) return NextResponse.json({ message: "Non autorizzato" }, { status: 401 })
  const { data: userProfile } = await supabaseServer.from("profiles").select("role").eq("id", user.id).single()
  if (userProfile?.role !== "admin") return NextResponse.json({ message: "Non autorizzato" }, { status: 403 })
  // ------------------
"""

for filepath in files_to_fix:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if "createServerClient" not in content:
        content = content.replace(
            'import { createClient } from "@supabase/supabase-js"',
            'import { createClient } from "@supabase/supabase-js"\nimport { createClient as createServerClient } from "@/lib/supabase/server"'
        )
        
        # find the start of POST
        post_idx = content.find("export async function POST")
        if post_idx != -1:
            # find the opening brace
            brace_idx = content.find("{", post_idx)
            if brace_idx != -1:
                content = content[:brace_idx+1] + auth_snippet + content[brace_idx+1:]
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed {filepath}")
    else:
        print(f"Skipped {filepath}")

