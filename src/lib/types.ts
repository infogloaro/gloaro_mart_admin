/** Shape returned by the paged admin list endpoints (users, orders, products). */
export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminUser {
  id: number;
  full_name: string;
  email: string;
  phone_number: string | null;
  role: 'customer' | 'vendor' | 'admin';
  created_at: string;
}

export interface AdminVendor {
  id: number;
  user_id: number;
  business_name: string;
  business_type: 'b2b' | 'b2c' | 'both';
  gst_number: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  /** The map pin. Nearby search skips vendors without one, so a vendor with a
   *  null latitude is invisible to every customer. */
  latitude: number | null;
  longitude: number | null;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  created_at: string;
  email: string;
  full_name: string;
}

export interface AdminProduct {
  id: number;
  vendor_id: number;
  vendor_name: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  stock_quantity: number;
  image_url: string | null;
  category: string | null;
  brand_id: number | null;
  brand_name: string | null;
  is_active: boolean;
  gst_rate_percent: number;
  moq: number;
  created_at: string;
}

export interface PriceTier {
  id: number;
  product_id: number;
  min_quantity: number;
  max_quantity: number | null;
  unit_price_cents: number;
}

export interface AdminProductDetail extends AdminProduct {
  tiers: PriceTier[];
}

export interface Category {
  id: number;
  name: string;
  icon_key: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface PlatformSettings {
  id: number;
  platform_name: string;
  tagline: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  support_email: string | null;
  support_phone: string | null;
  whatsapp_number: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gst_number: string | null;
  currency_code: string;
  invoice_prefix: string;
  instagram_url: string | null;
  facebook_url: string | null;
  youtube_url: string | null;
  maintenance_mode: boolean;
  maintenance_message: string | null;
  updated_at: string;
}

export interface Brand {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  /** Products currently pointing at this brand — a brand in use cannot be deleted. */
  product_count: number;
  created_at: string;
  updated_at: string;
}

export interface AdminOrder {
  id: number;
  user_id: number;
  vendor_id: number;
  status: 'pending' | 'confirmed' | 'packed' | 'out_for_delivery' | 'delivered' | 'cancelled';
  payment_method: string;
  subtotal_cents: number;
  gst_cents: number;
  discount_cents: number;
  total_cents: number;
  delivery_address: string;
  delivery_partner_name: string | null;
  delivery_partner_phone: string | null;
  estimated_delivery_at: string | null;
  coupon_code_snapshot: string | null;
  /** The purchase this vendor order belongs to. Every order has one — legacy
   *  rows were backfilled with a GLM-LEGACY- reference. */
  checkout_group_id: number;
  created_at: string;
  updated_at: string;
}

export interface AdminOrderListRow extends AdminOrder {
  customer_name: string;
  customer_email: string;
  vendor_name: string;
  vendor_city: string | null;
  /** Human-facing group reference, e.g. GLM-2026-00001. */
  checkout_group_reference: string | null;
  /** How many vendor orders that one checkout produced. */
  checkout_group_order_count: number;
}

/** One entry in an order's status timeline. */
export interface OrderStatusEvent {
  fromStatus: string | null;
  toStatus: string;
  actorRole: 'customer' | 'vendor' | 'admin' | 'system';
  actorName: string | null;
  note: string | null;
  createdAt: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  product_name_snapshot: string;
  unit_price_cents: number;
  quantity: number;
  gst_rate_percent_snapshot: string | number;
}

export interface AdminOrderDetail extends AdminOrderListRow {
  customer_phone: string | null;
  vendor_city: string | null;
  items: OrderItem[];
}

export interface OrderHistoryResponse {
  history: OrderStatusEvent[];
}

/** Sprint 3 — Payments & Refunds. Contracts per documents/SPRINT_3_PAYMENTS_SPEC.md */

export type PaymentStatus =
  | 'created'
  | 'pending'
  | 'processing'
  | 'successful'
  | 'failed'
  | 'cancelled'
  | 'refunded'
  | 'partially_refunded';

/** One row of the admin payments list. Money is always integer paise. */
export interface AdminPayment {
  id: number;
  checkout_group_id: number;
  group_reference: string;
  customer_name: string;
  customer_email: string;
  method: string;
  provider: string;
  status: PaymentStatus;
  amount_cents: number;
  amount_captured_cents: number;
  amount_refunded_cents: number;
  failure_reason: string | null;
  order_count: number;
  created_at: string;
}

export interface PaymentLedgerEntry {
  event: string;
  amountCents: number;
  actorRole: string;
  actorName: string | null;
  note: string | null;
  createdAt: string;
}

export interface PaymentAttempt {
  id: number;
  method: string;
  status: string;
  providerOrderId: string | null;
  failureReason: string | null;
  createdAt: string;
}

export interface PaymentRefundSummary {
  id: number;
  orderId: number | null;
  amountCents: number;
  status: string;
  reason: string | null;
  createdAt: string;
}

/** The detail endpoint answers camelCase, unlike the list. */
export interface AdminPaymentDetail {
  id: number;
  checkoutGroupId: number;
  groupReference: string;
  method: string;
  provider: string;
  status: PaymentStatus;
  amountCents: number;
  amountCapturedCents: number;
  amountRefundedCents: number;
  failureReason: string | null;
  createdAt: string;
  attempts: PaymentAttempt[];
  refunds: PaymentRefundSummary[];
  ledger: PaymentLedgerEntry[];
}

export interface AdminRefund {
  id: number;
  payment_id: number;
  order_id: number | null;
  group_reference: string;
  customer_name: string;
  method: string;
  provider: string;
  amount_cents: number;
  reason: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  provider_refund_id: string | null;
  created_at: string;
}

export type MenuLinkType = 'section' | 'category' | 'vendor' | 'url';

/** A row in the customer app's side menu, ordered by sort_order. */
export interface MenuItem {
  id: number;
  label: string;
  icon_key: string | null;
  link_type: MenuLinkType;
  link_value: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface OrgState {
  id: number;
  name: string;
  district_count: number;
  created_at: string;
}

export interface OrgDistrict {
  id: number;
  state_id: number;
  state_name: string;
  name: string;
  chapter_count: number;
  created_at: string;
}

export interface OrgChapter {
  id: number;
  district_id: number;
  district_name: string;
  state_id: number;
  state_name: string;
  name: string;
  member_count: number;
  referral_count: number;
  created_at: string;
}

export interface ChapterMember {
  user_id: number;
  full_name: string;
  email: string;
  phone_number: string | null;
  role: 'customer' | 'vendor' | 'admin';
  joined_at: string;
  vendor_id: number | null;
  business_name: string | null;
  business_type: 'b2b' | 'b2c' | 'both' | null;
  city: string | null;
  vendor_status: string | null;
}

export interface AdminReferral {
  id: number;
  chapter_id: number;
  chapter_name: string;
  referring_user_id: number;
  referring_user_name: string;
  receiving_user_id: number;
  receiving_user_name: string;
  note: string | null;
  estimated_value_cents: number;
  status: 'pending' | 'converted' | 'declined';
  created_at: string;
  updated_at: string;
}

export interface ReferralSummary {
  total: number;
  pending: number;
  converted: number;
  declined: number;
  converted_value_cents: number;
}

export interface VendorWallet {
  vendor_id: number;
  business_name: string;
  vendor_status: string;
  owner_name: string;
  owner_email: string;
  balance_cents: number;
  updated_at: string | null;
}

export interface WalletTransaction {
  id: number;
  vendor_wallet_id: number;
  order_id: number | null;
  type: 'credit';
  amount_cents: number;
  balance_after_cents: number;
  description: string | null;
  created_at: string;
}

export interface PlatformCoupon {
  id: number;
  vendor_id: number | null;
  code: string;
  discount_type: 'flat' | 'percentage';
  discount_value: string | number;
  min_order_value_cents: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

/** Where a banner image is rendered in the mobile app. */
export type BannerPlacement = 'home' | 'card_shop' | 'card_b2b' | 'card_nearme';

export interface Banner {
  id: number;
  title: string | null;
  subtitle: string | null;
  image_data: string;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
  placement: BannerPlacement;
  created_at: string;
}

/** Sprint 1 — Address & Serviceability. Contracts per documents/SPRINT_1_ADDRESS_SERVICEABILITY_SPEC.md */

/** One serviceability rule for a vendor: either a radius around the shop, or an allowed pincode. */
export interface VendorServiceArea {
  id: number;
  vendor_id: number;
  area_type: 'radius' | 'pincode';
  /** Set when area_type is 'radius'. */
  radius_km: string | number | null;
  /** Set when area_type is 'pincode'. */
  pincode: string | null;
  is_active: boolean;
  created_at: string;
}

/** One row per vendor — charges, thresholds and store hours. */
export interface VendorDeliveryRules {
  vendor_id: number;
  delivery_charge_cents: number;
  free_delivery_above_cents: number | null;
  min_order_cents: number;
  preparation_minutes: number;
  supports_delivery: boolean;
  supports_pickup: boolean;
  /** 'HH:MM' or 'HH:MM:SS'; null means the shop has no configured hours. */
  opens_at: string | null;
  closes_at: string | null;
  updated_at: string | null;
}

export interface DailyRevenuePoint {
  date: string;
  revenueCents: number;
}

export interface TopProduct {
  productId: number;
  name: string;
  revenueCents?: number;
  quantity?: number;
}

export interface PlatformSummary {
  totalRevenueCents: number;
  deliveredOrderCount: number;
  ordersLast30Days: number;
  totalOrdersAllTime: number;
  dailyRevenue: DailyRevenuePoint[];
  topProductsByRevenue: TopProduct[];
  topProductsByQuantity: TopProduct[];
  userCounts: { customers: number; vendors: number };
  vendorCounts: { pending: number; approved: number; rejected: number };
}

/**
 * A vendor's scorecard. The rates are derived server-side from the counters and
 * are null when there is nothing to divide by — a vendor with no orders has no
 * acceptance rate, which is different from an acceptance rate of zero.
 */
export interface VendorPerformance {
  vendor_id: number;
  business_name: string;
  status: AdminVendor['status'];
  orders_total: number;
  orders_accepted: number;
  orders_rejected: number;
  orders_cancelled: number;
  orders_delivered: number;
  open_orders: number;
  rating_count: number;
  updated_at: string | null;
  acceptance_rate: number | null;
  rejection_rate: number | null;
  cancellation_rate: number | null;
  avg_fulfilment_minutes: number | null;
  rating_avg: number | null;
}

export type CommissionScope = 'global' | 'category' | 'vendor';

/** commission_percent is cast to float server-side, so it arrives as a number. */
export interface CommissionPlan {
  id: number;
  scope: CommissionScope;
  category_id: number | null;
  vendor_id: number | null;
  commission_percent: number;
  flat_fee_cents: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  category_name: string | null;
  vendor_name: string | null;
}

export type VendorDocumentType = 'gstin' | 'pan' | 'bank' | 'fssai' | 'other';
export type VendorDocumentStatus = 'pending' | 'approved' | 'rejected';

export interface VendorDocument {
  id: number;
  vendor_id: number;
  business_name: string;
  doc_type: VendorDocumentType;
  doc_number: string | null;
  file_url: string | null;
  status: VendorDocumentStatus;
  rejection_reason: string | null;
  reviewed_by: number | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  submitted_at: string;
}

/** Per-vendor rollup: how far through verification each shop is. */
export interface VendorKycSummary {
  vendor_id: number;
  business_name: string;
  vendor_status: AdminVendor['status'];
  documents_total: number;
  pending_count: number;
  rejected_count: number;
  approved_required_count: number;
  required_total: number;
  last_submitted_at: string | null;
}

export interface VariantAttributeValue {
  attributeId: number;
  code: string;
  name: string;
  valueId: number;
  value: string;
}

/** A product variant as the catalogue endpoints serialise it (camelCase). */
export interface ProductVariant {
  id: number;
  sku: string | null;
  /** Attribute values joined for display, e.g. "500g / Red". */
  label: string | null;
  priceCents: number;
  mrpCents: number | null;
  isActive: boolean;
  sortOrder: number;
  availableQty: number | null;
  attributes: VariantAttributeValue[];
}

export interface AttributeValueOption {
  id: number;
  value: string;
  sortOrder?: number;
}

/** An attribute definition plus the values a variant may take from it. */
export interface ProductAttribute {
  id: number;
  name: string;
  code: string;
  input_type: string;
  is_variant_defining: boolean;
  sort_order: number;
  category_id: number | null;
  category_name: string | null;
  is_active: boolean;
  values: AttributeValueOption[];
}

export interface ProductMedia {
  id: number;
  variant_id: number | null;
  media_type: string;
  url: string;
  alt_text: string | null;
  is_primary: boolean;
  sort_order: number;
}

export type ModerationStatus = 'pending' | 'approved' | 'rejected';

/**
 * A product as the moderation queue serialises it. Note is_active and
 * moderation_status are independent: the first is the vendor's own switch, the
 * second is the admin's, and a customer needs both.
 */
export interface ModerationProduct {
  id: number;
  name: string;
  description: string | null;
  price_cents: number;
  mrp_cents: number | null;
  currency: string;
  image_url: string | null;
  category: string | null;
  sku: string | null;
  stock_quantity: number;
  is_active: boolean;
  moderation_status: ModerationStatus;
  moderation_reason: string | null;
  moderated_at: string | null;
  moderated_by_name: string | null;
  submitted_at: string;
  created_at: string;
  vendor_id: number;
  vendor_name: string;
  vendor_status: AdminVendor['status'];
  brand_name: string | null;
}

export interface ModerationCounts {
  pending: number;
  approved: number;
  rejected: number;
}

/** A stock row. Serialised camelCase by the inventory controller. */
export interface InventoryItem {
  id: number;
  productId: number;
  productName: string;
  variantId: number | null;
  variantLabel: string | null;
  sku: string | null;
  vendorId: number;
  vendorName: string;
  /** What a customer can buy right now. */
  availableQty: number;
  /** Promised to an open order — not available, not yet sold. */
  reservedQty: number;
  soldQty: number;
  lowStockThreshold: number;
  updatedAt: string;
}

export interface InventoryMovement {
  id: number;
  deltaAvailable: number;
  deltaReserved: number;
  deltaSold: number;
  reason: string;
  orderId: number | null;
  actorRole: string | null;
  actorName: string | null;
  note: string | null;
  createdAt: string;
}

export interface TowerException {
  code: string;
  severity: 'high' | 'medium';
  message: string;
}

export interface TowerOrder {
  id: number;
  vendorId: number;
  vendorName: string;
  status: string;
  totalCents: number;
  deliveryPartnerName: string | null;
  estimatedDeliveryAt: string | null;
  statusSince: string | null;
  minutesInStatus: number;
  /** Target for this status; null when the status has no target. */
  slaMinutes: number | null;
  isLate: boolean;
}

export interface TowerReassignment {
  id: number;
  status: string;
  reason: string | null;
  proposedVendorName: string | null;
  originalTotalCents: number;
  proposedTotalCents: number;
  createdAt: string;
}

/** A purchase, with its vendor orders under it — not one row per vendor order. */
export interface TowerGroup {
  id: number;
  reference: string;
  customerName: string;
  customerPhone: string | null;
  derivedStatus: string;
  totalCents: number;
  paymentMethod: string | null;
  paymentStatus: string | null;
  deliveryMethod: string | null;
  createdAt: string;
  ageMinutes: number;
  orders: TowerOrder[];
  reassignments: TowerReassignment[];
  exceptions: TowerException[];
}

export interface TowerSummary {
  openOrders: number;
  byStatus: Record<string, number>;
  lateOrders: number;
  awaitingCustomer: number;
  paymentFailed: number;
  paymentIncomplete: number;
  slaMinutes: Record<string, number>;
}

export type StaffAction = 'view' | 'edit' | 'delete';

/** One cell of the role grid: what a role may do to one sidebar menu. */
export interface StaffPermission {
  /** `<module>.<action>`, e.g. 'products.edit'. */
  key: string;
  /** The sidebar menu this acts on. */
  module: string;
  moduleLabel: string;
  /** The sidebar section the menu sits in — the grid's row grouping. */
  group: string;
  action: StaffAction;
  label: string;
  /** Granting this key implicitly grants these too. */
  implies?: string[];
  /** No API answers to this module yet, so the key gates the menu only. */
  pending?: boolean;
  /** Other sidebar menus this same key covers, when several share a resource. */
  covers?: string[];
}

export interface StaffRole {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  /** Built-in and undeletable — the super admin role. */
  is_system: boolean;
  permissions: string[];
  member_count: number;
  created_at: string;
}

export interface StaffMember {
  id: number;
  full_name: string;
  email: string;
  phone_number: string | null;
  created_at: string;
  role_id: number | null;
  role_slug: string | null;
  role_name: string | null;
}

/**
 * One ranking input the matching engine scores a candidate vendor on. Weights
 * are relative, not percentages — the engine normalises across whichever
 * factors are enabled, so switching one off redistributes the rest.
 */
export interface MatchingWeight {
  key: string;
  label: string;
  weight: number;
  enabled: boolean;
  /** Whether a higher raw value scores better — distance is the odd one out. */
  higherIsBetter: boolean;
  description: string | null;
}

export interface MatchingConfig {
  weights: MatchingWeight[];
  /** A vendor further than this is never a candidate, whatever it scores. */
  maxRadiusKm: number;
  /** How long the chosen vendor has to accept before the order is re-routed. */
  acceptWindowMinutes: number;
  /** Re-route on rejection without an admin approving it first. */
  autoReassign: boolean;
  maxReassignAttempts: number;
  updatedAt: string | null;
}

/** A vendor the engine considered for one order, with why it did or did not win. */
export interface MatchingCandidate {
  vendorId: number;
  vendorName: string;
  rank: number;
  score: number;
  distanceKm: number | null;
  chosen: boolean;
  /** Set when the vendor was filtered out before scoring — out of stock, closed. */
  skippedReason: string | null;
}

export interface MatchingLog {
  id: number;
  orderId: number;
  orderReference: string;
  createdAt: string;
  outcome: 'matched' | 'no_vendor' | 'reassigned' | 'expired';
  /** 1 on the first try; higher rows are re-routes of the same order. */
  attempt: number;
  candidatesConsidered: number;
  chosenVendorId: number | null;
  chosenVendorName: string | null;
  chosenScore: number | null;
  reason: string | null;
  candidates: MatchingCandidate[];
}

/** An order moving from one vendor to another, awaiting or past an admin call. */
export interface RoutingReassignment {
  id: number;
  orderId: number;
  orderReference: string;
  status: 'pending' | 'approved' | 'rejected' | 'auto';
  reason: string | null;
  fromVendorId: number | null;
  fromVendorName: string | null;
  toVendorId: number | null;
  toVendorName: string | null;
  /** The two totals differ when the new vendor prices the same basket higher. */
  originalTotalCents: number;
  proposedTotalCents: number;
  createdAt: string;
  resolvedAt: string | null;
  resolvedByName: string | null;
}

export interface MatchingSummary {
  matchedToday: number;
  /** Orders the engine could not place with any vendor — the queue that hurts. */
  unmatched: number;
  pendingReassignments: number;
  avgCandidates: number | null;
  avgMatchSeconds: number | null;
}

/**
 * Phase 8 — Shipments. A shipment is the physical movement of one vendor
 * order's goods. It is deliberately not the order: an order can ship in two
 * parcels, and a failed delivery leaves the order open while the shipment ends.
 */
export type ShipmentStatus =
  | 'created'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed'
  | 'returned'
  | 'cancelled';

/** One scan on a shipment's trail. Append-only — nothing here is ever edited. */
export interface ShipmentEvent {
  id: number;
  status: ShipmentStatus;
  description: string | null;
  location: string | null;
  actorRole: 'vendor' | 'partner' | 'admin' | 'system' | null;
  actorName: string | null;
  occurredAt: string;
}

export interface AdminShipment {
  id: number;
  /** Ours, shown to the customer. Not the courier's number. */
  trackingNumber: string;
  orderId: number;
  orderReference: string;
  vendorId: number;
  vendorName: string;
  customerName: string;
  customerPhone: string | null;
  deliveryCity: string | null;
  status: ShipmentStatus;
  partnerId: number | null;
  partnerName: string | null;
  /** The courier's own id and page, when the partner supplies them. */
  externalTrackingId: string | null;
  trackingUrl: string | null;
  packageCount: number;
  weightGrams: number | null;
  /** Cash the rider must collect. Null on a prepaid shipment. */
  codAmountCents: number | null;
  dispatchedAt: string | null;
  estimatedDeliveryAt: string | null;
  deliveredAt: string | null;
  /** Attempts, not parcels — a second attempt is the same shipment. */
  attemptCount: number;
  failureReason: string | null;
  createdAt: string;
}

export interface ShipmentDetail extends AdminShipment {
  events: ShipmentEvent[];
}

export interface ShipmentSummary {
  total: number;
  inTransit: number;
  outForDelivery: number;
  delivered: number;
  failed: number;
  /** Past its estimate and not delivered. */
  late: number;
  /** Created but with no delivery partner on it yet. */
  unassigned: number;
  avgDeliveryHours: number | null;
}

/**
 * Phase 9 — Invoices & GST.
 *
 * An invoice is a tax document, not a view of the order: once issued it never
 * changes. A wrong invoice is cancelled or credit-noted, never edited, so every
 * amount here is a snapshot taken at issue time.
 */

/** Intra-state splits into CGST + SGST; inter-state is a single IGST line. */
export type SupplyType = 'intra_state' | 'inter_state';

export interface InvoiceLine {
  id: number;
  description: string;
  /** Required on the GST return for anything above the turnover threshold. */
  hsnCode: string | null;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
  taxableCents: number;
  gstRatePercent: number;
  cgstCents: number;
  sgstCents: number;
  igstCents: number;
  cessCents: number;
  totalCents: number;
}

export interface AdminInvoice {
  id: number;
  /** From the platform's invoice series. Gapless and never reused. */
  invoiceNumber: string;
  invoiceDate: string;
  orderId: number;
  orderReference: string;
  vendorId: number;
  vendorName: string;
  vendorGstin: string | null;
  buyerName: string;
  /** Present on a B2B invoice; its absence is what makes the sale B2C. */
  buyerGstin: string | null;
  /** The state that decides which tax applies. */
  placeOfSupply: string;
  supplyType: SupplyType;
  taxableCents: number;
  cgstCents: number;
  sgstCents: number;
  igstCents: number;
  cessCents: number;
  roundOffCents: number;
  totalCents: number;
  status: 'issued' | 'cancelled';
  cancelledAt: string | null;
  cancelReason: string | null;
  /** Set once a credit note is raised against this invoice. */
  creditNoteNumber: string | null;
  pdfUrl: string | null;
  createdAt: string;
}

export interface InvoiceDetail extends AdminInvoice {
  billingAddress: string | null;
  shippingAddress: string | null;
  lines: InvoiceLine[];
}

export interface InvoiceSummary {
  count: number;
  /** Invoices carrying a buyer GSTIN — the B2B slice of the return. */
  b2bCount: number;
  cancelledCount: number;
  creditNotedCount: number;
  taxableCents: number;
  cgstCents: number;
  sgstCents: number;
  igstCents: number;
  totalCents: number;
}

/**
 * Phase 9 — Settlements. What the platform owes a vendor for one cycle: gross
 * sales less commission and deductions. Money only moves on 'paid', and that
 * step is one-way — a wrong payout is corrected by an adjustment next cycle.
 */
export type SettlementStatus = 'draft' | 'pending_approval' | 'approved' | 'paid' | 'on_hold' | 'failed';

export type DeductionKind = 'commission' | 'refund' | 'tds' | 'tcs' | 'penalty' | 'adjustment' | 'other';

export interface SettlementDeduction {
  id: number;
  kind: DeductionKind;
  label: string;
  /** Always positive — the kind says which way it moves. */
  amountCents: number;
  note: string | null;
}

export interface SettlementOrderLine {
  orderId: number;
  orderReference: string;
  deliveredAt: string | null;
  grossCents: number;
  commissionCents: number;
  netCents: number;
}

export interface AdminSettlement {
  id: number;
  reference: string;
  vendorId: number;
  vendorName: string;
  vendorGstin: string | null;
  periodStart: string;
  periodEnd: string;
  orderCount: number;
  grossCents: number;
  commissionCents: number;
  /** Refunds, TDS, penalties — everything except commission. */
  deductionCents: number;
  /** Manual corrections. Signed: a credit to the vendor is positive. */
  adjustmentCents: number;
  netPayableCents: number;
  status: SettlementStatus;
  holdReason: string | null;
  bankAccountMasked: string | null;
  bankIfsc: string | null;
  /** The bank's reference for the transfer. Proof the payout happened. */
  payoutUtr: string | null;
  paidAt: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface SettlementDetail extends AdminSettlement {
  deductions: SettlementDeduction[];
  orders: SettlementOrderLine[];
}

export interface SettlementSummary {
  pendingCount: number;
  pendingCents: number;
  approvedCount: number;
  /** Approved but not yet transferred — the platform's live liability. */
  approvedCents: number;
  paidThisMonthCents: number;
  onHoldCount: number;
  failedCount: number;
}

/**
 * Phase 9 — Credit notes. The only lawful way to reverse an issued invoice:
 * it carries its own number series, reverses the tax on the return, and is
 * itself immutable once issued.
 */
export type CreditNoteReason = 'return' | 'cancellation' | 'price_adjustment' | 'deficiency' | 'other';

export interface CreditNoteLine {
  id: number;
  /** The invoice line being reversed — a credit note never invents a line. */
  invoiceLineId: number;
  description: string;
  hsnCode: string | null;
  /** May be less than the invoiced quantity: a partial return credits part. */
  quantity: number;
  taxableCents: number;
  gstRatePercent: number;
  cgstCents: number;
  sgstCents: number;
  igstCents: number;
  totalCents: number;
}

export interface AdminCreditNote {
  id: number;
  creditNoteNumber: string;
  creditNoteDate: string;
  invoiceId: number;
  invoiceNumber: string;
  orderReference: string;
  vendorId: number;
  vendorName: string;
  buyerName: string;
  buyerGstin: string | null;
  supplyType: SupplyType;
  reason: CreditNoteReason;
  reasonNote: string | null;
  taxableCents: number;
  cgstCents: number;
  sgstCents: number;
  igstCents: number;
  totalCents: number;
  status: 'issued' | 'cancelled';
  /** The money side. A credit note can exist before its refund is paid out. */
  refundId: number | null;
  refundStatus: string | null;
  pdfUrl: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface CreditNoteDetail extends AdminCreditNote {
  lines: CreditNoteLine[];
}

export interface CreditNoteSummary {
  count: number;
  taxableCents: number;
  taxCents: number;
  totalCents: number;
  /** Issued, but no refund has settled against them yet. */
  awaitingRefund: number;
}

/**
 * Phase 10 — Returns. The customer's request to send goods back, from the ask
 * through pickup, inspection and the money going out. Approving a return is not
 * the same as refunding it: goods come back first, and what arrives may differ
 * from what was claimed.
 */
export type ReturnStatus =
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'pickup_scheduled'
  | 'picked_up'
  | 'received'
  | 'refunded'
  | 'disputed'
  | 'cancelled';

export type ReturnReason =
  | 'damaged'
  | 'wrong_item'
  | 'not_as_described'
  | 'quality'
  | 'expired'
  | 'missing_parts'
  | 'other';

/** How the goods actually arrived, recorded at inspection — not what was claimed. */
export type ReturnCondition = 'unopened' | 'opened' | 'used' | 'damaged' | 'missing';

export interface ReturnItem {
  id: number;
  orderItemId: number;
  productName: string;
  sku: string | null;
  imageUrl: string | null;
  quantity: number;
  unitPriceCents: number;
  /** The most this line could refund — before any inspection deduction. */
  refundableCents: number;
  condition: ReturnCondition | null;
}

export interface ReturnEvidence {
  id: number;
  url: string;
  kind: 'image' | 'video';
  caption: string | null;
  uploadedAt: string;
}

export interface ReturnEvent {
  id: number;
  status: ReturnStatus;
  note: string | null;
  actorRole: 'customer' | 'vendor' | 'admin' | 'system';
  actorName: string | null;
  createdAt: string;
}

export interface AdminReturn {
  id: number;
  reference: string;
  orderId: number;
  orderReference: string;
  vendorId: number;
  vendorName: string;
  customerName: string;
  customerPhone: string | null;
  status: ReturnStatus;
  reason: ReturnReason;
  reasonNote: string | null;
  itemCount: number;
  refundableCents: number;
  /** What an admin actually authorised. Below refundable when something is deducted. */
  approvedRefundCents: number | null;
  requestedAt: string;
  /** The return window's end. Past it, a request needs a deliberate override. */
  windowClosesAt: string | null;
  isWithinWindow: boolean;
  pickupScheduledAt: string | null;
  receivedAt: string | null;
  refundId: number | null;
  refundStatus: string | null;
  creditNoteNumber: string | null;
  /** Set when the customer contests a rejection or a short refund. */
  disputeReason: string | null;
  evidenceCount: number;
}

export interface ReturnDetail extends AdminReturn {
  pickupAddress: string | null;
  items: ReturnItem[];
  evidence: ReturnEvidence[];
  timeline: ReturnEvent[];
}

export interface ReturnSummary {
  requested: number;
  awaitingPickup: number;
  awaitingInspection: number;
  disputed: number;
  refundedThisMonth: number;
  refundedCents: number;
}

/**
 * Phase 10 — Replacements. Raised from an approved return when the customer
 * wants the item again rather than the money back. Nothing ships until stock
 * is confirmed, and the replacement can come from a different vendor.
 */
export type ReplacementStatus =
  | 'requested'
  | 'awaiting_stock'
  | 'approved'
  | 'order_created'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'failed';

export interface ReplacementItem {
  id: number;
  productName: string;
  variantLabel: string | null;
  sku: string | null;
  imageUrl: string | null;
  quantity: number;
  unitPriceCents: number;
  /** Stock at the vendor set to fulfil this replacement, right now. */
  availableQty: number;
}

/** Another vendor that could fulfil, offered when the original cannot. */
export interface ReplacementAlternate {
  vendorId: number;
  vendorName: string;
  availableQty: number;
  distanceKm: number | null;
  /** What this vendor charges — the difference the platform absorbs. */
  priceCents: number;
}

export interface ReplacementEvent {
  id: number;
  status: ReplacementStatus;
  note: string | null;
  actorRole: 'customer' | 'vendor' | 'admin' | 'system';
  actorName: string | null;
  createdAt: string;
}

export interface AdminReplacement {
  id: number;
  reference: string;
  returnId: number;
  returnReference: string;
  originalOrderId: number;
  originalOrderReference: string;
  /** Created only once the replacement is approved and stock is held. */
  replacementOrderId: number | null;
  replacementOrderReference: string | null;
  vendorId: number;
  vendorName: string;
  /** Set when another shop is fulfilling instead of the original vendor. */
  fulfilVendorId: number | null;
  fulfilVendorName: string | null;
  customerName: string;
  customerPhone: string | null;
  status: ReplacementStatus;
  reason: ReturnReason;
  note: string | null;
  itemCount: number;
  valueCents: number;
  /** What the replacement costs above the original. The customer is not charged. */
  priceDifferenceCents: number;
  /** Why it cannot proceed — out of stock, discontinued, no alternate. */
  blockedReason: string | null;
  requestedAt: string;
  approvedAt: string | null;
  deliveredAt: string | null;
}

export interface ReplacementDetail extends AdminReplacement {
  deliveryAddress: string | null;
  items: ReplacementItem[];
  alternates: ReplacementAlternate[];
  timeline: ReplacementEvent[];
}

export interface ReplacementSummary {
  awaitingDecision: number;
  awaitingStock: number;
  inFulfilment: number;
  deliveredThisMonth: number;
  failed: number;
  /** Cost the platform has absorbed on price differences this month. */
  priceDifferenceCents: number;
}

/**
 * Phase 10 — Cancellations. What may still be cancelled depends on how far the
 * order has travelled, so eligibility is a rule per order stage rather than a
 * single yes or no.
 */
export type CancellationStatus = 'requested' | 'approved' | 'auto_approved' | 'rejected' | 'withdrawn';

export interface CancellationRule {
  /** The order status this rule governs. */
  orderStatus: string;
  customerAllowed: boolean;
  vendorAllowed: boolean;
  /** Approve without an admin looking — safe on early stages, not on late ones. */
  autoApprove: boolean;
  /** Deducted from the refund, as a percentage of order value. */
  feePercent: number;
  /** Put the stock back when the cancellation is approved. */
  restock: boolean;
}

export interface CancellationRules {
  rules: CancellationRule[];
  updatedAt: string | null;
}

export interface AdminCancellation {
  id: number;
  reference: string;
  orderId: number;
  orderReference: string;
  vendorId: number;
  vendorName: string;
  customerName: string;
  requestedBy: 'customer' | 'vendor' | 'admin' | 'system';
  requestedByName: string | null;
  /** The stage the order was at when asked — what eligibility was judged on. */
  orderStatusAtRequest: string;
  /** Where the order is now. It can move on while the request waits. */
  currentOrderStatus: string;
  status: CancellationStatus;
  reason: string;
  reasonNote: string | null;
  orderTotalCents: number;
  /** Charged per the rule for that stage. An admin can waive it. */
  feeCents: number;
  refundCents: number;
  paymentStatus: string | null;
  refundId: number | null;
  refundStatus: string | null;
  /** Whether the rules allow this cancellation at all. */
  eligible: boolean;
  requestedAt: string;
  decidedAt: string | null;
  decidedByName: string | null;
  decisionNote: string | null;
}

export interface CancellationSummary {
  requested: number;
  ineligiblePending: number;
  approvedThisMonth: number;
  rejectedThisMonth: number;
  refundedCents: number;
  feeCents: number;
}

/**
 * Phase 11 — B2B. A business account is a buying organisation, not a person:
 * several people order under one GSTIN, against one credit limit, to addresses
 * the organisation owns rather than any one buyer.
 */
export type BusinessAccountStatus = 'pending' | 'verified' | 'rejected' | 'suspended';

export interface BusinessAddress {
  id: number;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  /** A branch in another state files under its own GSTIN. */
  gstin: string | null;
  isDefault: boolean;
  contactName: string | null;
  contactPhone: string | null;
}

export interface BusinessMember {
  id: number;
  userId: number;
  name: string;
  email: string;
  phone: string | null;
  /** Owners manage the account, approvers sign off, buyers only order. */
  role: 'owner' | 'approver' | 'buyer';
  /** The most this person may commit on one order. Null means no cap. */
  orderLimitCents: number | null;
  addedAt: string;
}

export interface AdminBusinessAccount {
  id: number;
  legalName: string;
  tradeName: string | null;
  gstin: string;
  pan: string | null;
  status: BusinessAccountStatus;
  statusReason: string | null;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string | null;
  city: string | null;
  state: string | null;
  /** Zero means prepaid only — the account has no credit at all. */
  creditLimitCents: number;
  creditUsedCents: number;
  paymentTermsDays: number;
  memberCount: number;
  addressCount: number;
  ordersCount: number;
  rfqCount: number;
  lifetimeValueCents: number;
  lastOrderAt: string | null;
  verifiedAt: string | null;
  verifiedByName: string | null;
  createdAt: string;
}

export interface BusinessAccountDocument {
  id: number;
  type: VendorDocumentType;
  fileUrl: string;
  status: VendorDocumentStatus;
  uploadedAt: string;
}

export interface BusinessAccountDetail extends AdminBusinessAccount {
  addresses: BusinessAddress[];
  members: BusinessMember[];
  documents: BusinessAccountDocument[];
}

export interface BusinessAccountSummary {
  pending: number;
  verified: number;
  suspended: number;
  /** Credit extended and currently drawn — the platform's B2B exposure. */
  creditExposureCents: number;
  creditLimitCents: number;
  lifetimeValueCents: number;
}

/**
 * Phase 11 — RFQ. A business asks for a price on a basket no catalogue listing
 * covers. Vendors are invited rather than matched: the buyer wants competing
 * quotes, not one shop chosen for them.
 */
export type RfqStatus = 'draft' | 'open' | 'closed' | 'awarded' | 'cancelled' | 'expired';

export interface RfqItem {
  id: number;
  /** Null when the buyer described something not in the catalogue. */
  productId: number | null;
  productName: string;
  specification: string | null;
  quantity: number;
  unit: string;
  /** What the buyer hopes to pay per unit. Not binding on anyone. */
  targetPriceCents: number | null;
}

/** A vendor invited to quote, and how far they have got with it. */
export interface RfqVendor {
  vendorId: number;
  vendorName: string;
  status: 'invited' | 'viewed' | 'quoted' | 'declined';
  invitedAt: string;
  quotationId: number | null;
  quotedTotalCents: number | null;
  declineReason: string | null;
  distanceKm: number | null;
}

/** A vendor worth inviting, ranked by how much of the basket it can cover. */
export interface RfqSuggestion {
  vendorId: number;
  vendorName: string;
  matchedItems: number;
  distanceKm: number | null;
  ratingAvg: number | null;
}

export interface AdminRfq {
  id: number;
  reference: string;
  title: string;
  businessAccountId: number;
  businessName: string;
  buyerName: string;
  status: RfqStatus;
  itemCount: number;
  /** The buyer's own estimate, from target prices. Often absent. */
  estimatedValueCents: number | null;
  deliveryCity: string | null;
  deliveryBy: string | null;
  /** After this, no vendor may quote. */
  closesAt: string | null;
  invitedCount: number;
  quotedCount: number;
  /** Lowest quote received so far. */
  bestQuoteCents: number | null;
  awardedVendorName: string | null;
  createdAt: string;
}

export interface RfqDetail extends AdminRfq {
  notes: string | null;
  deliveryAddress: string | null;
  items: RfqItem[];
  vendors: RfqVendor[];
  suggestions: RfqSuggestion[];
}

export interface RfqSummary {
  open: number;
  /** Open, closing within 24 hours, and nobody has quoted. */
  closingSoon: number;
  awaitingQuotes: number;
  awardedThisMonth: number;
  awardedValueCents: number;
}

/**
 * Phase 11 — Quotations. A vendor's priced answer to an RFQ. Quotes are
 * versioned rather than edited: asking for a better price produces a new
 * revision, so the negotiation stays readable after the fact.
 */
export type QuotationStatus =
  | 'submitted'
  | 'revision_requested'
  | 'revised'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'expired';

export interface QuotationLine {
  id: number;
  rfqItemId: number;
  description: string;
  quantity: number;
  unit: string;
  unitPriceCents: number;
  taxPercent: number;
  lineTotalCents: number;
  /** What the buyer asked to pay, carried over from the RFQ line. */
  targetPriceCents: number | null;
  /** The vendor cannot supply this line at all. */
  unavailable: boolean;
  note: string | null;
}

export interface QuotationMessage {
  id: number;
  from: 'admin' | 'vendor' | 'buyer';
  authorName: string | null;
  body: string;
  createdAt: string;
}

/** A rival quote on the same RFQ, for context when awarding. */
export interface CompetingQuote {
  quotationId: number;
  vendorName: string;
  totalCents: number;
  status: QuotationStatus;
}

export interface AdminQuotation {
  id: number;
  reference: string;
  rfqId: number;
  rfqReference: string;
  rfqTitle: string;
  vendorId: number;
  vendorName: string;
  businessName: string;
  status: QuotationStatus;
  /** 1 on the first submission; each revision increments. */
  revision: number;
  subtotalCents: number;
  taxCents: number;
  deliveryCents: number;
  totalCents: number;
  /** Against the cheapest quote on the same RFQ. Null when it is the cheapest. */
  deltaVsBestCents: number | null;
  validUntil: string | null;
  deliveryDays: number | null;
  paymentTermsDays: number | null;
  lineCount: number;
  /** Lines the vendor cannot supply — a cheap quote that skips half the basket. */
  unavailableCount: number;
  submittedAt: string;
  decidedAt: string | null;
}

export interface QuotationDetail extends AdminQuotation {
  notes: string | null;
  lines: QuotationLine[];
  messages: QuotationMessage[];
  competing: CompetingQuote[];
}

export interface QuotationSummary {
  awaitingReview: number;
  inNegotiation: number;
  acceptedThisMonth: number;
  acceptedValueCents: number;
  /** How far under the buyers' targets the accepted quotes landed. */
  avgSavingPercent: number | null;
}

/**
 * Phase 11 — Purchase orders. What an awarded quotation becomes: a commitment
 * to buy, at prices already agreed. Quantities are delivered against it over
 * time, so a PO is only finished when everything has both arrived and been paid.
 */
export type PurchaseOrderStatus =
  | 'issued'
  | 'acknowledged'
  | 'in_progress'
  | 'partially_delivered'
  | 'delivered'
  | 'closed'
  | 'cancelled';

export interface PurchaseOrderLine {
  id: number;
  description: string;
  hsnCode: string | null;
  quantity: number;
  unit: string;
  /** Delivered so far. Below quantity means the line is still open. */
  deliveredQuantity: number;
  unitPriceCents: number;
  taxPercent: number;
  lineTotalCents: number;
}

/** One drop against the PO. A PO is rarely fulfilled in a single delivery. */
export interface PurchaseOrderDelivery {
  id: number;
  deliveredAt: string;
  note: string | null;
  shipmentId: number | null;
  trackingNumber: string | null;
  /** Value of what arrived in this drop. */
  valueCents: number;
}

export interface AdminPurchaseOrder {
  id: number;
  poNumber: string;
  quotationId: number;
  quotationReference: string;
  rfqReference: string;
  businessAccountId: number;
  businessName: string;
  buyerName: string;
  vendorId: number;
  vendorName: string;
  status: PurchaseOrderStatus;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  /** Billed and settled so far — a PO can be fully delivered and unpaid. */
  invoicedCents: number;
  paidCents: number;
  paymentTermsDays: number;
  paymentDueAt: string | null;
  expectedDeliveryAt: string | null;
  /** Null while the vendor has not confirmed it can honour the PO. */
  acknowledgedAt: string | null;
  lineCount: number;
  /** 0–1. Delivered value over ordered value. */
  fulfilledRatio: number;
  invoiceNumber: string | null;
  issuedAt: string;
  closedAt: string | null;
  cancelReason: string | null;
}

export interface PurchaseOrderDetail extends AdminPurchaseOrder {
  deliveryAddress: string | null;
  notes: string | null;
  lines: PurchaseOrderLine[];
  deliveries: PurchaseOrderDelivery[];
}

export interface PurchaseOrderSummary {
  awaitingAcknowledgement: number;
  inProgress: number;
  /** Past the promised delivery date and not complete. */
  overdue: number;
  issuedThisMonthCents: number;
  /** Delivered, invoiced, and still not settled. */
  outstandingCents: number;
}

/**
 * Phase 13 — Reviews. Tied to a verified purchase wherever possible: an
 * unverified review is not necessarily false, but it carries less weight and
 * is where fake ratings come from.
 */
export type ReviewStatus = 'pending' | 'published' | 'rejected' | 'flagged';

/** A review is about the goods or about the shop — never both. */
export type ReviewTarget = 'product' | 'vendor';

export interface ReviewReport {
  id: number;
  reason: string;
  reportedByName: string | null;
  createdAt: string;
}

export interface AdminReview {
  id: number;
  target: ReviewTarget;
  productId: number | null;
  productName: string | null;
  productImageUrl: string | null;
  vendorId: number;
  vendorName: string;
  rating: number;
  title: string | null;
  body: string | null;
  photos: string[];
  authorId: number;
  authorName: string;
  /** Backed by a delivered order. Null order reference means it is not. */
  verifiedPurchase: boolean;
  orderReference: string | null;
  status: ReviewStatus;
  rejectionReason: string | null;
  reportCount: number;
  reports: ReviewReport[];
  vendorReply: string | null;
  vendorRepliedAt: string | null;
  helpfulCount: number;
  createdAt: string;
  moderatedAt: string | null;
  moderatedByName: string | null;
}

export interface ReviewSummary {
  pending: number;
  flagged: number;
  publishedThisMonth: number;
  averageRating: number | null;
  /** Share of published reviews with no purchase behind them, 0–1. */
  unverifiedShare: number | null;
  /** Published counts by star, keyed '1' to '5'. */
  ratingCounts: Record<string, number>;
}

/**
 * Phase 20 — Support. A ticket is a conversation with a clock on it: the first
 * reply and the resolution each have a deadline, and a ticket nobody owns is
 * the one that misses both.
 */
export type TicketStatus = 'open' | 'pending_customer' | 'pending_vendor' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TicketCategory = 'order' | 'payment' | 'delivery' | 'vendor' | 'product' | 'account' | 'other';

export interface TicketMessage {
  id: number;
  from: 'customer' | 'vendor' | 'admin' | 'system';
  authorName: string | null;
  body: string;
  /** A note for staff only. The requester never sees it. */
  internal: boolean;
  attachments: string[];
  createdAt: string;
}

/** Someone a ticket can be assigned to. */
export interface SupportAgent {
  id: number;
  name: string;
  openTickets: number;
}

export interface AdminTicket {
  id: number;
  reference: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  requesterType: 'customer' | 'vendor';
  requesterName: string;
  requesterEmail: string | null;
  requesterPhone: string | null;
  orderReference: string | null;
  vendorName: string | null;
  assigneeId: number | null;
  assigneeName: string | null;
  messageCount: number;
  lastMessageAt: string;
  lastMessageFrom: TicketMessage['from'];
  /** When the first reply was owed, and when it actually went out. */
  firstResponseDueAt: string | null;
  firstRespondedAt: string | null;
  resolutionDueAt: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface TicketDetail extends AdminTicket {
  messages: TicketMessage[];
}

export interface TicketSummary {
  open: number;
  unassigned: number;
  /** Past a deadline and still not met. */
  breached: number;
  awaitingUs: number;
  resolvedToday: number;
  avgFirstResponseMinutes: number | null;
}

/**
 * Phase 21 — Delivery partners. Riders and courier agencies. Two things gate
 * whether one may be given work: valid paperwork, and capacity left today.
 */
export type PartnerType = 'rider' | 'agency';
export type PartnerStatus = 'pending' | 'active' | 'suspended' | 'rejected';
export type PartnerDocumentType = 'licence' | 'rc' | 'insurance' | 'id_proof' | 'other';

export interface PartnerDocument {
  id: number;
  type: PartnerDocumentType;
  fileUrl: string;
  status: VendorDocumentStatus;
  /** Paperwork that lapses. An expired licence disqualifies the partner. */
  expiresAt: string | null;
  uploadedAt: string;
}

/** A shipment currently on this partner. */
export interface PartnerAssignment {
  shipmentId: number;
  trackingNumber: string;
  status: ShipmentStatus;
  area: string | null;
  assignedAt: string;
  /** Cash this partner is carrying for the drop. */
  codAmountCents: number | null;
}

export interface AdminDeliveryPartner {
  id: number;
  name: string;
  type: PartnerType;
  phone: string;
  email: string | null;
  status: PartnerStatus;
  statusReason: string | null;
  vehicleType: string | null;
  vehicleNumber: string | null;
  /** Pincodes or zone names this partner covers. */
  serviceAreas: string[];
  /** Accepting work right now, independent of being active. */
  isOnline: boolean;
  activeAssignments: number;
  dailyCapacity: number;
  deliveriesTotal: number;
  deliveredToday: number;
  failedToday: number;
  onTimeRate: number | null;
  failureRate: number | null;
  ratingAvg: number | null;
  ratingCount: number;
  /** Cash collected and not yet handed over — the platform's money, held. */
  codHeldCents: number;
  lastSettlementAt: string | null;
  onboardedAt: string | null;
  createdAt: string;
}

export interface DeliveryPartnerDetail extends AdminDeliveryPartner {
  documents: PartnerDocument[];
  assignments: PartnerAssignment[];
}

export interface DeliveryPartnerSummary {
  pending: number;
  active: number;
  online: number;
  deliveredToday: number;
  failedToday: number;
  codHeldCents: number;
  /** Partners whose paperwork has lapsed or is about to. */
  expiringDocuments: number;
}

/**
 * Phase 22 — Home sections. The app's home screen is an ordered list of
 * sections, not a fixed design. Order here is order on the phone.
 */
export type HomeSectionType =
  | 'featured_categories'
  | 'featured_vendors'
  | 'local_deals'
  | 'b2b_promotions'
  | 'product_carousel'
  | 'banner_strip';

/** Who sees the section. B2B promotions have no business on a B2C home. */
export type HomeAudience = 'all' | 'b2c' | 'b2b';

/** Manual sections are curated by hand; automatic ones follow a rule. */
export type HomeSource = 'manual' | 'automatic';

export interface HomeSectionItem {
  id: number;
  /** The category, vendor, product or banner this item points at. */
  refId: number;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  sortOrder: number;
}

/** Something that could be added to a manual section. */
export interface HomeCandidate {
  refId: number;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
}

export interface HomeSection {
  id: number;
  type: HomeSectionType;
  title: string;
  subtitle: string | null;
  audience: HomeAudience;
  source: HomeSource;
  /** How an automatic section picks its items, in words. */
  rule: string | null;
  layout: 'grid' | 'carousel' | 'list';
  maxItems: number;
  isActive: boolean;
  /** Optional window. Outside it the section is not shown, however active. */
  startsAt: string | null;
  endsAt: string | null;
  sortOrder: number;
  itemCount: number;
  items: HomeSectionItem[];
}

export interface HomeLayout {
  sections: HomeSection[];
  updatedAt: string | null;
}

/**
 * Phase 22 — Campaigns. A discount running across the marketplace for a while.
 * The question that decides everything is who pays for it: a platform-funded
 * campaign spends real money, a vendor-funded one needs shops to opt in.
 */
export type CampaignScope = 'platform' | 'category' | 'vendor';
export type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'paused' | 'ended';
export type CampaignDiscountType = 'percentage' | 'flat' | 'free_delivery';
export type CampaignFunding = 'platform' | 'vendor' | 'shared';

export interface CampaignParticipant {
  id: number;
  type: 'vendor' | 'category' | 'product';
  refId: number;
  name: string;
  /** Vendor-funded campaigns only run for shops that agreed. */
  optedIn: boolean;
  joinedAt: string | null;
}

export interface AdminCampaign {
  id: number;
  name: string;
  scope: CampaignScope;
  status: CampaignStatus;
  discountType: CampaignDiscountType;
  /** Percent, or rupees in cents, depending on discountType. */
  discountValue: number;
  maxDiscountCents: number | null;
  minOrderCents: number;
  startsAt: string;
  endsAt: string;
  fundedBy: CampaignFunding;
  /** The platform's share when funding is shared, 0–100. */
  platformSharePercent: number | null;
  /** Spend cap. Null means uncapped — nothing stops it but the end date. */
  budgetCents: number | null;
  spentCents: number;
  participantCount: number;
  optedInCount: number;
  orders: number;
  revenueCents: number;
  discountGivenCents: number;
  bannerUrl: string | null;
  createdAt: string;
}

export interface CampaignDetail extends AdminCampaign {
  description: string | null;
  participants: CampaignParticipant[];
}

export interface CampaignSummary {
  running: number;
  scheduled: number;
  /** Campaigns stopped by hitting their cap rather than their end date. */
  budgetExhausted: number;
  discountThisMonthCents: number;
  revenueThisMonthCents: number;
}

/**
 * Phase 23 — Analytics. One call returns the whole picture for a window, so
 * every number on the page is measured over the same period.
 */
export interface AnalyticsPoint {
  date: string;
  gmvCents: number;
  orders: number;
}

/** GMV split by where the order came from. */
export interface ChannelPoint {
  date: string;
  shopCents: number;
  b2bCents: number;
  nearMeCents: number;
}

export interface AnalyticsVendor {
  vendorId: number;
  vendorName: string;
  city: string | null;
  orders: number;
  gmvCents: number;
}

export interface AnalyticsLocation {
  city: string;
  orders: number;
  gmvCents: number;
  customers: number;
}

/** One step of the buy funnel, in order. */
export interface FunnelStage {
  stage: string;
  count: number;
}

export interface AnalyticsSummary {
  gmvCents: number;
  /** Against the previous window of the same length. Null with no history. */
  gmvDeltaPercent: number | null;
  orders: number;
  ordersDeltaPercent: number | null;
  aovCents: number;
  /** Orders per session, 0–1. */
  conversionRate: number | null;
  /** Customers who ordered more than once in the window, 0–1. */
  repeatRate: number | null;
  newCustomers: number;
  returningCustomers: number;
}

export interface AnalyticsResponse {
  summary: AnalyticsSummary;
  series: AnalyticsPoint[];
  channels: ChannelPoint[];
  vendors: AnalyticsVendor[];
  locations: AnalyticsLocation[];
  funnel: FunnelStage[];
}

/** What the signed-in admin may do. Drives which menus the panel shows. */
export interface StaffMe {
  userId: number;
  email: string;
  role: { id: number; slug: string; name: string } | null;
  isSuperAdmin: boolean;
  permissions: string[];
}

/** One row of who-changed-what. Before/after are opaque — each module shapes its own. */
export interface AuditLogEntry {
  id: number;
  action: string;
  module: string;
  entity_type: string | null;
  entity_id: string | null;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
  actor_user_id: number | null;
  actor_name: string | null;
  actor_email: string | null;
}

export interface FeatureFlag {
  id: number;
  flag_key: string;
  description: string | null;
  enabled: boolean;
  updated_by_user_id: number | null;
  created_at: string;
  updated_at: string;
}

export type NotificationType = 'order' | 'payment' | 'vendor' | 'system' | 'promo';

/** A row in the signed-in admin's own inbox — not a broadcast composer. */
export interface AdminNotification {
  id: number;
  type: NotificationType;
  title: string;
  body: string;
  deep_link: string | null;
  read_at: string | null;
  created_at: string;
}
