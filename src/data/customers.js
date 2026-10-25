import { makeGstin } from '../engine/index.js';

// ignoreDueBetween = they never pay a bill whose due date falls in this window.
// profile = how they pay (used only to generate history): lateMean days after due date, jitter range,
// stopsPayingAfter = invoices dated on/after this day are never paid.
const g = (b) => makeGstin(b);
export const CUSTOMERS = [
  { name: 'Ramesh Gupta', shopName: 'Gupta Traders', area: 'Pimpri', city: 'Pune', stateCode: '27', gstin: g('27AAGPG1111K1Z'), phone: '9000000001', creditDays: 30, lang: 'hi', profile: { lateMean: 2, jitter: [-4, 3] } },
  { name: 'Suresh Gupta', shopName: 'Gupta Hardware', area: 'Hadapsar', city: 'Pune', stateCode: '27', gstin: g('27AAHPG2222L1Z'), phone: '9000000002', creditDays: 30, lang: 'hi', profile: { lateMean: 25, jitter: [-4, 6], ignoreDueBetween: ['2026-07-15', '2026-08-25'] } },
  { name: 'Anil Patil', shopName: 'Patil Foods', area: 'Chakan', city: 'Pune', stateCode: '27', gstin: g('27AAJPP3333M1Z'), phone: '9000000003', creditDays: 30, lang: 'mr', profile: { lateMean: 0, jitter: [-4, 0] } },
  { name: 'Meera Joshi', shopName: 'Joshi Agro Products', area: 'Baramati', city: 'Pune', stateCode: '27', gstin: g('27AAKPJ4444N1Z'), phone: '9000000004', creditDays: 45, lang: 'mr', profile: { lateMean: 6, jitter: [-3, 4] } },
  { name: 'Sanjay Kulkarni', shopName: 'Kulkarni Pharma', area: 'Hinjewadi', city: 'Pune', stateCode: '27', gstin: g('27AALCK5555P1Z'), phone: '9000000005', creditDays: 30, lang: 'mr', profile: { lateMean: 12, jitter: [-3, 5] } },
  { name: 'Hitesh Desai', shopName: 'Desai Garments', area: 'Ring Road', city: 'Surat', stateCode: '24', gstin: g('24AAMPD6666Q1Z'), phone: '9000000006', creditDays: 30, lang: 'hi', profile: { lateMean: 18, jitter: [-4, 6] } },
  { name: 'Imran Khan', shopName: 'Khan Electronics', area: 'Kondhwa', city: 'Pune', stateCode: '27', gstin: g('27AANPK7777R1Z'), phone: '9000000007', creditDays: 30, lang: 'hi', profile: { lateMean: 0, jitter: [-3, 3] } },
  { name: 'Lakshmi Iyer', shopName: 'Iyer Spices', area: 'Shivajinagar', city: 'Pune', stateCode: '27', gstin: null, phone: '9000000008', creditDays: 15, lang: 'en', profile: { lateMean: 0, jitter: [-3, 1] } }, // unregistered
  { name: 'Harpreet Singh', shopName: 'Singh Auto Parts', area: 'Bhosari', city: 'Pune', stateCode: '27', gstin: g('27AAOPS8888S1Z'), phone: '9000000009', creditDays: 30, lang: 'hi', profile: { lateMean: 30, jitter: [-5, 8], stopsPayingAfter: '2026-06-25' } },
  { name: 'Mahesh Mehta', shopName: 'Mehta Sweets', area: 'Kothrud', city: 'Pune', stateCode: '27', gstin: g('27AAPPM9999T1Z'), phone: '9000000010', creditDays: 15, lang: 'hi', profile: { lateMean: 3, jitter: [-4, 4] } },
  { name: 'Prakash Bhosale', shopName: 'Bhosale Dairy', area: 'Daund', city: 'Pune', stateCode: '27', gstin: g('27AAQPB1010U1Z'), phone: '9000000011', creditDays: 30, lang: 'mr', profile: { lateMean: 8, jitter: [-3, 5] } },
  { name: 'Deepak Naik', shopName: 'Naik Plastics', area: 'Ranjangaon', city: 'Pune', stateCode: '27', gstin: g('27AARPN1212V1Z'), phone: '9000000012', creditDays: 45, lang: 'hi', profile: { lateMean: 20, jitter: [-3, 6], stopsPayingAfter: '2026-05-20' } },
];
