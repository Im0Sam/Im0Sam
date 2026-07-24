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

Bookings persist in `localStorage`. To connect a real backend, set
`window.KUNGLIGA_BOOKING_ENDPOINT` (in a small inline script or config file) to any URL
accepting `POST` JSON `{ ref, service, date, time, duration, name, phone, email, notes }` —
a serverless function, Formspree form, or Supabase table all work; the SMS handoff remains
as fallback. The WebGL stage follows the wizard: scissors → comb → razor → crown.

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
