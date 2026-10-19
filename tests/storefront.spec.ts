import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";

const heroVideoURL =
  "https://v1.pinimg.com/videos/iht/720p/f9/ea/c2/f9eac2df7c642573229dd098ba61d13f.mp4";
const playbackFixture = fileURLToPath(
  new URL("./fixtures/playback.webm", import.meta.url),
);
// Commerce/fallback tests must never depend on third-party CDN availability.
test.beforeEach(async ({ page }) => {
  await page.route(heroVideoURL, (route) => route.abort());
});
async function english(page: any, path = "/") {
  await page.goto(path);
  if ((await page.locator("html").getAttribute("lang")) === "ar")
    await page.getByRole("button", { name: "EN", exact: true }).click();
}
test("English is default; Arabic and English selection and direction persist", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Rare.");
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("نادر");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await page.getByRole("button", { name: "EN", exact: true }).click();
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
test("Hero uses a real cutout bottle photograph with no 3D frame or image backdrop", async ({
  page,
}) => {
  await english(page);
  const bottle = page.locator(".perfume-photo img");
  await expect(bottle).toBeVisible();
  await expect(bottle).toHaveAttribute(
    "src",
    "/images/oud-wood-100ml-original.png",
  );
  await expect
    .poll(async () =>
      bottle.evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
    )
    .toBeTruthy();
  await expect(
    page.locator(
      ".perfume-scene, .perfume-canvas, .scene-motion, .hero-eyebrow, .since",
    ),
  ).toHaveCount(0);
  expect(
    await page
      .locator(".perfume-photo")
      .evaluate((e) => getComputedStyle(e).borderWidth),
  ).toBe("0px");
  const heroBox = await page.locator(".hero").boundingBox();
  const imageBox = await bottle.boundingBox();
  expect(imageBox!.y + imageBox!.height).toBeLessThanOrEqual(
    heroBox!.y + heroBox!.height,
  );
  // Alpha is real transparency, not a black/white rectangle baked into the photograph.
  const alpha = await bottle.evaluate((img: HTMLImageElement) => {
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, 1, 1).data[3];
  });
  expect(alpha).toBe(0);
});

test("Uploaded inverted wave is fixed across routes but the hero stays black", async ({
  page,
}) => {
  await page.goto("/products");
  const bg = page.locator(".site-background");
  await expect(bg).toHaveCSS("position", "fixed");
  await expect(bg).toHaveCSS(
    "background-image",
    /silver-wave-seamless-lossless.webp/,
  );
  const before = await bg.boundingBox();
  await page.evaluate(() => window.scrollTo(0, 600));
  expect(await bg.boundingBox()).toEqual(before);
  await page.goto("/");
  await expect(bg).toHaveCSS("position", "fixed");
  await expect(page.locator(".hero")).toHaveCSS(
    "background-color",
    "rgb(5, 5, 5)",
  );
});

test("Simplified hero removes decorative additions and uses readable rounded CTAs", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.locator(".announcement, .hero-note, .hero-bottom"),
  ).toHaveCount(0);
  await expect(
    page.getByText("RARE INGREDIENTS. REMARKABLE STORIES."),
  ).toHaveCount(0);
  const primary = page.locator(".hero-buttons .gold");
  const secondary = page.locator(".hero-buttons .glass");
  await expect(primary).toHaveAttribute("href", "/products");
  await expect(secondary).toHaveAttribute("href", "/contact");
  expect(
    await primary.evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
  ).toBeGreaterThanOrEqual(15);
  expect(
    await primary.evaluate((e) => parseFloat(getComputedStyle(e).borderRadius)),
  ).toBeGreaterThan(25);
  expect(
    await page.locator("body").evaluate((e) => getComputedStyle(e).fontFamily),
  ).toContain("Manrope");
  await page.locator(".language").click();
  expect(
    await page.locator("body").evaluate((e) => getComputedStyle(e).fontFamily),
  ).toContain("Cairo");
});

