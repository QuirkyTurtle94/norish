# 10 — Signing in never links accounts

Status: ready-for-agent
Blocked by: 09 (lands in the same commit)
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`

## What to build

**Today** (`packages/auth/src/auth.ts`, `accountLinking`): `enabled: true` with `trustedProviders: ["oidc", "google", "github"]`.

- Since Better Auth 1.6.11, signing in links a new SSO identity into an existing user only when that user's email is verified. Password users are never verified, so they are never linked.
- A user who first signed in with Google or GitHub _is_ verified. When they later sign in with OIDC under the same email, the identities are linked automatically, even when the IdP reports the email as unverified, because the provider is trusted. Norish's OIDC `getUserInfo` maps `emailVerified: email_verified ?? false`, so an IdP that doesn't send the claim produces exactly that case. That is the one takeover path no Better Auth version closes.

**Decision (2026-10-13): signing in never links.**

- Set `accountLinking.disableImplicitLinking: true` (supported in 1.6.33 and 1.7.7; `oauth2/link-account.mjs:139` in 1.7.7). A sign-in with an SSO identity whose email belongs to an existing user is refused with `account_not_linked`, whose copy already reads "This email is already in use."
- **Keep `trustedProviders`.** With implicit linking off it only governs linking from a signed-in session (`api/routes/account.mjs:207` and `oauth2/link-account.mjs:43` in 1.7.7). There the user has proven both accounts, Better Auth still requires the emails to match, and keeping the list lets IdPs that don't send `email_verified` be linked.
- **Linking from Settings** is its own feature spec, built in 0.26 once this lands. Until it exists, a user who wants a second provider has no way to add it; both ship in 0.26, so no release has that gap.

**Also: a deleted user's sessions end immediately.** `packages/shared-server/src/accounts/deletion.ts` should call `internalAdapter.deleteSessions(userId)`; today sessions are only revoked lazily, on the next request.

## Acceptance criteria

- [ ] **No implicit linking.** Tests cover a sign-in with Google, GitHub and OIDC whose email matches an existing verified user: each is refused with `account_not_linked` and creates no account row. A returning sign-in with an already-linked identity still works.
- [ ] **Session revocation.** A deleted user's sessions are gone straight away, with a test.
- [ ] **Docs.** `apps/docs/docs/configuration/authentication.md` says that signing in never links accounts and that providers are linked from Settings.
- [ ] **Release notes.** An Upgrade note: signing in with a second provider no longer links it to an existing account; link it from Settings.

## Comments

- Filed 2026-10-12 with the spec as "Account linking trusts only verified emails" (needs-triage).
- 2026-10-13 — The maintainer chose to turn implicit linking off rather than empty `trustedProviders`: emptying the list would also have refused linking from Settings for IdPs that don't send `email_verified`. No ADR; it is a configuration flag and easy to reverse.
