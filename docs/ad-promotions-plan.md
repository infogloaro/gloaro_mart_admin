# Ad Promotions — plan (shop banners, offers & advertising revenue)

Drafted 2026-10-14 from the "Business Banner, Offers & Advertisement Commission Management System" brief.
The user asked for the **admin part** first. The shop-owner screens (vendor portal and app) come after, against the
API contract in §8.

## 1. What exists today (and how this fits)

| Exists | What it does | How Ad Promotions uses it |
|---|---|---|
| `banners` + Admin → Banners | Platform-owned images in 4 fixed app slots (home carousel and 3 section cards). No shop, schedule, targeting or money. | Stays as is, for GLOARO's own banners. Shop ads are a **separate, paid** layer, shown in the same slots (marked *Sponsored*) and more. |
| `campaigns` + Admin → Campaigns | **Discount** campaigns at checkout. | Unchanged. The new module is named **Ad Promotions** so the two aren't confused. An ad can *point at* a discount campaign ("Deepavali 20% off"), which is where offer redemptions come from. |
| `home_sections` | Curated home rows | Unchanged. Sponsored placements are served alongside them, not inside them. |
| Settlements (weekly payouts) with `settlement_deductions` | Pays shops; deducts commission, TDS and refunds | **Ad payment option 1:** "Pay from my next payout" adds an `advertising` deduction. It works today, with no payment gateway. |
| Payments seam (`services/payments`) | COD, manual and credit only; tied to checkout groups. A Razorpay connector exists but isn't wired. | **Ad payment option 2:** offline payment (bank transfer or UPI) recorded and confirmed by the admin. **Option 3:** online payment once a gateway is wired (on the Channels "coming soon" list). Ads get their own payment records, separate from orders. |
| Invoices (GST series) | Tax invoices for orders | A separate **ad invoice series** (prefix `ADV`), GST on the ad fee. |
| Uploads (`uploadTo(folder)`) | Files saved to a server folder | Banner assets go to `uploads/ads`, with type, size and dimension checks. |
| `states`/`districts` | One state and one district, used for Organisation chapters | Not enough for targeting. A new **region list** (§3) is seeded with India → Tamil Nadu → the districts and cities shops are in, and the admin adds the rest. |
| Analytics events | App sessions and the funnel | Ad impressions and clicks use the same batching pattern, with their own table. |
| RBAC by menu | Permission modules | New module `ad_promotions` (view / edit / delete). |

## 2. Money rules (the important part)

- **Ad fee = advertising revenue.** A shop paying to be promoted is GLOARO advertising income: fee, GST on top,
  invoiced in the ADV series, and booked to an **ad ledger**, separate from order commission.
- **Pricing models**, each switched on or off by the super admin:
  - **A. Fixed fee:** price from the rate card (duration × reach × placement ± rules).
  - **B. Commission on attributed orders:** no upfront fee; GLOARO takes a configured % of **orders that came from the
    ad** (a click on the ad, then an order from that shop within the attribution window, default 7 days). It's
    deducted from settlements like order commission, but **labelled as ad commission**.
  - **C. Fixed + commission:** a base fee upfront plus B's % on attributed orders.
  - **D. Package:** Basic / Growth / Premium / Enterprise, each a fixed price for a duration, reach and set of placements.
- **Never double-charged:** B and C commission applies only to campaigns on those models, and only on attributed
  orders. It's added on top of the shop's normal order commission only when the model says so. Every attributed
  order records which campaign it came from, so it's charged once.
- **Price snapshot:** at checkout the campaign stores the full quote (rate card rows, rules applied, coupon, tax rate,
  model, %). Later price changes never alter a paid campaign.
- **Server is the source of truth:** the app and portal only *display* a quote. The amount charged is recalculated
  on the server from the snapshot.
- **Money in integer paise**, like the rest of the system.
- **Extending a live campaign** charges only for the added hours, at the current rates. Overlapping bookings of the
  same placement, region and time by the same shop are refused, not charged twice.
- **Refunds:**
  - Rejected by the admin → full refund.
  - Cancelled by the shop before it starts → refund minus the configured cancellation fee.
  - Cancelled after it starts → pro-rata refund of the unserved time, if the policy allows (configurable).
  - Settlement-paid refunds go back as a settlement adjustment; offline ones are recorded as paid out.

## 3. Pricing engine

`quote({ vendorId, placement, regions[], level, startAt, endAt | package, model, coupon })` →
`{ lines[], subtotal, discount, tax, total, commissionPercent, snapshot }`, used by the admin calculator, the vendor
portal and checkout.

