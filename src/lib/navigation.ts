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
    ],
  },
  {
    id: "catalogue",
    label: "Catalogue",
    items: [
      { to: "/products", label: "Products", icon: "box", status: "live", permission: "products.view" },
      {
        to: "/categories",
        label: "Categories",
        icon: "layers",
        status: "live", permission: "categories.view" },
      { to: "/brands", label: "Brands", icon: "tag", status: "live", permission: "brands.view" },
      {
        to: "/attributes",
        label: "Attributes",
        icon: "sliders",
        status: "live", permission: "attributes.view" },
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
        to: "/catalogue-import",
        label: "Bulk Import / Export",
        icon: "upload",
        status: "live", permission: "catalogue_import.view" },
      {
        to: "/inventory",
        label: "Inventory",
        icon: "package",
        status: "live", permission: "inventory.view" },
    ],
  },
  {
    id: "vendors",
    label: "Vendors",
    items: [
      { to: "/vendors", label: "Vendors", icon: "store", status: "live", permission: "vendors.view" },
      {
        to: "/vendor-kyc",
        label: "KYC & Documents",
        icon: "idcard",
        status: "live", permission: "vendors.view" },
      {
        to: "/service-areas",
        label: "Service Areas",
        icon: "map",
        status: "live", permission: "vendors.view" },
      {
        to: "/commission-plans",
        label: "Commission Plans",
        icon: "percent",
        status: "live", permission: "commission_plans.view" },
      {
        to: "/vendor-performance",
        label: "Vendor Performance",
        icon: "gauge",
        status: "live", permission: "vendors.view" },
    ],
  },
  {
    id: "orders",
    label: "Orders & Fulfilment",
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
        to: "/shipments",
        label: "Shipments",
        icon: "truck",
        status: "live", permission: "shipments.view" },
      {
        to: "/delivery-zones",
        label: "Delivery Zones & Rules",
        icon: "mappin",
        status: "live", permission: "vendors.view" },
      {
        to: "/delivery-partners",
        label: "Delivery Partners",
        icon: "bike",
        status: "live", permission: "delivery_partners.view" },
    ],
  },
  {
    id: "finance",
    label: "Payments & Finance",
    items: [
      { to: "/wallets", label: "Wallets", icon: "wallet", status: "live", permission: "wallets.view" },
      { to: "/payments", label: "Payments", icon: "card", status: "live", permission: "payments.view" },
      { to: "/refunds", label: "Refunds", icon: "refund", status: "live", permission: "refunds.view" },
      {
        to: "/invoices",
        label: "Invoices & GST",
        icon: "receipt",
        status: "live", permission: "invoices.view" },
      {
        to: "/settlements",
        label: "Settlements",
        icon: "coins",
        status: "live", permission: "settlements.view" },
      {
        to: "/credit-notes",
        label: "Credit Notes",
        icon: "note",
        status: "live", permission: "credit_notes.view" },
    ],
  },
  {
    id: "post-purchase",
    label: "Post-Purchase",
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
      {
        to: "/cancellations",
        label: "Cancellations",
        icon: "ban",
        status: "live", permission: "cancellations.view" },
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
    id: "marketing",
    label: "Marketing & CMS",
    items: [
      {
        to: "/offers",
        label: "Offers & Coupons",
        icon: "percent",
        status: "live", permission: "offers.view" },
      { to: "/banners", label: "Banners", icon: "image", status: "live", permission: "banners.view" },
      { to: "/menu", label: "App Menu", icon: "menu", status: "live", permission: "app_menu.view" },
      {
        to: "/cms",
        label: "Home Sections",
        icon: "sections",
        status: "live", permission: "home_sections.view" },
      {
        to: "/campaigns",
        label: "Campaigns",
        icon: "megaphone",
        status: "live", permission: "campaigns.view" },
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
    id: "community",
    label: "Customers & Network",
    items: [
      { to: "/users", label: "Users", icon: "users", status: "live", permission: "users.view" },
      {
        to: "/organisation",
        label: "Organisation",
        icon: "network",
        status: "live", permission: "organisation.view" },
      { to: "/referrals", label: "Referrals", icon: "gift", status: "live", permission: "referrals.view" },
    ],
  },
  {
    id: "system",
    label: "System & Administration",
    items: [
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
        to: "/settings",
        label: "General Settings",
        icon: "settings",
        status: "live", permission: "settings.view" },
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
