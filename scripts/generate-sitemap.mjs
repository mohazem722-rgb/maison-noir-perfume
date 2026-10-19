import fs from "node:fs";
import { loadEnv } from "vite";
const env = {
  ...loadEnv("production", process.cwd(), "VITE_"),
  ...process.env,
};
const privatePaths = [
  "/admin",
  "/account",
  "/checkout",
  "/wishlist",
  "/reset-password",
];
const escape = (text) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
let origin;
if (env.VITE_SITE_URL) {
  const site = new URL(env.VITE_SITE_URL);
  if (
    site.protocol !== "https:" ||
    site.username ||
    site.password ||
    site.pathname !== "/" ||
    site.search ||
    site.hash
  )
    throw Error(
      "VITE_SITE_URL must be your production HTTPS origin without a path or credentials",
    );
  origin = site.origin;
}
// Keep the initial HTML safe on credential-free previews; production metadata is updated per route in React.
const html = fs.readFileSync("dist/index.html", "utf8");
fs.writeFileSync(
  "dist/index.html",
  html.replace(
    /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/,
    `<meta name="robots" content="${origin ? "index,follow" : "noindex,follow"}" />`,
  ),
);
if (!origin) {
  fs.rmSync("dist/sitemap.xml", { force: true });
  fs.writeFileSync("dist/robots.txt", "User-agent: *\nDisallow: /\n");
  console.log(
    "Preview build: noindex / robots disallow; set VITE_SITE_URL for a production sitemap.",
  );
} else {
  const routes = [
    "/",
    "/products",
    "/offers",
    "/bestsellers",
    "/about",
    "/faq",
    "/contact",
    "/returns",
  ];
  // Product URLs must come from the merchant's live catalog, not fabricated static UUIDs.
  fs.writeFileSync(
    "dist/sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map((path) => `  <url><loc>${escape(origin + path)}</loc></url>`).join("\n")}\n</urlset>\n`,
  );
  fs.writeFileSync(
    "dist/robots.txt",
    `User-agent: *\n${privatePaths.map((path) => "Disallow: " + path).join("\n")}\nSitemap: ${origin}/sitemap.xml\n`,
  );
  console.log("Production sitemap generated for the configured origin.");
}
