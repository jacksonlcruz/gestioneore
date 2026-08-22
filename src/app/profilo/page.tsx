import { ChangePasswordForm } from "@/components/change-password-form"

export default function ProfiloPage() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Il Mio Profilo</h1>
        <p className="text-muted-foreground">
          Gestisci le tue credenziali di accesso
        </p>
      </div>

      <ChangePasswordForm />
    </div>
  )
}