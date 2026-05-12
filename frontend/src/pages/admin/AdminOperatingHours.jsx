import React, { useEffect, useState } from 'react';
import { api, apiError } from '@/lib/api';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export default function AdminOperatingHours() {
  const [hours, setHours] = useState(null);

  useEffect(() => {
    api.get('/admin/operating-hours').then(({ data }) => {
      const raw = data.hours || {};
      const out = {};
      for (const d of DAYS) {
        const cur = raw[d];
        if (!cur) { out[d] = { is_open: false, ranges: [] }; continue; }
        if (cur.ranges) out[d] = { is_open: cur.is_open ?? true, ranges: cur.ranges };
        else if (cur.open && cur.close) {
          out[d] = { is_open: cur.is_open ?? true, ranges: [{ open: cur.open, close: cur.close }] };
        } else {
          out[d] = { is_open: cur.is_open ?? true, ranges: [] };
        }
      }
      setHours(out);
    });
  }, []);

  if (!hours) return <p className="text-lamazi-muted">Loading…</p>;

  const setDay = (day, patch) => setHours((h) => ({ ...h, [day]: { ...h[day], ...patch } }));
  const addRange = (day) => setHours((h) => ({ ...h, [day]: { ...h[day], ranges: [...(h[day].ranges || []), { open: '09:00', close: '17:00' }] } }));
  const removeRange = (day, idx) => setHours((h) => ({ ...h, [day]: { ...h[day], ranges: h[day].ranges.filter((_, i) => i !== idx) } }));
  const updateRange = (day, idx, key, val) => setHours((h) => ({
    ...h, [day]: { ...h[day], ranges: h[day].ranges.map((r, i) => i === idx ? { ...r, [key]: val } : r) },
  }));

  const save = async () => {
    try {
      await api.post('/admin/operating-hours', { hours });
      toast.success('Hours saved');
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div className="max-w-3xl" data-testid="admin-hours">
      <h1 className="font-display text-3xl text-lamazi-primary font-bold mb-1">Operating Hours</h1>
      <p className="text-sm text-lamazi-muted mb-6">All times in Kuwait time (UTC+3). Add multiple ranges for split-shift days.</p>

      <div className="bg-white rounded-2xl border border-lamazi-secondary/40 divide-y divide-lamazi-secondary/40">
        {DAYS.map((day) => (
          <div key={day} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="font-display text-lg text-lamazi-primary capitalize">{day}</p>
              <label className="flex items-center gap-2 text-xs">
                <span>{hours[day].is_open ? 'Open' : 'Closed'}</span>
                <Toggle checked={hours[day].is_open} onChange={(v) => setDay(day, { is_open: v })} />
              </label>
            </div>
            {hours[day].is_open && (
              <div className="space-y-2">
                {(hours[day].ranges || []).map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="time" value={r.open} onChange={(e) => updateRange(day, i, 'open', e.target.value)} className="px-2 py-1.5 rounded-lg border border-lamazi-secondary/60 text-sm" />
                    <span className="text-lamazi-muted text-xs">to</span>
                    <input type="time" value={r.close} onChange={(e) => updateRange(day, i, 'close', e.target.value)} className="px-2 py-1.5 rounded-lg border border-lamazi-secondary/60 text-sm" />
                    <button onClick={() => removeRange(day, i)} className="p-1.5 hover:bg-rose-100 rounded-full"><X className="w-3.5 h-3.5 text-rose-700" /></button>
                  </div>
                ))}
                <button onClick={() => addRange(day)} className="text-xs text-lamazi-primary hover:underline flex items-center gap-1 mt-1">
                  <Plus className="w-3.5 h-3.5" /> Add range
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <button onClick={save} className="btn-primary mt-6 w-full">Save hours</button>
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
