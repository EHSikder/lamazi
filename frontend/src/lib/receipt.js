/**
 * receipt.js
 * Receipt utility for LAMAZI
 * Supports 80mm thermal printers
 * All times displayed in Kuwait Time (UTC+3)
 */

// ── Restaurant Info ────────────────────────────────────────────
const RESTAURANT_NAME     = 'LAMAZI';
const RESTAURANT_NAME_AR  = 'لمازي';
const RESTAURANT_LOCATION = 'Kuwait';
const POWERED_BY          = 'LAMAZI POS';

// ── Date helpers (Kuwait = UTC+3) ──────────────────────────────
const toKuwaitDate = (dateStr) => {
  const d = new Date(dateStr);
  return new Date(d.getTime() + 3 * 60 * 60 * 1000);
};

const formatReceiptDate = (dateStr) => {
  const kd = toKuwaitDate(dateStr);
  const months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];
  return `${kd.getUTCDate()} ${months[kd.getUTCMonth()]} ${kd.getUTCFullYear()}`;
};

const formatReceiptTime = (dateStr) => {
  const kd = toKuwaitDate(dateStr);
  let h = kd.getUTCHours();
  const m = kd.getUTCMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
};

// ── Address formatter ──────────────────────────────────────────
const formatAddress = (addr) => {
  return [
    addr.area,
    addr.block     ? `Block ${addr.block}`       : '',
    addr.street,
    addr.building  ? `Building ${addr.building}` : '',
    addr.floor     ? `Floor ${addr.floor}`       : '',
    addr.apartment ? `Apt ${addr.apartment}`     : '',
  ].filter(Boolean).join(', ');
};

