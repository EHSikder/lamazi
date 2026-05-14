import React, { useEffect, useState, useRef, useCallback } from 'react';
import { api, apiError } from '@/lib/api';
import { supabase, TENANT_ID, BRANCH_ID } from '@/lib/supabase';
import { toast } from 'sonner';
import { Check, X, Eye, BellRing, Volume2, VolumeX, Phone, Package, CheckCircle2, Truck } from 'lucide-react';
import { fmtKWD } from '@/lib/utils-app';

const STATUS_BADGES = {
  pending: 'bg-amber-100 text-amber-900 border-amber-300',
  accepted: 'bg-blue-100 text-blue-900 border-blue-300',
  preparing: 'bg-blue-100 text-blue-900 border-blue-300',
  packing: 'bg-blue-100 text-blue-900 border-blue-300',
  ready: 'bg-violet-100 text-violet-900 border-violet-300',
  out_for_delivery: 'bg-violet-100 text-violet-900 border-violet-300',
  delivered: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  rejected: 'bg-rose-100 text-rose-900 border-rose-300',
  cancelled: 'bg-rose-100 text-rose-900 border-rose-300',
};

function hasArmadaCode(order) {
  return Boolean(order?.notes && /armada_code:/.test(order.notes));
}

function getArmadaCode(order) {
  const m = order?.notes && order.notes.match(/armada_code:([\w-]+)/);
  return m ? m[1] : null;
}

