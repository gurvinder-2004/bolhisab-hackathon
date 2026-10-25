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
    heroH1a: 'हिसाब अब', heroH1b: 'बोलकर',
    heroSub: 'Boliye — “Sharma ji ne 5,000 ka samaan liya, UPI se jama”',
    collect: 'Aapko milega (total baaki)', overdue: 'Overdue baaki', weekDue: 'Is hafte due',
    aajMila: 'Aaj mila', aajUdhaar: 'Aaj udhaar', totalCust: 'Total customers', chaseAaj: 'Aaj chase karna',
    latest: 'Latest hisab', followups: 'Aaj ke follow-ups', ageing: 'Ageing — baaki kitni purani hai',
    custTitle: 'Customers', custSub: 'log', invTitle: 'Bills & Invoices', moneyTitle: 'Cash In / Out',
    moneySub: 'Bank import + 13-hafte forecast',
    newBill: 'Nayi bill', newCustomer: 'Naya customer', viewAll: 'Sab dekhein',
    recent: 'Recent entries', search: 'Search karein…',
    langLabel: 'Bhasha', logout: 'Logout', login: 'Login',
    landingSub: 'Na typing, na nayi app seekho. Bas bolo — BolHisab sunta hai, confirm karta hai, GST bill banata hai aur payment khud yaad dilaata hai.',
    ctaWeb: 'Web Dashboard →', ctaApk: 'Download APK',
    featuresTitle: 'Kaam jo BolHisab karta hai',
    howTitle: 'Teen kadam. Bas.',
    dlTitle: 'Hisab ab bolkar.', dlSub: 'Web par turant, ya Android app par — dono ek hi hisaab chalate hain.',
    f1t: 'Bol kar entry', f1b: '“Sharma ji ne 110 ki sabji, 90 ka tel liya” — sunta hai, dohraata hai, haan bolte hi bill ban jaata hai.',
    f2t: 'GST bills + UPI', f2b: 'Tax Invoice engine with live CGST/SGST maths, print-ready format, QR pay link jo customer khud verify kare.',
    f3t: 'Payment chasing', f3b: 'WhatsApp → call → letter ladder khud chalti hai. A/B/C grades batati hain kis se pehle paisa aane wala hai.',
    f4t: 'Bank import + forecast', f4b: 'Statement paste karo — 6 tarah ke matches, TDS alag se. 13-hafte cash forecast with what-if.',
    s1t: 'Bolo', s1b: 'Mic dabaiye aur apni bhasha mein boliye — Hinglish, हिंदी या English.',
    s2t: 'Confirm', s2b: 'BolHisab bol kar sunata hai, aap “haan” bolein — ya screen par tap karein.',
    s3t: 'Ho gaya', s3b: 'Bill, khata, reminder, forecast — sab khud update, 10-second undo ke saath.',
    st1: 'mein entry', st2: 'bank matching', st3: 'cash forecast', st4: 'passing tests',
  },
  hi: {
    navHome: 'होम', navKhata: 'खाता', navCustomers: 'ग्राहक', navPaisa: 'पैसा',
    navBolo: 'बोलो — वॉइस एंट्री',
    hero: 'बस बोलो, हिसाब हो जाएगा।',
    heroH1a: 'हिसाब अब', heroH1b: 'बोलकर',
    heroSub: 'बोलिए — “शर्मा जी ने 5,000 का सामान लिया, UPI से जमा”',
    collect: 'आपको मिलेगा (कुल बाकी)', overdue: 'ओवरड्यू बाकी', weekDue: 'इस हफ्ते ड्यू',
    aajMila: 'आज मिला', aajUdhaar: 'आज उधार', totalCust: 'कुल ग्राहक', chaseAaj: 'आज रिमाइंडर भेजने हैं',
    latest: 'ताज़ा हिसाब', followups: 'आज के फॉलो-अप', ageing: 'एजिंग — बाकी कितनी पुरानी है',
    custTitle: 'ग्राहक', custSub: 'ग्राहक', invTitle: 'बिल और इनवॉइस', moneyTitle: 'कैश इन / आउट',
    moneySub: 'बैंक इंपोर्ट + 13-हफ्ते फोरकास्ट',
    newBill: 'नई बिल', newCustomer: 'नया ग्राहक', viewAll: 'सब देखें',
    recent: 'हाल की एंट्री', search: 'खोजें…',
    langLabel: 'भाषा', logout: 'लॉगआउट', login: 'लॉगिन',
    landingSub: 'न टाइपिंग, न नई ऐप सीखना। बस बोलिए — BolHisab सुनता है, पुष्टि करता है, GST बिल बनाता है और पेमेंट खुद याद दिलाता है।',
    ctaWeb: 'वेब डैशबोर्ड →', ctaApk: 'APK डाउनलोड करें',
    featuresTitle: 'बोलहिसाब क्या-क्या करता है',
    howTitle: 'तीन कदम। बस।',
    dlTitle: 'हिसाब अब बोलकर।', dlSub: 'वेब पर तुरंत, या Android ऐप पर — दोनों एक ही हिसाब चलाते हैं।',
    f1t: 'बोल कर एंट्री', f1b: '“शर्मा जी ने 110 की सब्ज़ी, 90 का तेल लिया” — सुनता है, दोहराता है, हाँ बोलते ही बिल बन जाता है।',
    f2t: 'GST बिल + UPI', f2b: 'CGST/SGST का पूरा हिसाब, प्रिंट-रेडी Tax Invoice, और QR पे-लिंक जो ग्राहक खुद जाँचे।',
    f3t: 'पेमेंट याद दिलाना', f3b: 'WhatsApp → कॉल → लैटर, सीढ़ी खुद चलती है। A/B/C ग्रेड बताते हैं किससे पहले पैसा आने वाला है।',
    f4t: 'बैंक इंपोर्ट + फोरकास्ट', f4b: 'स्टेटमेंट पेस्ट करें — 6 तरह के मैच, TDS अलग से। 13-हफ्ते कैश फोरकास्ट with what-if।',
    s1t: 'बोलिए', s1b: 'माइक दबाइए और अपनी भाषा में बोलिए — हिंग्लिश, हिंदी या English।',
    s2t: 'पुष्टि करें', s2b: 'BolHisab बोल कर सुनाता है, आप “हाँ” कहें — या स्क्रीन पर टैप करें।',
    s3t: 'हो गया', s3b: 'बिल, खाता, रिमाइंडर, फोरकास्ट — सब खुद अपडेट, 10-सेकंड undo के साथ।',
    st1: 'में एंट्री', st2: 'बैंक मैचिंग', st3: 'कैश फोरकास्ट', st4: 'टेस्ट पास',
  },
  en: {
    navHome: 'Home', navKhata: 'Invoices', navCustomers: 'Customers', navPaisa: 'Money',
    navBolo: 'Bolo — voice entry',
    hero: 'Just speak. The books update themselves.',
    heroH1a: 'Accounting,', heroH1b: 'out loud.',
    heroSub: 'Say — “Sharma ji took goods worth 5,000, paid by UPI”',
    collect: 'You will receive (total due)', overdue: 'Overdue', weekDue: 'Due this week',
    aajMila: 'Received today', aajUdhaar: 'Credit given today', totalCust: 'Total customers', chaseAaj: 'To chase today',
    latest: 'Latest entries', followups: "Today's follow-ups", ageing: 'Ageing — how old the dues are',
    custTitle: 'Customers', custSub: 'customers', invTitle: 'Bills & Invoices', moneyTitle: 'Cash In / Out',
    moneySub: 'Bank import + 13-week forecast',
    newBill: 'New bill', newCustomer: 'New customer', viewAll: 'View all',
    recent: 'Recent entries', search: 'Search…',
    langLabel: 'Language', logout: 'Log out', login: 'Log in',
    landingSub: 'No typing, no new app to learn. Just speak — BolHisab listens, confirms, creates the GST bill and chases payments on its own.',
    ctaWeb: 'Web Dashboard →', ctaApk: 'Download APK',
    featuresTitle: 'What BolHisab does for you',
    howTitle: 'Three steps. Period.',
    dlTitle: 'Hisab ab bolkar.', dlSub: 'On the web instantly, or in the Android app — both run the same books.',
    f1t: 'Speak your entry', f1b: '“Sharma ji took 110 of vegetables, 90 of oil” — it hears, repeats, and makes the bill the moment you say yes.',
    f2t: 'GST bills + UPI', f2b: 'Live CGST/SGST maths, print-ready Tax Invoice, and a QR pay link your customer can verify line by line.',
    f3t: 'Payment chasing', f3b: 'WhatsApp → call → letter ladder runs itself. A/B/C grades tell you whose payment arrives first.',
    f4t: 'Bank import + forecast', f4b: 'Paste a statement — 6 match types, TDS kept aside. 13-week cash forecast with what-if.',
    s1t: 'Speak', s1b: 'Tap the mic and talk in your language — Hinglish, Hindi or English.',
    s2t: 'Confirm', s2b: 'BolHisab reads it back aloud; say yes — or just tap.',
    s3t: 'Done', s3b: 'Bill, ledger, reminders, forecast — all updated, with a 10-second undo.',
    st1: 'per entry', st2: 'bank matching', st3: 'cash forecast', st4: 'passing tests',
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
