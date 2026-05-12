import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ShoppingBag, DollarSign, Users, Clock, CheckCircle2 } from 'lucide-react';
import { fmtKWD } from '@/lib/utils-app';

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/admin/dashboard').then(({ data: d }) => setData(d));
  }, []);

  if (!data) return <p className="text-lamazi-muted">Loading…</p>;

  const cards = [
    { label: "Today's revenue", value: fmtKWD(data.revenue_today), icon: DollarSign, color: 'bg-emerald-600' },
    { label: "Today's orders", value: data.orders_today, icon: ShoppingBag, color: 'bg-lamazi-primary' },
    { label: 'Pending now', value: data.pending_count, icon: Clock, color: 'bg-amber-600' },
    { label: 'In progress', value: data.in_progress_count, icon: ChefIcon, color: 'bg-blue-700' },
    { label: 'Delivered today', value: data.delivered_today_count, icon: CheckCircle2, color: 'bg-emerald-700' },
    { label: 'Total customers', value: data.total_customers, icon: Users, color: 'bg-lamazi-tertiary' },
  ];

  return (
    <div data-testid="admin-dashboard">
      <h1 className="font-display text-3xl text-lamazi-primary font-bold mb-1">Dashboard</h1>
      <p className="text-sm text-lamazi-muted mb-8">A quick look at how today is going.</p>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-lamazi-secondary/40 p-5 flex items-center gap-4">
            <div className={`w-11 h-11 rounded-full ${c.color} text-white flex items-center justify-center shrink-0`}>
              <c.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-lamazi-muted">{c.label}</p>
              <p className="font-display text-2xl font-bold text-lamazi-primary">{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      <h2 className="font-display text-xl text-lamazi-primary mb-3">Recent orders</h2>
      <div className="bg-white rounded-2xl border border-lamazi-secondary/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-lamazi-secondary/30 text-xs uppercase tracking-widest text-lamazi-muted">
            <tr>
              <th className="text-left px-4 py-3">Order #</th>
              <th className="text-left px-4 py-3 hidden sm:table-cell">Time</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-lamazi-secondary/40">
            {(data.recent_orders || []).map((o) => (
              <tr key={o.id} className="hover:bg-lamazi-secondary/10">
                <td className="px-4 py-3 font-medium text-lamazi-primary">#{o.order_number || o.id.slice(0, 8)}</td>
                <td className="px-4 py-3 text-lamazi-muted hidden sm:table-cell">{new Date(o.created_at).toLocaleString()}</td>
                <td className="px-4 py-3"><span className="text-xs px-2 py-1 rounded-full bg-lamazi-secondary/40 text-lamazi-primary">{o.status}</span></td>
                <td className="px-4 py-3 text-right font-semibold text-lamazi-primary">{fmtKWD(o.total_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChefIcon({ className }) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 14V11a4 4 0 0 1 4-4h0a4 4 0 0 1 4 4v3M6 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm12 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-12 0v6h12v-6"/></svg>;
}
