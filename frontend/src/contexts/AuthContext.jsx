import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { api, apiError } from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);   // customers row
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId) => {
    try {
      const { data } = await api.get(`/customer/${userId}`);
      setProfile(data);
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
      if (data.session?.user?.id) loadProfile(data.session.user.id);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (sess?.user?.id) loadProfile(sess.user.id);
      else setProfile(null);
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe?.();
    };
  }, [loadProfile]);

  const signUp = async ({ email, password, name, phone }) => {
    // 1) Scoped existence check against customers table BEFORE creating an auth user
    try {
      const { data: existsRes } = await api.get('/customer/check-exists', {
        params: { email: email.trim().toLowerCase(), phone: phone?.trim() || '' },
      });
      if (existsRes?.exists) {
        throw new Error('An account with this email or phone already exists. Please sign in.');
      }
    } catch (e) {
      // If the existence check itself fails (e.g. network), surface a clean message
      if (e.message && e.message.startsWith('An account')) throw e;
      // otherwise continue — Supabase Auth will catch true duplicates as a fallback
    }

    // 2) Create Supabase Auth user
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { name, phone } },
    });
    if (error) throw new Error(error.message);

    // 3) Immediately upsert the customers row (id = auth user id, scoped by tenant)
    try {
      await api.post('/customer/upsert', {
        id: data.user?.id,
        email: email.trim().toLowerCase(),
        phone,
        name,
      });
    } catch (e) {
      console.warn('customer upsert failed', apiError(e));
    }
    if (data.session) {
      setSession(data.session);
      await loadProfile(data.user.id);
    }
    return data;
  };

  const signIn = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    setSession(data.session);
    if (data.user?.id) await loadProfile(data.user.id);
    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (session?.user?.id) await loadProfile(session.user.id);
  };

  const user = session?.user || null;

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
