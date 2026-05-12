import React, { useEffect, useState } from 'react';
import { api, apiError } from '@/lib/api';
import { toast } from 'sonner';
import { Users, Sparkles, X } from 'lucide-react';

export default function AdminCustomers() {
  const [data, setData] = useState({ customers: [], total_points_issued: 0, total_count: 0 });
  const [open, setOpen] = useState(null);

  const load = () => api.get('/admin/customers').then(({ data: d }) => setData(d));
  useEffect(() => { load(); }, []);

  return (
    <div data-testid="admin-customers">
      <h1 className="font-display text-3xl text-lamazi-primary font-bold mb-1">Customers</h1>
      <p className="text-sm text-lamazi-muted mb-6">Everyone who's ordered or signed up.</p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Stat label="Total customers" value={data.total_count} icon={Users} />
        <Stat label="Total points issued" value={data.total_points_issued} icon={Sparkles} accent="bg-amber-600" />
      </div>

      <div className="bg-white rounded-2xl border border-lamazi-secondary/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-lamazi-secondary/30 text-xs uppercase tracking-widest text-lamazi-muted">
            <tr><th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3 hidden md:table-cell">Email / Phone</th><th className="text-right px-4 py-3">Points</th><th className="text-left px-4 py-3 hidden sm:table-cell">Joined</th><th className="px-4 py-3"></th></tr>
          </thead>
          <tbody className="divide-y divide-lamazi-secondary/40">
            {data.customers.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium">{c.name || '—'}</td>
                <td className="px-4 py-3 hidden md:table-cell text-xs text-lamazi-muted">{c.email || '—'}<br />{c.phone || ''}</td>
                <td className="px-4 py-3 text-right font-semibold">{c.loyalty_points || 0}</td>
                <td className="px-4 py-3 hidden sm:table-cell text-xs text-lamazi-muted">{new Date(c.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setOpen(c)} className="text-xs px-3 py-1 rounded-full bg-lamazi-secondary/30 hover:bg-lamazi-secondary/60">Manage</button>
                </td>
              </tr>
            ))}
            {data.customers.length === 0 && <tr><td colSpan="5" className="px-4 py-12 text-center text-lamazi-muted">No customers yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {open && <ManageDrawer customer={open} onClose={() => { setOpen(null); load(); }} />}
    </div>
  );
}

function Stat({ label, value, icon: Icon, accent = 'bg-lamazi-primary' }) {
  return (
    <div className="bg-white rounded-2xl border border-lamazi-secondary/40 p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-full ${accent} text-white flex items-center justify-center`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs uppercase tracking-widest text-lamazi-muted">{label}</p>
        <p className="font-display text-2xl font-bold text-lamazi-primary">{value}</p>
      </div>
    </div>
  );
}

function ManageDrawer({ customer, onClose }) {
  const [orders, setOrders] = useState([]);
  const [delta, setDelta] = useState(0);
  const [note, setNote] = useState('');

  useEffect(() => {
    api.get(`/customer/${customer.id}/orders`).then(({ data }) => setOrders(data || []));
  }, [customer.id]);

  const adjust = async () => {
    try {
      const { data } = await api.post('/admin/customers/adjust-points', { customer_id: customer.id, delta: Number(delta), note });
      toast.success(`Balance now ${data.balance_after}`);
      onClose();
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="bg-lamazi-neutral w-full max-w-md h-full overflow-y-auto shadow-2xl">
        <div className="p-5 border-b border-lamazi-secondary/40 flex items-center justify-between">
          <div>
            <h3 className="font-display text-xl text-lamazi-primary">{customer.name || customer.email}</h3>
            <p className="text-xs text-lamazi-muted">{customer.phone}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-lamazi-secondary/40"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-5 text-sm">
          <div>
            <p className="text-xs uppercase tracking-widest text-lamazi-muted">Loyalty balance</p>
            <p className="font-display text-3xl font-bold text-lamazi-primary">{customer.loyalty_points || 0}</p>
          </div>
          <div className="border-t border-lamazi-secondary/40 pt-4">
            <p className="text-xs uppercase tracking-widest text-lamazi-muted mb-2">Adjust points</p>
            <div className="flex gap-2">
              <input type="number" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="±50" className="w-24 px-3 py-2 rounded-lg border border-lamazi-secondary/60 bg-white text-sm" />
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="flex-1 px-3 py-2 rounded-lg border border-lamazi-secondary/60 bg-white text-sm" />
              <button onClick={adjust} className="btn-primary py-2 px-4 text-sm">Apply</button>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-lamazi-muted mb-2">Order history</p>
            <div className="space-y-1">
              {orders.length === 0 ? <p className="text-lamazi-muted text-xs">No orders yet.</p>
                : orders.map((o) => (
                  <div key={o.id} className="flex justify-between text-xs py-1.5 border-b border-lamazi-secondary/20">
                    <span>#{o.order_number} · {o.status}</span>
                    <span className="text-lamazi-muted">{new Date(o.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