1. **Duration:** the rate card has **duration packs per reach level**, e.g. City: 1 h ₹100 · 6 h ₹400 · 12 h ₹700 ·
   24 h ₹1,000 · 7 d ₹5,000 · 30 d ₹15,000. For the requested hours, the engine uses the **cheapest combination of
   packs** (10 days = 7 d + 3 × 24 h), so longer bookings are never priced worse than shorter ones. These are the
   brief's sample numbers. The admin sets real ones; nothing is hard-coded.
2. **Reach:** each level (local radius, city, district, state, country, international) has its own pack prices.
   Each region can carry a **multiplier** (Chennai × 1.5, a small town × 0.8) and an **audience estimate** that the
   admin enters. It's displayed as an estimate and never invented. Several regions = the sum of each region's price,
   minus a configurable multi-region discount.
3. **Placement:** the premium for the slot (home banner +50 %, sponsored search +₹200…) and which reach levels and
   formats each slot allows.
4. **Rules**, applied in priority order:
   - festival / seasonal (date window, ± %)
   - peak hours (time of day, ± %)
   - volume (≥ N hours, − %)
   - business category (± %)
   - enterprise / negotiated (a named shop gets a fixed % or price)

   Each rule has an on/off switch and a validity period.
5. **Limits:** a minimum charge, minimum and maximum budget, and the minimum duration per level.
6. **Coupon** (ad coupons, separate from shopping coupons): % or flat, usage caps, validity, minimum spend.
7. **Tax:** GST, default **18 %** (configurable rate and SAC code). **Currency:** INR. International regions are
   priced in INR for now; a currency column is kept for later.

## 4. Campaign lifecycle

```
draft → (paid) → pending_approval → approved → scheduled ──(start)──▶ live ──(end)──▶ completed
                       │                                     │   ▲
                       └─▶ rejected (refund)                 ▼   │
                                              paused ────────┘  (pausing doesn't extend the end date
   cancelled (refund per policy) from any state before completed      unless the admin grants it)
```

- **Paying:**
  - Settlement deduction moves the campaign straight to pending approval.
  - Offline payment waits for the admin's "payment received".
  - Online payment (later) waits for the verified gateway webhook. Each payment has an idempotency key, so a duplicate
    webhook or double click can't charge twice.
- **Approval:** the admin sees the banner preview, the targeting and the price snapshot, then approves or rejects
  with a reason. Every change is kept in the approval history and the audit log.
- **Scheduler:** a minute sweep in `server.js` moves campaigns to live and completed, and handles slot capacity.
- **Notifications:** in-app to the shop on approved, rejected, live, ending soon and completed. WhatsApp later, through
  the event rules.

## 5. Serving and measuring

- `GET /api/ads?placement=&lat=&lng=&city=&district=&state=&country=&categoryId=` (public) returns the live campaigns
  whose regions match the viewer, labelled `sponsored: true`.
  - **Matching:** local radius by lat/lng distance; city, district and state by the viewer's area (the app sends its
    current location or default address); country and international by country.
  - **Capacity:** at most N per placement (admin setting), rotated fairly so each campaign gets its share.
- `POST /api/ads/events`: batches of impressions and clicks, the same pattern as analytics events.
  - An impression is counted once per session per campaign per hour.
  - Enquiries come from the CTA (call or WhatsApp tap).
  - Redemptions are orders that used the linked discount campaign.
  - Attributed orders come from a click followed by an order from that shop within the window (model B and C commission).
- Daily roll-ups (`ad_stats_daily`) keep the dashboard fast.
- Ads never sit inside checkout or the order flow. Sponsored search results are marked *Sponsored* and capped (for
  example, two per page).

## 6. Database (schema AD PROMOTIONS, PHASE 52)

- `ad_regions`
  - id, level (`country`/`state`/`district`/`city`/`locality`), name, parent_id, country_code
  - lat, lng, radius_km (localities), audience_estimate, price_multiplier, active
- `ad_placements`
  - key, name, description, surface, allowed_levels[], formats (sizes)
  - max_live_per_region, premium_percent, premium_cents, active, sort
- `ad_rate_packs`: level, hours, price_cents, active. These are the duration packs per reach level.
- `ad_pricing_rules`
  - name, kind (`seasonal`/`peak`/`volume`/`category`/`enterprise`/`multi_region`)
  - conditions JSONB, adjust_percent / adjust_cents, priority, starts_at, ends_at, active
- `ad_packages`
  - name, tier, price_cents, hours, level, placements[], max_regions, commission_percent, active
- `ad_coupons`
  - code, kind, value, max_uses, used_count, min_spend_cents, starts_at, ends_at, active
