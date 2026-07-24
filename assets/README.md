# Assets

This folder is the drop-in point for photography / AI-generated imagery
(e.g. from Higgsfield, or real shots from @kungliga_barbershop on Instagram).
The site is fully functional without images — the gallery tiles are procedural
CSS art — but real photography upgrades it further.

## Recommended set

| File            | Suggested content                                        | Size      |
|-----------------|----------------------------------------------------------|-----------|
| `hero.jpg`      | The shop interior — chairs, mirrors, warm light          | 1920×1080 |
| `pole.jpg`      | Barber pole / shopfront on Kungsängsesplanaden           | 1200×900  |
| `leather.jpg`   | Leather chair detail, brass & steel                      | 1200×900  |
| `tools.jpg`     | Scissors, combs, straight razor flat-lay                 | 1200×900  |
| `fade.jpg`      | A fresh skin fade / beard line-up, editorial style       | 1200×900  |
| `night.jpg`     | The shopfront at blue hour                               | 1200×900  |

## Wiring them in

Each gallery tile in `index.html` has a `tile__art` div. To use a photo, replace
the procedural background in `css/style.css`, e.g.:

```css
.tile--leather .tile__art {
  background: url("../assets/leather.jpg") center/cover no-repeat;
}
```

Generate at 16:9 / 4:3, then downscale + compress (e.g. `cwebp -q 82`) before committing.
