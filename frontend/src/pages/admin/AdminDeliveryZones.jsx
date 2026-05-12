import React, { useEffect, useState } from 'react';
import { api, apiError } from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Modal, Field } from './AdminMenu';
import { fmtKWD } from '@/lib/utils-app';
import { MapContainer, TileLayer, Polygon } from 'react-leaflet';

export default function AdminDeliveryZones() {
  const [zones, setZones] = useState([]);
  const [edit, setEdit] = useState(null);
  const load = () => api.get('/admin/delivery-zones').then(({ data }) => setZones(data || []));
  useEffect(() => { load(); }, []);

  return (
    <div data-testid="admin-zones">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl text-lamazi-primary font-bold">Delivery Zones</h1>
          <p className="text-sm text-lamazi-muted">Polygon-based areas. Provide coordinates as JSON [[lng, lat], …].</p>
        </div>
        <button onClick={() => setEdit({})} className="btn-primary py-2 text-xs"><Plus className="w-4 h-4" /> New zone</button>
      </div>

      <div className="rounded-2xl overflow-hidden h-[300px] border border-lamazi-secondary/40 mb-6">
        <MapContainer center={[29.3375, 47.9744]} zoom={11} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
          {zones.map((z) => {
            const ring = Array.isArray(z.coordinates) ? z.coordinates : (z.coordinates?.coordinates?.[0] || []);
            if (!ring?.length) return null;
            const positions = ring.map(([a, b]) => Math.abs(a) <= 180 ? [b, a] : [a, b]);
            return <Polygon key={z.id} positions={positions} pathOptions={{ color: '#58000e', weight: 2, fillOpacity: 0.12 }} />;
          })}
        </MapContainer>
      </div>

      <div className="space-y-3">
        {zones.map((z) => (
          <div key={z.id} className="bg-white rounded-2xl border border-lamazi-secondary/40 p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-lamazi-primary">{z.zone_name}</p>
              <p className="text-xs text-lamazi-muted">Fee {fmtKWD(z.delivery_fee)} · min {fmtKWD(z.min_order_amount)} · ~{z.estimated_time_minutes} min</p>
            </div>
            <div className="flex gap-1">
              <span className={`text-xs px-2 py-1 rounded-full ${z.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>{z.status}</span>
              <button onClick={() => setEdit(z)} className="p-1.5 hover:bg-lamazi-secondary/30 rounded-full"><Pencil className="w-4 h-4" /></button>
              <button onClick={async () => { if (window.confirm('Delete zone?')) { await api.delete(`/admin/delivery-zones/${z.id}`); load(); } }} className="p-1.5 hover:bg-rose-100 rounded-full"><Trash2 className="w-4 h-4 text-rose-700" /></button>
            </div>
          </div>
        ))}
        {zones.length === 0 && <p className="text-center text-lamazi-muted py-8">No delivery zones yet.</p>}
      </div>

      {edit && (
        <Modal title={edit.id ? 'Edit zone' : 'New zone'} onClose={() => setEdit(null)}>
          <ZoneForm zone={edit} onSave={async (body) => {
            try {
              if (edit.id) await api.patch(`/admin/delivery-zones/${edit.id}`, body);
              else await api.post('/admin/delivery-zones', body);
              toast.success('Saved'); setEdit(null); load();
            } catch (e) { toast.error(apiError(e)); }
          }} />
        </Modal>
      )}
    </div>
  );
}

function ZoneForm({ zone, onSave }) {
  const [f, setF] = useState({
    zone_name: '', delivery_fee: 0, min_order_amount: 0, estimated_time_minutes: 30,
    coordinates: '[[47.9, 29.3], [48.0, 29.3], [48.0, 29.4], [47.9, 29.4]]',
    status: 'active', ...zone,
    coordinates: typeof zone.coordinates === 'string' ? zone.coordinates : JSON.stringify(zone.coordinates || []),
  });

  const submit = () => {
    try {
      const parsed = JSON.parse(f.coordinates);
      onSave({
        zone_name: f.zone_name,
        delivery_fee: Number(f.delivery_fee),
        min_order_amount: Number(f.min_order_amount),
        estimated_time_minutes: Number(f.estimated_time_minutes),
        coordinates: parsed,
        status: f.status,
      });
    } catch {
      toast.error('Coordinates must be valid JSON');
    }
  };

  return (
    <>
      <Field label="Zone name" value={f.zone_name} onChange={(v) => setF({ ...f, zone_name: v })} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Delivery fee (KWD)" type="number" step="0.001" value={f.delivery_fee} onChange={(v) => setF({ ...f, delivery_fee: v })} />
        <Field label="Min order (KWD)" type="number" step="0.001" value={f.min_order_amount} onChange={(v) => setF({ ...f, min_order_amount: v })} />
      </div>
      <Field label="Estimated time (minutes)" type="number" value={f.estimated_time_minutes} onChange={(v) => setF({ ...f, estimated_time_minutes: Number(v) })} />
      <Field label="Coordinates JSON ([[lng,lat], …])" value={f.coordinates} onChange={(v) => setF({ ...f, coordinates: v })} multiline />
      <div>
        <label className="block text-xs uppercase tracking-widest text-lamazi-muted mb-1">Status</label>
        <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-lamazi-secondary/60 bg-white text-sm">
          <option value="active">Active</option><option value="inactive">Inactive</option>
        </select>
      </div>
      <button onClick={submit} className="btn-primary w-full">Save</button>
    </>
  );
}
