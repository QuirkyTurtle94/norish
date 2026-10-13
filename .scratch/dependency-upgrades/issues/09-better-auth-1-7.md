# 09 — Better Auth 1.7

Status: ready-for-agent
Blocked by: 08. Ticket 10 lands in the same commit.
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`

## What to build

Move every `@better-auth/*` package and `better-auth` to the 1.7 line (1.7.7 at research time). `@better-auth/utils` stays at 0.4.2, which is still the exact peer.

For Norish, 1.7 is a migration, not a bump. Each item below comes from the 1.7.7 tarball diff and the 1.7 upgrade guide.

1. **The Redis secondary storage gains `increment` and `getAndDelete`** (`packages/auth/src/auth.ts`, `secondaryStorage`).
   - **Why.** Without `increment`, every rate-limited `/api/auth` request throws ("Secondary-storage rate limiting requires SecondaryStorage.increment").
   - **How.**
     - Use `GETDEL` (Redis ≥ 6.2; compose ships 8.10.1).
     - Use `INCR` with the expiry set on the first increment, through Lua or `MULTI`.
     - **Prefix the new counter keys.** The existing `ip|path` rate-limit keys hold JSON, so `INCR` on them would error during the first window after deploy.
   - **Landing early.** This part can land before the bump: on 1.6.33 it makes rate limiting atomic.
2. **The generic OAuth plugin was rewritten.**
   - **Removed.** The plugin's own endpoints (`/sign-in/oauth2`, `/oauth2/callback/:providerId`, `/oauth2/link`) are gone, and so is `genericOAuthClient`.
   - **Client side.** Drop `genericOAuthClient` from `apps/web/lib/auth/client.ts` and `packages/shared/src/lib/auth/client.ts`.
   - **Sign-in calls.** `signIn.oauth2(...)` becomes `signIn.social({ provider: "oidc" })` at `apps/web/app/(auth)/login/components/provider-button.tsx` and `auto-sign-in.tsx`.
3. **The OIDC callback URL moves.** It becomes `/api/auth/callback/oidc`; today it is `/api/auth/oauth2/callback/oidc`, as documented in `apps/docs/docs/configuration/authentication.md`.
   - **Impact.** Every self-hoster's identity-provider registration breaks unless Norish keeps the old URL working.
   - **Decision (2026-10-13): the old URL keeps working**, because self-hosters take no manual steps.
     - Set `redirectURI` to the absolute legacy URL. In 1.7.7 a generic-OAuth `redirectURI` wins in both the authorize URL (`core oauth2/create-authorization-url.mjs:29`) and the token exchange (`validate-authorization-code.mjs:41`).
     - Forward `/api/auth/oauth2/callback/[id]` to `/api/auth/callback/[id]` with the query string intact. Without it the catch-all `apps/web/app/api/auth/[...all]/route.ts` answers 404, because 1.7.7 has no `/oauth2/callback` endpoint.
     - Prove it with an OIDC test. Document the new URL; the old one stays until a later release deprecates it.
4. **The account id is read from `profile.sub`** when discovery lists `id_token_signing_alg_values_supported` (`generic-oauth/index.mjs:102,140-146`). Norish's custom `getUserInfo` returns only `id`, so every OIDC login would throw `OAUTH_ACCOUNT_SUBJECT_INVALID` and redirect with `unable_to_get_user_info`. Return `sub` as well. Stored rows hold `accountId = sub` (1.6 used `getUserInfo().id`, which Norish sets to `sub`), so existing `account` rows still match.
5. **ID tokens are verified** against the discovery JWKS, issuer, audience and nonce. HS256-signed ID tokens fail; an Authentik provider without a signing key does this, though that is unverified. → Upgrade note.
6. **Discovery is fetched once, at startup.** If the IdP is down at that moment, OIDC stays disabled until Norish restarts. → Upgrade note. A retry is a possible follow-up.
7. **Sign-out redirects to the IdP's end-session URL.** That races Norish's own `window.location.href = "/login?logout=true"` (`apps/web/context/user-context.tsx`). Set `disableProviderLogout: true`; IdP logout is a later improvement.

**Not breaking:**

- Cookie names and signing, the Redis session format and the session defaults are unchanged, so users stay signed in. Only OAuth logins that are in flight at deploy time fail.
- No table or column changes; the `apikey` schema is identical too. Accounts are still keyed on `(providerId, accountId)` (`findAccountOwnerByKey`). The `issuer` column and its backfill that `.scratch/dependency-security/` ticket 07 planned existed only in 1.7.0–1.7.2; 1.7.3 removed them (`core dist/db/schema-diff.mjs:81`).
- The error code `email_doesn't_match` is renamed `email_does_not_match`; Norish doesn't read it.
- `oidcProvider` and MCP moved to separate packages, which Norish doesn't use.
- `experimental.joins` became `advanced.database.joins`, and stays off.
- `rateLimit.customStorage` now takes only `consume`, which Norish doesn't use.
- `getIp` is renamed `getIP`; Norish doesn't import it.
- Origin and relative-URL checks are stricter; Norish uses plain paths.
- `validateSchema` is skipped, because the encrypted-email adapter wrapper is a new object.
- The api-key plugin is unchanged.

## Acceptance criteria

- [ ] **Versions.** Every `@better-auth/*` package is on 1.7.x and utils on 0.4.2, with one copy each. `@better-auth/expo` is gone (ticket 23).
- [ ] **Rate limiting is tested with the limiter on.** The new storage methods have unit tests, and at least one automated run has rate limiting on: `AUTH_RATE_LIMIT_ENABLED=true` in an integration test or an E2E variant. The E2E harness turns it off (`production-stack.ts`), so the suite can't catch item 1 as it stands.
- [ ] **OIDC end to end:**
  - first login;
  - returning login, matching the existing account row;
  - the legacy redirect URI still works;
  - an IdP that is down at startup behaves as documented;
  - sign-out lands on `/login`.
- [ ] **Unchanged flows.** GitHub, Google, password and API keys (REST and WebSocket) behave as before.
- [ ] **Schema.** `pnpm db:generate` produces no migration.
- [ ] **Gates and type check.** The gates, `pnpm typecheck` and E2E pass.
- [ ] **Docs and Upgrade notes.**
  - `authentication.md` shows the new callback URL, and the legacy one for as long as it works.
  - The 0.26 Upgrade notes cover: ID tokens must be RS- or ES-signed; the IdP must be reachable when Norish starts; sign-out still doesn't end the IdP session.

## Comments

- Filed 2026-10-12 with the spec.
- Later improvements, out of scope here:
  - `requireIdTokenVerification: true`, since token claims grant server admin and households;
  - IdP logout through `postLogoutRedirectURI`;
  - `user.validateUserInfo` in place of the registration gate in `databaseHooks.user.create.before`;
  - `authClient.hydrateSession`, to skip the first `/get-session`;
  - a `TRUSTED_PROXIES` setting mapped to `advanced.ipAddress.trustedProxies`.
- 2026-10-13 — Checked against the 1.6.33 and 1.7.7 tarballs: no schema change and no backfill; the `sub` fix and the callback forward are required; `trustedProviders` behaves as in 1.6. The legacy-URL decision is made. Ticket 10's `disableImplicitLinking` lands in the same commit.
