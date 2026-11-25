---
type: contract
description: Read when changing sign-in, sign-up, account, theme sync, or how the Clerk session reaches Convex.
version: 1.10.0
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
- Web sign-in (`SignInForm`) takes email and password, or "Email me a sign-in code"
  (`useEmailCodeSignIn`, Clerk's `emailCode` first factor, as on the phone) for
  accounts without a password: the code step replaces the password step on the same
  screen, with resend and "Use a different email". Its labels and errors, on both
  paths, come from `messages.auth`, errors through `@arcadeclub/core/auth-errors` (Clerk
  code to catalog key), never Clerk's text. A step neither app offers (such as
  `needs_new_password`) says so (`unsupportedStep`) instead of finalizing.
- A password, emailed code or password reset that ends in `needs_second_factor` or
  `needs_client_trust` continues in a second step, on both apps. It depends only on the
  attempt's status, so any later way to sign in reaches it the same way.
  `@arcadeclub/core/second-factor` owns it (which factors, sending, verifying, locking,
  copy); the web's `SecondFactorStep` and the phone's `second-factor-step.tsx` only draw
  it, and the phone's `useSecondFactor` takes other actions than sign-in's. It handles
  an authenticator app, texted and emailed codes and backup codes, in that order, and
  switches between those the account has. Too many wrong codes
  lock that method only; an attempt Clerk dropped, or an account with no factor we can
  handle, shows what to do and "Back to sign in". Once a code is accepted, a retry only
  activates the session, so a one-time backup code is not sent again. The web swaps
  the form in place, so `?redirect=` is kept; the phone opens
  `(auth)/sign-in-second-factor`. "Back to sign in" drops
  the attempt; closed another way it stays unused, because every first step starts a
  new one. A first step answered after its phone screen lost focus opens nothing
  (`useOpenSecondFactor`). Reloading the web page reopens the step on the method last
  sent or tried, without sending a new code: the tab remembers the attempt's id and page
  until the step closes (`secondFactorResume.ts`), and resumes only that attempt; coming
  back to that page after a typed URL or a plain link resumes it too.
- Clerk writes every answer into one sign-in, so the web's sign-in forms count
  submits (`useSignInAttempt`). An answer to a superseded one does not
  finalize, navigate or change a form; one whose form was only closed still signs in,
  without navigating. Signing up supersedes it too. The code and second steps refuse to
  act on an attempt other than the one they opened for. A superseded sign-in leaves its
  session behind, so a next submit asks for a reload (`alreadySignedIn`), which signs in
  as that earlier account.
- Every auth form on the web (sign-in, sign-up, reset, `/account`, the dev test login)
  and on the phone reads Clerk failures through the one table in
  `@arcadeclub/core/auth-errors`; the web's `useAuthErrorText` turns the key into
  `messages.auth.errors` copy. An unknown code shows `errors.generic` in the page's
  language, never Clerk's English. The code inside `errors[]` wins over the wrapper's
  own `api_response_error`. A locked account (`user_locked`) shows Clerk's wait on
  every one, the phone's sign-in, sign-up and reset included (`pickClerkError` keeps
  it, `authErrorMessage` words it); a wait over 24 hours, or none, reads "try again
  later".
- `RequireSignedIn` sends a signed-out visitor to `/sign-in?redirect=<path>`, and
  sign-in returns there afterwards; `safeReturnPath` (`src/lib/auth/core.ts`) keeps only
  an in-app path, so the parameter cannot send anyone off the site. Without it, sign-in
  goes to `authConfig.paths.afterAuth`. `/sign-up` and `/forgot-password` take the
  same `redirect` and return there once signed in, and every link to an auth page
  carries it (`authPageHref`): sign-in's links to sign-up and reset, sign-up's link
  back, the header's "Sign in" and `HostGate`, which return to the page they sit on
  (`returnTarget`). An auth page is never a return target: `signInDestination` falls
  back to `afterAuth` for `/sign-in`, `/sign-up` or `/forgot-password`.
- `src/routes/{sign-in,sign-up,forgot-password,account}.tsx` are thin wrappers around
  `#/lib/auth`'s `AuthCard` and form components; `src/components/Header.tsx` uses its
  `HeaderUser`.
