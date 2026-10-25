# BolHisab — 3-minute demo script (record at 1280x800, phone at 400x800)

**Setup before recording**
- `npm run build && npx next start -p 3100` (server on)
- Fresh-ish data: run `supabase/seed.sql` once, then add 2-3 live voice entries
- Chrome for desktop, Mic allowed; phone/emulator optional for the last beat
- Tabs open: localhost:3100/dashboard

---

## Beat 1 — The pain (15s)
Show a paper khata register / scattered WhatsApp messages:
"Har chhota manufacturer ka hisab copy pen aur WhatsApp me chhupa hai.
Payment kaun karega, kab karega — kisi ko yaad nahi rehta."

## Beat 2 — BolHisab: bol kar entry (45s) → **the money shot**
Open `localhost:3100/` — the purple "Bas bolo, hisab ho jayega" hero.
Tap the yellow mic and SPEAK:
> "Gupta ji ne pandrah hazaar ka samaan liya"

App SPEAKS the review aloud → mic reopens by itself → say **"haan"**.
Entry saved + spoken confirm + 10s Undo toast visible.
Say the line again with a NEW name → "naya khaata banau? haan ya nahi" → say **"haan"**.
Zoom the bottom pill nav: mic is one thumb-tap from ANY screen.

## Beat 3 — "kaunse Singh?" disambiguation (20s)
Speak: "Singh ne chaar sau ka samaan liya" → options read aloud → say **"pehla"**.
"Same naam, do log — BolHisab bol kar puuchta hai, screen par bhi tap kar sakte ho."

## Beat 4 — Dashboard: kaam ki list (25s)
Open /dashboard: "Namaste" greeting, "Aapko milega" black card,
**Aaj kisko peeche padein** — WhatsApp/call/letter chips per invoice,
A/B/C grades per customer, ageing bars.
"Ladder khud chalta hai: 7 din WhatsApp, 15 din call, 30 din letter — vivad hua to sab rukta hai."

## Beat 5 — GST invoice + UPI (25s)
/invoices/new → pick customer, 2 lines → totals live (CGST+SGST split, round-off).
Save → print-ready Tax Invoice with UPI QR.
Open the /pay/... link (customer's view): QR + "UPI app mein kholo" + "vivad darj karein".

## Beat 6 — Bank import magic (30s)
/money → "✨ Sample statement banao" → expand a row:
ek jama, kai bills (combined); TDS row flagged red, separately recorded.
Confirm one row. "Statement paste karo — hisab khud match ho jaata hai."

## Beat 7 — 13-hafte nashpati (15s)
Second tab: forecast bars, violet in / yellow out.
Drag "aaj hi extra vasooli" slider — end balance updates live.

## Beat 8 — Android app (10s)
Phone/emulator with BolHisab icon: tap → same app, mic permission once, speak one entry.
Watch the DESKTOP dashboard update in REALTIME (Supabase realtime) — no refresh.

## Close (5s)
"BolHisab — hisab ab bolkar. Bolo, pakka paisa wapas."
Logo card + tagline.

---

## Judges' likely Q&A ammo
- "LLM galat sun liya?" → rule parser offline-first; review aloud + haan/nahi gate + 10s Undo.
- "GST sahi hai?" → whole-paise integer engine, 70 tests, print format follows the Tax Invoice rules.
- "Data privacy?" → demo RLS open (stated in README); production needs auth — architecture ready.
- "TDS kya kiya?" → never auto-applied: flagged, separate expense row, you confirm.
- Letter is NOT a legal notice — disclaimer printed on it (compliance honesty).
