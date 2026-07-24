# Kungliga Barbershop — 3D Immersive Website

An immersive single-page website for **Kungliga Barbershop** — first-class men's grooming
in Uppsala since **2013**. Kungsängsesplanaden 10D, 753 18 Uppsala · 073-728 73 93 ·
bookings via [Bokadirekt](https://www.bokadirekt.se/places/kungliga-barbershop-57688).

## The experience

- **Bespoke WebGL particle stage** (`js/gl.js`) — a dependency-free engine rendering ~9,000
  glowing particles that **morph between 3D shapes as you scroll**:
  royal crown → scissors → straight razor → comb → barber pole → handlebar mustache.
- **Scroll-driven theming** — each section retunes the entire page (background, accents and
  the WebGL palette) with cinematic cross-fades: midnight gold, oxblood leather, steel,
  barber-pole red.
- Cinematic **preloader** with drawn crown monogram and rising wordmark.
- **Custom cursor** with magnetic hover ring, film-grain overlay and vignette.
- **3D tilt cards** with pointer-tracking glare, glassmorphism service cards, count-up
  timeline numbers, marquee, and staggered reveal animations.
- Fully **self-contained** — zero external dependencies, fonts or CDNs. Works offline and
  deploys anywhere static files are served (GitHub Pages included).
- Respects `prefers-reduced-motion`, responsive down to mobile, graceful WebGL fallback.

## Direct booking (`booking.html`)

Customers book on the site itself — no third-party account:

1. **Service** — Klippning (60 min), Rakning & skägg (30 min), Kombination (90 min)
2. **Time** — a 14-day day-strip and slot grid generated from the real opening hours
   (Mon–Fri 10–19, Sat 11–16, Sun closed), with a 60-minute lead time and
   conflict detection against existing bookings
3. **Details** — name + mobile (validated), optional email and notes, live summary
4. **Done** — booking reference (e.g. `KB-3F9A2`), **Add to calendar** (.ics download),
   **Text the shop** (prefilled SMS to 073-728 73 93) and copy-summary

Booked and admin-blocked times are **removed from the public slot grid entirely** — a
customer never sees a time that isn't actually free, and the slot is re-checked at the
moment of confirmation in case it was just taken. The WebGL stage follows the wizard:
scissors → comb → razor → crown.

## Admin (`admin.html`)

A private staff area behind a login:

- **Login** — password gate (default `kungliga2013` — change it on first login in the
  Security panel; the password is stored as a salted SHA-256 hash, never in plain text).
- **Booked times** — every booking with day, time, service, customer name, phone, email
  and notes, filterable (upcoming / all / cancelled) with Confirm / Cancel / Restore /
  Delete. Cancelling a booking instantly frees the slot on the public page.
- **Availability** — block a time range or a whole day (lunch, holiday, private clients);
  blocked times disappear from the customers' booking page immediately. Unblock restores.
- **Stats** — bookings today, upcoming, and active blocks at a glance.

## Data layer (`js/store.js`)

All pages share one store. By default it uses `localStorage` (single-browser demo). Two
hooks make it production-ready without touching page code:

- `window.KUNGLIGA_STORE_DRIVER = { get(key), set(key, value) }` (async) — plug in any
  shared storage (a serverless KV, Supabase, or a hosted DB) and bookings/blocks become
  shared across all visitors and devices.
- `window.KUNGLIGA_BOOKING_ENDPOINT` — optional URL; each new booking is also POSTed
  there as JSON for notifications/integration.

**Honest limitation:** on a purely static host with no driver configured, data lives in
each visitor's own browser — the admin sees bookings made on the same device, and the SMS
handoff carries the booking to the shop. Add a shared driver/backend to make it global.

## Running

No build step. Open `index.html`, or serve statically:

```bash
python3 -m http.server 8080
# → http://localhost:8080
```

## Structure

```
index.html      # single page, all sections
css/style.css   # design system, themes, motion
js/gl.js        # WebGL particle engine (no dependencies)
js/main.js      # preloader, scroll orchestration, tilt, counters
assets/         # drop-in point for photography (see assets/README.md)
```

## Notes

- The gallery tiles are procedural (pure CSS) and designed to be swapped for real
  photography — the shop's Instagram (@kungliga_barbershop) or AI-generated imagery
  (e.g. Higgsfield) — see `assets/README.md`.
- Service cards describe the house offering; live prices and durations are on Bokadirekt.
