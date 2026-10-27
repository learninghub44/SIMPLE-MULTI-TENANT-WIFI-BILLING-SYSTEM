import { Shield, Users, Globe } from "lucide-react"

const TrustIndicators = () => (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
    <div className="flex items-center space-x-3 p-4 rounded-lg bg-secondary/50 border border-border">
      <Shield className="h-8 w-8 text-accent" />
      <div>
        <p className="text-sm font-medium text-foreground">Secure Payment</p>
        <p className="text-xs text-muted-foreground">M-Pesa Protected .Sercure .Reliable .Trust</p>
      </div>
    </div>
    <div className="flex items-center space-x-3 p-4 rounded-lg bg-secondary/50 border border-border">
      <Users className="h-8 w-8 text-primary" />
      <div>
        <p className="text-sm font-medium text-foreground">10,000+ Users</p>
        <p className="text-xs text-muted-foreground">Trusted Daily</p>
      </div>
    </div>
    <div className="flex items-center space-x-3 p-4 rounded-lg bg-secondary/50 border border-border">
      <Globe className="h-8 w-8 text-primary" />
      <div>
        <p className="text-sm font-medium text-foreground">99.9% Uptime</p>
        <p className="text-xs text-muted-foreground">Reliable Connection</p>
      </div>
    </div>
  </div>
)

export default TrustIndicators
