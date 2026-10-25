# BolHisab — हिसाब अब बोलकर

Voice-first khata + GST invoices + payment chasing for India's small manufacturers.
**Bolo, suno, confirm karo — hisab ho gaya.**

Milestones done: M1 (money/GST engine), M2 (data model, sample data, customer matching),
M3 (voice pipeline: mic + Gemini audio-to-intent + spoken review + auto-reopened mic for
voice yes/no + TTS), M4 (dashboard, invoices, GST invoice print, customers, chase ladder,
demand letter, pay link + disputes), M5 (bank import + matching, 13-week forecast, what-if),
M6 (Android app via Capacitor), UI redesign (cream/yellow/violet design system, desktop
sidebar + mobile floating pill nav).

## Run the app
    npm install
    npm run build && npx next start -p 3100   # production (what we demo)
    npm run dev                               # http://localhost:3000 (never while prod runs)

Environment lives in `.env.local` (never commit it; see `.env.example`):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (safe for the browser)
- `GEMINI_API_KEY` (server-only; used by /api/voice)
- `GEMINI_MODEL` optional override (default `gemini-3.5-flash`; `gemini-2.5-*` is retired for new keys as of Oct 2026)
- `GEMINI_FALLBACK_MODEL` optional (default `gemini-flash-lite-latest`; used when the primary 429s — the free tier is ~20 requests/day per model, so the fallback matters)

## Run the tests
    npm test          # 70 tests: engine, schema+seed, matching, voice, chase, bank import
    npm run cases     # GST expected-vs-actual table
    npm run preview   # sample-data summary: statuses, ageing, customer grades

## Set up Supabase (once)
1. Supabase > SQL Editor > paste `supabase/schema.sql` > Run.
2. Paste `supabase/seed.sql` > Run (re-running resets the demo).
3. Paste `supabase/realtime.sql` > Run (phone -> dashboard live updates).
4. Fill `.env.local` as above.

## Voice pipeline (M3)
- Tap the mic, speak Hinglish/Hindi/English. Or type — typing always works.
- Capture: one persistent echo-cancelled mic stream per session; recording ends ~1.2s
  after you stop speaking (VAD), never mid-sentence, with hard caps (15s command / 10s answer).
- Typed text hits the deterministic rule parser first (`src/voice/rules.js`, offline, free);
  audio and unmatched text go to Gemini (`/api/voice`, key stays server-side, automatic
  flash-lite fallback when the primary model's daily quota is spent).
- The review is **read aloud in full**, then — and only then — the mic reopens: say "haan"
  to save, "nahi" to cancel; for "kaunse Gupta?" say "pehla"/"doosra" or the name. A single
  fuzzy match is asked as "yahi sahi hai? haan ya nahi". Tap or type always works too.
- Every write has a 10-second undo.
- Intents: add_credit, record_payment (FIFO allocation to open invoices), add_customer,
  outstanding (live balance with breakdown), reminder (opens WhatsApp, message pre-filled).
- The LLM never computes: it only extracts what was said; all maths stays in the engine.

## Screens
- `/` — the voice console: purple "Bas bolo, hisab ho jayega" hero, yellow mic, recent entries.
- `/dashboard` — Namaste greeting, "Aapko milega" balance card, aaj-mila/aaj-udhaar stats,
  latest hisab, **aaj kisko peeche padein** (escalation ladder: WhatsApp ≤7d late → call
  ≤15d → demand letter; disputes pause it), ageing bars; live via Supabase realtime.
- `/invoices` — list with status filters; `/invoices/new` — line items with live engine totals;
  `/invoices/[id]` — print-ready Tax Invoice / Bill of Supply with UPI QR, record payment,
  WhatsApp reminder with pay link.
- `/customers` + `/customers/[id]` — balances, A/B/C payment grades, open invoices, timeline.
- `/pay/[id]` — customer-facing pay link: amount, words, UPI QR + deep link, bank details,
  and "vivad darj karein" which marks the invoice disputed and pauses all chasing.
- `/letter/[id]` — print-ready payment reminder with the honest disclaimer
  (not a legal notice, not a GST/CBDT notification).

## Paisa (M5)
- `/money` → Bank import: paste/upload a bank CSV (or generate a sample from live data),
  every credit line is matched to a customer and open invoices across six cases —
  exact, combined (one transfer, many bills), part, advance/on-account, TDS-deducted
  (flagged + recorded separately, never auto-applied) and ambiguous (you pick).
  Nothing is written until you confirm each row (confirm-before-paid).
- `/money` → 13-hafte nashpati: weekly in/out bars chained from today's cash,
  inflows weighted by each customer's payment grade (A on time, B +1 week, C +4),
  shortfall weeks flagged, plus what-if sliders (collect now / C-grade later / pause out).
- Domain logic is pure and tested: `src/domain/bank.js`, `src/domain/forecast.js`.

## Android (M6)
Capacitor shell around the same web app — see **ANDROID.md**. Mic permission, branded
yellow icon/splash and the run guide are all wired; open `android/` in Android Studio and press Run.

## Deploy (M7)
The app deploys to Vercel as-is (one Next.js app, env vars below):

    NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, GEMINI_API_KEY

After deploying, point the Android shell at it: set `server.url` in `capacitor.config.json`
to the Vercel URL and `npx cap sync android`.

## Layout
- `src/engine/`  money, GST, GSTIN, words, dates, invoice numbers (M1)
- `src/domain/`  invoice status, ageing, reliability grade, chase ladder, bank match, forecast
- `src/data/`    made-up business, 12 customers, 77 invoices, payments, expenses
- `src/voice/`   rule parser + Gemini prompt/schema (M3)
- `src/app/`     Next.js pages + /api/voice route
- `src/lib/`     supabase client, balance math, writes
- `src/components/` design kit: icons, avatar chips, sidebar, bottom pill nav
- `supabase/`    schema, seed, realtime
- `android/`     Capacitor project (M6)

## Demo-only safety
RLS policies are open so phone and dashboard share fake data without a login. Do not store real data until real auth policies replace them.
Sample GST rates are placeholders: check cbic-gst.gov.in before the demo.