// ── Main HTML generator ────────────────────────────────────────
export const generateReceiptHTML = (order) => {
  const dateStr   = formatReceiptDate(order.created_at);
  const timeStr   = formatReceiptTime(order.created_at);
  const orderType = (order.order_type || 'TAKEAWAY').toUpperCase();
  const billNo    = order.order_number || '0000';

  // Build items rows
  let itemsHTML = '';
  let totalQty  = 0;

  (order.items || []).forEach((item) => {
    const qty   = item.quantity || 1;
    const rate  = (item.unit_price  || 0).toFixed(3);
    const total = (item.total_price || 0).toFixed(3);
    totalQty += qty;

    const name   = item.item_name_en || 'Item';
    const nameAr = item.item_name_ar || '';

    itemsHTML += `
      <tr>
        <td class="item-name">
          ${name}
          ${item.variant_name_en ? `<br><span class="variant">${item.variant_name_en}</span>` : ''}
          ${nameAr ? `<br><span class="arabic">${nameAr}</span>` : ''}`;

    (item.modifiers || []).forEach((mod) => {
      const qty   = mod.quantity && mod.quantity > 1 ? `×${mod.quantity} ` : '';
      const price = mod.price ? ` +${(mod.price * (mod.quantity || 1)).toFixed(3)}` : '';
      itemsHTML += `<br><span class="modifier">+ ${qty}${mod.modifier_name_en || ''}${price}</span>`;
    });

    if (item.notes) {
      itemsHTML += `<br><span class="item-notes">Note: ${item.notes}</span>`;
    }

    itemsHTML += `
        </td>
        <td class="qty">${qty}</td>
        <td class="rate">${rate}</td>
        <td class="total">${total}</td>
      </tr>`;
  });

  const subtotal       = (order.subtotal      || 0).toFixed(3);
  const discountAmount = order.discount_amount || 0;
  const deliveryFee    = order.delivery_fee    || 0;
  const grandTotal     = (order.total_amount   || 0).toFixed(3);

  const isPaid      = order.payment_status === 'paid';
  const paymentInfo = isPaid
    ? `Online Payment${order.transaction_id ? ` (${order.transaction_id})` : ''}`
    : 'Cash on Delivery';

  const deliveryAddr  = order.order_type === 'delivery' && order.delivery_address
    ? formatAddress(order.delivery_address)
    : '';
  const additionalDir = order.delivery_address?.additional_directions || '';

  const visibleNotes = (order.notes || '')
    .replace(/armada_code:[\w-]+/g, '')
    .replace(/tap_id:[\w-]+/g, '')
    .replace(/payment_method:\w+/g, '')
    .trim();

  return `<!DOCTYPE html>
<html dir="ltr">
<head>
  <meta charset="UTF-8">
  <title>Receipt ${billNo}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    @page { size:80mm auto; margin:0; }
    @media print {
      body { width:80mm; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    }
    body {
      font-family:'Courier New', Courier, monospace;
      font-size:13px;
      width:80mm;
      max-width:80mm;
      padding:5mm;
      background:white;
      color:black;
    }
    .header { text-align:center; border-bottom:2px solid black; padding-bottom:8px; margin-bottom:8px; }
    .restaurant-name { font-size:20px; font-weight:bold; letter-spacing:2px; margin-bottom:2px; }
    .restaurant-name-ar { font-family:'Arial','Tahoma',sans-serif; font-size:14px; direction:rtl; margin-bottom:2px; }
    .location { font-size:11px; color:#444; }
    .date-time { font-size:11px; margin-top:4px; font-weight:bold; }
    .arabic { font-family:'Arial','Tahoma',sans-serif; direction:rtl; font-size:11px; }
    .variant { font-size:11px; color:#555; font-style:italic; }
    .bill-info { text-align:center; margin:10px 0; }
    .bill-number { font-size:18px; font-weight:bold; margin:4px 0; }
    .order-type { font-size:12px; text-transform:uppercase; font-weight:bold; }
    .dashed { border-top:1px dashed black; margin:8px 0; }
    .customer-info { font-size:11px; margin:6px 0; }
    .customer-info p { margin:3px 0; font-weight:bold; }
    table { width:100%; border-collapse:collapse; margin:6px 0; }
    th { text-align:left; font-size:10px; border-bottom:1px dashed black; padding:3px 2px; font-weight:bold; }
    th.qty, th.rate, th.total { text-align:right; }
    td { padding:4px 2px; vertical-align:top; font-size:11px; font-weight:bold; }
    td.item-name { max-width:110px; }
    td.qty, td.rate, td.total { text-align:right; white-space:nowrap; }
    .modifier { font-size:10px; color:#b07d3c; font-weight:bold; }
    .item-notes { font-size:10px; color:#666; font-style:italic; }
    .totals { margin:6px 0; }
    .totals-row { display:flex; justify-content:space-between; font-size:11px; margin:3px 0; font-weight:bold; }
    .totals-row.discount { color:#27ae60; }
    .grand-total { border:2px solid black; padding:8px; margin:10px 0; text-align:center; border-radius:4px; }
    .grand-total-label { font-size:13px; font-weight:bold; letter-spacing:1px; }
    .grand-total-arabic { font-family:'Arial','Tahoma',sans-serif; direction:rtl; font-size:11px; color:#444; }
    .grand-total-amount { font-size:22px; font-weight:bold; margin-top:4px; }
    .payment-info { text-align:center; font-size:10px; color:#555; margin:6px 0; font-weight:bold; }
    .delivery-section { font-size:11px; margin:6px 0; font-weight:bold; }
    .delivery-section p { margin:2px 0; }
    .footer { text-align:center; margin-top:10px; padding-top:8px; border-top:1px dashed black; }
    .thank-you { font-size:11px; font-weight:bold; }
    .thank-you-ar { font-family:'Arial','Tahoma',sans-serif; direction:rtl; font-size:11px; margin-top:4px; }
    .powered-by { font-size:10px; color:#aaa; margin-top:8px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="restaurant-name">${RESTAURANT_NAME}</div>
    <div class="restaurant-name-ar">${RESTAURANT_NAME_AR}</div>
    <div class="location">${RESTAURANT_LOCATION}</div>
    <div class="date-time">${dateStr} at ${timeStr}</div>
  </div>

  <div class="bill-info">
    <div style="font-size:11px;font-weight:bold;">Order Receipt</div>
    <div class="bill-number">${billNo}</div>
    <div class="order-type">${orderType}</div>
  </div>

  <div class="dashed"></div>

  <div class="customer-info">
    ${order.customer_name  ? `<p><strong>Customer:</strong> ${order.customer_name}</p>` : ''}
    ${order.customer_phone ? `<p><strong>Phone:</strong> ${order.customer_phone}</p>`   : ''}
  </div>

  <div class="dashed"></div>

  <table>
    <thead>
      <tr>
        <th>Item / <span class="arabic">منتج</span></th>
        <th class="qty">Qty</th>
        <th class="rate">Rate</th>
        <th class="total">Total</th>
      </tr>
    </thead>
    <tbody>${itemsHTML}</tbody>
  </table>

  <div class="dashed"></div>

  <div class="totals">
    <div class="totals-row"><span>Items:</span><span>${totalQty}</span></div>
    <div class="totals-row"><span>Subtotal:</span><span>${subtotal} KWD</span></div>
    ${discountAmount > 0 ? `
    <div class="totals-row discount">
      <span>Discount:</span><span>-${discountAmount.toFixed(3)} KWD</span>
    </div>` : ''}
    ${deliveryFee > 0 ? `
    <div class="totals-row">
      <span>Delivery Fee:</span><span>${deliveryFee.toFixed(3)} KWD</span>
    </div>` : ''}
  </div>

  <div class="grand-total">
    <div class="grand-total-label">GRAND TOTAL</div>
    <div class="grand-total-arabic">المجموع الإجمالي</div>
    <div class="grand-total-amount">د.ك ${grandTotal}</div>
  </div>

  <div class="payment-info">${paymentInfo}</div>

  ${deliveryAddr ? `
  <div class="dashed"></div>
  <div class="delivery-section">
    <p><strong>Deliver to / التوصيل إلى:</strong></p>
    <p>${deliveryAddr}</p>
    ${additionalDir ? `<p style="color:#555;font-style:italic;">${additionalDir}</p>` : ''}
  </div>` : ''}

  ${visibleNotes ? `
  <div class="dashed"></div>
  <div style="font-size:10px;text-align:center;">
    <strong>Notes:</strong> ${visibleNotes}
  </div>` : ''}

  <div class="footer">
    <div class="thank-you">Thank you for choosing</div>
    <div class="thank-you">${RESTAURANT_NAME}!</div>
    <div class="thank-you-ar">شكراً لاختياركم ${RESTAURANT_NAME_AR}</div>
    <div class="powered-by">Powered by ${POWERED_BY}</div>
  </div>
</body>
</html>`;
};

// ── Print via popup window ─────────────────────────────────────
export const printReceipt = (order) => {
  const html = generateReceiptHTML(order);

  const win = window.open('', '_blank', 'width=320,height=640,menubar=no,toolbar=no,location=no,status=no');

  if (!win) {
    console.warn('Popup blocked — falling back to iframe print');
    printViaIframe(html);
    return;
  }

  win.document.write(html);
  win.document.close();

  win.onload = () => {
    setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch (e) {
        console.error('Print error:', e);
      }
      setTimeout(() => win.close(), 1000);
    }, 150);
  };
};

// ── Fallback: iframe print ─────────────────────────────────────
const printViaIframe = (html) => {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:80mm;height:auto;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) return;

  doc.write(html);
  doc.close();

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1500);
    }, 150);
  };
};

// ── Download as PNG (for customers) ───────────────────────────
export const downloadReceiptPNG = async (receiptElement, orderNumber) => {
  const html2canvas = (await import('html2canvas')).default;

  const canvas = await html2canvas(receiptElement, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
  });

  const link = document.createElement('a');
  link.download = `lamazi-receipt-${orderNumber}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
};

export default { generateReceiptHTML, printReceipt, downloadReceiptPNG };