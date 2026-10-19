import { test, expect } from "@playwright/test";
async function english(page: any, path = "/") {
  await page.goto(path);
  if ((await page.locator("html").getAttribute("lang")) === "ar")
    await page.getByRole("button", { name: "EN", exact: true }).click();
}
test("Arabic is default; language and direction persist", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("نادر");
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Rare.");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});
test("Catalog includes 90 products; live search, categories, size, and sorting work", async ({
  page,
}) => {
  await english(page, "/products");
  await expect(page.locator(".product-card")).toHaveCount(90);
  await page
    .getByPlaceholder("Search fragrance, brand, or type")
    .fill("Sauvage");
  await expect(page.locator(".product-card")).toHaveCount(1);
  await expect(page.locator(".product-info")).toContainText("DIOR");
  await page.getByPlaceholder("Search fragrance, brand, or type").fill("");
  await page
    .locator(".filters")
    .getByRole("radio", { name: /For Her/ })
    .click();
  await expect(page.locator(".product-card")).toHaveCount(25);
  await page.getByRole("button", { name: "90ml", exact: true }).click();
  await expect(page.locator(".product-card")).toHaveCount(2);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Sort products" })
    .selectOption("low");
  await expect(page.locator(".price").first()).toContainText("150");
});
test("Offers are discounted; bestsellers contains twelve", async ({ page }) => {
  await english(page, "/offers");
  const cards = page.locator(".product-card");
  expect(await cards.count()).toBeGreaterThan(0);
  await expect(page.locator(".product-badge.sale")).toHaveCount(
    await cards.count(),
  );
  await expect(page.locator(".card-offer-timer")).toHaveCount(
    await cards.count(),
  );
  await page.goto("/bestsellers");
  await expect(page.locator(".product-card")).toHaveCount(12);
});
test("Bag persists, supports quantity changes and removal", async ({
  page,
}) => {
  await english(page, "/products");
  await page.locator(".product-card").first().hover();
  await page.locator(".quick-add").first().click();
  await page.getByRole("button", { name: "Shopping bag", exact: true }).click();
  await expect(page.locator(".cart-item")).toHaveCount(1);
  await expect(page.locator(".cart-price")).toContainText("3,200");
  await page.getByRole("button", { name: "Increase quantity" }).click();
  await expect(page.locator(".cart-price")).toContainText("6,400");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Shopping bag", exact: true }).click();
  await expect(page.locator(".qty>span")).toHaveText("2");
  await page.getByRole("button", { name: "Decrease quantity" }).click();
  await expect(page.locator(".qty>span")).toHaveText("1");
  await page.getByRole("button", { name: "Remove item" }).click();
  await expect(page.locator(".cart-items")).toContainText("currently empty");
});
test("Checkout correctly calculates governorate, gift and coupon; never fakes order", async ({
  page,
}) => {
  await english(page, "/products");
  await page.locator(".product-card").first().hover();
  await page.locator(".quick-add").first().click();
  await page.goto("/checkout");
  await expect(page.locator(".total")).toContainText("3,260");
  await page.locator("select").selectOption("Assiut");
  await expect(page.locator(".total")).toContainText("3,275");
  await page.getByRole("checkbox").first().check();
  await expect(page.locator(".total")).toContainText("3,325");
  await page.getByPlaceholder("Coupon code").fill("MAISON10");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.locator(".total")).toContainText("3,005");
  await page.locator('input[name="name"]').fill("Test Customer");
  await page.locator('input[name="phone"]').fill("01012345678");
  await page
    .locator('input[name="address"]')
    .fill("Test address for validation only");
  await page.getByRole("button", { name: "Place order", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Please sign in");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Make it yours.",
  );
  await page.getByRole("radio", { name: "Visa / Mastercard" }).check();
  await expect(page.locator(".notice").last()).toContainText(
    "Gateway not connected",
  );
});
test("Product lightbox and review form work without pretending to submit", async ({
  page,
}) => {
  await english(page, "/products/00000000-0000-4000-8000-000000000001");
  await page.getByRole("button", { name: "Enlarge product image" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.locator('textarea[name="comment"]').fill("A test impression.");
  await page.getByRole("button", { name: "Share review" }).click();
  await expect(page.getByRole("status")).toContainText("Sign in");
});
test("FAQ accordion and protected admin route", async ({ page }) => {
  await english(page, "/faq");
  await page
    .getByRole("button", { name: "Can I return my fragrance?" })
    .click();
  await expect(page.locator(".faq-item p")).toContainText("14 days");
  await page.goto("/admin");
  await expect(page.locator(".notice")).toContainText("Backend not connected");
  await expect(page.getByRole("button", { name: "Add fragrance" })).toHaveCount(
    0,
  );
});
test("Mobile routes have no horizontal overflow and hamburger navigates", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await english(page);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.locator(".mobile-nav")).toBeVisible();
  await page
    .locator(".mobile-nav")
    .getByRole("link", { name: "Collection", exact: true })
    .click();
  await expect(page.locator(".mobile-nav")).toHaveCount(0);
  for (const path of [
    "/",
    "/products",
    "/offers",
    "/bestsellers",
    "/about",
    "/faq",
    "/contact",
    "/returns",
    "/account",
    "/admin",
    "/products/00000000-0000-4000-8000-000000000001",
  ]) {
    await page.goto(path);
    await expect(page.locator("h1")).toHaveCount(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      path,
    ).toBeTruthy();
  }
});
test("Scroll film is decoded and does not autoplay", async ({ page }) => {
  await english(page);
  await expect(page.locator("canvas.hero-film")).toHaveClass(/loaded/);
  await expect(page.locator(".hero-scroll-spacer")).toBeVisible();
  expect(
    await page.locator("canvas").evaluate((c: HTMLCanvasElement) => c.width),
  ).toBeGreaterThan(0);
  await page.evaluate(() =>
    window.scrollTo(
      0,
      (document.documentElement.scrollHeight - innerHeight) * 0.55,
    ),
  );
  await expect
    .poll(async () =>
      Number(await page.locator("canvas").getAttribute("data-frame")),
    )
    .toBeGreaterThan(35);
  await expect(page.locator("canvas")).toHaveClass(/loaded/);
});
