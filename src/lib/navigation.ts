import type { IconName } from "../components/ui/Icon";

/**
 * 'live' modules are built and routed to a real page. 'soon' modules are part of
 * the phase-wise roadmap and route to the shared Coming Soon page — they stay
 * visible in the sidebar so the full marketplace scope is always in view.
 */
export type NavStatus = "live" | "soon";

export interface NavItem {
  /** The final intended path. When a 'soon' module ships, only its status changes. */
  to: string;
  label: string;
  icon: IconName;
  status: NavStatus;
  /** Roadmap phase, shown on the Coming Soon page. */
  phase?: string;
  /** One line explaining what the module will do. */
  summary?: string;
  end?: boolean;
  /**
   * The '<module>.view' key the API requires to open this menu — see MODULES in
   * the backend's permissions service. Menus that read and write the same
   * resource share a key, because the server decides from the path and cannot
   * tell them apart. A super admin passes regardless of what is listed here.
   */
  permission?: string;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

/**
 * Sidebar groups, by the task an admin is doing (2026-10-31): day-to-day work
 * first (orders, delivery, returns), then catalogue and shops, then growth
 * (offers, app content, ads), then money and settings. Groups start closed;
 * the one holding the open page expands (see Sidebar).
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [
      {
        to: "/",
        label: "Dashboard",
        icon: "dashboard",
        status: "live",
        end: true, permission: "dashboard.view" },
      {
        to: "/analytics",
        label: "Analytics",
        icon: "chart",
        status: "live", permission: "analytics.view" },
      {
        to: "/reports",
        label: "Reports",
        icon: "filetext",
        status: "live", permission: "reports.view" },
      {
        to: "/approvals",
        label: "Approvals",
        icon: "shield",
        status: "live",
        // Open to all staff: each sees their own requests; super admins see and decide all.
      },
      {
        // A personal inbox scoped to the signed-in account, like Settings'
        // profile tab — every admin sees their own regardless of role, so
        // this is intentionally not gated by a module permission.
        to: "/notifications",
        label: "Notifications",
        icon: "bell",
        status: "live",
      },
    ],
  },
  {
    id: "orders",
    label: "Orders",
    items: [
      { to: "/orders", label: "Orders", icon: "cart", status: "live", permission: "orders.view" },
      {
        to: "/control-tower",
        label: "Order Control Tower",
        icon: "tower",
        status: "live", permission: "control_tower.view" },
      {
        to: "/vendor-routing",
        label: "Vendor Matching & Re-routing",
        icon: "route",
        status: "live", permission: "vendor_routing.view" },
      {
        to: "/cancellations",
        label: "Cancellations",
        icon: "ban",
        status: "live", permission: "cancellations.view" },
    ],
  },
  {
    id: "delivery",
    label: "Delivery",
    items: [
      {
        to: "/shipments",
        label: "Shipments",
        icon: "truck",
        status: "live", permission: "shipments.view" },
      {
        to: "/delivery-partners",
        label: "Delivery Partners",
        icon: "bike",
        status: "live", permission: "delivery_partners.view" },
      {
        to: "/delivery-zones",
        label: "Delivery Zones & Rules",
        icon: "mappin",
        status: "live", permission: "vendors.view" },
      {
        to: "/service-areas",
        label: "Service Areas",
        icon: "map",
        status: "live", permission: "vendors.view" },
    ],
  },
  {
    id: "after-sales",
    label: "Returns & Support",
    items: [
      {
        to: "/returns",
        label: "Returns",
        icon: "undo",
        status: "live", permission: "returns.view" },
      {
        to: "/replacements",
        label: "Replacements",
        icon: "swap",
        status: "live", permission: "replacements.view" },
      { to: "/refunds", label: "Refunds", icon: "refund", status: "live", permission: "refunds.view" },
      {
        to: "/support",
        label: "Support Tickets",
        icon: "headset",
        status: "live", permission: "support.view" },
      {
        to: "/reviews",
        label: "Reviews & Ratings",
        icon: "star",
        status: "live", permission: "reviews.view" },
    ],
  },
  {
    id: "products",
    label: "Products",
    items: [
      { to: "/products", label: "Products", icon: "box", status: "live", permission: "products.view" },
      {
        to: "/variants",
        label: "Product Variants",
        icon: "grid",
        status: "live", permission: "products.view" },
      {
        to: "/moderation",
        label: "Product Moderation",
        icon: "shield",
        status: "live", permission: "products.view" },
      {
        to: "/inventory",
        label: "Inventory",
        icon: "package",
        status: "live", permission: "inventory.view" },
      {
        to: "/catalogue-import",
        label: "Bulk Import / Export",
        icon: "upload",
        status: "live", permission: "catalogue_import.view" },
    ],
  },
  {
    id: "catalogue-setup",
    label: "Categories & Brands",
    items: [
      {
        to: "/categories",
        label: "Categories",
        icon: "layers",
        status: "live", permission: "categories.view" },
      {
        to: "/service-categories",
        label: "Service categories",
        icon: "layers",
        status: "live", permission: "categories.view" },
      { to: "/brands", label: "Brands", icon: "tag", status: "live", permission: "brands.view" },
      {
        to: "/attributes",
        label: "Attributes",
        icon: "sliders",
        status: "live", permission: "attributes.view" },
    ],
  },
  {
    id: "vendors",
    label: "Shops (Vendors)",
    items: [
      { to: "/vendors", label: "Vendors", icon: "store", status: "live", permission: "vendors.view", end: true },
      {
        to: "/vendor-kyc",
        label: "KYC & Documents",
        icon: "idcard",
        status: "live", permission: "vendors.view" },
      {
        to: "/vendor-performance",
        label: "Vendor Performance",
        icon: "gauge",
        status: "live", permission: "vendors.view" },
      {
        to: "/vendors/reports",
        label: "Shop Reports",
        icon: "flag",
        status: "live", permission: "vendors.view" },
      {
        to: "/vendors/health",
        label: "Shop Health",
        icon: "shield",
        status: "live", permission: "vendors.view" },
      {
        to: "/vendors/paused",
        label: "Paused & Busy Shops",
        icon: "history",
        status: "live", permission: "vendors.view" },
      {
        to: "/vendors/broadcasts",
        label: "Shop Messages",
        icon: "chat",
        status: "live", permission: "vendors.view" },
      {
        to: "/commission-plans",
        label: "Commission Plans",
        icon: "percent",
        status: "live", permission: "commission_plans.view" },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    items: [
      { to: "/users", label: "Users", icon: "users", status: "live", permission: "users.view" },
      { to: "/referrals", label: "Referrals", icon: "gift", status: "live", permission: "referrals.view" },
      { to: "/rewards", label: "Reward Points", icon: "star", status: "live", permission: "rewards.view" },
      {
        to: "/organisation",
        label: "Organisation",
        icon: "network",
        status: "live", permission: "organisation.view" },
    ],
  },
  {
    id: "b2b",
    label: "B2B Marketplace",
    items: [
      {
        to: "/business-accounts",
        label: "Business Accounts",
        icon: "briefcase",
        status: "live", permission: "business_accounts.view" },
      {
        to: "/rfq",
        label: "RFQ Management",
        icon: "filetext",
        status: "live", permission: "rfq.view" },
      {
        to: "/quotations",
        label: "Quotations",
        icon: "quote",
        status: "live", permission: "quotations.view" },
      {
        to: "/purchase-orders",
        label: "Purchase Orders",
        icon: "clipboard",
        status: "live", permission: "purchase_orders.view" },
    ],
  },
  {
    id: "offers",
    label: "Offers & Campaigns",
    items: [
      {
        to: "/campaigns",
        label: "Campaigns",
        icon: "megaphone",
        status: "live", permission: "campaigns.view" },
      {
        to: "/offers",
        label: "Offers & Coupons",
        icon: "percent",
        status: "live", permission: "offers.view", end: true },
      {
        to: "/offers/shops",
        label: "Shop Offers",
        icon: "tag",
        status: "live", permission: "offers.view" },
    ],
  },
  {
    id: "app-content",
    label: "App Content",
    items: [
      {
        to: "/cms",
        label: "Home Sections",
        icon: "sections",
        status: "live", permission: "home_sections.view" },
      { to: "/banners", label: "Banners", icon: "image", status: "live", permission: "banners.view" },
      { to: "/menu", label: "App Menu", icon: "menu", status: "live", permission: "app_menu.view" },
      {
        to: "/languages",
        label: "App Languages",
        icon: "globe",
        status: "live",
        permission: "settings.view",
      },
    ],
  },
  {
    id: "ads",
    label: "Advertising",
    items: [
      {
        to: "/ads",
        label: "Ad Promotions",
        icon: "chart",
        status: "live",
        permission: "ad_promotions.view",
        end: true,
      },
      {
        to: "/ads/campaigns",
        label: "Ad Campaigns",
        icon: "image",
        status: "live",
        permission: "ad_promotions.view",
      },
      {
        to: "/ads/pricing",
        label: "Ad Pricing",
        icon: "coins",
        status: "live",
        permission: "ad_promotions.view",
      },
      {
        to: "/ads/payments",
        label: "Ad Payments",
        icon: "wallet",
        status: "live",
        permission: "ad_promotions.view",
      },
      {
        to: "/ads/taps",
        label: "Ad Tap Review",
        icon: "alert",
        status: "live",
        permission: "ad_promotions.view",
      },
    ],
  },
  {
    id: "finance",
    label: "Payments & Finance",
    items: [
      { to: "/payments", label: "Payments", icon: "card", status: "live", permission: "payments.view" },
      { to: "/wallets", label: "Wallets", icon: "wallet", status: "live", permission: "wallets.view" },
      {
        to: "/settlements",
        label: "Settlements",
        icon: "coins",
        status: "live", permission: "settlements.view" },
      {
        to: "/invoices",
        label: "Invoices & GST",
        icon: "receipt",
        status: "live", permission: "invoices.view" },
      {
        to: "/credit-notes",
        label: "Credit Notes",
        icon: "note",
        status: "live", permission: "credit_notes.view" },
      { to: "/payment-settings", label: "Payment settings", icon: "settings", status: "live", permission: "payments.view" },
    ],
  },
  {
    id: "system",
    label: "Settings & Admin",
    items: [
      {
        to: "/settings",
        label: "General Settings",
        icon: "settings",
        status: "live", permission: "settings.view" },
      {
        to: "/staff",
        label: "Admin Staff & RBAC",
        icon: "lock",
        status: "live", permission: "staff.view" },
      {
        to: "/audit-logs",
        label: "Admin Logs",
        icon: "history",
        status: "live",
        permission: "audit_logs.view",
      },
      {
        to: "/feature-flags",
        label: "Feature Flags",
        icon: "flag",
        status: "live",
        permission: "feature_flags.view",
      },
      {
        to: "/platform-registry",
        label: "Platform Registry",
        icon: "layers",
        status: "live",
        // One permission module per registry category; viewing any one opens the menu.
        permission: "platform_*.view",
      },
      {
        to: "/channels",
        label: "Channels",
        icon: "chat",
        status: "live",
        permission: "channels.view",
      },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export const UPCOMING_NAV_ITEMS: NavItem[] = ALL_NAV_ITEMS.filter(
  (i) => i.status === "soon",
);

export function findNavItem(pathname: string): NavItem | undefined {
  return ALL_NAV_ITEMS.find((i) => i.to === pathname);
}

export function findNavGroup(pathname: string): NavGroup | undefined {
  return NAV_GROUPS.find((g) => g.items.some((i) => i.to === pathname));
}
