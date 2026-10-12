// Shopping patterns: the most-bought items, which items are bought together, and a predicted list for the
// next shop based on how often each item is bought (with recent gaps weighted more, so trends count).
// Works on food and drink plus everyday household items that get used up (cleaning, toiletries, toilet roll,
// medicines, baby and pet). "Keys" are exact product names, or kinds of product when grouped.
(function (App) {
  'use strict';

  var DAY = 86400000;
  var TOP_N = 20;
  var MIN_TOGETHER = 3;      // a combination must appear in at least this many shops
  var MIN_PURCHASES = 3;     // an item needs this many shops to predict when it's next needed
  var SOON_SHARE = 0.7;      // "due soon" once 70% of the usual gap has passed
  var LATE_FACTOR = 2;       // over twice the usual gap: overdue, worth checking it's still needed
  var STOPPED_FACTOR = 3;    // over 3 usual gaps (and 60+ days) since last bought: probably stopped buying it
  var STOPPED_MIN_DAYS = 60;

  function midnight(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function median(xs) {
    if (!xs.length) return null;
    var s = xs.slice().sort(function (a, b) { return a - b; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function overlap(a0, a1, b0, b1) { return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0)); }

  // Days between two dates, not counting days inside the given (paused) periods.
  function activeDays(from, to, paused) {
    var ms = to - from;
    (paused || []).forEach(function (p) { ms -= overlap(from.getTime(), to.getTime(), p.start.getTime(), p.end.getTime() + 1); });
    return Math.max(0, ms / DAY);
  }

  // opts: { range, group: 'product'|'kind', asOf: Date, paused: [{start,end}] }
  function analyse(parsed, opts) {
    opts = opts || {};
    var groups = App.GROUPS.map(function (g) { return g.id; });
    var byKind = opts.group === 'kind';
    var inRange = function (d) { return !opts.range || (d >= opts.range.start && d <= opts.range.end); };

    // Every food line, keyed, with the basket it belongs to.
    var items = {};      // key -> { key, name, kind, group, lines: [] }
    var baskets = {};    // basketId -> { date, keys: {} }
    parsed.lines.forEach(function (l) {
      var cls = App.Classifier.classify(l.name);
      // Food and drink, plus household items that get used up and re-bought (cleaning, toiletries, toilet roll...).
      var household = cls.group === 'nonfood' && cls.consumable;
      if (groups.indexOf(cls.group) === -1 && !household) return;
      var key = byKind ? cls.subName : l.name;
      var it = items[key] || (items[key] = {
        key: key, name: key, kind: cls.subName, group: cls.group, area: cls.area, sub: cls.subName, lines: [], products: {}
      });
      it.lines.push(l);
      it.products[l.name] = true;
      var b = baskets[l.basketId] || (baskets[l.basketId] = { date: l.date, keys: {} });
      b.keys[key] = true;
    });

    var basketIds = Object.keys(baskets);
    var rangeBaskets = basketIds.filter(function (id) { return inRange(baskets[id].date); });
    var N = rangeBaskets.length;

    // Month buckets across the whole history, for the purchase sparklines.
    var first = parsed.baskets[0].date, last = parsed.baskets[parsed.baskets.length - 1].date;
    var months = [];
    for (var c = new Date(first.getFullYear(), first.getMonth(), 1); c <= last; c = new Date(c.getFullYear(), c.getMonth() + 1, 1)) {
      months.push({ y: c.getFullYear(), m: c.getMonth(), label: c.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }) });
    }
    var monthIndex = function (d) { return (d.getFullYear() - first.getFullYear()) * 12 + d.getMonth() - first.getMonth(); };

    var asOf = opts.asOf || new Date();
    var paused = opts.paused || [];

    var list = Object.keys(items).map(function (k) {
      var it = items[k];
      // One purchase per shop: the dates of the shops that included this item.
      var shopMap = {};
      it.lines.forEach(function (l) {
        var s = shopMap[l.basketId] || (shopMap[l.basketId] = { date: l.date, qty: 0, spend: 0, price: l.unitPrice });
        s.qty += l.quantity;
        s.spend += l.total;
        s.price = l.unitPrice;
      });
      var shops = Object.keys(shopMap).map(function (id) { return shopMap[id]; }).sort(function (a, b) { return a.date - b.date; });
      var rangeShops = shops.filter(function (s) { return inRange(s.date); });

      var spark = months.map(function () { return 0; });
      shops.forEach(function (s) { spark[monthIndex(s.date)]++; });

      // Gaps between shops, in days you were around (paused periods don't count).
      var gaps = [];
      for (var i = 1; i < shops.length; i++) {
        var g = activeDays(midnight(shops[i - 1].date), midnight(shops[i].date), paused);
        if (g >= 1) gaps.push(g);
      }
      var overall = median(gaps);
      var recent = median(gaps.slice(-3));
      var trend = null;
      if (gaps.length >= 4 && overall) {
        if (recent < overall * 0.75) trend = 'more';
        else if (recent > overall * 1.33) trend = 'less';
        else trend = 'steady';
      }

      var qtys = shops.map(function (s) { return s.qty; });
      var usualQty = Math.max(1, Math.round(median(qtys)));
      var lastShop = shops[shops.length - 1];
      var prediction = null;
      if (shops.length >= MIN_PURCHASES && overall) {
        var expected = recent ? 0.5 * overall + 0.5 * recent : overall;
        // Buying more than usual last time means it lasts longer.
        expected *= Math.max(0.5, Math.min(3, lastShop.qty / usualQty));
        var elapsed = activeDays(midnight(lastShop.date), midnight(asOf), paused);
        var score = elapsed / expected;
        var status = elapsed > expected * STOPPED_FACTOR && elapsed > STOPPED_MIN_DAYS ? 'stopped'
          : score >= LATE_FACTOR ? 'late'
          : score >= 1 ? 'due'
          : score >= SOON_SHARE ? 'soon'
          : 'later';
        prediction = {
          expectedGap: expected,
          elapsed: elapsed,
          score: score,
          daysLeft: Math.max(0, Math.round(expected - elapsed)),
          status: status
        };
      }

      return {
        key: it.key,
        kind: it.kind,
        group: it.group,
        area: it.area,
        sub: it.sub,
        household: it.group === 'nonfood',
        productCount: Object.keys(it.products).length,
        shops: rangeShops.length,
        shopsAll: shops.length,
        share: N ? rangeShops.length / N : 0,
        qty: rangeShops.reduce(function (t, s) { return t + s.qty; }, 0),
        spend: rangeShops.reduce(function (t, s) { return t + s.spend; }, 0),
        usualGap: overall,
        recentGap: recent,
        trend: trend,
        usualQty: usualQty,
        lastPrice: lastShop.price,
        lastDate: lastShop.date,
        lastQty: lastShop.qty,
        spark: spark,
        prediction: prediction
      };
    });

    var top = list.filter(function (x) { return x.shops > 0; })
      .sort(function (a, b) { return b.shops - a.shops || b.qty - a.qty; })
      .slice(0, TOP_N);

    // ---------- Bought together (among the top items) ----------
    var topKeys = top.map(function (x) { return x.key; });
    var count = {};
    topKeys.forEach(function (k) { count[k] = 0; });
    var pairCount = {}, tripleCount = {};
    rangeBaskets.forEach(function (id) {
      var ks = topKeys.filter(function (k) { return baskets[id].keys[k]; });
      ks.forEach(function (k) { count[k]++; });
      for (var a = 0; a < ks.length; a++) {
        for (var b = a + 1; b < ks.length; b++) {
          var pk = ks[a] + '\u0000' + ks[b];
          pairCount[pk] = (pairCount[pk] || 0) + 1;
          for (var c3 = b + 1; c3 < ks.length; c3++) {
            var tk = pk + '\u0000' + ks[c3];
            tripleCount[tk] = (tripleCount[tk] || 0) + 1;
          }
        }
      }
    });

    var pairs = Object.keys(pairCount).filter(function (k) { return pairCount[k] >= MIN_TOGETHER; }).map(function (k) {
      var ks = k.split('\u0000'), n = pairCount[k];
      var lift = N ? (n * N) / (count[ks[0]] * count[ks[1]]) : 0;
      return {
        items: ks, together: n, lift: lift,
        confidence: [n / count[ks[0]], n / count[ks[1]]]  // share of A's shops that also had B, and the reverse
      };
    }).filter(function (p) { return p.lift > 1; })
      .sort(function (a, b) { return (b.lift * Math.sqrt(b.together)) - (a.lift * Math.sqrt(a.together)); });

    var triples = Object.keys(tripleCount).filter(function (k) { return tripleCount[k] >= MIN_TOGETHER; }).map(function (k) {
      var ks = k.split('\u0000'), n = tripleCount[k];
      var expected = N ? count[ks[0]] * count[ks[1]] * count[ks[2]] / (N * N) : 0;
      return { items: ks, together: n, lift: expected ? n / expected : 0 };
    }).filter(function (t) { return t.lift > 1; })
      .sort(function (a, b) { return (b.lift * Math.sqrt(b.together)) - (a.lift * Math.sqrt(a.together)); });

    // ---------- Next shopping list ----------
    var predicted = list.filter(function (x) { return x.prediction; });
    var byFrequency = function (a, b) { return b.shopsAll - a.shopsAll || b.prediction.score - a.prediction.score; };
    var due = predicted.filter(function (x) { return x.prediction.status === 'due'; }).sort(byFrequency);
    var late = predicted.filter(function (x) { return x.prediction.status === 'late'; }).sort(byFrequency);
    var soon = predicted.filter(function (x) { return x.prediction.status === 'soon'; })
      .sort(function (a, b) { return a.prediction.daysLeft - b.prediction.daysLeft; });
    var stopped = predicted.filter(function (x) { return x.prediction.status === 'stopped'; })
      .sort(function (a, b) { return b.shopsAll - a.shopsAll; });

    // Items often bought alongside the due ones (from all shops), not already on the list.
    var onList = {};
    due.concat(soon).concat(late).forEach(function (x) { onList[x.key] = true; });
    var byKey = {};
    list.forEach(function (x) { byKey[x.key] = x; });
    var partners = {};
    var allCount = {};
    basketIds.forEach(function (id) { Object.keys(baskets[id].keys).forEach(function (k) { allCount[k] = (allCount[k] || 0) + 1; }); });
    due.forEach(function (d) {
      var together = {};
      basketIds.forEach(function (id) {
        var keys = baskets[id].keys;
        if (!keys[d.key]) return;
        Object.keys(keys).forEach(function (k) { if (k !== d.key) together[k] = (together[k] || 0) + 1; });
      });
      Object.keys(together).forEach(function (k) {
        var x = byKey[k];
        if (onList[k] || !x || together[k] < MIN_TOGETHER) return;
        if (x.prediction && x.prediction.status === 'stopped') return;
        var conf = together[k] / allCount[d.key];
        if (conf < 0.4) return;
        if (!partners[k] || partners[k].confidence < conf) partners[k] = { item: x, withKey: d.key, confidence: conf, together: together[k] };
      });
    });
    var alsoNeed = Object.keys(partners).map(function (k) { return partners[k]; })
      .sort(function (a, b) { return b.confidence - a.confidence; }).slice(0, 8);

    return {
      shopsInRange: N,
      months: months,
      top: top,
      pairs: pairs.slice(0, 10),
      triples: triples.slice(0, 6),
      due: due,
      soon: soon,
      late: late,
      alsoNeed: alsoNeed,
      stopped: stopped.slice(0, 10),
      asOf: asOf,
      lastShop: last
    };
  }

  App.Basket = {
    analyse: analyse,
    TOP_N: TOP_N, MIN_TOGETHER: MIN_TOGETHER, MIN_PURCHASES: MIN_PURCHASES,
    SOON_SHARE: SOON_SHARE, LATE_FACTOR: LATE_FACTOR, STOPPED_FACTOR: STOPPED_FACTOR
  };
})(window.App);
