---
status: awaiting_human_verify
trigger: "Admin user management / role assignment doesn't work at all. The Manage Users button doesn't navigate anywhere. Both role assignment on existing users AND invite-with-role are broken. This has never worked."
created: 2026-04-12T00:00:00Z
updated: 2026-04-12T00:01:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED — Three distinct issues:
  1. "Manage Users" button in admin-dashboard.tsx has a TODO comment with href="/dashboard" instead of "/users"
  2. users-client.tsx has no role-change UI — only a static Badge with another TODO comment saying "Replace with a role-change dropdown when role update mutation is available"
  3. The tRPC user router has no updateRole mutation — the `user:manage_roles` permission exists in permissions.ts but no router procedure uses it
test: all three confirmed by reading source files
expecting: fix all three to make user management fully functional
next_action: fix admin-dashboard.tsx button href, add updateRole mutation to user.ts router, add role-change dropdown to users-client.tsx

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Admin can manage users — change roles via /users page, invite users with pre-assigned roles. Both should work.
actual: "Manage Users" button doesn't take the user anywhere — clicking it does nothing or navigates to a dead end. Role changes don't persist. Invites with roles don't work.
errors: No specific error messages reported — button simply doesn't navigate.
reproduction: Log in as admin, try to click "Manage Users" button or navigate to user management.
started: Never worked — has been broken since it was built.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: Button onClick handler is broken / missing
  evidence: Button uses Next.js render prop pattern with Link — the mechanism is fine. The problem is the href target is wrong ("/dashboard" not "/users")
  timestamp: 2026-04-12T00:01:00Z

- hypothesis: /users route is missing or inaccessible
  evidence: app/(workspace)/users/page.tsx exists and correctly restricts to admin role. The route is valid and protected correctly.
  timestamp: 2026-04-12T00:01:00Z

- hypothesis: Invite mutation is broken
  evidence: invite mutation in user.ts is well-formed — uses Clerk invitations API, passes role via publicMetadata. The invite dialog calls it correctly. This works.
  timestamp: 2026-04-12T00:01:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-04-12T00:01:00Z
  checked: app/(workspace)/dashboard/_components/admin-dashboard.tsx line 137
  found: Button render={<Link href="/dashboard" />} with TODO comment "Replace /dashboard with /users once User Management page is built"
  implication: "Manage Users" button intentionally left pointing to /dashboard — it just reloads the dashboard. This is the navigation bug.

- timestamp: 2026-04-12T00:01:00Z
  checked: app/(workspace)/users/_components/users-client.tsx line 94
  found: Role column shows a static Badge — TODO comment says "Replace with a role-change dropdown when role update mutation is available"
  implication: Role editing UI was never built. Admin can see users but cannot change their roles.

- timestamp: 2026-04-12T00:01:00Z
  checked: src/server/routers/user.ts
  found: No updateRole procedure exists. The router has: getMe, updateProfile, invite, updateLastVisited, listUsers.
  implication: The tRPC mutation needed to change a user's role doesn't exist.

- timestamp: 2026-04-12T00:01:00Z
  checked: src/lib/permissions.ts
  found: 'user:manage_roles': [ROLES.ADMIN] permission IS defined — but nothing in the router uses it.
  implication: The permission is defined and ready; just needs a router procedure wired up.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: Three separate incomplete implementations left with TODO comments: (1) "Manage Users" button hardcoded to href="/dashboard" instead of "/users", (2) role column in users-client.tsx was a static Badge with no edit capability, (3) tRPC user router had no updateRole procedure despite user:manage_roles permission existing in permissions.ts.

fix: |
  1. admin-dashboard.tsx: changed Button href from "/dashboard" to "/users" and removed the TODO comment
  2. workspace-nav.tsx: added "/users" nav link visible only to admin role
  3. src/server/routers/user.ts: added updateRole mutation protected by requirePermission('user:manage_roles'), with NOT_FOUND guard, DB update, and audit log
  4. users-client.tsx: replaced static Badge with a Select dropdown wired to updateRole mutation; added toast success/error feedback and cache invalidation

verification: TypeScript type-check passes with no new errors. Only pre-existing error is in an unrelated workshop component.

files_changed:
  - app/(workspace)/dashboard/_components/admin-dashboard.tsx
  - app/(workspace)/_components/workspace-nav.tsx
  - src/server/routers/user.ts
  - app/(workspace)/users/_components/users-client.tsx
