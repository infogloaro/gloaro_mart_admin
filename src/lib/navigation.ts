import type { IconName } from '../components/ui/Icon';

/**
 * 'live' modules are built and routed to a real page. 'soon' modules are part of
 * the phase-wise roadmap and route to the shared Coming Soon page — they stay
 * visible in the sidebar so the full marketplace scope is always in view.
 */
export type NavStatus = 'live' | 'soon';

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
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: 'dashboard', status: 'live', end: true },
      {
        to: '/analytics',
        label: 'Analytics',
        icon: 'chart',
        status: 'soon',
        phase: 'Phase 23',
        summary: 'GMV, conversion, AOV, repeat customers, vendor and location performance.',
      },
    ],
  },
  {
    id: 'catalogue',
    label: 'Catalogue',
    items: [
      { to: '/products', label: 'Products', icon: 'box', status: 'live' },
      { to: '/categories', label: 'Categories', icon: 'layers', status: 'live' },
      { to: '/brands', label: 'Brands', icon: 'tag', status: 'live' },
      {
        to: '/attributes',
        label: 'Attributes',
        icon: 'sliders',
        status: 'soon',
        phase: 'Phase 2',
        summary: 'Category-specific attributes such as size, colour, storage and pack size.',
      },
      {
        to: '/variants',
        label: 'Product Variants',
        icon: 'grid',
        status: 'soon',
        phase: 'Phase 2',
        summary: 'Per-variant SKU, price, MRP, stock and images.',
      },
      {
        to: '/moderation',
        label: 'Product Moderation',
        icon: 'shield',
        status: 'soon',
        phase: 'Phase 17',
        summary: 'Review queue for vendor-submitted products before they go live.',
      },
      {
        to: '/catalogue-import',
        label: 'Bulk Import / Export',
        icon: 'upload',
        status: 'soon',
        phase: 'Phase 17',
        summary: 'CSV import and export for products, variants and inventory.',
      },
      {
        to: '/inventory',
        label: 'Inventory',
        icon: 'package',
        status: 'soon',
        phase: 'Phase 2',
        summary: 'Available, reserved and sold stock with movement history per vendor.',
      },
    ],
  },
  {
    id: 'vendors',
    label: 'Vendors',
    items: [
      { to: '/vendors', label: 'Vendors', icon: 'store', status: 'live' },
      {
        to: '/vendor-kyc',
        label: 'KYC & Documents',
        icon: 'idcard',
        status: 'soon',
        phase: 'Phase 16',
        summary: 'GSTIN, PAN and bank verification with document approval workflow.',
      },
      { to: '/service-areas', label: 'Service Areas', icon: 'map', status: 'live' },
      {
        to: '/commission-plans',
        label: 'Commission Plans',
        icon: 'percent',
        status: 'soon',
        phase: 'Phase 9',
        summary: 'Global, category-level and vendor-specific commission rules.',
      },
      {
        to: '/vendor-performance',
        label: 'Vendor Performance',
        icon: 'gauge',
        status: 'soon',
        phase: 'Phase 3',
        summary: 'Acceptance rate, rejection rate, fulfilment time and ratings.',
      },
    ],
  },
  {
    id: 'orders',
    label: 'Orders & Fulfilment',
    items: [
      { to: '/orders', label: 'Orders', icon: 'cart', status: 'live' },
      {
        to: '/control-tower',
        label: 'Order Control Tower',
        icon: 'tower',
        status: 'soon',
        phase: 'Phase 18',
        summary: 'Checkout groups, vendor orders, exceptions and SLA monitoring in one console.',
      },
      {
        to: '/vendor-routing',
        label: 'Vendor Matching & Re-routing',
        icon: 'route',
        status: 'soon',
        phase: 'Phase 3',
        summary: 'Ranking weights, matching logs and reassignment when a vendor rejects.',
      },
      {
        to: '/shipments',
        label: 'Shipments',
        icon: 'truck',
        status: 'soon',
        phase: 'Phase 8',
        summary: 'Shipment records and delivery events, tracked separately from orders.',
      },
      { to: '/delivery-zones', label: 'Delivery Zones & Rules', icon: 'mappin', status: 'live' },
      {
        to: '/delivery-partners',
        label: 'Delivery Partners',
        icon: 'bike',
        status: 'soon',
        phase: 'Phase 21',
        summary: 'Partner onboarding, assignment and failed-delivery handling.',
      },
    ],
  },
  {
    id: 'finance',
    label: 'Payments & Finance',
    items: [
      { to: '/wallets', label: 'Wallets', icon: 'wallet', status: 'live' },
      { to: '/payments', label: 'Payments', icon: 'card', status: 'live' },
      { to: '/refunds', label: 'Refunds', icon: 'refund', status: 'live' },
      {
        to: '/invoices',
        label: 'Invoices & GST',
        icon: 'receipt',
        status: 'soon',
        phase: 'Phase 9',
        summary: 'Immutable GST invoices, tax lines and finance exports.',
      },
      {
        to: '/settlements',
        label: 'Settlements',
        icon: 'coins',
        status: 'soon',
        phase: 'Phase 9',
        summary: 'Vendor earnings after commission and deductions, with payout approval.',
      },
      {
        to: '/credit-notes',
        label: 'Credit Notes',
        icon: 'note',
        status: 'soon',
        phase: 'Phase 9',
        summary: 'Credit notes raised against returns and cancellations.',
      },
    ],
  },
  {
    id: 'post-purchase',
    label: 'Post-Purchase',
    items: [
      {
        to: '/returns',
        label: 'Returns',
        icon: 'undo',
        status: 'soon',
        phase: 'Phase 10',
        summary: 'Return queue, evidence review, approvals, disputes and refund monitoring.',
      },
      {
        to: '/replacements',
        label: 'Replacements',
        icon: 'swap',
        status: 'soon',
        phase: 'Phase 10',
        summary: 'Replacement orders raised from an approved return.',
      },
      {
        to: '/cancellations',
        label: 'Cancellations',
        icon: 'ban',
        status: 'soon',
        phase: 'Phase 10',
        summary: 'Cancellation requests with stage-based eligibility rules.',
      },
      {
        to: '/support',
        label: 'Support Tickets',
        icon: 'headset',
        status: 'soon',
        phase: 'Phase 20',
        summary: 'Order, payment, delivery, vendor and product issue tickets.',
      },
      {
        to: '/reviews',
        label: 'Reviews & Ratings',
        icon: 'star',
        status: 'soon',
        phase: 'Phase 13',
        summary: 'Moderate product and vendor reviews tied to verified purchases.',
      },
    ],
  },
  {
    id: 'b2b',
    label: 'B2B Marketplace',
    items: [
      {
        to: '/business-accounts',
        label: 'Business Accounts',
        icon: 'briefcase',
        status: 'soon',
        phase: 'Phase 11',
        summary: 'GSTIN-verified business buyers with their own addresses and history.',
      },
      {
        to: '/rfq',
        label: 'RFQ Management',
        icon: 'filetext',
        status: 'soon',
        phase: 'Phase 11',
        summary: 'Requests for quotation, vendor shortlisting and status tracking.',
      },
      {
        to: '/quotations',
        label: 'Quotations',
        icon: 'quote',
        status: 'soon',
        phase: 'Phase 11',
        summary: 'Vendor quotes, comparison and negotiation history.',
      },
      {
        to: '/purchase-orders',
        label: 'Purchase Orders',
        icon: 'clipboard',
        status: 'soon',
        phase: 'Phase 11',
        summary: 'Purchase orders generated from an accepted quotation.',
      },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing & CMS',
    items: [
      { to: '/offers', label: 'Offers & Coupons', icon: 'percent', status: 'live' },
      { to: '/banners', label: 'Banners', icon: 'image', status: 'live' },
      { to: '/menu', label: 'App Menu', icon: 'menu', status: 'live' },
      {
        to: '/cms',
        label: 'Home Sections',
        icon: 'sections',
        status: 'soon',
        phase: 'Phase 22',
        summary: 'Featured categories, featured vendors, local deals and B2B promotions.',
      },
      {
        to: '/campaigns',
        label: 'Campaigns',
        icon: 'megaphone',
        status: 'soon',
        phase: 'Phase 22',
        summary: 'Platform, category and vendor campaigns with scheduling.',
      },
      {
        to: '/notifications',
        label: 'Notifications',
        icon: 'bell',
        status: 'soon',
        phase: 'Phase 24',
        summary: 'Compose, target and schedule push, in-app, email and SMS notifications.',
      },
    ],
  },
  {
    id: 'community',
    label: 'Customers & Network',
    items: [
      { to: '/users', label: 'Users', icon: 'users', status: 'live' },
      { to: '/organisation', label: 'Organisation', icon: 'network', status: 'live' },
      { to: '/referrals', label: 'Referrals', icon: 'gift', status: 'live' },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      {
        to: '/staff',
        label: 'Admin Staff & RBAC',
        icon: 'lock',
        status: 'soon',
        phase: 'Phase 15',
        summary: 'Staff accounts, roles and per-module permission groups.',
      },
      {
        to: '/audit-logs',
        label: 'Audit Logs',
        icon: 'history',
        status: 'soon',
        phase: 'Phase 24',
        summary: 'Who changed what, in which module, with before and after values.',
      },
      {
        to: '/feature-flags',
        label: 'Feature Flags',
        icon: 'flag',
        status: 'soon',
        phase: 'Phase 24',
        summary: 'Toggle marketplace features without shipping a new build.',
      },
      { to: '/settings', label: 'General Settings', icon: 'settings', status: 'live' },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export const UPCOMING_NAV_ITEMS: NavItem[] = ALL_NAV_ITEMS.filter((i) => i.status === 'soon');

export function findNavItem(pathname: string): NavItem | undefined {
  return ALL_NAV_ITEMS.find((i) => i.to === pathname);
}

export function findNavGroup(pathname: string): NavGroup | undefined {
  return NAV_GROUPS.find((g) => g.items.some((i) => i.to === pathname));
}
