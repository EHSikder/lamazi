import React, { useEffect, useState } from 'react';
import { api, apiError } from '@/lib/api';
import { toast } from 'sonner';

export default function AdminSettings() {
  const [tab, setTab] = useState('ordering');
  const [f, setF] = useState(null);

  useEffect(() => { api.get('/admin/settings').then(({ data }) => setF(data)); }, []);

  if (!f) return <p className="text-lamazi-muted">Loading…</p>;

  const save = async () => {
    if (!f.cod_enabled && !f.online_enabled) {
      toast.error('At least one payment method must remain enabled');
      return;
    }
    try {
      await api.post('/admin/settings', f);
      toast.success('Saved');
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div className="max-w-2xl" data-testid="admin-settings">
      <h1 className="font-display text-3xl text-lamazi-primary font-bold mb-1">Settings</h1>
      <p className="text-sm text-lamazi-muted mb-6">Defaults that apply when no zone matches at checkout.</p>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('ordering')} className={`px-4 py-2 rounded-full text-xs font-medium ${tab === 'ordering' ? 'bg-lamazi-primary text-lamazi-neutral' : 'bg-white border border-lamazi-secondary/60 text-lamazi-primary'}`}>Ordering</button>
        <button onClick={() => setTab('payment')} className={`px-4 py-2 rounded-full text-xs font-medium ${tab === 'payment' ? 'bg-lamazi-primary text-lamazi-neutral' : 'bg-white border border-lamazi-secondary/60 text-lamazi-primary'}`}>Payment methods</button>
      </div>

      <div className="bg-white rounded-2xl border border-lamazi-secondary/40 p-6 space-y-4">
        {tab === 'ordering' ? (
          <>
            <Row label="Minimum order amount (KWD)" type="number" step="0.001" value={f.min_order_amount} onChange={(v) => setF({ ...f, min_order_amount: Number(v) })} />
            <Row label="Default delivery fee (KWD)" type="number" step="0.001" value={f.delivery_fee} onChange={(v) => setF({ ...f, delivery_fee: Number(v) })} />
          </>
        ) : (
          <>
            <ToggleRow label="Cash on Delivery" value={f.cod_enabled} onChange={(v) => setF({ ...f, cod_enabled: v })} />
            <ToggleRow label="Online payment (Tap Payments)" value={f.online_enabled} onChange={(v) => setF({ ...f, online_enabled: v })} />
            {!f.cod_enabled && !f.online_enabled && (
              <p className="text-xs text-rose-700">⚠ At least one payment method must remain enabled.</p>
            )}
          </>
        )}
        <button onClick={save} className="btn-primary mt-2 w-full">Save</button>
      </div>
    </div>
  );
}

function Row({ label, value, onChange, type = 'text', step }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-lamazi-secondary/20 last:border-0">
      <label className="text-sm text-lamazi-ink/90">{label}</label>
      <input type={type} step={step} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="w-32 px-3 py-1.5 rounded-lg border border-lamazi-secondary/60 bg-white text-sm text-right" />
    </div>
  );
}

function ToggleRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-lamazi-secondary/20 last:border-0">
      <label className="text-sm text-lamazi-ink/90">{label}</label>
      <button onClick={() => onChange(!value)} className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-lamazi-primary' : 'bg-lamazi-secondary/60'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transform transition-transform ${value ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}
