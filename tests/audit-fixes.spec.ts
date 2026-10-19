import { test, expect } from "@playwright/test";
import { mockBackend, userA, userB, productA, productB } from "./mock-backend";

test.beforeEach(async ({ page }) => {
  await page.route("https://v1.pinimg.com/**", (r) => r.abort());
});

test("Disabled storage and wrongly typed saved data never crash the storefront", async ({
  browser,
}) => {
  for (const variant of ["blocked", "corrupt"]) {
    const context = await browser.newContext();
    await context.route("https://v1.pinimg.com/**", (r) => r.abort());
    await context.addInitScript((kind) => {
      if (kind === "blocked")
        Storage.prototype.setItem = function () {
          throw new DOMException("Blocked", "SecurityError");
        };
      else {
        localStorage.setItem("mn-cart", JSON.stringify("bad-cart"));
        localStorage.setItem("mn-wish", JSON.stringify({ bad: true }));
      }
    }, variant);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Rare.");
    await page.goto("/products");
    await page.locator(".product-card").first().hover();
    await page.locator(".quick-add").first().click();
    await page.locator(".bag-button").click();
    await expect(page.locator(".cart-item")).toHaveCount(1);
    expect(errors).toEqual([]);
    await context.close();
  }
});

test("Deleted and out-of-stock items are removed and overstock quantities are clamped", async ({
  page,
}) => {
  await page.addInitScript((id) => {
    if (sessionStorage.getItem("cart-fixture-seeded")) return;
    sessionStorage.setItem("cart-fixture-seeded", "yes");
    localStorage.setItem(
      "mn-cart",
      JSON.stringify([
        { id: "deleted-product", qty: 1 },
        { id, qty: 99 },
        { id: "00000000-0000-4000-8000-000000000025", qty: 1 },
      ]),
    );
  }, productA);
  await page.goto("/checkout");
  await expect(page.locator(".summary-item")).toHaveCount(1);
  await expect(page.locator(".summary-item")).toContainText("20 ×");
  await page.evaluate(() =>
    localStorage.setItem(
      "mn-cart",
      JSON.stringify([{ id: "deleted-product", qty: 1 }]),
    ),
  );
  await page.reload();
  await expect(page.locator("h1")).toHaveText("Your bag is empty.");
  await expect(page.locator(".checkout-layout")).toHaveCount(0);
  await expect(page.locator(".bag-button b")).toHaveCount(0);
});

test("Bestseller membership is stable after catalog sorting and when its own list is re-sorted", async ({
  page,
}) => {
  await page.goto("/bestsellers");
  const expected = (
    await page.locator(".product-info h3").allTextContents()
  ).sort();
  await page.goto("/products");
  await page
    .getByRole("combobox", { name: "Sort products", exact: true })
    .selectOption("low");
  await page.locator('.desktop-nav a[href="/bestsellers"]').click();
  await expect(page).toHaveURL(/\/bestsellers$/);
  await expect(page.locator(".product-card")).toHaveCount(12);
  expect(
    (await page.locator(".product-info h3").allTextContents()).sort(),
  ).toEqual(expected);
  await page
    .getByRole("combobox", { name: "Sort products", exact: true })
    .selectOption("low");
  expect(
    (await page.locator(".product-info h3").allTextContents()).sort(),
  ).toEqual(expected);
});

test("Products above the old 7000 EGP limit remain discoverable with named filters", async ({
  page,
}) => {
  await page.route(/\/src\/data\.ts(?:\?.*)?$/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()).replace("3200", "7500"),
    });
  });
  await page.goto("/products");
  await expect(page.locator(".product-card")).toHaveCount(90);
  await expect(
    page.locator(".product-info h3").filter({ hasText: "Bleu de Chanel" }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("slider", { name: "Maximum price" }),
  ).toHaveAttribute("max", "7500");
  await expect(
    page.getByRole("combobox", { name: "House or brand" }),
  ).toBeVisible();
});

test("English/Arabic headers fit 320px and the mobile contact icon is clickable above the sticky bar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  for (const lang of ["en", "ar"]) {
    await page.goto("/");
    if ((await page.locator("html").getAttribute("lang")) !== lang)
      await page.locator(".language").click();
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.goto("/products/" + productA);
    expect(
      await page.locator(".whatsapp").evaluate((e) => {
        const r = e.getBoundingClientRect();
        const top = document.elementFromPoint(
          r.x + r.width / 2,
          r.y + r.height / 2,
        );
        return top === e || e.contains(top);
      }),
    ).toBeTruthy();
    await page.locator(".whatsapp").click();
    await expect(page).toHaveURL(/\/contact$/);
  }
});

