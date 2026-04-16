'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Calendar, Plus } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { WorkshopCard } from './_components/workshop-card'

export default function WorkshopsPage() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming')
  const meQuery = trpc.user.getMe.useQuery()
  const workshopsQuery = trpc.workshop.list.useQuery({ filter: activeTab })

  const canManage =
    meQuery.data?.role === 'workshop_moderator' || meQuery.data?.role === 'admin'

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Workshops</h1>
        {canManage && (
          <Button render={<Link href="/workshop-manage/new" />}>
            <Plus className="size-4" />
            Create Workshop
          </Button>
        )}
      </div>

      <Tabs
        defaultValue="upcoming"
        onValueChange={(val) => setActiveTab(val as 'upcoming' | 'past')}
      >
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-4">
          <WorkshopGrid
            workshops={workshopsQuery.data}
            isLoading={workshopsQuery.isLoading}
            canManage={canManage}
            emptyHeading="No upcoming workshops"
            emptyBody="Create a workshop event to organize your next consultation session."
          />
        </TabsContent>

        <TabsContent value="past" className="mt-4">
          <WorkshopGrid
            workshops={workshopsQuery.data}
            isLoading={workshopsQuery.isLoading}
            canManage={canManage}
            emptyHeading="No past workshops"
            emptyBody="Completed workshops will appear here once their scheduled date has passed."
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface WorkshopGridProps {
  workshops: Array<{
    id: string
    title: string
    description: string | null
    scheduledAt: string | Date
    durationMinutes: number | null
    registrationLink: string | null
    createdBy: string
    createdAt: string | Date
    updatedAt: string | Date
    creatorName: string | null
  }> | undefined
  isLoading: boolean
  canManage: boolean
  emptyHeading: string
  emptyBody: string
}

function WorkshopGrid({ workshops, isLoading, canManage, emptyHeading, emptyBody }: WorkshopGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border p-4">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    )
  }

  if (!workshops || workshops.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Calendar className="size-12 text-muted-foreground" />
        <h2 className="mt-4 text-lg font-semibold">{emptyHeading}</h2>
        <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
          {emptyBody}
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {workshops.map((workshop) => (
        <WorkshopCard
          key={workshop.id}
          workshop={workshop}
          canManage={canManage}
        />
      ))}
    </div>
  )
}
