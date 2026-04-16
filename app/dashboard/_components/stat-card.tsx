import { Card, CardContent } from '@/components/ui/card'

interface StatCardProps {
  icon: React.ReactNode
  value: number | string
  label: string
}

export function StatCard({ icon, value, label }: StatCardProps) {
  return (
    <Card
      className="relative min-h-[96px] bg-muted"
      aria-label={`${value} ${label}`}
    >
      <CardContent className="flex flex-col justify-center gap-1 pt-4">
        <div className="absolute top-4 right-4 text-muted-foreground">
          {icon}
        </div>
        <span className="text-[28px] font-semibold leading-tight">
          {value}
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  )
}
