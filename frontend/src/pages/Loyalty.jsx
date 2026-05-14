import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiError } from '@/lib/api';
import { ShoppingBag, Gift, Sparkles, ChevronRight } from 'lucide-react';

export default function Loyalty() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/loyalty/settings')
      .then(({ data }) => setSettings(data))
      .catch((e) => console.error(apiError(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="container-lamazi py-20 text-center text-lamazi-muted">Loading loyalty program…</div>;
  }

  if (!settings?.enabled) {
    return (
      <div className="container-lamazi py-20 text-center" data-testid="loyalty-disabled">
        <h1 className="font-display text-4xl text-lamazi-primary mb-4">Loyalty Program</h1>
        <div className="cream-card max-w-lg mx-auto">
          <Sparkles className="w-10 h-10 text-lamazi-primary mx-auto mb-3" />
          <p className="text-lamazi-ink/80">Our loyalty program is currently unavailable. Please check back soon — we have something sweet planned.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-lamazi py-12 space-y-16" data-testid="loyalty-page">
      <div className="text-center max-w-2xl mx-auto">
        <p className="font-script text-3xl text-lamazi-secondary-deep -mb-1">Sweet rewards</p>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-lamazi-primary">Our Loyalty Program</h1>
        <p className="section-subtitle mt-3">Every cake brings you closer to the next one. Free to join — you start earning from your very first order.</p>
      </div>

      {/* Join the club banner */}
      <div className="rounded-3xl bg-gradient-to-br from-lamazi-tertiary to-lamazi-primary text-lamazi-neutral p-8 sm:p-12 flex flex-col sm:flex-row items-center gap-6">
        <div className="flex-1">
          <p className="font-script text-3xl text-lamazi-secondary -mb-1">Welcome aboard</p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold">Join the <span className="brand-wordmark-light text-2xl sm:text-3xl">LAMAZI</span> Club</h2>
          <p className="text-sm text-lamazi-neutral/80 mt-2 max-w-md">
            Create your account in seconds and start collecting points instantly.
          </p>
        </div>
        <Link to="/auth" className="btn-gold whitespace-nowrap" data-testid="loyalty-signup-btn">
          Sign Up <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* How it works */}
      <section data-testid="loyalty-how">
        <div className="text-center mb-10">
          <p className="font-script text-3xl text-lamazi-secondary-deep -mb-1">It's this easy</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-lamazi-primary">How It Works</h2>
          <p className="section-subtitle mt-3">Three steps from order to reward — no apps to download, no cards to carry.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: ShoppingBag, title: 'Order anything', desc: 'Browse the menu and place an order while signed in. Online or cash — both count.' },
            { icon: Sparkles, title: 'Earn points', desc: `Get ${settings.points_per_kwd} point${settings.points_per_kwd !== 1 ? 's' : ''} for every KWD spent. Points land in your account after delivery.` },
            { icon: Gift, title: 'Redeem on us', desc: 'Apply your points at checkout for instant savings on your next sweet treat.' },
          ].map((s, i) => (
            <div key={s.title} className="cream-card text-center">
              <div className="w-14 h-14 rounded-full bg-lamazi-primary text-lamazi-secondary flex items-center justify-center mx-auto mb-4">
                <s.icon className="w-6 h-6" />
              </div>
              <span className="inline-block text-xs uppercase tracking-widest text-lamazi-secondary-deep mb-1">Step {i + 1}</span>
              <h3 className="font-display text-xl text-lamazi-primary font-semibold mb-2">{s.title}</h3>
              <p className="text-sm text-lamazi-muted leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Points value */}
      <section data-testid="loyalty-points-value">
        <div className="cream-card max-w-4xl mx-auto">
          <h3 className="font-display text-2xl text-lamazi-primary font-semibold text-center mb-6">Points Value</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-xs uppercase tracking-widest text-lamazi-muted mb-1">Earning Rate</p>
              <p className="font-display text-3xl text-lamazi-primary font-bold">{settings.points_per_kwd}</p>
              <p className="text-xs text-lamazi-muted">points per 1 KWD</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-lamazi-muted mb-1">Redemption Value</p>
              <p className="font-display text-3xl text-lamazi-primary font-bold">{Number(settings.redemption_rate).toFixed(3)}</p>
              <p className="text-xs text-lamazi-muted">KWD per point</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-lamazi-muted mb-1">Min Order to Earn</p>
              <p className="font-display text-3xl text-lamazi-primary font-bold">{Number(settings.min_order_amount).toFixed(3)}</p>
              <p className="text-xs text-lamazi-muted">KWD</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
