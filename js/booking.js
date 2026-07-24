/* ═══════════════════════════════════════════════════════════════
   KUNGLIGA BARBERSHOP — direct booking wizard
   service → date & time (from real opening hours) → details →
   confirmation with ICS download + prefilled SMS to the shop.

   All data goes through KStore (js/store.js). Times that are
   booked — or blocked by the admin in admin.html — simply do not
   appear in the public slot grid.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var app = document.getElementById("bookingApp");
  if (!app || !window.KStore) return;

  var SHOP_PHONE = "+46737287393";
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

  /* free slots for a date — booked/blocked spans are removed entirely */
  function slotsFor(dateStr, dur) {
    var d = new Date(dateStr + "T00:00:00");
    var hours = HOURS[d.getDay()];
    if (!hours) return Promise.resolve([]);
    return KStore.busy(dateStr).then(function (spans) {
      var open = hours[0] * 60, close = hours[1] * 60;
      var now = new Date();
      var minStart = open;
      if (isoDate(now) === dateStr) {
        minStart = Math.max(open, now.getHours() * 60 + now.getMinutes() + LEAD_MINUTES);
        minStart = Math.ceil(minStart / SLOT_STEP) * SLOT_STEP;
      }
      var out = [];
      for (var t = minStart; t + dur <= close; t += SLOT_STEP) {
        var clash = spans.some(function (s) { return t < s[1] && s[0] < t + dur; });
        if (!clash) out.push({ min: t, label: minToHM(t) });
      }
      return out;
    });
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
    slotGrid.innerHTML = "";
    slotNote.textContent = "Checking free times…";
    var today = new Date();
    var days = [];
    for (var i = 0; i < 14; i++) {
      var d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      days.push({ date: d, dateStr: isoDate(d), idx: i });
    }
    Promise.all(days.map(function (day) {
      return slotsFor(day.dateStr, state.service.dur).then(function (slots) {
        day.free = slots.length;
        return day;
      });
    })).then(function (all) {
      var firstPicked = false;
      all.forEach(function (day) {
        var open = !!HOURS[day.date.getDay()];
        var hasSlots = day.free > 0;
        var chip = document.createElement("button");
        chip.type = "button";
        chip.className = "day-chip" + (hasSlots ? "" : " is-closed");
        chip.disabled = !hasSlots;
        chip.setAttribute("role", "radio");
        chip.setAttribute("data-date", day.dateStr);
        chip.setAttribute("data-hover", "");
        chip.innerHTML =
          '<span class="day-chip__dow">' + (day.idx === 0 ? "Today" : DAY_NAMES[day.date.getDay()]) + "</span>" +
          '<span class="day-chip__num">' + day.date.getDate() + "</span>" +
          '<span class="day-chip__mon">' + (open ? (hasSlots ? MONTHS[day.date.getMonth()] : "Full") : "Closed") + "</span>";
        chip.addEventListener("click", function () { pickDay(chip); });
        dayStrip.appendChild(chip);
        if (hasSlots && !firstPicked) { firstPicked = true; pickDay(chip); }
      });
      if (!firstPicked) {
        slotNote.textContent = "No free times in the next two weeks — call us and we'll fit you in.";
      }
    });
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
    slotsFor(state.date, state.service.dur).then(function (slots) {
      slots.forEach(function (s) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "slot";
        b.textContent = s.label;
        b.setAttribute("role", "radio");
        b.setAttribute("data-hover", "");
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
      slotNote.textContent = slots.length
        ? slots.length + " free times · " + state.service.name + " · " + state.service.dur + " min"
        : "Fully booked this day — try another.";
    });
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

    // re-check the slot right before writing, in case it was just taken
    slotsFor(state.date, state.service.dur).then(function (slots) {
      var stillFree = slots.some(function (s) { return s.label === state.time; });
      if (!stillFree) {
        err.textContent = "That time was just taken — please pick another.";
        err.hidden = false;
        goStep(2);
        renderSlots();
        return;
      }

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
        createdAt: new Date().toISOString(),
        status: "new"
      };
      KStore.addBooking(booking).then(function () {
        showConfirmation(booking);
        goStep(4);
      });
    });
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
