import { test, expect } from "@playwright/test";

test.describe("CIRQL complete user workflow", () => {
  test.setTimeout(120000);

  test("register, create workspace, create channel, send message and verify responsive layout", async ({
    page,
  }) => {
    const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const user = {
      name: "CIRQL E2E Tester",
      email: `cirql-e2e-${uniqueId}@example.com`,
      password: "CirqlE2E!2026",
    };

    const workspaceName = `E2E Workspace ${uniqueId}`;
    const channelName = `e2e-${uniqueId}`;
    const messageText = `CIRQL E2E message ${uniqueId}`;

    page.on("console", (message) => {
      if (message.type() === "error") {
        console.log("BROWSER CONSOLE ERROR:", message.text());
      }
    });

    page.on("response", async (response) => {
      if (response.status() === 429) {
        console.log("RATE LIMITED URL:", response.url());
        console.log("RATE LIMITED METHOD:", response.request().method());

        try {
          console.log("RATE LIMITED RESPONSE:", await response.text());
        } catch {
          console.log("Could not read rate-limit response.");
        }
      }
    });

    page.on("pageerror", (error) => {
      console.log("BROWSER JAVASCRIPT ERROR:", error.message);
    });

    page.on("requestfailed", (request) => {
      console.log(
        "FAILED REQUEST:",
        request.method(),
        request.url(),
        request.failure()?.errorText,
      );
    });

    // 1. REGISTER A FRESH ACCOUNT
    await page.goto("/register");

    await page.getByLabel("Full name").fill(user.name);
    await page.getByLabel("Email address").fill(user.email);

    await page.getByRole("textbox", { name: "Password" }).fill(user.password);

    const registrationResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/auth/register") &&
        response.request().method() === "POST",
      { timeout: 15000 },
    );

    await page.getByRole("button", { name: "Create account" }).click();

    const registrationResponse = await registrationResponsePromise;

    console.log("REGISTRATION STATUS:", registrationResponse.status());

    expect(registrationResponse.status()).toBe(201);

    await expect(page).toHaveURL(/\/$/, { timeout: 15000 });

    console.log("REGISTRATION SUCCESSFUL:", page.url());

    // 2. VERIFY EMPTY WORKSPACE SCREEN
    await expect(
      page.getByRole("heading", { name: "Your team starts here" }),
    ).toBeVisible({ timeout: 20000 });

    // 3. CREATE WORKSPACE
    await page
      .getByRole("button", { name: /create workspace/i })
      .last()
      .click();

    await expect(
      page.getByRole("heading", { name: "Create a workspace" }),
    ).toBeVisible();

    await page.getByPlaceholder("e.g. Design Team").fill(workspaceName);

    await page
      .locator("form")
      .getByRole("button", {
        name: "Create workspace",
        exact: true,
      })
      .click();

    // 4. VERIFY EMPTY CHANNEL SCREEN
    await expect(
      page.getByRole("heading", { name: "No channels yet" }),
    ).toBeVisible({ timeout: 20000 });

    // 5. CREATE CHANNEL
    await page
      .getByRole("button", { name: /create channel/i })
      .last()
      .click();

    await expect(
      page.getByRole("heading", { name: "Create a channel" }),
    ).toBeVisible();

    await page.getByPlaceholder("e.g. development").fill(channelName);

    await page
      .locator("form")
      .getByRole("button", {
        name: "Create channel",
        exact: true,
      })
      .click();

    // 6. WAIT FOR CHANNEL COMPOSER
    const composer = page.getByPlaceholder(`Message #${channelName}...`);

    await expect(composer).toBeVisible({
      timeout: 30000,
    });

    // 7. SEND MESSAGE
    await composer.fill(messageText);

    await page.getByRole("button", { name: "Send message" }).click();

    // 8. VERIFY MESSAGE
    await expect(page.getByText(messageText, { exact: true }).first()).toBeVisible({
      timeout: 20000,
    });

    // 9. RESPONSIVE UI AUDIT
    const viewports = [
      {
        name: "Small mobile",
        width: 360,
        height: 800,
      },
      {
        name: "Tablet",
        width: 768,
        height: 1024,
      },
      {
        name: "Laptop",
        width: 1366,
        height: 768,
      },
      {
        name: "Desktop",
        width: 1920,
        height: 1080,
      },
    ];

    for (const viewport of viewports) {
      await test.step(`Responsive layout: ${viewport.name}`, async () => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });

        await page.waitForTimeout(300);

        const dimensions = await page.evaluate(() => ({
          viewportWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth,
          documentHeight: document.documentElement.scrollHeight,
        }));

        console.log(`RESPONSIVE ${viewport.name}:`, dimensions);

        expect(
          dimensions.documentWidth,
          `${viewport.name}: horizontal document overflow detected`,
        ).toBeLessThanOrEqual(viewport.width);

        expect(
          dimensions.bodyWidth,
          `${viewport.name}: horizontal body overflow detected`,
        ).toBeLessThanOrEqual(viewport.width);
      });
    }

    // 10. RESTORE ORIGINAL VIEWPORT
    await page.setViewportSize({
      width: 1280,
      height: 800,
    });

    console.log("RESPONSIVE AUDIT COMPLETED");
  });
});
