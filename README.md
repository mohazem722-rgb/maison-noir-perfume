# MAISON NOIR · The Art of Scent

A bilingual, mobile-first perfume storefront built with React 18, TypeScript, Vite, Tailwind CSS 4, lucide-react, and Supabase. English / LTR is the default; visitors can switch to Arabic / RTL, and their selected language is persisted on the device. Typography uses locally hosted Cairo for Arabic and Manrope for English, with larger body/UI text and rounded, touch-friendly controls.

## Run locally

Use Node.js 22.6+ (the client test harness uses native TypeScript stripping).

```sh
npm install
cp .env.example .env
npm run dev
```

Open the Vite URL. The server binds to `0.0.0.0` and accepts the Arena preview hostname. `npm run build` performs TypeScript checking and builds the static production site. Deploy `dist/` to a static host with an SPA fallback to `index.html` (a Netlify redirect is included; a Vercel rewrite is included).

## What works without credentials

- All storefront routes: `/`, `/products`, `/products/:id`, `/offers`, `/bestsellers`, `/about`, `/faq`, `/contact`, `/returns`, `/wishlist`, `/reset-password`, `/account`, `/checkout`, `/admin`.
- Full 90-product demonstration catalog, six collections, live search / suggestions, category, price, brand and size filters, and sorting.
- Owner-isolated persistent bag, stock-aware quantity controls, saved favorites with a browsable `/wishlist`, product lightbox, and review UI.
- Governorate shipping estimates, gift wrap (+50 EGP), gift card message, and a clearly labeled demo coupon `MAISON10` (10%).
- Arabic / English, mobile menu, keyboard-accessible dialogs, Escape-to-close, reduced-motion handling, and reveal transitions.
- User-provided monochrome wave artwork is color-inverted and fixed across the site, except the black home hero. The customer's spark MP4 fills the entire hero as a muted, inline, continuously looping background behind the text, icons, and original high-resolution Tom Ford bottle. The bottle, overhead illumination, floor light and shadows stay visible whether the video loads or fails. The original photograph and its brand label are preserved; no 3D frame, pedestal, WebGL, or external image requests are used. The video is a separate external dependency, not a downloaded local file.

**No fake backend actions:** without Supabase, signup, orders, reviews, contact messages, and subscriptions explicitly say integration is required. Nothing is silently submitted. Online payments never display a success confirmation. The WhatsApp-style contact button opens Contact until a genuine number is configured.

## Connect Supabase

