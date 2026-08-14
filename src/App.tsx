import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { RequireAdmin } from './routes/RequireAdmin';
import { AdminLayout } from './components/layout/AdminLayout';
import { UPCOMING_NAV_ITEMS } from './lib/navigation';
import LoginPage from './routes/LoginPage';
import DashboardPage from './routes/DashboardPage';
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
import DeliveryZonesPage from './routes/DeliveryZonesPage';
import ComingSoonPage from './routes/ComingSoonPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAdmin />}>
          <Route element={<AdminLayout />}>
            <Route path="/" element={<DashboardPage />} />
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
            <Route path="/delivery-zones" element={<DeliveryZonesPage />} />

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
