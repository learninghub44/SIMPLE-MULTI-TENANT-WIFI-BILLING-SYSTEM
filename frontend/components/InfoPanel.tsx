import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Zap, Shield, Globe } from "lucide-react"

const InfoPanel = () => (
  <Card className="bg-card border-border shadow-sm">
    <CardHeader>
      <CardTitle className="text-foreground">Why Choose Zetu Business Wifi Billing?</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="flex items-start space-x-3">
        <Zap className="w-5 h-5 text-primary mt-1" />
        <div>
          <h3 className="font-medium text-foreground">Lightning Fast</h3>
          <p className="text-sm text-muted-foreground">High-speed internet up to 5 Mbps</p>
        </div>
      </div>
      <div className="flex items-start space-x-3">
        <Shield className="w-5 h-5 text-accent mt-1" />
        <div>
          <h3 className="font-medium text-foreground">Secure Payments</h3>
          <p className="text-sm text-muted-foreground">Protected M-Pesa transactions</p>
        </div>
      </div>
      <div className="flex items-start space-x-3">
        <Globe className="w-5 h-5 text-primary mt-1" />
        <div>
          <h3 className="font-medium text-foreground">Reliable Network</h3>
          <p className="text-sm text-muted-foreground">99.9% uptime guarantee</p>
        </div>
      </div>
    </CardContent>
  </Card>
)

export default InfoPanel
