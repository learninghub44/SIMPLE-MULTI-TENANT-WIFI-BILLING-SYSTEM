"use client"

import { useState } from "react"
import type { FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { apiClient } from "@/lib/api"
import { ChevronRight, ChevronLeft, Check } from "lucide-react"

export default function OperatorSignupPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [businessName, setBusinessName] = useState("")
  const [slug, setSlug] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const steps = [
    { number: 1, title: "Business Info" },
    { number: 2, title: "Account Info" },
    { number: 3, title: "Review" },
  ]

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

  function nextStep() {
    if (step === 1 && !businessName) return
    if (step === 1 && !slug) return
    if (step === 2 && !email) return
    if (step === 2 && !password || password.length < 10) return
    setStep(step + 1)
  }

  function prevStep() {
    setStep(step - 1)
  }

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <img src="/zetu-logo.png" alt="Zetu Business Solutions WiFi" className="h-20 w-auto" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">WiFi Billing Platform</p>
          <h1 className="mt-3 text-3xl font-bold text-foreground">Create your operator account</h1>
          <p className="mt-2 text-muted-foreground">
            Set up your Wi-Fi business, payment providers, and MikroTik connection.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((s) => (
              <div key={s.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                      step >= s.number
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {step > s.number ? <Check className="w-5 h-5" /> : s.number}
                  </div>
                  <span className="text-xs mt-2 font-medium text-muted-foreground">{s.title}</span>
                </div>
                {s.number < steps.length && (
                  <div
                    className={`flex-1 h-1 mx-2 transition-all ${
                      step > s.number ? "bg-primary" : "bg-secondary"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <section className="rounded-xl border border-border bg-card p-8 shadow-sm">
          <form onSubmit={submit} className="space-y-6">
            {step === 1 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Business name</label>
                  <input
                    required
                    minLength={2}
                    maxLength={80}
                    value={businessName}
                    onChange={(event) => setBusinessName(event.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                    autoComplete="organization"
                    placeholder="Enter your business name"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Subdomain name</label>
                  <div className="flex items-center rounded-lg border border-input px-4 bg-secondary/50">
                    <input
                      required
                      minLength={2}
                      maxLength={40}
                      pattern="[a-zA-Z0-9-]+"
                      value={slug}
                      onChange={(event) => setSlug(event.target.value.toLowerCase())}
                      className="min-w-0 flex-1 bg-transparent py-3 text-foreground placeholder:text-muted-foreground focus:outline-none"
                      placeholder="your-business"
                    />
                    <span className="pl-2 text-muted-foreground">.your-domain</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your final address will appear here after the platform domain is configured.
                  </p>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
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
                    minLength={10}
                    maxLength={128}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                    autoComplete="new-password"
                    placeholder="Create a strong password"
                  />
                  <p className="text-xs text-muted-foreground">Use at least 10 characters.</p>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="bg-secondary/30 rounded-lg p-6 space-y-4">
                  <h3 className="font-semibold text-foreground">Review your information</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Business name:</span>
                      <p className="font-medium text-foreground">{businessName}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Subdomain:</span>
                      <p className="font-medium text-foreground">{slug}.your-domain</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email:</span>
                      <p className="font-medium text-foreground">{email}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && <p role="alert" className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">{error}</p>}
            
            <div className="flex gap-3">
              {step > 1 && (
                <button
                  type="button"
                  onClick={prevStep}
                  className="flex-1 rounded-lg border border-border px-4 py-3 font-semibold text-foreground hover:bg-secondary transition-colors flex items-center justify-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
              )}
              
              {step < 3 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={
                    (step === 1 && (!businessName || !slug)) ||
                    (step === 2 && (!email || !password || password.length < 10))
                  }
                  className="flex-1 rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
                >
                  {loading ? "Creating account…" : "Create account"}
                </button>
              )}
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already registered? <Link className="text-primary font-medium hover:underline" href="/operator/login">Sign in</Link>
          </p>
        </section>

        <div className="mt-8 text-center text-muted-foreground">
          <p className="text-sm">Need help? Contact us at <a href="mailto:support@christech.co.ke" className="text-primary hover:underline">support@christech.co.ke</a> or call <a href="tel:+254101024580" className="text-primary hover:underline">+254101024580</a></p>
        </div>
      </div>
    </main>
  )
}
