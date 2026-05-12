import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api, apiError } from '@/lib/api';
import { toast } from 'sonner';
import { LogOut, ChevronRight, Sparkles, Package } from 'lucide-react';
import { fmtKWD } from '@/lib/utils-app';

const AUTH_IMG = 'https://i.pinimg.com/originals/48/b9/13/48b913ee1e3f11a466aa17d4287efe0c.jpg';

export default function Auth() {
  const navigate = useNavigate();
  const { user, profile, signIn, signUp, signOut, loading } = useAuth();
  const [mode, setMode] = useState('signin');  // signin | signup
  const [form, setForm] = useState({ email: '', password: '', name: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (user?.id) {
      api.get(`/customer/${user.id}/orders`)
        .then(({ data }) => setOrders(data || []))
        .catch(() => {});
    }
  }, [user?.id]);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === 'signin') {
        await signIn({ email: form.email.trim(), password: form.password });
        toast.success('Welcome back');
      } else {
        await signUp({ email: form.email.trim(), password: form.password, name: form.name.trim(), phone: form.phone.trim() });
        toast.success('Account created!');
      }
    } catch (e2) {
      toast.error(e2.message || apiError(e2, 'Failed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="container-lamazi py-20 text-center text-lamazi-muted">Loading…</div>;
  }

  // Logged in -> profile view
  if (user) {
    return (
      <div className="container-lamazi py-12" data-testid="profile-page">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-lamazi-primary mb-1">Welcome, {profile?.name || user.email}</h1>
        <p className="text-sm text-lamazi-muted mb-8">Your Lamazi account at a glance.</p>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="cream-card">
            <p className="text-xs uppercase tracking-widest text-lamazi-muted mb-2">Loyalty balance</p>
            <p className="font-display text-5xl font-bold text-lamazi-primary mb-1" data-testid="profile-points">{profile?.loyalty_points ?? 0}</p>
            <p className="text-sm text-lamazi-muted">sweet points</p>
            <Link to="/menu" className="btn-primary mt-4 py-2.5 text-sm">Use on your next order <ChevronRight className="w-4 h-4" /></Link>
          </div>
          <div className="cream-card">
            <p className="text-xs uppercase tracking-widest text-lamazi-muted mb-2">Account</p>
            <p className="text-sm"><span className="text-lamazi-muted">Email:</span> {profile?.email || user.email}</p>
            <p className="text-sm mt-1"><span className="text-lamazi-muted">Phone:</span> {profile?.phone || '—'}</p>
            <button onClick={signOut} className="btn-outline mt-4 py-2.5 text-sm" data-testid="signout-btn">
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
          <div className="cream-card">
            <p className="text-xs uppercase tracking-widest text-lamazi-muted mb-2">Quick actions</p>
            <div className="space-y-2">
              <Link to="/menu" className="block text-sm text-lamazi-primary hover:underline">→ Order again from menu</Link>
              <Link to="/loyalty" className="block text-sm text-lamazi-primary hover:underline">→ How loyalty works</Link>
            </div>
          </div>
        </div>

        <h2 className="font-display text-2xl text-lamazi-primary mt-12 mb-4">Recent orders</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-lamazi-muted">No orders yet — start with our bestsellers.</p>
        ) : (
          <div className="space-y-2" data-testid="profile-orders">
            {orders.slice(0, 5).map((o) => (
              <Link key={o.id} to={`/order/${o.id}`} className="flex items-center justify-between bg-white border border-lamazi-secondary/40 rounded-xl px-4 py-3 hover:border-lamazi-primary transition-colors">
                <div className="flex items-center gap-3">
                  <Package className="w-4 h-4 text-lamazi-primary" />
                  <div>
                    <p className="text-sm font-medium text-lamazi-primary">#{o.order_number}</p>
                    <p className="text-xs text-lamazi-muted">{new Date(o.created_at).toLocaleString()} · {o.status}</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-lamazi-primary">{fmtKWD(o.total_amount)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Not logged in -> auth form
  return (
    <div className="container-lamazi py-10" data-testid="auth-page">
      <div className="grid lg:grid-cols-2 rounded-3xl overflow-hidden bg-white shadow-md border border-lamazi-secondary/40 max-w-5xl mx-auto">
        <div className="relative hidden lg:block">
          <img src={AUTH_IMG} alt="Lamazi cakes" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-tr from-lamazi-primary/60 via-transparent to-transparent" />
          <div className="absolute bottom-8 left-8 text-lamazi-neutral max-w-xs">
            <p className="font-script text-3xl text-lamazi-secondary -mb-1">Welcome</p>
            <h2 className="font-display text-3xl font-bold">to the Lamazi family</h2>
            <p className="mt-2 text-sm opacity-90">Earn loyalty points, save addresses, and track every order — all in one place.</p>
          </div>
        </div>

        <div className="p-8 sm:p-10">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setMode('signin')}
              className={`flex-1 py-2.5 rounded-full text-sm font-medium transition-colors ${mode === 'signin' ? 'bg-lamazi-primary text-lamazi-neutral' : 'bg-lamazi-secondary/30 text-lamazi-primary'}`}
              data-testid="auth-tab-signin"
            >Sign In</button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-2.5 rounded-full text-sm font-medium transition-colors ${mode === 'signup' ? 'bg-lamazi-primary text-lamazi-neutral' : 'bg-lamazi-secondary/30 text-lamazi-primary'}`}
              data-testid="auth-tab-signup"
            >Sign Up</button>
          </div>

          <h1 className="font-display text-3xl text-lamazi-primary font-bold mb-1">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-sm text-lamazi-muted mb-6">
            {mode === 'signin' ? 'Sign in to track orders and use your points.' : 'Sign up to start earning loyalty points.'}
          </p>

          <form onSubmit={submit} className="space-y-3">
            {mode === 'signup' && (
              <>
                <Field label="Full name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} testid="auth-name" />
                <Field label="Phone" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} testid="auth-phone" />
              </>
            )}
            <Field type="email" label="Email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} required testid="auth-email" />
            <Field type="password" label="Password" value={form.password} onChange={(v) => setForm((f) => ({ ...f, password: v }))} required testid="auth-password" />
            <button type="submit" disabled={submitting} className="btn-primary w-full mt-2" data-testid="auth-submit">
              {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          </form>

          <div className="text-center mt-6 text-xs text-lamazi-muted">
            <Sparkles className="w-4 h-4 inline text-lamazi-secondary-deep mr-1" />
            You can also browse and order without an account.
            <Link to="/menu" className="text-lamazi-primary ml-2 hover:underline">Continue as guest →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required, testid }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-widest text-lamazi-muted mb-1">{label}{required && '*'}</label>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl border border-lamazi-secondary/60 bg-lamazi-neutral text-sm focus:outline-none focus:border-lamazi-primary"
        data-testid={testid}
      />
    </div>
  );
}
