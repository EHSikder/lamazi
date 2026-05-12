import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';

import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';

import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import AdminLayout from '@/components/AdminLayout';

import Home from '@/pages/Home';
import Menu from '@/pages/Menu';
import About from '@/pages/About';
import Loyalty from '@/pages/Loyalty';
import Bag from '@/pages/Bag';
import Checkout from '@/pages/Checkout';
import Auth from '@/pages/Auth';
import OrderTracking from '@/pages/OrderTracking';
import PaymentResult from '@/pages/PaymentResult';

import AdminLogin from '@/pages/admin/AdminLogin';
import Dashboard from '@/pages/admin/Dashboard';
import AdminOrders from '@/pages/admin/AdminOrders';
import AdminMenu from '@/pages/admin/AdminMenu';
import AdminModifiers from '@/pages/admin/AdminModifiers';
import AdminCoupons from '@/pages/admin/AdminCoupons';
import AdminCouponUsage from '@/pages/admin/AdminCouponUsage';
import AdminLoyalty from '@/pages/admin/AdminLoyalty';
import AdminCustomers from '@/pages/admin/AdminCustomers';
import AdminDeliveryZones from '@/pages/admin/AdminDeliveryZones';
import AdminOperatingHours from '@/pages/admin/AdminOperatingHours';
import AdminSettings from '@/pages/admin/AdminSettings';

import '@/App.css';

function MainLayout() {
  const loc = useLocation();
  // scroll to top on route change
  React.useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [loc.pathname]);
  return (
    <div className="min-h-screen flex flex-col bg-lamazi-neutral">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Toaster position="top-center" richColors />
          <Routes>
            {/* Admin login (no admin shell) */}
            <Route path="/admin/login" element={<AdminLogin />} />

            {/* Admin shell + nested */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="menu" element={<AdminMenu />} />
              <Route path="modifiers" element={<AdminModifiers />} />
              <Route path="coupons" element={<AdminCoupons />} />
              <Route path="coupon-usage" element={<AdminCouponUsage />} />
              <Route path="loyalty" element={<AdminLoyalty />} />
              <Route path="customers" element={<AdminCustomers />} />
              <Route path="delivery-zones" element={<AdminDeliveryZones />} />
              <Route path="operating-hours" element={<AdminOperatingHours />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>

            {/* Main website */}
            <Route element={<MainLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/menu" element={<Menu />} />
              <Route path="/about" element={<About />} />
              <Route path="/loyalty" element={<Loyalty />} />
              <Route path="/bag" element={<Bag />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/order/:id" element={<OrderTracking />} />
              <Route path="/payment-result" element={<PaymentResult />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
