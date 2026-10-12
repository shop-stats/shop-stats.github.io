// Price trends: how the prices of the most frequently bought items changed, and when deals came round.
// Item prices in a Tesco export are what was paid, so Clubcard prices and offers show up as dips below
// the item's usual price. The "regular" price at each purchase is the highest price paid for that item in
// the previous REGULAR_WINDOW_DAYS; a purchase at least DEAL_THRESHOLD below it counts as a deal.
(function (App) {
  'use strict';

  var DAY = 86400000;
  var REGULAR_WINDOW_DAYS = 120;
  var DEAL_THRESHOLD = 0.05;     // 5% or more below the regular price
  var DEAL_RUN_GAP_DAYS = 21;    // deal purchases closer together than this are the same deal
  var BASELINE_LOOKBACK_DAYS = 180; // how far before a chosen start date to look for the price going in
  var TOP_N = 20;

  function round2(v) { return Math.round(v * 100) / 100; }

  function monthKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  // One price series per product across the whole history, with regular price and deal flags.
  function buildSeries(parsed) {
    var byName = {};
    parsed.lines.forEach(function (l) {
      var perKg = l.weightKg > 0;
      var price = perKg ? l.unitPrice / l.weightKg : l.unitPrice;
      if (!(price >= App.Parser.MIN_PRICE)) return; // unrealistic price (e.g. a bad weight on a loose item)
      var s = byName[l.name] || (byName[l.name] = { name: l.name, perKg: perKg, obs: [] });
      s.obs.push({ date: l.date, price: round2(price), qty: perKg ? 1 : l.quantity });
    });

    Object.keys(byName).forEach(function (k) {
      var s = byName[k];
      s.obs.sort(function (a, b) { return a.date - b.date; });
      s.obs.forEach(function (o, i) {
        var regular = o.price;
        for (var j = i - 1; j >= 0 && o.date - s.obs[j].date <= REGULAR_WINDOW_DAYS * DAY; j--) {
          regular = Math.max(regular, s.obs[j].price);
        }
        o.regular = regular;
        o.deal = o.price <= regular * (1 - DEAL_THRESHOLD);
        o.discount = o.deal ? (regular - o.price) / regular : 0;
      });
    });
    return byName;
  }

  // baseline: the item's last purchase before the chosen start date (if recent), so a price change that
  // happened between that purchase and the first one in the range still counts as a change in the range.
  function itemStats(series, obs, dataEnd, baseline) {
    var first = baseline || obs[0], last = obs[obs.length - 1];
    var spanDays = (last.date - first.date) / DAY;
    var change = first.regular ? (last.regular - first.regular) / first.regular : 0;
    var deals = obs.filter(function (o) { return o.deal; });

    // Group deal purchases into separate deals and measure the gaps between them.
    var runs = [];
    deals.forEach(function (o) {
      var r = runs[runs.length - 1];
      if (r && o.date - r.end <= DEAL_RUN_GAP_DAYS * DAY) r.end = o.date;
      else runs.push({ start: o.date, end: o.date });
    });
    var gaps = [];
    for (var i = 1; i < runs.length; i++) gaps.push((runs[i].start - runs[i - 1].start) / DAY);
    var avgGap = gaps.length ? gaps.reduce(function (a, b) { return a + b; }, 0) / gaps.length : null;
    var lastRun = runs[runs.length - 1];
    var next = avgGap && lastRun ? new Date(lastRun.start.getTime() + avgGap * DAY) : null;

    var qty = obs.reduce(function (t, o) { return t + o.qty; }, 0);
    var spend = obs.reduce(function (t, o) { return t + o.price * o.qty; }, 0);

    return {
      name: series.name,
      perKg: series.perKg,
      obs: obs,
      times: obs.length,
      points: obs.length + (baseline ? 1 : 0), // prices available to compare, including the one going in
      baselineBefore: !!baseline,
      baseObs: baseline,
      qty: qty,
      spend: spend,
      firstDate: obs[0].date,
      baseDate: first.date,
      lastDate: last.date,
      firstRegular: first.regular,
      latestRegular: last.regular,
      change: change,
      annualChange: spanDays >= 180 ? Math.pow(1 + change, 365 / spanDays) - 1 : null,
      lowest: Math.min.apply(null, obs.map(function (o) { return o.price; })),
      highest: Math.max.apply(null, obs.map(function (o) { return o.price; })),
      // How far the prices paid in the dates varied, e.g. 0.24 when a deal took 24% off the highest price.
      swing: (function () {
        var hi = Math.max.apply(null, obs.map(function (o) { return o.price; }));
        var lo = Math.min.apply(null, obs.map(function (o) { return o.price; }));
        return hi > 0 ? (hi - lo) / hi : 0;
      })(),
      dealCount: deals.length,
      dealShare: deals.length / obs.length,
      avgDiscount: deals.length ? deals.reduce(function (t, o) { return t + o.discount; }, 0) / deals.length : 0,
      saved: deals.reduce(function (t, o) { return t + (o.regular - o.price) * o.qty; }, 0),
      dealRuns: runs.length,
      avgGapDays: avgGap,
      lastDeal: lastRun ? lastRun.start : null,
      nextDeal: next,
      nextIsPast: next ? next < dataEnd : false
    };
  }

  // Monthly index (100 = each item's first price in the period), weighted by spend. An item's last known
  // price carries forward into months it wasn't bought, so the line reflects prices rather than what was bought.
  function priceIndex(items, start, end) {
    var months = [];
    var cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end) {
      months.push({ key: monthKey(cursor), label: cursor.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
        end: new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1) });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return months.map(function (m) {
      var wReg = 0, wPaid = 0, wSum = 0;
      items.forEach(function (it) {
        var inMonth = it.obs.filter(function (o) { return monthKey(o.date) === m.key; });
        var before = it.obs.filter(function (o) { return o.date < m.end; });
        if (!before.length && !it.baseObs) return;
        var lastObs = before.length ? before[before.length - 1] : it.baseObs; // price going into the range
        var reg = inMonth.length
          ? inMonth.reduce(function (t, o) { return t + o.regular; }, 0) / inMonth.length
          : lastObs.regular;
        var paid = inMonth.length
          ? inMonth.reduce(function (t, o) { return t + o.price * o.qty; }, 0) / inMonth.reduce(function (t, o) { return t + o.qty; }, 0)
          : lastObs.regular;
        wReg += it.spend * reg / it.firstRegular;
        wPaid += it.spend * paid / it.firstRegular;
        wSum += it.spend;
      });
      return { key: m.key, label: m.label, regular: wSum ? wReg / wSum * 100 : null, paid: wSum ? wPaid / wSum * 100 : null };
    });
  }

  // A price "changed" if the regular price moved or different prices were paid (e.g. deals).
  function priceChanged(it) {
    return it.points > 1 && (Math.abs(it.change) > 0.005 || it.highest - it.lowest > 0.005);
  }
  var byFrequency = function (a, b) { return b.times - a.times || b.qty - a.qty || b.spend - a.spend; };

  // Ways to choose which TOP_N items the page analyses.
  var CRITERIA = [
    { id: 'period-change', name: 'Biggest price change in these dates',
      blurb: 'The items whose price moved the most in the selected dates: first by how much the regular price rose or fell, ' +
        'then, for items whose regular price held steady, by how much the prices you paid swung (for example with deals).',
      filter: priceChanged,
      sort: function (a, b) {
        return Math.abs(b.change) - Math.abs(a.change) || b.swing - a.swing || byFrequency(a, b);
      } },
    { id: 'biggest-rise', name: 'Biggest price rises',
      blurb: 'Items whose regular price went up the most.',
      filter: function (it) { return it.points > 1 && it.change > 0.005; },
      sort: function (a, b) { return b.change - a.change || byFrequency(a, b); } },
    { id: 'biggest-fall', name: 'Biggest price falls',
      blurb: 'Items whose regular price came down the most.',
      filter: function (it) { return it.points > 1 && it.change < -0.005; },
      sort: function (a, b) { return a.change - b.change || byFrequency(a, b); } },
    { id: 'most-deals', name: 'Most often on a deal',
      blurb: 'Items bought on a deal most often (by number of deal purchases, then the share of purchases on a deal).',
      filter: function (it) { return it.dealCount > 0; },
      sort: function (a, b) { return b.dealCount - a.dealCount || b.dealShare - a.dealShare || byFrequency(a, b); } },
    { id: 'deepest-deals', name: 'Biggest deal discounts',
      blurb: 'Items with the largest typical discount when on a deal.',
      filter: function (it) { return it.dealCount > 0; },
      sort: function (a, b) { return b.avgDiscount - a.avgDiscount || byFrequency(a, b); } },
    { id: 'most-saved', name: 'Most saved on deals',
      blurb: 'Items where deals saved you the most money compared with the regular price.',
      filter: function (it) { return it.saved > 0.005; },
      sort: function (a, b) { return b.saved - a.saved || byFrequency(a, b); } },
    { id: 'most-spent-changed', name: 'Most spent on (price changed)',
      blurb: 'The items you spent the most on whose price changed, so price moves here matter most to your budget.',
      filter: priceChanged,
      sort: function (a, b) { return b.spend - a.spend || byFrequency(a, b); } },
    { id: 'frequent-changed', name: 'Most often bought (price changed)',
      blurb: 'Your most frequently bought items in these dates whose price changed, through a price rise or fall or a deal. Items that always cost the same are skipped.',
      filter: priceChanged, sort: byFrequency },
    { id: 'frequent-all', name: 'Most often bought (all items)',
      blurb: 'Your most frequently bought items, including ones whose price never changed.',
      filter: function () { return true; }, sort: byFrequency }
  ];

  function criterion(id) {
    for (var i = 0; i < CRITERIA.length; i++) if (CRITERIA[i].id === id) return CRITERIA[i];
    return CRITERIA[0];
  }

  function analyse(parsed, range, criteriaId) {
    var crit = criterion(criteriaId);
    var all = buildSeries(parsed);
    var start = range ? range.start : parsed.baskets[0].date;
    var end = range ? range.end : parsed.baskets[parsed.baskets.length - 1].date;
    var dataEnd = parsed.baskets[parsed.baskets.length - 1].date;
    var inRange = function (d) { return d >= start && d <= end; };

    var items = Object.keys(all).map(function (k) {
      var s = all[k];
      var obs = s.obs.filter(function (o) { return inRange(o.date); });
      if (!obs.length) return null;
      var baseline = null;
      if (range) {
        var before = s.obs.filter(function (o) { return o.date < start && start - o.date <= BASELINE_LOOKBACK_DAYS * DAY; });
        baseline = before.length ? before[before.length - 1] : null;
      }
      return itemStats(s, obs, dataEnd, baseline);
    }).filter(Boolean);

    var matching = items.filter(crit.filter).sort(crit.sort);
    var top = matching.slice(0, TOP_N);

    // Basket-level savings reported on receipts, by month.
    var baskets = parsed.baskets.filter(function (b) { return inRange(b.date); });
    var savingsByMonth = {};
    baskets.forEach(function (b) {
      var k = monthKey(b.date);
      var m = savingsByMonth[k] || (savingsByMonth[k] = { savings: 0, shops: 0, withSavings: 0 });
      m.savings += b.savings;
      m.shops++;
      if (b.savings > 0) m.withSavings++;
    });

    var index = priceIndex(top, start, end);
    var weighted = function (field) {
      var w = top.reduce(function (t, it) { return t + it.spend; }, 0);
      return w ? top.reduce(function (t, it) { return t + it.spend * it[field]; }, 0) / w : 0;
    };

    return {
      start: start,
      end: end,
      criterion: crit,
      itemCount: items.length,
      matchingCount: matching.length,
      onceCount: items.filter(function (it) { return it.points === 1; }).length,
      constantCount: items.filter(function (it) { return it.points > 1 && !priceChanged(it); }).length,
      top: top,
      index: index,
      savingsByMonth: index.map(function (m) {
        var s = savingsByMonth[m.key] || { savings: 0, shops: 0, withSavings: 0 };
        return { key: m.key, label: m.label, savings: s.savings, shops: s.shops, withSavings: s.withSavings };
      }),
      totals: {
        weightedChange: weighted('change'),
        dearer: top.filter(function (it) { return it.change > 0.005; }).length,
        cheaper: top.filter(function (it) { return it.change < -0.005; }).length,
        unchanged: top.filter(function (it) { return Math.abs(it.change) <= 0.005; }).length,
        purchases: top.reduce(function (t, it) { return t + it.times; }, 0),
        dealPurchases: top.reduce(function (t, it) { return t + it.dealCount; }, 0),
        dealSaved: top.reduce(function (t, it) { return t + it.saved; }, 0),
        basketSavings: baskets.reduce(function (t, b) { return t + b.savings; }, 0),
        shops: baskets.length,
        shopsWithSavings: baskets.filter(function (b) { return b.savings > 0; }).length
      }
    };
  }

  App.Prices = {
    analyse: analyse,
    CRITERIA: CRITERIA,
    REGULAR_WINDOW_DAYS: REGULAR_WINDOW_DAYS,
    DEAL_THRESHOLD: DEAL_THRESHOLD,
    DEAL_RUN_GAP_DAYS: DEAL_RUN_GAP_DAYS,
    BASELINE_LOOKBACK_DAYS: BASELINE_LOOKBACK_DAYS,
    TOP_N: TOP_N
  };
})(window.App);