function extractTxId(order) {
  return order?.transaction_id || (order?.notes && (order.notes.match(/tap_id:([\w-]+)/) || [])[1]) || null;
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [hasNew, setHasNew] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const audioCtxRef = useRef(null);
  const oscRef = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/admin/orders')
      .then(({ data }) => setOrders(data || []))
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase.channel('admin-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `tenant_id=eq.${TENANT_ID}` }, (payload) => {
        const o = payload.new;
        if (o.branch_id !== BRANCH_ID) return;
        if (o.payment_status === 'payment_pending') return;
        setOrders((prev) => prev.some((p) => p.id === o.id) ? prev : [o, ...prev]);
        setHasNew(true);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `tenant_id=eq.${TENANT_ID}` }, (payload) => {
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

  useEffect(() => {
    const anyPending = orders.some((o) => o.status === 'pending');
    if (!anyPending || !soundOn) { stopBeep(); return; }
    if (!hasNew) return;
    startBeep();
    return stopBeep;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasNew, soundOn, orders]);

  const startBeep = () => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtxRef.current;
      stopBeep();
      const intervalFn = () => {
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
    } catch { /* noop */ }
  };

  const stopBeep = () => {
    if (oscRef.current) { clearInterval(oscRef.current); oscRef.current = null; }
  };

  const setStatus = async (orderId, status) => {
    try {
      await api.patch(`/admin/orders/${orderId}/status`, { status });
      if (status === 'accepted' || status === 'rejected') setHasNew(false);
      toast.success(`Order ${status}`);
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const reject = async (o) => {
    const reason = window.prompt(`Reject order #${o.order_number}? Optional reason:`);
    if (reason === null) return;
    try {
      await api.patch(`/admin/orders/${o.id}/status`, { status: 'rejected', notes: reason || null });
      setHasNew(false);
      toast.success('Order rejected');
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const callDriver = async (o) => {
    try {
      const { data } = await api.post(`/admin/orders/${o.id}/dispatch-driver`);
      toast.success(data.already_dispatched ? 'Driver already called' : `Driver called — Armada ${data.armada_code}`);
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const filtered = filter === 'all' ? orders : orders.filter((o) => {
    if (filter === 'active') return ['accepted', 'preparing', 'packing', 'ready', 'out_for_delivery'].includes(o.status);
    return o.status === filter;
  });
  const counts = {
    pending: orders.filter((o) => o.status === 'pending').length,
    active: orders.filter((o) => ['accepted', 'preparing', 'packing', 'ready', 'out_for_delivery'].includes(o.status)).length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
    rejected: orders.filter((o) => ['rejected', 'cancelled'].includes(o.status)).length,
  };

  return (
    <div data-testid="admin-orders">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl text-lamazi-primary font-bold">Orders</h1>
          <p className="text-base text-lamazi-muted">Live order feed. Pending orders trigger a looping alert.</p>
        </div>
        <div className="flex gap-2 items-center">
          {hasNew && counts.pending > 0 && (
            <button onClick={() => setHasNew(false)} className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500 text-white animate-pulse-ring text-base font-semibold">
              <BellRing className="w-4 h-4" /> {counts.pending} new!
            </button>
          )}
          <button onClick={() => setSoundOn((s) => !s)} className="p-2 rounded-full bg-white border border-lamazi-secondary/60" title={soundOn ? 'Mute alerts' : 'Enable alerts'} data-testid="admin-orders-sound-toggle">
            {soundOn ? <Volume2 className="w-4 h-4 text-lamazi-primary" /> : <VolumeX className="w-4 h-4 text-lamazi-muted" />}
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6">
        {[
          { v: 'pending', label: `Pending (${counts.pending})` },
          { v: 'active', label: `In progress (${counts.active})` },
          { v: 'delivered', label: `Delivered (${counts.delivered})` },
          { v: 'rejected', label: `Rejected (${counts.rejected})` },
          { v: 'all', label: `All (${orders.length})` },
        ].map((f) => (
          <button
            key={f.v}
            onClick={() => setFilter(f.v)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              filter === f.v ? 'bg-lamazi-primary text-lamazi-neutral' : 'bg-white border border-lamazi-secondary/60 text-lamazi-primary'
            }`}
            data-testid={`admin-orders-filter-${f.v}`}
          >{f.label}</button>
        ))}
      </div>

      {loading ? <p className="text-lamazi-muted">Loading…</p> : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-lamazi-secondary/40 p-12 text-center text-lamazi-muted text-base">No orders in this view.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              onAccept={() => setStatus(o.id, 'accepted')}
              onReject={() => reject(o)}
              onMarkReady={() => setStatus(o.id, 'ready')}
              onDelivered={() => setStatus(o.id, 'delivered')}
              onCallDriver={() => callDriver(o)}
              onView={() => setOpenId(o.id)}
            />
          ))}
        </div>
      )}

      {openId && <OrderDetailModal id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}

function OrderCard({ order, onAccept, onReject, onMarkReady, onDelivered, onCallDriver, onView }) {
  const isOnline = order.payment_status === 'paid' || extractTxId(order);
  const txId = extractTxId(order);
  const armadaCalled = hasArmadaCode(order);
  const armadaCode = getArmadaCode(order);
  const isDelivery = order.order_type === 'delivery';

  return (
    <div className="bg-white rounded-2xl border-2 border-lamazi-secondary/40 p-5 hover:border-lamazi-primary/40 transition-colors shadow-sm" data-testid={`order-card-${order.id}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-display text-xl font-bold text-lamazi-primary leading-tight">#{order.order_number || order.id.slice(0, 8)}</p>
          <p className="text-base font-medium text-lamazi-ink">{order.customer_name}</p>
          <p className="text-sm text-lamazi-muted">{order.customer_phone}</p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${STATUS_BADGES[order.status] || 'bg-gray-100 text-gray-800'}`}>
          {order.status}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isOnline ? 'bg-blue-100 text-blue-900' : 'bg-emerald-100 text-emerald-900'}`}>
          {isOnline ? 'Online' : 'COD'}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isDelivery ? 'bg-violet-100 text-violet-900' : 'bg-amber-100 text-amber-900'}`}>
          {isDelivery ? 'Delivery' : 'Pickup'}
        </span>
        <span className="text-xs text-lamazi-muted">{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      {isOnline && txId && (
        <p className="text-xs text-lamazi-muted mb-3 font-mono break-all">Tx: {txId}</p>
      )}
      {armadaCalled && armadaCode && (
        <p className="text-xs text-lamazi-muted mb-3 font-mono break-all">Armada: {armadaCode}</p>
      )}

      <p className="text-2xl font-display font-bold text-lamazi-primary mb-4">{fmtKWD(order.total_amount)}</p>

      {/* Action buttons by status */}
      <div className="flex flex-wrap gap-2">
        <button onClick={onView} className="flex-1 min-w-0 py-2 px-3 rounded-full bg-lamazi-secondary/30 hover:bg-lamazi-secondary/60 text-sm font-semibold text-lamazi-primary inline-flex items-center justify-center gap-1.5" data-testid={`view-${order.id}`}>
          <Eye className="w-3.5 h-3.5" /> View
        </button>

        {order.status === 'pending' && (
          <>
            <button onClick={onAccept} className="flex-1 py-2 px-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5" data-testid={`accept-${order.id}`}>
              <Check className="w-4 h-4" /> Accept
            </button>
            <button onClick={onReject} className="flex-1 py-2 px-3 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5" data-testid={`reject-${order.id}`}>
              <X className="w-4 h-4" /> Reject
            </button>
          </>
        )}

        {(order.status === 'accepted' || order.status === 'preparing') && (
          <>
            {isDelivery && (
              armadaCalled ? (
                <button disabled className="flex-1 py-2 px-3 rounded-full bg-emerald-100 text-emerald-800 text-sm font-semibold inline-flex items-center justify-center gap-1.5 cursor-not-allowed" data-testid={`driver-called-${order.id}`}>
                  <CheckCircle2 className="w-4 h-4" /> Driver Called
                </button>
              ) : (
                <button onClick={onCallDriver} className="flex-1 py-2 px-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5" data-testid={`call-driver-${order.id}`}>
                  <Phone className="w-4 h-4" /> Call Driver
                </button>
              )
            )}
            <button onClick={onMarkReady} className="flex-1 py-2 px-3 rounded-full bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5" data-testid={`mark-ready-${order.id}`}>
              <Package className="w-4 h-4" /> Mark Ready
            </button>
          </>
        )}

        {(order.status === 'ready' || order.status === 'packing' || order.status === 'out_for_delivery') && (
          <>
            {isDelivery && armadaCalled && (
              <button disabled className="flex-1 py-2 px-3 rounded-full bg-emerald-100 text-emerald-800 text-sm font-semibold inline-flex items-center justify-center gap-1.5 cursor-not-allowed">
                <CheckCircle2 className="w-4 h-4" /> Driver Called
              </button>
            )}
            {isDelivery && !armadaCalled && (
              <button onClick={onCallDriver} className="flex-1 py-2 px-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5">
                <Phone className="w-4 h-4" /> Call Driver
              </button>
            )}
            <button onClick={onDelivered} className="flex-1 py-2 px-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5" data-testid={`delivered-${order.id}`}>
              <Truck className="w-4 h-4" /> Delivered
            </button>
          </>
        )}

        {order.status === 'delivered' && (
          <span className="flex-1 py-2 px-3 rounded-full bg-emerald-100 text-emerald-800 text-sm font-semibold inline-flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Delivered
          </span>
        )}
        {(order.status === 'rejected' || order.status === 'cancelled') && (
          <span className="flex-1 py-2 px-3 rounded-full bg-rose-100 text-rose-800 text-sm font-semibold inline-flex items-center justify-center gap-1.5">
            <X className="w-4 h-4" /> {order.status}
          </span>
        )}
      </div>
    </div>
  );
}

function OrderDetailModal({ id, onClose, onChanged }) {
  const [order, setOrder] = useState(null);

  useEffect(() => {
    api.get(`/orders/${id}`).then(({ data }) => setOrder(data));
  }, [id]);

  if (!order) return null;
  const isOnline = order.payment_status === 'paid' || extractTxId(order);
  const txId = extractTxId(order);
  const armadaCode = getArmadaCode(order);
  const addr = order.delivery_address;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-lamazi-neutral rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-lamazi-secondary/40 flex items-center justify-between sticky top-0 bg-lamazi-neutral z-10">
          <div>
            <p className="font-display text-2xl font-bold text-lamazi-primary">#{order.order_number}</p>
            <p className="text-sm text-lamazi-muted">{new Date(order.created_at).toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-lamazi-secondary/40 rounded-full" data-testid="order-modal-close"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Customer */}
          <section>
            <p className="text-xs uppercase tracking-widest text-lamazi-muted mb-2">Customer</p>
            <p className="text-base font-semibold">{order.customer_name}</p>
            <p className="text-sm text-lamazi-muted">{order.customer_phone}</p>
            {order.customer_email && <p className="text-sm text-lamazi-muted">{order.customer_email}</p>}
          </section>

          {/* Address */}
          {addr && (
            <section>
              <p className="text-xs uppercase tracking-widest text-lamazi-muted mb-2">Delivery address</p>
              <p className="text-base leading-relaxed">
                {[addr.area, addr.block && `Block ${addr.block}`, addr.street && `Street ${addr.street}`, addr.building && `Bldg ${addr.building}`, addr.floor && `Floor ${addr.floor}`, addr.apartment && `Apt ${addr.apartment}`].filter(Boolean).join(' · ')}
              </p>
              {addr.additional_directions && <p className="text-sm italic text-lamazi-muted mt-1">"{addr.additional_directions}"</p>}
              {addr.geo_lat && addr.geo_lng && (
                <a href={`https://www.google.com/maps/?q=${addr.geo_lat},${addr.geo_lng}`} target="_blank" rel="noopener noreferrer" className="text-sm text-lamazi-primary hover:underline">Open in Google Maps →</a>
              )}
            </section>
          )}

          {/* Items */}
          <section>
            <p className="text-xs uppercase tracking-widest text-lamazi-muted mb-2">Items</p>
            <div className="divide-y divide-lamazi-secondary/40">
              {(order.items || []).map((it) => (
                <div key={it.id} className="py-3 flex justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold">{it.quantity} × {it.item_name_en}</p>
                    {it.variant_name_en && <p className="text-sm text-lamazi-muted">{it.variant_name_en}</p>}
                    {(it.modifiers || []).length > 0 && (
                      <p className="text-sm text-lamazi-muted">+ {it.modifiers.map((m) => `${m.modifier_name_en}${m.quantity > 1 ? ` ×${m.quantity}` : ''}`).join(', ')}</p>
                    )}
                    {it.notes && <p className="text-sm italic text-lamazi-muted">"{it.notes}"</p>}
                  </div>
                  <p className="text-base font-semibold text-lamazi-primary shrink-0">{fmtKWD(it.total_price)}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Totals */}
          <section className="border-t border-lamazi-secondary/40 pt-3 space-y-1.5 text-base">
            <Row label="Subtotal" value={fmtKWD(order.subtotal)} />
            <Row label="Discount" value={fmtKWD(order.discount_amount)} />
            <Row label="Delivery fee" value={fmtKWD(order.delivery_fee)} />
            <div className="flex justify-between text-xl font-display font-bold text-lamazi-primary pt-2 border-t border-lamazi-secondary/40">
              <span>Total</span><span>{fmtKWD(order.total_amount)}</span>
            </div>
          </section>

          {/* Payment + Armada */}
          <section className="text-base">
            <p className="text-xs uppercase tracking-widest text-lamazi-muted mb-2">Payment</p>
            <p>{isOnline ? 'Online (Tap Payments)' : 'Cash on Delivery'} · <span className="text-emerald-700 font-medium">{order.payment_status}</span></p>
            {txId && <p className="text-sm font-mono text-lamazi-muted break-all">Transaction: {txId}</p>}
            {armadaCode && <p className="text-sm font-mono text-lamazi-muted break-all">Armada code: {armadaCode}</p>}
          </section>

          {/* Notes */}
          {order.notes && (
            <section>
              <p className="text-xs uppercase tracking-widest text-lamazi-muted mb-2">Order notes</p>
              <p className="text-sm italic">"{order.notes}"</p>
            </section>
          )}

          {/* Status timeline */}
          <section>
            <p className="text-xs uppercase tracking-widest text-lamazi-muted mb-2">Status history</p>
            <div className="flex flex-wrap gap-2">
              {['pending', 'accepted', 'ready', 'delivered'].map((s) => {
                const order_status = order.status;
                const stages = ['pending', 'accepted', 'ready', 'delivered'];
                const passed = stages.indexOf(order_status) >= stages.indexOf(s) || (order_status === 'out_for_delivery' && s !== 'delivered');
                return (
                  <span key={s} className={`text-xs px-3 py-1 rounded-full font-semibold ${passed ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'}`}>
                    {s}
                  </span>
                );
              })}
              {(order.status === 'rejected' || order.status === 'cancelled') && (
                <span className="text-xs px-3 py-1 rounded-full font-semibold bg-rose-100 text-rose-800">{order.status}</span>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-lamazi-muted">{label}</span>
      <span className="text-lamazi-ink/90 font-medium">{value}</span>
    </div>
  );
}
