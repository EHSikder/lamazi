import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { Loader2, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';

export default function PaymentResult() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying');  // verifying | success | failed
  const [data, setData] = useState({});
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    const tapId = params.get('tap_id');
    const orderId = params.get('order_id');
    if (!tapId && !orderId) {
      setStatus('failed');
      setData({ message: 'Invalid payment reference' });
      return;
    }
    const qs = new URLSearchParams();
    if (tapId) qs.append('tap_id', tapId);
    if (orderId) qs.append('order_id', orderId);

    api.get(`/payment/verify?${qs.toString()}`)
      .then(({ data: r }) => {
        if (r.success && r.status === 'paid') {
          setStatus('success');
          setData(r);
        } else if (r.status === 'pending' && attempts < 5) {
          setTimeout(() => setAttempts((a) => a + 1), 2000);
        } else {
          setStatus('failed');
          setData({ message: r.message || 'Payment was not completed' });
        }
      })
      .catch(() => {
        setStatus('failed');
        setData({ message: 'Could not verify payment' });
      });
  }, [params, attempts]);

  return (
    <div className="container-lamazi py-16 flex items-center justify-center min-h-[60vh]" data-testid="payment-result">
      <div className="cream-card max-w-md w-full text-center">
        {status === 'verifying' && (
          <>
            <Loader2 className="w-10 h-10 text-lamazi-primary mx-auto mb-3 animate-spin" />
            <h1 className="font-display text-2xl text-lamazi-primary mb-1">Verifying payment…</h1>
            <p className="text-sm text-lamazi-muted">Hang tight while we confirm with Tap.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
            <h1 className="font-display text-2xl text-lamazi-primary mb-1">Payment successful</h1>
            {data.order_number && <p className="text-sm text-lamazi-muted">Order #{data.order_number}</p>}
            <button onClick={() => navigate(`/order/${data.order_id}`)} className="btn-primary mt-5 w-full" data-testid="payment-track-btn">
              Track your order <ArrowRight className="w-4 h-4" />
            </button>
            <Link to="/menu" className="btn-outline mt-2 w-full">Order more</Link>
          </>
        )}
        {status === 'failed' && (
          <>
            <XCircle className="w-12 h-12 text-rose-600 mx-auto mb-3" />
            <h1 className="font-display text-2xl text-lamazi-primary mb-1">Payment failed</h1>
            <p className="text-sm text-lamazi-muted mb-3">{data.message || 'Please try again'}</p>
            <Link to="/checkout" className="btn-primary mt-3 w-full">Back to checkout</Link>
            <Link to="/bag" className="btn-outline mt-2 w-full">Review bag</Link>
          </>
        )}
      </div>
    </div>
  );
}
