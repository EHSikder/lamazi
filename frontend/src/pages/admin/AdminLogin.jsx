import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signIn({ email: email.trim(), password });
      // verify admin
      const { data } = await api.get(`/admin/check?email=${encodeURIComponent(email.trim())}`);
      if (data?.role) {
        toast.success(`Welcome, ${data.name || data.email}`);
        navigate('/admin/dashboard');
      } else {
        toast.error('This account is not an admin');
      }
    } catch (e2) {
      toast.error(e2.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-lamazi-primary px-4" data-testid="admin-login">
      <form onSubmit={submit} className="w-full max-w-sm bg-lamazi-neutral rounded-3xl p-8 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-full bg-lamazi-primary flex items-center justify-center mb-3">
            <Lock className="w-5 h-5 text-lamazi-secondary" />
          </div>
          <p className="brand-wordmark text-base">LAMAZI</p>
          <p className="text-xs uppercase tracking-widest text-lamazi-muted">Admin Panel</p>
        </div>
        <div className="space-y-3">
          <Field type="email" label="Email" value={email} onChange={setEmail} testid="admin-login-email" />
          <Field type="password" label="Password" value={password} onChange={setPassword} testid="admin-login-password" />
        </div>
        <button type="submit" disabled={busy} className="btn-primary w-full mt-5" data-testid="admin-login-submit">
          {busy ? 'Signing in…' : 'Sign In'}
        </button>
        <p className="text-[11px] text-lamazi-muted text-center mt-4">
          Need access? Ask the manager to create a row in <code>users</code> with role <code>admin</code>.
        </p>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', testid }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-widest text-lamazi-muted mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="w-full px-4 py-2.5 rounded-xl border border-lamazi-secondary/60 bg-white text-sm focus:outline-none focus:border-lamazi-primary"
        data-testid={testid}
      />
    </div>
  );
}
