/* ═══════════════════════════════════════════════════════════════
   KUNGLIGA — interaction layer
   preloader · custom cursor · scroll orchestration · section
   themes → WebGL scenes · reveals · counters · 3D tilt cards
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── preloader ───────────────────────────────────────────── */
  var pre = document.getElementById("preloader");
  var count = document.getElementById("preloadCount");
  var p = 0;
  var tick = setInterval(function () {
    p = Math.min(100, p + Math.ceil(Math.random() * 14));
    if (count) count.textContent = (p < 10 ? "0" : "") + p;
    if (p >= 100) {
      clearInterval(tick);
      setTimeout(function () {
        pre.classList.add("is-done");
        document.body.classList.add("is-ready");
      }, 350);
    }
  }, REDUCED ? 20 : 110);

  /* ── custom cursor ───────────────────────────────────────── */
  var dot = document.getElementById("cursorDot");
  var ring = document.getElementById("cursorRing");
  var cx = -100, cy = -100, rx = -100, ry = -100;
  window.addEventListener("pointermove", function (e) {
    cx = e.clientX; cy = e.clientY;
    dot.style.left = cx + "px";
    dot.style.top = cy + "px";
  }, { passive: true });
  (function ringLoop() {
    rx += (cx - rx) * 0.16;
    ry += (cy - ry) * 0.16;
    ring.style.left = rx + "px";
    ring.style.top = ry + "px";
    requestAnimationFrame(ringLoop);
  })();
  document.querySelectorAll("a, button, [data-hover], [data-tilt]").forEach(function (el) {
    el.addEventListener("pointerenter", function () { ring.classList.add("is-hover"); });
    el.addEventListener("pointerleave", function () { ring.classList.remove("is-hover"); });
  });

  /* ── header hide / show + progress bar ───────────────────── */
  var header = document.getElementById("header");
  var bar = document.getElementById("progressBar");
  var lastY = 0;
  window.addEventListener("scroll", function () {
    var y = window.scrollY;
    header.classList.toggle("is-scrolled", y > 40);
    header.classList.toggle("is-hidden", y > 300 && y > lastY);
    lastY = y;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (max > 0 ? (y / max) * 100 : 0) + "%";
  }, { passive: true });

  /* ── section observer: theme + WebGL scene + nav dots ────── */
  var dots = Array.prototype.slice.call(document.querySelectorAll(".dots__dot"));
  var sections = Array.prototype.slice.call(document.querySelectorAll(".section"));
  var sectionObs = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var sec = en.target;
      var theme = sec.getAttribute("data-theme");
      var shape = sec.getAttribute("data-shape");
      if (theme) document.body.setAttribute("data-theme", theme);
      if (window.KGL && shape) window.KGL.setScene(shape, theme || "hero");
      dots.forEach(function (d) {
        d.classList.toggle("is-active", d.getAttribute("href") === "#" + sec.id);
      });
    });
  }, { threshold: 0.45 });
  sections.forEach(function (s) { sectionObs.observe(s); });

  /* ── reveal on scroll (staggered per section) ────────────── */
  var revealObs = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) {
        en.target.classList.add("is-in");
        revealObs.unobserve(en.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
  sections.forEach(function (sec) {
    var els = sec.querySelectorAll(".reveal");
    els.forEach(function (el, i) {
      el.style.setProperty("--d", (i * 0.09) + "s");
      revealObs.observe(el);
    });
  });

  /* ── count-up numbers ────────────────────────────────────── */
  function countUp(el) {
    var target = parseInt(el.getAttribute("data-count"), 10);
    if (isNaN(target)) return;
    var from = target > 1000 ? target - 82 : 0; // years roll in from nearby
    var t0 = null, dur = 1600;
    function step(now) {
      if (!t0) t0 = now;
      var k = Math.min(1, (now - t0) / dur);
      k = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(from + (target - from) * k);
      if (k < 1) requestAnimationFrame(step);
    }
    if (REDUCED) { el.textContent = target; return; }
    requestAnimationFrame(step);
  }
  var countObs = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) {
        countUp(en.target);
        countObs.unobserve(en.target);
      }
    });
  }, { threshold: 0.6 });
  document.querySelectorAll("[data-count]").forEach(function (el) { countObs.observe(el); });

  /* ── 3D tilt cards with tracking glare ───────────────────── */
  if (!REDUCED) {
    document.querySelectorAll("[data-tilt]").forEach(function (card) {
      var raf = null;
      card.addEventListener("pointermove", function (e) {
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = null;
          var r = card.getBoundingClientRect();
          var px = (e.clientX - r.left) / r.width;
          var py = (e.clientY - r.top) / r.height;
          card.style.transform =
            "perspective(1100px) rotateY(" + ((px - 0.5) * 10) + "deg)" +
            " rotateX(" + ((0.5 - py) * 10) + "deg) translateZ(6px)";
          card.style.setProperty("--gx", (px * 100) + "%");
          card.style.setProperty("--gy", (py * 100) + "%");
        });
      });
      card.addEventListener("pointerleave", function () {
        card.style.transition = "transform .7s cubic-bezier(.16,1,.3,1)";
        card.style.transform = "";
        setTimeout(function () { card.style.transition = ""; }, 700);
      });
    });
  }
})();
