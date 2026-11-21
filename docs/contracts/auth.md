---
type: contract
description: Read when changing sign-in, sign-up, account, theme sync, or how the Clerk session reaches Convex.
version: 1.1.0
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
- `/account` (`ProfilePanel`) and the app's Profile edit the Clerk account's first and
  last name (`user.update`) and change the password (`user.updatePassword`, current and
  new). On the phone the name sits on Profile (`account-name-card.tsx`); a failed save
  keeps the typed name and shows the localized Clerk reason. Change password is its own
  pushed screen, `(tabs)/profile/change-password`, with the read-only email as
  `username` above the current and new fields (the auth standard's password-manager
  rules). Clerk reports a wrong current password as `form_password_validation_failed`
  on `current_password`, the weak-password code too, so the field name decides the
  message. If Clerk asks for reverification the screen offers "Sign in again". An
  account without a password (social or emailed-code sign-in only) gets no link and
  an explanation instead. Changing the email is on neither platform.
- On the phone, the display name other players see is not the account name. It stays
  the phone-local name (`use-player-identity.ts`), defaulting to the Clerk first name and
  otherwise "Player 123"; the web hosts as the Clerk first name
  (`use-host-session.ts`). Each seat stores the name it joined with
  (`sessionParticipants.displayName`), so renaming the account changes no existing room,
  and installed builds keep working unchanged. A new first name becomes the phone's
  default only where no display name is set.
- The Clerk login is the shared AppElent account (Gather, Foundry, Fairway, Arcade Club).
  "Delete account" on `/account` (a dialog in `src/components/account/DeleteAccount.tsx`)
  and the app's Profile (pushed `(tabs)/profile/delete-account`) first ask what to
  delete, then confirm it, and run the same steps, `@arcadeclub/core/account-deletion`,
  with a `DeletionScope`:
  - `app`, "Delete Arcade Club data only" (listed first): a recent sign-in (Clerk's
    "strict" reverification, checked with 5 of its 10 minutes), then
    `account.deleteMyData` with `expectedSubject` until `done`, then sign-out on this
    device. The Clerk user stays and nothing marks it, so a later sign-in starts an
    empty profile. The web lands on `/?deleted=app`, the app shows an alert; both say
    the login still works in the other apps.
  - `account`, "Delete my whole AppElent account": the same, then the Clerk user before
    the sign-out. It needs `user.deleteSelfEnabled`. Arcade Club has no Sign in with
    Apple, so there is nothing to revoke.

  An old sign-in stops before any data is deleted: the web opens Clerk's verify dialog
  (via `useReverification`); the app, which has no such dialog, refuses with
  `accountSignInFirst` and offers "Sign in again". If Clerk still refuses the user after
  the data is gone, both show `accountSignInToFinish`. Refusals (`accountInActiveGame`,
  `accountChanged`) show localized; a rerun resumes.
- `POST /clerk/webhook` (`convex/http.ts`) purges the data of a Clerk user deleted
  anywhere (another AppElent app, the Clerk dashboard) with the same
  `deleteAccountData` as `deleteMyData`, through `account.purgeDeletedUser`, which
  schedules itself until `done`. It checks the Svix signature against
  `CLERK_WEBHOOK_SECRET` within five minutes of the delivery's timestamp
  (`convex/lib/clerkWebhook.ts`): missing headers get 400, a bad or stale signature
  401, an unset secret 500, all with no side effects. Other event types and repeat
  deliveries return 200 and do nothing. An open game does not hold back this purge.
- "Download my data" on `/account` (`src/components/account/ExportData.tsx`) and the
  app's Profile run the same steps, `@arcadeclub/core/account-export`: every page of
  `account.exportMyData` (what each table exports: `convex/lib/accountExport.ts`),
  merged into `arcade-club-export-YYYY-MM-DD.json`. The web downloads it; the app adds
  what it keeps only on the phone under `localOnly` (`displayName`, `backgammon`,
  `seats` without their seat secret, `sudoku`; never the guest identity), writes the
  file to its cache and opens the share sheet.
- Theme (light, dark, auto) is driven by `#/lib/auth`'s
  `getInitialMode`/`applyThemeMode`/`setThemeMode`, `ThemeSync` (reconciles with Clerk
  `unsafeMetadata` on sign-in) and the `THEME_INIT_SCRIPT` inline pre-paint script in
  `src/routes/__root.tsx`. There is no second local copy of this logic.
- Every Convex deployment needs `CLERK_JWT_ISSUER_DOMAIN`; without it Convex never
  validates the Clerk JWT and `ctx.auth.getUserIdentity()` silently returns
  `undefined` ([environment](../runbooks/environment.md)).

## Acceptance

- `src/lib/auth/__tests__`, `src/lib/auth/components/auth/__tests__`,
  `src/lib/account/__tests__`, `convex/account.test.ts`, `convex/http.test.ts` and
  `convex/accountExport.test.ts` pass.
