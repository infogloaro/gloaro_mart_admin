# WhatsApp (Meta Cloud API) — plan

Drafted 2026-10-14. WhatsApp is the first channel in the admin's **Channels** settings. Every other channel
(SMS, push, email providers, social login, KYC APIs, payouts…) is listed there as **Coming soon** until it is built.

What exists today: a `whatsapp_cloud` connector (`Gloaro_mart_backend/src/connectors/whatsappCloud.js`) that tests
the credentials against Meta, answers Meta's webhook handshake and checks the webhook signature. **Nothing sends a
message yet.**

---

## 1. What you need to get from Meta

Do these in order. Steps 1–4 can take a few days, because Meta reviews them.

| # | What | Where | What to give us |
|---|---|---|---|
| 1 | **Meta Business Portfolio**, verified. The legal name must match the GST certificate. Upload the GST certificate or incorporation certificate. The website domain should show the same business name. | business.facebook.com → Settings → Business info → Security centre → Start verification | — (the verified business) |
| 2 | **Meta developer app**, type *Business*, with the **WhatsApp** product added | developers.facebook.com → My apps → Create app | App ID, **App secret** (App settings → Basic) |
| 3 | **WhatsApp Business Account (WABA)**, created when you add WhatsApp to the app | App → WhatsApp → API Setup | **WABA ID** |
| 4 | **A dedicated phone number**: not used on the WhatsApp or WhatsApp Business app (or deleted from it first), and able to receive an SMS or voice OTP. Display name **"Gloaro Mart"**, which Meta approves. | API Setup → Add phone number | **Phone number ID**, the number itself |
| 5 | **Permanent access token**: Business Settings → Users → **System users** → add one (Admin) → assign the app and the WABA (full control) → Generate token with `whatsapp_business_messaging` + `whatsapp_business_management`, expiry **Never** | business.facebook.com → Settings → System users | **Access token** (the temporary 24-hour token from API Setup is for testing only) |
| 6 | **Payment method** on the WABA. Meta charges per message: utility, authentication and marketing rates in INR; replies within 24 hours of a customer message are free. | Business Settings → WhatsApp accounts → Payment settings | — |
| 7 | **Privacy policy + terms** pages on the public website. Needed to switch the app to **Live** mode. | App settings → Basic | URLs |
| 8 | **App mode: Live** | App dashboard top bar | — |
| 9 | **Webhook**: Callback URL `https://<public backend domain>/api/webhooks/platforms/whatsapp_cloud`, Verify token = the phrase we set in the admin. Subscribe to **messages** and **message_template_status_update**. | App → WhatsApp → Configuration | — (we give you the URL + token) |

**Send to us** (paste them into Admin → Channels → WhatsApp; never by chat or email):
Phone number ID · WABA ID · App ID · App secret · Permanent access token.

**One thing only you can decide:** the **public backend URL**. Meta can't reach `localhost:4000`, so step 9 needs
the deployed server (HTTPS). Sending works from local; receiving delivery receipts and customer replies needs the
public URL.

