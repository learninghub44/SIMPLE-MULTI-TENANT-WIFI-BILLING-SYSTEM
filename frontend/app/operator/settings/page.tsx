"use client"

import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { useRouter } from "next/navigation"
import { apiClient, type OperatorIntegrations, type OperatorProfile } from "@/lib/api"

export default function OperatorSettingsPage() {
  const router = useRouter()
  const [operator, setOperator] = useState<OperatorProfile | null>(null)
  const [integrations, setIntegrations] = useState<OperatorIntegrations | null>(null)
  const [channelId, setChannelId] = useState("")
  const [apiUsername, setApiUsername] = useState("")
  const [apiPassword, setApiPassword] = useState("")
  const [routerHost, setRouterHost] = useState("")
  const [routerUsername, setRouterUsername] = useState("")
  const [routerPassword, setRouterPassword] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [savingPayHero, setSavingPayHero] = useState(false)
  const [savingRouter, setSavingRouter] = useState(false)

  async function loadSettings() {
    const [profileResponse, integrationResponse] = await Promise.all([
      apiClient.getOperatorMe(),
      apiClient.getOperatorIntegrations(),
    ])
    if (!profileResponse.success || !profileResponse.data) {
      localStorage.removeItem("operator_token")
      router.replace("/operator/login")
      return
    }
    if (!integrationResponse.success || !integrationResponse.data) {
      setError(integrationResponse.error || "Could not load integration settings.")
      setLoading(false)
      return
    }
    setOperator(profileResponse.data.operator)
    setIntegrations(integrationResponse.data)
    setRouterHost(integrationResponse.data.mikrotik.host)
    setChannelId(integrationResponse.data.payhero.channelId?.toString() || "")
    setLoading(false)
  }

  useEffect(() => {
    if (!localStorage.getItem("operator_token")) {
      router.replace("/operator/login")
      return
    }
    void loadSettings()
  }, [router])

  async function savePayHero(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingPayHero(true)
    setError("")
    setMessage("")
    const response = await apiClient.savePayHeroSettings({
      apiUsername: apiUsername || undefined,
      apiPassword: apiPassword || undefined,
      channelId: Number(channelId),
    })
    setSavingPayHero(false)
    if (!response.success) {
      setError(response.error || "Could not save PayHero settings.")
      return
    }
    setApiUsername("")
    setApiPassword("")
    setMessage(response.message || "PayHero settings saved.")
    await loadSettings()
  }

  async function removePayHero() {
    setError("")
    setMessage("")
    const response = await apiClient.removePayHeroSettings()
    if (!response.success) setError(response.error || "Could not remove PayHero.")
    else {
      setMessage("PayHero was removed. Daraja will be used if platform credentials are configured.")
      await loadSettings()
    }
  }

  async function saveRouter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingRouter(true)
    setError("")
    setMessage("")
    const response = await apiClient.saveMikroTikSettings({
      host: routerHost,
      username: routerUsername || undefined,
      password: routerPassword || undefined,
    })
    setSavingRouter(false)
    if (!response.success) {
      setError(response.error || "Could not save MikroTik settings.")
      return
    }
    setRouterUsername("")
    setRouterPassword("")
    setMessage(response.message || "MikroTik settings saved.")
    await loadSettings()
  }

  async function testRouter() {
    setError("")
    setMessage("")
    const response = await apiClient.testMikroTikSettings()
    if (!response.success) setError(response.error || "MikroTik connection failed.")
    else setMessage(response.message || "MikroTik connection verified.")
  }

  async function removeRouter() {
    setError("")
    setMessage("")
    const response = await apiClient.removeMikroTikSettings()
    if (!response.success) setError(response.error || "Could not remove the router settings.")
    else {
      setMessage("MikroTik settings removed.")
      await loadSettings()
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8 flex-col gap-4">
        <img src="/zetu-logo.png" alt="Zetu Business Solutions WiFi" className="h-16 w-auto" />
        <p>Loading operator settings…</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">Operator settings</p>
            <h1 className="mt-2 text-3xl font-bold text-foreground">{operator?.businessName}</h1>
            <p className="mt-1 text-muted-foreground">Subdomain slug: <span className="font-mono text-foreground">{operator?.slug}</span></p>
            <p className="mt-2 text-sm text-muted-foreground">
              {operator?.domainReady
                ? <>Customer URL: <span className="text-primary">{operator.subdomainUrl}</span></>
                : "The platform base domain is not configured yet. Your account is saved; its subdomain activates after the domain is added."}
            </p>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem("operator_token")
              router.replace("/operator/login")
            }}
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent transition-colors"
          >
            Sign out
          </button>
        </header>

        {error && <p role="alert" className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">{error}</p>}
        {message && <p role="status" className="mb-4 rounded-lg bg-primary/10 border border-primary/20 p-3 text-sm text-primary">{message}</p>}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-foreground">PayHero M-Pesa</h2>
                <p className="mt-1 text-sm text-muted-foreground">Used for Wi-Fi purchases. Loan repayments remain on the existing Daraja flow.</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${integrations?.payhero.configured ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700"}`}>
                {integrations?.payhero.configured ? "Configured" : "Not configured"}
              </span>
            </div>
            <form onSubmit={savePayHero} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">PayHero API username</label>
                <input 
                  value={apiUsername} 
                  onChange={(event) => setApiUsername(event.target.value)} 
                  placeholder={integrations?.payhero.configured ? "Saved securely — enter only to replace" : ""} 
                  autoComplete="off" 
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">PayHero API password</label>
                <input 
                  type="password" 
                  value={apiPassword} 
                  onChange={(event) => setApiPassword(event.target.value)} 
                  placeholder={integrations?.payhero.configured ? "Saved securely — enter only to replace" : ""} 
                  autoComplete="new-password" 
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">PayHero channel ID</label>
                <input 
                  type="number" 
                  min="1" 
                  step="1" 
                  required 
                  value={channelId} 
                  onChange={(event) => setChannelId(event.target.value)} 
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all" 
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <button 
                  disabled={savingPayHero} 
                  className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
                >
                  {savingPayHero ? "Saving…" : "Save PayHero"}
                </button>
                {integrations?.payhero.configured && (
                  <button 
                    type="button" 
                    onClick={removePayHero} 
                    className="rounded-lg border border-border px-4 py-2.5 text-sm hover:bg-accent transition-colors"
                  >
                    Remove PayHero
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-foreground">MikroTik router</h2>
                <p className="mt-1 text-sm text-muted-foreground">Each operator connects their own hotspot router.</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${integrations?.mikrotik.configured ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700"}`}>
                {integrations?.mikrotik.configured ? "Configured" : "Not configured"}
              </span>
            </div>
            <form onSubmit={saveRouter} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Public IPv4 address or hostname</label>
                <input 
                  required 
                  value={routerHost} 
                  onChange={(event) => setRouterHost(event.target.value)} 
                  placeholder="router.example.com" 
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">MikroTik API username</label>
                <input 
                  value={routerUsername} 
                  onChange={(event) => setRouterUsername(event.target.value)} 
                  placeholder={integrations?.mikrotik.configured ? "Saved securely — enter only to replace" : ""} 
                  autoComplete="off" 
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">MikroTik API password</label>
                <input 
                  type="password" 
                  value={routerPassword} 
                  onChange={(event) => setRouterPassword(event.target.value)} 
                  placeholder={integrations?.mikrotik.configured ? "Saved securely — enter only to replace" : ""} 
                  autoComplete="new-password" 
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all" 
                />
              </div>
              <p className="text-xs leading-relaxed text-amber-600 bg-amber-50 p-3 rounded-lg">
                This integration currently uses unencrypted MikroTik API on port 8728. Do not use it with a router exposed to the public internet in production; API-SSL or a protected network path is required. Private and local addresses are blocked.
              </p>
              <div className="flex flex-wrap gap-3">
                <button 
                  disabled={savingRouter} 
                  className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
                >
                  {savingRouter ? "Saving…" : "Save router"}
                </button>
                {integrations?.mikrotik.configured && (
                  <>
                    <button 
                      type="button" 
                      onClick={testRouter} 
                      className="rounded-lg border border-border px-4 py-2.5 text-sm hover:bg-accent transition-colors"
                    >
                      Test connection
                    </button>
                    <button 
                      type="button" 
                      onClick={removeRouter} 
                      className="rounded-lg border border-border px-4 py-2.5 text-sm hover:bg-accent transition-colors"
                    >
                      Remove router
                    </button>
                  </>
                )}
              </div>
            </form>
          </section>
        </div>
      </div>
    </main>
  )
}
