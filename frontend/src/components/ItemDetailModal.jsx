import React, { useEffect, useState, useMemo } from 'react';
import { X, Plus, Minus } from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { useCart } from '@/contexts/CartContext';
import { useLang } from '@/contexts/LangContext';
import { fmtKWD } from '@/lib/utils-app';
import { toast } from 'sonner';

export default function ItemDetailModal({ open, itemId, onClose }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [variantId, setVariantId] = useState(null);
  const [mods, setMods] = useState({});      // groupId -> [{modifierId, quantity}]
  const [notes, setNotes] = useState('');
  const [qty, setQty] = useState(1);
  const { addItem } = useCart();
  const { L, t } = useLang();

  useEffect(() => {
    if (!open || !itemId) return;
    setLoading(true);
    setNotes('');
    setQty(1);
    api.get(`/menu/items/${itemId}`)
      .then(({ data: d }) => {
        setData(d);
        setVariantId(d.variants?.[0]?.id || null);
        // initialise modifiers
        const seed = {};
        for (const g of (d.modifier_groups || [])) seed[g.id] = [];
        setMods(seed);
      })
      .catch((e) => toast.error(apiError(e, 'Could not load item')))
      .finally(() => setLoading(false));
  }, [open, itemId]);

  const variant = useMemo(
    () => data?.variants?.find((v) => v.id === variantId) || null,
    [data, variantId],
  );

  const baseUnit = useMemo(() => {
    const p = Number(data?.base_price || 0);
    return p + Number(variant?.price_adjustment || 0);
  }, [data, variant]);

  const modCost = useMemo(() => {
    let total = 0;
    for (const g of (data?.modifier_groups || [])) {
      const sel = mods[g.id] || [];
      for (const s of sel) {
        const m = (g.modifiers || []).find((x) => x.id === s.id);
        if (!m) continue;
        total += Number(m.price || 0) * (s.quantity || 1);
      }
    }
    return total;
  }, [data, mods]);

  const totalPrice = baseUnit * qty + modCost;

  const toggleMod = (group, modifier) => {
    setMods((cur) => {
      const sel = cur[group.id] || [];
      const exists = sel.find((s) => s.id === modifier.id);
      if (group.max_select === 1) {
        return { ...cur, [group.id]: exists ? [] : [{ id: modifier.id, quantity: 1 }] };
      }
      if (exists) return { ...cur, [group.id]: sel.filter((s) => s.id !== modifier.id) };
      if (group.max_select && sel.length >= group.max_select) {
        toast.error(`Select up to ${group.max_select}`);
        return cur;
      }
      return { ...cur, [group.id]: [...sel, { id: modifier.id, quantity: 1 }] };
    });
  };

  const setModQty = (groupId, modifierId, delta) => {
    setMods((cur) => {
      const sel = cur[groupId] || [];
      const idx = sel.findIndex((s) => s.id === modifierId);
      if (idx < 0) return cur;
      const newQty = Math.max(1, (sel[idx].quantity || 1) + delta);
      const copy = [...sel];
      copy[idx] = { ...copy[idx], quantity: newQty };
      return { ...cur, [groupId]: copy };
    });
  };

  const handleAdd = () => {
    if (!data) return;
    // validate required groups
    for (const g of (data.modifier_groups || [])) {
      if (g.required && (mods[g.id] || []).length < (g.min_select || 1)) {
        toast.error(`Please select ${g.name_en}`);
        return;
      }
    }
    const flatMods = [];
    for (const g of (data.modifier_groups || [])) {
      for (const s of (mods[g.id] || [])) {
        const m = (g.modifiers || []).find((x) => x.id === s.id);
        if (!m) continue;
        flatMods.push({
          id: m.id,
          modifier_group_name_en: g.name_en,
          name_en: m.name_en,
          name_ar: m.name_ar,
          price: Number(m.price || 0),
          quantity: s.quantity || 1,
        });
      }
    }
    addItem({
      item_id: data.id,
      item_name_en: data.name_en,
      item_name_ar: data.name_ar,
      image_url: data.image_url,
      variant_id: variantId || null,
      variant_name_en: variant?.name_en,
      variant_name_ar: variant?.name_ar,
      quantity: qty,
      unit_price: baseUnit,
      total_price: totalPrice,
      notes: notes || null,
      modifiers: flatMods,
    });
    toast.success(`Added to bag`);
    onClose?.();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm overflow-auto p-0 sm:p-6" data-testid="item-detail-modal">
      <div className="relative bg-lamazi-neutral w-full sm:max-w-4xl sm:rounded-2xl overflow-hidden shadow-2xl animate-fade-up flex flex-col sm:flex-row max-h-[95vh] sm:max-h-[85vh]">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-2 rounded-full bg-white/90 hover:bg-white"
          aria-label="close"
          data-testid="item-modal-close"
        >
          <X className="w-5 h-5 text-lamazi-primary" />
        </button>

        {/* Image */}
        <div className="sm:w-2/5 bg-lamazi-secondary/30 flex-shrink-0">
          <div className="aspect-square w-full overflow-hidden">
            {data?.image_url ? (
              <img src={data.image_url} alt={data.name_en} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-lamazi-muted">No image</div>
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="sm:w-3/5 flex-1 overflow-y-auto p-6 sm:p-8 space-y-5">
          {loading ? (
            <div className="text-center py-12 text-lamazi-muted">Loading…</div>
          ) : data ? (
            <>
              <div>
                <h3 className="font-display text-3xl text-lamazi-primary leading-tight">{L(data, 'name')}</h3>
                {L(data, 'description') && (
                  <p className="text-sm text-lamazi-muted mt-1 leading-relaxed">{L(data, 'description')}</p>
                )}
                <p className="mt-3 text-2xl font-semibold text-lamazi-primary">{fmtKWD(baseUnit)}</p>
              </div>

              {/* Variants */}
              {data.variants?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-lamazi-muted mb-2">Choose Variant</p>
                  <div className="flex flex-wrap gap-2">
                    {data.variants.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setVariantId(v.id)}
                        className={`px-4 py-2 rounded-full border text-sm transition-colors ${
                          variantId === v.id
                            ? 'bg-lamazi-primary text-lamazi-neutral border-lamazi-primary'
                            : 'border-lamazi-secondary text-lamazi-ink hover:border-lamazi-primary'
                        }`}
                        data-testid={`variant-${v.id}`}
                      >
                        {L(v, 'name')}
                        {v.price_adjustment ? ` (+${fmtKWD(v.price_adjustment)})` : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Modifier Groups */}
              {(data.modifier_groups || []).map((g) => (
                <div key={g.id}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-lamazi-muted mb-2">
                    {L(g, 'name')} {g.required && <span className="text-lamazi-primary">*</span>}
                    {g.max_select > 1 && <span className="text-lamazi-muted/70 normal-case ml-1">(select up to {g.max_select})</span>}
                  </p>
                  <div className="space-y-2">
                    {(g.modifiers || []).map((m) => {
                      const sel = (mods[g.id] || []).find((s) => s.id === m.id);
                      const isSelected = Boolean(sel);
                      return (
                        <div key={m.id} className={`flex items-center justify-between rounded-xl border p-3 ${isSelected ? 'border-lamazi-primary bg-lamazi-secondary/30' : 'border-lamazi-secondary/40 bg-white'}`}>
                          <button onClick={() => toggleMod(g, m)} className="flex-1 text-left" data-testid={`modifier-${m.id}`}>
                            <p className="text-sm font-medium text-lamazi-ink">{L(m, 'name')}</p>
                            <p className="text-xs text-lamazi-muted">{m.price > 0 ? `+ ${fmtKWD(m.price)}` : 'Included'}</p>
                          </button>
                          {isSelected && (
                            <div className="flex items-center gap-2 ml-3">
                              <button onClick={() => setModQty(g.id, m.id, -1)} className="p-1.5 rounded-full bg-white border border-lamazi-secondary"><Minus className="w-3 h-3" /></button>
                              <span className="w-6 text-center text-sm">{sel.quantity || 1}</span>
                              <button onClick={() => setModQty(g.id, m.id, 1)} className="p-1.5 rounded-full bg-white border border-lamazi-secondary"><Plus className="w-3 h-3" /></button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Notes */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-lamazi-muted mb-2">Notes (optional)</p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Special requests, allergies, message on cake…"
                  className="w-full rounded-xl border border-lamazi-secondary/60 bg-white px-4 py-2.5 text-sm focus:outline-none focus:border-lamazi-primary"
                  data-testid="item-notes-input"
                />
              </div>

              {/* Qty + CTA */}
              <div className="flex items-center justify-between gap-4 pt-2 sticky bottom-0 bg-lamazi-neutral pb-1">
                <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-white border border-lamazi-secondary/60">
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="p-1" data-testid="qty-minus"><Minus className="w-4 h-4 text-lamazi-primary" /></button>
                  <span className="min-w-[24px] text-center font-semibold">{qty}</span>
                  <button onClick={() => setQty((q) => q + 1)} className="p-1" data-testid="qty-plus"><Plus className="w-4 h-4 text-lamazi-primary" /></button>
                </div>
                <button onClick={handleAdd} className="btn-primary flex-1" data-testid="item-add-to-bag">
                  {t('add_to_bag')} — {fmtKWD(totalPrice)}
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-lamazi-muted">Item not found</div>
          )}
        </div>
      </div>
    </div>
  );
}
