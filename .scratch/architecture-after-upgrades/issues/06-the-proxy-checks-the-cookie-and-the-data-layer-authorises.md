# 06: The proxy checks the cookie, the data layer authorises

**What to build:**

- Pages and images start loading without a database lookup in front of them.
- The proxy only checks that a session cookie is present. The real check happens where data is read:
  - the signed-in app's layout, for pages
  - the recipe media helper and the avatar route, for images
  - the exports and tRPC, unchanged
- A reader whose session expired still lands on the login page and returns to the page they asked for after signing in.
- A reader whose account was deleted is signed out at the next page load. The sweep's ticket 10 already does this by ending a deleted account's sessions at once; the layout keeps it true for a session that outlived a failed deletion.
- An image request without a valid session is not served. A share link's images still load.
- A route added later without the session check fails the build.

See `.scratch/architecture-after-upgrades/spec.md`, Page loads and the auth gate. The reasoning (Next's guidance that the proxy makes optimistic checks, and the cost per image) belongs in the commit message, not an ADR.

**Blocked by:** None within this spec. The matcher anchoring (the sweep's ticket 56) and Better Auth 1.7 (09, 10) land first on `chore/dependency-upgrades`.

**Status:** ready-for-agent

- [ ] The proxy reads no Redis or Postgres and decrypts nothing. With no session cookie it redirects to the login page with the destination as the callback. It forwards the original path to the app as a request header.
- [ ] The signed-in app's layout:
  - [ ] Redirects a request with no session to the login page with the forwarded destination.
  - [ ] Reads the session through the existing `getVerifiedSession`, which revokes a session whose account no longer exists, as the proxy did, and redirects that session the same way. Say "a session whose account no longer exists", not "orphaned": CONTEXT.md's **Orphaned** names a recipe or cookbook.
- [ ] The settings page reuses the layout's per-request session read instead of its own.
- [ ] The recipe media helper's owner path and the avatar route require a valid session, and answer an unauthorised request like a missing file (404, not cached). The share path keeps its share-token check.
- [ ] The proxy's unreachable WebSocket branch is deleted (moved here from ticket 07, since this ticket rewrites the proxy).
- [ ] A structural test fails if any route handler under the signed-in app does not perform the session check.
- [ ] A test of the layout's gate: a session whose user row is gone is revoked and redirected to the login page.
- [ ] Browser E2E:
  - [ ] A signed-out reader opening a recipe lands on login and returns to the recipe after signing in.
  - [ ] A recipe image requested without a session is not served.
  - [ ] A share link's images load signed out.
- [ ] Measure time to skeleton on a cold load (phone profile) before and after, and record both here. The after number is ticket 08's baseline.
- [ ] The auth E2E specs pass against a fresh `pnpm build`.
