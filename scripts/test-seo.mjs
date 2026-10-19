import fs from "node:fs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
// Work in a disposable directory: generated test URLs must never become a deployment configuration.
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "maison-seo-"));
const script = fileURLToPath(
  new URL("./generate-sitemap.mjs", import.meta.url),
);
try {
  fs.mkdirSync(path.join(cwd, "dist"));
  fs.writeFileSync(
    path.join(cwd, "dist/index.html"),
    '<meta name="robots" content="noindex,follow" />',
  );
  execFileSync(process.execPath, [script], {
    cwd,
    env: { ...process.env, VITE_SITE_URL: "https://merchant.example.test" },
  });
  const sitemap = fs.readFileSync(path.join(cwd, "dist/sitemap.xml"), "utf8");
  assert.equal((sitemap.match(/<url>/g) || []).length, 8);
  assert.ok(!sitemap.includes("/admin"));
  assert.ok(!sitemap.includes("/products/0000"));
  assert.ok(
    fs
      .readFileSync(path.join(cwd, "dist/robots.txt"), "utf8")
      .includes("Sitemap: https://merchant.example.test/sitemap.xml"),
  );
  assert.ok(
    fs
      .readFileSync(path.join(cwd, "dist/index.html"), "utf8")
      .includes('content="index,follow"'),
  );
  execFileSync(process.execPath, [script], {
    cwd,
    env: { ...process.env, VITE_SITE_URL: "" },
  });
  assert.ok(!fs.existsSync(path.join(cwd, "dist/sitemap.xml")));
  assert.ok(
    fs
      .readFileSync(path.join(cwd, "dist/robots.txt"), "utf8")
      .includes("Disallow: /"),
  );
  assert.ok(
    fs
      .readFileSync(path.join(cwd, "dist/index.html"), "utf8")
      .includes('content="noindex,follow"'),
  );
  console.log(
    "SEO checks passed: configured sitemap, private/demo URL exclusion and safe unconfigured preview.",
  );
} finally {
  fs.rmSync(cwd, { recursive: true, force: true });
}