test("Clipboard rejection is reported honestly, and Escape closes global search", async ({
  page,
}) => {
  await page.goto("/offers");
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: () =>
          Promise.reject(new DOMException("Denied", "NotAllowedError")),
      },
    }),
  );
  await page.locator(".coupon-copy").click();
  await expect(page.locator(".toast")).toContainText("Could not copy");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.locator(".search-panel")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".search-panel")).toHaveCount(0);
});

test("Saved fragrances can be browsed, survive reload, and can be removed", async ({
  page,
}) => {
  await page.goto("/products");
  await page.locator(".wishlist").first().click();
  await page.locator('.footer-main a[href="/wishlist"]').click();
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page.locator(".wishlist").click();
  await expect(page.locator(".product-card")).toHaveCount(0);
  await expect(page.locator(".empty")).toContainText("No fragrances found");
});

test("Switching accounts does not copy a previous account bag into the new account", async ({
  page,
}) => {
  await mockBackend(page);
  await page.goto("/account");
  await expect(page.locator(".bag-button b")).toHaveText("1");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.locator(".bag-button b")).toHaveCount(0);
  await page.evaluate((id) => (window as any).audit.login(id), userB);
  await expect(page.locator(".bag-button b")).toHaveText("1");
  await expect
    .poll(() =>
      page.evaluate((id) => (window as any).audit.carts[id].items, userB),
    )
    .toEqual([{ id: productB, qty: 1 }]);
  await page.locator(".bag-button").click();
  await expect(page.locator(".cart-item h3")).toHaveText("Sauvage");
  expect(
    await page.evaluate(
      (id) => JSON.parse(localStorage.getItem("mn-cart:" + id) || "[]"),
      userA,
    ),
  ).toEqual([{ id: productA, qty: 1 }]);
});

test("A late cart response cannot cross an account boundary", async ({
  page,
}) => {
  await mockBackend(page, { cartDelay: 400 });
  await page.goto("/account");
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  await page.evaluate((id) => (window as any).audit.login(id), userB);
  await expect(page.locator(".bag-button b")).toHaveText("1");
  await page.waitForTimeout(500);
  await page.locator(".bag-button").click();
  await expect(page.locator(".cart-item h3")).toHaveText("Sauvage");
  expect(
    await page.evaluate((id) => (window as any).audit.carts[id].items, userB),
  ).toEqual([{ id: productB, qty: 1 }]);
});

test("An explicit guest sign-in still transfers the guest bag without duplicating quantities", async ({
  page,
}) => {
  await mockBackend(page, { initialUser: null });
  await page.goto("/products");
  await page.locator(".product-card").first().hover();
  await page.locator(".quick-add").first().click();
  await page.evaluate((id) => (window as any).audit.login(id), userB);
  await expect(page.locator(".bag-button b")).toHaveText("2");
  await expect
    .poll(() =>
      page.evaluate(
        (id) => (window as any).audit.carts[id].items.length,
        userB,
      ),
    )
    .toBe(2);
});

test("A lost checkout response retains the same idempotency key after reloading and retrying", async ({
  page,
}) => {
  await mockBackend(page, { loseFirstOrderResponse: true });
  await page.goto("/checkout");
  await expect(page.locator(".summary-item")).toHaveCount(1);
  const fill = async () => {
    await page.getByLabel("Full name", { exact: true }).fill("Audit customer");
    await page.getByLabel("Phone number", { exact: true }).fill("01012345678");
    await page
      .getByLabel("Delivery address", { exact: true })
      .fill("Audit street address");
  };
  await fill();
  await page.getByRole("button", { name: "Place order", exact: true }).click();
  await expect(page.locator(".toast")).toContainText("Order response lost");
  const first = await page.evaluate(
    () => (window as any).audit.requests[0].idempotency_key,
  );
  expect(first).toMatch(/^[0-9a-f-]{36}$/);
  await page.reload();
  await expect(page.locator(".summary-item")).toHaveCount(1);
  await fill();
  await page.getByRole("button", { name: "Place order", exact: true }).click();
  await expect(page.locator("h1")).toHaveText("Your order is being prepared.");
  expect(
    await page.evaluate(
      () => (window as any).audit.requests[1].idempotency_key,
    ),
  ).toBe(first);
});

