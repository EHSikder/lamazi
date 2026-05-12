import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Instagram, Facebook, MessageCircle } from 'lucide-react';

export default function Footer() {
  const loc = useLocation();
  if (loc.pathname.startsWith('/admin')) return null;

  return (
    <footer className="mt-20 bg-lamazi-tertiary text-lamazi-neutral">
      <div className="container-lamazi py-12 grid gap-10 md:grid-cols-3">
        <div className="space-y-3">
          <div className="brand-wordmark text-lamazi-secondary">LAMAZI</div>
          <p className="text-sm text-lamazi-neutral/70 max-w-sm leading-relaxed">
            Hand-crafted cakes and Arabic sweets, baked fresh daily in Hawally. Bringing
            generations of recipes into every box we deliver.
          </p>
        </div>

        <nav className="grid grid-cols-2 gap-4 text-sm">
          <Link to="/menu" className="hover:text-lamazi-secondary transition-colors" data-testid="footer-menu">Menu</Link>
          <Link to="/about" className="hover:text-lamazi-secondary transition-colors" data-testid="footer-about">About Us</Link>
          <Link to="/loyalty" className="hover:text-lamazi-secondary transition-colors" data-testid="footer-loyalty">Loyalty Program</Link>
          <Link to="/auth" className="hover:text-lamazi-secondary transition-colors" data-testid="footer-account">Account</Link>
          <span className="hover:text-lamazi-secondary cursor-pointer transition-colors">Terms & Conditions</span>
          <span className="hover:text-lamazi-secondary cursor-pointer transition-colors">Privacy Policy</span>
        </nav>

        <div className="space-y-4">
          <p className="text-sm font-medium uppercase tracking-widest text-lamazi-secondary">
            Stay close
          </p>
          <div className="flex gap-3">
            <a href="#" aria-label="Instagram" className="p-2.5 rounded-full bg-lamazi-primary/40 hover:bg-lamazi-secondary hover:text-lamazi-primary transition-colors">
              <Instagram className="w-4 h-4" />
            </a>
            <a href="#" aria-label="Facebook" className="p-2.5 rounded-full bg-lamazi-primary/40 hover:bg-lamazi-secondary hover:text-lamazi-primary transition-colors">
              <Facebook className="w-4 h-4" />
            </a>
            <a href="#" aria-label="WhatsApp" className="p-2.5 rounded-full bg-lamazi-primary/40 hover:bg-lamazi-secondary hover:text-lamazi-primary transition-colors">
              <MessageCircle className="w-4 h-4" />
            </a>
          </div>
          <p className="text-xs text-lamazi-neutral/60">Hawally, Kuwait · Open daily 1:00 PM – 12:30 AM</p>
        </div>
      </div>
      <div className="border-t border-lamazi-neutral/10">
        <div className="container-lamazi py-5 text-xs text-lamazi-neutral/60 flex flex-col sm:flex-row gap-2 justify-between">
          <span>© {new Date().getFullYear()} LAMAZI Sweets. All rights reserved.</span>
          <span>Crafted with care in Kuwait.</span>
        </div>
      </div>
    </footer>
  );
}
