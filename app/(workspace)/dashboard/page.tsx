import { auth } from '@clerk/nextjs/server'

export default async function DashboardPage() {
  const { userId } = await auth()
  return (
    <div>
      <h2 className="text-2xl font-bold">Dashboard</h2>
      <p className="mt-2 text-gray-600">Welcome to PolicyDash. Your user ID: {userId}</p>
    </div>
  )
}
