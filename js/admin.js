/* ═══════════════════════════════════════════════════════════════
   KUNGLIGA BARBERSHOP — admin dashboard
   login gate → private list of booked times (confirm / cancel /
   delete) + availability blocks + password change.
   All data flows through KStore (js/store.js).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  if (!window.KStore) return;

  var DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function isoDate(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function niceDate(str) {
    var d = new Date(str + "T00:00:00");
    return DAY_NAMES[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()];
  }
  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var loginView = document.getElementById("loginView");
  var dashView = document.getElementById("dashView");
  var logoutBtn = document.getElementById("logoutBtn");
  var filter = "upcoming";

  function show(dash) {
    loginView.hidden = dash;
    dashView.hidden = !dash;
    logoutBtn.hidden = !dash;
    if (window.KGL) window.KGL.setScene(dash ? "pole" : "crown", dash ? "pole" : "deep");
    document.body.setAttribute("data-theme", dash ? "pole" : "deep");
    if (dash) refresh();
  }

  /* ── login / logout ──────────────────────────────────────── */
  document.getElementById("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var pass = document.getElementById("loginPass").value;
    KStore.login(pass).then(function (ok) {
      document.getElementById("loginError").hidden = ok;
      if (ok) show(true);
    });
  });
  logoutBtn.addEventListener("click", function () {
    KStore.logout();
    document.getElementById("loginPass").value = "";
    show(false);
  });

  /* ── bookings list ───────────────────────────────────────── */
  Array.prototype.forEach.call(document.querySelectorAll(".adm-chip"), function (chip) {
    chip.addEventListener("click", function () {
      filter = chip.getAttribute("data-filter");
      Array.prototype.forEach.call(document.querySelectorAll(".adm-chip"), function (c) {
        c.classList.toggle("is-selected", c === chip);
      });
      renderBookings();
    });
  });

  function renderBookings() {
    KStore.getBookings().then(function (all) {
      var todayStr = isoDate(new Date());
      all.sort(function (a, b) {
        return (a.date + a.time).localeCompare(b.date + b.time);
      });
      var rows = all.filter(function (b) {
        if (filter === "cancelled") return b.status === "cancelled";
        if (filter === "upcoming") return b.status !== "cancelled" && b.date >= todayStr;
        return true;
      });

      var list = document.getElementById("bookingList");
      list.innerHTML = "";
      document.getElementById("bookingEmpty").hidden = rows.length > 0;

      rows.forEach(function (b) {
        var row = document.createElement("article");
        row.className = "adm-row" + (b.status === "cancelled" ? " is-cancelled" : "");
        row.innerHTML =
          '<div class="adm-row__when">' +
            '<span class="adm-row__date">' + niceDate(b.date) + "</span>" +
            '<span class="adm-row__time">' + esc(b.time) + "</span>" +
          "</div>" +
          '<div class="adm-row__who">' +
            "<strong>" + esc(b.name) + "</strong>" +
            '<span>' + esc(b.service) + " · " + b.duration + " min</span>" +
            '<a href="tel:' + esc(b.phone) + '" data-hover>' + esc(b.phone) + "</a>" +
            (b.email ? '<span class="adm-row__mail">' + esc(b.email) + "</span>" : "") +
            (b.notes ? '<span class="adm-row__notes">“' + esc(b.notes) + "”</span>" : "") +
          "</div>" +
          '<div class="adm-row__meta">' +
            '<span class="adm-status adm-status--' + esc(b.status) + '">' + esc(b.status) + "</span>" +
            '<span class="adm-row__ref">' + esc(b.ref) + "</span>" +
          "</div>" +
          '<div class="adm-row__actions"></div>';

        var actions = row.querySelector(".adm-row__actions");
        function act(label, cls, fn) {
          var btn = document.createElement("button");
          btn.className = "adm-mini " + cls;
          btn.textContent = label;
          btn.setAttribute("data-hover", "");
          btn.addEventListener("click", fn);
          actions.appendChild(btn);
        }
        if (b.status === "new") {
          act("Confirm", "adm-mini--ok", function () {
            KStore.updateBooking(b.ref, { status: "confirmed" }).then(refresh);
          });
        }
        if (b.status !== "cancelled") {
          act("Cancel", "adm-mini--warn", function () {
            KStore.updateBooking(b.ref, { status: "cancelled" }).then(refresh);
          });
        } else {
          act("Restore", "adm-mini--ok", function () {
            KStore.updateBooking(b.ref, { status: "new" }).then(refresh);
          });
          act("Delete", "adm-mini--danger", function () {
            KStore.deleteBooking(b.ref).then(refresh);
          });
        }
        list.appendChild(row);
      });
    });
  }

  /* ── availability blocks ─────────────────────────────────── */
  function renderBlocks() {
    KStore.getBlocks().then(function (blocks) {
      blocks.sort(function (a, b) { return (a.date + a.from).localeCompare(b.date + b.from); });
      var list = document.getElementById("blockList");
      list.innerHTML = "";
      blocks.forEach(function (bl) {
        var row = document.createElement("article");
        row.className = "adm-row adm-row--block";
        row.innerHTML =
          '<div class="adm-row__when">' +
            '<span class="adm-row__date">' + niceDate(bl.date) + "</span>" +
            '<span class="adm-row__time">' + esc(bl.from) + " – " + esc(bl.to) + "</span>" +
          "</div>" +
          '<div class="adm-row__who"><span>' + esc(bl.reason || "Blocked") + "</span></div>" +
          '<div class="adm-row__actions"></div>';
        var btn = document.createElement("button");
        btn.className = "adm-mini adm-mini--danger";
        btn.textContent = "Unblock";
        btn.setAttribute("data-hover", "");
        btn.addEventListener("click", function () {
          KStore.removeBlock(bl.id).then(refresh);
        });
        row.querySelector(".adm-row__actions").appendChild(btn);
        list.appendChild(row);
      });
    });
  }

  function addBlock(from, to) {
    var date = document.getElementById("blkDate").value;
    var err = document.getElementById("blockError");
    if (!date) {
      err.textContent = "Pick a date to block.";
      err.hidden = false;
      return;
    }
    if (from >= to) {
      err.textContent = "“From” must be before “to”.";
      err.hidden = false;
      return;
    }
    err.hidden = true;
    KStore.addBlock({
      date: date,
      from: from,
      to: to,
      reason: document.getElementById("blkReason").value.trim()
    }).then(function () {
      document.getElementById("blkReason").value = "";
      refresh();
    });
  }
  document.getElementById("blockForm").addEventListener("submit", function (e) {
    e.preventDefault();
    addBlock(document.getElementById("blkFrom").value || "00:00",
             document.getElementById("blkTo").value || "23:59");
  });
  document.getElementById("blockDayBtn").addEventListener("click", function () {
    addBlock("00:00", "23:59");
  });

  /* ── password change ─────────────────────────────────────── */
  document.getElementById("passForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var p = document.getElementById("newPass").value;
    var state = document.getElementById("passState");
    if (p.length < 8) {
      state.textContent = "Password needs at least 8 characters.";
      return;
    }
    KStore.setPassword(p).then(function () {
      document.getElementById("newPass").value = "";
      state.textContent = "Password changed ✓ — use it next time you log in.";
    });
  });

  /* ── stats + refresh ─────────────────────────────────────── */
  function refresh() {
    renderBookings();
    renderBlocks();
    Promise.all([KStore.getBookings(), KStore.getBlocks()]).then(function (r) {
      var todayStr = isoDate(new Date());
      var active = r[0].filter(function (b) { return b.status !== "cancelled"; });
      document.getElementById("statToday").textContent =
        active.filter(function (b) { return b.date === todayStr; }).length;
      document.getElementById("statUpcoming").textContent =
        active.filter(function (b) { return b.date >= todayStr; }).length;
      document.getElementById("statBlocks").textContent = r[1].length;
    });
  }

  /* ── cursor (standalone page) ────────────────────────────── */
  var dot = document.getElementById("cursorDot");
  var ring = document.getElementById("cursorRing");
  if (!dot) {
    dot = document.createElement("div"); dot.className = "cursor"; dot.id = "cursorDot";
    ring = document.createElement("div"); ring.className = "cursor-ring"; ring.id = "cursorRing";
    document.body.appendChild(dot); document.body.appendChild(ring);
  }
  var cx = -100, cy = -100, rx = -100, ry = -100;
  window.addEventListener("pointermove", function (e) {
    cx = e.clientX; cy = e.clientY;
    dot.style.left = cx + "px"; dot.style.top = cy + "px";
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

  /* ── boot ────────────────────────────────────────────────── */
  var min = new Date();
  document.getElementById("blkDate").min = isoDate(min);
  show(KStore.isLoggedIn());
})();
