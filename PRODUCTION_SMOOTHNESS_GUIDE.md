# Vaishnavi's Stage — Production Smoothness Guide

This is a companion to `VAISHNAVIS_STAGE_SETUP_STEPS.md`, focused entirely on
one question: **why did production feel less smooth than local dev, and what
changes it?** It covers exactly what was fixed in this pass, why each thing
mattered, how to deploy so those fixes actually take effect, and how to keep
things smooth as the app keeps growing.

---

## 1. What was actually slowing things down

Nothing here was a "randomly add caching" guess — every item below was found
by reading the actual request path for a real screen and counting how many
network round-trips it made before anything appeared.

### 1.1 Every page and API call paid for a hidden extra database round-trip

`getOwnerUserId()` runs at the top of nearly every server component and API
route in the app (it's how the app knows which MongoDB documents belong to
Vaishnavi, since there's no login). It used to re-verify that the cached
owner ID still existed in MongoDB **on every single call, forever** — not
just once per warm server. That's one extra Atlas round-trip stacked in
front of the *real* work on every screen, every API call, all day.

**Fix:** `lib/auth.ts` now only re-verifies once every 5 minutes per warm
server instance. It still catches a wiped/reseeded database quickly; it just
stops paying for the check on every request.

### 1.2 The home page queried the same document twice, back to back

`app/(dashboard)/layout.tsx` and `app/(dashboard)/page.tsx` each
independently ran `Settings.findOne(...)` — two separate, sequential
MongoDB queries before the home page could render anything, every time you
opened the app.

**Fix:** `lib/get-settings.ts` wraps the query in React's `cache()`, so
multiple server components rendered for the same request share one query
instead of each firing their own.

### 1.3 Saving/editing an event could hang on a live call to Google's API

If Google Calendar sync is connected, creating or updating a **Confirmed**
event used to `await` a real network call to `googleapis.com` before the
save request even returned to the browser. If Google's API was slow (or
your Google token needed a silent refresh first), Vaishnavi's "Save" button
would just sit there — for a feature that's explicitly documented as
best-effort and allowed to fail silently.

**Fix:** `app/api/events/route.ts` and `app/api/events/[id]/route.ts` now
use Next.js's `unstable_after()` to run the Google sync *after* the
response has already been sent. The save completes instantly; the calendar
sync happens quietly behind it. Same fix applied to the push notification
sent when a client submits a booking request (`app/api/bookings/route.ts`)
and to the Google Calendar cleanup on event delete — both were previously
"fire-and-forget" promises that Vercel's serverless runtime could cut off
mid-flight the instant the response was sent, meaning that notification or
cleanup might silently never finish. `after()` guarantees they run to
completion.

> This required adding a `next.config.js` with `experimental: { after: true
> }` — **there was no `next.config.js` in the project at all**, so this
> flag (and any future Next.js config, like image domains or headers)
> had nowhere to live.

### 1.4 The public `/book` page was blank, then popped in

`/book` — the page a client opens from an Instagram bio link or a WhatsApp
message — was a fully client-rendered page. The browser had to download and
run its JavaScript *first*, then fetch the profile photo/name from an API,
*then* finally render. On a client's mobile data, that's a real blank-to-
content delay on the single most important first impression in the whole
app. It also called the heavier `/api/availability` endpoint (which computes
weeks of day-by-day availability) just to read a name and a photo it never
used.

**Fix:** `/book` is now a server component. The profile is read directly
from MongoDB during the server render, so the HTML that reaches the phone is
already complete — no loading flash, no wasted availability computation.

### 1.5 No loading states, no error screens

Nothing in the app had a `loading.tsx` or `error.tsx`. Two consequences:

- Any page whose data took a moment to fetch (a slightly slow Atlas
  round-trip, common on the free M0 tier under load) showed a **blank white
  screen** with nothing on it until it was ready.
- Any unhandled error (a dropped connection, a timeout) showed **Next.js's
  raw default crash page** instead of anything that looked like part of the
  app.

