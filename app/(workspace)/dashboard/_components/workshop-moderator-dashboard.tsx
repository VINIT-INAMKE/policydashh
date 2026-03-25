import { Calendar, Paperclip } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatCard } from './stat-card'

interface WorkshopModeratorDashboardProps {
  userId: string
}

export async function WorkshopModeratorDashboard({ userId }: WorkshopModeratorDashboardProps) {
  // No data fetching -- workshops don't exist until Phase 10
  // All widgets render placeholder/empty states

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Stat row - placeholders with 0 values */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard icon={<Calendar className="size-5" />} value={0} label="Upcoming Workshops" />
        <StatCard icon={<Paperclip className="size-5" />} value={0} label="Total Artifacts" />
      </div>

      {/* Upcoming Workshops - placeholder */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              <h2 className="text-xl font-semibold">Upcoming Workshops</h2>
            </CardTitle>
            <Button size="sm" disabled>
              Manage Workshops
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Calendar className="size-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Workshop management is coming soon.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