- `/account` (`ProfilePanel`) and the app's Profile edit the Clerk account's first and
  last name (`user.update`) and change the password (`user.updatePassword`, current and
  new). Both build that call with `passwordUpdate` (`@arcadeclub/core/account-password`),
  which passes `signOutOfOtherSessions: true`: a successful change signs the account out
  on every other device and browser, so a stolen session ends with the old password,
  while the session that made the change stays signed in; the success message says so.
  On the phone the name sits on Profile (`account-name-card.tsx`); a failed save keeps
  the typed name and shows the localized Clerk reason. Change password is its own pushed
  screen, `(tabs)/profile/change-password`, with the read-only email as
  `username` above the current and new fields (the auth standard's password-manager
  rules). Clerk reports a wrong current password as `form_password_validation_failed`
  on `current_password`, the weak-password code too, so the field name decides the
  message; `form_password_incorrect` alone also means the current password
  (`passwordFailure`, shared). On the web it sits under the current or the new
  password field, and any other failure shows above the panel. If Clerk asks for
  reverification the phone opens the verify sheet (below) over the screen, after
  trying the current password it just typed, so the person isn't asked for it twice:
  the sheet appears only when a second factor is still due or the password is
  locked out (it shows the wait). A wrong password goes back to the screen's own
  field, as one try, not into the sheet. Confirming retries the change once, on the same account
  and session, cancelling changes nothing, and only an account the sheet can't confirm
  is offered "Sign in again". Changing account meanwhile says so
  (`serverErrors.accountChanged`), not the generic failure. An account without a
  password (`passwordEnabled` false: social or emailed-code sign-in only) gets no link
  on the phone and no form on `/account`, and an explanation instead
  (`profile.password.none`). Changing the email is on neither platform.
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
  (via `useReverification`); the app opens its own verify sheet over the delete screen
  (`apps/mobile/src/features/profile/reverify`, Clerk's session verification at the
  "strict" level): the password when the account has one, with "Email me a code
  instead" when Clerk also offers a code, otherwise an emailed code. An account with a
  password can go back to it from the code step without cancelling. Confirming
  continues the deletion in the same session; cancelling deletes nothing. Two `verify`
  calls for the same account share one verification and one result.

  Failures show through `@arcadeclub/core/auth-errors`, a locked account with Clerk's
  wait when it gives one; session or permission faults are still reported to Sentry.
  They also close the sheet with `accountSessionEnded` or `accountSignInFirst` ("Sign
  in again"); once the data is gone both read `accountSignInToFinish`. Their copy,
  and `accountChanged`'s, names no task, because change password shows them too.
  Clerk signs the phone out on a real 401 before the call answers, which can take
  either screen away: a session end that arrives then (Change password without a user,
  or the screen gone) is shown in a native alert (`useUnseenEnd`, once per screen)
  instead of a notice nobody would see, with `accountSignInToFinish` once the data is
  gone; none follows a cancelled sheet. The session counts as ended (`asSessionEnd`) on
  Clerk's codes for it, and on any failure once Clerk has no user, whatever its code;
  "reverification required" while signed in does not. Signed out, Change password says
  `accountSessionEnded` and offers the sign-in.

  An account with two-step verification confirms with its second factor
  (authenticator app, texted code or backup code), the sign-in's step
  (`packages/core/src/second-factor.ts`). One whose second factor the app can't do
  gets `accountSecondFactorUnsupported`, before it types anything where Clerk tells,
  and no "Sign in again", which would only lock it out; if that shows up after the
  data is gone it gets `accountSecondFactorToFinish`, which says the data is deleted
  and to email for help, not to delete again. An account the sheet can't handle (no
  password or email code, such as social-only) gets `accountVerifyUnsupported` and
  "Sign in again", after which it returns to the delete screen (return target, below).
  If Clerk still refuses the user after the data is gone, the sheet opens once more;
  cancelled, the app shows `accountDeleteAgain`, and when it can't help,
  `accountSignInToFinish`; the web, where deleting again reopens Clerk's dialog, shows
  `accountDeleteAgain`. Refusals (`accountInActiveGame`, `accountChanged`) and a Clerk
  session that has ended (`accountSessionEnded`, "Sign in again" on the app, also when
  nobody is signed in) show localized; a rerun resumes.
- On the phone, the sign-in modal closes back to the screen it opened over (a guest on
  Profile, the host gate). "Sign in again" (delete account, change password) signs out
  first, which rebuilds the app on Play, so it sets a return target
  (`apps/mobile/src/auth/return-target.ts`) that the root navigator honours for the same
  account. Leaving the sign-in modal without signing in (Close, swipe, Android back)
  drops it.
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
- The AppElent account portal (account.appelent.nl) calls `convex/accountPortal.ts`
  with the shared Clerk `convex` token, per developer-home `standards/account-portal.md`
  (contract 1): `summary` (counts of seats, drafts and quiz sets, capped at 1,000;
  `lastActiveAt` null; null for a never-used caller), `deletionBlocker`
  (`accountInActiveGame` from `inActiveGame`) and `exportPage`, the in-app export's
  pages with its cursor as an opaque JSON string. None takes a user id or writes.
  `deleteAppData` follows APP-392.
- Theme (light, dark, auto) is driven by `#/lib/auth`'s
  `getInitialMode`/`applyThemeMode`/`setThemeMode`, `ThemeSync` (reconciles with Clerk
  `unsafeMetadata` on sign-in) and the `THEME_INIT_SCRIPT` inline pre-paint script in
  `src/routes/__root.tsx`. There is no second local copy of this logic.
- Every Convex deployment needs `CLERK_JWT_ISSUER_DOMAIN`; without it Convex never
  validates the Clerk JWT and `ctx.auth.getUserIdentity()` silently returns
  `undefined` ([environment](../runbooks/environment.md)).

## Acceptance

- `src/lib/auth/__tests__`, `src/lib/auth/components/auth/__tests__`,
  `src/lib/account/__tests__`, `packages/core/src/__tests__/auth-errors.test.ts`,
  `packages/core/src/__tests__/second-factor.test.ts`, the phone's
  `second-factor-screens.test.tsx`, its `profile/reverify` and change-password tests,
  `convex/account.test.ts`, `convex/http.test.ts`, `convex/accountExport.test.ts`
  and `convex/accountPortal.test.ts` pass.
