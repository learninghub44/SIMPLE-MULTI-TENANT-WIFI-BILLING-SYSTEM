import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Star } from "lucide-react"

interface Package {
  label: string
  value: number
  price: string
  speed: string
  color: 'blue' | 'purple' | 'green' | 'yellow'
  popular: boolean
}

const colorClasses = {
  blue: "border-primary bg-primary/10 shadow-sm",
  purple: "border-primary bg-primary/10 shadow-sm",
  green: "border-accent bg-accent/10 shadow-sm",
  yellow: "border-primary bg-primary/10 shadow-sm",
}

const PackageCard = ({ pkg, isSelected, onSelect }: { pkg: Package; isSelected: boolean; onSelect: (value: number) => void }) => {
  return (
    <Card
      className={`relative cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
        isSelected
          ? `${colorClasses[pkg.color]} shadow-md ring-2 ring-primary/20`
          : "border-border bg-card hover:bg-secondary/50"
      }`}
      onClick={() => onSelect(pkg.value)}
    >
      {pkg.popular && (
        <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground">
            <Star className="w-3 h-3 mr-1" />
            Popular
          </Badge>
        </div>
      )}
      <CardContent className="p-4 text-center">
        <div className="text-2xl font-bold text-foreground mb-1">{pkg.price}</div>
        <div className="text-sm text-muted-foreground mb-2">{pkg.label}</div>
        <div className="text-xs text-muted-foreground/70">{pkg.speed}</div>
      </CardContent>
    </Card>
  )
}

export default PackageCard
