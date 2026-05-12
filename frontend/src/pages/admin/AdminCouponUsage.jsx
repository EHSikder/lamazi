import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function AdminCouponUsage() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api.get('/admin/coupon-usage').then(({ data }) => setRows(data || []));
  }, []);

  const total = rows.length;
  const active = rows.filter((r) => r.status === 'active').length;
  const reached = rows.filter((r) => r.usage_limit && r.total_uses >= r.usage_limit).length;

  return (
    <div data-testid="admin-coupon-usage">
      <h1 className="font-display text-3xl text-lamazi-primary font-bold mb-1">Coupon Usage</h1>
      <p className="text-sm text-lamazi-muted mb-6">How well are your discount codes performing?</p>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Stat label="Total coupons" value={total} />
        <Stat label="Active" value={active} accent="bg-emerald-600" />
        <Stat label="Limit reached" value={reached} accent="bg-rose-600" />
      </div>

      <div className="space-y-3">
        {rows.map((r) => {
          const limited = Boolean(r.usage_limit);
          const pct = limited ? Math.min(100, (r.total_uses / r.usage_limit) * 100) : 0;
          return (
            <div key={r.id} className="bg-white rounded-2xl border border-lamazi-secondary/40 p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-mono font-semibold text-lamazi-primary">{r.code}</p>
                  <p className="text-xs text-lamazi-muted">{r.discount_type === 'percent' ? `${r.discount_value}% off` : `${r.discount_value} KWD off`}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-lamazi-muted">Used by</p>
                  <p className="font-semibold">{r.unique_customers} customer{r.unique_customers !== 1 ? 's' : ''}</p>
                </div>
              </div>
              {limited ? (
                <>
                  <div className="h-2 rounded-full bg-lamazi-secondary/30 overflow-hidden mb-1">
                    <div className="h-full bg-lamazi-primary transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-lamazi-muted">{r.total_uses} / {r.usage_limit} used · {Math.max(0, r.usage_limit - r.total_uses)} remaining</p>
                </>
              ) : (
                <p className="text-xs text-lamazi-muted">{r.total_uses} total uses · unlimited</p>
              )}
            </div>
          );
        })}
        {rows.length === 0 && <p className="text-center text-lamazi-muted py-12">No coupons yet.</p>}
      </div>
    </div>
  );
}

function Stat({ label, value, accent = 'bg-lamazi-primary' }) {
  return (
    <div className="bg-white rounded-2xl border border-lamazi-secondary/40 p-5">
      <div className={`w-2 h-10 rounded-full ${accent} mb-3`} />
      <p className="text-xs uppercase tracking-widest text-lamazi-muted">{label}</p>
      <p className="font-display text-3xl font-bold text-lamazi-primary">{value}</p>
    </div>
  );
}
