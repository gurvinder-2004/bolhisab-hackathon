# Deploy BolHisab

## Current live deployment

**https://bolhisab.netlify.app** — deployed from this PC with the Netlify CLI
(no GitHub needed). Env vars (Supabase x2 + Gemini) are set on the site.
The Android shell already points at this URL (`capacitor.config.json` → `server.url`).

> Note: new Netlify free sites are **private by default**. If you ever see a
> Netlify login page instead of the app: Netlify dashboard → project **bolhisab** →
> Project configuration → General → **Visitor access** → Project visibility → **Make public**.

## Redeploy after code changes

    npx netlify deploy --build --prod

(builds locally with your `.env.local`, uploads, ~2 minutes).

## Android app

See ANDROID.md — it loads https://bolhisab.netlify.app in the Capacitor WebView.
If the URL ever changes, edit `server.url` in `capacitor.config.json` and run `npx cap sync android`.

## Later: GitHub (optional, for the submission repo)

The project is already a clean local git repo (no secrets committed):

    git remote add origin https://github.com/<you>/bolhisab.git
    git push -u origin main

## Before submission

- Rotate the Gemini key (aistudio.google.com/apikey), then update:
  `npx netlify env:set GEMINI_API_KEY <new-key>` and `.env.local`, and redeploy.