**Templates:** Meta must approve every message we send first. We'll create them from the admin through the API
(that's why the token needs `whatsapp_business_management`), so you don't have to type them into Meta. Approval
usually takes minutes to a day.

---

## 2. Where WhatsApp is used

Utility messages only at first (order and account updates). Marketing broadcasts come later; they need a separate
opt-in and cost more.

**Customers**
| Event | Template (variables) | Button |
|---|---|---|
| Order placed | `order_placed` (name, order ref, total, shop count) | View order |
| Order confirmed by the shop | `order_confirmed` (order ref, shop, ETA) | Track |
| Out for delivery | `order_out_for_delivery` (order ref, partner name, partner phone) | Track |
| Delivered | `order_delivered` (order ref) + review request | Rate |
| Cancelled / refund started | `order_cancelled` (order ref, refund amount, days) | View |
| Refund completed | `refund_completed` (amount, method) | — |
| Return pickup scheduled | `return_pickup` (order ref, date) | View |
| Online payment pending | `payment_pending` (order ref, amount) | Pay now |
| Invoice ready | `invoice_ready` (invoice no.) | Download |

**Shops (vendors)**
| Event | Template |
|---|---|
| New order (accept within the window) | `vendor_new_order` (order ref, items, accept-by time) |
| Re-routed order offered | `vendor_reroute_offer` |
| Invited to an RFQ | `vendor_rfq_invite` (RFQ ref, closes at) |
| Quotation awarded / PO issued | `vendor_po_issued` (PO no., value) |
| Settlement paid | `vendor_settlement_paid` (amount, UTR) |
| KYC approved / rejected | `vendor_kyc_status` |

**Business buyers:** quote received, PO delivered, credit payment due or overdue.
**Delivery partners:** shipment assigned, COD to hand over.
**Admin alerts** (optional): failed payments, disputes, SLA breaches, to an admin group number.

**Incoming messages:** a customer's reply opens or joins a **support ticket**, so the support team answers it from the
admin. A reply sent within 24 hours is free-form; after that, only a template. **STOP** opts the number out.

**Not WhatsApp (yet):** login OTP stays email or password until SMS is built. WhatsApp authentication templates
can do OTP later if wanted.

---

## 3. What we build

**Backend**
- `services/whatsapp.js`: send a template or a free-form reply; normalises numbers to +91 E.164.
- `whatsapp_messages` table: every outbound and inbound message with Meta's id and status
  (queued → sent → delivered → read / failed and its error).
  - Sending runs from a queue with retries, so a Meta outage never fails an order.
- **Event → template rules** (`whatsapp_event_rules`): per event, on/off, which template, who gets it, and how
  notification data fills the variables.
  - Hooked where notifications are already written, so each event needs one line, not a rewrite.
- **Templates**: create, sync status from Meta, and see approved / rejected / paused.
- **Webhook**: delivery and read receipts update the log; inbound messages go to support tickets; STOP / START
  handles opt-out.
- **Opt-in**: `users.whatsapp_opt_in` + the time it was given. Meta requires consent, and nothing is sent without it.

**Admin panel**
- **Settings → Channels**: WhatsApp card (connect, test, live/test, status), every other channel shown as
  *Coming soon*.
- **WhatsApp → Templates**: list, create, sync, status.
- **WhatsApp → Rules**: event on/off, template, recipients, preview.
- **WhatsApp → Messages**: log with filters, the failure reason, and a resend button.
- **Test send** to a number.

**App (G_mart)**
- WhatsApp opt-in: a checkbox at signup or checkout, and a switch in Profile → Notifications.
- Phone number required, and shown, for WhatsApp updates.

**Order of work**
1. Channels page (WhatsApp + Coming soon)
2. Send service + log + test send
3. Templates
4. Rules wired into events
5. Webhook (receipts, inbound → support, STOP)
6. App opt-in

Steps 1–3 can be built and tested with Meta's test number before your own number is approved.

### Progress

**Steps 1–3 done (2026-10-14)**
- What was built:
  - **Admin → System & Administration → Channels** (`src/routes/ChannelsPage.tsx`): a WhatsApp card (set up, Configure, setup checklist, counts, test send) and all 26 channels grouped, showing Available / Built in / Coming soon.
  - **Templates tab:** the 17 drafts from §2, plus an editor with a live phone preview; submit, resubmit, sync and delete.
  - **Messages tab:** log, filters, search and "send again".
- Backend:
  - `services/whatsapp.js`: platform set-up, number normalising, queue with retries (1 / 5 / 30 min, then failed; Meta rate limits and temporary errors are retried, everything else fails at once with Meta's reason).
  - `services/whatsappTemplates.js`: Meta's template rules checked before submitting; sync follows paging and imports templates made in Meta's own tools.
  - `controllers/whatsapp.controller.js`; schema WHATSAPP (PHASE 49); `npm run migrate:whatsapp` (also seeds the drafts).
  - `server.js` sends the queue every 15 s (`WHATSAPP_SWEEP_SECONDS`, 0 = off).
  - Permission module `channels`.
- Connector:
  - `whatsappCloud` gained the **WhatsApp Business Account ID** setting.
  - Its connection test now checks that id too.
  - `WHATSAPP_GRAPH_URL` overrides Meta's address (tests only).
- Sending needs the connection test to have passed for the environment in use. Changing a credential voids the test, so sending stops until it passes again.
- Verified: 61 API checks against a stand-in for Meta's Graph API, on a throwaway DB copy (dropped). The real Meta API hasn't been called yet; that needs your credentials.

**Bot ordering access done (2026-10-14)**, see §4: bot keys, sessions by WhatsApp number, STOP/START, and receipts.
Verified with 40 API checks on a throwaway DB copy.

**Step 4 done (2026-10-14): automatic order updates**, see §5. Verified with 29 API checks: real orders moved through
their statuses against a stand-in for Meta. The bot (40) and template / test-send (11) checks were re-run after it.

**Next:** the rest of step 5 (replies → support tickets) and step 6 (app opt-in: until it exists, only WhatsApp-bot
customers, who opt in by messaging, get updates).

---

## 5. Automatic order updates (step 4) — how it works

- **Code:**
  - `services/whatsappEvents.js`
  - Admin → Channels → **Order updates** tab (on/off per event, template, preview, why it isn't sending, 7-day counts)
  - schema WHATSAPP ORDER UPDATES (PHASE 51)
- **Who and where:** the customer, on **the WhatsApp number they ordered from**. The bot session links that number to
  their account; otherwise their account's phone is used. Sent only if they've opted in. Messaging the bot counts as
  opting in, and STOP stops it. Sent from the business number (+91 72005 37071).
- **How events are found:** the WhatsApp sweep (every 15 s) reads recent order status history, completed refunds,
  return pickups, issued invoices and new purchases. No order code had to change, every way an order moves is caught,
  and only committed changes are seen.
- **Safeguards:**
  - Each event is sent at most once (dedupe key).
  - An event counts only if it happened after its rule was switched on, and at most **6 hours** ago, so switching a
    rule on never messages old orders, and a late "out for delivery" is never sent.
  - Nothing is sent while WhatsApp isn't connected or the platform isn't Active. Events wait, within the 6 hours.
  - A rule can be switched on only with a Meta-approved template that has exactly the values the event fills.
  - The Rules tab says why a rule is waiting.
- **Skipped:** if the customer wrote STOP or has no number, the message is logged as *skipped* with the reason. An app
  customer who has never been on WhatsApp with us is left out quietly rather than logged on every order.

| Event | On at start | Template | Values |
|---|---|---|---|
| Order placed (app orders only; the bot confirms its own in chat) | ✅ | order_placed | first name, reference, purchase total |
| Shop confirmed | ✅ | order_confirmed | reference, shop, expected delivery |
| Out for delivery | ✅ | order_out_for_delivery | reference, partner name, partner phone |
| Delivered | ✅ | order_delivered | reference |
| Cancelled, paid online | ✅ | order_cancelled | reference, refund amount, days |
| Cancelled, COD / credit | ✅ | order_cancelled_cod | reference, shop |
| Refund completed | ✅ | refund_completed | amount, reference, where it went |
| Return pickup scheduled | off | return_pickup | reference, pickup date |
| Invoice ready | off | invoice_ready | invoice number, reference |

- **Split purchases:** "placed" is sent once per purchase; the rest are sent per shop.
- **Business number check:** the connector's new *Business WhatsApp number* setting makes the connection test fail if
  the phone number ID belongs to another number.

---

## 4. Ordering through the Gloaro WhatsApp bot — contract for the bot

The business number is already on Meta's Cloud API through the Gloaro bot (`D:\gloaro-bot`).
**The bot owns the webhook and the conversation; Gloaro Mart owns products, carts, orders and order updates.**
Both use the same number. Enter the same phone number ID, WABA ID, access token and app secret in Admin → Channels →
WhatsApp. Sending isn't exclusive, so both can send.

Use the Cloud API number only, never a whatsapp-web.js session. Meta can ban numbers used through unofficial tools, and
template messages need the Cloud API.

### Flow
1. A customer messages the number. Meta calls the bot's webhook (`POST /webhooks/whatsapp`).
2. The bot calls `POST {MART}/api/bot/session` with the sender's `wa_id` and profile name, and receives a customer token.
3. The bot runs the menu and calls Gloaro Mart's **app APIs** with that token, the same calls the G_mart app makes:
   location → products → cart → address → checkout.
4. The order confirmation is the bot's own free-form reply. The customer is inside the 24-hour window, so it needs no
   template and costs nothing.
5. Later updates (confirmed, out for delivery, delivered, refund) are sent by Gloaro Mart as templates (step 4).
6. Delivery and read receipts for Gloaro Mart's messages reach the bot's webhook. The bot forwards them (see below).

### Auth
- Header **`X-Bot-Key: gmb_…`** on every `/api/bot/*` call.
  - Created in Admin → Channels → Bot access.
  - Shown once; stored only as a hash; revocable there.
  - Keep it in the bot's server env as `GLOARO_MART_BOT_KEY`.
- The session token is a normal customer login (Bearer), valid for **60 minutes**. Open a new session when it expires,
  or simply once per conversation.

### Endpoints only the bot uses
| Call | Body | Answer |
|---|---|---|
| `POST /api/bot/session` | `{ phone: wa_id, name?: profile name }` | `{ token, expiresAt, salesChannel: 'whatsapp_bot', customer: { id, name, phone, isNew, whatsappOptIn } }` |
| `POST /api/bot/opt-out` | `{ phone }` — the customer wrote **STOP** | `{ customerId, whatsappOptIn: false }` |
| `POST /api/bot/opt-in` | `{ phone }` — the customer wrote **START** | `{ customerId, whatsappOptIn: true }` |

How a number becomes an account:
1. The account already linked to that WhatsApp number is used.
2. Otherwise, an app customer with the same phone (typed any way) is used and linked. If two accounts share it, the more recently active one is chosen.
3. Otherwise, a new customer account is created.

Vendor and staff accounts are never used. Writing to the number counts as opting in to order updates, unless the
customer wrote STOP; only START undoes that. 401 means the key is missing or revoked; 400 means a bad number.

### App APIs the bot then calls (with `Authorization: Bearer <token>`)
| Step | Call |
|---|---|
| Categories | `GET /api/categories` (public) |
| Products near the customer | `GET /api/products/search?lat=&lng=&q=&category=&radiusKm=&inStock=true&page=&pageSize=` (public) |
| Product (variants, tiers) | `GET /api/products/:id`, `GET /api/products/:id/tiers` |
| Cart | `GET /api/cart` · `POST /api/cart/items { productId, quantity, variantId? }` · `PATCH /api/cart/items/:productId { quantity }` · `DELETE /api/cart/items/:productId` |
| Saved addresses | `GET /api/addresses` |
| New address | `POST /api/addresses { receiverName, mobileNumber, houseBuilding, street?, area?, landmark?, city, state, pincode, latitude?, longitude?, addressType? }` |
| Can it be delivered? | `POST /api/serviceability/check { addressId, items: [{ productId, quantity }] }` |
| Place the order | `POST /api/orders/checkout { addressId, paymentMethod: 'cod' }`, headers **`X-Sales-Channel: whatsapp_bot`** and **`X-Session-Id: <one id per chat>`** |
| My orders / status | `GET /api/orders/groups` · `GET /api/orders/groups/:id` · `GET /api/orders/:id/shipments` |
| Cancel | `POST /api/orders/:id/cancel { reason }` |

Notes for the bot:
- **Location pin:** a WhatsApp location gives latitude and longitude, but not the house, city, state or pincode. Ask
  for those in one message, the way lead capture already does. Default the receiver name to the WhatsApp profile name
  and the mobile number to the sender's number.
- **Errors:** errors come back as `{ message }`, written for people (out of stock, below MOQ, can't deliver there).
  Show them to the customer as they are.
- **Interactive messages:** use list messages for products, reply buttons for Checkout / Add more, and a location
  request for the pin. The bot sends only text today, so these need to be added.
- **Payment:** cash on delivery only for now. A pay-now link comes with the payment gateway.

### Forwarding receipts
For webhook `statuses` whose message id the bot didn't send, re-POST the **exact raw body** with its original
**`X-Hub-Signature-256`** header to `POST {MART}/api/webhooks/platforms/whatsapp_cloud`.
- Gloaro Mart checks the signature with the same app secret.
- Statuses only move forward (sent → delivered → read).
- Ids Gloaro Mart didn't send are ignored, so forwarding all statuses is also fine.
- The WhatsApp platform must be **Active** in Channels → Configure.

**Defaults to confirm:**
- Utility templates only.
- English first; Tamil versions of the templates can follow.
- Customers must opt in.
- Shops and delivery partners are opted in by their agreement when they register.
