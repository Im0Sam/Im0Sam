/* ═══════════════════════════════════════════════════════════════
   KUNGLIGA — bespoke WebGL particle stage (no dependencies)
   A single fixed canvas renders ~9k gold particles that morph
   between shapes as you scroll: crown → scissors → straight razor
   → comb → barber pole → mustache.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var canvas = document.getElementById("gl");
  if (!canvas) return;
  var gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false });
  if (!gl) { canvas.style.display = "none"; return; }

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var MOBILE = Math.min(window.innerWidth, window.innerHeight) < 700;
  var N = MOBILE ? 5000 : 9000;      // morphing particles
  var ND = MOBILE ? 400 : 900;       // ambient dust

  /* ── shaders ─────────────────────────────────────────────── */
  var VSH = [
    "precision mediump float;",
    "attribute vec3 aStart;",
    "attribute vec3 aEnd;",
    "attribute vec4 aRand;", // x: size, y: morph stagger, z: wobble speed, w: brightness
    "uniform mat4 uMVP;",
    "uniform float uMorph, uTime, uSize, uWobble;",
    "varying float vBright, vFade;",
    "void main(){",
    "  float m = smoothstep(0.0, 1.0, clamp(uMorph * 1.6 - aRand.y * 0.6, 0.0, 1.0));",
    "  vec3 p = mix(aStart, aEnd, m);",
    "  p += vec3(",
    "    sin(uTime * aRand.z + p.y * 4.0),",
    "    cos(uTime * aRand.z * 1.31 + p.x * 3.0),",
    "    sin(uTime * aRand.z * 0.83 + p.z * 3.5)",
    "  ) * uWobble * (0.4 + aRand.w * 0.6);",
    "  vec4 mv = uMVP * vec4(p, 1.0);",
    "  gl_Position = mv;",
    "  float d = max(mv.w, 0.001);",
    "  gl_PointSize = clamp(aRand.x * uSize / d, 1.0, 64.0);",
    "  vBright = aRand.w;",
    "  vFade = clamp(2.6 / d, 0.0, 1.0);",
    "}"
  ].join("\n");

  var FSH = [
    "precision mediump float;",
    "uniform vec3 uColA, uColB;",
    "uniform float uAlpha;",
    "varying float vBright, vFade;",
    "void main(){",
    "  vec2 uv = gl_PointCoord - 0.5;",
    "  float d = length(uv);",
    "  float a = smoothstep(0.5, 0.02, d);",
    "  a *= a;",
    "  vec3 col = mix(uColB, uColA, vBright);",
    "  col += uColA * smoothstep(0.18, 0.0, d) * 0.6;", // hot core
    "  gl_FragColor = vec4(col * a * vFade * uAlpha, 1.0);",
    "}"
  ].join("\n");

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s));
    }
    return s;
  }
  var prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VSH));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FSH));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    canvas.style.display = "none"; return;
  }
  gl.useProgram(prog);

  var loc = {
    aStart: gl.getAttribLocation(prog, "aStart"),
    aEnd: gl.getAttribLocation(prog, "aEnd"),
    aRand: gl.getAttribLocation(prog, "aRand"),
    uMVP: gl.getUniformLocation(prog, "uMVP"),
    uMorph: gl.getUniformLocation(prog, "uMorph"),
    uTime: gl.getUniformLocation(prog, "uTime"),
    uSize: gl.getUniformLocation(prog, "uSize"),
    uWobble: gl.getUniformLocation(prog, "uWobble"),
    uColA: gl.getUniformLocation(prog, "uColA"),
    uColB: gl.getUniformLocation(prog, "uColB"),
    uAlpha: gl.getUniformLocation(prog, "uAlpha")
  };

  /* ── tiny mat4 helpers ───────────────────────────────────── */
  function persp(fov, aspect, near, far) {
    var f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
    return [
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0
    ];
  }
  function mul(a, b) {
    var o = new Array(16);
    for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  }
  function rotX(t) { var c = Math.cos(t), s = Math.sin(t); return [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]; }
  function rotY(t) { var c = Math.cos(t), s = Math.sin(t); return [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]; }
  function trans(x, y, z) { return [1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]; }

  /* ── shape generators (each fills n*3 floats, radius ≈ 1.1) ── */
  var R = function () { return Math.random(); };

  function genCrown(n) {
    var a = new Float32Array(n * 3), PEAKS = 8;
    for (var i = 0; i < n; i++) {
      var r3 = R(), th = R() * Math.PI * 2, x, y, z, rad;
      if (r3 < 0.32) {                          // base band
        y = -0.62 + R() * 0.22;
        rad = 1.0 + (R() - 0.5) * 0.06;
        x = Math.cos(th) * rad; z = Math.sin(th) * rad;
      } else if (r3 < 0.86) {                   // zig-zag peaks
        var tri = 1 - Math.abs(((th * PEAKS / (Math.PI * 2)) % 1) * 2 - 1);
        var yMax = -0.4 + 1.15 * tri;
        y = (R() < 0.55) ? yMax : (-0.4 + (yMax + 0.4) * Math.pow(R(), 0.4));
        rad = 1.0 - (y + 0.4) * 0.18;
        x = Math.cos(th) * rad; z = Math.sin(th) * rad;
      } else {                                  // gem orbs on apexes
        var k = Math.floor(R() * PEAKS);
        var ang = (k + 0.5) * Math.PI * 2 / PEAKS;
        var gr = 0.09 * Math.cbrt(R());
        var u = R() * Math.PI * 2, v = Math.acos(2 * R() - 1);
        var cx = Math.cos(ang) * 0.82, cz = Math.sin(ang) * 0.82, cy = 0.85;
        x = cx + gr * Math.sin(v) * Math.cos(u);
        y = cy + gr * Math.cos(v);
        z = cz + gr * Math.sin(v) * Math.sin(u);
      }
      a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z;
    }
    return a;
  }

  function genScissors(n) {
    // open scissors: two blades crossing at a pivot, finger rings below
    var a = new Float32Array(n * 3), ANG = 0.4;
    for (var i = 0; i < n; i++) {
      var r3 = R(), side = R() < 0.5 ? -1 : 1, x, y, z = (R() - 0.5) * 0.05;
      var dx = Math.sin(ANG) * side, dy = Math.cos(ANG);
      if (r3 < 0.44) {                          // blades (taper to the tip)
        var t = Math.pow(R(), 0.8);
        var w = 0.055 * (1 - t) + 0.006;
        var px = (R() - 0.5) * 2 * w;
        x = dx * t * 1.15 + px * dy;
        y = dy * t * 1.15 - px * dx * side;
      } else if (r3 < 0.58) {                   // shanks down to the rings
        var t2 = R();
        x = -dx * t2 * 0.42 + (R() - 0.5) * 0.05;
        y = -dy * t2 * 0.42 + (R() - 0.5) * 0.05;
      } else if (r3 < 0.92) {                   // finger rings
        var th = R() * Math.PI * 2;
        var rr = 0.17 + (R() - 0.5) * 0.035;
        var cx = -dx * 0.62, cy = -dy * 0.62 - 0.05;
        x = cx + Math.cos(th) * rr;
        y = cy + Math.sin(th) * rr * 1.1;
      } else {                                  // pivot screw
        var gr = 0.06 * Math.cbrt(R());
        var u = R() * Math.PI * 2, v = Math.acos(2 * R() - 1);
        x = gr * Math.sin(v) * Math.cos(u);
        y = gr * Math.cos(v);
        z = gr * Math.sin(v) * Math.sin(u);
      }
      a[i * 3] = x; a[i * 3 + 1] = y + 0.1; a[i * 3 + 2] = z;
    }
    return a;
  }

  function genRazor(n) {
    // open straight razor: blade up-right, scales (handle) down-left
    var a = new Float32Array(n * 3);
    var BA = 0.55, HA = -1.65;                  // blade / handle angles (open V)
    var bx = Math.cos(BA), by = Math.sin(BA);
    var hx = Math.cos(HA), hy = Math.sin(HA);
    for (var i = 0; i < n; i++) {
      var r3 = R(), x, y, z = (R() - 0.5) * 0.05, t, off;
      if (r3 < 0.34) {                          // blade body
        t = R(); off = (R() - 0.5) * 0.2;
        x = bx * t * 1.05 - by * off;
        y = by * t * 1.05 + bx * off;
      } else if (r3 < 0.52) {                   // cutting edge (crisp line)
        t = R(); off = -0.11 + (R() - 0.5) * 0.015;
        x = bx * t * 1.05 - by * off;
        y = by * t * 1.05 + bx * off;
      } else if (r3 < 0.62) {                   // blade spine
        t = R(); off = 0.1 + (R() - 0.5) * 0.015;
        x = bx * t * 1.05 - by * off;
        y = by * t * 1.05 + bx * off;
      } else if (r3 < 0.94) {                   // handle scales
        t = Math.pow(R(), 0.9); off = (R() - 0.5) * (0.13 - t * 0.05);
        x = hx * t * 1.1 - hy * off;
        y = hy * t * 1.1 + hx * off;
      } else {                                  // pivot pin
        var gr = 0.06 * Math.cbrt(R());
        var u = R() * Math.PI * 2, v = Math.acos(2 * R() - 1);
        x = gr * Math.sin(v) * Math.cos(u);
        y = gr * Math.cos(v);
        z = gr * Math.sin(v) * Math.sin(u);
      }
      a[i * 3] = x - 0.1; a[i * 3 + 1] = y + 0.25; a[i * 3 + 2] = z;
    }
    return a;
  }

  function genComb(n) {
    // classic barber comb: spine bar with a row of teeth
    var a = new Float32Array(n * 3), TEETH = 22;
    for (var i = 0; i < n; i++) {
      var r3 = R(), x, y, z = (R() - 0.5) * 0.04;
      if (r3 < 0.34) {                          // spine
        x = (R() * 2 - 1) * 1.05;
        y = 0.28 + R() * 0.16;
      } else if (r3 < 0.42) {                   // spine top edge
        x = (R() * 2 - 1) * 1.05;
        y = 0.44 + (R() - 0.5) * 0.015;
      } else if (r3 < 0.94) {                   // teeth
        var k = Math.floor(R() * TEETH);
        var tx = -1.0 + (k + 0.5) * (2.0 / TEETH);
        x = tx + (R() - 0.5) * 0.022;
        y = 0.28 - Math.pow(R(), 0.85) * 0.78;
      } else {                                  // rounded ends
        var side = R() < 0.5 ? -1 : 1;
        var th = R() * Math.PI * 2, rr = 0.08 * Math.sqrt(R());
        x = side * 1.05 + Math.cos(th) * rr;
        y = 0.36 + Math.sin(th) * rr;
      }
      a[i * 3] = x; a[i * 3 + 1] = y + 0.05; a[i * 3 + 2] = z;
    }
    return a;
  }

  function genPole(n) {
    // barber pole: helical stripes wound round a cylinder, orb caps
    var a = new Float32Array(n * 3), RAD = 0.42;
    for (var i = 0; i < n; i++) {
      var r3 = R(), x, y, z, th;
      if (r3 < 0.72) {                          // three helical stripes
        var stripe = Math.floor(R() * 3);
        var t = R();
        y = -0.95 + t * 1.9;
        th = stripe * (Math.PI * 2 / 3) + t * Math.PI * 4 + (R() - 0.5) * 0.55;
        var rr = RAD * (1 + (R() - 0.5) * 0.06);
        x = Math.cos(th) * rr; z = Math.sin(th) * rr;
      } else if (r3 < 0.88) {                   // cap orbs
        var top = R() < 0.5 ? 1 : -1;
        var gr = 0.16 * Math.cbrt(R());
        var u = R() * Math.PI * 2, v = Math.acos(2 * R() - 1);
        x = gr * Math.sin(v) * Math.cos(u);
        y = top * 1.12 + gr * Math.cos(v);
        z = gr * Math.sin(v) * Math.sin(u);
      } else {                                  // collar rings
        var topr = R() < 0.5 ? 1 : -1;
        th = R() * Math.PI * 2;
        var cr = RAD + 0.07;
        x = Math.cos(th) * cr; z = Math.sin(th) * cr;
        y = topr * 0.98 + (R() - 0.5) * 0.05;
      }
      a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z;
    }
    return a;
  }

  function genMustache(n) {
    // handlebar mustache: two mirrored bezier sweeps with curled tips
    var a = new Float32Array(n * 3);
    function bez(t, p0, p1, p2, p3) {
      var u = 1 - t;
      return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
    }
    for (var i = 0; i < n; i++) {
      var side = R() < 0.5 ? -1 : 1, x, y, z = (R() - 0.5) * 0.05;
      if (R() < 0.82) {                         // main sweep
        var t = R();
        x = bez(t, 0.02, 0.42, 0.95, 1.05);
        y = bez(t, 0.05, 0.34, 0.18, -0.28);
        var w = 0.15 * Math.sin(Math.min(t * 2.6, Math.PI)) + 0.015;
        y += (R() - 0.5) * 2 * w;
        x += (R() - 0.5) * 0.04;
      } else {                                  // curled tip spiral
        var s = R() * Math.PI * 1.5;
        var rr = 0.16 * (1 - s / (Math.PI * 1.7));
        x = 1.02 + Math.sin(s + 2.4) * rr;
        y = -0.22 + Math.cos(s + 2.4) * rr;
        x += (R() - 0.5) * 0.02; y += (R() - 0.5) * 0.02;
      }
      a[i * 3] = x * side; a[i * 3 + 1] = y + 0.1; a[i * 3 + 2] = z;
    }
    return a;
  }

  var SHAPES = {
    crown: genCrown, scissors: genScissors, razor: genRazor,
    comb: genComb, pole: genPole, mustache: genMustache
  };
  var cache = {};
  function shape(name) {
    if (!cache[name]) cache[name] = SHAPES[name](N);
    return cache[name];
  }

  /* ── buffers ─────────────────────────────────────────────── */
  var rand = new Float32Array(N * 4);
  for (var i = 0; i < N; i++) {
    rand[i * 4] = 8 + R() * 26;        // size
    rand[i * 4 + 1] = R();             // morph stagger
    rand[i * 4 + 2] = 0.5 + R() * 2;   // wobble speed
    rand[i * 4 + 3] = R() * R();       // brightness (skew dim)
  }
  var startBuf = gl.createBuffer(), endBuf = gl.createBuffer(), randBuf = gl.createBuffer();
  var startArr = new Float32Array(shape("crown"));
  var endArr = new Float32Array(shape("crown"));
  gl.bindBuffer(gl.ARRAY_BUFFER, randBuf);
  gl.bufferData(gl.ARRAY_BUFFER, rand, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, startBuf);
  gl.bufferData(gl.ARRAY_BUFFER, startArr, gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, endBuf);
  gl.bufferData(gl.ARRAY_BUFFER, endArr, gl.DYNAMIC_DRAW);

  // ambient dust shell (drawn with same program, morph = 0)
  var dust = new Float32Array(ND * 3), dustRand = new Float32Array(ND * 4);
  for (var d = 0; d < ND; d++) {
    var u = R() * Math.PI * 2, v = Math.acos(2 * R() - 1);
    var rr = 1.9 + R() * 2.2;
    dust[d * 3] = rr * Math.sin(v) * Math.cos(u);
    dust[d * 3 + 1] = rr * Math.cos(v) * 0.7;
    dust[d * 3 + 2] = rr * Math.sin(v) * Math.sin(u);
    dustRand[d * 4] = 4 + R() * 10;
    dustRand[d * 4 + 1] = R();
    dustRand[d * 4 + 2] = 0.3 + R();
    dustRand[d * 4 + 3] = R() * 0.5;
  }
  var dustBuf = gl.createBuffer(), dustRandBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, dustBuf);
  gl.bufferData(gl.ARRAY_BUFFER, dust, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, dustRandBuf);
  gl.bufferData(gl.ARRAY_BUFFER, dustRand, gl.STATIC_DRAW);

  gl.enableVertexAttribArray(loc.aStart);
  gl.enableVertexAttribArray(loc.aEnd);
  gl.enableVertexAttribArray(loc.aRand);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);       // additive glow

  /* ── themes (kept in sync with css body[data-theme]) ─────── */
  function hex(h) {
    return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  }
  var THEMES = {
    hero:    { bg: hex("#0b0d13"), a: hex("#e8c356"), b: hex("#34506e") },
    leather: { bg: hex("#170d0d"), a: hex("#d98a6a"), b: hex("#6e2424") },
    steel:   { bg: hex("#0e141c"), a: hex("#cfe0ee"), b: hex("#3a5a7a") },
    gold:    { bg: hex("#1c1508"), a: hex("#e8c356"), b: hex("#8a5a18") },
    pole:    { bg: hex("#101321"), a: hex("#f0ede4"), b: hex("#b03535") },
    deep:    { bg: hex("#0a0c10"), a: hex("#c9a227"), b: hex("#2a3a54") }
  };
  var curBg = THEMES.hero.bg.slice(), curA = THEMES.hero.a.slice(), curB = THEMES.hero.b.slice();
  var tgtBg = curBg.slice(), tgtA = curA.slice(), tgtB = curB.slice();

  /* ── morph state ─────────────────────────────────────────── */
  var morph = 1, morphActive = false, currentShape = "crown";

  function easedMorphPositions() {
    // snapshot the on-screen interpolated positions into startArr
    var e = morph; // matches shader base morph (stagger averages out visually)
    for (var i = 0; i < N * 3; i++) {
      startArr[i] = startArr[i] + (endArr[i] - startArr[i]) * e;
    }
  }

  function setShape(name) {
    if (!SHAPES[name] || name === currentShape) return;
    easedMorphPositions();
    currentShape = name;
    endArr.set(shape(name));
    gl.bindBuffer(gl.ARRAY_BUFFER, startBuf);
    gl.bufferData(gl.ARRAY_BUFFER, startArr, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, endBuf);
    gl.bufferData(gl.ARRAY_BUFFER, endArr, gl.DYNAMIC_DRAW);
    morph = 0; morphActive = true;
  }

  function setTheme(name) {
    var t = THEMES[name] || THEMES.hero;
    tgtBg = t.bg; tgtA = t.a; tgtB = t.b;
  }

  window.KGL = {
    setScene: function (shapeName, themeName) {
      setShape(shapeName);
      setTheme(themeName);
    }
  };

  /* ── pointer parallax ────────────────────────────────────── */
  var mx = 0, my = 0, tmx = 0, tmy = 0;
  window.addEventListener("pointermove", function (e) {
    tmx = (e.clientX / window.innerWidth - 0.5) * 2;
    tmy = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  /* ── resize ──────────────────────────────────────────────── */
  var W = 0, H = 0, DPR = 1, proj;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.floor(window.innerWidth * DPR);
    H = Math.floor(window.innerHeight * DPR);
    canvas.width = W; canvas.height = H;
    gl.viewport(0, 0, W, H);
    proj = persp(0.8, W / H, 0.1, 30);
  }
  window.addEventListener("resize", resize);
  resize();

  /* ── render loop ─────────────────────────────────────────── */
  function bindDraw(posA, posB, rBuf, count, morphVal, size, alpha) {
    gl.bindBuffer(gl.ARRAY_BUFFER, posA);
    gl.vertexAttribPointer(loc.aStart, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, posB);
    gl.vertexAttribPointer(loc.aEnd, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, rBuf);
    gl.vertexAttribPointer(loc.aRand, 4, gl.FLOAT, false, 0, 0);
    gl.uniform1f(loc.uMorph, morphVal);
    gl.uniform1f(loc.uSize, size);
    gl.uniform1f(loc.uAlpha, alpha);
    gl.drawArrays(gl.POINTS, 0, count);
  }

  var t0 = performance.now(), lost = false;
  canvas.addEventListener("webglcontextlost", function (e) {
    e.preventDefault(); lost = true; canvas.style.opacity = "0";
  });

  function frame(now) {
    requestAnimationFrame(frame);
    if (lost || document.hidden) return;
    var t = (now - t0) / 1000;
    var dt = 1 / 60;

    if (morphActive) {
      morph += dt / 1.6;
      if (morph >= 1) { morph = 1; morphActive = false; }
    }
    // smooth colour + pointer easing
    for (var c = 0; c < 3; c++) {
      curBg[c] += (tgtBg[c] - curBg[c]) * 0.03;
      curA[c] += (tgtA[c] - curA[c]) * 0.03;
      curB[c] += (tgtB[c] - curB[c]) * 0.03;
    }
    mx += (tmx - mx) * 0.05;
    my += (tmy - my) * 0.05;

    gl.clearColor(curBg[0], curBg[1], curBg[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // oscillate rather than spin so flat silhouettes never turn edge-on
    var sway = REDUCED ? 0.06 : 0.42;
    var ry = Math.sin(t * 0.22) * sway + mx * 0.5;
    var rx = 0.12 + my * 0.3 + Math.sin(t * 0.13) * 0.05;
    var mvp = mul(mul(proj, trans(0, -0.05, -3.3)), mul(rotX(rx), rotY(ry)));

    gl.uniformMatrix4fv(loc.uMVP, false, new Float32Array(mvp));
    gl.uniform1f(loc.uTime, t);
    gl.uniform1f(loc.uWobble, REDUCED ? 0 : 0.02 + (morphActive ? 0.05 : 0));
    gl.uniform3fv(loc.uColA, curA);
    gl.uniform3fv(loc.uColB, curB);

    var ease = morph < 0.5 ? 2 * morph * morph : 1 - Math.pow(-2 * morph + 2, 2) / 2;
    bindDraw(dustBuf, dustBuf, dustRandBuf, ND, 0, DPR * 0.9, 0.35);
    bindDraw(startBuf, endBuf, randBuf, N, ease, DPR, 1);
  }
  requestAnimationFrame(frame);
})();
