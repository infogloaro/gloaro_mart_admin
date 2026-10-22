# Super Admin: Dynamic Platform Registry — phased plan

Status: **All 7 phases done (2026-10-14).** Remaining gaps are listed under each phase. The user asked
to build the phases one by one. The user is explaining the
super admin concept one part at a time; this is part 1. Build only after they
confirm, and fold later parts into these phases instead of starting new plans.

## Goal

Super Admin manages every e-commerce capability from **Settings → Platform
Registry** instead of hardcoded pages: add categories, add platforms/providers,
configure, test, activate/deactivate, and choose which admin roles can see or
manage each one. All of it is enforced on the backend.

**Non-negotiable rule:** adding a registry entry never means "connected".
A platform is only *Connected* when a real connector (code in the adapter
layer) has authenticated and passed a test. Everything else is *Manual* or
*Not connected*, and the UI must say so.

## Default categories (seeded, editable, more can be added)

| Slug | Name | Covers |
| --- | --- | --- |
| integrations | Integrations | Payment gateways, shipping APIs, ERP, CRM, WhatsApp, email, analytics |
| sales_channels | Sales Channels | Website, mobile app, marketplaces, social commerce, POS |
| campaigns | Campaigns & Promotions | Discounts, coupons, flash sales, loyalty, referrals |
| marketplaces | Marketplace Platforms | Multi-vendor connections, external storefronts, product sync |
| fulfilment | Delivery & Fulfillment | Delivery partners, shipping, warehouses, tracking |
| finance | Payments & Finance | Payment providers, settlements, commissions, billing, reconciliation |
| engagement | Customer Engagement | WhatsApp, SMS, email, push, loyalty |
| catalog_services | Product & Catalog Services | Product feeds, catalog sync, inventory connections, pricing |
| analytics | Analytics & Tracking | Analytics, conversion tracking, attribution, reporting |
| custom | Custom Platforms | Anything new the business needs |

## What already exists (build on it, don't duplicate)

- **RBAC:** `Gloaro_mart_backend/src/services/permissions.js` defines modules
  in code; roles and grants live in `staff_roles` / `staff_role_permissions`.
  The `super_admin` slug bypasses checks. `requirePermission` maps the first
  `/api/admin/<segment>` to a module and fails closed on unmapped paths.
- **Audit logs:** `/api/admin/audit-logs` and the Admin Logs page.
- **Feature flags:** `/api/admin/feature-flags`, public `/api/feature-flags/enabled`.
- **Settings:** `platform_settings` table and Settings page (now with image upload).
- **Half-built admin pages** that call missing endpoints today: Campaigns,
  Home Sections, Delivery Partners, Settlements, Shipments, Invoices. The registry
  should become their backbone rather than each getting a one-off table.
