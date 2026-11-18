import { ChangePasswordForm } from "@/components/change-password-form"
import { ProfileHeader } from "@/components/profile-header"
import { ThemeToggle } from "@/components/theme-toggle"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function ProfiloPage() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Il Mio Profilo</h1>
        <p className="text-muted-foreground">
          Gestisci le tue credenziali di accesso
        </p>
      </div>

      <ProfileHeader />

      <Card className="rounded-2xl border-border/60 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Aspetto</CardTitle>
          <CardDescription>
            Scelta salvata in questo dispositivo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeToggle />
        </CardContent>
      </Card>

      <ChangePasswordForm />
    </div>
  )
}
