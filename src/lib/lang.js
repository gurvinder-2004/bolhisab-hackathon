'use client';

// Display language: Hinglish (default), pure Hindi, or English.
// Covers the main navigation and screen chrome; document-like surfaces
// (invoice print, letter, pay link) stay fixed.

import { createContext, useContext, useEffect, useState } from 'react';

const DICT = {
  hg: {
    navHome: 'Home', navKhata: 'Khata', navCustomers: 'Customers', navPaisa: 'Paisa',
    navBolo: 'Bolo — voice entry',
    hero: 'Bas bolo, hisab ho jayega.',
    heroSub: 'Boliye — “Sharma ji ne 5,000 ka samaan liya, UPI se jama”',
    collect: 'Aapko milega (total baaki)', overdue: 'Overdue baaki', weekDue: 'Is hafte due',
    aajMila: 'Aaj mila', aajUdhaar: 'Aaj udhaar', totalCust: 'Total customers', chaseAaj: 'Aaj chase karna',
    latest: 'Latest hisab', followups: 'Aaj ke follow-ups', ageing: 'Ageing — baaki kitni purani hai',
    custTitle: 'Customers', custSub: 'log', invTitle: 'Bills & Invoices', moneyTitle: 'Cash In / Out',
    moneySub: 'Bank import + 13-hafte forecast',
    newBill: 'Nayi bill', newCustomer: 'Naya customer', viewAll: 'Sab dekhein',
    recent: 'Recent entries', search: 'Search karein…',
    langLabel: 'Bhasha', logout: 'Logout', login: 'Login',
  },
  hi: {
    navHome: 'होम', navKhata: 'खाता', navCustomers: 'ग्राहक', navPaisa: 'पैसा',
    navBolo: 'बोलो — वॉइस एंट्री',
    hero: 'बस बोलो, हिसाब हो जाएगा।',
    heroSub: 'बोलिए — “शर्मा जी ने 5,000 का सामान लिया, UPI से जमा”',
    collect: 'आपको मिलेगा (कुल बाकी)', overdue: 'ओवरड्यू बाकी', weekDue: 'इस हफ्ते ड्यू',
    aajMila: 'आज मिला', aajUdhaar: 'आज उधार', totalCust: 'कुल ग्राहक', chaseAaj: 'आज रिमाइंडर भेजने हैं',
    latest: 'ताज़ा हिसाब', followups: 'आज के फॉलो-अप', ageing: 'एजिंग — बाकी कितनी पुरानी है',
    custTitle: 'ग्राहक', custSub: 'ग्राहक', invTitle: 'बिल और इनवॉइस', moneyTitle: 'कैश इन / आउट',
    moneySub: 'बैंक इंपोर्ट + 13-हफ्ते फोरकास्ट',
    newBill: 'नई बिल', newCustomer: 'नया ग्राहक', viewAll: 'सब देखें',
    recent: 'हाल की एंट्री', search: 'खोजें…',
    langLabel: 'भाषा', logout: 'लॉगआउट', login: 'लॉगिन',
  },
  en: {
    navHome: 'Home', navKhata: 'Invoices', navCustomers: 'Customers', navPaisa: 'Money',
    navBolo: 'Bolo — voice entry',
    hero: 'Just speak. The books update themselves.',
    heroSub: 'Say — “Sharma ji took goods worth 5,000, paid by UPI”',
    collect: 'You will receive (total due)', overdue: 'Overdue', weekDue: 'Due this week',
    aajMila: 'Received today', aajUdhaar: 'Credit given today', totalCust: 'Total customers', chaseAaj: 'To chase today',
    latest: 'Latest entries', followups: "Today's follow-ups", ageing: 'Ageing — how old the dues are',
    custTitle: 'Customers', custSub: 'customers', invTitle: 'Bills & Invoices', moneyTitle: 'Cash In / Out',
    moneySub: 'Bank import + 13-week forecast',
    newBill: 'New bill', newCustomer: 'New customer', viewAll: 'View all',
    recent: 'Recent entries', search: 'Search…',
    langLabel: 'Language', logout: 'Log out', login: 'Log in',
  },
};

const LangCtx = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLang] = useState('hg');
  useEffect(() => {
    const s = localStorage.getItem('bolhisab-lang');
    if (s && DICT[s]) setLang(s);
  }, []);
  const change = (l) => { if (DICT[l]) { setLang(l); try { localStorage.setItem('bolhisab-lang', l); } catch {} } };
  const t = (k) => DICT[lang][k] ?? DICT.hg[k] ?? k;
  return <LangCtx.Provider value={{ lang, setLang: change, t }}>{children}</LangCtx.Provider>;
}

export const useLang = () => useContext(LangCtx)
  ?? { lang: 'hg', setLang: () => {}, t: (k) => DICT.hg[k] ?? k };
