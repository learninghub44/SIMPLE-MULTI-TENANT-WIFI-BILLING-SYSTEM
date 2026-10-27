"use client"

import { useState } from "react"
import type { FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { apiClient } from "@/lib/api"

export default function OperatorLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")
    const response = await apiClient.loginOperator({ email, password })
    setLoading(false)
    if (!response.success || !response.data) {
      setError(response.error || "Sign-in failed.")
      return
    }
    localStorage.setItem("operator_token", response.data.token)
    router.push("/operator/settings")
  }

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <img src="/zetu-logo.png" alt="Zetu Business Solutions WiFi" className="h-20 w-auto" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Operator portal</p>
          <h1 className="mt-3 text-3xl font-bold text-foreground">Sign in</h1>
          <p className="mt-2 text-muted-foreground">
            Welcome back to your WiFi billing dashboard
          </p>
        </div>

        <section className="rounded-xl border border-border bg-card p-8 shadow-sm">
          <form onSubmit={submit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Email</label>
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                autoComplete="email"
                placeholder="you@example.com"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Password</label>
              <input
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                autoComplete="current-password"
                placeholder="Enter your password"
              />
            </div>

            {error && <p role="alert" className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">{error}</p>}
            
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            New to the platform? <Link className="text-primary font-medium hover:underline" href="/operator/signup">Create an account</Link>
          </p>
        </section>

        <div className="mt-8 text-center text-muted-foreground">
          <p className="text-sm">Need help? Contact us at <a href="mailto:support@christech.co.ke" className="text-primary hover:underline">support@christech.co.ke</a> or call <a href="tel:+254101024580" className="text-primary hover:underline">+254101024580</a></p>
        </div>
      </div>
    </main>
  )
}
