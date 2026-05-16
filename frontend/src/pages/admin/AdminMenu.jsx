import React, { useEffect, useState } from 'react';
import { api, apiError } from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Search, Tags, X } from 'lucide-react';
import { fmtKWD } from '@/lib/utils-app';

export default function AdminMenu() {
  const [cats, setCats] = useState([]);
  const [items, setItems] = useState([]);
  const [activeCat, setActiveCat] = useState('all');
  const [q, setQ] = useState('');
  const [editItem, setEditItem] = useState(null);
  const [editCat, setEditCat] = useState(null);
  const [linkOpen, setLinkOpen] = useState(null);

  const load = async () => {
    const [c, i] = await Promise.all([api.get('/admin/categories'), api.get('/admin/items')]);
    setCats(c.data || []);
    setItems(i.data || []);
  };
  useEffect(() => { load(); }, []);

  const visible = items
    .filter((it) => activeCat === 'all' || it.category_id === activeCat)
    .filter((it) => !q.trim() || it.name_en?.toLowerCase().includes(q.toLowerCase()));

  const delItem = async (id) => {
    if (!window.confirm('Delete this item?')) return;
    try { await api.delete(`/admin/items/${id}`); toast.success('Deleted'); load(); }
    catch (e) { toast.error(apiError(e)); }
  };

  const delCat = async (id) => {
    if (!window.confirm('Delete this category? Items linked to it may need re-assignment.')) return;
    try { await api.delete(`/admin/categories/${id}`); toast.success('Deleted'); load(); }
    catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div data-testid="admin-menu">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl text-lamazi-primary font-bold">Menu</h1>
          <p className="text-sm text-lamazi-muted">Manage categories, items, variants and modifier links.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditCat({})} className="btn-outline py-2 text-xs"><Plus className="w-4 h-4" /> Category</button>
          <button onClick={() => setEditItem({})} className="btn-primary py-2 text-xs"><Plus className="w-4 h-4" /> Item</button>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-lamazi-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items…" className="w-full pl-10 pr-4 py-2.5 rounded-full bg-white border border-lamazi-secondary/60 text-sm" />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
        <button onClick={() => setActiveCat('all')} className={`shrink-0 px-4 py-1.5 rounded-full text-xs ${activeCat === 'all' ? 'bg-lamazi-primary text-lamazi-neutral' : 'bg-white border border-lamazi-secondary/60 text-lamazi-primary'}`}>All</button>
        {cats.map((c) => (
          <div key={c.id} className="shrink-0 flex items-center gap-1">
            <button onClick={() => setActiveCat(c.id)} className={`px-4 py-1.5 rounded-full text-xs ${activeCat === c.id ? 'bg-lamazi-primary text-lamazi-neutral' : 'bg-white border border-lamazi-secondary/60 text-lamazi-primary'}`}>{c.name_en}</button>
            <button onClick={() => setEditCat(c)} className="p-1 text-lamazi-muted hover:text-lamazi-primary"><Pencil className="w-3 h-3" /></button>
            <button onClick={() => delCat(c.id)} className="p-1 text-lamazi-muted hover:text-rose-700"><Trash2 className="w-3 h-3" /></button>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visible.map((it) => (
          <div key={it.id} className="bg-white rounded-2xl border border-lamazi-secondary/40 overflow-hidden">
            {it.image_url && <div className="aspect-video bg-lamazi-secondary/30"><img src={it.image_url} alt={it.name_en} className="w-full h-full object-cover" /></div>}
            <div className="p-4">
              <div className="flex justify-between items-start">
                <h3 className="font-display text-lg text-lamazi-primary">{it.name_en}</h3>
                <span className="text-sm font-semibold">{fmtKWD(it.base_price)}</span>
              </div>
              <p className="text-xs text-lamazi-muted truncate-2 mt-1">{it.description_en}</p>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setEditItem(it)} className="flex-1 text-xs py-1.5 rounded-full bg-lamazi-secondary/30 hover:bg-lamazi-secondary/60"><Pencil className="w-3 h-3 inline" /> Edit</button>
                <button onClick={() => setLinkOpen(it)} className="flex-1 text-xs py-1.5 rounded-full bg-lamazi-secondary/30 hover:bg-lamazi-secondary/60"><Tags className="w-3 h-3 inline" /> Modifiers</button>
                <button onClick={() => delItem(it.id)} className="text-xs py-1.5 px-2 rounded-full bg-rose-50 text-rose-700 hover:bg-rose-100"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
          </div>
        ))}
        {visible.length === 0 && <p className="col-span-full text-center text-lamazi-muted py-12">No items match.</p>}
      </div>

      {editItem && <ItemForm item={editItem} cats={cats} onClose={() => { setEditItem(null); load(); }} />}
      {editCat && <CategoryForm cat={editCat} onClose={() => { setEditCat(null); load(); }} />}
      {linkOpen && <LinkModifiers item={linkOpen} onClose={() => setLinkOpen(null)} />}
    </div>
  );
}

