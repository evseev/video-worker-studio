import { test, expect } from "@playwright/test";

test.describe("Critical Path", () => {
  test("login page loads and shows sign-in form", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/Video Worker/);
    // Login page should have email/password inputs or OAuth buttons
    const hasForm =
      (await page.locator("input[type='email'], input[type='password']").count()) > 0 ||
      (await page.locator("button, a").filter({ hasText: /sign in|log in|github/i }).count()) > 0;
    expect(hasForm).toBe(true);
  });

  test("unauthenticated user is redirected to login", async ({ page }) => {
    await page.goto("/");
    // Should redirect to /login since no session
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("/login");
  });

  test("unauthenticated access to wizard redirects to login", async ({ page }) => {
    await page.goto("/wizard/some-fake-id");
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("/login");
  });

  test("unauthenticated access to project detail redirects to login", async ({ page }) => {
    await page.goto("/projects/some-fake-id");
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("/login");
  });

  // Note: API auth tests (401 without cookies) are covered by unit tests in
  // src/__tests__/lib/api/with-auth.test.ts. E2E API tests are environment-dependent
  // because Supabase local dev may return different statuses based on cookie state.
});
