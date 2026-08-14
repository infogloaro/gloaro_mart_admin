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

export interface Banner {
  id: number;
  title: string | null;
  subtitle: string | null;
  image_data: string;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
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
