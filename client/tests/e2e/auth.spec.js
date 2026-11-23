import { test, expect } from "@playwright/test";

test.describe("CIRQL authentication", () => {
  test("login page loads correctly", async ({ page }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: "Welcome back" })
    ).toBeVisible();

    await expect(
      page.getByLabel("Email address")
    ).toBeVisible();

    await expect(
      page.getByRole("textbox", { name: "Password" })
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: "Sign in" })
    ).toBeVisible();
  });

  test("login validates empty fields", async ({ page }) => {
    await page.goto("/login");

    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Email is required")).toBeVisible();
    await expect(page.getByText("Password is required")).toBeVisible();
  });

  test("register page loads correctly", async ({ page }) => {
    await page.goto("/register");

    await expect(
      page.getByRole("heading", { name: "Create your account" })
    ).toBeVisible();

    await expect(page.getByLabel("Full name")).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Password" })).toBeVisible();
  });

  test("registration validates invalid fields", async ({ page }) => {
    await page.goto("/register");

    await page.getByRole("button", { name: "Create account" }).click();

    await expect(
      page.getByText("Name must contain at least 2 characters")
    ).toBeVisible();

    await expect(
      page.getByText("Enter a valid email address")
    ).toBeVisible();

    await expect(
      page.getByText("Password must contain at least 8 characters")
    ).toBeVisible();
  });

  test("login and register navigation works", async ({ page }) => {
    await page.goto("/login");

    await page.getByRole("link", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/register$/);

    await page.getByRole("link", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/login$/);
  });

  test("protected settings route redirects unauthenticated users", async ({
    page,
  }) => {
    await page.goto("/settings");

    await expect(page).toHaveURL(/\/login$/);
  });

  test("unknown routes display the 404 page", async ({ page }) => {
    await page.goto("/this-route-does-not-exist");

    await expect(
      page.getByRole("heading", { name: "404" })
    ).toBeVisible();

    await expect(page.getByText("Page not found")).toBeVisible();
  });
});