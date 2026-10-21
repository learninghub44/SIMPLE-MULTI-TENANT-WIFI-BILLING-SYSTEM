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
    <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100">
      <section className="mx-auto max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-cyan-400">Operator portal</p>
        <h1 className="mt-3 text-3xl font-bold">Sign in</h1>
        <form onSubmit={submit} className="mt-8 space-y-5">
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
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3"
              autoComplete="current-password"
            />
          </label>
          {error && <p role="alert" className="rounded-lg bg-red-950/60 p-3 text-sm text-red-200">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-cyan-500 px-4 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-sm text-slate-400">
          New to the platform? <Link className="text-cyan-400 hover:underline" href="/operator/signup">Create an account</Link>
        </p>
      </section>
    </main>
  )
}
