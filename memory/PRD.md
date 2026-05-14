# LAMAZI Sweets — Product Requirements

## Original problem statement
LAMAZI Sweets is a production-grade e-commerce web application for a cake and sweets shop in Hawally, Kuwait. It serves a public storefront (browse menu, add to bag, checkout with Tap Payments or COD, track orders) and an admin panel (manage menu, orders, coupons, loyalty, delivery zones, operating hours, customers, settings). Multi-tenant — all queries must be scoped by TENANT_ID and BRANCH_ID. Backed by Supabase, dispatched via Armada Deliveries.

## Architecture
- **Frontend**: React (CRA), port 3000, custom Tailwind theme (Lamazi maroon/gold/cream), Fraunces/Outfit/Pinyon Script fonts, Leaflet for maps
- **Backend**: FastAPI, port 8001 (replaces the Express+Next.js plan from original spec; same role)
- **Database + Auth + Realtime**: Supabase project `sqhjsctsxlnivcbeclrn`
- **Payments**: Tap Payments (KWD, 3D-Secure, KNET/Visa/MC) — server-side `/api/orders` issues charge, `/api/payment/verify` confirms on redirect
- **Delivery**: Armada v2 (kuwait_format destination, branch_id origin); auto-dispatch on admin Accept
- **Multi-tenant scoping**: TENANT_ID `f1b0c252-...` and BRANCH_ID `e5895a11-...` on every query

## User personas
1. **Guest customer** — browses, orders without account, coupon usage tracked via `lamazi_guest_id` cookie
2. **Registered customer** — earns/redeems loyalty points, tracks orders in profile
3. **Admin/manager** — Supabase Auth login + matching `public.users` row with `role='admin'` (must be created manually in dashboard)

## Implemented (2026-05-12)
### Customer site (7 pages)
- ✅ Home: hero + categories + featured (4) + Watch & Try (3 videos) + Why Choose Us + Loyalty banner
- ✅ Menu: search + category tabs + 4-column grid + URL `?category=` deep-link
- ✅ About: story (2 images + text), values (3 cards), From Our Kitchen (4 YouTube Shorts)
- ✅ Loyalty: disabled-message OR Join + How It Works + live Points Value from Supabase
- ✅ Bag: items, qty stepper, coupon validate, points redeem (logged-in), full summary
- ✅ Checkout: delivery/pickup, OpenStreetMap+Leaflet, "Use My Location" + "Detect on Map", zone match, COD or Tap toggle, places order
- ✅ Auth: signup/signin (Supabase) + profile (loyalty balance + recent orders + signout)
- ✅ Order tracking `/order/:id`: live status with Supabase Realtime UPDATE subscription
- ✅ Payment result: Tap redirect verification

### Admin panel (12 pages)
- ✅ Login (`/admin/login`) with Supabase Auth + `public.users` role check
- ✅ Dashboard (revenue today, orders today, pending, in-progress, delivered, customers, recent orders)
- ✅ Orders (live Realtime, looping Web Audio alert on new pending, Accept→Armada dispatch, Reject, drawer with full details + status workflow)
- ✅ Menu (categories + items CRUD, variants & modifier-group linking)
- ✅ Modifiers (groups + options two-tab)
- ✅ Coupons (full CRUD: percent/fixed, caps, total + per-customer limits, expiry, toggle)
- ✅ Coupon Usage (summary cards + animated progress bars)
- ✅ Loyalty (master toggle + earning + redemption rules; live on storefront)
- ✅ Customers (table + total points issued + manual adjust modal with audit note)
- ✅ Delivery Zones (CRUD + map preview)
- ✅ Operating Hours (per day + multi-range, Kuwait time)
- ✅ Settings (min order, default delivery fee, COD/online toggles with min-1 validation)

### Integrations
- ✅ Tap Payments — create charge, redirect verify, webhook backup
- ✅ Armada v2 — dispatch on Accept, webhook for status sync
- ✅ Supabase REST (backend httpx) + Supabase JS (frontend auth + Realtime)
- ✅ OpenStreetMap + Leaflet + Nominatim for geocoding "Detect on Map"

