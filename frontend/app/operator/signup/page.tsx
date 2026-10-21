"use client"

import { useState } from "react"
import type { FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { apiClient } from "@/lib/api"

export default function OperatorSignupPage() {
  const router = useRouter()
  const [businessName, setBusinessName] = useState("")
  const [slug, setSlug] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")
    const response = await apiClient.registerOperator({ businessName, slug, email, password })
    setLoading(false)
    if (!response.success || !response.data) {
      setError(response.error || "Could not create the operator account.")
      return
    }
    localStorage.setItem("operator_token", response.data.token)
    router.push("/operator/settings")
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100">
      <section className="mx-auto max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-cyan-400">Wi-Fi Billing Platform</p>
        <h1 className="mt-3 text-3xl font-bold">Create your operator account</h1>
        <p className="mt-2 text-slate-400">
          Set up your Wi-Fi business, M-Pesa checkout, and MikroTik connection.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-5">
          <label className="block space-y-2 text-sm">
            <span>Business name</span>
            <input
              required
              minLength={2}
              maxLength={80}
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3"
              autoComplete="organization"
            />
          </label>

          <label className="block space-y-2 text-sm">
            <span>Subdomain name</span>
            <div className="flex items-center rounded-lg border border-slate-700 bg-slate-950 px-3">
              <input
                required
                minLength={2}
                maxLength={40}
                pattern="[a-zA-Z0-9-]+"
                value={slug}
                onChange={(event) => setSlug(event.target.value.toLowerCase())}
                className="min-w-0 flex-1 bg-transparent py-3 outline-none"
                placeholder="your-business"
              />
              <span className="pl-2 text-slate-500">.your-domain</span>
            </div>
            <span className="block text-xs text-slate-500">
              Your final address will appear here after the platform domain is configured.
            </span>
          </label>

          <label className="block space-y-2 text-sm">
            <span>Email</span>
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3"
              autoComplete="email"
            />
          </label>

          <label className="block space-y-2 text-sm">
            <span>Password</span>
            <input
              required
              type="password"
              minLength={10}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3"
              autoComplete="new-password"
            />
            <span className="block text-xs text-slate-500">Use at least 10 characters.</span>
          </label>

          {error && <p role="alert" className="rounded-lg bg-red-950/60 p-3 text-sm text-red-200">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-cyan-500 px-4 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-400">
          Already registered? <Link className="text-cyan-400 hover:underline" href="/operator/login">Sign in</Link>
        </p>
      </section>
    </main>
  )
}
