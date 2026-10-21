import { signIn } from "../harness/auth";
import { signUpThrowawayUser } from "./admin-users-support";
import { withDatabase } from "./database";
import { expect, test } from "./fixture";

for (const revoke of [true, false]) {
  test(`changes a password and ${revoke ? "revokes" : "preserves"} other sessions`, async ({
    aiStack,
    browser,
  }) => {
    const user = await signUpThrowawayUser(aiStack.baseURL, {
      email: `password-${revoke}@norish.test`,
      name: "Password test",
      password: "original-password-123",
    });
    const context = await browser.newContext({ baseURL: aiStack.baseURL });
    const other = await browser.newContext({ baseURL: aiStack.baseURL });

    try {
      await context.addCookies(await signIn(aiStack.baseURL, user));
      await other.addCookies(await signIn(aiStack.baseURL, user));
      const page = await context.newPage();

      await page.goto("/settings?tab=user");
      const current = page.getByLabel("Current password", { exact: true });
      const next = page.getByLabel("New password", { exact: true });
      const confirmation = page.getByLabel("Confirm new password", { exact: true });
      const submit = page.getByRole("button", { name: "Change password", exact: true });
      const form = page.locator("form").filter({ has: current });

      await current.fill(user.password);
      await next.fill("replacement-password-123");
      await confirmation.fill("different-password-123");
      await submit.click();
      await expect(form.getByRole("alert")).toHaveText("The new passwords do not match.");
      await confirmation.fill("replacement-password-123");
      await current.fill("incorrect-password");
      await submit.click();
      await expect(form.getByRole("alert")).toHaveText("The current password is incorrect.");
      await current.fill(user.password);
      if (!revoke) {
        await form.getByText("Sign out other sessions", { exact: true }).click();
        await expect(
          form.getByRole("switch", { name: "Sign out other sessions" })
        ).not.toBeChecked();
      }
      await submit.click();
      await expect(form.getByRole("status")).toHaveText("Password changed.");
      await expect(current).toHaveValue("");
      await expect(next).toHaveValue("");
      await expect(confirmation).toHaveValue("");
      const oldSession = await other.request.get("/api/auth/get-session?disableCookieCache=true");
      const session = await oldSession.json();

      if (revoke) expect(session).toBeNull();
      else expect(session.user.id).toBe(user.id);
      const oldLogin = await other.request.post("/api/auth/sign-in/email", {
        headers: { origin: aiStack.baseURL },
        data: { email: user.email, password: user.password },
      });

      expect(oldLogin.ok()).toBe(false);
      expect(
        await signIn(aiStack.baseURL, { ...user, password: "replacement-password-123" })
      ).not.toHaveLength(0);
    } finally {
      await context.close();
      await other.close();
    }
  });
}

test("does not offer a password form for an SSO-only account", async ({ aiStack, browser }) => {
  const user = await signUpThrowawayUser(aiStack.baseURL, {
    email: "password-sso@norish.test",
    name: "SSO test",
    password: "original-password-123",
  });
  const context = await browser.newContext({ baseURL: aiStack.baseURL });

  try {
    await context.addCookies(await signIn(aiStack.baseURL, user));
    await withDatabase((database) =>
      database.query(
        `update account set "providerId" = 'oidc', password = null where "userId" = $1`,
        [user.id]
      )
    );
    const page = await context.newPage();
    const accountsLoaded = page.waitForResponse(
      (response) => response.url().includes("/api/auth/list-accounts") && response.ok()
    );

    await page.goto("/settings?tab=user");
    await accountsLoaded;
    await expect(page.getByRole("button", { name: "Save changes", exact: true })).toBeVisible();
    await expect(page.getByLabel("Current password", { exact: true })).toHaveCount(0);
  } finally {
    await context.close();
  }
});
