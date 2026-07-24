/* ═══════════════════════════════════════════════════════════════
   KUNGLIGA — shared data layer (bookings, availability, admin)

   All pages talk to KStore, never to storage directly. The driver
   is pluggable:
     · default: localStorage (single-browser demo)
     · window.KUNGLIGA_STORE_DRIVER = { get(key), set(key, value) }
       (both async) — lets a host page plug in shared/remote storage
       without touching any page code
     · window.KUNGLIGA_BOOKING_ENDPOINT — optional URL; new bookings
       are additionally POSTed there as JSON.

   Data:
     bookings[] { ref, service, date "YYYY-MM-DD", time "HH:MM",
                  duration (min), name, phone, email, notes,
                  createdAt, status "new"|"confirmed"|"cancelled" }
     blocks[]   { id, date, from "HH:MM", to "HH:MM", reason }
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var KEYS = { bookings: "kungliga-bookings", blocks: "kungliga-blocks", admin: "kungliga-admin" };

  var localDriver = {
    get: function (k) {
      try { return Promise.resolve(JSON.parse(localStorage.getItem(k))); }
      catch (e) { return Promise.resolve(null); }
    },
    set: function (k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
      return Promise.resolve();
    }
  };

  function driver() { return window.KUNGLIGA_STORE_DRIVER || localDriver; }

  function hm2min(hm) { return parseInt(hm.slice(0, 2), 10) * 60 + parseInt(hm.slice(3, 5), 10); }

  /* password hashing — WebCrypto SHA-256, with a tiny fallback for
     non-secure contexts (file://) so the page never hard-fails */
  function sha256(str) {
    if (window.crypto && crypto.subtle && crypto.subtle.digest) {
      var data = new TextEncoder().encode("kungliga§" + str);
      return crypto.subtle.digest("SHA-256", data).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) {
          return (b < 16 ? "0" : "") + b.toString(16);
        }).join("");
      });
    }
    var h = 5381, s = "kungliga§" + str;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return Promise.resolve("fb-" + h.toString(16));
  }

  var KStore = {

    /* ── bookings ────────────────────────────────────────────── */
    getBookings: function () {
      return driver().get(KEYS.bookings).then(function (a) { return a || []; });
    },
    addBooking: function (b) {
      return KStore.getBookings().then(function (all) {
        all.push(b);
        return driver().set(KEYS.bookings, all);
      }).then(function () {
        if (window.KUNGLIGA_BOOKING_ENDPOINT && window.fetch) {
          return fetch(window.KUNGLIGA_BOOKING_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(b)
          }).catch(function () {});
        }
      });
    },
    updateBooking: function (ref, patch) {
      return KStore.getBookings().then(function (all) {
        all.forEach(function (b) {
          if (b.ref === ref) for (var k in patch) b[k] = patch[k];
        });
        return driver().set(KEYS.bookings, all);
      });
    },
    deleteBooking: function (ref) {
      return KStore.getBookings().then(function (all) {
        return driver().set(KEYS.bookings, all.filter(function (b) { return b.ref !== ref; }));
      });
    },

    /* ── availability blocks ─────────────────────────────────── */
    getBlocks: function () {
      return driver().get(KEYS.blocks).then(function (a) { return a || []; });
    },
    addBlock: function (block) {
      block.id = "BL-" + Date.now().toString(36).toUpperCase();
      return KStore.getBlocks().then(function (all) {
        all.push(block);
        return driver().set(KEYS.blocks, all);
      }).then(function () { return block; });
    },
    removeBlock: function (id) {
      return KStore.getBlocks().then(function (all) {
        return driver().set(KEYS.blocks, all.filter(function (b) { return b.id !== id; }));
      });
    },

    /* ── busy check used by the public slot grid ─────────────── */
    busy: function (dateStr) {
      return Promise.all([KStore.getBookings(), KStore.getBlocks()]).then(function (r) {
        var spans = [];
        r[0].forEach(function (b) {
          if (b.date === dateStr && b.status !== "cancelled") {
            spans.push([hm2min(b.time), hm2min(b.time) + b.duration]);
          }
        });
        r[1].forEach(function (bl) {
          if (bl.date === dateStr) spans.push([hm2min(bl.from), hm2min(bl.to)]);
        });
        return spans; // array of [startMin, endMin]
      });
    },

    /* ── admin auth (client-side gate — see README) ──────────── */
    DEFAULT_PASSWORD: "kungliga2013",
    login: function (password) {
      return Promise.all([driver().get(KEYS.admin), sha256(password)]).then(function (r) {
        var stored = r[0] && r[0].hash;
        if (stored) return stored === r[1];
        return sha256(KStore.DEFAULT_PASSWORD).then(function (defHash) {
          return defHash === r[1];
        });
      }).then(function (ok) {
        if (ok) { try { sessionStorage.setItem("kungliga-admin-session", "1"); } catch (e) {} }
        return ok;
      });
    },
    setPassword: function (password) {
      return sha256(password).then(function (h) {
        return driver().set(KEYS.admin, { hash: h });
      });
    },
    isLoggedIn: function () {
      try { return sessionStorage.getItem("kungliga-admin-session") === "1"; }
      catch (e) { return false; }
    },
    logout: function () {
      try { sessionStorage.removeItem("kungliga-admin-session"); } catch (e) {}
    }
  };

  window.KStore = KStore;
})();
