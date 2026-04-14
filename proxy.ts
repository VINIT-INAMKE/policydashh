import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  '/api/inngest(.*)',
  '/portal(.*)',
  '/api/export/policy-pdf(.*)',
  // Phase 19 — public intake form + submit endpoint (INTAKE-01, INTAKE-07)
  '/participate(.*)',
  '/api/intake(.*)',
  // Phase 20 — public workshops listing + cal.com registration (WS-08, D-08)
  '/workshops(.*)',
  // Phase 20.5 — public research + framework content pages (PUB-06, PUB-07, PUB-08)
  '/research(.*)',
  '/framework(.*)',
])

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
