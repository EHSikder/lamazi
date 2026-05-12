import React, { useEffect, useState, useRef, useCallback } from 'react';
import { api, apiError } from '@/lib/api';
import { supabase, TENANT_ID, BRANCH_ID } from '@/lib/supabase';
import { toast } from 'sonner';
import { Check, X, Eye, BellRing, Volume2, VolumeX } from 'lucide-react';
import { fmtKWD } from '@/lib/utils-app';

const STATUS_BADGES = {
  pending: 'bg-amber-100 text-amber-800',
  accepted: 'bg-blue-100 text-blue-800',
  preparing: 'bg-blue-100 text-blue-800',
  packing: 'bg-blue-100 text-blue-800',
  out_for_delivery: 'bg-violet-100 text-violet-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-800',
  cancelled: 'bg-rose-100 text-rose-800',
};

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [hasNew, setHasNew] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const audioCtxRef = useRef(null);
  const oscRef = useRef(null);

  // load orders
  const load = useCallback(() => {
    setLoading(true);
    api.get('/admin/orders')
      .then(({ data }) => setOrders(data || []))
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // realtime: detect new orders
  useEffect(() => {
    const channel = supabase.channel('admin-orders')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'orders',
        filter: `tenant_id=eq.${TENANT_ID}`,
      }, (payload) => {
        const o = payload.new;
        if (o.branch_id !== BRANCH_ID) return;
        if (o.payment_status === 'payment_pending') return;   // not yet paid
        setOrders((prev) => prev.some((p) => p.id === o.id) ? prev : [o, ...prev]);
        setHasNew(true);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `tenant_id=eq.${TENANT_ID}`,
      }, (payload) => {
        const o = payload.new;
        if (o.branch_id !== BRANCH_ID) return;
        setOrders((prev) => {
          const exists = prev.some((p) => p.id === o.id);
          if (exists) return prev.map((p) => p.id === o.id ? { ...p, ...o } : p);
          if (o.payment_status !== 'payment_pending') return [o, ...prev];
          return prev;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // looping alert sound via Web Audio
  useEffect(() => {
    if (!hasNew || !soundOn) {
      stopBeep();
      return;
    }
    startBeep();
    return stopBeep;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasNew, soundOn]);

  const startBeep = () => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtxRef.current;
      stopBeep();
      const intervalFn = () => {
        if (!hasNew) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.02);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      };
      intervalFn();
      oscRef.current = setInterval(intervalFn, 1500);
    } catch (e) {
      console.warn('audio error', e);
    }
  };

  const stopBeep = () => {
    if (oscRef.current) clearInterval(oscRef.current);
    oscRef.current = null;
  };

  const accept = async (o) => {
    try {
      const { data } = await api.patch(`/admin/orders/${o.id}/status`, { status: 'accepted' });
      setHasNew(false);
      toast.success('Order accepted' + (data?.armada?.armada_code ? ` · Armada ${data.armada.armada_code}` : ''));
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const reject = async (o) => {
    if (!window.confirm(`Reject order #${o.order_number}?`)) return;
    try {
      await api.patch(`/admin/orders/${o.id}/status`, { status: 'rejected' });
      setHasNew(false);
      toast.success('Order rejected');
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const filtered = filter === 'all' ? orders : orders.filter((o) => o.status === filter);
  const pendingCount = orders.filter((o) => o.status === 'pending').length;

  return (
    <div data-testid="admin-orders">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl text-lamazi-primary font-bold">Orders</h1>
          <p className="text-sm text-lamazi-muted">Live feed from Supabase Realtime. New orders trigger an alert.</p>
        </div>
        <div className="flex gap-2 items-center">
          {hasNew && (
            <button onClick={() => setHasNew(false)} className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500 text-white animate-pulse-ring text-sm">
              <BellRing className="w-4 h-4" /> New order!
            </button>
          )}
          <button onClick={() => setSoundOn((s) => !s)} className="p-2 rounded-full bg-white border border-lamazi-secondary/60" title={soundOn ? 'Mute alerts' : 'Enable alerts'} data-testid="admin-orders-sound-toggle">
            {soundOn ? <Volume2 className="w-4 h-4 text-lamazi-primary" /> : <VolumeX className="w-4 h-4 text-lamazi-muted" />}
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
        {[
          { v: 'all', label: `All (${orders.length})` },
          { v: 'pending', label: `Pending (${pendingCount})` },
          { v: 'accepted', label: 'Accepted' },
          { v: 'preparing', label: 'Preparing' },
          { v: 'out_for_delivery', label: 'Out for delivery' },
          { v: 'delivered', label: 'Delivered' },
          { v: 'rejected', label: 'Rejected' },
        ].map((f) => (
          <button
            key={f.v}
            onClick={() => setFilter(f.v)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f.v ? 'bg-lamazi-primary text-lamazi-neutral' : 'bg-white border border-lamazi-secondary/60 text-lamazi-primary'
            }`}
            data-testid={`admin-orders-filter-${f.v}`}
          >{f.label}</button>
        ))}
      </div>

      {loading ? <p className="text-lamazi-muted">Loading…</p> : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-lamazi-secondary/40 p-12 text-center text-lamazi-muted">No orders yet.</div>
      ) : (
        <div className="bg-white rounded-2xl border border-lamazi-secondary/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-lamazi-secondary/30 text-xs uppercase tracking-widest text-lamazi-muted">
              <tr>
                <th className="text-left px-4 py-3">Order #</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Customer</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Time</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lamazi-secondary/40">
              {filtered.map((o) => (
                <tr key={o.id} className="hover:bg-lamazi-secondary/10" data-testid={`order-row-${o.id}`}>
                  <td className="px-4 py-3 font-medium text-lamazi-primary">#{o.order_number || o.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 hidden md:table-cell">{o.customer_name}<br /><span className="text-xs text-lamazi-muted">{o.customer_phone}</span></td>
                  <td className="px-4 py-3 text-lamazi-muted hidden sm:table-cell">{new Date(o.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs capitalize">{o.order_type}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_BADGES[o.status] || 'bg-gray-100 text-gray-700'}`}>{o.status}</span></td>
                  <td className="px-4 py-3 text-right font-semibold">{fmtKWD(o.total_amount)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      {o.status === 'pending' && (
                        <>
                          <button onClick={() => accept(o)} className="p-1.5 rounded-full bg-emerald-100 hover:bg-emerald-200" title="Accept" data-testid={`accept-${o.id}`}>
                            <Check className="w-4 h-4 text-emerald-700" />
                          </button>
                          <button onClick={() => reject(o)} className="p-1.5 rounded-full bg-rose-100 hover:bg-rose-200" title="Reject" data-testid={`reject-${o.id}`}>
                            <X className="w-4 h-4 text-rose-700" />
                          </button>
                        </>
                      )}
                      <button onClick={() => setOpenId(o.id)} className="p-1.5 rounded-full bg-lamazi-secondary/30 hover:bg-lamazi-secondary/60" title="Details">
                        <Eye className="w-4 h-4 text-lamazi-primary" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openId && <OrderDetailDrawer id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}

function OrderDetailDrawer({ id, onClose, onChanged }) {
  const [order, setOrder] = useState(null);

  useEffect(() => {
    api.get(`/orders/${id}`).then(({ data }) => setOrder(data));
  }, [id]);

  const setStatus = async (s) => {
    try {
      await api.patch(`/admin/orders/${id}/status`, { status: s });
      toast.success('Status updated');
      onChanged?.();
      const { data } = await api.get(`/orders/${id}`);
      setOrder(data);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  if (!order) return null;
  const nextStatuses = ['accepted', 'preparing', 'packing', 'out_for_delivery', 'delivered', 'rejected'];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="bg-lamazi-neutral w-full max-w-md h-full overflow-y-auto shadow-2xl">
        <div className="p-5 border-b border-lamazi-secondary/40 flex items-center justify-between">
          <div>
            <h3 className="font-display text-xl text-lamazi-primary">#{order.order_number}</h3>
            <p className="text-xs text-lamazi-muted">{new Date(order.created_at).toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-lamazi-secondary/40"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4 text-sm">
          <div>
            <p className="text-xs uppercase tracking-widest text-lamazi-muted">Customer</p>
            <p className="font-medium">{order.customer_name}</p>
            <p className="text-lamazi-muted">{order.customer_phone}</p>
            {order.customer_email && <p className="text-lamazi-muted text-xs">{order.customer_email}</p>}
          </div>
          {order.delivery_address && (
            <div>
              <p className="text-xs uppercase tracking-widest text-lamazi-muted">Address</p>
              <p className="text-xs">{Object.entries(order.delivery_address).filter(([k, v]) => v && !['geo_lat', 'geo_lng'].includes(k)).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>
            </div>
          )}
          <div>
            <p className="text-xs uppercase tracking-widest text-lamazi-muted">Items</p>
            <div className="divide-y divide-lamazi-secondary/40">
              {(order.items || []).map((it) => (
                <div key={it.id} className="py-2">
                  <p className="font-medium">{it.quantity} × {it.item_name_en}</p>
                  {(it.modifiers || []).length > 0 && <p className="text-xs text-lamazi-muted">+ {it.modifiers.map((m) => m.modifier_name_en).join(', ')}</p>}
                  {it.notes && <p className="text-xs italic text-lamazi-muted">"{it.notes}"</p>}
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-lamazi-secondary/40 pt-3 space-y-1">
            <div className="flex justify-between"><span className="text-lamazi-muted">Subtotal</span><span>{fmtKWD(order.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-lamazi-muted">Delivery</span><span>{fmtKWD(order.delivery_fee)}</span></div>
            <div className="flex justify-between"><span className="text-lamazi-muted">Discount</span><span>{fmtKWD(order.discount_amount)}</span></div>
            <div className="flex justify-between font-semibold text-base"><span>Total</span><span className="text-lamazi-primary">{fmtKWD(order.total_amount)}</span></div>
            <p className="text-xs text-lamazi-muted">Payment: {order.payment_status}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-lamazi-muted mb-2">Update status</p>
            <div className="flex flex-wrap gap-2">
              {nextStatuses.map((s) => (
                <button key={s} onClick={() => setStatus(s)} className="px-3 py-1.5 rounded-full text-xs bg-white border border-lamazi-secondary/60 hover:border-lamazi-primary">{s}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
