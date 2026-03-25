import Link from 'next/link'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-background px-6 h-16 flex items-center justify-between">
        <span className="text-lg font-semibold">PolicyDash</span>
        <Link
          href="/portal"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Published Policies
        </Link>
      </header>
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12">
        {children}
      </main>
      <footer className="border-t px-6 py-4 text-sm text-muted-foreground flex items-center justify-between mt-16">
        <span>Published by PolicyDash</span>
        <Link
          href="/sign-in"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Internal Login
        </Link>
      </footer>
    </div>
  )
}
