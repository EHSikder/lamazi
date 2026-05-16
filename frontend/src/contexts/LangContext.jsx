import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';

const STORAGE_KEY = 'lamazi_lang';

// Safe default so useLang() never returns null (defensive — prevents Home crash if
// a component renders before the provider in some edge production builds).
const DEFAULT_VALUE = {
  lang: 'en',
  isRtl: false,
  toggle: () => {},
  t: (key) => key,
  L: (obj, field) => (obj ? (obj[`${field}_en`] || obj[`${field}_ar`] || '') : ''),
  setLang: () => {},
};

const LangContext = createContext(DEFAULT_VALUE);

// Simple UI label dictionary. Only customer-facing strings. Admin stays EN.
const T = {
  en: {
    nav_home: 'Home',
    nav_menu: 'Menu',
    nav_about: 'About',
    nav_loyalty: 'Loyalty Program',
    cart: 'Bag',
    sign_in: 'Sign In',
    sign_up: 'Sign Up',
    proceed_checkout: 'Proceed to Checkout',
    place_order: 'Place Order',
    add_to_bag: 'Add to Bag',
    view_full_menu: 'View Full Menu',
    explore_collection: 'Explore Collection',
    our_menu: 'Our Menu',
    about_lamazi: 'About LAMAZI',
    loyalty_title: 'Our Loyalty Program',
    join_now: 'Join Now',
    your_bag: 'Your Bag',
    checkout: 'Checkout',
    summary: 'Summary',
    subtotal: 'Subtotal',
    total: 'Total',
    delivery: 'Delivery',
    pickup: 'Pickup',
    coupon: 'Coupon',
    apply: 'Apply',
    sign_out: 'Sign out',
  },
  ar: {
    nav_home: 'الرئيسية',
    nav_menu: 'القائمة',
    nav_about: 'من نحن',
    nav_loyalty: 'برنامج الولاء',
    cart: 'السلة',
    sign_in: 'تسجيل الدخول',
    sign_up: 'إنشاء حساب',
    proceed_checkout: 'متابعة الدفع',
    place_order: 'تأكيد الطلب',
    add_to_bag: 'أضف إلى السلة',
    view_full_menu: 'عرض القائمة كاملة',
    explore_collection: 'استكشف المجموعة',
    our_menu: 'قائمتنا',
    about_lamazi: 'عن لمازي',
    loyalty_title: 'برنامج الولاء',
    join_now: 'انضم الآن',
    your_bag: 'سلتك',
    checkout: 'الدفع',
    summary: 'الملخص',
    subtotal: 'الإجمالي الفرعي',
    total: 'الإجمالي',
    delivery: 'توصيل',
    pickup: 'استلام',
    coupon: 'كوبون',
    apply: 'تطبيق',
    sign_out: 'تسجيل الخروج',
  },
};

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || 'en'; } catch { return 'en'; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* noop */ }
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  const toggle = useCallback(() => setLang((l) => (l === 'en' ? 'ar' : 'en')), []);
  const t = useCallback((key) => (T[lang] && T[lang][key]) || T.en[key] || key, [lang]);

  // Pick localised field from an object that has _en / _ar pair.
  const localised = useCallback((obj, field) => {
    if (!obj) return '';
    if (lang === 'ar') return obj[`${field}_ar`] || obj[`${field}_en`] || '';
    return obj[`${field}_en`] || obj[`${field}_ar`] || '';
  }, [lang]);

  const value = useMemo(() => ({ lang, isRtl: lang === 'ar', toggle, t, L: localised, setLang }), [lang, toggle, t, localised]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext) || DEFAULT_VALUE;
