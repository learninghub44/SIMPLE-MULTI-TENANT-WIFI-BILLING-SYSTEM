"use client"

import { useState, useEffect } from "react"
import { CheckCircle, Clock, AlertTriangle, Phone, Package, Zap, Shield, Users, Globe, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { PaymentSuccessModal } from "@/components/payment-success-modal"
import { ToastProvider } from "@/components/toast-provider"
import { toast } from "sonner"
import { apiClient, type PaymentRequest } from "@/lib/api"
import { useDynamicTitle } from "@/hooks/use-dynamic-title"
import TrustIndicators from "@/components/TrustIndicators"
import PackageCard from "@/components/PackageCard"
import StatusDisplay from "@/components/StatusDisplay"
import DeviceInfoPanel from "@/components/DeviceInfoPanel"
import InfoPanel from "@/components/InfoPanel"

// --- Constants ---
const packages: {
  label: string;
  value: number;
  price: string;
  speed: string;
  color: "blue" | "purple" | "green" | "yellow";
  popular: boolean;
}[] = [
  { label: "24 Hours", value: 30, price: "Ksh 30", speed: "5 Mbps", color: "blue", popular: true },
  { label: "12 Hours", value: 20, price: "Ksh 20", speed: "4 Mbps", color: "purple", popular: false },
  { label: "4 Hours", value: 15, price: "Ksh 15", speed: "3 Mbps", color: "green", popular: false },
  { label: "1 Hour", value: 10, price: "Ksh 10", speed: "2 Mbps", color: "yellow", popular: false },
]

// --- Main Component ---
export default function UserPortal() {
  const { title } = useDynamicTitle("Get Connected Instantly")
  const [phone, setPhone] = useState("")
  const [amount, setAmount] = useState(30)
  const [transactionId, setTransactionId] = useState<string | null>(null)
  const [status, setStatus] = useState<"pending" | "completed" | "failed" | "">("")
  const [isLoading, setIsLoading] = useState(false)
  const [isLoanLoading, setIsLoanLoading] = useState(false)
  const [macAddress, setMacAddress] = useState("Loading...");
  const [operator, setOperator] = useState<{ businessName: string; slug: string } | null>(null)
  const [operatorResolved, setOperatorResolved] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [paymentData, setPaymentData] = useState<any>(null)

  useEffect(() => {
    let active = true
    apiClient.getOperatorPublic().then((response) => {
      if (!active) return
      const currentOperator = response.success ? response.data?.operator || null : null
      setOperator(currentOperator)
      setOperatorResolved(true)
      if (currentOperator) void fetchDeviceInfo()
    })
    return () => { active = false }
  }, [])

  const fetchDeviceInfo = async () => {
    try {
      const query = new URLSearchParams(window.location.search)
      const portalMac = query.get("mac") || query.get("macAddress") || ""
      if (/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(portalMac)) {
        setMacAddress(portalMac.toUpperCase())
        return
      }
      toast.info("Fetching device information...", { duration: 2000 })

      const response = await apiClient.getDeviceInfo()

      if (response.success && response.data) {
        setMacAddress(response.data.macAddress)
        toast.success("Device information loaded", { duration: 2000 })
      } else {
        throw new Error(response.error || "Failed to fetch device info")
      }
    } catch (error) {
      console.error("Error fetching device info:", error)
      setMacAddress("UNAVAILABLE")
      toast.error("Could not retrieve device information", {
        description: "Please check your network connection and refresh the page",
      })
    }
  }

     // ================= FIX 1 =================
  // Single source of truth for selected package
  const getSelectedPackage = () => {
    const pkg = packages.find((p) => p.value === amount)
    if (!pkg) {
      toast.error("Invalid package selected")
      return null
    }
    return pkg
  }

  const handlePayment = async () => {
    if (!/^(07|01)\d{8}$/.test(phone)) {
      toast.error("Invalid phone number")
      return
    }

    // ================= FIX 3 =================
    // Correctly resolve selected package
    const selectedPackage = getSelectedPackage()
    if (!selectedPackage) return

    setIsLoading(true)
    setStatus("pending")

    toast.loading("Initiating M-Pesa payment...", {
      description: `${selectedPackage.price} for ${selectedPackage.label}`,
      id: "payment-loading",
    })

    try {
      const payload: PaymentRequest = {
        phone: `+254${phone.substring(1)}`,
        amount,
        package: selectedPackage.label,
        macAddress,
        speed: selectedPackage.speed,
      }

      const response = await apiClient.initiatePayment(payload)

      if (!response.success || !response.data) {
        throw new Error(response.error)
      }

      const { transactionId, status: paymentStatus, mpesaRef, expiresAt } = response.data
      setStatus(paymentStatus)

      if (paymentStatus === "completed") {
        setPaymentData({
          transactionId,
          amount,
          package: selectedPackage.label,
          phone: payload.phone,
          mpesaRef,
          provider: response.data.provider,
          accessStatus: response.data.accessStatus,
          expiresAt,
          speed: selectedPackage.speed,
        })

        toast.dismiss("payment-loading")
        toast.success("Payment successful")
        setTimeout(() => setShowSuccessModal(true), 1000)
      } else {
        pollPaymentStatus(transactionId)
      }
    } catch (err) {
      setStatus("failed")
      toast.dismiss("payment-loading")
      toast.error("Payment failed")
    } finally {
      setIsLoading(false)
    }
  }

  // ================= FIX 5 =================
// Handle Okoa Internet Loan
const handleLoan = async () => {
  if (!phone || !/^(07|01)\d{8}$/.test(phone)) {
    toast.error("Enter a valid phone number before requesting a loan")
    return
  }

  setIsLoanLoading(true)
  setStatus("pending")

  toast.loading("Requesting Okoa Internet loan...", { id: "loan-loading" })

  try {
    // Simulate API call for Okoa Internet loan
    const response = await apiClient.requestLoan({
      phone: `+254${phone.substring(1)}`,
      macAddress,
    })

    if (response.success && response.data?.loanApproved) {
      setStatus("completed")
      toast.dismiss("loan-loading")
      toast.success(`Loan approved! ${response.data.amount} Ksh credited to your account`)

      // Optionally show success modal
      setPaymentData({
        transactionId: response.data.transactionId,
        amount: response.data.amount,
        package: "Okoa Internet Loan",
        phone: `+254${phone.substring(1)}`,
        expiresAt: response.data.expiresAt,
      })
      setShowSuccessModal(true)
    } else {
      throw new Error(response.error || "Loan request failed")
    }
  } catch (error) {
    setStatus("failed")
    toast.dismiss("loan-loading")
    toast.error("Loan request failed. Please try again later.")
  } finally {
    setIsLoanLoading(false)
  }
}


const pollPaymentStatus = async (txnId: string) => {
  let attempts = 0
  const maxAttempts = 30

  const poll = async () => {
    const selectedPackage = getSelectedPackage()
    if (!selectedPackage) return

    try {
      const response = await apiClient.checkPaymentStatus(txnId)
      if (response.success && response.data?.status === "completed") {
        setPaymentData({
          transactionId: txnId,
          amount,
          package: selectedPackage.label,
          phone: `+254${phone.substring(1)}`,
          mpesaRef: response.data.mpesaRef,
          provider: response.data.provider,
          accessStatus: response.data.accessStatus,
          expiresAt: response.data.expiresAt,
          speed: selectedPackage.speed,
        })
        setStatus("completed")
        toast.dismiss("payment-loading")
        toast.success("Payment successful")
        setShowSuccessModal(true)
        return
      }

      // Increment attempts and continue polling
      attempts++
      if (attempts < maxAttempts) {
        setTimeout(poll, 10000)
      } else {
        throw new Error("Timeout")
      }
    } catch {
      setStatus("failed")
      toast.dismiss("payment-loading")
      toast.error("Payment timeout or failed")
    }
  }

  poll()
}

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setPhone(value)

    // Real-time validation feedback
    if (value && !/^(07|01)\d{0,8}$/.test(value)) {
      toast.error("Invalid format", {
        description: "Phone number should start with 07 or 01",
        duration: 2000,
      })
    }
  }

  if (!operatorResolved) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground flex-col gap-4">
        <img src="/zetu-logo.png" alt="Zetu Business Solutions WiFi" className="h-16 w-auto" />
        <p>Loading Wi-Fi operator…</p>
      </main>
    )
  }

  if (!operator) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main>
          {/* Hero Section */}
          <section className="px-4 py-20 lg:py-32 text-center">
            <div className="mx-auto max-w-6xl">
              <div className="mb-8 flex justify-center">
                <img src="/zetu-logo.png" alt="Zetu Business Solutions WiFi" className="h-24 w-auto" />
              </div>
              <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-4">WiFi Billing Platform</p>
              <h1 className="mt-4 text-5xl sm:text-6xl lg:text-7xl font-bold text-foreground mb-6">
                Manage your hotspot business
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                  with ease
                </span>
              </h1>
              <p className="mt-4 max-w-3xl text-xl text-muted-foreground mx-auto mb-8">
                Create an operator account, connect payment providers and your MikroTik router, then serve customers from your own subdomain. The complete WiFi billing solution for Kenya.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <a href="/operator/signup" className="rounded-lg bg-primary px-8 py-4 font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg">Create operator account</a>
                <a href="/operator/login" className="rounded-lg border-2 border-primary px-8 py-4 font-semibold text-primary hover:bg-primary/5 transition-colors">Operator sign in</a>
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section className="px-4 py-20 bg-secondary/30">
            <div className="mx-auto max-w-6xl">
              <div className="text-center mb-16">
                <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Why Choose Zetu Business Solutions?</h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Powerful features designed to help you manage your WiFi business efficiently</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="p-6 bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <Zap className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">Instant Payments</h3>
                  <p className="text-muted-foreground text-sm">Accept M-Pesa payments instantly with multiple payment providers including PayHero and Daraja</p>
                </div>
                <div className="p-6 bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <Shield className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">Secure Access</h3>
                  <p className="text-muted-foreground text-sm">Automated MikroTik integration for seamless WiFi access control and user management</p>
                </div>
                <div className="p-6 bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">Multi-Tenant</h3>
                  <p className="text-muted-foreground text-sm">Serve multiple operators from a single platform with custom subdomains for each business</p>
                </div>
                <div className="p-6 bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
                    <Globe className="w-6 h-6 text-accent" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">Real-time Monitoring</h3>
                  <p className="text-muted-foreground text-sm">Track payments, user sessions, and revenue in real-time with comprehensive dashboards</p>
                </div>
                <div className="p-6 bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
                    <Phone className="w-6 h-6 text-accent" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">SMS Notifications</h3>
                  <p className="text-muted-foreground text-sm">Send automated SMS notifications to customers about payments and session status</p>
                </div>
                <div className="p-6 bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
                    <Shield className="w-6 h-6 text-accent" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">Loan Management</h3>
                  <p className="text-muted-foreground text-sm">Offer "Okoa Internet" loans to customers with flexible repayment options</p>
                </div>
              </div>
            </div>
          </section>

          {/* How It Works */}
          <section className="px-4 py-20">
            <div className="mx-auto max-w-6xl">
              <div className="text-center mb-16">
                <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">How It Works</h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Get started in 3 simple steps</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 text-primary-foreground text-2xl font-bold">1</div>
                  <h3 className="font-semibold text-foreground mb-2">Create Account</h3>
                  <p className="text-muted-foreground text-sm">Sign up as an operator and set up your business profile</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 text-primary-foreground text-2xl font-bold">2</div>
                  <h3 className="font-semibold text-foreground mb-2">Connect Services</h3>
                  <p className="text-muted-foreground text-sm">Link your payment providers and MikroTik router</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 text-primary-foreground text-2xl font-bold">3</div>
                  <h3 className="font-semibold text-foreground mb-2">Start Serving</h3>
                  <p className="text-muted-foreground text-sm">Begin serving customers and managing your WiFi business</p>
                </div>
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="px-4 py-20 bg-primary">
            <div className="mx-auto max-w-4xl text-center">
              <h2 className="text-3xl sm:text-4xl font-bold text-primary-foreground mb-4">Ready to Start?</h2>
              <p className="text-xl text-primary-foreground/90 mb-8">Join hundreds of WiFi operators already using Zetu Business Solutions</p>
              <a href="/operator/signup" className="inline-block rounded-lg bg-primary-foreground px-8 py-4 font-semibold text-primary hover:bg-primary-foreground/90 transition-colors shadow-lg">Create your free account</a>
            </div>
          </section>

          {/* Contact Section */}
          <section className="px-4 py-20 bg-secondary/30">
            <div className="mx-auto max-w-4xl text-center">
              <h2 className="text-3xl font-bold text-foreground mb-4">Need Help?</h2>
              <p className="text-lg text-muted-foreground mb-8">Our support team is available 24/7 to assist you</p>
              <div className="flex flex-wrap justify-center gap-4">
                <a href="mailto:support@christech.co.ke" className="rounded-lg border border-border px-6 py-3 font-semibold text-foreground hover:bg-card transition-colors">support@christech.co.ke</a>
                <a href="tel:+254101024580" className="rounded-lg border border-border px-6 py-3 font-semibold text-foreground hover:bg-card transition-colors">+254101024580</a>
              </div>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <>
      <ToastProvider />
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-16">
          <div className="max-w-4xl mx-auto">
            {/* Hero Section */}
            <div className="text-center mb-12">
              <h1 className="text-4xl lg:text-6xl font-bold text-foreground mb-4">
                {operator.businessName}
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                  Instantly
                </span>
              </h1>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                Choose your internet package and pay securely with M-Pesa. Fast, reliable, and affordable internet
                access.
              </p>
            </div>

            <TrustIndicators />

            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
              {/* Payment Form */}
              <Card className="bg-card border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center">
                    <Zap className="w-5 h-5 mr-2 text-primary" />
                    Quick Payment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Phone Input */}
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-foreground flex items-center">
                      <Phone className="w-4 h-4 mr-2" />
                      M-Pesa Number
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="0798750585"
                      value={phone}
                      onChange={handlePhoneChange}
                      className="bg-background border-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                      maxLength={10}
                    />
                  </div>

                  {/* Package Selection */}
                  <div className="space-y-4">
                    <Label className="text-foreground flex items-center">
                      <Package className="w-4 h-4 mr-2" />
                      Select Package
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      {packages.map((pkg) => (
                        <PackageCard key={pkg.value} pkg={pkg} isSelected={amount === pkg.value} onSelect={setAmount} />
                      ))}
                    </div>
                  </div>

                  {/* Payment Buttons */}
                  <div className="flex gap-3">
                    <Button
                      onClick={handlePayment}
                      disabled={isLoading || !phone || phone.length !== 10 || !/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(macAddress)}
                      className="flex-1 h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-colors disabled:opacity-50"
                    >
                      {isLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground mr-2"></div>
                          Processing...
                        </>
                      ) : (
                        <>
                          <Zap className="w-5 h-5 mr-2" />
                          Pay with M-Pesa - {packages.find((p) => p.value === amount)?.price}
                        </>
                      )}
                    </Button>

                    {!operator && (
                      <Button
                        onClick={handleLoan}
                        disabled={isLoanLoading || isLoading || !phone || phone.length !== 10}
                        className="flex-1 h-12 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold transition-colors disabled:opacity-50"
                      >
                        {isLoanLoading ? "Processing loan..." : <><Shield className="w-5 h-5 mr-2" />Okoa Internet</>}
                      </Button>
                    )}
                  </div>

                  {!/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(macAddress) && (
                    <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                      Open this page from the hotspot portal so it can provide your device MAC address.
                    </p>
                  )}
                  <StatusDisplay status={status} />
                </CardContent>
              </Card>

              {/* Info Panel */}
              <div className="space-y-6">
                <InfoPanel />
                <DeviceInfoPanel macAddress={macAddress} status={status} />
              </div>
            </div>
          </div>
        </main>
        <Footer />
        {/* Success Modal */}
        {paymentData && (
          <PaymentSuccessModal
            isOpen={showSuccessModal}
            onClose={() => setShowSuccessModal(false)}
            paymentData={paymentData}
          />
        )}
      </div>
    </>
  )
}
