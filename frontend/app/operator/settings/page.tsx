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
    return <main className="min-h-screen bg-slate-950 p-8 text-slate-300">Loading operator settings…</main>
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-cyan-400">Operator settings</p>
            <h1 className="mt-2 text-3xl font-bold">{operator?.businessName}</h1>
            <p className="mt-1 text-slate-400">Subdomain slug: <span className="font-mono text-slate-200">{operator?.slug}</span></p>
            <p className="mt-2 text-sm text-slate-400">
              {operator?.domainReady
                ? <>Customer URL: <span className="text-cyan-300">{operator.subdomainUrl}</span></>
                : "The platform base domain is not configured yet. Your account is saved; its subdomain activates after the domain is added."}
            </p>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem("operator_token")
              router.replace("/operator/login")
            }}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
          >
            Sign out
          </button>
        </header>

        {error && <p role="alert" className="mb-4 rounded-lg bg-red-950/60 p-3 text-sm text-red-200">{error}</p>}
        {message && <p role="status" className="mb-4 rounded-lg bg-emerald-950/60 p-3 text-sm text-emerald-200">{message}</p>}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">PayHero M-Pesa</h2>
                <p className="mt-1 text-sm text-slate-400">Used for Wi-Fi purchases. Loan repayments remain on the existing Daraja flow.</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs ${integrations?.payhero.configured ? "bg-emerald-900 text-emerald-200" : "bg-amber-900 text-amber-200"}`}>
                {integrations?.payhero.configured ? "Configured" : "Not configured"}
              </span>
            </div>
            <form onSubmit={savePayHero} className="space-y-4">
              <label className="block space-y-2 text-sm">
                <span>PayHero API username</span>
                <input value={apiUsername} onChange={(event) => setApiUsername(event.target.value)} placeholder={integrations?.payhero.configured ? "Saved securely — enter only to replace" : ""} autoComplete="off" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3" />
              </label>
              <label className="block space-y-2 text-sm">
                <span>PayHero API password</span>
                <input type="password" value={apiPassword} onChange={(event) => setApiPassword(event.target.value)} placeholder={integrations?.payhero.configured ? "Saved securely — enter only to replace" : ""} autoComplete="new-password" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3" />
              </label>
              <label className="block space-y-2 text-sm">
                <span>PayHero channel ID</span>
                <input type="number" min="1" step="1" required value={channelId} onChange={(event) => setChannelId(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3" />
              </label>
              <div className="flex flex-wrap gap-3">
                <button disabled={savingPayHero} className="rounded-lg bg-cyan-500 px-4 py-2.5 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60">
                  {savingPayHero ? "Saving…" : "Save PayHero"}
                </button>
                {integrations?.payhero.configured && (
                  <button type="button" onClick={removePayHero} className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm hover:bg-slate-800">
                    Remove PayHero
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">MikroTik router</h2>
                <p className="mt-1 text-sm text-slate-400">Each operator connects their own hotspot router.</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs ${integrations?.mikrotik.configured ? "bg-emerald-900 text-emerald-200" : "bg-amber-900 text-amber-200"}`}>
                {integrations?.mikrotik.configured ? "Configured" : "Not configured"}
              </span>
            </div>
            <form onSubmit={saveRouter} className="space-y-4">
              <label className="block space-y-2 text-sm">
                <span>Public IPv4 address or hostname</span>
                <input required value={routerHost} onChange={(event) => setRouterHost(event.target.value)} placeholder="router.example.com" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3" />
              </label>
              <label className="block space-y-2 text-sm">
                <span>MikroTik API username</span>
                <input value={routerUsername} onChange={(event) => setRouterUsername(event.target.value)} placeholder={integrations?.mikrotik.configured ? "Saved securely — enter only to replace" : ""} autoComplete="off" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3" />
              </label>
              <label className="block space-y-2 text-sm">
                <span>MikroTik API password</span>
                <input type="password" value={routerPassword} onChange={(event) => setRouterPassword(event.target.value)} placeholder={integrations?.mikrotik.configured ? "Saved securely — enter only to replace" : ""} autoComplete="new-password" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3" />
              </label>
              <p className="text-xs leading-relaxed text-amber-200/80">
                This integration currently uses unencrypted MikroTik API on port 8728. Do not use it with a router exposed to the public internet in production; API-SSL or a protected network path is required. Private and local addresses are blocked.
              </p>
              <div className="flex flex-wrap gap-3">
                <button disabled={savingRouter} className="rounded-lg bg-cyan-500 px-4 py-2.5 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60">
                  {savingRouter ? "Saving…" : "Save router"}
                </button>
                {integrations?.mikrotik.configured && (
                  <>
                    <button type="button" onClick={testRouter} className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm hover:bg-slate-800">
                      Test connection
                    </button>
                    <button type="button" onClick={removeRouter} className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm hover:bg-slate-800">
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