test("Cash collection needs explicit admin confirmation and updates paid revenue", async ({
  page,
}) => {
  await mockBackend(page, { admin: true });
  await page.goto("/admin");
  await page.getByRole("button", { name: "Orders", exact: true }).click();
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Record cash received" }).click();
  expect(await page.evaluate(() => (window as any).audit.receipts.length)).toBe(
    0,
  );
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Record cash received" }).click();
  await expect(
    page.getByRole("button", { name: "Record cash received" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => (window as any).audit.receipts[0].name),
  ).toBe("collect_cod_payment");
  await page.getByRole("button", { name: "Reports", exact: true }).click();
  await expect(page.locator(".report-cards")).toContainText("3,260 EGP");
});

test("Password reset requests use a safe generic response and the recovery route validates confirmation", async ({
  page,
}) => {
  await mockBackend(page, { initialUser: null });
  await page.goto("/account");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page
    .getByLabel("Email address", { exact: true })
    .fill("recover@example.invalid");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.locator(".toast")).toContainText("If an account exists");
  expect(
    await page.evaluate(() => (window as any).audit.recovery[0].redirectTo),
  ).toContain("/reset-password");
  await page.goto("/reset-password");
  await expect(
    page.getByText("This reset link is missing or expired.", { exact: false }),
  ).toBeVisible();
  await page.evaluate((id) => (window as any).audit.login(id), userA);
  await page
    .getByLabel("New password", { exact: true })
    .fill("test-password-new");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("different-test-password");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.locator(".toast")).toContainText("do not match");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("test-password-new");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.locator(".toast")).toContainText("Password updated");
});

test("Page metadata follows route and language; preview/private pages are not indexed", async ({
  page,
}) => {
  await page.goto("/products");
  await expect(page).toHaveTitle("The Fragrance Collection | MAISON NOIR");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/products$/,
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex,follow",
  );
  await page.locator(".product-card .product-info a").first().click();
  await expect(page).toHaveTitle("Bleu de Chanel | MAISON NOIR");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /CHANEL/,
  );
  await expect(page.locator("#product-jsonld")).toHaveCount(0);
  await page.locator(".language").click();
  await expect(page).toHaveTitle(/بلو دو شانيل/);
  await page.goto("/account");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex,follow",
  );
  const robots = await page.request.get("/robots.txt");
  expect(await robots.text()).toContain("Disallow: /admin");
});

test("A configured but unavailable catalog never silently substitutes demonstration stock", async ({
  page,
}) => {
  await mockBackend(page, { failCatalog: true });
  await page.goto("/products");
  await expect(page.locator(".catalog-notice")).toContainText(
    "temporarily unavailable",
  );
  await expect(page.locator(".product-card")).toHaveCount(0);
  await page.evaluate(() => ((window as any).audit.failCatalog = false));
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.locator(".product-card")).toHaveCount(90);
  await expect(page.locator(".catalog-notice")).toHaveCount(0);
});

test("An in-flight order from account A cannot clear account B’s bag or expose A’s form", async ({
  page,
}) => {
  await mockBackend(page, { orderResponseDelay: 600 });
  await page.goto("/checkout");
  await expect(page.locator(".summary-item")).toHaveCount(1);
  await page
    .getByLabel("Full name", { exact: true })
    .fill("Account A customer");
  await page.getByLabel("Phone number", { exact: true }).fill("01012345678");
  await page
    .getByLabel("Delivery address", { exact: true })
    .fill("Account A address");
  await page.getByRole("button", { name: "Place order", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).audit.requests.length))
    .toBe(1);
  await page.evaluate((id) => (window as any).audit.login(id), userB);
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue("");
  await page.waitForTimeout(700);
  await expect(page.locator(".bag-button b")).toHaveText("1");
  await expect(page.locator(".summary-item")).toContainText("Sauvage");
});

test("Automated accessibility checks find no WCAG A/AA violations on core bilingual pages", async ({
  page,
}) => {
  test.setTimeout(60000);
  for (const language of ["en", "ar"]) {
    await page.goto("/");
    await page.evaluate(
      (lang) => localStorage.setItem("mn-language", JSON.stringify(lang)),
      language,
    );
    for (const path of [
      "/",
      "/products",
      "/products/" + productA,
      "/offers",
      "/contact",
      "/account",
    ]) {
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
      const violations = await page.evaluate(async () => {
        const result = await (window as any).axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
        });
        return result.violations.map((v: any) => ({
          id: v.id,
          targets: v.nodes.map((n: any) => n.target),
        }));
      });
      expect(violations, `${language} ${path}`).toEqual([]);
    }
  }
});
