import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { LayoutDashboard, ShoppingBag, Pizza, Cog, Tag, BarChart3, Gift, Users, Map, Clock, Settings, Sliders, LogOut, Menu as MenuIcon, X } from 'lucide-react';

const NAV = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/admin/menu', label: 'Menu', icon: Pizza },
  { to: '/admin/modifiers', label: 'Modifiers', icon: Sliders },
  { to: '/admin/coupons', label: 'Coupons', icon: Tag },
  { to: '/admin/coupon-usage', label: 'Coupon Usage', icon: BarChart3 },
  { to: '/admin/loyalty', label: 'Loyalty', icon: Gift },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/delivery-zones', label: 'Delivery Zones', icon: Map },
  { to: '/admin/operating-hours', label: 'Operating Hours', icon: Clock },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const loc = useLocation();
  const { user, signOut, loading } = useAuth();
  const [authorised, setAuthorised] = useState(null);   // null | true | false
  const [me, setMe] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { setAuthorised(false); navigate('/admin/login', { replace: true }); return; }
    api.get(`/admin/check?email=${encodeURIComponent(user.email)}`)
      .then(({ data }) => { setMe(data); setAuthorised(true); })
      .catch(() => { setAuthorised(false); navigate('/admin/login', { replace: true }); });
  }, [user, loading, navigate]);

  useEffect(() => { setOpen(false); }, [loc.pathname]);

  if (loading || authorised === null) {
    return <div className="min-h-screen flex items-center justify-center text-lamazi-muted">Loading…</div>;
  }

  return (
    <div className="min-h-screen flex bg-lamazi-neutral">
      {/* sidebar */}
      <aside className={`fixed lg:static z-40 top-0 left-0 w-64 h-screen bg-lamazi-primary text-lamazi-neutral flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-5 border-b border-lamazi-neutral/10 flex items-center justify-between">
          <div>
            <p className="brand-wordmark text-lamazi-secondary text-base">LAMAZI</p>
            <p className="text-[10px] uppercase tracking-widest text-lamazi-neutral/60">Admin Panel</p>
          </div>
          <button className="lg:hidden p-1" onClick={() => setOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
              data-testid={`admin-nav-${n.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <n.icon className="w-4 h-4" /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-lamazi-neutral/10">
          <p className="text-xs text-lamazi-neutral/60 mb-1">{me?.name || 'Admin'}</p>
          <p className="text-xs text-lamazi-neutral/60 mb-2 truncate">{user?.email}</p>
          <button onClick={() => { signOut(); navigate('/admin/login'); }} className="text-xs text-lamazi-secondary hover:underline flex items-center gap-1" data-testid="admin-signout">
            <LogOut className="w-3 h-3" /> Sign out
          </button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      {/* main */}
      <div className="flex-1 lg:ml-0 min-w-0">
        <header className="sticky top-0 z-20 bg-lamazi-neutral border-b border-lamazi-secondary/40 px-4 sm:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2" onClick={() => setOpen(true)}>
              <MenuIcon className="w-5 h-5 text-lamazi-primary" />
            </button>
            <p className="text-sm text-lamazi-muted">Lamazi · Hawally</p>
          </div>
          <a href="/" className="text-xs text-lamazi-primary hover:underline">View site →</a>
        </header>
        <main className="p-4 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