test("Larger Arabic and English typography stays within narrow mobile and tablet layouts", async ({
  page,
}) => {
  for (const lang of ["ar", "en"]) {
    for (const width of [360, 960]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      if ((await page.locator("html").getAttribute("lang")) !== lang)
        await page.locator(".language").click();
      for (const path of [
        "/",
        "/products",
        "/offers",
        "/about",
        "/faq",
        "/contact",
        "/returns",
        "/account",
        "/admin",
      ]) {
        await page.goto(path);
        await page.evaluate(() => document.fonts.ready);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${lang}, ${width}px, ${path}`,
        ).toBeTruthy();
      }
    }
  }
});

test("Photographic hero remains available with reduced motion and no WebGL", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      type: string,
      ...args: any[]
    ) {
      if (type.startsWith("webgl")) return null;
      return (original as any).apply(this, [type, ...args]);
    } as typeof original;
  });
  await page.goto("/");
  await expect(page.locator(".perfume-photo img")).toBeVisible();
  await expect(page.locator(".hero canvas")).toHaveCount(0);
  await expect(page.locator(".hero-video-player")).not.toHaveClass(/is-ready/);
});

test("Hero photograph has enough native pixels for a Retina display", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 2,
  });
  try {
    const page = await context.newPage();
    await page.route(heroVideoURL, (route) => route.abort());
    await page.goto("/");
    const metrics = await page
      .locator(".perfume-photo img")
      .evaluate(async (image: HTMLImageElement) => {
        await image.decode();
        const rect = image.getBoundingClientRect();
        return {
          width: image.naturalWidth,
          height: image.naturalHeight,
          source: image.currentSrc,
          renderedWidth: rect.width * devicePixelRatio,
          renderedHeight: rect.height * devicePixelRatio,
          filter: getComputedStyle(image).filter,
        };
      });
    expect(metrics.width).toBe(870);
    expect(metrics.height).toBe(1630);
    expect(metrics.source).toContain("oud-wood-100ml-lossless.webp");
    expect(metrics.renderedWidth).toBeLessThanOrEqual(metrics.width);
    expect(metrics.renderedHeight).toBeLessThanOrEqual(metrics.height);
    expect(metrics.filter).toBe("none");
    expect(
      await page
        .locator(".site-background")
        .evaluate((e) => getComputedStyle(e).backgroundSize),
    ).toBe("800px 448px");
  } finally {
    await context.close();
  }
});

test("Background inversion and repeating texture preserve every original pixel without JPEG/WebP loss", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const load = async (url: string) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(image, 0, 0);
      return {
        width: canvas.width,
        height: canvas.height,
        data: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
      };
    };
    const original = await load("/images/silver-wave-original.png");
    const inverted = await load("/images/silver-wave-inverted.png");
    const texture = await load("/images/silver-wave-seamless-lossless.webp");
    let errors = 0;
    for (let y = 0; y < original.height; y++) {
      for (let x = 0; x < original.width; x++) {
        const p = (y * original.width + x) * 4;
        const t = (y * texture.width + x) * 4;
        for (let c = 0; c < 3; c++) {
          if (
            original.data[p + c] + inverted.data[p + c] !== 255 ||
            inverted.data[p + c] !== texture.data[t + c]
          )
            errors++;
        }
      }
    }
    return { errors, width: original.width, height: original.height };
  });
  expect(result).toEqual({ errors: 0, width: 800, height: 448 });
});

test("Spotlit bottle is centered with a precisely aligned light mask and non-overlapping bilingual text", async ({
  page,
}) => {
  for (const lang of ["ar", "en"]) {
    for (const width of [360, 390, 768, 960, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/");
      if ((await page.locator("html").getAttribute("lang")) !== lang)
        await page.locator(".language").click();
      await page
        .locator(".perfume-photo img")
        .evaluate((img: HTMLImageElement) => img.decode());
      await page.evaluate(() => document.fonts.ready);
      const image = (await page.locator(".perfume-photo img").boundingBox())!;
      const picture = (await page
        .locator(".perfume-photo picture")
        .boundingBox())!;
      expect(
        Math.abs(image.x + image.width / 2 - width / 2),
        `${lang} ${width}: centered bottle`,
      ).toBeLessThan(1);
      for (const prop of ["x", "y", "width", "height"] as const)
        expect(
          Math.abs(picture[prop] - image[prop]),
          `${lang} ${width}: light mask ${prop}`,
        ).toBeLessThan(1);
      const mask = await page
        .locator(".perfume-photo picture")
        .evaluate((e) => getComputedStyle(e, "::after").maskImage);
      expect(mask).toContain("oud-wood-100ml-lossless.webp");
      for (const selector of [".hero-heading", ".hero-copy"]) {
        const text = (await page.locator(selector).boundingBox())!;
        const overlaps =
          image.x < text.x + text.width &&
          image.x + image.width > text.x &&
          image.y < text.y + text.height &&
          image.y + image.height > text.y;
        expect(
          overlaps,
          `${lang} ${width}: ${selector} does not cover bottle`,
        ).toBeFalsy();
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
    }
  }
});

test("Lit floor and projected bottle shadow stay grounded beneath the high-resolution photograph", async ({
  page,
}) => {
  for (const width of [360, 960, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await page
      .locator(".perfume-photo img")
      .evaluate((img: HTMLImageElement) => img.decode());
    await page.evaluate(() => document.fonts.ready);
    const photo = (await page.locator(".perfume-photo img").boundingBox())!;
    const pool = (await page.locator(".floor-pool").boundingBox())!;
    const contact = (await page
      .locator(".floor-contact-shadow")
      .boundingBox())!;
    const hero = (await page.locator(".hero").boundingBox())!;
    const ground = photo.y + photo.height * 0.99;
    expect(contact.y).toBeLessThan(ground);
    expect(contact.y + contact.height).toBeGreaterThan(ground);
    expect(pool.y).toBeLessThan(ground);
    expect(pool.y + pool.height).toBeGreaterThan(ground);
    expect(pool.y + pool.height).toBeLessThanOrEqual(hero.y + hero.height);
    if (width <= 900) {
      const copy = (await page.locator(".hero-copy").boundingBox())!;
      expect(pool.y + pool.height).toBeLessThan(copy.y);
    }
    const shadow = await page.locator(".bottle-cast-shadow").evaluate((e) => {
      const shape = getComputedStyle(e, "::before");
      return {
        mask: shape.maskImage,
        composite: shape.maskComposite,
        transform: shape.transform,
        blur: getComputedStyle(e).filter,
      };
    });
    expect(shadow.mask).toContain("oud-wood-100ml-lossless.webp");
    expect(shadow.mask).toContain("linear-gradient");
    expect(shadow.composite).toContain("intersect");
    expect(shadow.transform).not.toBe("none");
    expect(shadow.blur).toBe("blur(4px)");
    await expect(page.locator(".perfume-photo img")).toHaveCSS(
      "filter",
      "none",
    );
  }
});

test("Spark film fills the hero behind the bottle, spotlight and floor shadows; CDN errors never hide them", async ({
  page,
}) => {
  // A tiny generated decoding fixture, never the customer's footage.
  await page.route(heroVideoURL, (route) =>
    route.fulfill({ path: playbackFixture, contentType: "video/webm" }),
  );
  await page.goto("/");
  const video = page.locator(".hero-video");
  await expect(video).toHaveAttribute("src", heroVideoURL);
  await expect(page.locator(".hero-video-player")).toHaveClass(/is-ready/);
  await expect
    .poll(() =>
      video.evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0),
    )
    .toBeTruthy();
  await expect(page.locator(".perfume-display")).toBeVisible();
  await expect(page.locator(".hero-spotlight")).toBeVisible();
  await expect(page.locator(".floor-pool")).toBeVisible();
  await expect(page.locator(".bottle-cast-shadow")).toBeVisible();
  const hero = (await page.locator(".hero").boundingBox())!;
  const backdrop = (await video.boundingBox())!;
  for (const prop of ["x", "y", "width", "height"] as const)
    expect(Math.abs(hero[prop] - backdrop[prop])).toBeLessThan(1);
  expect(
    await page
      .locator(".hero-video-player")
      .evaluate((e) => getComputedStyle(e).pointerEvents),
  ).toBe("none");
  const layers = await page.locator(".hero").evaluate((e) => ({
    background: Number(
      getComputedStyle(e.querySelector(".hero-video-player")!).zIndex,
    ),
    light: Number(getComputedStyle(e.querySelector(".hero-spotlight")!).zIndex),
    content: Number(getComputedStyle(e.querySelector(".hero-layout")!).zIndex),
  }));
  expect(layers.background).toBeLessThan(layers.light);
  expect(layers.light).toBeLessThan(layers.content);
  await video.dispatchEvent("error");
  await expect(page.locator(".hero-video-player")).not.toHaveClass(/is-ready/);
  await expect(page.locator(".perfume-display")).toBeVisible();
  await expect(page.locator(".floor-pool")).toBeVisible();
  await expect(page.locator(".hero-heading")).toBeVisible();
});

test("Decorative spark background loops silently without any pause/play controls", async ({
  page,
}) => {
  await page.route(heroVideoURL, (route) =>
    route.fulfill({ path: playbackFixture, contentType: "video/webm" }),
  );
  // The customer explicitly requested continuous background playback; no in-page pause UI.
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    await page.emulateMedia({ reducedMotion });
    await page.goto("/");
    const video = page.locator(".hero-video");
    await expect(page.locator(".hero-video-player")).toHaveClass(/is-ready/);
    expect(
      await video.evaluate((v: HTMLVideoElement) => ({
        muted: v.muted,
        loop: v.loop,
        inline: v.playsInline,
        autoplay: v.autoplay,
        controls: v.controls,
      })),
    ).toEqual({
      muted: true,
      loop: true,
      inline: true,
      autoplay: true,
      controls: false,
    });
    await expect
      .poll(() =>
        video.evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0),
      )
      .toBeTruthy();
    await expect(
      page.locator(".hero-video-toggle, .hero-video-player button"),
    ).toHaveCount(0);
    await expect(page.locator(".hero-video-player")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  }
});

test("Full-bleed sparks preserve bilingual hero layout and clickable CTAs on mobile and desktop", async ({
  page,
}) => {
  await page.route(heroVideoURL, (route) =>
    route.fulfill({ path: playbackFixture, contentType: "video/webm" }),
  );
  for (const lang of ["en", "ar"]) {
    for (const width of [360, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/");
      if ((await page.locator("html").getAttribute("lang")) !== lang)
        await page.locator(".language").click();
      await expect(page.locator(".hero-video-player")).toHaveClass(/is-ready/);
      await expect(page.locator(".hero-video")).toHaveCSS(
        "object-fit",
        "cover",
      );
      const hero = (await page.locator(".hero").boundingBox())!;
      const video = (await page.locator(".hero-video").boundingBox())!;
      expect(video.width).toBeCloseTo(hero.width, 0);
      expect(video.height).toBeCloseTo(hero.height, 0);
      await expect(page.locator(".perfume-photo img")).toBeVisible();
      const image = (await page.locator(".perfume-photo img").boundingBox())!;
      expect(Math.abs(image.x + image.width / 2 - width / 2)).toBeLessThan(1);
      await expect(page.locator(".hero-buttons .gold")).toHaveAttribute(
        "href",
        "/products",
      );
      await expect(page.locator(".hero-buttons .glass")).toHaveAttribute(
        "href",
        "/contact",
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      await page.locator(".hero-buttons .gold").click();
      await expect(page).toHaveURL(/\/products$/);
      await expect(page.locator(".hero-video")).toHaveCount(0);
    }
  }
});

test("The story uses the new discovery-focused phrase in both languages", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".story-copy h2")).toContainText(
    "An instinct for the unexpected.",
  );
  await expect(
    page.getByText("A love for the lasting.", { exact: true }),
  ).toHaveCount(0);
  await page.locator(".language").click();
  await expect(page.locator(".story-copy h2")).toContainText(
    "وحدس يقود إلى غير المتوقّع.",
  );
});