1. Create a Supabase project.
2. In SQL Editor run `supabase/schema.sql` **once**, followed by `supabase/seed.sql`. The schema contains tables, indexes, Auth signup trigger, RLS policies, storage configuration, server-authoritative order creation, rating updates, payment reconciliation, and Realtime publication entries.
3. Set browser-safe values in `.env`:
   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
   ```
4. Restart Vite. Products and shipping rates load from Supabase. Product updates and customer order tracking subscribe to Realtime. If your project already publishes these tables, omit the final `ALTER PUBLICATION` statement when installing.
5. In Supabase Auth, enable email/password, configure your Site URL and permitted redirect URLs, and configure your email sender. Email confirmation is respected; signup prompts users to confirm their address.
6. Install / authenticate the Supabase CLI, link your project, and deploy:
   ```sh
   supabase link --project-ref YOUR_PROJECT_REF
   supabase functions deploy shop
   supabase functions deploy payments-webhook
   supabase secrets set SITE_ORIGIN=https://YOUR_STOREFRONT_DOMAIN
   ```
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are provided to hosted Edge Functions by Supabase. Never put a service-role key in `.env` with a `VITE_` prefix, browser code, or Git.

### API contract

This static Vite app does **not** pretend to host an API server. APIs use the deployed Supabase Edge Function URL `/functions/v1/shop`, with a JSON `action` field:

| Logical operation            | Action / endpoint                       | Authorization       |
| ---------------------------- | --------------------------------------- | ------------------- |
| `POST /api/orders/create`    | `shop`, `action: "orders/create"`       | Valid customer JWT  |
| `POST /api/coupons/validate` | `shop`, `action: "coupons/validate"`    | Public validation   |
| `POST /api/reviews/add`      | `shop`, `action: "reviews/add"`         | Valid customer JWT  |
| `POST /api/payments/webhook` | `/functions/v1/payments-webhook?hmac=…` | Paymob SHA-512 HMAC |

`supabase.functions.invoke` sends the current session automatically. Edge Functions handle CORS and verify authenticated operations using `auth.getUser()`. Public coupon validation returns only the discount percentage, never the coupon table.

Orders use the database `create_order(payload)` transaction. It validates quantities, product IDs, stock, coupon eligibility and delivery fields; locks product and coupon records; reads current prices and shipping rates; calculates discounts and gift wrap; creates pending orders and order items; decrements stock; increments sales / coupon uses; and clears the server cart atomically. Forged client prices/totals are ignored. Direct customer order INSERT is deliberately disallowed by RLS to prevent spoofed totals/payment status. Unknown governorates use the specified 75 EGP fallback.

### October 19 audit repairs and existing-project upgrade

**Existing installations:** back up the database and run `supabase/migrations/20261019_audit_fixes.sql` in Supabase SQL Editor. Do **not** rerun `schema.sql` or reseed a live store. The migration adds nullable retry/collection columns, a per-customer unique request index, replaces `create_order`, and adds the restricted `collect_cod_payment` RPC. It does not delete orders, reset stock/coupons, or automatically mark deliveries as paid. It is safe to reapply. New installations already receive these changes from `schema.sql`.

Deploy the migration and updated frontend together; old open frontend sessions must reload. New checkout calls require an `idempotency_key` UUID, so outdated clients fail before writing orders/inventory. Historical orders retain null request keys and are not retroactively deduplicated.

- **Retry protection:** the browser retains one UUID for an unchanged checkout across timeouts and reloads. It stores a SHA-256 digest of the payload, not an address/phone copy. The transaction locks the customer before checking replay, validates a server-side JSONB fingerprint, and returns the existing order without decrementing stock or reusing a coupon. A changed payload cannot reuse the same key. Orders bind to the initiating session; switching accounts also remounts private account/admin/checkout views and cannot clear the next account's bag.
- **Cash receipts:** delivering a COD order does **not** mean money was collected. An authorized administrator must confirm **Record cash received** on a delivered COD order. The RPC locks the order, records collector/time and one payment event, and is safe to retry. Paid cash enters revenue reports on its collection date. Online methods remain blocked until genuine gateway integration; the service-only online-payment RPC is unchanged. Existing delivered orders require actual cash verification before confirming collection.
- **Safe cart/storage:** malformed, duplicate, deleted and out-of-stock items are rejected/reconciled; quantities clamp to available stock. Account bags have separate local keys, canceled stale hydration and serialized cloud writes. Only an explicit guest-to-sign-in transition transfers a guest bag. Blocked/full storage uses session memory rather than crashing; persistence **across reloads is impossible when browser storage is disabled**. Favorites remain device-local, not a server-synced account wishlist.
- **Backend readiness:** a configured but unavailable catalog no longer silently substitutes demo products. It shows a retry state and pauses checkout until authoritative catalog loading succeeds. With no credentials, the explicitly demonstrative local catalog is still available, and no backend order is claimed.
- **UI/accessibility:** 320px bilingual headers fit, the mobile contact button stays above the purchase bar, bestsellers keeps its top-12 membership before sorting/filtering, category counts and price limits use catalog data, filter controls are named, supporting text has stronger contrast, links are distinguishable, clipboard failure is not reported as success, and Escape closes search. The photographic/video hero and English default are unchanged.

### Password recovery setup

The account screen has **Forgot password?** and `/reset-password` handles choosing/confirming a new password. Request success uses a generic anti-enumeration message. Passwords require at least eight characters; successful changes sign out and return to sign-in. Missing/expired sessions show a request-new-link path. Without Supabase, the page says no email was sent.

In Supabase Auth URL Configuration, set the real Site URL and allow the exact `<actual-origin>/reset-password` redirect for each environment (including the current Arena preview only for development). Configure a verified email sender, delivery limits and recovery email template. Test the real emailed link, expiry, email-client URL rewriting and final sign-in before launch. Local tests simulate the SDK; no actual recovery emails were sent here.

### Production SEO configuration

Set `VITE_SITE_URL` to the **real production HTTPS origin** without a path, query or credentials, then rebuild. Keep it empty on preview deployments. No domain has been invented or configured in this repository.

Route/product/language-aware titles, descriptions, canonical URLs and Open Graph metadata are updated in React. Account, reset, wishlist, checkout, admin and unknown routes are `noindex`; an unconfigured preview starts with `noindex` in its HTML and the build emits `robots.txt` with `Disallow: /`. With a production origin, the build generates `sitemap.xml` for the eight public static routes and excludes private routes. No fake product UUID list, ratings/review aggregates or product-offer structured data is published. Product URLs should be added to a future dynamic sitemap from the reviewed live catalog, not from demonstration seeds.

This is an SPA SEO baseline, **not SSR/prerendering**. Bots/social crawlers that do not execute JavaScript may only see the initial shared HTML. Production per-route HTML/social previews and full multilingual crawl targeting require prerendering/SSR and a confirmed domain/catalog. `robots` is not an authorization boundary; private operations still depend on Auth/RLS.

### Grant your first administrator

Register a real account and confirm its email, then run the following in SQL Editor with the actual Auth user ID:

```sql
insert into public.admins (id, role)
values ('YOUR_AUTH_USER_UUID', 'admin');
```

Visit `/admin` while signed in. Access is checked against `admins` and every database operation is also checked by RLS. There is intentionally **no insecure hardcoded password bypass**. Admin browser operations use the authenticated user's anon-key client, **not** a service-role key. The role table cannot be modified by customers or by browser admins; provision roles through trusted SQL administration.

Admin features: add/edit/delete products, price / stock / discount edits, image uploads, coupon creation / activation, orders and tracking updates, paid revenue / order / product dashboard, and daily/monthly revenue charts. Sales reports count only `paid` transactions, not pending orders. COD remains pending until an authorized operational reconciliation is performed.

## Catalog and imagery

The seed contains exactly 90 products: 25 men, 25 women, 10 unisex, 15 oriental/oud, 10 home, and 5 gifts. User-supplied names and prices are retained, including unusual product names that must be verified before launch. The requested unspecified additions use clearly numbered `Collection No.` names and **zero stock**.

The photos are original AI-generated campaign / illustrative category images, **not verified photographs of the named third-party products**. Replace these with licensed, accurate product photography before selling. Seed ratings, review counts, sales ordering, stock, and discounts are illustrative; real submitted reviews recalculate ratings. Do not represent seed metrics as verified customer data. Offer countdowns are local demonstration timers, not a backend campaign schedule.

### Add or edit a product

Use `/admin` → Products → Add fragrance. Supply both Arabic and English names, brand, size, integer EGP price, collection, stock, discount percentage, and image URL / file. Store original product photos in the public `product-images` bucket at `products/{product_id}/{filename}.jpg` (or `.webp`). Maximum 2 MB, JPEG/WebP only. Public can read; **only authorized admins can upload/update/delete**. All signed-in users are deliberately not given write access to the product bucket.

The schema also includes an `images` JSON array for future multi-angle media; the current product UI displays `image_url` with hover zoom and a lightbox. Category seed counts are initial editorial counts, not live inventory counts.

### Shipping prices

27 Egyptian governorates are seeded. Cairo / Giza are 60 EGP, Alexandria is 65, Assiut is 75; other rates are editable estimates. Adjust in Supabase SQL Editor / Table Editor:

```sql
update public.shipping_rates
set price = 80, estimated_days = '2–5'
where governorate = 'Assiut';
```

The browser loads the configured prices on refresh and the server always re-reads the price at order creation. Confirm real courier rates and delivery estimates before launch.

## Connect a real payment gateway

Current state: Cash on Delivery creates a real pending order **only after Supabase is configured and the customer is authenticated**. Vodafone Cash, Visa/Mastercard and InstaPay are selectable integration-ready UI placeholders. The database rejects online methods until an integration is implemented. No card/financial data is collected by this app.

A Paymob processed-transaction webhook scaffold is included with SHA-512 HMAC validation, integration ID / EGP / exact amount checks, transaction deduplication, and atomic `record_payment`. It rejects COD reconciliation and mismatched amounts. It is **not** a complete Paymob payment initiation flow and has not been live-verified with a merchant account. Fawry and InstaPay-specific initiation and webhook adapters are not implemented.

To enable live online payments:

1. Obtain a merchant account and confirm enabled payment methods. Store `PAYMOB_API_KEY`, `PAYMOB_INTEGRATION_ID`, `PAYMOB_IFRAME_ID`, and `PAYMOB_HMAC_SECRET` only as Supabase secrets.
2. Implement a server-side payment-initiation function: create a server-priced pending order, create a Paymob order with `merchant_order_id` = our `orders.id`, obtain a payment key, and return a hosted checkout URL. Modify `create_order` to allow only methods enabled by server configuration. Do not enable methods simply by changing the frontend label.
3. Replace placeholders with hosted payment components. Never store or send raw card details to the app database.
4. Configure the callback at the deployed `payments-webhook` URL. Verify against the exact callback contract and HMAC examples in your current Paymob merchant documentation. Test pending, success, failure, retries, amount mismatches, and signature failures in sandbox before launch. Authorization-only, void/refund, and reversal lifecycles require dedicated handling; do not use a generic "success" redirect as proof of payment.
5. Implement refund / cancellation operations and a retryable notification outbox / monitoring for production reliability. The current notification scaffold logs failures; it does not automatically retry delivery.

Optional notifications after verified paid callbacks:

```sh
supabase secrets set RESEND_API_KEY=... RESEND_FROM_EMAIL='Maison Noir <orders@YOUR_VERIFIED_DOMAIN>'
supabase secrets set TWILIO_SID=... TWILIO_TOKEN=... TWILIO_FROM=...
```

Phone numbers should be normalized to E.164 before enabling SMS. Without configured sender/keys, callbacks log notification omissions and do not claim an email/SMS was sent. Newsletter and contact messages are persisted to their respective tables when connected; no marketing campaign is sent automatically. Add CAPTCHA, rate limits, explicit consent/privacy terms and unsubscribe management before using public forms in production.

## Branding, contact and hero assets

### Customer-supplied hero film

- `src/HeroVideo.tsx` uses the customer's exact direct MP4 URL: `https://v1.pinimg.com/videos/iht/720p/f9/ea/c2/f9eac2df7c642573229dd098ba61d13f.mp4`.
- This is **remote playback**, not a locally downloaded copy. Sandbox requests to the original file failed (TLS connection failure; page fetch also failed), so its actual contents, duration, dimensions, availability to the user's browser, and commercial reuse rights could not be independently verified here. The `720p` path is not treated as verified dimensions or an HD guarantee.
- The spark film is an absolutely positioned, full-bleed background limited to the home hero. Layer order is video → soft contrast treatment → studio light → bottle, floor, shadows, headlines and CTAs. The original photograph and lighting are **always visible**, including during loading and network/codec failure. The background never intercepts pointer events and is hidden from assistive technology.
- Playback is muted, inline, automatic, and looping. The customer explicitly requested **no pause/play button or native controls** and continuous playback, including when the OS reduced-motion preference is enabled. Other reveal animations still respect reduced motion. Review this requested no-pause behavior against production accessibility requirements before launch. Browser/OS autoplay restrictions still apply; playback is retried when returning to the page.
- `object-fit: cover` fills the entire hero without stretching its aspect ratio; some edges may be cropped, especially on mobile. This supersedes the previous small contained player and its native-pixel display caps. The bottle still retains its independent native-resolution cap. No video recompression or invented HD/4K detail is applied; the background simply scales the supplied source to the requested full-hero area.
- For reliable production delivery, obtain an authorized copy and host it on merchant-controlled storage/CDN. Set `VITE_HERO_VIDEO_URL` to the public URL or a same-origin path (e.g. `/videos/hero.mp4`) and restart/rebuild. Never put credentials in that public environment variable. Pinterest availability/hotlink behavior is outside this app's control.
- Playback tests use the small, generated **test-only** `tests/fixtures/playback.webm`, never as production footage. Tests verify actual frame progression, full-hero coverage and layer order, absence of pause/native controls, continuous looping/muting configuration, mobile/desktop bilingual layout, clickable CTAs, and persistence of the bottle/lighting on CDN error. They do not verify streaming of the original remote film.

