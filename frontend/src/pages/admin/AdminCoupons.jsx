import React, { useEffect, useState } from 'react';
import { api, apiError } from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Tag, Search } from 'lucide-react';
import { Modal, Field } from './AdminMenu';
import { fmtKWD } from '@/lib/utils-app';

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState([]);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(null);

  const load = async () => {
    const { data } = await api.get('/admin/coupons');
    setCoupons(data || []);
  };
  useEffect(() => { load(); }, []);

  const visible = coupons.filter((c) => !q.trim() || c.code?.toLowerCase().includes(q.toLowerCase()));

  return (
    <div data-testid="admin-coupons">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl text-lamazi-primary font-bold">Coupons</h1>
          <p className="text-sm text-lamazi-muted">Create discount codes with per-customer and global limits.</p>
        </div>
        <button onClick={() => setEdit({})} className="btn-primary py-2 text-xs"><Plus className="w-4 h-4" /> New coupon</button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-lamazi-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search codes…" className="w-full pl-10 pr-4 py-2.5 rounded-full bg-white border border-lamazi-secondary/60 text-sm" />
      </div>

      <div className="bg-white rounded-2xl border border-lamazi-secondary/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-lamazi-secondary/30 text-xs uppercase tracking-widest text-lamazi-muted">
            <tr><th className="text-left px-4 py-3">Code</th><th className="text-left px-4 py-3 hidden md:table-cell">Discount</th><th className="text-left px-4 py-3 hidden lg:table-cell">Min basket</th><th className="text-left px-4 py-3 hidden lg:table-cell">Limits</th><th className="text-left px-4 py-3">Status</th><th className="px-4 py-3"></th></tr>
          </thead>
          <tbody className="divide-y divide-lamazi-secondary/40">
            {visible.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-mono font-medium text-lamazi-primary">{c.code}</td>
                <td className="px-4 py-3 hidden md:table-cell">{c.discount_type === 'percent' ? `${c.discount_value}%` : fmtKWD(c.discount_value)}{c.max_discount && c.discount_type === 'percent' ? ` (cap ${fmtKWD(c.max_discount)})` : ''}</td>
                <td className="px-4 py-3 hidden lg:table-cell">{fmtKWD(c.min_basket)}</td>
                <td className="px-4 py-3 hidden lg:table-cell text-xs text-lamazi-muted">{c.usage_limit || '∞'} total · {c.per_customer_limit}/customer</td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full ${c.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>{c.status}</span></td>
                <td className="px-4 py-3 text-right">
                  <button onClick={async () => { await api.patch(`/admin/coupons/${c.id}`, { ...c, status: c.status === 'active' ? 'inactive' : 'active' }); load(); }} className="p-1.5 hover:bg-lamazi-secondary/30 rounded-full text-xs px-2">Toggle</button>
                  <button onClick={() => setEdit(c)} className="p-1.5 hover:bg-lamazi-secondary/30 rounded-full"><Pencil className="w-4 h-4" /></button>
                  <button onClick={async () => { if (window.confirm('Delete coupon?')) { await api.delete(`/admin/coupons/${c.id}`); load(); } }} className="p-1.5 hover:bg-rose-100 rounded-full"><Trash2 className="w-4 h-4 text-rose-700" /></button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && <tr><td colSpan="6" className="px-4 py-12 text-center text-lamazi-muted">No coupons.</td></tr>}
          </tbody>
        </table>
      </div>

      {edit && (
        <Modal title={edit.id ? 'Edit coupon' : 'New coupon'} onClose={() => setEdit(null)}>
          <CouponForm coupon={edit} onSave={async (body) => {
            try {
              if (edit.id) await api.patch(`/admin/coupons/${edit.id}`, body);
              else await api.post('/admin/coupons', body);
              toast.success('Saved'); setEdit(null); load();
            } catch (e) { toast.error(apiError(e)); }
          }} />
        </Modal>
      )}
    </div>
  );
}

function CouponForm({ coupon, onSave }) {
  const [f, setF] = useState({
    code: '', name_en: '', name_ar: '', discount_type: 'percent', discount_value: 10,
    min_basket: 0, max_discount: null, usage_limit: null, per_customer_limit: 1,
    valid_to: '', status: 'active', ...coupon,
  });
  return (
    <>
      <Field label="Code" value={f.code} onChange={(v) => setF({ ...f, code: v.toUpperCase() })} />
      <Field label="Name (English)" value={f.name_en} onChange={(v) => setF({ ...f, name_en: v })} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs uppercase tracking-widest text-lamazi-muted mb-1">Discount type</label>
          <select value={f.discount_type} onChange={(e) => setF({ ...f, discount_type: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-lamazi-secondary/60 bg-white text-sm">
            <option value="percent">Percentage</option>
            <option value="fixed">Fixed (KWD)</option>
          </select>
        </div>
        <Field label="Value" type="number" step="0.001" value={f.discount_value} onChange={(v) => setF({ ...f, discount_value: v })} />
      </div>
      <Field label="Min basket (KWD)" type="number" step="0.001" value={f.min_basket} onChange={(v) => setF({ ...f, min_basket: v })} />
      {f.discount_type === 'percent' && <Field label="Max discount cap (KWD, optional)" type="number" step="0.001" value={f.max_discount ?? ''} onChange={(v) => setF({ ...f, max_discount: v === '' ? null : Number(v) })} />}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Total usage limit" type="number" value={f.usage_limit ?? ''} onChange={(v) => setF({ ...f, usage_limit: v === '' ? null : Number(v) })} />
        <Field label="Per customer" type="number" value={f.per_customer_limit} onChange={(v) => setF({ ...f, per_customer_limit: Number(v) })} />
      </div>
      <Field label="Expiry (ISO date, optional)" value={f.valid_to ?? ''} onChange={(v) => setF({ ...f, valid_to: v })} />
      <div>
        <label className="block text-xs uppercase tracking-widest text-lamazi-muted mb-1">Status</label>
        <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-lamazi-secondary/60 bg-white text-sm">
          <option value="active">Active</option><option value="inactive">Inactive</option>
        </select>
      </div>
      <button onClick={() => onSave({
        ...f,
        discount_value: Number(f.discount_value),
        min_basket: Number(f.min_basket),
        per_customer_limit: Number(f.per_customer_limit),
        valid_to: f.valid_to || null,
      })} className="btn-primary w-full">Save</button>
    </>
  );
}
