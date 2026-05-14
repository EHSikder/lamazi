import React, { useEffect, useState } from 'react';
import { api, apiError } from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Modal, Field } from './AdminMenu';
import { fmtKWD } from '@/lib/utils-app';

export default function AdminModifiers() {
  const [tab, setTab] = useState('groups');
  const [groups, setGroups] = useState([]);
  const [mods, setMods] = useState([]);
  const [editGroup, setEditGroup] = useState(null);
  const [editMod, setEditMod] = useState(null);
  const [filterGroup, setFilterGroup] = useState('');

  const load = async () => {
    const [g, m] = await Promise.all([api.get('/admin/modifier-groups'), api.get('/admin/modifiers')]);
    setGroups(g.data || []); setMods(m.data || []);
  };
  useEffect(() => { load(); }, []);

  const groupName = (id) => groups.find((g) => g.id === id)?.name_en || '—';

  const visibleMods = filterGroup ? mods.filter((m) => m.modifier_group_id === filterGroup) : mods;

  return (
    <div data-testid="admin-modifiers">
      <h1 className="font-display text-3xl text-lamazi-primary font-bold mb-1">Modifiers</h1>
      <p className="text-sm text-lamazi-muted mb-6">Define add-on groups (like "Sauces") then the individual options inside each group.</p>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('groups')} className={`px-4 py-2 rounded-full text-base font-semibold ${tab === 'groups' ? 'bg-lamazi-primary text-lamazi-neutral' : 'bg-white border border-lamazi-secondary/60 text-lamazi-primary'}`}>Modifier Groups</button>
        <button onClick={() => setTab('mods')} className={`px-4 py-2 rounded-full text-base font-semibold ${tab === 'mods' ? 'bg-lamazi-primary text-lamazi-neutral' : 'bg-white border border-lamazi-secondary/60 text-lamazi-primary'}`}>Modifiers</button>
      </div>

      {tab === 'groups' && (
        <>
          <div className="flex justify-end mb-3">
            <button onClick={() => setEditGroup({})} className="btn-primary py-2 text-xs"><Plus className="w-4 h-4" /> New group</button>
          </div>
          <div className="bg-white rounded-2xl border border-lamazi-secondary/40 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-lamazi-secondary/30 text-xs uppercase tracking-widest text-lamazi-muted">
                <tr><th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Range</th><th className="text-left px-4 py-3">Required</th><th className="px-4 py-3"></th></tr>
              </thead>
              <tbody className="divide-y divide-lamazi-secondary/40">
                {groups.map((g) => (
                  <tr key={g.id}>
                    <td className="px-4 py-3 font-medium">{g.name_en}</td>
                    <td className="px-4 py-3 text-xs text-lamazi-muted">{g.min_select}–{g.max_select}</td>
                    <td className="px-4 py-3">{g.required ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setEditGroup(g)} className="p-1.5 hover:bg-lamazi-secondary/30 rounded-full"><Pencil className="w-4 h-4" /></button>
                      <button onClick={async () => { if (window.confirm('Delete group?')) { await api.delete(`/admin/modifier-groups/${g.id}`); load(); } }} className="p-1.5 hover:bg-rose-100 rounded-full"><Trash2 className="w-4 h-4 text-rose-700" /></button>
                    </td>
                  </tr>
                ))}
                {groups.length === 0 && <tr><td colSpan="4" className="px-4 py-12 text-center text-lamazi-muted">No modifier groups yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'mods' && (
        <>
          <div className="flex justify-between mb-3 gap-3">
            <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)} className="px-3 py-2 rounded-full bg-white border border-lamazi-secondary/60 text-xs">
              <option value="">All groups</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name_en}</option>)}
            </select>
            <button onClick={() => setEditMod({})} className="btn-primary py-2 text-xs" disabled={groups.length === 0}><Plus className="w-4 h-4" /> New option</button>
          </div>
          <div className="bg-white rounded-2xl border border-lamazi-secondary/40 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-lamazi-secondary/30 text-xs uppercase tracking-widest text-lamazi-muted">
                <tr><th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Group</th><th className="text-right px-4 py-3">Price</th><th className="px-4 py-3"></th></tr>
              </thead>
              <tbody className="divide-y divide-lamazi-secondary/40">
                {visibleMods.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3 font-medium">{m.name_en}</td>
                    <td className="px-4 py-3 text-xs text-lamazi-muted">{groupName(m.modifier_group_id)}</td>
                    <td className="px-4 py-3 text-right">{fmtKWD(m.price)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setEditMod(m)} className="p-1.5 hover:bg-lamazi-secondary/30 rounded-full"><Pencil className="w-4 h-4" /></button>
                      <button onClick={async () => { if (window.confirm('Delete option?')) { await api.delete(`/admin/modifiers/${m.id}`); load(); } }} className="p-1.5 hover:bg-rose-100 rounded-full"><Trash2 className="w-4 h-4 text-rose-700" /></button>
                    </td>
                  </tr>
                ))}
                {visibleMods.length === 0 && <tr><td colSpan="4" className="px-4 py-12 text-center text-lamazi-muted">No options yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editGroup && (
        <Modal title={editGroup.id ? 'Edit group' : 'New group'} onClose={() => { setEditGroup(null); load(); }}>
          <GroupForm group={editGroup} onSave={async (body) => {
            try {
              if (editGroup.id) await api.patch(`/admin/modifier-groups/${editGroup.id}`, body);
              else await api.post('/admin/modifier-groups', body);
              toast.success('Saved'); setEditGroup(null); load();
            } catch (e) { toast.error(apiError(e)); }
          }} />
        </Modal>
      )}

      {editMod && (
        <Modal title={editMod.id ? 'Edit option' : 'New option'} onClose={() => { setEditMod(null); load(); }}>
          <ModForm mod={editMod} groups={groups} onSave={async (body) => {
            try {
              if (editMod.id) await api.patch(`/admin/modifiers/${editMod.id}`, body);
              else await api.post('/admin/modifiers', body);
              toast.success('Saved'); setEditMod(null); load();
            } catch (e) { toast.error(apiError(e)); }
          }} />
        </Modal>
      )}
    </div>
  );
}

