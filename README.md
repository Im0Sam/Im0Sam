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
