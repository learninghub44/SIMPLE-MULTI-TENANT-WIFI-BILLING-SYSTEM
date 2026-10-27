import { CheckCircle, Clock, AlertTriangle } from "lucide-react"

const StatusDisplay = ({ status }: { status: "pending" | "completed" | "failed" | "" }) => {
  if (!status) return null

  const statusConfig = {
    pending: {
      icon: Clock,
      className: "bg-amber-100 border-amber-200 text-amber-700",
      text: "Processing payment...",
      iconClass: "animate-pulse",
    },
    completed: {
      icon: CheckCircle,
      className: "bg-primary/10 border-primary/20 text-primary",
      text: "Payment successful! You're connected.",
      iconClass: "",
    },
    failed: {
      icon: AlertTriangle,
      className: "bg-destructive/10 border-destructive/20 text-destructive",
      text: "Payment failed. Please try again.",
      iconClass: "",
    },
  }

  const config = statusConfig[status]
  if (!config) return null
  const Icon = config.icon

  return (
    <div
      className={`flex items-center justify-center p-4 rounded-lg border transition-all duration-300 ${config.className}`}
    >
      <Icon className={`w-5 h-5 mr-3 ${config.iconClass}`} />
      <span className="font-medium">{config.text}</span>
    </div>
  )
}

export default StatusDisplay
