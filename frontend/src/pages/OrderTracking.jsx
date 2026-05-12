import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, apiError } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { Clock, CheckCircle2, XCircle, Package, Truck, ChefHat, ChevronLeft } from 'lucide-react';
import { fmtKWD } from '@/lib/utils-app';

const STATUS_FLOW_DELIVERY = [
  { key: 'pending', label: 'Waiting for confirmation', icon: Clock },
  { key: 'accepted', label: 'Order confirmed', icon: CheckCircle2 },
  { key: 'preparing', label: 'Preparing', icon: ChefHat },
  { key: 'packing', label: 'Packing', icon: Package },
  { key: 'out_for_delivery', label: 'Out for delivery', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
];

const STATUS_FLOW_PICKUP = [
  { key: 'pending', label: 'Waiting for confirmation', icon: Clock },
  { key: 'accepted', label: 'Order confirmed', icon: CheckCircle2 },
  { key: 'preparing', label: 'Preparing', icon: ChefHat },
  { key: 'packing', label: 'Ready for pickup', icon: Package },
  { key: 'delivered', label: 'Picked up', icon: CheckCircle2 },
];

function statusIndex(status, flow) {
  const i = flow.findIndex((s) => s.key === status);
  return i;
}

export default function OrderTracking() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.get(`/orders/${id}`)
      .then(({ data }) => setOrder(data))
      .catch((e) => console.error(apiError(e)))
      .finally(() => setLoading(false));
  }, [id]);

  // Realtime subscription
  useEffect(() => {
    if (!id) return;
    const channel = supabase.channel(`order-${id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${id}`,
      }, (payload) => {
        setOrder((prev) => prev ? { ...prev, ...payload.new } : payload.new);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  if (loading) return <div className="container-lamazi py-20 text-center text-lamazi-muted">Loading order…</div>;
  if (!order) {
    return (
      <div className="container-lamazi py-16 text-center" data-testid="order-not-found">
        <XCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h1 className="font-display text-3xl text-lamazi-primary mb-2">Order not found</h1>
        <Link to="/" className="btn-primary mt-4 inline-flex">Back to home</Link>
      </div>
    );
  }

  const isPickup = order.order_type === 'takeaway';
  const flow = isPickup ? STATUS_FLOW_PICKUP : STATUS_FLOW_DELIVERY;
  const rejected = order.status === 'rejected' || order.status === 'cancelled';
  const idx = statusIndex(order.status, flow);

  return (
    <div className="container-lamazi py-10" data-testid="order-tracking">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-lamazi-primary hover:underline mb-4">
        <ChevronLeft className="w-4 h-4" /> Back home
      </Link>
      <h1 className="font-display text-3xl sm:text-4xl font-bold text-lamazi-primary mb-1">Order #{order.order_number}</h1>
      <p className="text-sm text-lamazi-muted mb-8">Placed {new Date(order.created_at).toLocaleString()}</p>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {rejected ? (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center">
              <XCircle className="w-10 h-10 text-rose-600 mx-auto mb-2" />
              <h2 className="font-display text-2xl text-rose-800 mb-1">Order {order.status === 'rejected' ? 'rejected' : 'cancelled'}</h2>
              <p className="text-sm text-rose-700">If you have questions, please call us.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-lamazi-secondary/40 p-6">
              <h2 className="font-display text-xl text-lamazi-primary mb-6">Status</h2>
              <div className="space-y-4">
                {flow.map((s, i) => {
                  const Active = i <= idx;
                  const Current = i === idx;
                  const Icon = s.icon;
                  return (
                    <div key={s.key} className="flex items-center gap-4">
                      <div className={`relative w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        Active ? 'bg-lamazi-primary text-lamazi-neutral' : 'bg-lamazi-secondary/30 text-lamazi-muted'
                      } ${Current && !rejected ? 'animate-pulse-ring' : ''}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${Active ? 'text-lamazi-primary' : 'text-lamazi-muted'}`}>{s.label}</p>
                      </div>
                      {Current && <span className="text-xs px-3 py-1 rounded-full bg-lamazi-secondary text-lamazi-primary font-medium">Now</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-lamazi-secondary/40 p-6">
            <h2 className="font-display text-xl text-lamazi-primary mb-4">Items</h2>
            <div className="divide-y divide-lamazi-secondary/40">
              {(order.items || []).map((it) => (
                <div key={it.id} className="py-3 flex justify-between gap-2 text-sm">
                  <div>
                    <p className="font-medium text-lamazi-ink">{it.quantity} × {it.item_name_en}</p>
                    {it.variant_name_en && <p className="text-xs text-lamazi-muted">{it.variant_name_en}</p>}
                    {(it.modifiers || []).length > 0 && (
                      <p className="text-xs text-lamazi-muted">+ {it.modifiers.map((m) => m.modifier_name_en).join(', ')}</p>
                    )}
                    {it.notes && <p className="text-xs italic text-lamazi-muted">"{it.notes}"</p>}
                  </div>
                  <p className="font-semibold text-lamazi-primary shrink-0">{fmtKWD(it.total_price)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside>
          <div className="cream-card sticky top-24" data-testid="order-summary-sidebar">
            <h3 className="font-display text-lg text-lamazi-primary font-semibold mb-3">Summary</h3>
            <div className="space-y-1.5 text-sm">
              <Row label="Subtotal" value={fmtKWD(order.subtotal)} />
              {Number(order.discount_amount) > 0 && <Row label="Discount" value={`− ${fmtKWD(order.discount_amount)}`} pos />}
              <Row label="Delivery fee" value={fmtKWD(order.delivery_fee)} />
              <div className="border-t border-lamazi-secondary/60 my-2" />
              <div className="flex justify-between text-base">
                <span className="font-semibold">Total</span>
                <span className="font-display text-xl font-bold text-lamazi-primary">{fmtKWD(order.total_amount)}</span>
              </div>
            </div>
            <p className="text-xs text-lamazi-muted mt-3">Payment: {order.payment_status} · {order.order_type}</p>
            <p className="text-xs text-lamazi-muted mt-1">Customer: {order.customer_name} · {order.customer_phone}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, pos }) {
  return (
    <div className="flex justify-between">
      <span className="text-lamazi-muted">{label}</span>
      <span className={pos ? 'text-emerald-700 font-medium' : 'text-lamazi-ink/90 font-medium'}>{value}</span>
    </div>
  );
}
