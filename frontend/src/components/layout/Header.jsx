import React, { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ShoppingBag, User, Menu as MenuIcon, X } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';

const links = [
  { to: '/', label: 'Home' },
  { to: '/menu', label: 'Menu' },
  { to: '/about', label: 'About' },
  { to: '/loyalty', label: 'Loyalty Program' },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const { itemCount } = useCart();
  const loc = useLocation();
  const onAdmin = loc.pathname.startsWith('/admin');
  if (onAdmin) return null;

  return (
    <header className="sticky top-0 z-40 bg-lamazi-neutral/90 backdrop-blur-md border-b border-lamazi-secondary/40">
      <div className="container-lamazi flex items-center justify-between h-16 sm:h-20">
        <Link to="/" className="brand-wordmark text-xl sm:text-2xl" data-testid="brand-logo">
          LAMAZI
        </Link>

        {/* desktop nav */}
        <nav className="hidden lg:flex items-center gap-8">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                `relative text-sm font-medium tracking-wide transition-colors ${
                  isActive ? 'text-lamazi-primary' : 'text-lamazi-ink/70 hover:text-lamazi-primary'
                }`
              }
              data-testid={`nav-${l.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-1 sm:gap-3">
          <Link
            to="/bag"
            className="relative p-2 rounded-full hover:bg-lamazi-secondary/40 transition-colors"
            data-testid="header-bag-icon"
          >
            <ShoppingBag className="w-5 h-5 text-lamazi-primary" />
            {itemCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-lamazi-primary text-lamazi-neutral text-[10px] font-semibold flex items-center justify-center"
                data-testid="header-bag-count"
              >
                {itemCount}
              </span>
            )}
          </Link>
          <Link
            to="/auth"
            className="p-2 rounded-full hover:bg-lamazi-secondary/40 transition-colors"
            data-testid="header-profile-icon"
          >
            <User className="w-5 h-5 text-lamazi-primary" />
          </Link>
          <button
            className="lg:hidden p-2 rounded-full hover:bg-lamazi-secondary/40 transition-colors"
            onClick={() => setOpen((o) => !o)}
            aria-label="menu"
            data-testid="header-menu-toggle"
          >
            {open ? <X className="w-5 h-5 text-lamazi-primary" /> : <MenuIcon className="w-5 h-5 text-lamazi-primary" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="lg:hidden border-t border-lamazi-secondary/40 bg-lamazi-neutral px-6 py-4 space-y-2">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-base ${
                  isActive ? 'bg-lamazi-secondary/40 text-lamazi-primary' : 'text-lamazi-ink/80'
                }`
              }
              data-testid={`mobile-nav-${l.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
