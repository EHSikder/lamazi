import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Minus, Trash2, Tag, ArrowLeft, Sparkles } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { api, apiError } from '@/lib/api';
import { fmtKWD, getGuestId } from '@/lib/utils-app';
import { toast } from 'sonner';

export default function Bag() {
  const navigate = useNavigate();
  const { items, subtotal, updateQty, removeItem, lineKey } = useCart();
  const { user, profile, refreshProfile } = useAuth();

  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null); // {code, discount_amount}
  const [applying, setApplying] = useState(false);

  const [loyalty, setLoyalty] = useState({ enabled: false });
  const [settings, setSettings] = useState({ delivery_fee: 0, min_order_amount: 0 });
  const [pointsToRedeem, setPointsToRedeem] = useState(0);

  useEffect(() => {
    api.get('/loyalty/settings').then(({ data }) => setLoyalty(data));
    api.get('/settings').then(({ data }) => setSettings(data));
    if (user?.id) refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setApplying(true);
    try {
      const { data } = await api.post('/coupons/validate', {
        code: couponCode.trim(),
        subtotal,
        customer_id: user?.id || null,
        guest_id: user ? null : getGuestId(),
      });
      setAppliedCoupon({ code: data.code, discount_amount: data.discount_amount });
      toast.success(`Coupon applied: −${fmtKWD(data.discount_amount)}`);
    } catch (e) {
      toast.error(apiError(e, 'Invalid coupon'));
      setAppliedCoupon(null);
    } finally {
      setApplying(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
  };

  const availablePoints = Number(profile?.loyalty_points || 0);
  const maxRedeemKwd = useMemo(() => {
    if (!loyalty.enabled || !user) return 0;
    const capPct = Number(loyalty.max_redemption_percent || 0) / 100;
    return subtotal * capPct;
  }, [loyalty, subtotal, user]);

  const maxRedeemablePoints = useMemo(() => {
    if (!loyalty.enabled || !user) return 0;
    const rate = Number(loyalty.redemption_rate || 0);
    if (rate <= 0) return 0;
    return Math.min(availablePoints, Math.floor(maxRedeemKwd / rate));
  }, [loyalty, availablePoints, maxRedeemKwd, user]);

  const loyaltyDiscount = useMemo(() => {
    return Math.min(pointsToRedeem, maxRedeemablePoints) * Number(loyalty.redemption_rate || 0);
  }, [pointsToRedeem, maxRedeemablePoints, loyalty]);

  const couponDiscount = appliedCoupon?.discount_amount || 0;
  const deliveryFee = Number(settings.delivery_fee || 0);
  const total = Math.max(0, subtotal - couponDiscount - loyaltyDiscount + deliveryFee);

  const proceed = () => {
    if (items.length === 0) return;
    sessionStorage.setItem('lamazi_checkout_state', JSON.stringify({
      coupon: appliedCoupon,
      points_used: Math.min(pointsToRedeem, maxRedeemablePoints),
      loyalty_discount: loyaltyDiscount,
    }));
    navigate('/checkout');
  };

  if (items.length === 0) {
    return (
      <div className="container-lamazi py-16 sm:py-24 text-center" data-testid="bag-empty">
        <Sparkles className="w-12 h-12 text-lamazi-primary mx-auto mb-4" />
        <h1 className="font-display text-3xl text-lamazi-primary mb-2">Your bag is empty</h1>
        <p className="text-lamazi-muted mb-6">Time to add something sweet.</p>
        <Link to="/menu" className="btn-primary">Browse the Menu</Link>
      </div>
    );
  }

  return (
    <div className="container-lamazi py-10" data-testid="bag-page">
      <Link to="/menu" className="inline-flex items-center gap-2 text-sm text-lamazi-primary hover:underline mb-4" data-testid="bag-continue-shopping">
        <ArrowLeft className="w-4 h-4" /> Continue shopping
      </Link>
      <h1 className="font-display text-3xl sm:text-4xl font-bold text-lamazi-primary mb-1">Your Bag</h1>
      <p className="text-sm text-lamazi-muted mb-8">{items.length} item{items.length !== 1 ? 's' : ''}</p>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* items */}
        <div className="lg:col-span-2 space-y-4" data-testid="bag-items">
          {items.map((it) => {
            const key = lineKey(it);
            return (
              <div key={key} data-testid="bag-item-row" className="bg-white rounded-2xl border border-lamazi-secondary/40 p-4 flex gap-4">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-lamazi-secondary/30 overflow-hidden shrink-0">
                  {it.image_url && <img src={it.image_url} alt={it.item_name_en} className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display text-lg text-lamazi-primary leading-tight">{it.item_name_ar && document.documentElement.lang === 'ar' ? it.item_name_ar : it.item_name_en}</h3>
                    {it.variant_name_en && <p className="text-xs text-lamazi-muted">{it.variant_name_ar && document.documentElement.lang === 'ar' ? it.variant_name_ar : it.variant_name_en}</p>}
                      {(it.modifiers || []).length > 0 && (
                        <p className="text-xs text-lamazi-muted mt-1">
                          + {it.modifiers.map((m) => `${m.name_en}${m.quantity > 1 ? ` ×${m.quantity}` : ''}`).join(', ')}
                        </p>
                      )}
                      {it.notes && <p className="text-xs italic text-lamazi-muted mt-1">"{it.notes}"</p>}
                    </div>
                    <button onClick={() => removeItem(key)} className="p-2 hover:bg-lamazi-secondary/30 rounded-full" data-testid={`remove-${key}`}>
                      <Trash2 className="w-4 h-4 text-lamazi-primary" />
                    </button>
                  </div>
                  <div className="flex items-end justify-between mt-auto pt-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-lamazi-secondary/30">
                      <button onClick={() => updateQty(key, it.quantity - 1)} className="p-0.5" data-testid={`qty-minus-${key}`}>
                        <Minus className="w-3.5 h-3.5 text-lamazi-primary" />
                      </button>
                      <span className="min-w-[20px] text-center text-sm font-semibold">{it.quantity}</span>
                      <button onClick={() => updateQty(key, it.quantity + 1)} className="p-0.5" data-testid={`qty-plus-${key}`}>
                        <Plus className="w-3.5 h-3.5 text-lamazi-primary" />
                      </button>
                    </div>
                    <p className="text-lg font-semibold text-lamazi-primary">{fmtKWD(it.total_price)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* summary */}
        <aside className="space-y-4">
          <div className="cream-card sticky top-24" data-testid="bag-summary">
            <h3 className="font-display text-xl text-lamazi-primary font-semibold mb-4">Summary</h3>

            <div className="space-y-3 mb-4 text-sm">
              <div className="flex justify-between">
                <span className="text-lamazi-muted">Subtotal</span>
                <span className="font-medium" data-testid="bag-subtotal">{fmtKWD(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-lamazi-muted">Delivery (default)</span>
                <span className="font-medium">{fmtKWD(deliveryFee)}</span>
              </div>
              {couponDiscount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Coupon ({appliedCoupon.code})</span>
                  <span>− {fmtKWD(couponDiscount)}</span>
                </div>
              )}
              {loyaltyDiscount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Loyalty points</span>
                  <span>− {fmtKWD(loyaltyDiscount)}</span>
                </div>
              )}
            </div>

            {/* coupon */}
            <div className="mb-4">
              <p className="text-xs uppercase tracking-widest text-lamazi-muted mb-2">Coupon</p>
              {appliedCoupon ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-sm font-medium text-emerald-800">{appliedCoupon.code}</span>
                  <button onClick={removeCoupon} className="text-xs text-emerald-700 hover:underline" data-testid="bag-coupon-remove">Remove</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Type coupon code"
                    className="flex-1 px-3 py-2.5 rounded-full bg-white border border-lamazi-secondary/60 text-sm focus:outline-none focus:border-lamazi-primary"
                    data-testid="bag-coupon-input"
                  />
                  <button onClick={applyCoupon} disabled={applying} className="btn-primary py-2.5 px-5 text-sm" data-testid="bag-coupon-apply">
                    <Tag className="w-3.5 h-3.5" /> Apply
                  </button>
                </div>
              )}
            </div>

            {/* loyalty */}
            {loyalty.enabled && user && maxRedeemablePoints > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs uppercase tracking-widest text-lamazi-muted">Redeem Points</p>
                  <span className="text-xs text-lamazi-muted">{availablePoints} available</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    max={maxRedeemablePoints}
                    value={pointsToRedeem || ''}
                    onChange={(e) => setPointsToRedeem(Math.max(0, Math.min(maxRedeemablePoints, Number(e.target.value) || 0)))}
                    placeholder={`Up to ${maxRedeemablePoints}`}
                    className="flex-1 px-3 py-2.5 rounded-full bg-white border border-lamazi-secondary/60 text-sm focus:outline-none focus:border-lamazi-primary"
                    data-testid="bag-points-input"
                  />
                  <button
                    onClick={() => setPointsToRedeem(maxRedeemablePoints)}
                    className="btn-gold py-2.5 px-4 text-sm"
                    data-testid="bag-points-max"
                  >
                    Use Max
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-between items-baseline border-t border-lamazi-secondary/60 pt-4 mb-5">
              <span className="text-lamazi-ink font-semibold">Total</span>
              <span className="font-display text-2xl font-bold text-lamazi-primary" data-testid="bag-total">{fmtKWD(total)}</span>
            </div>

            {settings.min_order_amount > 0 && subtotal < Number(settings.min_order_amount) && (
              <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-300 flex items-start gap-2" data-testid="bag-min-order-warning">
                <span className="text-amber-700 text-base">⚠</span>
                <p className="text-sm text-amber-900">
                  Minimum order amount is <span className="font-semibold">{fmtKWD(settings.min_order_amount)}</span>.
                  Add <span className="font-semibold">{fmtKWD(Number(settings.min_order_amount) - subtotal)}</span> more to proceed.
                </p>
              </div>
            )}

            <button
              onClick={proceed}
              disabled={settings.min_order_amount > 0 && subtotal < Number(settings.min_order_amount)}
              className="btn-primary w-full"
              data-testid="bag-checkout-btn"
            >
              Proceed to Checkout
            </button>
            <p className="text-[11px] text-lamazi-muted text-center mt-2">
              Final delivery fee calculated at checkout based on your area.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