**Fix:** Added `app/(dashboard)/loading.tsx` (a skeleton that mirrors the
dashboard's real layout), `app/(dashboard)/error.tsx` and `app/error.tsx`
(a friendly "try again" screen instead of a raw crash), and
`app/book/loading.tsx` for the public page.

### 1.6 A broken `npm` script

`package.json` has a `create-indexes` script pointing at
`scripts/create-indexes.ts` — but that file didn't exist anywhere in the
project. Running `npm run create-indexes` would just fail. The script has
been restored (see §4 for why it matters).

---

## 2. What this does and doesn't fix

Worth being precise about this, since "smooth" can mean different things:

**Fixed:** redundant database round-trips on every page/API call, a blocking
external API call on every event save, a client-rendered public landing
page with a visible loading flash, missing loading/error states, and a
broken setup script.

**Not changed (by design, not overlooked):**
- The 1.6-second splash screen on app open — that's an intentional design
  choice (see `components/splash-screen.tsx`), not a bug. If you'd rather it
  were shorter or skippable-by-default, that's a quick one-line change to
  the `duration` constant in that file.
- The voice assistant's Google Calendar sync (`app/api/ai/route.ts`) is
  still awaited before responding, unlike the two event routes above. That
  one's intentional too — the assistant's reply tells you whether the sync
  succeeded, so it needs the result before it can answer. In practice this
  is a small fraction of the assistant's total response time anyway, since
  it's already waiting on the Claude API for the language understanding
  step.

---

## 3. Deploying so these fixes actually take effect

If you already have this app deployed on Vercel, the fixes above only kick
in once you push this updated code — nothing here is a MongoDB or Vercel
*setting* you need to toggle separately. That said, a few deploy-time
details matter for smoothness specifically:

### 3.1 Put your Vercel project and your Atlas cluster in the same region

This is the single biggest lever you have over perceived speed that isn't a
code change. Every database call in this app — and there are several per
page — pays for the network round-trip between wherever your Vercel
function runs and wherever your Atlas cluster lives. If Vaishnavi is based
in India and your Atlas cluster is in `us-east-1` while your Vercel
functions run in Washington D.C. (Vercel's default region, `iad1`), you're
fine to each other but both far from your actual user, adding real
latency to every screen.

- In Vercel: **Project → Settings → Functions → Function Region.** Pick the
  region geographically closest to Vaishnavi (for India, `bom1` — Mumbai —
  if available on your plan; otherwise the closest region Vercel offers).
- In Atlas: when creating your M0 cluster, pick the same region (or the
  closest matching one Atlas offers on the free tier — AWS Mumbai
  `ap-south-1` pairs well with Vercel's `bom1`).
- **Verification:** in Vercel's function logs, note how long the database
  calls inside a request take. If a single `Event.find(...)` call is taking
  more than ~150–200ms fairly consistently, region mismatch is the first
  thing to check.

### 3.2 Run the index-creation script once after your first deploy

```bash
# From your local machine, with MONGODB_URI pointed at your production
# Atlas cluster (or just reuse .env.local if it's the same cluster):
npm run create-indexes
```

By default, MongoDB builds a missing index the first time it's needed — so
without running this, the very *first* request that hits a given collection
(say, the first booking submitted through `/book/request`, or the first time
`/calendar` is opened) pays for building that index on the spot, which is a
noticeably slower one-time request. Running this script once after deploying
(and again any time you add a new `.index()` call to a model) avoids that.

### 3.3 Set the same environment variables in Vercel that you use locally

Covered in full in `VAISHNAVIS_STAGE_SETUP_STEPS.md` (Step 30), but the
smoothness-specific ones to double check:

- `MONGODB_URI` — obviously required; a missing or wrong value doesn't make
  things "unsmooth," it makes literally every page error, so it's the first
  thing to check if the *whole app* (not just one feature) is misbehaving.
- If you've connected Google Calendar, make sure `GOOGLE_REDIRECT_URI`
  points at your real production domain, not `localhost`. A stale value here
  won't break saves (thanks to the `after()` fix above, sync failures no
  longer block anything) but it will mean confirmed events silently never
  make it to Google Calendar.

### 3.4 Redeploy after any environment variable change

Vercel usually triggers this automatically when you save new environment
variables, but if you ever see old behavior persisting after a config
change, check **Deployments** and manually trigger a redeploy — Next.js
bakes some environment variables into the build at build time, not just at
request time.

---

## 4. Verifying it's actually smoother

Don't just take the diff's word for it — here's how to see the difference:

1. **Vercel function logs.** Open **Project → Logs** (or **Observability**
   on newer Vercel plans) right after visiting a page. Before this pass,
   you'd typically see 3–5 sequential MongoDB calls logged for a single
   dashboard load; that should now be visibly fewer.
2. **Network tab, `/book`.** Open your production `/book` URL in a private
   browser window with DevTools open. The HTML response itself should now
   already contain the profile name — search the response body (not just
   the rendered page) for Vaishnavi's display name. If it's there in the raw
   HTML, the server-render fix is working.
3. **Time to the "Save" toast on a Confirmed event edit** (only relevant if
   Google Calendar is connected). This should now feel closer to a normal
   database save and not have a variable, sometimes-longer pause.
4. **Vercel's "Speed Insights"** (free on Hobby, opt-in per project under
   **Analytics**) gives you a real, ongoing Core Web Vitals score from
   actual visitors — the closest thing to an objective "is it smooth" number
   over time, rather than a one-off manual check.

---

## 5. Where to look if something still feels off

| Symptom | Where to look first |
|---|---|
| Whole app slow, not just one page | Vercel Function Region vs. Atlas cluster region (§3.1) — the most common root cause |
| One specific page slow | Open that page's Network tab entry for its own data fetch and check the duration; compare against others |
| "Save" feels slow only when Google Calendar is connected | Should no longer happen after this pass — if it still does, check `app/api/events/route.ts` / `[id]/route.ts` still wrap the sync in `after(...)` and that `experimental.after` is `true` in `next.config.js` |
| Blank white flash when switching tabs in the app | Confirm `app/(dashboard)/loading.tsx` exists and wasn't accidentally removed |
| A raw, ugly error page instead of the app's own UI | Confirm `app/(dashboard)/error.tsx` and `app/error.tsx` exist; check the Vercel function logs for the actual underlying error (`console.error` calls throughout the app are there specifically so you can find the real cause in logs) |
| First request after a deploy is slow, then it's fine | Expected on a cold serverless function; also make sure `npm run create-indexes` has been run at least once (§3.2) |
| Booking push notification to Vaishnavi doesn't arrive reliably | Confirm VAPID env vars are set in Vercel (not just locally) — see Step 37 of the setup guide; also confirm `app/api/bookings/route.ts` still wraps the push send in `after(...)` |

---

## 6. Growth watch-list (not urgent today, but worth knowing about)

These aren't bugs for a single-user app with a modest, personal number of
events — but they're the kind of thing that quietly gets slower as years of
data accumulate, so it's worth knowing they exist:

- **`components/calendar-view.tsx`** fetches *every* event in the database
  on every load (`fetch('/api/events')` with no date range), then filters
  client-side. Fine for hundreds of events; if the collection grows into the
  low thousands, switch this to fetching a bounded window (e.g. the visible
  month ± a few months) the same way the dashboard's `/api/events?from=...`
  call already does.
- **MongoDB Atlas M0 (free tier) limits:** 512 MB storage, shared CPU, a
  capped number of simultaneous connections. None of this matters for one
  person's booking calendar, but if `/book` ever gets a real traffic spike
  (e.g. shared somewhere with a large audience), keep an eye on Atlas's
  connection count in its dashboard.
- **Profile photos are stored as base64 inside the Settings document**
  (see `lib/image.ts`) rather than in separate file storage. They're capped
  at 480px/JPEG quality 0.85 so they stay small (tens of KB), which is fine
  — just don't be surprised that the Settings document is larger than the
  others if you ever inspect the database directly.

---

## 7. Quick pre-launch smoke test

Before sharing a fresh deploy with Vaishnavi or her clients, run through this
in under five minutes:

1. Open the production URL on your **phone**, on mobile data (not wifi) —
   this is closer to how a client actually opens `/book`.
2. `/book` → photo and name should appear with no visible blank flash.
3. Dashboard `/` → should show a skeleton briefly (if at all) rather than a
   blank screen, then the real content.
4. Add a test event, mark it Confirmed (if Google Calendar is connected) →
   the save should feel instant, not sticky.
5. Submit a real test booking through `/book/request` → confirm the push
   notification arrives on Vaishnavi's device within a few seconds (if push
   is set up).
6. Force an error on purpose (e.g. temporarily rename an env var in Vercel
   and redeploy) → confirm you see the app's own friendly error screen, not
   Next's raw crash page — then put the env var back and redeploy again.
