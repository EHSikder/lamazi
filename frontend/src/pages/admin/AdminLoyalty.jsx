import React, { useEffect, useState } from 'react';
import { api, apiError } from '@/lib/api';
import { toast } from 'sonner';

export default function AdminLoyalty() {
  const [f, setF] = useState(null);
  useEffect(() => { api.get('/admin/loyalty').then(({ data }) => setF(data)); }, []);

  if (!f) return <p className="text-lamazi-muted">Loading…</p>;

  const save = async () => {
    try {
      await api.post('/admin/loyalty', f);
      toast.success('Saved');
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div className="max-w-2xl" data-testid="admin-loyalty">
      <h1 className="font-display text-3xl text-lamazi-primary font-bold mb-1">Loyalty Program</h1>
      <p className="text-sm text-lamazi-muted mb-6">Reward customers for every dinar spent.</p>

      <div className="bg-white rounded-2xl border border-lamazi-secondary/40 p-6">
        <label className="flex items-center justify-between mb-6">
          <div>
            <p className="font-medium">Enable loyalty program</p>
            <p className="text-xs text-lamazi-muted">When disabled, the /loyalty page shows an "unavailable" message.</p>
          </div>
          <Toggle checked={f.enabled} onChange={(v) => setF({ ...f, enabled: v })} />
        </label>

        <h3 className="font-display text-lg text-lamazi-primary mb-3">Earning</h3>
        <Row label="Points per 1 KWD" type="number" step="0.1" value={f.points_per_kwd} onChange={(v) => setF({ ...f, points_per_kwd: Number(v) })} />
        <Row label="Min order to earn (KWD)" type="number" step="0.001" value={f.min_order_amount} onChange={(v) => setF({ ...f, min_order_amount: Number(v) })} />

        <h3 className="font-display text-lg text-lamazi-primary mt-6 mb-3">Redeeming</h3>
        <Row label="Redemption rate (KWD per point)" type="number" step="0.001" value={f.redemption_rate} onChange={(v) => setF({ ...f, redemption_rate: Number(v) })} />
        <Row label="Min points to redeem" type="number" value={f.min_points_to_redeem} onChange={(v) => setF({ ...f, min_points_to_redeem: Number(v) })} />
        <Row label="Max redemption per order (% of total)" type="number" value={f.max_redemption_percent} onChange={(v) => setF({ ...f, max_redemption_percent: Number(v) })} />

        <button onClick={save} className="btn-primary mt-6 w-full">Save changes</button>
      </div>
    </div>
  );
}

function Row({ label, value, onChange, type = 'text', step }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-lamazi-secondary/20 last:border-0">
      <label className="text-sm text-lamazi-ink/90">{label}</label>
      <input type={type} step={step} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="w-32 px-3 py-1.5 rounded-lg border border-lamazi-secondary/60 bg-white text-sm text-right" />
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button onClick={() => onChange(!checked)} className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-lamazi-primary' : 'bg-lamazi-secondary/60'}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transform transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}