- `ad_settings` (one row)
  - models on/off, tax rate and SAC, currency
  - min/max budget, minimum charge, minimum hours per level
  - attribution days, commission % for B and C
  - cancellation fee %, pro-rata refund on/off, auto-approve off
- `ad_campaigns`
  - Who and what: vendor_id, created_by, created_by_role, title, description, offer_text, cta_label, cta_kind (`shop`/`product`/`url`/`call`/`whatsapp`), cta_target, linked discount campaign_id, category_id
  - Where and when: placement_key, level, model, package_id, starts_at, ends_at, hours
  - Money: price snapshot JSONB, subtotal/discount/tax/total cents, commission_percent
  - State: status, payment_status, rejection_reason, paused_at, completed_at
- `ad_campaign_regions` (campaign_id, region_id)
- `ad_assets`
  - campaign_id, url, kind (`banner`/`card`/`square`), width, height, mime, bytes
  - moderation_status
- `ad_payments`
  - campaign_id, method (`settlement`/`offline`/`online`), amount_cents, status, reference
  - idempotency_key UNIQUE, settlement_deduction_id, confirmed_by, timestamps
- `ad_refunds` (payment_id, amount, reason, status, method)
- `ad_invoices`: an ADV series, GSTIN of the shop, taxable / CGST / SGST / IGST
- `ad_ledger`
  - entry (`ad_revenue`/`ad_tax`/`ad_refund`/`ad_commission`/`ad_discount`), campaign_id, amount_cents, occurred_at
  - Revenue reporting reads this, so revenue, tax and refunds are never mixed.
- `ad_events` (campaign_id, event, session_id, user_id, region_id, placement, created_at) and `ad_stats_daily`
- `ad_campaign_history` (campaign_id, from_status, to_status, actor, note): the approval history
- `settlement_deductions.kind` gains `advertising` and `ad_commission`; `orders` gains `ad_campaign_id`, for attribution

## 7. Admin panel (this request)

New menu group **Ad Promotions**:

1. **Dashboard**
   - KPIs:
     - shops advertising
     - campaigns: total / live / pending approval / completed / rejected
     - ad revenue and ad commission
     - pending payments, refunds
   - Revenue by region level, by duration band (hourly / daily / weekly / monthly) and by placement
   - Top shops and top campaigns; impressions, clicks, CTR and conversions over time
   - Date range filter and CSV export
2. **Campaigns**
   - List with status tabs, search and filters (shop, region, placement, dates)
   - Detail: banner preview in its slot, targeting, schedule, price snapshot, payments, history and stats
   - Actions:
     - approve, or reject with a reason (refund)
     - pause / resume, extend (charge for the added hours), cancel (refund per policy)
     - confirm offline payment
   - **Create on behalf of a shop**: the same wizard the shop will use, for walk-in or phone bookings
3. **Pricing setup**
   - Rate packs per reach level: an editable grid of 1 h / 6 h / 12 h / 24 h / 7 d / 30 d, add or remove packs
   - Regions: tree of country → state → district → city → locality, with multipliers and audience estimates
   - Placements: slots, premiums, allowed levels and formats, live-ads cap
   - Rules: seasonal, peak, volume, category, enterprise, multi-region
   - Packages
   - Ad coupons
   - Settings: models on/off, GST, budgets, minimums, attribution, cancellation and refund policy
4. **Price calculator:** pick a shop, slot, regions and dates to see the exact quote line by line, from the same engine.
5. **Payments & ledger:** ad payments, refunds, invoices, and a revenue ledger with CSV export.

Follows the existing panel's look (navy and gold accents, cards, the same tables and modals). Every write is audited.

## 8. Shop and app side (after the admin, as a contract)

- **Vendor portal** `/api/vendor/ads/*`:
  - quote, draft and upload banner, pay (settlement or offline now, online later), submit
  - list and detail with stats, pause, extend, cancel, renew
- **App:**
  - `GET /api/ads` for each slot, a *Sponsored* label, `POST /api/ads/events`
  - an "Advertise your shop" wizard in the vendor app
  - sent to gloaro-mart-51 once the API exists

## 9. Build order (admin first)

| Step | What | Verified by |
|---|---|---|
| A1 | Schema, seeds (sample rate cards from the brief, India → Tamil Nadu → current cities), **pricing engine**, Pricing setup screens, calculator | API checks on every pricing rule, cheapest-pack maths, snapshot |
| A2 | Campaigns admin: create on behalf, payments (settlement deduction and offline), approval, lifecycle sweep, refunds, ADV invoices, ledger | Lifecycle, refund and idempotency checks |
| A3 | Serving `GET /api/ads` and events, roll-ups, **dashboard**, exports, attribution for B and C commission | Targeting, capacity, counting and dashboard numbers |
| V | Vendor portal API, then the app screens (other session) | Contract checks |

