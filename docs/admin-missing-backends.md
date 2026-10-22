# Admin menus without a backend — one by one

Started 2026-10-14. Of 51 admin menus, 34 worked, 1 was partial and 16 called endpoints the backend did not
have (checked by probing every menu's endpoints against the running server). Each is built against the contract its
page already expects (`ENDPOINTS` list + types in `src/lib/types.ts`), with a public endpoint when the app needs it.
Order: what unblocks the app first.

| # | Menu | Status | Backend | App side |
|---|---|---|---|---|
| 1 | Home Sections (`/cms`) | **Done** | `homeSection.controller.js`, schema HOME SECTIONS (PHASE 32), `npm run migrate:home-sections` | Public `GET /api/home/sections?audience=`; contract sent to the gloaro-mart-ff session (it owns G_mart) |
| 2 | Campaigns | **Done** | `campaign.controller.js`, `services/campaigns.js`, schema CAMPAIGNS (PHASE 33), `npm run migrate:campaigns`; **checkout applies campaigns** | Public `GET /api/campaigns/active`; vendor portal `GET /api/vendor/campaigns`, `POST .../:id/opt-in|opt-out`; contract sent to gloaro-mart-ff |
| 3 | Reviews & Ratings | **Done** | `review.controller.js` (rewritten), `routes/review.routes.js`, schema REVIEWS & RATINGS (PHASE 34), `npm run migrate:reviews` | Public `GET /api/products/:id/reviews`, `GET /api/vendors/:id/reviews`; customer `PUT/GET /api/products/:id/review`, `/api/reviews/*`; vendor portal `/api/vendor/reviews`; contract sent to gloaro-mart-ff |
| 4 | Cancellations | **Done** | `services/cancellations.js`, `cancellation.controller.js`, schema CANCELLATIONS (PHASE 35), `npm run migrate:cancellations` | Customer `POST /api/orders/:id/cancel` (200 instant / 202 queued), `GET`/`DELETE /api/orders/:id/cancellation`, `cancellation_policy` on order detail; vendor `PATCH /api/orders/:id/status` cancelled follows the rules; contract sent to gloaro-mart-7b |
| 5 | Support Tickets | **Done** | `support.controller.js`, `routes/support.routes.js`, schema SUPPORT TICKETS (PHASE 36), `npm run migrate:support` | Customer/vendor `/api/support/tickets*`, `POST /api/support/attachments`; contract sent to gloaro-mart-7b |
| 6 | Shipments | **Done** | `services/shipments.js`, `shipment.controller.js`, schema SHIPMENTS (PHASE 37, with backfill), `npm run migrate:shipments` | Customer `GET /api/orders/:id/shipments`; contract sent to gloaro-mart-51 |
| 7 | Delivery Partners | **Done** | `deliveryPartner.controller.js`, schema DELIVERY PARTNERS (PHASE 38), `npm run migrate:delivery-partners`; assignment in `shipment.controller.js` | No app change (customers already see the partner name/phone through shipments) |
| 8 | Vendor Matching (partial: config, summary, reassignments) | **Done** | `matchingAdmin.controller.js`, `reassignment.controller.js` (re-route core + accept-window sweep, run by `server.js`), `services/matching.js`, schema VENDOR MATCHING RULES (PHASE 39), `npm run migrate:matching-rules` | New notifications `order_rerouted`, `reassignment_offer`; told gloaro-mart-51 |
| 9 | Invoices & GST | **Done** | `services/invoices.js` (issued on delivery), `invoice.controller.js`, schema INVOICES & GST (PHASE 40), `npm run migrate:invoices` (also backfills) | Customer `GET /api/orders/:id/invoice`; told gloaro-mart-51 |
| 10 | Credit Notes | **Done** | `services/creditNotes.js`, `creditNote.controller.js`, schema CREDIT NOTES (PHASE 41), `npm run migrate:credit-notes`; approved returns raise one | Customer `GET /api/orders/:id/credit-notes`; told gloaro-mart-51 |
| 11 | Settlements | **Done** | `services/settlements.js` (weekly generation, run hourly by `server.js` + on page load), `settlement.controller.js`, schema SETTLEMENTS (PHASE 42), `npm run migrate:settlements` | Vendor portal `GET /api/vendor/settlements[/:id]`, `GET/PUT /api/vendor/bank-account`; told gloaro-mart-51 |
| 12 | Replacements (+ Returns, which was also broken) | **Done** | `services/replacements.js`, `replacement.controller.js`, `returns.controller.js` (rewritten), schema RETURNS LIFECYCLE & REPLACEMENTS (PHASE 43), `npm run migrate:replacements` | Return `resolution`, dispute endpoint, one return per order; told gloaro-mart-51 |
| 13 | Business Accounts | **Done** | `services/business.js`, `business.controller.js`, `routes/business.routes.js`, `services/payments/credit.js`, schema BUSINESS ACCOUNTS (PHASE 44), `npm run migrate:business-accounts`; checkout + invoices changed | Customer `/api/business/*`, checkout `businessAccountId` + `paymentMethod: 'credit'`; told gloaro-mart-51 |
| 14 | RFQ Management | **Done** | `services/rfqs.js`, `rfq.controller.js`, schema RFQS & QUOTATIONS (PHASE 45, also the quotation tables), `npm run migrate:rfqs` | Business `/api/business/rfqs*`, vendor portal `/api/vendor/rfqs*` (incl. submitting quotations); told gloaro-mart-51 |
| 15 | Quotations | **Done** | `services/quotations.js`, `quotation.controller.js`; awarding raises the PO (schema PURCHASE ORDERS, PHASE 46, `npm run migrate:purchase-orders`) | Buyer `/api/business/quotations/:id/*`, vendor `/api/vendor/quotations/:id/*`; told gloaro-mart-51 |
| 16 | Purchase Orders | **Done** | `services/purchaseOrders.js`, `purchaseOrder.controller.js`, schema PURCHASE ORDER FULFILMENT (PHASE 47; applied by `npm run migrate:purchase-orders`) | Vendor portal `/api/vendor/purchase-orders*` (acknowledge, deliveries, payments), business `/api/business/purchase-orders*`; told gloaro-mart-51 |
| 17 | Analytics | **Done** | `adminAnalytics` in `analytics.controller.js`, `services/analytics.js`, schema ANALYTICS (PHASE 48), `npm run migrate:analytics` | App `POST /api/analytics/events`; checkout takes `origin` + `X-Session-Id`; told gloaro-mart-51 |

**Final re-probe (2026-10-14), latest code, on a DB copy:** every `ENDPOINTS` entry on all 55 pages (151) and
every `api.*` / `useApiData` call in `src/` (221) reaches a route — none missing. The only server error, an empty
`POST /api/admin/platforms` returning 500 (a missing categoryId reached Postgres as NaN), now returns 400.

## 1. Home Sections — notes
- Six types. `local_deals` is automatic (products with the biggest MRP discount, sellable only); the rest are picked by
  hand from categories, approved shops, approved B2B shops, sellable products or active banners.
- Items are stored as ids and resolved on every read, so renamed things update and hidden/deleted ones drop out.
- On screen = switched on, inside the optional window, not empty. New sections are added off, at the bottom.
- Reorder sends the whole order and is refused (409) if the list changed meanwhile.
- Permission: the existing `home_sections` module. Audit module `marketing`.
- Verified: 23 API checks plus a browser run (create, add products by search, switch on, public feed order).

## 2. Campaigns — notes
- Status is computed from `state` (draft/active/paused/ended) + dates + budget: scheduled before start, ended after
  the end or once spend reaches the budget. Spend = sum of `order_campaigns.discount_cents` on orders not cancelled,
  so a cancelled order frees its budget automatically.
- Checkout (`order.controller.js` → `bestCampaignForOrder`): per shop order, the largest discount among running
  campaigns the order qualifies for (scope, min order, opt-in for shop/shared-funded, max discount, remaining budget),
  on top of any coupon; candidate campaign rows are locked `FOR UPDATE` so parallel checkouts can't overspend.
  `orders.discount_cents` = coupon + campaign (totals/groups unchanged); `orders.campaign_discount_cents` = campaign part;
  `order_campaigns` stores the discount and the platform/vendor split.
- Added beyond the page's original contract (it said "add shops or categories" but had no way to): participant
  search/add/remove and "mark agreed" (logged as done by an admin on the shop's behalf); `Start it` no longer blocked for
  whole-marketplace platform-funded campaigns, which need no participants; the server says why a campaign can't start.
- Discount, scope and funding are fixed once created/started; dates, budget (not below what's spent), name, banner editable.
- Verified: 28 admin/vendor API checks; real checkouts on a throwaway DB copy (10% off, budget cap, exhausted budget,
  cancel frees budget, two parallel checkouts spent exactly the budget, min order, 40/60 shared split); browser flow.
- Not done: no coupon+campaign stacking rules beyond "both apply, never below zero"; no campaign banner upload field
  (`bannerUrl` accepted by the API); vendor app UI for opt-in (endpoints only).

## 3. Reviews & Ratings — notes
- One table for both kinds: Phase 13's `vendor_reviews` keeps its name (so that block can still be re-run) and gains
  `target` (`vendor`|`product`), `product_id`, `title`, `photos`, `status`, moderation and vendor-reply columns. New
  `review_reports` and `review_helpful`; `products.rating_count` / `rating_average`.
- Rules (my choice, the user didn't specify): shop reviews need a delivered order (as before) and go live at once.
  Any signed-in customer can review a product; with a delivered order containing it, it's verified and live at once,
  otherwise it's unverified and waits in the admin queue. One product review per customer per product (edits update it).
  A review that was taken down goes back to pending when edited, even if verified, so editing can't bypass a moderator.
  Vendors can't review their own products.
- `flagged` isn't stored: it's a published review with open reports, and it stays live. Publish keeps it and dismisses
  the reports; Take down needs a reason, upholds the reports, and the author gets a notification (`notifications` row)
  with that reason. Pending → published also notifies the author.
- Shop and product averages are rebuilt from published rows on every change (no running deltas), so they can't drift.
- Photos: `POST /api/reviews/photos` (customer, multipart `file`, JPG/PNG/WebP ≤ 5 MB) saves to `uploads/reviews/`;
  a review only accepts paths from there (max 5).
- Audit module `customers`: `review.published|rejected|reports_dismissed|reply_removed`. Permission: the existing
  `reviews` module (PATCH/POST = edit, DELETE reply = delete).
- Verified: 55 API checks plus photo upload on a throwaway DB copy (dropped afterwards): verified/unverified flow,
  queue, publish, report/flag/dismiss, helpful, vendor reply + admin removal, take-down with reason and notification,
  re-edit stays pending, shop review path and `my_review` unchanged, averages after each step. Admin page not yet
  checked in the browser (the running :4000 server needs a restart to load the routes).
- Not done: G_mart screens (contract sent to gloaro-mart-ff); vendor app UI for replies (endpoints only); no
  rate limit on reports; reviews from deleted orders follow the order (cascade).

## 4. Cancellations — notes
- One rule per stage (pending, confirmed, packed, out for delivery; delivered = a return). Defaults: pending —
  everyone, instant, no fee; confirmed — allowed, admin approves; packed — allowed, admin approves, 5% fee;
  out for delivery — nobody (requests recorded as ineligible), 10% fee, no restock. My choice; change on the Rules tab.
- Every cancellation, by anyone, goes through `services/cancellations.js` and gets an `order_cancellations` row
  (CXL-YYYY-NNNNN), so the list is the full record: customer (rules), vendor (rules; an allowed vendor cancels at once,
  auto-approve only governs customers), admin from the Orders page (always allowed, full refund, restock).
- Money: the fee applies only to customer-asked cancellations, as a % of the order value but never more than was paid
  online (paid = captured − refunded − refunds still open on the purchase). COD that wasn't collected → no refund, no
  fee. Vendor-asked → fee forced to 0. Approving raises a pending `refunds` row (sent by the Refunds page as before).
- A request keeps the terms (fee %, restock) of the rule when it was raised. One waiting request per order; a shop
  cancelling at once closes a waiting customer request (withdrawn). Approving refuses orders that were delivered or
  cancelled meanwhile. Restock off → units stay counted as sold.
- Fixed along the way: vendors could cancel even delivered orders and never raised a refund for prepaid orders; the
  admin Orders page cancel also raised no refund. All three now go through the service.
- Compatibility: `POST /api/orders/:id/cancel` still takes `{ reason }` free text (stored as reason "Other" + note);
  `can_cancel` still means "cancels at once"; the vendor PATCH still answers 200 when it goes through.
- Admin page change: the decision window now uses `refundableCents` (what was paid) instead of the order value, and
  hides the fee for vendor requests and unpaid orders.
- Notifications: `order_cancelled` (shop/admin cancelled), `cancellation_approved`, `cancellation_rejected`.
  Audit module `orders`: `cancellation.approved|approved_override|rejected`, `cancellation_rules.updated`.
- Verified: 52 API checks on a throwaway DB copy (dropped). Not checked in the browser (the :4000 server needs a restart).
- Not done: G_mart screens; no time-based rule (e.g. "free within 5 minutes"); reassignment's system cancels
  (re-routing) aren't recorded here.
- Later, for G_mart: `GET /api/orders/groups` gained `payableCents` (sum of non-cancelled orders) and `cancelledCount`.
  G_mart now uses the cancellation contract (verified by gloaro-mart-7b on local data).

## 5. Support Tickets — notes
- Customers and vendors open tickets in the app (optionally about one of their own orders); staff work them on the
  admin page. References TKT-YYYY-NNNNN.
- Deadlines by priority, from when it was opened (in code, `SLA` in support.controller.js): urgent 1 h / 8 h, high
  4 h / 24 h, normal 8 h / 48 h, low 24 h / 96 h (first reply / resolution). Changing priority recalculates both.
  Payment tickets start high, the rest normal. My choice; no admin screen to edit them yet.
- A staff reply (not an internal note) counts as the first response, assigns an unowned ticket to whoever answered,
  re-opens a resolved one, and tells the requester (notification `support_reply`, plus email via Resend when
  `RESEND_API_KEY` is set — failures are logged, never block the reply). Staff show to requesters as "Gloaro Mart
  Support". Internal notes are never listed to the requester (also enforced by a CHECK).
- A requester's reply puts the ticket back to open (from pending_* or resolved); they can mark it resolved; closed is
  final for both sides (requester opens a new one). Max 5 open tickets per person (429).
- Owner, priority and status changes are noted in the thread as internal system notes and audited
  (`support_ticket.updated`, module `support`). Agents = super admins + roles with support edit/delete.
- Attachments: `POST /api/support/attachments` → `uploads/support/` (images, ≤ 5 MB, max 5 per message).
- Verified: 38 API checks on a throwaway DB copy with email disabled (dropped afterwards).
- Not done: G_mart screens; vendors aren't brought into a customer's ticket (pending_vendor is a manual status);
  no auto-close of resolved tickets; no canned replies; staff can't attach files from the admin page (API accepts them).

## 6. Shipments — notes
- A shipment opens when the order is packed (vendor or admin) and follows the order: out for delivery, delivered and
  cancelled on the order are mirrored onto the open shipment (`onOrderStatusChanged`, called inside the order's own
  transaction in the vendor PATCH, the admin PATCH and the cancellation service). Courier name/phone/ETA set on the
  order are copied to the open shipment.
- Scans recorded on the admin page move the order the other way: out for delivery → order out for delivery (from
  confirmed/packed); delivered → order delivered, with the vendor wallet credit and COD settlement the other paths run.
  Forward only while on the road; repeat in-transit scans (another hub) allowed. Append-only trail.
- Failed (reason required) closes that shipment and opens the next attempt for the same order: attempt n+1, tracking
  `GMS-…-A2`, same courier details. "Failed delivery" on the page counts failures still waiting on that next attempt.
- Returned (reason required) closes it and cancels the order through the cancellation service as an admin
  cancellation (full refund if prepaid, stock back), so it shows on the Cancellations page too.
- COD amount = order total when the purchase was COD, else prepaid. Tracking numbers `GMS-YYYY-NNNNNN`.
- `PATCH /api/admin/shipments/:id` (not used by the page yet) sets partner name/phone, courier tracking id + https
  URL, parcel count, weight, ETA on an open shipment — ready for the Delivery Partners step.
- Backfill: orders already packed / out for delivery / delivered got shipments with events from their status history
  (local DB: 8 delivered, 1 out for delivery).
- Verified: 35 API checks on a throwaway DB copy (dropped). The earlier cancellation test script was lost with a session
  restart, so the 52 cancellation checks were not re-run; the shipment checks cover the shared cancel path (admin cancel
  closes the shipment, returned → admin cancellation row).
- Not done: partners are free text until #7; no Shiprocket sync (the connector exists, webhooks are logged only); vendors
  can't record scans themselves; no split into several parcels per order (one shipment per attempt).

## 7. Delivery Partners — notes
- Partners (rider or courier agency) are added by staff — there is no rider app or self-signup. They start pending;
  onboarding needs a licence and ID proof on file, the newest of each not expired and not rejected. Onboarding approves
  the paperwork still pending (the window is the review); single documents can also be approved/rejected.
- "Online" is a staff switch (Mark on/off shift) until a rider app exists. Offline partners get no new work.
- Assignment happens on the Shipments page (`POST /api/admin/shipments/:id/assign`, picker from
  `GET /api/admin/shipments/:id/partners`, both under the shipments permission). A partner can take a shipment when
  active, online, paperwork in date and active assignments < daily capacity; the picker lists the rest with the reason
  and sorts those covering the delivery pincode/area/city first. The order's courier name/phone follow, so the customer
  sees who is coming. Taking a partner off is `partnerId: null`.
- Suspending puts everything they were carrying back to unassigned, with a note on each trail; they go offline.
  Reinstating needs paperwork in date again.
- Cash held = COD on their delivered shipments minus recorded handovers; a handover can't exceed what they hold.
- On-time rate = delivered by the shipment's ETA / delivered with an ETA; failure rate = failed / (delivered + failed).
  Ratings are null — customers can't rate partners yet.
- Admin page additions (beyond its original contract): Add partner form, Add document (image upload to
  `uploads/partners/` or an https link, optional expiry), approve/reject per document, Mark on/off shift, Record
  handover; Shipments window: Delivery partner picker.
- Until the :4000 server is restarted it runs code from before Shipments, so any order packed through it gets no
  shipment. Re-running `npm run migrate:shipments` backfills those (it's safe to repeat; re-run on the local DB).
- Verified: 32 API checks on a throwaway DB copy (dropped). Frontend typechecks; not checked in the browser.
- Not done: rider app / login, partner payouts, customer rating of partners, document PDFs (images only), automatic
  assignment.

## 8. Vendor Matching — notes
- Checkout still sends each order to the shop the customer chose; the engine ranks alternatives (browsing) and picks
  the replacement when an order is re-routed. The page's rules are now enforced, not just stored:
  - **Factors**: switching one off makes it count for nothing but keeps its weight (`disabled_factors`).
  - **Max radius** (default 15 km): a shop further away is never deliverable (reason "Beyond the maximum radius").
  - **Accept window** (default 15 min): `server.js` sweeps every 60 s (`MATCHING_SWEEP_SECONDS`, 0 = off) and re-routes
    pending orders the shop hasn't accepted. Only orders placed after the migration (`accept_window_since`), only paid
    or COD ones, and only once per order.
  - **Re-route automatically** (default on): off → the re-route waits on the Re-routing tab for an admin.
  - **Max re-route attempts** (default 2): counted along the chain of replacement orders; then "no alternative".
  - **Price tolerance** (default 10%, added to the page): a dearer replacement asks the customer first (existing rule).
- One routine (`rerouteOrder`) for all triggers. A shop that *rejects* loses the order at once (stock back, counted as
  a rejection). A shop that *ran out of time* keeps it until a replacement is actually placed — so "Keep with original"
  on the page leaves it with them, and they can still accept. For a rejected order the button reads "Don't re-route".
- Approving re-matches at that moment (stock/prices may have moved); if it became dearer it goes to the customer instead.
  A re-route waiting for the customer can't be approved by an admin. If the shop accepted meanwhile, approval is refused.
- Match log: each run for an order records the order, attempt, outcome (matched / reassigned / no vendor / expired),
  reason and duration; browse runs show as "<product> · browsing". `?context=orders` filters to order runs.
- Summary: matched today = orders placed today + orders moved today; unmatched = "no alternative" in 30 days;
  avg candidates over 7 days; avg match time from the logged durations.
- Customers are notified when an order moves (`order_rerouted`), a dearer offer waits (`reassignment_offer`), or it
  can't be placed anywhere (`order_cancelled`).
- Verified: 31 API checks on a throwaway DB copy (dropped) — automatic re-route, attempt limit, admin approve, sweep
  (waits for admin, original kept, not swept again, shop can still accept, old orders untouched), dearer → customer.
- Not done: refunds for prepaid orders a shop rejects (all orders are COD today; the rejection path doesn't go through
  the cancellation service); no automatic match at checkout (customer's choice stands, by design).

## 9. Invoices & GST — notes
- One tax invoice per delivered shop order, issued automatically when the order is delivered (vendor PATCH, admin
  PATCH or a delivered scan — all three call `issueAfterDelivery`, which logs rather than failing the delivery).
  Never edited: wrong → cancel (reason required; the number is never reused) and issue again, or a credit note (#10).
- Numbers: `<invoice_prefix>/<financial year>/<6 digits>` (prefix from Settings, default GLM; FY April–March, India
  time), gapless via a locked counter row. Local DB backfilled: GLM/2026-27/000001–000009, dated at delivery.
- Supplier = the shop (name, GSTIN, state, address copied in). Place of supply = delivery state; same state as the shop
  → CGST + SGST halves, different → IGST. Missing state on either side counts as same state.
- **Amounts mirror what checkout charged**, so the invoice equals what was paid (verified, round-off 0):
  GST per line on the line's value; the order's coupon + campaign discount is spread over lines (shown as "less
  discount") and taken off *after* tax; delivery charge is a 0% line, SAC 9968.
  ⚠ Decision for the user: GST law normally wants a discount given at the time of sale to reduce the taxable value
  (GST on the discounted price). Checkout charges GST before the discount, so customers pay slightly more tax than due
  on discounted orders, and delivery is charged without GST. Fixing it is a checkout pricing change, not an invoice one.
- B2B: there is no buyer GSTIN on orders yet (Business Accounts, #13), so every invoice is B2C for now; `buyer_gstin`
  is ready.
- Export for filing: CSV, one row per invoice per tax rate (GSTR-1 shape), cancelled ones included and marked.
- API not on the page: `POST /api/admin/invoices/:id/cancel {reason}`, `POST /api/admin/invoices/issue {orderId}`.
- Verified: 24 API checks on a throwaway DB copy (dropped) — backfill totals = order totals, auto-issue on delivery,
  inter-state IGST, discount spread, delivery line, idempotent issue, cancel + re-issue, gapless numbers, filters, CSV,
  customer copy. (One more check failed on the test's own JSON parsing of `null`, not the server.)
- Not done: PDF (pdfUrl stays null — the app can render from the JSON), e-invoicing (IRN/QR, needed above ₹5 cr
  turnover), cess, cancel button on the page.

## 10. Credit Notes — notes
- Raised against an issued invoice, per invoice line and quantity (partial returns credit part of a line). Own gapless
  series per financial year: `<prefix>-CN/<FY>/<6 digits>` (counter row `CN:<FY>` in invoice_series). Never edited;
  cancelling puts the invoice back in full. A cancelled invoice can't be credited; a credit-noted invoice can't be cancelled.
- Amounts are pro rata on the invoice line — taxable, CGST/SGST/IGST and the line's share of the after-tax discount —
  and crediting the last units of a line takes exactly what's left, so the totals can never exceed the invoice.
  Total credited = taxable + tax − discount (= what the customer paid for those units). The page's estimate and detail
  now include the discount line ("Less discount given").
- Money: an online payment gets a refund — an existing refund on the order not yet tied to a credit note is reused
  (e.g. the return's), otherwise a new pending refund capped at what's refundable. COD is settled off-platform (same
  rule returns already follow), so a COD credit note has no refund and doesn't count as "awaiting refund".
- Cancelling: refused once its refund is processing/completed; a pending refund raised *for the note* is cancelled
  with it; a return's refund is left alone. The invoice then shows its latest live credit note, or none.
- **Approving a return now raises its credit note automatically** (whole remaining invoice, reason "return", linked to
  the return's refund). Logged rather than failing the approval; can be raised by hand otherwise.
- Fixed for the page: the invoice picker searches all months (`GET /api/admin/invoices` month now optional, type=all ok).
- Verified: 29 API checks on a throwaway DB copy (dropped). Frontend typechecks; not checked in the browser.
- Not done: PDF; credit notes for B2B (no buyer GSTIN yet); a debit note (charging more after the invoice).

## 11. Settlements — notes
- Weekly cycles, Monday–Sunday India time, one settlement per vendor per cycle, generated once the week is over
  (hourly in `server.js`, `SETTLEMENT_SWEEP_MINUTES`, 0 = off; also on loading the page; `POST /api/admin/settlements/generate`).
  Only cycles from `settlement_config.generate_from` (migration date − 90 days) are generated, so history isn't paid out.
- Per order: **gross** = what the customer paid + discounts the platform funded (platform share of a campaign, and
  coupons with no shop); **commission** = the commission plan's % of the goods value (subtotal) — vendor plan, else the
  item's category plan (matched by category name), else global (10%) — plus its flat fee per order.
- **Deductions**: refunds *completed* on the vendor's already-settled orders (each taken once); TDS and TCS at
  `settlement_config` rates — ⚠ defaults **0.1% TDS (s.194-O, on gross)** and **0.5% TCS (GST s.52, on taxable value)**
  are my reading of the current rates; confirm with the accountant before paying out.
- Net ≤ 0 → kept as a **draft** (not approvable); its balance is carried into the vendor's next cycle as an adjustment.
  Anything late for a cycle that's already approved/paid rolls into the next open finished week.
- pending_approval → approved (needs a bank account; the account is copied onto the settlement so a later change can't
  redirect it) → paid (UTR, 6–22 letters/digits, unique, one-way). Hold (reason) from pending/approved; fail (reason,
  bank bounced) from approved, then pay again. Batch approve is all-or-nothing. Manual adjustments (signed, with a note)
  before approval: `POST /api/admin/settlements/:id/adjustments`. Vendor notified at each step (`settlement`).
- **Bank accounts** (new): `vendor_bank_accounts`; admins add/change on the settlement window (added to the page),
  vendors via the vendor portal. Only the last 4 digits are ever shown or audited.
- Verified: 34 API checks on a throwaway DB copy (dropped) — generation arithmetic, idempotent re-run, this week left
  alone, approve/hold/fail/pay, UTR rules, batch all-or-nothing, adjustment, refund after payout → negative draft →
  carried forward, vendor portal. (A 35th check flagged an old WhatsApp test setting whose digits matched; not this code.)
- Not done: actual bank transfers (staff pay outside and record the UTR); vendor wallet balance isn't reduced on payout
  (wallet credits on delivery are a separate, older ledger); bank account verification (penny drop); configurable cycle length.

## 12. Replacements — notes (and Returns)
- **Returns was broken too** (not in the original 17): the page expected a paged list, summary, detail, receive and
  release-refund; the backend had a plain list, approve and reject. Rebuilt to the page:
  requested → approve (refund to authorise, up to what was paid; pickup scheduled) → receive (condition) → release
  refund (pending refund on an online payment — COD settled off-platform — plus the credit note). Reject needs a
  reason; the customer can dispute a rejection (`POST /api/orders/:id/returns/:returnId/dispute`) and it's decided again.
  ⚠ Behaviour change: the refund and credit note are now raised at **release**, not at approval.
- **One return per order** (gap reported by gloaro-mart-51): a new request is refused while any return on the order is
  open or done; only rejected/withdrawn ones don't count. `return_eligibility` on order detail says the same. A
  replacement order can't be returned.
- The customer picks `resolution: 'refund' | 'replacement'` when asking. Approving a replacement-return raises a
  replacement (RPL-YYYY-NNNNN) for every line of the order.
- **Replacements**: approve checks stock at the shop set to fulfil (sum over variants); short → awaiting stock with the
  reason. Alternates = other shops with every line in stock (same match key), nearest first; "Fulfil here" moves it at
  that shop's prices and records the price difference (the platform's cost). Approving creates a **₹0 order** in the same
  checkout group with the stock held and sold, notifies customer and shop. After that the status follows the order
  (order created → shipped → delivered, cancelled → failed). Cancel (reason) switches the return to a full refund.
- Replacement orders: no tax invoice (not a new sale), no wallet credit, no commission or TCS; a different shop
  fulfilling is paid `platform_paid_cents` (its price) through settlements, the original shop nothing. They're skipped by
  the accept-window sweep and can't be rejected into a paid re-route.
- Verified: 46 API checks on a throwaway DB copy (dropped). Found and fixed on the way: delivering a ₹0 order failed the
  wallet credit (amount must be > 0).
- Not done: return photos/evidence (always empty), courier pickup booking, partial returns of some lines (returns are
  whole-order), charging the original shop back for a defective item.

## 13. Business Accounts — notes
- Registered from the app (`POST /api/business/accounts`): legal name + GSTIN (format, state code and mod-36 check
  digit checked; PAN and state taken from it), optional first address. The registrant is the owner. One business per
  person, one account per GSTIN. Pending until an admin verifies (documents pending at that point are approved with it);
  refuse/suspend need a reason and notify the owners; a refused account the owner corrects goes back to pending.
- Team: owners add existing customer logins by email as owner / approver / buyer, with an optional per-order limit;
  there's always at least one owner. Buyers see only themselves and no statement.
- **Checkout**: `businessAccountId` orders for the business (must be a member of a verified account); the member's
  per-order limit applies to the purchase total. `paymentMethod: 'credit'` (new provider, like COD: no gateway, stock
  committed at once, payment 'pending') needs a credit limit, room for the order, and nothing overdue. Credit drawn =
  the business's credit orders not cancelled − payments recorded; overdue = credit orders older than the terms not yet
  covered (oldest first). Admins record payments received (reference, can't exceed what's owed) — added to the page.
- **Invoices** of business orders carry the business's legal name, GSTIN (a default branch address's own GSTIN when it
  has one) and billing address → they are B2B invoices now, and the export's B2B rows fill in.
- The vendor still gets paid through settlements as usual; the platform carries the credit risk.
- Verified: 39 API checks on a throwaway DB copy (dropped) — GSTIN checks, register/duplicates, verify, team + limits,
  credit checkout, limits, overdue block, payment, B2B invoice, statement, suspend/reinstate.
- Not done: GSTIN lookup against the GST portal (format + checksum only), order approval flow for approvers (the role
  exists; buyers over their limit are simply refused), interest/late fees, credit notes reducing credit owed.

## 14. RFQ Management — notes
- A member of a **verified** business raises an RFQ in the app: title, notes, 1–50 lines (a catalogue product, or a
  described item with spec), quantity + unit, optional target price, delivery address (a business address, default
  if none given), wanted-by date, quotes close in 1 h–30 days (default 3 days). It opens at once; shops can be invited
  with it. Reference RFQ-YYYY-NNNNN.
- Shops are **invited, not matched**. Admin "worth inviting": shops selling the same catalogue item (match key), or with
  a product sharing a word with a described line; ranked by lines covered then rating; already-invited left out.
  (Distance is null — business addresses have no coordinates.) Invited shops get a notification (deep link
  `/vendor/rfqs/<id>`); opening it marks them "viewed"; they can decline with a reason.
- **Quotations** (vendor portal): every line answered — priced (unit price + GST %) or unavailable with a note; at
  least one priced; delivery charge, valid until, delivery days, payment terms. Re-submitting makes a new **revision**
  under the same QT reference and marks the previous one "revised"; one live quote per shop. Buyer notified each time.
- The RFQ takes quotes until its closing time; then **closed** if anyone quoted, **expired** if not (applied on every
  read). Admin can close early to compare (needs ≥1 quote). Cancel (admin or buyer, reason) withdraws the live quotes
  and tells everyone. The buyer sees the live quotes, cheapest first.
- Business accounts' RFQ count now counts these.
- Verified: 34 API checks on a throwaway DB copy (dropped).
- Next (#15 Quotations): admin review, revision requests, messages, accepting one (awards the RFQ) → #16 purchase order.

## 15. Quotations — notes
- The admin page lists quotes with how far each is above the cheapest live one on the same RFQ, coverage (lines it
  can't supply) and terms; "All" hides superseded revisions. Detail: rival quotes, lines against the buyer's targets,
  and the negotiation thread (messages carry across revisions — the thread is per shop per RFQ).
- **Ask for a revision** (admin or buyer, message required): the shop re-quotes as a new revision. That works even
  once the RFQ is closed for comparison — closed only stops *unasked* quotes. **Reject** (reason): the shop is told
  and can't quote that RFQ again. Messages from admin/buyer notify the shop and vice versa.
- **Award** (admin, or an owner/approver in the app — buyers can't): only a submitted quote within its validity; it's
  accepted, every other open quote on the RFQ is rejected ("another quote was awarded"), the RFQ is awarded, and a
  **purchase order** is raised (PO-YYYY-NNNNN) from the priced lines at the quoted prices, delivery charge, payment
  terms and expected delivery (today + quoted delivery days). Winner and losers notified; winner's link
  `/vendor/purchase-orders/<id>`.
- Quotes past "valid until" become expired on every read (and stay expired even when an award is refused for it —
  found and fixed in testing). Vendors can withdraw an undecided quote.
- "Against target": on accepted quotes, (target − quoted) / target over the priced lines that had a target.
- Buyer decisions are audited too (found missing in testing).
- Verified: 31 API checks on a throwaway DB copy (dropped); the 34 RFQ checks re-run after the shared quote rules changed.

## 16. Purchase Orders — notes
- Lifecycle: issued → acknowledged (vendor) → in progress (vendor, optional) → partially delivered → delivered →
  closed. Cancelled from any open state. A delivery recorded on an unacknowledged PO acknowledges it.
- **Deliveries** (vendor): which lines and how many; never more than what's left on a line. Each delivery is invoiced
  at its value — delivered quantities × PO unit price + their GST. The delivery that completes the PO carries the
  remainder, so the delivery charge and rounding land there and a fully delivered PO is invoiced at exactly its total.
  Tracking number, note and a past delivery date are optional.
- **Payments** are confirmed by the vendor (the payee): never more than invoiced − paid. Payment is due the PO's
  terms' days after the latest delivery. The vendor can record its own invoice number. There's no platform money
  movement here — B2B PO payments are off-platform (bank, UPI, cheque) and recorded.
- **Resend** (admin): only an unacknowledged PO, at most once every 15 minutes. **Cancel** (admin or an owner/approver,
  reason required): whatever was delivered stays invoiced and payable, and payments can still be recorded.
  **Close** (admin or an owner/approver): only once everything is delivered and everything invoiced is paid.
- Page fix: a fully delivered PO is no longer "open", so the Close button never showed — it now shows for
  `delivered` too.
- Fulfilment % is by value (each line's total weighted by the share delivered). The "In progress" filter covers
  acknowledged, in progress and partially delivered. "Delivered, unpaid" = invoiced − paid across all POs, cancelled ones included.
- Verified: 55 API checks on a throwaway DB copy (dropped).

## 17. Analytics — notes
- One call, `GET /api/admin/analytics?days=N` (1–365; the page asks 7/30/90), every number over the same window:
  today and the N−1 days before it, in IST. Deltas compare with the N days before that (null with no history).
- **What counts as a sale**: an order not cancelled, not a free replacement, and either COD/credit or paid online
  (an unpaid UPI/card checkout doesn't count until the payment succeeds). GMV is the order total as placed —
  later returns are not taken off. **Orders** = purchases (one checkout, however many shops it split into);
  "Top shops" counts each shop's own orders.
- **Channels**: B2B = placed for a business account; Near Me = the app sent `origin: 'near_me'` at checkout (new
  column `orders.origin`); everything else is Shop. Orders from before this, or from an app that doesn't send it, are Shop.
  Purchase orders from RFQs are not in GMV — they're off-platform money (see #16).
- **Customers**: repeat rate = customers with 2+ purchases in the window ÷ customers in it; returning = had bought
  before the window, new = first purchase inside it. **Where customers are**: the delivery city (case-merged); a
  pickup or legacy free-text address uses the shop's city.
- **Conversion and funnel** need app sessions, so there's a new `analytics_events` table. The app posts batches to
  `POST /api/analytics/events` (signed in or not, ≤50 per request, 120 requests/min per address); checkout records
  `order_placed` itself for the session in `X-Session-Id`. A session counts at a step if it reached that step or any
  later one, so the funnel never widens. Conversion = sessions that ordered ÷ sessions. Until the app sends events,
  conversion shows "—" and the funnel says there's no data.
- Verified: 28 API checks on a throwaway DB copy (dropped).

## 18. Added by the app session (gloaro-mart-8b, 2026-10-18) — customer wallet at checkout, return photos
These backend changes were made from the app side (uncommitted in this repo) so the app's requests could ship;
please review and keep them.
- **Pay from the customer wallet.** `paymentMethod: 'wallet'` on `POST /api/orders/checkout` now means the
  customer's Gloaro wallet (`customer_wallets`), not a gateway wallet: new provider `src/services/payments/wallet.js`
  (`providerForMethod('wallet')`). Inside the checkout transaction the total is debited (`UPDATE … WHERE balance_cents
  >= total` → **402** "Not enough money in your wallet…" rolls the checkout back), a `debit` ledger row is written,
  the payment is set `successful` with `amount_captured_cents`, a `captured` payment event is recorded, and the order
  commits like COD (stock confirmed, shops notified, `requiresPayment: false`).
- **Refunds on wallet payments** go back to the wallet: the provider has `settleRefund(client, { payment, refund })`,
  called by `createRefund` and `approveRefund` in `payment.controller.js` right after `provider.createRefund`, inside
  the same transaction (credit row "Refund for order #N — reason"). Cancellations and returns raise refunds as before;
  approving them is what credits the wallet.
- **Return photos.** `order_returns.photos JSONB NOT NULL DEFAULT '[]'` (`scripts/migrate-return-photos.js`, applied
  to the live DB on 2026-10-18; also in `schema.sql`). `POST /api/orders/returns/photos` (customer, multipart `file`,
  JPG/PNG/WebP ≤ 5 MB, `uploadTo('returns')` → `media_files`) returns `{ path }`. `POST /api/orders/:id/returns` now
  **requires** `photos` (1–5 paths under `/uploads/returns/`) and a `comment` of at least 10 characters (400 otherwise);
  `GET /api/orders/:id/returns` includes `photos`; the admin list's `evidenceCount` and the detail's `evidence`
  (`{ id, url: path, kind: 'image', caption: null, uploadedAt }`) are filled from them. The Returns page renders
  `e.url` as-is — prefix the API base for `/uploads/...` paths if images don't show.
- Not done: wallet top-ups still need a gateway (`POST /api/wallet/topup` opens a pending row that only a verified
  webhook credits); an admin "confirm top-up" action would let staff credit a bank transfer meanwhile.
