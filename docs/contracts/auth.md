---
type: contract
description: Read when changing sign-in, sign-up, account, theme sync, or how the Clerk session reaches Convex.
version: 1.0.0
status: current
---

# Auth

Players sign in with Clerk through app-owned UI, and the same session authenticates
every Convex call. The UI in `src/lib/auth` is copied from the shared
[auth standard](../standards/auth.md); i18n runtime is app-owned too, in
`src/lib/i18n`.

## Behavior

- `src/lib/auth` owns the Clerk-backed sign-in, sign-up and account UI, theme sync,
  and the dev-only test-login button. Reuse its exports; never use Clerk's prebuilt UI
  components (`<SignInButton>`, `<UserButton>`).
- `src/integrations/clerk/provider.tsx`: `ClerkProvider` wraps `AuthConfigProvider`
  (config in `src/lib/auth-config.ts`: app name, route paths for sign-in, sign-up,
  forgot-password and account, and the `afterAuth` redirect).
- `src/integrations/convex/provider.tsx` must use `ConvexProviderWithClerk` (from
  `convex/react-clerk`) with Clerk's `useAuth`, not a bare `ConvexProvider`; otherwise
  the JWT never reaches Convex.
- `src/routes/{sign-in,sign-up,forgot-password,account}.tsx` are thin wrappers around
  `#/lib/auth`'s `AuthCard` and form components; `src/components/Header.tsx` uses its
  `HeaderUser`.
- "Delete account" on `/account` (`src/components/account/DeleteAccount.tsx`) and the
  app's Profile run the same steps, `@arcadeclub/core/account-deletion`: `account.deleteMyData`
  with `expectedSubject` until `done`, then the Clerk user, then sign-out. Refusals
  (`accountInActiveGame`, `accountChanged`) show localized; a rerun resumes.
- Theme (light, dark, auto) is driven by `#/lib/auth`'s
  `getInitialMode`/`applyThemeMode`/`setThemeMode`, `ThemeSync` (reconciles with Clerk
  `unsafeMetadata` on sign-in) and the `THEME_INIT_SCRIPT` inline pre-paint script in
  `src/routes/__root.tsx`. There is no second local copy of this logic.
- Every Convex deployment needs `CLERK_JWT_ISSUER_DOMAIN`; without it Convex never
  validates the Clerk JWT and `ctx.auth.getUserIdentity()` silently returns
  `undefined` ([environment](../runbooks/environment.md)).

## Acceptance

- `src/lib/auth/__tests__`, `src/lib/auth/components/auth/__tests__` and
  `src/lib/account/__tests__` pass.