function CategoryForm({ cat, onClose }) {
  const [f, setF] = useState({ name_en: '', name_ar: '', image_url: '', sort_order: 0, status: 'active', ...cat });
  const save = async () => {
    try {
      if (cat?.id) await api.patch(`/admin/categories/${cat.id}`, f);
      else await api.post('/admin/categories', f);
      toast.success('Saved');
      onClose();
    } catch (e) { toast.error(apiError(e)); }
  };
  return (
    <Modal title={cat?.id ? 'Edit category' : 'New category'} onClose={onClose}>
      <Field label="Name (English)" value={f.name_en} onChange={(v) => setF({ ...f, name_en: v })} />
      <Field label="Name (Arabic)" value={f.name_ar} onChange={(v) => setF({ ...f, name_ar: v })} />
      <Field label="Image URL" value={f.image_url} onChange={(v) => setF({ ...f, image_url: v })} />
      <Field label="Sort order" type="number" value={f.sort_order} onChange={(v) => setF({ ...f, sort_order: Number(v) })} />
      <button onClick={save} className="btn-primary w-full">Save</button>
    </Modal>
  );
}

function ItemForm({ item, cats, onClose }) {
  const [f, setF] = useState({ name_en: '', name_ar: '', description_en: '', description_ar: '', image_url: '', base_price: 0, category_id: cats[0]?.id || '', sort_order: 0, status: 'active', ...item });
  const save = async () => {
    try {
      const body = { ...f, base_price: Number(f.base_price) };
      if (item?.id) await api.patch(`/admin/items/${item.id}`, body);
      else await api.post('/admin/items', body);
      toast.success('Saved');
      onClose();
    } catch (e) { toast.error(apiError(e)); }
  };
  return (
    <Modal title={item?.id ? 'Edit item' : 'New item'} onClose={onClose}>
      <Field label="Name (English)" value={f.name_en} onChange={(v) => setF({ ...f, name_en: v })} />
      <Field label="Name (Arabic)" value={f.name_ar} onChange={(v) => setF({ ...f, name_ar: v })} />
      <div>
        <label className="block text-xs uppercase tracking-widest text-lamazi-muted mb-1">Category</label>
        <select value={f.category_id} onChange={(e) => setF({ ...f, category_id: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-lamazi-secondary/60 bg-white text-sm">
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name_en}</option>)}
        </select>
      </div>
      <Field label="Description (English)" value={f.description_en} onChange={(v) => setF({ ...f, description_en: v })} multiline />
      <Field label="Image URL" value={f.image_url} onChange={(v) => setF({ ...f, image_url: v })} />
      <Field label="Price (KWD)" type="number" step="0.001" value={f.base_price} onChange={(v) => setF({ ...f, base_price: v })} />
      <Field label="Sort order" type="number" value={f.sort_order} onChange={(v) => setF({ ...f, sort_order: Number(v) })} />
      <div>
        <label className="block text-xs uppercase tracking-widest text-lamazi-muted mb-1">Status</label>
        <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-lamazi-secondary/60 bg-white text-sm">
          <option value="active">Active</option><option value="inactive">Inactive</option>
        </select>
      </div>
      <button onClick={save} className="btn-primary w-full">Save</button>
    </Modal>
  );
}

function LinkModifiers({ item, onClose }) {
  const [groups, setGroups] = useState([]);
  const [links, setLinks] = useState([]);
  const load = async () => {
    const [g, l] = await Promise.all([
      api.get('/admin/modifier-groups'),
      api.get(`/admin/items/${item.id}/modifier-links`),
    ]);
    setGroups(g.data || []);
    setLinks(l.data || []);
  };
  
  const toggle = async (g) => {
    const existing = links.find((l) => l.modifier_group_id === g.id);
    try {
      if (existing) {
        await api.delete(`/admin/item-modifier-links/${existing.id}`);
      } else {
        await api.post('/admin/item-modifier-links', { item_id: item.id, modifier_group_id: g.id, sort_order: 0 });
      }
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <Modal title={`Link modifiers · ${item.name_en}`} onClose={onClose}>
      {groups.length === 0 ? <p className="text-sm text-lamazi-muted">No modifier groups yet. Create them in the Modifiers tab.</p>
        : groups.map((g) => {
          const linked = links.find((l) => l.modifier_group_id === g.id);
          return (
            <label key={g.id} className="flex items-center justify-between p-3 rounded-xl border border-lamazi-secondary/40 cursor-pointer">
              <span className="text-sm">{g.name_en} <span className="text-xs text-lamazi-muted">({g.min_select}–{g.max_select})</span></span>
              <input type="checkbox" checked={!!linked} onChange={() => toggle(g)} className="w-4 h-4 accent-lamazi-primary" />
            </label>
          );
        })}
    </Modal>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-lamazi-neutral rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-lamazi-secondary/40 flex justify-between items-center">
          <h3 className="font-display text-lg text-lamazi-primary">{title}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-lamazi-secondary/40 rounded-full"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', step, multiline }) {
  const inputProps = {
    value: value ?? '',
    onChange: (e) => onChange(e.target.value),
    className: 'w-full px-3 py-2.5 rounded-xl border border-lamazi-secondary/60 bg-white text-sm focus:outline-none focus:border-lamazi-primary',
  };
  return (
    <div>
      <label className="block text-xs uppercase tracking-widest text-lamazi-muted mb-1">{label}</label>
      {multiline ? <textarea {...inputProps} rows={3} /> : <input type={type} step={step} {...inputProps} />}
    </div>
  );
}

export { Modal, Field };