Each step is tested on a throwaway database copy, as before.

## Progress

**A1 done (2026-10-14): pricing.** The user said "continue", which accepted the §10 defaults.
- **Backend:** schema AD PROMOTIONS — PRICING (PHASE 52), `npm run migrate:ads` (seeds where empty), `services/adPricing.js`
  (the quote engine), `services/adSeeds.js`, `controllers/adPricing.controller.js`, routes `/api/admin/ads/*`, permission
  module `ad_promotions`.
- **Admin:** Marketing & CMS → **Ad Pricing** (`/ads/pricing`), with these tabs:
  - Price calculator
  - Rate cards (packs per level, shortest booking, level on/off)
  - Regions (tree; multipliers, audience estimates, localities with point and radius, countries)
  - Placements, Rules, Packages, Coupons
  - Settings (models A–D, commission %, attribution days, GST/SAC, minimum charge and budgets, cancellation fee, pro-rata refund)
- **Verified:** 62 API checks on a throwaway DB copy (dropped), covering:
  - cheapest-pack maths (20 h → one 24 h pack; 10 days → 7 d + 3 × 24 h)
  - region multipliers and placement premiums (% and fixed)
  - every rule kind, including seasonal and peak applied only to the hours they cover
  - packages, coupons (cap, minimum spend), the minimum charge and budget limits
  - models B and C, tax change, snapshot contents
  - CRUD validation and audit
- Seeds are the brief's sample prices: city 1 h ₹100 … 30 d ₹15,000; local ×0.5, district ×1.5, state ×4, country ×15,
  international ×30. Chennai ×1.5, Dindigul ×0.8.

**A2 done (2026-10-15): campaigns and money.**
- **Backend:**
  - schema AD PROMOTIONS — CAMPAIGNS (PHASE 53, same `npm run migrate:ads`)
  - `services/adCampaigns.js`, `controllers/adCampaign.controller.js`
  - `server.js` runs the schedule sweep every 60 s (`AD_SWEEP_SECONDS`)
  - uploads area `ads`
  - new `vendor_charges` (shop charges and credits outside orders) that `services/settlements.js` now takes into the weekly
    settlement: advertising deductions and ad-refund credits, each once. A shop with only ad charges still gets a
    cycle; a negative balance carries forward as before.
- **Admin:** Marketing & CMS → **Ad Campaigns** (tabs: needs approval, waiting for payment, live & scheduled, drafts,
  completed, rejected & cancelled). It has:
  - a booking form with a live price
  - campaign detail: banner preview in the slot with a size check, payments (money received), refunds (refund sent),
    ADV invoices, history
  - actions: take payment (from payout or bank/UPI), approve, reject, pause/resume, extend (price shown first, only the
    added hours charged), cancel (the policy shown)

  **Ad Payments** shows net revenue, GST, what's waiting, refunds to send, and the payments list.
- **Rules as built:**
  - The price is re-quoted at payment; if it moved from what was agreed, payment stops and shows the new price.
  - Idempotency key on payments and extensions.
  - Approval checks slot capacity (placement × region × overlapping dates).
  - Rejection refunds in full.
  - Cancelling before the start refunds minus the cancellation fee; cancelling while running refunds the unserved share
    (if pro-rata is on).
  - Refunds are split over the campaign's payments: payout payments are credited at once, bank/UPI payments wait for
    "refund sent".
  - Ledger entries: revenue, tax, discount, refund and tax refund.
  - ADV/FY/NNNNNN invoices: CGST+SGST when GLOARO's state (General Settings) equals the shop's, IGST otherwise.
    Unknown states count as the same state.
- **Also fixed:** Settlements showed credits as "−₹-x"; credits now show as "+₹x". `ApiError` now carries the error body
  (used for "confirm this new price").
- **Verified:** 55 API checks on a throwaway DB copy, covering:
  - drafts, validation, re-pricing
  - payout and offline payment, idempotency
  - invoice and ledger entries
  - approval and capacity, rejection refund
  - the offline flow and cancel fee
  - sweep to live and completed, pause/resume, extension
  - pro-rata cancel split over two payments
  - commission-only campaigns
  - the settlement run taking the charges and credits exactly once
  - list filters, history, money totals, audit

  The 62 pricing checks were re-run after the engine change.