### Permanent photographic foreground and studio lighting

- Replace the `Logo` component in `src/main.tsx` with the customer-provided logo when available; current branding uses a custom modern silver MN monogram and Manrope wordmark, also used on the favicon. The photographed Tom Ford bottle retains its authentic brand label.
- Set `VITE_WHATSAPP_NUMBER` to the confirmed digits including country code. Blank = Contact fallback, **not an invented wa.me number**.
- Contact details, branch map and three store photographs remain clearly marked “Coming soon — to be confirmed”. Supply actual data before launch.
- The `Hero` component in `src/main.tsx` displays `/images/oud-wood-100ml-lossless.webp` with `/images/oud-wood-100ml-original.png` fallback with no surrounding frame or image backdrop. The alpha-transparent cutout is a real product photograph, not AI-generated and not a simulated 3D model.
- The received background attachment is **800 × 448**, preserved byte-for-byte as `/images/silver-wave-original.png`. `/images/silver-wave-inverted.png` is its exact lossless RGB inversion. `/images/silver-wave-seamless-lossless.webp` mirrors the artwork into a seamless repeat, displayed at one source pixel per device pixel rather than stretched with `cover`. Repetition does not create extra detail; the native grain is preserved. A larger source is needed for a single full-screen composition at high resolution. The shared `.site-background` remains fixed across routes; the home hero excludes this wave texture and uses its black-backed spark video instead.
- The official **100ml** photograph was downloaded at **2000 × 2000**. Only transparent padding was cropped, yielding **870 × 1630** with all native bottle pixels intact. WebP is lossless and pixel-identical to the PNG; `<picture>` downloads just the supported format, with high fetch priority. Rendered size is capped against native dimensions and device pixel ratio to avoid enlarging the bottle even on high-density screens. No blur or sharpening filters are applied.
- The story headline now reads “A passion for the rare. / An instinct for the unexpected.” Its Arabic equivalent is updated too; the former “A love for the lasting.” phrase has been removed.
- The spotlight hero follows the supplied studio-light reference using resolution-independent CSS gradients rather than enlarging its small raster image. Three balanced columns place the bottle at the exact viewport center, with the headline and description/CTAs on opposite sides (mirrored in Arabic/English). Mobile stacks the headline, bottle, and copy; the light is anchored to the bottle so wrapped headings cannot collide with it.
- Soft overhead illumination, an alpha-masked cap/shoulder highlight, and a visible elliptical floor-light pool integrate the bottle into the scene. A separate, softly projected shadow uses the actual bottle alpha silhouette, fades toward its tip, and joins a tighter contact shadow at the base. Floor lighting and shadows share the same responsive anchor as the photograph; blur applies only after shadow projection, never to the original image. The light mask shares the photograph's exact bounds at every breakpoint; it never exposes a rectangle, adds a pedestal, blurs the photo, or edits the lossless source pixels. All lighting is static and respects reduced-motion without a separate animation path.
- The prior Three.js scene and dependency have been removed in favor of the photographic scene approved by the user. All current image assets are served locally.
- See `public/images/CREDITS.md` for the bottle-photo source and editing notes. Commercial reuse rights for this third-party source are not verified: replace it with a merchant-owned/licensed photograph before public commercial deployment. The user-provided wave remains a separate asset and is never baked into the bottle cutout.
- Illustrative collection and offer photographs remain in their respective sections; none is used as the hero background.

