# Deploy BolHisab — your 5-minute part

Everything code-side is done and committed locally (`main` branch, one commit, no secrets).
You only do these two account steps once.

## 1. Push to GitHub (~2 min)

1. Go to https://github.com/new (log in first).
2. Repository name: **bolhisab** · Private · **Do NOT** tick "Add a README" (we have one) → **Create repository**.
3. GitHub shows you commands. On this PC, in Git Bash, run the two lines under
   "…or push an existing repository from the command line" (they look like this —
   copy YOUR url from the page, it contains your username):

       git remote add origin https://github.com/<your-username>/bolhisab.git
       git push -u origin main

4. A browser popup may ask you to sign in to Git (GitHub credential manager) — allow it.

## 2. Deploy on Vercel (~3 min)

1. Go to https://vercel.com → **Sign Up / Continue with GitHub** (use the same GitHub account).
2. **Add New… → Project** → find **bolhisab** in the list → **Import**.
   (Vercel auto-detects Next.js — leave Framework/Build settings untouched.)
3. Before Deploy, open **Environment Variables** and add these THREE:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Supabase project URL (from `.env.local`, line 1) |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | your Supabase publishable key (line 2) |
   | `GEMINI_API_KEY` | your Gemini key (line 3) |

   Paste from `D:\baaki\.env.local` — the values are already there. Add all three to
   **Production, Preview and Development** (default).
4. **Deploy** → ~2 minutes → you get `https://bolhisab-<something>.vercel.app`.
5. Open it on your phone: voice, QR, everything works over https.

## 3. Point the Android app at it (30 sec)

Tell me the Vercel URL and I'll finish this, or do it yourself:
edit `server.url` in `capacitor.config.json` to the https URL, then:

    npx cap sync android

…and rebuild in Android Studio (see ANDROID.md).

## Before the hackathon submission (reminders)

- **Rotate the Gemini key** (it was pasted in chat): https://aistudio.google.com/apikey →
  delete old, create new, update Vercel env var + your `.env.local`, redeploy.
- Optional cleanup of test customers (bare "Singh" etc.) — say the word and I'll do it.
