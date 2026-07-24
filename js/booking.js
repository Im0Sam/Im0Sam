/* ═══════════════════════════════════════════════════════════════
   KUNGLIGA BARBERSHOP — direct booking wizard
   service → date & time (from real opening hours) → details →
   confirmation with ICS download + prefilled SMS to the shop.

   Bookings persist in localStorage. To wire a real backend, set
   window.KUNGLIGA_BOOKING_ENDPOINT to a URL accepting POST JSON
   { ref, service, date, time, duration, name, phone, email, notes }.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var app = document.getElementById("bookingApp");
  if (!app) return;

  var SHOP_PHONE = "+46737287393";
  var STORE_KEY = "kungliga-bookings";
  var LEAD_MINUTES = 60;              // earliest bookable slot from "now"
  var SLOT_STEP = 30;                 // grid granularity in minutes

  var SERVICES = [
    { id: "klippning",   name: "Klippning",       sub: "Cut & skin fade",          dur: 60 },
    { id: "rakning",     name: "Rakning & skägg", sub: "Beard trim / hot shave",   dur: 30 },
    { id: "kombination", name: "Kombination",     sub: "The works — cut & beard",  dur: 90 }
  ];
  // opening hours by JS weekday (0 = Sunday): [openHour, closeHour]
  var HOURS = { 1: [10, 19], 2: [10, 19], 3: [10, 19], 4: [10, 19], 5: [10, 19], 6: [11, 16], 0: null };
  var DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  var state = { service: null, date: null, time: null, ref: null };

  /* ── helpers ─────────────────────────────────────────────── */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function isoDate(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function niceDate(d) { return DAY_NAMES[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()]; }
  function minToHM(m) { return pad(Math.floor(m / 60)) + ":" + pad(m % 60); }

  function loadBookings() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveBooking(b) {
    var all = loadBookings();
    all.push(b);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(all)); } catch (e) {}
  }
  function conflicts(dateStr, startMin, dur) {
    return loadBookings().some(function (b) {
      if (b.date !== dateStr) return false;
      var bs = parseInt(b.time.slice(0, 2), 10) * 60 + parseInt(b.time.slice(3), 10);
      return startMin < bs + b.duration && bs < startMin + dur;
    });
  }

  function slotsFor(dateStr, dur) {
    var d = new Date(dateStr + "T00:00:00");
    var hours = HOURS[d.getDay()];
    if (!hours) return [];
    var open = hours[0] * 60, close = hours[1] * 60;
    var now = new Date();
    var minStart = open;
    if (isoDate(now) === dateStr) {
      minStart = Math.max(open, now.getHours() * 60 + now.getMinutes() + LEAD_MINUTES);
      minStart = Math.ceil(minStart / SLOT_STEP) * SLOT_STEP;
    }
    var out = [];
    for (var t = minStart; t + dur <= close; t += SLOT_STEP) {
      out.push({ min: t, label: minToHM(t), taken: conflicts(dateStr, t, dur) });
    }
    return out;
  }

  /* ── step navigation ─────────────────────────────────────── */
  var STEP_SHAPES = { 1: ["scissors", "deep"], 2: ["comb", "gold"], 3: ["razor", "steel"], 4: ["crown", "hero"] };
  function goStep(n) {
    for (var i = 1; i <= 4; i++) {
      document.getElementById("panel" + i).classList.toggle("is-active", i === n);
    }
    Array.prototype.forEach.call(document.querySelectorAll(".bk-step"), function (el) {
      var s = parseInt(el.getAttribute("data-step"), 10);
      el.classList.toggle("is-active", s === n);
      el.classList.toggle("is-done", s < n);
    });
    if (window.KGL && STEP_SHAPES[n]) {
      window.KGL.setScene(STEP_SHAPES[n][0], STEP_SHAPES[n][1]);
      document.body.setAttribute("data-theme", STEP_SHAPES[n][1]);
    }
    var title = document.querySelector(".booking-main");
    if (title && title.scrollIntoView && n > 1) title.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  Array.prototype.forEach.call(document.querySelectorAll(".bk-back"), function (b) {
    b.addEventListener("click", function () { goStep(parseInt(b.getAttribute("data-to"), 10)); });
  });

  /* ── step 1 · services ───────────────────────────────────── */
  var svcGrid = document.getElementById("svcGrid");
  SERVICES.forEach(function (s) {
    var card = document.createElement("button");
    card.type = "button";
    card.className = "svc-card";
    card.setAttribute("role", "radio");
    card.setAttribute("aria-checked", "false");
    card.setAttribute("data-hover", "");
    card.innerHTML =
      '<span class="svc-card__dur">' + s.dur + " min</span>" +
      "<h3>" + s.name + "</h3>" +
      "<p>" + s.sub + "</p>";
    card.addEventListener("click", function () {
      state.service = s;
      state.time = null;
      Array.prototype.forEach.call(svcGrid.children, function (c) {
        c.classList.remove("is-selected");
        c.setAttribute("aria-checked", "false");
      });
      card.classList.add("is-selected");
      card.setAttribute("aria-checked", "true");
      document.getElementById("toStep2").disabled = false;
    });
    svcGrid.appendChild(card);
  });
  document.getElementById("toStep2").addEventListener("click", function () {
    renderDays();
    goStep(2);
  });

  /* ── step 2 · days & slots ───────────────────────────────── */
  var dayStrip = document.getElementById("dayStrip");
  var slotGrid = document.getElementById("slotGrid");
  var slotNote = document.getElementById("slotNote");

  function renderDays() {
    dayStrip.innerHTML = "";
    var today = new Date();
    var firstPicked = false;
    for (var i = 0; i < 14; i++) {
      var d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      var dateStr = isoDate(d);
      var open = !!HOURS[d.getDay()];
      var hasSlots = open && slotsFor(dateStr, state.service.dur).some(function (s) { return !s.taken; });
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "day-chip" + (hasSlots ? "" : " is-closed");
      chip.disabled = !hasSlots;
      chip.setAttribute("role", "radio");
      chip.setAttribute("data-date", dateStr);
      chip.setAttribute("data-hover", "");
      chip.innerHTML =
        '<span class="day-chip__dow">' + (i === 0 ? "Today" : DAY_NAMES[d.getDay()]) + "</span>" +
        '<span class="day-chip__num">' + d.getDate() + "</span>" +
        '<span class="day-chip__mon">' + (open ? MONTHS[d.getMonth()] : "Closed") + "</span>";
      chip.addEventListener("click", function () { pickDay(this); });
      dayStrip.appendChild(chip);
      if (hasSlots && !firstPicked) { firstPicked = true; pickDay(chip); }
    }
    if (!firstPicked) {
      slotGrid.innerHTML = "";
      slotNote.textContent = "No free times in the next two weeks — call us and we'll fit you in.";
    }
  }

  function pickDay(chip) {
    Array.prototype.forEach.call(dayStrip.children, function (c) {
      c.classList.remove("is-selected");
      c.setAttribute("aria-checked", "false");
    });
    chip.classList.add("is-selected");
    chip.setAttribute("aria-checked", "true");
    state.date = chip.getAttribute("data-date");
    state.time = null;
    document.getElementById("toStep3").disabled = true;
    renderSlots();
  }

  function renderSlots() {
    slotGrid.innerHTML = "";
    var slots = slotsFor(state.date, state.service.dur);
    var free = 0;
    slots.forEach(function (s) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "slot" + (s.taken ? " is-taken" : "");
      b.disabled = s.taken;
      b.textContent = s.label;
      b.setAttribute("role", "radio");
      b.setAttribute("data-hover", "");
      if (!s.taken) free++;
      b.addEventListener("click", function () {
        Array.prototype.forEach.call(slotGrid.children, function (c) {
          c.classList.remove("is-selected");
          c.setAttribute("aria-checked", "false");
        });
        b.classList.add("is-selected");
        b.setAttribute("aria-checked", "true");
        state.time = s.label;
        document.getElementById("toStep3").disabled = false;
      });
      slotGrid.appendChild(b);
    });
    slotNote.textContent = free
      ? free + " free times · " + state.service.name + " · " + state.service.dur + " min"
      : "Fully booked this day — try another.";
  }

  document.getElementById("toStep3").addEventListener("click", function () {
    document.getElementById("sumService").textContent = state.service.name;
    document.getElementById("sumDate").textContent = niceDate(new Date(state.date + "T00:00:00"));
    document.getElementById("sumTime").textContent = state.time;
    document.getElementById("sumDur").textContent = state.service.dur + " min";
    goStep(3);
  });

  /* ── step 3 · confirm ────────────────────────────────────── */
  document.getElementById("confirmBtn").addEventListener("click", function () {
    var name = document.getElementById("fName").value.trim();
    var phone = document.getElementById("fPhone").value.trim();
    var err = document.getElementById("formError");
    if (!name || phone.replace(/\D/g, "").length < 7) {
      err.hidden = false;
      return;
    }
    err.hidden = true;

    state.ref = "KB-" + Date.now().toString(36).slice(-5).toUpperCase();
    var booking = {
      ref: state.ref,
      service: state.service.name,
      date: state.date,
      time: state.time,
      duration: state.service.dur,
      name: name,
      phone: phone,
      email: document.getElementById("fEmail").value.trim(),
      notes: document.getElementById("fNotes").value.trim(),
      createdAt: new Date().toISOString()
    };
    saveBooking(booking);

    if (window.KUNGLIGA_BOOKING_ENDPOINT && window.fetch) {
      fetch(window.KUNGLIGA_BOOKING_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(booking)
      }).then(function () {
        document.getElementById("sendState").textContent =
          "Sent to the shop — you'll get a confirmation on " + phone + ".";
      }).catch(function () { /* SMS handoff remains the fallback */ });
    }

    showConfirmation(booking);
    goStep(4);
  });

  /* ── step 4 · confirmation, ICS, SMS, copy ───────────────── */
  var lastBooking = null;
  function summaryText(b) {
    return "Booking " + b.ref + " — Kungliga Barbershop\n" +
      b.service + " (" + b.duration + " min)\n" +
      niceDate(new Date(b.date + "T00:00:00")) + " at " + b.time + "\n" +
      b.name + ", " + b.phone +
      (b.notes ? "\nNotes: " + b.notes : "");
  }
  function showConfirmation(b) {
    lastBooking = b;
    document.getElementById("confRef").textContent = b.ref;
    document.getElementById("confText").textContent =
      b.service + " · " + niceDate(new Date(b.date + "T00:00:00")) + " at " + b.time +
      " · " + b.name;
  }

  document.getElementById("smsBtn").addEventListener("click", function () {
    if (!lastBooking) return;
    var body = encodeURIComponent(summaryText(lastBooking));
    window.location.href = "sms:" + SHOP_PHONE + "?body=" + body;
  });

  document.getElementById("icsBtn").addEventListener("click", function () {
    if (!lastBooking) return;
    var b = lastBooking;
    var d = b.date.replace(/-/g, "");
    var t = b.time.replace(":", "") + "00";
    var endMin = parseInt(b.time.slice(0, 2), 10) * 60 + parseInt(b.time.slice(3), 10) + b.duration;
    var end = minToHM(endMin).replace(":", "") + "00";
    var ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kungliga Barbershop//Booking//EN",
      "BEGIN:VEVENT",
      "UID:" + b.ref + "@kungliga-barbershop",
      "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z",
      "DTSTART:" + d + "T" + t,
      "DTEND:" + d + "T" + end,
      "SUMMARY:" + b.service + " — Kungliga Barbershop (" + b.ref + ")",
      "LOCATION:Kungsängsesplanaden 10D\\, 753 18 Uppsala",
      "DESCRIPTION:" + summaryText(b).replace(/\n/g, "\\n"),
      "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
    var a = document.createElement("a");
    a.href = "data:text/calendar;charset=utf-8," + encodeURIComponent(ics);
    a.download = "kungliga-" + b.ref + ".ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  document.getElementById("copyBtn").addEventListener("click", function () {
    if (!lastBooking) return;
    var txt = summaryText(lastBooking);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(txt).then(function () {
        document.getElementById("copyBtn").textContent = "Copied ✓";
      });
    }
  });

  /* ── standalone page extras (skipped when embedded) ──────── */
  if (app.getAttribute("data-standalone") === "1") {
    if (window.KGL) window.KGL.setScene("scissors", "deep");
    var dot = document.getElementById("cursorDot");
    var ring = document.getElementById("cursorRing");
    if (dot && ring) {
      var cx = -100, cy = -100, rx = -100, ry = -100;
      window.addEventListener("pointermove", function (e) {
        cx = e.clientX; cy = e.clientY;
        dot.style.left = cx + "px";
        dot.style.top = cy + "px";
      }, { passive: true });
      (function loop() {
        rx += (cx - rx) * 0.16; ry += (cy - ry) * 0.16;
        ring.style.left = rx + "px"; ring.style.top = ry + "px";
        requestAnimationFrame(loop);
      })();
      document.addEventListener("pointerover", function (e) {
        var el = e.target && e.target.closest && e.target.closest("a, button, [data-hover]");
        ring.classList.toggle("is-hover", !!el);
      });
    }
  }
})();