**A3 done (2026-10-15): serving, results, dashboard.**
- **Backend:**
  - schema AD PROMOTIONS — SERVING & RESULTS (PHASE 54)
  - `services/adServing.js`, `routes/ads.routes.js` (public), `controllers/adDashboard.controller.js`
  - the ad sweep also credits orders
- **Serving:** `GET /api/ads?placement=` returns live campaigns with a banner whose regions cover the viewer.
  - Localities are matched by distance; cities, districts and states by name (case and spacing ignored; a district also
    matches the city name); countries by code.
  - The category banner only shows for its category.
  - At most the slot's "ads at once", in random order.
- **Events:** `POST /api/ads/events` counts views once per session, campaign and slot per hour, and taps or enquiries
  once per minute.
  - Only while the campaign runs, and only in a slot it booked.
  - Daily totals in `ad_stats_daily` are kept as events arrive.
- **Attribution:** a delivered order is credited to the signed-in customer's latest tap on one of that shop's ads before
  ordering, within the campaign's attribution days. Each order once.
  - On models B and C, the campaign's % of goods value after discounts becomes an `ad_commission` vendor charge (taken in
    settlement) and an `ad_commission` ledger entry.
  - Fixed-fee ads get the order counted, with no charge.
  - Signed-out taps can't be credited.
- **Admin:** Marketing & CMS → **Ad Promotions** dashboard (`/ads`):
  - KPI tiles and a date range with presets
  - ad money per day (area chart), plus views and taps as two separate charts (never two axes)
  - revenue by placement (shared out by each slot's quote line), reach level, campaign length and region (top 10)
  - top shops and top campaigns (views, taps, CTR, orders, offer redemptions)
  - a numbers table and CSV export of campaigns or the ledger (formula-safe cells, BOM for Excel)
  - each campaign shows its results
- **App:** the contract was sent to gloaro-mart-51 (fetch per slot, Sponsored label, button actions, report views and
  taps with the token).
- **Verified:** 43 API checks on a throwaway DB copy (dropped), covering:
  - targeting by city, state, locality distance, category and capacity; a switched-off slot
  - event dedupe, wrong slot, not running
  - attribution with commission, payout charge and ledger; no tap means no credit; fixed fee means no charge; once per order
  - dashboard totals against the ledger, splits that add up, top lists, campaign stats
  - CSV exports and formula defusing

**V done (2026-10-15): vendor portal API.**
- **Backend:** `controllers/vendorAds.controller.js`, routes `/api/vendor/ads/*`. The same `services/adCampaigns.js` rules
  apply, plus `renew`; pause, resume and extend record who acted.
  - A shop only sees and changes its own campaigns (any other id is 404).
  - `vendorId` in a body is ignored.
  - The shop's own negotiated rules apply to its quotes.
  - It can't approve or reject.
- **Endpoints:**
  - `GET /options`
  - `POST /quote`
  - `POST /uploads`
  - `GET|POST /campaigns`
  - `GET|PATCH /campaigns/:id`
  - `GET /campaigns/:id/stats`
  - `POST|DELETE /campaigns/:id/assets[/:assetId]`
  - `POST /campaigns/:id/pay|pause|resume|cancel|extend|renew`

  Admin also got `POST /api/admin/ads/campaigns/:id/renew`.
- **Also:** shops now get a `new_order` notification (link `/vendor/orders/<id>`), asked for by the app session so the
  vendor app can stop polling.
  - Sent at checkout for COD and credit, at payment capture for online orders, and to the new shop on a re-route.
  - Once per order (`services/vendorNotify.js`).
- **Verified:** 28 API checks on a throwaway DB copy, covering:
  - ownership, the shop's own deal, upload to `/uploads/ads`, pay and idempotency, no self-approval
  - pause/resume, extend, stats, renew (copies the banner and targeting), cancel refund
  - lists scoped to the shop
  - notification once per COD order, none for an unpaid online order
- The contract went to the app session (`gloaro-mart-b9`).

**Remaining:**
- The vendor app's Advertise screens (app session).
- Notes:
  - Commission isn't reversed if an attributed order is later returned.
  - Online payment waits for the payment gateway.

## 10. Decisions to confirm

1. **Payment until a gateway is wired:** "pay from next payout" (settlement deduction) plus offline payment confirmed
   by the admin. Online payment comes with the gateway. OK?
2. **GST on ad fees:** 18 % by default (configurable). OK?
3. **Model B "percentage commission":** read as a % of **orders the ad brought in**, not a % of the ad fee. OK?
4. **Pay first, then approval** (as the brief says), with an automatic full refund on rejection. The alternative is
   approve first, then pay, which avoids refunds.
5. **Seed prices:** use the brief's sample numbers as the starting rate card, clearly marked to be changed.
