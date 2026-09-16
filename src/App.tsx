import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { RequireAdmin } from './routes/RequireAdmin';
import { AdminLayout } from './components/layout/AdminLayout';
import { UPCOMING_NAV_ITEMS } from './lib/navigation';
import LoginPage from './routes/LoginPage';
import HomeRoute from './routes/HomeRoute';
import UsersPage from './routes/UsersPage';
import VendorsPage from './routes/VendorsPage';
import OrdersPage from './routes/OrdersPage';
import OffersPage from './routes/OffersPage';
import BannersPage from './routes/BannersPage';
import ProductsPage from './routes/ProductsPage';
import CategoriesPage from './routes/CategoriesPage';
import BrandsPage from './routes/BrandsPage';
import SettingsPage from './routes/SettingsPage';
import OrganizationPage from './routes/OrganizationPage';
import ReferralsPage from './routes/ReferralsPage';
import WalletsPage from './routes/WalletsPage';
import PaymentsPage from './routes/PaymentsPage';
import RefundsPage from './routes/RefundsPage';
import MenuPage from './routes/MenuPage';
import ServiceAreasPage from './routes/ServiceAreasPage';
import VendorPerformancePage from './routes/VendorPerformancePage';
import VendorKycPage from './routes/VendorKycPage';
import CommissionPlansPage from './routes/CommissionPlansPage';
import VariantsPage from './routes/VariantsPage';
import AttributesPage from './routes/AttributesPage';
import ModerationPage from './routes/ModerationPage';
import CatalogueImportPage from './routes/CatalogueImportPage';
import InventoryPage from './routes/InventoryPage';
import ControlTowerPage from './routes/ControlTowerPage';
import StaffPage from './routes/StaffPage';
import DeliveryZonesPage from './routes/DeliveryZonesPage';
import VendorRoutingPage from './routes/VendorRoutingPage';
import ShipmentsPage from './routes/ShipmentsPage';
import InvoicesPage from './routes/InvoicesPage';
import SettlementsPage from './routes/SettlementsPage';
import CreditNotesPage from './routes/CreditNotesPage';
import ReturnsPage from './routes/ReturnsPage';
import ReplacementsPage from './routes/ReplacementsPage';
import CancellationsPage from './routes/CancellationsPage';
import BusinessAccountsPage from './routes/BusinessAccountsPage';
import RfqPage from './routes/RfqPage';
import QuotationsPage from './routes/QuotationsPage';
import PurchaseOrdersPage from './routes/PurchaseOrdersPage';
import ReviewsPage from './routes/ReviewsPage';
import SupportPage from './routes/SupportPage';
import DeliveryPartnersPage from './routes/DeliveryPartnersPage';
import HomeSectionsPage from './routes/HomeSectionsPage';
import CampaignsPage from './routes/CampaignsPage';
import AnalyticsPage from './routes/AnalyticsPage';
import AdminLogsPage from './routes/AdminLogsPage';
import FeatureFlagsPage from './routes/FeatureFlagsPage';
import NotificationsPage from './routes/NotificationsPage';
import ComingSoonPage from './routes/ComingSoonPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAdmin />}>
          <Route element={<AdminLayout />}>
            <Route path="/" element={<HomeRoute />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/vendors" element={<VendorsPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/offers" element={<OffersPage />} />
            <Route path="/banners" element={<BannersPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/brands" element={<BrandsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/organisation" element={<OrganizationPage />} />
            <Route path="/referrals" element={<ReferralsPage />} />
            <Route path="/wallets" element={<WalletsPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/refunds" element={<RefundsPage />} />
            <Route path="/menu" element={<MenuPage />} />
            <Route path="/service-areas" element={<ServiceAreasPage />} />
            <Route path="/vendor-performance" element={<VendorPerformancePage />} />
            <Route path="/vendor-kyc" element={<VendorKycPage />} />
            <Route path="/commission-plans" element={<CommissionPlansPage />} />
            <Route path="/variants" element={<VariantsPage />} />
            <Route path="/attributes" element={<AttributesPage />} />
            <Route path="/moderation" element={<ModerationPage />} />
            <Route path="/catalogue-import" element={<CatalogueImportPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/control-tower" element={<ControlTowerPage />} />
            <Route path="/staff" element={<StaffPage />} />
            <Route path="/delivery-zones" element={<DeliveryZonesPage />} />
            <Route path="/vendor-routing" element={<VendorRoutingPage />} />
            <Route path="/shipments" element={<ShipmentsPage />} />
            <Route path="/invoices" element={<InvoicesPage />} />
            <Route path="/settlements" element={<SettlementsPage />} />
            <Route path="/credit-notes" element={<CreditNotesPage />} />
            <Route path="/returns" element={<ReturnsPage />} />
            <Route path="/replacements" element={<ReplacementsPage />} />
            <Route path="/cancellations" element={<CancellationsPage />} />
            <Route path="/business-accounts" element={<BusinessAccountsPage />} />
            <Route path="/rfq" element={<RfqPage />} />
            <Route path="/quotations" element={<QuotationsPage />} />
            <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
            <Route path="/reviews" element={<ReviewsPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/delivery-partners" element={<DeliveryPartnersPage />} />
            <Route path="/cms" element={<HomeSectionsPage />} />
            <Route path="/campaigns" element={<CampaignsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/audit-logs" element={<AdminLogsPage />} />
            <Route path="/feature-flags" element={<FeatureFlagsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />

            {/*
              Roadmap modules. Each keeps its final path so shipping one is a
              matter of swapping the element and flipping its nav status.
            */}
            {UPCOMING_NAV_ITEMS.map((item) => (
              <Route key={item.to} path={item.to} element={<ComingSoonPage />} />
            ))}
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
