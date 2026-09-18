# Vaishnavi's Stage — Setup Steps

This guide takes you from an empty computer to a live, working app at zero monthly cost. Follow it in order the first time.

---

## 1. Project overview

Vaishnavi's Stage is a private event-scheduling dashboard for an event anchor/host, plus a public booking page for her clients. The dashboard has **no login** — it's built for exactly one person to use, so every page and API route always acts as her. The public `/book` page only ever shows availability status, never client names, fees, or notes.

## 2. Technology stack

Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Radix-based UI primitives, Framer Motion, MongoDB Atlas + Mongoose, Zod, React Hook Form, the `ics` package, optionally Anthropic's Claude API (voice/text assistant) and Google's Calendar API (one-way sync of Confirmed events). Hosting on Vercel's free Hobby plan. No login/auth system — see the security note below.

## 3. Required software

- **Node.js 20 LTS** or newer — [nodejs.org](https://nodejs.org)
- **npm** (comes with Node.js)
- **Git** — [git-scm.com](https://git-scm.com)
- A code editor (VS Code recommended)

Verify installs:
```bash
node -v   # should print v20.x or newer
npm -v
git --version
```

## 4. Required accounts (all free to create; two have optional paid usage)

- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) account — required
- [Vercel](https://vercel.com/signup) account (can sign up with GitHub) — required to deploy
- [GitHub](https://github.com) account (to push your code and connect it to Vercel) — required to deploy
- (Optional) [Anthropic Console](https://console.anthropic.com/) account, for a Claude API key — only if you want free-form AI chat on top of the free voice assistant (see Step 27)
- (Optional) [Google Cloud Console](https://console.cloud.google.com/) account, for Google Calendar sync — only if you want Confirmed events mirrored onto Vaishnavi's Google Calendar (see Step 27a)

## 5. Installing Node.js

Download the LTS installer from nodejs.org and run it, **or** use a version manager:
```bash
# macOS/Linux with nvm
nvm install 20
nvm use 20
```
**Verification:** `node -v` prints a v20+ version.
**Common error:** `command not found: node` → the installer didn't add Node to your PATH; restart your terminal, or reinstall.

## 6. Creating a MongoDB Atlas account

1. Go to https://www.mongodb.com/cloud/atlas/register and sign up (free).
2. When asked to deploy a cluster, choose the **M0 Free** tier.
3. Pick any cloud provider/region close to you and click **Create**.

## 7. Creating a MongoDB cluster

If you weren't prompted above: in the Atlas dashboard, click **Build a Database** → **M0 Free** → choose a region → **Create Deployment**.

**Verification:** the cluster shows a green "Active" status within a few minutes.

## 8. Creating a database user

1. In **Database Access** (left sidebar), click **Add New Database User**.
2. Choose **Password** authentication, set a username (e.g. `vaishnavi-app`) and a strong generated password — save it somewhere safe.
3. Under database user privileges, choose **Read and write to any database**.
4. Click **Add User**.

**Common error:** if you forget the password later, you can only reset it, not view it — so save it now.

## 9. Configuring network access

1. In **Network Access** (left sidebar), click **Add IP Address**.
2. For development, click **Allow Access from Anywhere** (`0.0.0.0/0`). This is required because Vercel's serverless functions don't have a fixed IP on the Hobby plan.
3. Click **Confirm**.

> This is standard practice for small Atlas + Vercel projects, but it means anyone with your connection string (username + password + cluster URL) could connect. Never commit that string to Git — it only lives in `.env.local` and in Vercel's environment variable settings.

## 10. Getting your MongoDB connection string

1. In the Atlas dashboard, click **Connect** on your cluster → **Drivers**.
2. Copy the connection string, which looks like:
   `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
3. Replace `<username>` and `<password>` with the database user you created in Step 8. Keep the rest as-is — the app names the database itself (`vaishnavis_stage`) inside `lib/mongodb.ts`.

**Verification:** you'll test this string in Step 15.

## 11. No login step needed

Unlike most dashboards, there's nothing to configure here — no OAuth app, no client ID/secret, no consent screen, no signup form anywhere in the app. The very first time the dashboard loads, it automatically creates one "owner" record in MongoDB and every page/API route uses it from then on. Skip straight to Step 12.

**Read this first:** because there's no login, anyone who has the dashboard's URL can open it and see private data (client names, fees, notes). See **Step 35 (Security checklist)** before you deploy this anywhere public.

## 12. Configuring environment variables

1. In the project root, copy the example file:
   ```bash
   cp .env.example .env.local
   ```
2. Fill in `.env.local` with, at minimum, the database connection string:
   ```
   MONGODB_URI=mongodb+srv://...           # from Step 10
   ```
3. Leave `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI`, and the push-notification variables blank for now — they're all optional and covered in Steps 27, 27a, and 37. The app runs fully (voice included) with just `MONGODB_URI` set.

`.env.local` is already in `.gitignore` — it will never be committed.

## 13. Installing dependencies

```bash
npm install
```
**Verification:** a `node_modules` folder appears and the command exits with no errors.
**Common error:** peer dependency warnings are usually safe to ignore; actual install *failures* are usually a Node version that's too old (see Step 5).

## 14. Running the project locally

```bash
npm run dev
```
Open http://localhost:3000 — you should land straight on the dashboard home page, no sign-in required.

## 15. Confirming the owner record was created

1. In MongoDB Atlas, open **Browse Collections** on your cluster and look at the `vaishnavis_stage` database.
2. You should see a `users` collection with exactly one document (`isOwner: true`), and a matching `settings` document.
3. That's it — there's no sign-in flow to test.

## 16. Testing event creation

1. On the dashboard, tap **Add Show**.
2. Fill in a title, date, start/end time, and save.
3. Confirm it appears in **Today's Schedule** or **Upcoming** depending on the date you chose.

## 17. Testing scheduling conflicts

1. Create a second event on the same date with overlapping times → you should see a **conflict** message and be blocked from saving.
2. Create a second event on the same date with a small gap (e.g. 30 minutes) but with travel + prep + buffer minutes adding up to more than that gap → you should see a **warning** and a "Save Anyway" option.
3. Create a second event with a comfortable gap → you should see "Schedule looks good."

## 18. Testing calendar export

1. Open any event's menu and choose **Export to Calendar** (or visit `/api/events/<id>/ics`).
2. A `.ics` file should download; opening it in Google/Apple/Outlook calendar should show the correct title, time, and location.

## 19. Testing templates

1. Go to **Templates**. Nine default templates should appear the first time (seeded automatically).
2. Edit one, save, and confirm it persists after a page refresh.
3. Try **Reset to Default** on an edited default template.
4. Try **Duplicate** and **Delete** on a custom template (defaults can't be deleted, only reset).

## 20. Testing public availability

1. Open `/book` in an incognito/private window (no login).
2. Confirm you can see a calendar with available/limited/booked days, but **no** client names, fees, or private notes anywhere in the page or in the Network tab's API responses (`/api/availability`).

## 21. Testing booking requests

1. On `/book`, fill out and submit the booking form.
2. You should land on a success page with a reference ID like `VS-XXXXXXX`.
3. Confirm the request appears in the private dashboard under **Bookings** with status "New."

## 22. Testing booking approval

1. From **Bookings**, open a request and click **Approve**.
2. If it conflicts with an existing event, you should be warned and asked to confirm before it's approved.
3. Once approved, confirm a new event was created (status "Tentative") linked to that booking.
4. Test **Reject** on another request and confirm its status updates without creating an event.

## 23. Testing WhatsApp links

1. From **Templates**, tap **Share on WhatsApp** on any template — it should open `wa.me` with a prefilled message (desktop opens WhatsApp Web; phone opens the app). You still have to tap Send yourself.
2. From **Settings**, tap **Share Availability Link on WhatsApp** and confirm the link is correctly prefilled with your `/book` URL.

## 24. Testing themes

1. Go to **Settings → Theme** and tap through all five themes (Rose, Lavender, Sky, Cream, Midnight).
2. Refresh the page — the theme should persist (from `localStorage`, then confirmed by MongoDB the next time you load the app on any device).

## 25. Testing animations

1. Reload the app in a fresh tab — the splash animation should play once per session, lasting under ~1.2 seconds.
2. In your OS accessibility settings, turn on **Reduce Motion**, then reload — the splash and theme crossfade should be instant/skipped.

## 26. Testing PWA installation

1. On Chrome (Android) or Safari (iOS), open the deployed site and use **Add to Home Screen** / the install icon in the address bar.
2. Confirm the app icon and name appear correctly and it opens without browser chrome.

**Note:** PWA install prompts generally require HTTPS, so this is easiest to test after deploying to Vercel (Step 29) rather than on `localhost`.

## 27. Testing the voice assistant (free, zero setup)

Before touching any optional API keys, try it as-is — this is what she gets forever at zero cost:

1. Tap the mic button anywhere in the app (or the "Ask Vaishnavi's Stage" button in the header).
2. Say or type: **"add a confirmed wedding on 28 September at 7pm"**.
3. Confirm a wedding event appears on 28 September, already marked **Confirmed** — not Tentative.
4. Try: "night shift tomorrow", "is 5 October evening free?", "what's confirmed this month?" — these all work with zero configuration, using the built-in offline parser (no external API, no account, no tier of any kind).

**Verification:** every one of the above gets a sensible reply and, where relevant, actually creates/updates data you can see elsewhere in the dashboard.

## 27a. Configuring optional AI chat (Claude)

This step is entirely optional — voice control already works fully for free (Step 27). This only adds looser, free-form conversation on top of it (e.g. asking things in any phrasing rather than the patterns the offline parser recognizes), and it's the one piece of this app that isn't free — Anthropic bills per request.

1. Go to https://console.anthropic.com/ and create an account.
2. Under **API Keys**, generate a new key.
3. Add it to `.env.local` (and later, Vercel) as:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
4. Restart the dev server. The `/api/ai` route will now call Claude first and automatically fall back to the free offline parser if the call ever fails — voice control never breaks because of this.

The key is used **only** from the server-side API route (`app/api/ai/route.ts`) and is never sent to the browser. She can only add/update schedule data through it (never delete, cancel, change payment status, or approve/reject bookings) — those still require her to act from the relevant screen.

**If you don't want any ongoing cost at all:** skip this step entirely. Leave `ANTHROPIC_API_KEY` blank and the app never calls Claude.

## 27b. Setting up Google Calendar sync (optional)

Also entirely optional. When configured and connected, any event she marks **Confirmed** — by voice, by text, or from the event form — is automatically pushed to her actual Google Calendar, so it shows up and reminds her on every device she's signed into, not just this app. Un-confirming or cancelling an event removes it from Google Calendar again.

**Part A — create the Google OAuth credentials (one-time, in Google Cloud Console):**

1. Go to https://console.cloud.google.com/ and create a new project (or pick an existing one).
2. In the left sidebar, go to **APIs & Services → Library**, search for **Google Calendar API**, and click **Enable**.
3. Go to **APIs & Services → OAuth consent screen**.
   - Choose **External** (unless you have a Google Workspace org, in which case Internal is fine).
   - Fill in the required app name, support email, and developer contact email.
   - Under **Scopes**, add `https://www.googleapis.com/auth/calendar.events` and `https://www.googleapis.com/auth/userinfo.email`.
   - Under **Test users** (while the app is in "Testing" mode), add Vaishnavi's own Google account email — otherwise Google will block the login.
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
   - Application type: **Web application**.
   - Under **Authorized redirect URIs**, add exactly:
     `https://<your-domain>/api/integrations/google/callback`
     (use `http://localhost:3000/api/integrations/google/callback` too, if you want to test this locally first).
   - Click **Create**. Copy the **Client ID** and **Client Secret** shown.

**Part B — add the credentials to your app:**

1. In `.env.local` (and later, Vercel's environment variables), add:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=https://<your-domain>/api/integrations/google/callback
   ```
2. Restart the dev server (or redeploy).

**Part C — connect the account from inside the app:**

1. Open **Settings → Google Calendar** and click **Connect**.
2. You'll be sent to Google's consent screen — sign in as Vaishnavi and approve access.
3. You should be redirected back to Settings showing "Connected."

**Verification:**
1. Add an event and mark it (or say by voice) **Confirmed** — e.g. "add a confirmed wedding on 28 September at 7pm".
2. Open Google Calendar in a browser (the same account you connected) and confirm the event appears there within a few seconds, with the right title, date, and time.
3. Change that event's status away from Confirmed (or cancel it) and confirm it disappears from Google Calendar too.
4. Disconnect from Settings at any time to stop syncing — nothing already on Google Calendar is deleted by disconnecting, only future syncing stops.

**Common errors:**
| Symptom | Likely cause |
|---|---|
| "Google Calendar isn't configured yet" | `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI` missing or the dev server wasn't restarted after adding them |
| Google shows "Access blocked: this app's request is invalid" | The redirect URI in Google Cloud Console doesn't exactly match `GOOGLE_REDIRECT_URI` (check for trailing slashes, http vs https) |
| Google shows "This app is blocked" / "hasn't completed verification" | The consent screen is still in Testing mode and Vaishnavi's email isn't listed under Test users (Part A, step 3) |
| Confirmed event doesn't appear on Google Calendar | Check Settings shows "Connected"; check server logs for a "Google Calendar sync error" — sync failures never block saving in the app, they just fail silently there |

## 28. Pushing to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Vaishnavi's Stage"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/vaishnavis-stage.git
git push -u origin main
```
**Verification:** refresh your GitHub repo page and see all files (confirm `.env.local` is *not* there).

## 29. Deploying to Vercel

1. Go to https://vercel.com/new and import your GitHub repository.
2. Framework preset should auto-detect **Next.js**.
3. Before clicking Deploy, add the environment variables (next step).

## 30. Configuring production environment variables

In the Vercel project's **Settings → Environment Variables**, add each of these (Production environment):

```
MONGODB_URI=...
ANTHROPIC_API_KEY=...                     (optional, Step 27a)
GOOGLE_CLIENT_ID=...                      (optional, Step 27b)
GOOGLE_CLIENT_SECRET=...                  (optional, Step 27b)
GOOGLE_REDIRECT_URI=...                   (optional, Step 27b)
```
If you set up Google Calendar sync, remember `GOOGLE_REDIRECT_URI` must point at your real production domain, and that same URI must also be listed under Authorized redirect URIs in Google Cloud Console (Step 27b, Part A).

Redeploy after saving (Vercel usually does this automatically).

## 31. Restricting who can reach the dashboard

Since there's no login, add access control at the hosting layer instead if you don't want the dashboard reachable by anyone with the link:
- On Vercel, **Deployment Protection** (Password Protection or Vercel Authentication) is the simplest option — check your plan's availability under **Settings → Deployment Protection**.
- Alternatively, keep the URL private and only share it with Vaishnavi.
- The public `/book` page is meant to be open to everyone, so don't apply protection to that route specifically if your hosting lets you scope it per-path.

## 32. MongoDB production setup

No changes needed beyond Steps 6–10 — the same free M0 cluster serves both local development and production. If you outgrow the free tier, Atlas will prompt you to upgrade; it will not silently start charging you.

## 33. Free-tier limitations

- **Vercel Hobby plan:** generous free bandwidth and serverless function execution for personal projects, but it's meant for non-commercial use and has fair-use limits on function duration and bandwidth. Monitor usage in the Vercel dashboard under **Usage**.
- **MongoDB Atlas M0:** 512 MB storage, shared CPU/RAM, capped connections. Perfectly fine for one host's personal booking data, but not for a high-traffic public site.
- **Public traffic:** every visit to `/book` triggers a read from MongoDB and a Vercel function invocation. Normal sharing on Instagram/WhatsApp is fine; if you expect very high traffic, monitor both dashboards.
- **Browser speech recognition:** not supported in all browsers (notably absent in Firefox and some in-app browsers). The app requires a text-input fallback for exactly this reason — and that fallback is exactly as free and capable as speaking.
- **Voice/text assistant:** the default offline engine (Step 27) is genuinely free forever, with no rate limit beyond your own MongoDB/Vercel usage. Claude (Step 27a) is the one optional piece that costs money, billed by Anthropic per request — skip it entirely if you want $0 no matter what.
- **Google Calendar API:** Google's free quota (Calendar API) is very generous for a single personal calendar's worth of syncing and won't realistically be hit by this app.

## 34. How to avoid accidental billing

- Never enter a credit card on Atlas or Vercel unless you intentionally choose a paid plan.
- Don't enable Vercel's "Pro" trial or Atlas's paid clusters (M10+) unless you mean to.
- Skip Step 27a (`ANTHROPIC_API_KEY`) entirely if you want the assistant to never cost anything — the app works fully without it.
- Set up billing alerts in both the Vercel/Atlas dashboards, and in the Anthropic Console if you do add a key.

## 35. Security checklist

- [ ] `.env.local` is not committed (check `.gitignore`)
- [ ] `MONGODB_URI`, `ANTHROPIC_API_KEY`, and `GOOGLE_CLIENT_SECRET` only exist as environment variables, never in client code
- [ ] The dashboard has **no login and no signup** — you've either kept its URL private or enabled deployment protection (see Step 31) so strangers can't browse Vaishnavi's private client data
- [ ] `/book` and `/api/availability` return no client names, fees, venues, or notes (re-check Step 20 after any change to `lib/availability.ts`)
- [ ] MongoDB Atlas network access is reviewed periodically (Step 9)
- [ ] If Google Calendar is connected, the OAuth consent screen's Test users list (or app verification status) only includes Vaishnavi's own account (Step 27b, Part A)

## 36. Troubleshooting

| Symptom | Likely cause |
|---|---|
| "MONGODB_URI is not set" | `.env.local` missing or dev server wasn't restarted after editing it |
| Theme resets on every reload | Browser is blocking `localStorage` (private/incognito mode with strict settings) |
| `.ics` file won't open | Some calendar apps are picky about calling the download URL directly from a browser tab instead of via the "Export" button/link, which sets the correct `Content-Type` |
| Voice button does nothing on iPhone Safari | iOS Safari's speech recognition support is inconsistent; use the text input fallback (still free, still full-featured) |
| Booking approval always says "conflict" | Check your default travel/prep/buffer minutes in Settings — they may be higher than the actual gap between events |
| Build fails with a Tailwind/Radix class error | Run `npm run lint` and `npm run typecheck` locally first (see README) and fix the reported file/line |
| Voice-added Confirmed event isn't on Google Calendar | See the Google Calendar troubleshooting table at the end of Step 27b |

## 37. Setting up real push notifications (new)

Vaishnavi's Stage can now send actual mobile/desktop notifications — when a client
lands a booking request, and as reminders before her own shows — using the
standard Web Push API (no third-party service, no extra account needed).

1. Generate a key pair: `npx web-push generate-vapid-keys`
2. Add to `.env.local` (and to Vercel's environment variables for production):
   - `VAPID_PUBLIC_KEY` — the public key it printed
   - `VAPID_PRIVATE_KEY` — the private key it printed (keep this secret)
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — the **same** public key again (this copy is
     what the browser uses to subscribe)
   - `VAPID_SUBJECT` — `mailto:` + an email you control, e.g. `mailto:you@example.com`
   - `CRON_SECRET` — any random string, e.g. generate one with `openssl rand -hex 16`
3. Restart the dev server (or redeploy) so the new env vars are picked up.
4. Open Settings in the app and turn on the "Notifications" toggle. Your
   browser will ask for notification permission — allow it.
5. To actually get reminders "on time" (not just when the app happens to be
   open), something needs to call `/api/reminders/due` every few minutes.
   This is **not** done via Vercel Cron / `vercel.json` — Vercel's Hobby
   plan only allows a cron job to run once a day, which is useless for a
   reminder that needs to fire within a few minutes of the actual time.
   Instead, use an external scheduler:
   - **Included, free, no extra account** — `.github/workflows/reminders-cron.yml`
     pings the endpoint every 5 minutes via GitHub Actions. Just add two
     repository secrets (Settings → Secrets and variables → Actions):
     `APP_URL` (e.g. `https://your-app.vercel.app`) and `CRON_SECRET`
     (same value as the env var). It starts running automatically once
     merged to your default branch; you can also trigger it manually from
     the Actions tab to test it right away. GitHub only guarantees
     scheduled runs *approximately* on time (can be a few minutes late
     under load), and pauses workflows after 60 days of repo inactivity
     (just re-enable from the Actions tab if that happens).
   - **Sub-minute precision instead** — point a free always-on service like
     [cron-job.org](https://cron-job.org) at
     `https://your-domain/api/reminders/due?secret=YOUR_CRON_SECRET` every
     5 minutes.
   - If you're on Vercel Pro/Enterprise (not Hobby), you can still add a
     `vercel.json` with a `crons` entry on `*/5 * * * *` if you'd rather
     not use either of the above.
6. Test it: create an event with a reminder a couple of minutes in the
   future (or manually visit `/api/reminders/due?secret=...` once one is
   due) and confirm a notification appears on your device.

## Future improvements (not implemented in this version)

- Google Calendar *two-way* sync (currently one-way: Confirmed events push out to Google Calendar, but edits made directly on Google Calendar don't flow back into this app)
- Google Maps–based automatic travel time estimation (currently manual entry)
- Hindi / Marathi / Hinglish voice command support (English only for now; code is structured to add these later)
- A dedicated Clients CRM view (client data currently lives on individual events; the `Client` model is in place for this)