function GroupForm({ group, onSave }) {
  const [f, setF] = useState({ name_en: '', name_ar: '', min_select: 0, max_select: 1, required: false, sort_order: 0, status: 'active', ...group });
  return (
    <>
      <Field label="Name (English)" value={f.name_en} onChange={(v) => setF({ ...f, name_en: v })} />
      <Field label="Name (Arabic)" value={f.name_ar} onChange={(v) => setF({ ...f, name_ar: v })} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Min select" type="number" value={f.min_select} onChange={(v) => setF({ ...f, min_select: Number(v) })} />
        <Field label="Max select" type="number" value={f.max_select} onChange={(v) => setF({ ...f, max_select: Number(v) })} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={f.required} onChange={(e) => setF({ ...f, required: e.target.checked })} className="accent-lamazi-primary" /> Required
      </label>
      <button onClick={() => onSave({ ...f, min_select: Number(f.min_select), max_select: Number(f.max_select) })} className="btn-primary w-full">Save</button>
    </>
  );
}

function ModForm({ mod, groups, onSave }) {
  const [f, setF] = useState({ modifier_group_id: groups[0]?.id || '', name_en: '', name_ar: '', price: 0, sort_order: 0, status: 'active', ...mod });
  return (
    <>
      <div>
        <label className="block text-xs uppercase tracking-widest text-lamazi-muted mb-1">Group</label>
        <select value={f.modifier_group_id} onChange={(e) => setF({ ...f, modifier_group_id: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-lamazi-secondary/60 bg-white text-sm">
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name_en}</option>)}
        </select>
      </div>
      <Field label="Name (English)" value={f.name_en} onChange={(v) => setF({ ...f, name_en: v })} />
      <Field label="Name (Arabic)" value={f.name_ar} onChange={(v) => setF({ ...f, name_ar: v })} />
      <Field label="Price (KWD)" type="number" step="0.001" value={f.price} onChange={(v) => setF({ ...f, price: v })} />
      <button onClick={() => onSave({ ...f, price: Number(f.price) })} className="btn-primary w-full">Save</button>
    </>
  );
}
