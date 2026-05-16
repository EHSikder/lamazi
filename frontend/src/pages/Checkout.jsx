import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { api, apiError } from '@/lib/api';
import { fmtKWD, getGuestId } from '@/lib/utils-app';
import { toast } from 'sonner';
import { MapContainer, TileLayer, Marker, Polygon, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Crosshair, Banknote, CreditCard, Bike, Store, AlertCircle, ArrowLeft, AlertTriangle } from 'lucide-react';

// fix default marker icons (Leaflet ships them via images CDN by default)
const defaultIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

const KUWAIT_CENTRE = [29.3375, 47.9744];

function MapRecenter({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, 14, { duration: 0.6 });
  }, [position, map]);
  return null;
}

function MapClickHandler({ onPick }) {
  useMapEvents({
    click: (e) => onPick([e.latlng.lat, e.latlng.lng]),
  });
  return null;
}

// Nominatim reverse geocode → returns parsed Kuwait address parts
async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en&addressdetails=1`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error('Geocoding service unavailable');
  const data = await res.json();
  const a = data?.address || {};
  return {
    area: a.city || a.town || a.suburb || a.village || a.neighbourhood || a.county || '',
    block: a.suburb || a.neighbourhood || a.quarter || '',
    street: a.road || a.pedestrian || '',
    postcode: a.postcode || '',
  };
}

// Ray casting point-in-polygon. Coords expected as [[lng,lat],...]
function pointInPolygon([lng, lat], polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = ((yi > lat) !== (yj > lat))
      && (lng < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Auto-detect [lat,lng] vs [lng,lat] storage and normalise to [lng, lat]
// (Kuwait: lat ~28–30, lng ~46–49 — if first value > 45 it's lng-first).
function normaliseRingToLngLat(ring) {
  if (!Array.isArray(ring) || ring.length === 0) return [];
  // Some payloads come as GeoJSON: { type:'Polygon', coordinates:[[[lng,lat],...]] }
  // Strip if needed (already handled by caller, but be defensive).
  const first = ring[0];
  if (!Array.isArray(first) || first.length < 2) return [];
  const sample = Number(first[0]);
  // If first value looks like a Kuwait longitude (>45) we already have [lng,lat].
  const isLngFirst = Math.abs(sample) > 45;
  return ring
    .map((pt) => {
      const a = Number(pt[0]);
      const b = Number(pt[1]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      return isLngFirst ? [a, b] : [b, a];
    })
    .filter(Boolean);
}

export default function Checkout() {
  const navigate = useNavigate();
  const { items, subtotal, clear, hydrated } = useCart();
  const { user, profile, refreshProfile } = useAuth();

  const [orderType, setOrderType] = useState('delivery');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [settings, setSettings] = useState({ cod_enabled: true, online_enabled: true, delivery_fee: 0, min_order_amount: 0 });
  const [branchStatus, setBranchStatus] = useState({ is_open: true });
  const [zones, setZones] = useState([]);
  const [loyalty, setLoyalty] = useState({ enabled: false });

  const [addr, setAddr] = useState({ area: '', block: '', street: '', building: '', floor: '', apartment: '', additional_directions: '' });
  const [position, setPosition] = useState(null);  // [lat, lng]
  const [pinConfirmed, setPinConfirmed] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // checkout extras (from bag)
  const [coupon, setCoupon] = useState(null);
  const [pointsUsed, setPointsUsed] = useState(0);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    if (placing) return;
    if (!hydrated) return;  // wait for cart to load from localStorage before redirecting
    if (items.length === 0) navigate('/bag');
  }, [items, navigate, placing, hydrated]);

  useEffect(() => {
    api.get('/settings').then(({ data }) => {
      setSettings(data);
      if (!data.cod_enabled && data.online_enabled) setPaymentMethod('tap');
      else if (data.cod_enabled && !data.online_enabled) setPaymentMethod('cash');
    });
    api.get('/branch/status').then(({ data }) => setBranchStatus(data));
    api.get('/delivery-zones').then(({ data }) => setZones(data || []));
    api.get('/loyalty/settings').then(({ data }) => setLoyalty(data));

    try {
      const raw = sessionStorage.getItem('lamazi_checkout_state');
      if (raw) {
        const s = JSON.parse(raw);
        setCoupon(s.coupon || null);
        setPointsUsed(s.points_used || 0);
        setLoyaltyDiscount(s.loyalty_discount || 0);
      }
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setPhone(profile.phone || '');
      setEmail(profile.email || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const matchedZone = useMemo(() => {
    if (!position) return null;
    const [lat, lng] = position;
    for (const z of zones) {
      const coords = z.coordinates;
      const rawRing = Array.isArray(coords) ? coords : (coords?.coordinates?.[0] || []);
      if (!rawRing?.length) continue;
      const ring = normaliseRingToLngLat(rawRing);
      if (ring.length < 3) continue;
      if (pointInPolygon([lng, lat], ring)) return z;
    }
    return null;
  }, [position, zones]);

  const deliveryFee = orderType === 'delivery'
    ? (matchedZone ? Number(matchedZone.delivery_fee || 0) : Number(settings.delivery_fee || 0))
    : 0;
  const couponDiscount = coupon?.discount_amount || 0;

  const subtotalAfterDisc = Math.max(0, subtotal - couponDiscount - loyaltyDiscount);
  const total = subtotalAfterDisc + deliveryFee;

  const pointsToEarn = useMemo(() => {
    if (!loyalty.enabled || !user) return 0;
    if (subtotal < Number(loyalty.min_order_amount || 0)) return 0;
    return Math.floor(subtotalAfterDisc * Number(loyalty.points_per_kwd || 0));
  }, [loyalty, subtotal, subtotalAfterDisc, user]);

  const detectMap = useCallback(async () => {
    // Build a Kuwait address string and geocode via Nominatim
    const query = [addr.area, addr.block && `Block ${addr.block}`, addr.street && `Street ${addr.street}`, addr.building && `Building ${addr.building}`, 'Kuwait']
      .filter(Boolean).join(', ');
    if (!query.trim() || !addr.area) {
      toast.error('Fill at least Area, Block and Building, then try again');
      return;
    }
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=kw`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      const data = await res.json();
      if (data?.[0]) {
        const lat = Number(data[0].lat);
        const lng = Number(data[0].lon);
        setPosition([lat, lng]);
        setPinConfirmed(true);
        toast.success('Pin dropped on map');
      } else {
        toast.error('Could not locate address on map. Please refine your address or click directly on the map.');
      }
    } catch (e) {
      toast.error('Geocoding failed — please click the map or use My Location');
    }
  }, [addr]);

  // Debounce ref for map clicks (Nominatim rate limit: 1 req/sec)
  const reverseGeoBusyRef = React.useRef(false);

  const handleMapPick = useCallback(async (coords) => {
    setPosition(coords);
    setPinConfirmed(true);
    if (reverseGeoBusyRef.current) return;
    reverseGeoBusyRef.current = true;
    setTimeout(() => { reverseGeoBusyRef.current = false; }, 1100);
    try {
      const parts = await reverseGeocode(coords[0], coords[1]);
      setAddr((a) => ({
        ...a,
        area: parts.area || a.area,
        block: parts.block || a.block,
        street: parts.street || a.street,
      }));
      toast.success('Address auto-filled from map');
    } catch {
      toast.error('Could not look up address from map. You can type it manually.');
    }
  }, []);

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported in this browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = [pos.coords.latitude, pos.coords.longitude];
        setPosition(coords);
        setPinConfirmed(true);
        try {
          const parts = await reverseGeocode(coords[0], coords[1]);
          setAddr((a) => ({
            ...a,
            area: parts.area || a.area,
            block: parts.block || a.block,
            street: parts.street || a.street,
          }));
          toast.success('Location captured & address auto-filled');
        } catch {
          toast.success('Location captured');
        }
      },
      () => toast.error('Could not get location. Please allow access and try again.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  const placeOrder = async () => {
    if (!name.trim()) { toast.error('Please enter your name'); return; }
    if (!phone.trim()) { toast.error('Please enter your phone number'); return; }
    if (orderType === 'delivery') {
      if (!addr.area || !addr.block || !addr.building) {
        toast.error('Area, Block and Building are required'); return;
      }
      if (!pinConfirmed || !position) {
        toast.error('Please confirm your location on the map'); return;
      }
      if (zones.length > 0 && !matchedZone) {
        toast.error('Delivery is not available in your area yet'); return;
      }
      if (matchedZone && subtotal < Number(matchedZone.min_order_amount || 0)) {
        toast.error(`Minimum order for ${matchedZone.zone_name} is ${fmtKWD(matchedZone.min_order_amount)}`); return;
      }
    }
    if (settings.min_order_amount && subtotal < Number(settings.min_order_amount)) {
      toast.error(`Minimum order amount is ${fmtKWD(settings.min_order_amount)}`); return;
    }
    if (!branchStatus.is_open) {
      toast.error('Restaurant is currently closed'); return;
    }

    const body = {
      order_type: orderType,
      customer_name: name.trim(),
      customer_phone: phone.trim(),
      customer_email: email.trim() || null,
      customer_id: user?.id || null,
      guest_id: user ? null : getGuestId(),
      delivery_address: orderType === 'delivery' ? {
        ...addr,
        street: addr.street || '0',
        geo_lat: position?.[0],
        geo_lng: position?.[1],
      } : null,
      delivery_instructions: orderType === 'delivery' ? (addr.additional_directions || null) : null,
      items: items.map((it) => ({
        item_id: it.item_id,
        item_name_en: it.item_name_en,
        item_name_ar: it.item_name_ar,
        variant_id: it.variant_id,
        variant_name_en: it.variant_name_en,
        variant_name_ar: it.variant_name_ar,
        quantity: it.quantity,
        unit_price: it.unit_price,
        total_price: it.total_price,
        notes: it.notes,
        modifiers: it.modifiers || [],
      })),
      subtotal: Number(subtotal.toFixed(3)),
      discount_amount: Number((couponDiscount + loyaltyDiscount).toFixed(3)),
      delivery_fee: Number(deliveryFee.toFixed(3)),
      total_amount: Number(total.toFixed(3)),
      notes: orderNotes || null,
      coupon_code: coupon?.code || null,
      payment_method: paymentMethod,
      loyalty_points_used: pointsUsed,
      loyalty_points_earned: 0,  // awarded on delivered, but we record intent
    };

    setSubmitting(true);
    setPlacing(true);
    try {
      const { data } = await api.post('/orders', body);
      sessionStorage.removeItem('lamazi_checkout_state');
      if (data.requires_payment && data.payment_url) {
        // Don't clear cart yet — user may need it if payment fails.
        // Cart will be cleared on /payment-result when status == paid.
        sessionStorage.setItem('lamazi_pending_order_id', data.id);
        window.location.href = data.payment_url;
        return;
      }
      navigate(`/order/${data.id}`, { replace: true });
      // clear after navigation lands so the empty-bag redirect effect cannot fire
      setTimeout(() => clear(), 0);
    } catch (e) {
      toast.error(apiError(e, 'Could not place order'));
      setPlacing(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container-lamazi py-10" data-testid="checkout-page">
      <Link to="/bag" className="inline-flex items-center gap-2 text-sm text-lamazi-primary hover:underline mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to bag
      </Link>
      <h1 className="font-display text-3xl sm:text-4xl font-bold text-lamazi-primary mb-1">Checkout</h1>
      <p className="text-sm text-lamazi-muted mb-8">Almost there — one more step.</p>

      {!branchStatus.is_open && (
        <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200" data-testid="closed-banner">
          <AlertCircle className="w-5 h-5 text-rose-700 mt-0.5 shrink-0" />
          <div className="text-sm text-rose-800">
            <p className="font-medium">We're currently closed</p>
            <p>{branchStatus.reason || 'Please try again during operating hours.'}</p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Method toggle */}
          <div className="cream-card">
            <p className="text-xs uppercase tracking-widest text-lamazi-muted mb-3">Order method</p>
            <div className="flex gap-3">
              <button
                onClick={() => setOrderType('delivery')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full border transition-colors ${orderType === 'delivery' ? 'bg-lamazi-primary text-lamazi-neutral border-lamazi-primary' : 'bg-white border-lamazi-secondary/60'}`}
                data-testid="checkout-type-delivery"
              >
                <Bike className="w-4 h-4" /> Delivery
              </button>
              <button
                onClick={() => setOrderType('takeaway')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full border transition-colors ${orderType === 'takeaway' ? 'bg-lamazi-primary text-lamazi-neutral border-lamazi-primary' : 'bg-white border-lamazi-secondary/60'}`}
                data-testid="checkout-type-pickup"
              >
                <Store className="w-4 h-4" /> Pickup
              </button>
            </div>
          </div>

          {/* Delivery address + map */}
          {orderType === 'delivery' && (
            <div className="bg-white rounded-2xl border border-lamazi-secondary/40 p-6" data-testid="checkout-address">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-xl text-lamazi-primary font-semibold">Delivery address</h3>
                <button onClick={useMyLocation} className="btn-gold py-2 px-4 text-xs" data-testid="checkout-use-location">
                  <Crosshair className="w-3.5 h-3.5" /> Use My Location
                </button>
              </div>

              <div className="rounded-2xl overflow-hidden h-[320px] border border-lamazi-secondary/40 mb-4">
                <MapContainer center={position || KUWAIT_CENTRE} zoom={11} style={{ height: '100%', width: '100%', cursor: 'crosshair' }}>
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="&copy; OpenStreetMap"
                  />
                  <MapClickHandler onPick={handleMapPick} />
                  {zones.map((z) => {
                    const rawRing = Array.isArray(z.coordinates) ? z.coordinates : (z.coordinates?.coordinates?.[0] || []);
                    if (!rawRing?.length) return null;
                    // Convert to [lat, lng] for Leaflet (which expects that order)
                    const lngLat = normaliseRingToLngLat(rawRing);
                    const positions = lngLat.map(([lng, lat]) => [lat, lng]);
                    return <Polygon key={z.id} positions={positions} pathOptions={{ color: '#58000e', weight: 1.5, fillOpacity: 0.06 }} />;
                  })}
                  {position && <Marker position={position} />}
                  {position && <MapRecenter position={position} />}
                </MapContainer>
              </div>

              <p className="text-xs text-lamazi-muted mb-3 -mt-2">
                Tip: tap or click anywhere on the map to drop a pin — we'll auto-fill the address fields.
              </p>

              {/* Delivery zone warning - prominent placement directly below map */}
              {position && zones.length > 0 && !matchedZone && (
                <div className="mb-4 p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 flex items-start gap-3" data-testid="zone-warning">
                  <AlertTriangle className="w-6 h-6 text-rose-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-lg font-bold text-rose-800">Delivery not available in your area</p>
                    <p className="text-sm text-rose-700 mt-0.5">Please pick a different location inside our delivery zones (shown in maroon on the map), or switch to Pickup.</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Input label="Area*" value={addr.area} onChange={(v) => setAddr((a) => ({ ...a, area: v }))} testid="addr-area" />
                <Input label="Block*" value={addr.block} onChange={(v) => setAddr((a) => ({ ...a, block: v }))} testid="addr-block" />
                <Input label="Street" value={addr.street} onChange={(v) => setAddr((a) => ({ ...a, street: v }))} testid="addr-street" />
                <Input label="Building*" value={addr.building} onChange={(v) => setAddr((a) => ({ ...a, building: v }))} testid="addr-building" />
                <Input label="Floor" value={addr.floor} onChange={(v) => setAddr((a) => ({ ...a, floor: v }))} testid="addr-floor" />
                <Input label="Apartment" value={addr.apartment} onChange={(v) => setAddr((a) => ({ ...a, apartment: v }))} testid="addr-apartment" />
                <div className="col-span-2 sm:col-span-3">
                  <Input label="Additional directions" value={addr.additional_directions} onChange={(v) => setAddr((a) => ({ ...a, additional_directions: v }))} testid="addr-notes" />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <button onClick={detectMap} className="btn-outline flex-1 py-2.5 text-sm" data-testid="checkout-detect-map">
                  <MapPin className="w-4 h-4" /> Detect on Map
                </button>
                {pinConfirmed ? (
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-full px-4 py-2 border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Location confirmed
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-amber-800 bg-amber-50 rounded-full px-4 py-2 border border-amber-200">
                    <AlertCircle className="w-4 h-4" /> Drop a pin on the map to continue
                  </div>
                )}
              </div>

              {position && matchedZone && (
                <p className="mt-3 text-sm font-medium text-emerald-700">
                  Delivers to <span className="font-semibold">{matchedZone.zone_name}</span> · {fmtKWD(matchedZone.delivery_fee)} · ~{matchedZone.estimated_time_minutes} min
                </p>
              )}
            </div>
          )}

          {/* Customer details */}
          <div className="bg-white rounded-2xl border border-lamazi-secondary/40 p-6" data-testid="checkout-customer">
            <h3 className="font-display text-xl text-lamazi-primary font-semibold mb-4">Your details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Full name*" value={name} onChange={setName} testid="customer-name" />
              <Input label="Phone*" value={phone} onChange={setPhone} testid="customer-phone" />
              <div className="sm:col-span-2">
                <Input label="Email" type="email" value={email} onChange={setEmail} testid="customer-email" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs uppercase tracking-widest text-lamazi-muted mb-1">Order notes</label>
                <textarea
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-lamazi-secondary/60 bg-lamazi-neutral text-sm focus:outline-none focus:border-lamazi-primary"
                  placeholder="Any special instructions for the kitchen?"
                  data-testid="customer-notes"
                />
              </div>
            </div>
          </div>

          {/* Payment method */}
          <div className="bg-white rounded-2xl border border-lamazi-secondary/40 p-6" data-testid="checkout-payment">
            <h3 className="font-display text-xl text-lamazi-primary font-semibold mb-4">Payment</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {settings.cod_enabled && (
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`flex items-center gap-3 p-4 rounded-xl border transition-colors text-left ${paymentMethod === 'cash' ? 'border-lamazi-primary bg-lamazi-secondary/30' : 'border-lamazi-secondary/60 bg-lamazi-neutral'}`}
                  data-testid="checkout-payment-cod"
                >
                  <Banknote className="w-5 h-5 text-lamazi-primary" />
                  <div>
                    <p className="font-medium text-lamazi-primary">Cash on Delivery</p>
                    <p className="text-xs text-lamazi-muted">Pay the rider when your order arrives</p>
                  </div>
                </button>
              )}
              {settings.online_enabled && (
                <button
                  onClick={() => setPaymentMethod('tap')}
                  className={`flex items-center gap-3 p-4 rounded-xl border transition-colors text-left ${paymentMethod === 'tap' ? 'border-lamazi-primary bg-lamazi-secondary/30' : 'border-lamazi-secondary/60 bg-lamazi-neutral'}`}
                  data-testid="checkout-payment-tap"
                >
                  <CreditCard className="w-5 h-5 text-lamazi-primary" />
                  <div>
                    <p className="font-medium text-lamazi-primary">Online (Tap Payments)</p>
                    <p className="text-xs text-lamazi-muted">KNET, Visa, Mastercard — secure 3D-Secure</p>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Summary */}
        <aside>
          <div className="cream-card sticky top-24" data-testid="checkout-summary">
            <h3 className="font-display text-xl text-lamazi-primary font-semibold mb-4">Order summary</h3>
            <div className="space-y-2 text-sm mb-3 max-h-48 overflow-y-auto pr-1">
              {items.map((it, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span className="truncate text-lamazi-ink/90">{it.quantity} × {it.item_name_en}</span>
                  <span className="text-lamazi-ink/90 shrink-0">{fmtKWD(it.total_price)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-lamazi-secondary/60 pt-3 space-y-1.5 text-sm">
              <Row label="Subtotal" value={fmtKWD(subtotal)} />
              {couponDiscount > 0 && <Row label={`Coupon ${coupon?.code || ''}`} value={`− ${fmtKWD(couponDiscount)}`} positive />}
              {loyaltyDiscount > 0 && <Row label="Loyalty" value={`− ${fmtKWD(loyaltyDiscount)}`} positive />}
              <Row label="Delivery fee" value={fmtKWD(deliveryFee)} />
              <div className="border-t border-lamazi-secondary/60 my-2" />
              <div className="flex justify-between items-baseline">
                <span className="text-lamazi-ink font-semibold">Total</span>
                <span className="font-display text-2xl font-bold text-lamazi-primary" data-testid="checkout-total">{fmtKWD(total)}</span>
              </div>
              {pointsToEarn > 0 && (
                <p className="text-xs text-emerald-700 pt-1">You'll earn ~{pointsToEarn} points after delivery</p>
              )}
            </div>
            <button
              onClick={placeOrder}
              disabled={
                submitting
                || !branchStatus.is_open
                || (orderType === 'delivery' && (!pinConfirmed || !position || (zones.length > 0 && !matchedZone)))
                || (settings.min_order_amount > 0 && subtotal < Number(settings.min_order_amount))
              }
              className="btn-primary w-full mt-5"
              data-testid="checkout-place-order-btn"
            >
              {submitting ? 'Placing order…' : paymentMethod === 'tap' ? `Pay ${fmtKWD(total)}` : 'Place Order'}
            </button>
            {orderType === 'delivery' && (!pinConfirmed || !position) && (
              <p className="text-xs text-amber-700 text-center mt-2">⚠ Confirm a delivery location on the map first.</p>
            )}
            {orderType === 'delivery' && position && zones.length > 0 && !matchedZone && (
              <p className="text-xs text-rose-700 text-center mt-2">⚠ Your area is outside our delivery zones.</p>
            )}
            {settings.min_order_amount > 0 && subtotal < Number(settings.min_order_amount) && (
              <p className="text-xs text-rose-700 text-center mt-2">⚠ Minimum order is {fmtKWD(settings.min_order_amount)}.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text', testid }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-widest text-lamazi-muted mb-1">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl border border-lamazi-secondary/60 bg-lamazi-neutral text-sm focus:outline-none focus:border-lamazi-primary"
        data-testid={testid}
      />
    </div>
  );
}

function Row({ label, value, positive }) {
  return (
    <div className="flex justify-between">
      <span className="text-lamazi-muted">{label}</span>
      <span className={positive ? 'text-emerald-700 font-medium' : 'text-lamazi-ink/90 font-medium'}>{value}</span>
    </div>
  );
}