- **Hosting:** backend runs on a normal server (user's choice), so background
  sync jobs and webhooks are possible; not Vercel serverless.

## Phases

### Phase 1 — Categories + Platform Registry (no credentials yet)
- Tables:
  - `platform_categories` (id, slug, name, description, icon, sort_order, is_system, is_active)
  - `platforms` (id, category_id, slug, name, description, logo_url, integration_method `api|webhook|connector|manual`, connector_key nullable, status `draft|inactive|active`, capabilities jsonb, created_by, timestamps)
- Seed the 10 default categories (`is_system = true`: renamable, not deletable).
- API, super admin only at first: `/api/admin/platform-categories`, `/api/admin/platforms` (CRUD + enable/disable).
- Every create, change, enable or disable writes an audit log row.
- Admin UI: Settings → Platform Registry: category filter tabs, cards with status and an Enable/Disable action, Add New (name, category, description, logo via the existing ImageUpload, method).
- Done when: Super Admin can add "Marketing Platforms" → "Google Ads" and toggle it, and the change shows in Admin Logs.
- **Built:** `schema.sql` section PLATFORM REGISTRY (PHASE 27) + `npm run migrate:platform-registry`;
  `src/controllers/platformRegistry.controller.js` (routes in `admin.routes.js`, unmapped in
  ROUTE_MODULES so non-super-admins get 403); audit actions `platform_category.*`,
  `platform.created|updated|activated|deactivated|deleted` under module `system`; logo uploads go to
  `uploads/platforms/`. Admin: `src/routes/PlatformRegistryPage.tsx`, sidebar item under System &
  Administration gated by `SUPER_ADMIN_ONLY` in `lib/navigation.ts`. The API returns `connected: false`
  for everything (`AVAILABLE_CONNECTORS` is empty until Phase 4).

### Phase 2 — Configuration schema + provider connections
- `platforms.config_schema` (JSON-schema-like list of fields: key, label, type, required, secret) drives a generated form, so new providers need no UI redesign.
- `platform_connections` (platform_id, environment `test|live`, config jsonb, secrets encrypted, status `not_connected|connected|error`, last_tested_at, last_error).
- Secrets: AES-256-GCM with a key from `.env` (`PLATFORM_SECRETS_KEY`). They are never returned to the browser, which only sees "•••• set".
- **Test connection** only for platforms with a `connector_key`. Manual platforms show "Managed manually", never "Connected".
- Done when: a provider's credentials can be saved, are masked on reload, and are stored encrypted in the database.
- **Built:** schema section PLATFORM CONNECTIONS (PHASE 28) + `npm run migrate:platform-connections`
  (`platforms.config_schema`, `platforms.environment`, `platform_connections` with `secrets_encrypted`
  and `secret_keys`). `src/services/secretBox.js` (AES-256-GCM, `PLATFORM_SECRETS_KEY`, documented in
  `.env.example`; a key was generated into the local `.env`). `src/connectors/index.js` is the registry
  of real connectors (empty). `src/controllers/platformConnection.controller.js`:
  `PUT /platforms/:id/settings-form`, `GET /platforms/:id/connections`,
  `PUT /platforms/:id/connections/:env` (values plain, secrets write-only; any change resets status to
  not_connected), `POST /platforms/:id/connections/:env/test` (409 until a connector exists). Audit:
  `platform.settings_form_changed`, `platform.settings_saved` (secret names only, never values),
  `platform.environment_changed`. List adds `setup_complete` and `connection_status`; `connected`
  requires a registered connector and a passed test on the environment in use. Admin:
  `src/components/platform/PlatformConfigModal.tsx` (Settings tab per Test/Live, Form fields editor
  with quick-add presets), Configure button and Test/Live + Setup incomplete badges on cards.
- Deploying elsewhere: set `PLATFORM_SECRETS_KEY` on that server first; without it secrets can't be
  saved (503), and changing it later makes saved secrets unreadable.

### Phase 3 — Dynamic permissions per category / platform
- Extend the permission catalogue so registry items generate keys at runtime: `platforms.<category>.view|edit|delete`, plus optional per-platform keys.
- `permissions.js` merges code modules with DB-driven ones; the Admin Staff role grid shows them automatically.
- Enforcement: `requirePermission` resolves `/api/admin/platforms/:id` to that platform's category permission (still fail-closed).
- Admin sidebar shows only the categories and platforms a role may view.
- Done when: a "Channel Manager" role sees and edits Sales Channels only, and is refused (403) everywhere else, server-side.
- **Built:** keys are `platform_<category slug>.view|edit|delete` (per category; per-platform keys not
  added). `permissions.js`: `loadCatalogue(db)` = code modules + one module per category (group
  "Platform Registry"); `expand()` now applies "edit/delete imply view" by key shape.
  `staff.controller.js` uses the catalogue for `/me`, `/permissions` and role validation, so the Admin
  Staff role grid shows new categories automatically. `src/middleware/platformAccess.js` is called by
  `requirePermission` for the `platforms` and `platform-categories` segments (fails closed): it resolves the
  category from the platform id or `categoryId` (create, and move = edit on both). Lists are filtered to
  viewable categories. Category create/rename/hide/delete stays super admin only. Deleting a category
  removes its grants from roles. Admin: `canView` supports `platform_*.view` wildcards (sidebar item),
  page buttons gated per category, "View only" for read-only roles.

### Phase 4 — Integration adapter layer + first real connectors
- `src/connectors/<key>/` with one standard interface: `testConnection`, `handleWebhook`, `sync(kind)`, `capabilities`.
- Webhook endpoint `/api/webhooks/:platformSlug` with signature check per connector; retries with backoff; a `platform_sync_logs` table (run, kind, counts, errors).
- First connectors to agree with the user, e.g. one payment gateway (Razorpay), one shipping provider (Shiprocket) and one WhatsApp provider.
- Done when: one connector passes Test connection with real sandbox credentials and its webhook events are logged.
- **Built:** connectors `razorpay`, `shiprocket`, `whatsapp_cloud` in `src/connectors/` (picked by me,
  user said "next" without choosing), shared `http.js` (timeout, retries with backoff on network/429/5xx,
  constant-time signature checks). Schema PLATFORM CONNECTORS (PHASE 29) + `npm run migrate:platform-connectors`
  (`platform_sync_logs`). Public receiver `GET|POST /api/webhooks/platforms/:slug` (only active platforms with
  a connector; signature verified against the in-use environment's secrets; rejected attempts logged).
  Admin API: `GET /platform-connectors`, `GET /platforms/:id/logs`; create/update accept `connectorKey`
  (applies the connector's settings form; create is one transaction). Admin UI: Connector picker in
  Add/Edit platform, webhook URL + copy, Activity tab, "Test failed" badge.
- **Not yet verified against real accounts:** no real credentials were available, so only the failure paths
  were exercised against the live provider APIs; success paths were tested with stubbed HTTP.
- **Not done:** webhooks are recorded, not acted on (no order marked paid, no tracking update), and checkout
  still uses `src/services/payments` (manual/COD), not Razorpay. Providers can't reach a localhost webhook URL.

### Phase 5 — Approval workflows (optional per action)
- `approval_rules` (action e.g. `platform.activate`, `connection.set_live_secrets`, `role.change_permissions`; requires approval true/false; approver role).
- `approval_requests` (requested_by, payload, status, decided_by, decided_at). A pending change does not apply until approved.
- Done when: enabling a sensitive integration by a non-super admin waits for an approval and the decision is audited.
- **Built:** schema APPROVAL WORKFLOWS (PHASE 30) + `npm run migrate:approvals`. Rules (seeded):
  `platform.go_live` ON, `platform.live_settings` ON, `role.permissions` OFF (so the Staff page behaves as
  before until a super admin turns it on). Gate `src/services/approvals.js#holdForApproval` is called inside
  `updatePlatform`, `saveConnection` (live only, request stored encrypted, visible copy names the settings) and
  `createRole`/`updateRole`; returns 202 `{pendingApproval, requestId, message}`; one pending request per
  action+entity (409 otherwise). Super admins always bypass and are the only approvers (approver-by-role not
  built). `src/controllers/approval.controller.js` replays the stored request through the original handler as
  the requester (`req.approvalId` skips the gate); a 4xx on replay marks it `failed` with the reason; the
  encrypted copy is deleted on any decision. Routes `/api/admin/approval-rules` (super admin only, unmapped)
  and `/api/admin/approvals` (open to staff in rbac; controller filters to own requests unless super admin).
  Admin: `src/routes/ApprovalsPage.tsx` (rules toggles, Waiting/All, approve/reject with note, withdraw),
  sidebar item for all staff, amber "Sent for approval" notices in the registry, config window and role editor.

### Phase 6 — Monitoring + dynamic management screens
- Per platform: health, last sync, orders, products and inventory synced, error list, retry button.
- Registry entries with capabilities (e.g. `orders`, `products`) appear automatically in the matching management screens (Orders filter by channel, product channel availability). No per-channel frontend work.
- Done when: a new channel added in Settings shows up in the Orders channel filter with no code change.
- **Built:** schema PLATFORM MONITORING & CHANNELS (PHASE 31) + `npm run migrate:platform-monitoring`
  (`orders.sales_channel_id`). Rule: a sales channel = any platform with the `orders` capability. Checkout reads
  the optional `X-Sales-Channel: <platform slug>` header (`resolveSalesChannel` in order.controller.js); only an
  enabled platform with the capability is recorded; anything else leaves the order unattributed and never blocks
  checkout. Admin orders list: `?channel=<id>|none`, returns `sales_channel_name/slug`; `GET /api/admin/orders/channels`
  (needs orders.view, not registry access) feeds the Orders page Channel filter and column, which appear only once a
  channel exists. `GET /api/admin/platform-health` (platformHealth.controller.js, scoped per category): verdict
  off/manual/unknown/down/degraded/healthy from the in-use environment's connection + last 24h of sync logs, orders 7d.
  Admin: Platforms | Health toggle on the registry page (`components/platform/PlatformHealthView.tsx`, Test again).
- Checkout attribution was verified with real checkouts on a throwaway copy of the database (dropped afterwards).
- **Not done:** product channel availability (which products are sold on which channel), and sync-run monitoring
  (no connector runs syncs yet). No client sends X-Sales-Channel yet — that's Phase 7 (G_mart app).

### Phase 7 — Reflect in the G_mart app
- Public read endpoint, e.g. `/api/platform/public`: active sales channels, active campaigns, enabled engagement features. It must not include secrets or config.
- The app hides or shows features from it, alongside feature flags (see memory: admin changes must reach the app).
- Done when: disabling a campaign or channel in Settings removes it from the app on next load.
- **Built:** backend `GET /api/platform/public` (`platformPublic.controller.js`, no auth, 60s cache): enabled
  `channels` (capability `orders`), `campaigns` (Campaigns category) and `capabilities`, only slug/name/description/logo.
  G_mart (committed by the gloaro-mart-ff session as e771108 / 4451c2e): `ApiClient.salesChannel`
  (`--dart-define=SALES_CHANNEL`, default `mobile_app`) + `ApiClient.defaultHeaders` sent on every request;
  `lib/core/data/platform_config.dart` (`PlatformConfig.load()`, 1 min cache); home chip strip shows enabled campaigns.
- Verified: echo server saw `X-Sales-Channel: mobile_app`; app code showed "Diwali Flash Sale", and after it was disabled
  in the admin it was gone on the next load. Public endpoint leaked no settings, secrets or disabled entries.
- **To make attribution real:** register a Sales Channels platform with slug `mobile_app`, capability `orders`, enabled.
  G_mart's checkout is still local (no POST yet); the other session noted it will send `ApiClient.defaultHeaders`.

## Open questions for the user
- Which connectors first (payment, shipping, WhatsApp, marketplace)?
- Should normal admins ever add platforms, or Super Admin only?
- Which actions need approval?
- How does this relate to the remaining super admin parts they will describe next?
