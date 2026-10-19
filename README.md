# MAISON NOIR · The Art of Scent

A bilingual, mobile-first perfume storefront built with React 18, TypeScript, Vite, Tailwind CSS 4, lucide-react, and Supabase. Arabic / RTL is the default; English / LTR is persisted on the device.

## Run locally

```sh
npm install
cp .env.example .env
npm run dev
```

Open the Vite URL. The server binds to `0.0.0.0` and accepts the Arena preview hostname. `npm run build` performs TypeScript checking and builds the static production site. Deploy `dist/` to a static host with an SPA fallback to `index.html` (a Netlify redirect is included; a Vercel rewrite is included).

## What works without credentials

- All storefront routes: `/`, `/products`, `/products/:id`, `/offers`, `/bestsellers`, `/about`, `/faq`, `/contact`, `/returns`, `/account`, `/checkout`, `/admin`.
- Full 90-product demonstration catalog, six collections, live search / suggestions, category, price, brand and size filters, and sorting.
- Persistent bag, stock-aware quantity controls, saved favorites, product lightbox, and review UI.
- Governorate shipping estimates, gift wrap (+50 EGP), gift card message, and a clearly labeled demo coupon `MAISON10` (10%).
- Arabic / English, mobile menu, keyboard-accessible dialogs, Escape-to-close, reduced-motion handling, and reveal transitions.
- Local 90-frame scroll-only campaign film with gold silk visible from frame zero, cap lifting during 30–50%, and a small golden pour during 50–70%. Frames are decoded on demand into a bounded cache (90 frames, 960px); canvas DPR is capped at 2; scroll smoothing uses 0.12 per RAF. No autoplay / loop. An 80vh editorial spacer follows the hero. A static poster remains if motion is reduced or decoding fails.

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

- Replace the `Logo` component in `src/main.tsx` with the customer-provided logo when available; current branding uses a hexagonal M placeholder.
- Set `VITE_WHATSAPP_NUMBER` to the confirmed digits including country code. Blank = Contact fallback, **not an invented wa.me number**.
- Contact details, branch map and three store photographs remain clearly marked “Coming soon — to be confirmed”. Supply actual data before launch.
- Default video assets: `public/images/hero-scroll.mp4` and `hero-scroll-ar.mp4`. These are lightweight composited 90-frame motion studies of the generated campaign still. The RTL version preserves readable bottle branding.
- To use a supplied professional film, set `VITE_HERO_VIDEO_URL` (same-origin asset or CORS-enabled URL; 90 frames / 960px recommended). Include gold silk from frame zero and the requested lift/pour timing. `src/ScrollFilm.tsx` owns canvas caching, seeking and scroll interpolation. Regenerate the included animation using `scripts/generate-hero.py` with Python Pillow / NumPy / imageio-ffmpeg installed in a virtual environment.

## Tests

```sh
npm test                  # Real PostgreSQL (PGlite) schema, seed, order invariants, RLS
npm run dev               # Start server in a separate terminal
npx playwright install chromium
npm run test:e2e          # 9 browser tests
npm run build
npm audit
```

The database harness stubs Supabase-owned `auth` / `storage` schemas and omits the environment-owned Realtime publication. It tests real SQL functions and RLS locally, not a deployed Supabase project. Browser tests cover default Arabic / direction persistence, catalog search / filters / sort, discounted offers and 12 bestsellers, bag persistence and quantities, shipping / wrapping / coupon arithmetic, blocked unconnected checkout, lightbox / reviews, FAQ / admin guards, mobile route overflow, and scroll-film decoding. An alternate Chromium path may be supplied with `CHROMIUM_EXECUTABLE_PATH`.

**Launch checklist:** connect and deploy Supabase, replace illustrative photos / unverified product data, configure real contact details, confirm courier prices and policy text, verify Auth email delivery and redirect domains, run a real customer→admin→tracking acceptance test, configure payment adapters only after merchant sandbox approval, and add abuse prevention / monitoring. No production credentials or merchant configuration were supplied with this build.
