/**
 * OrderReceipt.jsx
 *
 * Dual-purpose receipt component for LAMAZI:
 *   - Admin panel  → shows a "🖨 Print" button (thermal printer)
 *   - Order tracking → shows a "⬇ Save as PNG" button (customer download)
 *
 * Usage – Admin:
 *   <OrderReceipt order={order} mode="print" />
 *
 * Usage – Customer tracking page:
 *   <OrderReceipt order={order} mode="download" />
 */

import React, { useRef, useState } from 'react';
import { printReceipt, downloadReceiptPNG } from '@/lib/receipt';
import { Printer, Download, Loader2 } from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────
const toKuwaitDate = (dateStr) => {
  const d = new Date(dateStr);
  return new Date(d.getTime() + 3 * 60 * 60 * 1000);
};

const formatKuwaitDate = (dateStr) => {
  const kd = toKuwaitDate(dateStr);
  const months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];
  let h = kd.getUTCHours();
  const m = kd.getUTCMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${kd.getUTCDate()} ${months[kd.getUTCMonth()]} ${kd.getUTCFullYear()} · ${h}:${m} ${ampm}`;
};

const formatAddress = (addr) =>
  [
    addr.area,
    addr.block     ? `Block ${addr.block}`     : '',
    addr.street,
    addr.building  ? `Building ${addr.building}` : '',
    addr.floor     ? `Floor ${addr.floor}`     : '',
    addr.apartment ? `Apt ${addr.apartment}`   : '',
  ]
    .filter(Boolean)
    .join(', ');

const fmtKWD = (n) => `${(n || 0).toFixed(3)} KWD`;

// ── Component ──────────────────────────────────────────────────
const OrderReceipt = ({ order, mode = 'both' }) => {
  const receiptRef = useRef(null);
  const [loading, setLoading] = useState(false);

  const handlePrint = () => printReceipt(order);

  const handleDownload = async () => {
    if (!receiptRef.current) return;
    setLoading(true);
    try {
      await downloadReceiptPNG(receiptRef.current, order.order_number);
    } finally {
      setLoading(false);
    }
  };

  const totalItems = order.items?.reduce((s, it) => s + it.quantity, 0) ?? 0;

  const visibleNotes = (order.notes || '')
    .replace(/armada_code:[\w-]+/g, '')
    .replace(/tap_id:[\w-]+/g, '')
    .replace(/payment_method:\w+/g, '')
    .trim();

  const isPaid = order.payment_status === 'paid';
  const paymentLabel = isPaid
    ? `Online Payment${order.transaction_id ? ` · ${order.transaction_id}` : ''}`
    : 'Cash on Delivery';

  return (
    <div>
      {/* ── Action buttons ── */}
      <div className="flex gap-2 mb-4">
        {(mode === 'print' || mode === 'both') && (
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-lamazi-primary text-white text-sm font-medium hover:opacity-90 transition"
          >
            <Printer className="w-4 h-4" />
            Print Receipt
          </button>
        )}
        {(mode === 'download' || mode === 'both') && (
          <button
            onClick={handleDownload}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-lamazi-primary text-lamazi-primary text-sm font-medium hover:bg-lamazi-secondary/30 transition disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {loading ? 'Saving…' : 'Save as PNG'}
          </button>
        )}
      </div>

      {/* ── Receipt preview (also used for PNG capture) ── */}
      <div
        ref={receiptRef}
        className="bg-white text-black"
        style={{
          width: '80mm',
          maxWidth: '80mm',
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: '13px',
          padding: '5mm',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', borderBottom: '2px solid black', paddingBottom: 8, marginBottom: 8 }}>
          <p style={{ fontSize: 20, fontWeight: 'bold', letterSpacing: 2 }}>LAMAZI</p>
          <p style={{ fontFamily: 'Arial, Tahoma, sans-serif', fontSize: 14 }}>لمازي</p>
          <p style={{ fontSize: 11, color: '#444' }}>Kuwait</p>
          <p style={{ fontSize: 11, fontWeight: 'bold', marginTop: 4 }}>{formatKuwaitDate(order.created_at)}</p>
        </div>

        {/* Bill Info */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 'bold' }}>Order Receipt</p>
          <p style={{ fontSize: 18, fontWeight: 'bold', margin: '4px 0' }}>{order.order_number}</p>
          <p style={{ fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' }}>{order.order_type}</p>
        </div>

        <Divider />

        {/* Customer */}
        <div style={{ fontSize: 11, marginBottom: 6 }}>
          <p><strong>Customer:</strong> {order.customer_name || 'Guest'}</p>
          <p><strong>Phone:</strong> {order.customer_phone || 'N/A'}</p>
        </div>

        <Divider />

        {/* Items table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '6px 0' }}>
          <thead>
            <tr>
              <th style={thStyle('left')}>Item / منتج</th>
              <th style={thStyle('center')}>Qty</th>
              <th style={thStyle('right')}>Rate</th>
              <th style={thStyle('right')}>Total</th>
            </tr>
          </thead>
          <tbody>
            {(order.items || []).map((item, i) => (
              <tr key={item.id || i}>
                <td style={{ ...tdStyle, maxWidth: 110 }}>
                  <span style={{ fontWeight: 'bold' }}>{item.item_name_en}</span>
                  {item.variant_name_en && (
                    <><br /><span style={{ fontSize: 10, color: '#555', fontStyle: 'italic' }}>{item.variant_name_en}</span></>
                  )}
                  {item.item_name_ar && (
                    <><br /><span style={{ fontFamily: 'Arial, Tahoma, sans-serif', direction: 'rtl', fontSize: 10 }}>{item.item_name_ar}</span></>
                  )}
                  {(item.modifiers || []).map((mod, mi) => {
                    const qty = mod.quantity && mod.quantity > 1 ? `×${mod.quantity} ` : '';
                    const price = mod.price ? ` +${(mod.price * (mod.quantity || 1)).toFixed(3)}` : '';
                    return (
                      <React.Fragment key={mi}>
                        <br />
                        <span style={{ fontSize: 10, color: '#b07d3c', fontWeight: 'bold' }}>
                          + {qty}{mod.modifier_name_en}{price}
                        </span>
                      </React.Fragment>
                    );
                  })}
                  {item.notes && (
                    <><br /><span style={{ fontSize: 10, color: '#666', fontStyle: 'italic' }}>Note: {item.notes}</span></>
                  )}
                </td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{item.quantity}</td>
                <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>{(item.unit_price || 0).toFixed(3)}</td>
                <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>{(item.total_price || 0).toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <Divider />

        {/* Totals */}
        <div style={{ fontSize: 11, margin: '6px 0' }}>
          <Row label="Items:" value={String(totalItems)} />
          <Row label="Subtotal:" value={fmtKWD(order.subtotal)} />
          {order.discount_amount > 0 && (
            <Row label="Discount:" value={`-${fmtKWD(order.discount_amount)}`} color="#27ae60" />
          )}
          {order.delivery_fee > 0 && (
            <Row label="Delivery:" value={fmtKWD(order.delivery_fee)} />
          )}
        </div>

        {/* Grand Total */}
        <div style={{ border: '2px solid black', padding: 8, margin: '10px 0', textAlign: 'center', borderRadius: 4 }}>
          <p style={{ fontSize: 13, fontWeight: 'bold', letterSpacing: 1 }}>GRAND TOTAL</p>
          <p style={{ fontFamily: 'Arial, Tahoma, sans-serif', direction: 'rtl', fontSize: 11, color: '#444' }}>المجموع الإجمالي</p>
          <p style={{ fontSize: 22, fontWeight: 'bold', marginTop: 4 }}>د.ك {(order.total_amount || 0).toFixed(3)}</p>
        </div>

        {/* Payment */}
        <p style={{ textAlign: 'center', fontSize: 10, color: '#555', fontWeight: 'bold', marginBottom: 6 }}>
          {paymentLabel}
        </p>

        {/* Delivery address */}
        {order.order_type === 'delivery' && order.delivery_address && (
          <>
            <Divider />
            <div style={{ fontSize: 11 }}>
              <p style={{ fontWeight: 'bold', marginBottom: 2 }}>Deliver to / التوصيل إلى:</p>
              <p>{order.customer_name}</p>
              <p>{order.customer_phone}</p>
              <p>{formatAddress(order.delivery_address)}</p>
              {order.delivery_address.additional_directions && (
                <p style={{ color: '#555', fontStyle: 'italic', marginTop: 2 }}>
                  {order.delivery_address.additional_directions}
                </p>
              )}
            </div>
          </>
        )}

        {/* Notes */}
        {visibleNotes && (
          <>
            <Divider />
            <p style={{ fontSize: 10, textAlign: 'center' }}>
              <strong>Notes:</strong> {visibleNotes}
            </p>
          </>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 10, paddingTop: 8, borderTop: '1px dashed black' }}>
          <p style={{ fontSize: 11, fontWeight: 'bold' }}>Thank you for choosing</p>
          <p style={{ fontSize: 11, fontWeight: 'bold' }}>LAMAZI!</p>
          <p style={{ fontFamily: 'Arial, Tahoma, sans-serif', direction: 'rtl', fontSize: 11, marginTop: 4 }}>
            شكراً لاختياركم لمازي
          </p>
          <p style={{ fontSize: 10, color: '#aaa', marginTop: 8 }}>Powered by LAMAZI POS</p>
        </div>
      </div>
    </div>
  );
};

// ── Small helpers ──────────────────────────────────────────────
const Divider = () => (
  <div style={{ borderTop: '1px dashed black', margin: '8px 0' }} />
);

const thStyle = (align) => ({
  textAlign: align,
  fontSize: 10,
  borderBottom: '1px dashed black',
  padding: '3px 2px',
  fontWeight: 'bold',
});

const tdStyle = {
  padding: '4px 2px',
  verticalAlign: 'top',
  fontSize: 11,
  fontWeight: 'bold',
};

const Row = ({ label, value, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', margin: '3px 0', fontWeight: 'bold', color: color || 'inherit' }}>
    <span>{label}</span>
    <span>{value}</span>
  </div>
);

export default OrderReceipt;