## Backlog (Phase 2 / nice-to-have)
- **P1**: Hero slider multi-image admin UI (current is single static image with ready-to-add slot)
- **P2**: Variants admin UI inside item editor (CRUD endpoints exist; UI link button placeholder)
- **P2**: Order detail drawer in admin → Edit items / refund flow
- **P2**: Push notifications / email confirmations
- **P2**: Replace Web Audio synth beep with branded notification sound

## Updates (2026-05-14, iteration 2)
- ✅ **Deployment-ready**: `requirements.txt` trimmed to 5 deps (no `emergentintegrations`), Python pinned to 3.11.10, Node pinned to 20.18.0, Vercel `installCommand=yarn install --frozen-lockfile`, `.npmrc legacy-peer-deps=true`, `date-fns` downgraded to ^3.6.0 to fix `react-day-picker@8` peer conflict. Beginner-friendly DEPLOYMENT.md (14 KB) with full troubleshooting matrix.
- ✅ **Checkout map**: click-anywhere reverse geocoding via Nominatim (debounced 1.1s), "Use My Location" auto-fills address, "Detect on Map" forward geocoding, prominent zone-warning banner, Place Order disabled until pin confirmed + zone matches.
- ✅ **Admin Orders rewrite**: card-based grid (1/2/3 cols), full button flow (Accept/Reject → Call Driver + Mark Ready → Delivered), `POST /api/admin/orders/{id}/dispatch-driver` endpoint, idempotent. Order detail modal with full address, items, totals, status history.
- ✅ **Loyalty award on `delivered`**: backend helper `_award_loyalty_points` triggers from admin status PATCH or Armada webhook (idempotent via prior `loyalty_transactions` check).
- ✅ **Customer auth scoped check**: signup now hits `/api/customer/check-exists` (scoped by tenant_id) BEFORE creating Supabase Auth user → no more orphan auth users.
- ✅ **Min order enforcement**: Bag shows warning + disables Checkout when subtotal < min_order_amount; Checkout disables Place Order with the same guard.
- ✅ **Bag persistence on failed payment**: cart NOT cleared when redirecting to Tap; only cleared after `/payment-result` confirms `status=paid`. Failed payments preserve the bag.
- ✅ **Bodoni Moda SC** for "LAMAZI" wordmark in Header, Footer, Home & Loyalty banners.
- ✅ **Bilingual EN/AR toggle** in header (`LanguageProvider`) — RTL direction, localised category/item/modifier names, key UI labels.
- ✅ **Error Boundary** wraps the whole app with branded "Oh sugar, something went wrong" page.
- ✅ **Admin readability** bumped (text-base/text-lg + bold).
- ✅ **Modifiers tab** renamed "Options" → "Modifiers".
- ✅ **Delivery Zones admin** — map preview removed (per request).
- ✅ **Product card click-anywhere** — entire card opens the modal.

## Next tasks
1. After GitHub push, deploy to Render and Vercel per DEPLOYMENT.md (now beginner-friendly with troubleshooting).
2. Once live, register Tap + Armada webhooks against the Render URL.
3. Insert the admin row in `public.users` (Supabase dashboard).
4. Enable Realtime on the `orders` table (Database → Replication).

## Known constraints / behaviours
- Live Tap & Armada keys are in use. Test charges may produce real authorisations — rotate keys after demo.
- Cart persists in localStorage (`lamazi_cart_v1`); checkout intermediate state in sessionStorage.
- Guest coupon usage tracked via `lamazi_guest_id` cookie + `notes ILIKE` lookup on orders (avoids schema change). Use `customer_id` for logged-in users.
- Delivery zone polygon coordinates expected as JSON `[[lng, lat], …]`. Auto-detects [lat,lng] if numbers exceed 180.

## Next tasks
1. Admin to set up operating_hours JSON properly for all weekdays + at least one delivery zone polygon
2. Test full end-to-end purchase flow with a live Tap charge after rotating keys
3. Verify Supabase Realtime is enabled on `orders` table from dashboard
