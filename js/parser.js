// Turns a Tesco purchase-history export into flat baskets and item lines.
// It searches the file for basket-like objects (a date plus a list of items) rather than relying on one exact
// layout, so slightly different export formats still work. It also reads and writes a compact copy of the
// parsed data, which is what the site keeps in browser storage.
(function (App) {
  'use strict';

  var COMPACT_FORMAT = 'tesco-summary-compact';
  // Items priced below this (including zero and negative amounts) are treated as unrealistic and set aside.
  var MIN_PRICE = 0.02;

  var DATE_KEYS = ['timestamp', 'timeStamp', 'purchaseDate', 'transactionDate', 'orderDate', 'dateTime', 'datetime', 'date'];
  var ITEM_KEYS = ['items', 'products', 'product', 'lines', 'basketItems', 'orderLines'];
  var NAME_KEYS = ['name', 'productName', 'description', 'title', 'itemName'];
  var QTY_KEYS = ['quantity', 'qty', 'count', 'units'];
  var PRICE_KEYS = ['price', 'unitPrice', 'itemPrice', 'pricePerUnit'];
  var LINE_TOTAL_KEYS = ['lineTotal', 'totalPrice', 'total', 'amount', 'value'];
  var PAID_KEYS = ['basketValueNet', 'basketValueGross', 'totalPaid', 'totalPrice', 'total', 'amount', 'value'];
  var SAVINGS_KEYS = ['overallBasketSavings', 'totalSavings', 'savings'];

  // Some exports double-encode UTF-8 ("NestlÃ©"); undo that when it applies, otherwise leave the text alone.
  function fixText(s) {
    s = String(s == null ? '' : s);
    if (/[ÂÃ]/.test(s)) {
      try { s = decodeURIComponent(escape(s)); } catch (e) { /* not double-encoded */ }
    }
    return s.replace(/[\s ]+/g, ' ').trim();
  }

  function num(v) {
    if (typeof v === 'string') v = v.replace(/[£,\s]/g, '');
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }

  function pick(obj, keys) {
    for (var i = 0; i < keys.length; i++) {
      if (obj[keys[i]] != null && obj[keys[i]] !== '') return obj[keys[i]];
    }
    return null;
  }

  // Accepts "2026-09-25 14:49:46.775", ISO strings, UK "25/09/2026 14:49" and epoch seconds or milliseconds.
  function parseDate(ts) {
    if (ts == null || ts === '') return null;
    if (typeof ts === 'number') return new Date(ts < 1e12 ? ts * 1000 : ts);
    var s = String(ts).trim();
    var uk = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (uk) return new Date(+uk[3], +uk[2] - 1, +uk[1], +(uk[4] || 0), +(uk[5] || 0), +(uk[6] || 0));
    var d = new Date(s.replace(' ', 'T'));
    return isNaN(d.getTime()) ? null : d;
  }

  function isBasket(o) {
    return o && typeof o === 'object' && !Array.isArray(o) &&
      pick(o, DATE_KEYS) != null && Array.isArray(pick(o, ITEM_KEYS));
  }

  // Walks the JSON looking for basket-like objects, without descending into baskets it has found.
  function findBaskets(node, out, depth) {
    if (!node || typeof node !== 'object' || depth > 8) return out;
    if (isBasket(node)) { out.push(node); return out; }
    var children = Array.isArray(node) ? node : Object.keys(node).map(function (k) { return node[k]; });
    children.forEach(function (c) { findBaskets(c, out, depth + 1); });
    return out;
  }

  function readItem(it) {
    if (typeof it !== 'object' || !it) return null;
    var nameVal = pick(it, NAME_KEYS);
    if (nameVal == null && typeof it.product === 'string') nameVal = it.product;
    var name = fixText(nameVal);
    if (!name) return null;
    var qty = num(pick(it, QTY_KEYS)) || 1;
    var price = pick(it, PRICE_KEYS);
    var unit = price != null ? num(price) : num(pick(it, LINE_TOTAL_KEYS)) / qty;
    return { name: name, quantity: qty, unitPrice: unit, weightKg: num(it.weight) };
  }

  function fromRaw(data) {
    var found = findBaskets(data, [], 0);
    var baskets = [];
    var lines = [];
    var ignored = [];

    found.forEach(function (p) {
      var date = parseDate(pick(p, DATE_KEYS));
      if (!date) return;
      var items = pick(p, ITEM_KEYS).map(readItem).filter(Boolean).filter(function (it) {
        if (it.unitPrice >= MIN_PRICE) return true;
        ignored.push({ date: date.getTime(), name: it.name, price: it.unitPrice });
        return false;
      });
      if (!items.length) return;

      var itemsTotal = items.reduce(function (s, it) { return s + it.unitPrice * it.quantity; }, 0);
      var paidVal = pick(p, PAID_KEYS);
      var basket = {
        id: baskets.length,
        date: date,
        channel: String(p.type || p.channel || 'UNKNOWN'),
        paid: paidVal != null && typeof paidVal !== 'object' ? num(paidVal) : itemsTotal,
        savings: num(pick(p, SAVINGS_KEYS)),
        lineCount: items.length
      };
      items.forEach(function (it) {
        lines.push({
          basketId: basket.id, date: date, name: it.name, quantity: it.quantity,
          unitPrice: it.unitPrice, total: it.unitPrice * it.quantity, weightKg: it.weightKg
        });
      });
      baskets.push(basket);
    });
    return { baskets: baskets, lines: lines, ignored: ignored };
  }

  // ---------- Compact copy for browser storage ----------

  function pack(parsed) {
    var index = {};
    parsed.baskets.forEach(function (b, i) { index[b.id] = i; });
    return {
      format: COMPACT_FORMAT,
      v: 1,
      baskets: parsed.baskets.map(function (b) { return [b.date.getTime(), b.paid, b.savings, b.channel]; }),
      lines: parsed.lines.map(function (l) {
        return [index[l.basketId], l.name, l.quantity, Math.round(l.unitPrice * 1e4) / 1e4, l.weightKg];
      }),
      ignored: (parsed.ignored || []).map(function (x) { return [x.date, x.name, x.price]; })
    };
  }

  function unpack(c) {
    var baskets = c.baskets.map(function (b, i) {
      return { id: i, date: new Date(b[0]), paid: b[1], savings: b[2], channel: b[3], lineCount: 0 };
    });
    var lines = c.lines.map(function (l) {
      var b = baskets[l[0]];
      b.lineCount++;
      return { basketId: b.id, date: b.date, name: l[1], quantity: l[2], unitPrice: l[3], total: l[2] * l[3], weightKg: l[4] };
    }).filter(function (l) { return l.unitPrice >= MIN_PRICE; });
    var ignored = (c.ignored || []).map(function (x) { return { date: x[0], name: x[1], price: x[2] }; });
    return { baskets: baskets, lines: lines, ignored: ignored };
  }

  function parse(raw) {
    var data;
    if (typeof raw === 'string') {
      try { data = JSON.parse(raw.replace(/^﻿/, '')); } catch (e) { throw new Error('This file isn’t valid JSON. Choose the .json file from your Tesco data download.'); }
    } else {
      data = raw;
    }
    if (!data || typeof data !== 'object') throw new Error('This file isn’t valid JSON.');

    var parsed = data.format === COMPACT_FORMAT ? unpack(data) : fromRaw(data);
    if (!parsed.baskets.length) {
      throw new Error('No purchases were found in this file. It should be the transactions JSON from your Tesco data download, with a list of shops that each have a date and the items bought.');
    }
    parsed.baskets.sort(function (a, b) { return a.date - b.date; });
    return parsed;
  }

  App.Parser = { parse: parse, pack: pack, fixText: fixText, MIN_PRICE: MIN_PRICE };
})(window.App);