## Tests

```sh
npm test                  # Storage/cart, real PostgreSQL invariants/RLS/migration, and SEO generation
npm run dev               # Start server in a separate terminal
npx playwright install chromium
npm run test:e2e          # 38 browser tests, including bilingual axe accessibility checks
npm run build
npm audit
```

Audit regression tests additionally cover disabled/corrupt storage, orphan/out-of-stock carts, above-7000-EGP products, stable bestseller membership after sorting, 320px headers/contact hit testing, rejected clipboard writes, search Escape, wishlist listing/removal, account switching and late hydration, explicit guest promotion, lost order-response retry after reload, in-flight account boundaries, explicit COD confirmation, password recovery, backend catalog outage/retry, metadata, and automated axe WCAG A/AA checks on six core pages in both languages. Automated checks are not a complete accessibility certification; the explicitly requested continuously playing, no-pause video remains a documented production accessibility consideration.

The database harness stubs Supabase-owned `auth` / `storage` schemas and omits the environment-owned Realtime publication. It tests real SQL functions and RLS locally, not a deployed Supabase project. Browser tests cover default English, Arabic switching / direction persistence, catalog search / filters / sort, discounted offers and 12 bestsellers, bag persistence and quantities, shipping / wrapping / coupon arithmetic, blocked unconnected checkout, lightbox / reviews, FAQ / admin guards, mobile route overflow, the real bottle cutout and alpha transparency, absence of the old frame, fixed backdrop behavior across routes, black studio hero isolation, compatibility with reduced motion / disabled WebGL, Retina native-pixel sufficiency, exact background inversion, lossless texture pixel equality, centered spotlight geometry, exact mask alignment across Arabic/English desktop, tablet, and mobile, the updated bilingual story phrase, and the full-hero background playback behavior described above. An alternate Chromium path may be supplied with `CHROMIUM_EXECUTABLE_PATH`.

**Launch checklist:** connect and deploy Supabase, replace illustrative photos / unverified product data, configure real contact details, confirm courier prices and policy text, verify Auth email delivery and redirect domains, run a real customer→admin→tracking acceptance test, configure payment adapters only after merchant sandbox approval, and add abuse prevention / monitoring. No production credentials or merchant configuration were supplied with this build.
