import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';

const CartContext = createContext(null);
const STORAGE_KEY = 'lamazi_cart_v1';

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch { /* noop */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch { /* noop */ }
  }, [items, hydrated]);

  const lineKey = (it) => {
    const mods = (it.modifiers || []).map((m) => `${m.id || m.name_en}:${m.quantity || 1}`).sort().join('|');
    return [it.item_id, it.variant_id || '', mods, (it.notes || '').trim()].join('::');
  };

  const addItem = useCallback((newItem) => {
    setItems((prev) => {
      const key = lineKey(newItem);
      const idx = prev.findIndex((p) => lineKey(p) === key);
      if (idx >= 0) {
        const copy = [...prev];
        const cur = copy[idx];
        const qty = cur.quantity + newItem.quantity;
        copy[idx] = { ...cur, quantity: qty, total_price: cur.unit_price * qty
          + (cur.modifiers || []).reduce((s, m) => s + (m.price || 0) * (m.quantity || 1), 0) };
        return copy;
      }
      return [...prev, { ...newItem, _key: key }];
    });
  }, []);

  const updateQty = useCallback((key, qty) => {
    if (qty <= 0) {
      setItems((prev) => prev.filter((p) => lineKey(p) !== key));
      return;
    }
    setItems((prev) => prev.map((p) => {
      if (lineKey(p) !== key) return p;
      const modCost = (p.modifiers || []).reduce((s, m) => s + (m.price || 0) * (m.quantity || 1), 0);
      return { ...p, quantity: qty, total_price: p.unit_price * qty + modCost };
    }));
  }, []);

  const removeItem = useCallback((key) => {
    setItems((prev) => prev.filter((p) => lineKey(p) !== key));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const subtotal = useMemo(
    () => items.reduce((s, p) => s + (p.total_price || 0), 0),
    [items],
  );

  const itemCount = useMemo(
    () => items.reduce((s, p) => s + (p.quantity || 0), 0),
    [items],
  );

  return (
    <CartContext.Provider value={{ items, subtotal, itemCount, hydrated, addItem, updateQty, removeItem, clear, lineKey }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
