// Builds every number the page shows from parsed baskets and lines.
(function (App) {
  'use strict';

  var DAY = 86400000;

  function zeroNutrients() {
    var o = { grams: 0 };
    App.NUTRIENTS.forEach(function (n) { o[n.id] = 0; });
    return o;
  }

  // Adds a fraction of a line's nutrients (fraction < 1 when a bulk buy is spread over time).
  function addNutrients(into, n, frac) {
    var f = frac == null ? 1 : frac;
    into.grams += n.grams * f;
    App.NUTRIENTS.forEach(function (nu) { into[nu.id] += n[nu.id] * f; });
  }

  function overlap(aStart, aEnd, bStart, bEnd) {
    return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
  }

  function monthKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function dayKey(d) {
    return monthKey(d) + '-' + String(d.getDate()).padStart(2, '0');
  }

  // opts.range = { start: Date, end: Date } limits everything to purchases inside that window and
  //   uses its length for per-week and per-day averages. Without it the whole history is used.
  // opts.bulk = how bulk buys (long-life items holding weeks of servings) count towards nutrition:
  //   'include' (default) - all on the day bought; 'spread' - evenly over the days the purchase lasts,
  //   so only the part eaten inside the window counts; 'exclude' - left out entirely (spend too).
  // opts.servingsPerDay = servings eaten per day (one per person), used for how long purchases last.
  // opts.exclude = [{ start, end }] periods to leave out completely (e.g. time spent living elsewhere):
  //   their purchases are ignored and their days don't count towards per-day averages.
  function build(parsed, opts) {
    opts = opts || {};
    var range = opts.range;
    var bulkMode = opts.bulk || 'include';
    var servingsPerDay = opts.servingsPerDay || 1;

    var baskets = range
      ? parsed.baskets.filter(function (b) { return b.date >= range.start && b.date <= range.end; })
      : parsed.baskets;
    if (!baskets.length) return null;

    var groupIds = App.GROUPS.map(function (g) { return g.id; });
    var allGroupIds = groupIds.concat([App.NONFOOD.id, App.UNCLASSIFIED.id]);

    var byGroup = {};
    allGroupIds.forEach(function (id) {
      byGroup[id] = { spend: 0, items: 0, bulkSpend: 0, nutrients: zeroNutrients() };
    });

    var byType = {};
    var matrix = {};
    App.TYPES.forEach(function (t) {
      byType[t.id] = { spend: 0, items: 0, bulkSpend: 0, nutrients: zeroNutrients() };
      matrix[t.id] = {};
      groupIds.forEach(function (g) { matrix[t.id][g] = 0; });
    });

    var nonfoodSubs = {};
    var nonfoodAreas = {};
    var products = {};
    var subs = {};
    var monthly = {};
    var daily = {};
    var unclassified = {};
    var bulkItems = {};
    var bulk = { spend: 0, items: 0, lines: 0, kcal: 0, excluded: bulkMode === 'exclude', mode: bulkMode, byMonth: {} };

    var first = range ? range.start : baskets[0].date;
    var last = range ? range.end : baskets[baskets.length - 1].date;
    // Window that nutrition is counted in: the range, or the whole history up to the end of the last shopping day.
    var winStart = first.getTime();
    var winEnd = range ? range.end.getTime() + 1
      : new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1).getTime();

    // Excluded periods, clipped to the window.
    var away = (opts.exclude || []).map(function (r) {
      return { s: Math.max(r.start.getTime(), winStart), e: Math.min(r.end.getTime() + 1, winEnd) };
    }).filter(function (r) { return r.e > r.s; });
    var inAway = function (t) { return away.some(function (r) { return t >= r.s && t < r.e; }); };
    var awayOverlap = function (a, b) {
      return away.reduce(function (sum, r) { return sum + overlap(a, b, r.s, r.e); }, 0);
    };
    var awayMs = away.reduce(function (sum, r) { return sum + (r.e - r.s); }, 0);
    if (away.length) {
      baskets = baskets.filter(function (b) { return !inAway(b.date.getTime()); });
      if (!baskets.length) return null;
    }

    // Two-week stretches counted from the start of the window.
    var FORTNIGHT = 14 * DAY;
    var fortnights = [];
    for (var f = 0; f * FORTNIGHT <= last - first; f++) {
      var start = new Date(first.getTime() + f * FORTNIGHT);
      var fs = start.getTime();
      fortnights.push({
        start: start, end: new Date(fs + FORTNIGHT - DAY), kcal: 0, spend: 0, foodSpend: 0,
        awayDays: awayOverlap(fs, Math.min(fs + FORTNIGHT, winEnd)) / DAY
      });
    }
    var nutritionTotal = zeroNutrients();
    var sizeGuessed = 0;
    var lineCount = 0;

    parsed.lines.forEach(function (line) {
      var t = line.date.getTime();
      var bought = t >= winStart && t < winEnd && !inAway(t);
      var cls = App.Classifier.classify(line.name);
      var n = App.Nutrition.nutrientsFor(line, cls, servingsPerDay);
      var isBulk = !!(n && n.bulk);
      var isFood = groupIds.indexOf(cls.group) !== -1;

      // How much of this line's nutrition belongs in the window.
      var frac = bought ? 1 : 0;
      var lastsMs = n ? n.lastsDays * DAY : 0;
      if (isBulk && bulkMode === 'spread') {
        frac = (overlap(t, t + lastsMs, winStart, winEnd) - awayOverlap(t, t + lastsMs)) / lastsMs;
      }
      if (isBulk && bulkMode === 'exclude') frac = 0;
      if (!bought && frac <= 0) return;

      var g = byGroup[cls.group];
      var subId = cls.sub || 'unclassified';
      var sb = subs[subId] || (subs[subId] = {
        id: subId, name: cls.subName, group: cls.group, spend: 0, qty: 0, nutrients: zeroNutrients()
      });

      if (bought) {
        lineCount++;
        if (isBulk) {
          bulk.spend += line.total;
          bulk.items += line.quantity;
          bulk.lines++;
          bulk.kcal += n.kcal;
          var bmk = monthKey(line.date);
          bulk.byMonth[bmk] = (bulk.byMonth[bmk] || 0) + line.total;
          var bi = bulkItems[line.name] || (bulkItems[line.name] = {
            name: line.name, sub: cls.subName, group: cls.group, qty: 0, spend: 0, servings: 0, lastsDays: 0, shelfDays: n.shelfDays
          });
          bi.qty += line.quantity;
          bi.spend += line.total;
          bi.servings += n.servings;
          bi.lastsDays = Math.max(bi.lastsDays, n.lastsDays);
        }
      }

      // Spending is counted when bought (and not at all for bulk buys that are left out).
      if (bought && !(isBulk && bulkMode === 'exclude')) {
        g.spend += line.total;
        g.items += line.quantity;
        if (isBulk) g.bulkSpend += line.total;

        var fn = fortnights[Math.min(fortnights.length - 1, Math.floor((t - winStart) / FORTNIGHT))];
        fn.spend += line.total;
        if (isFood) fn.foodSpend += line.total;

        var mk = monthKey(line.date);
        monthly[mk] = monthly[mk] || {};
        monthly[mk][cls.group] = (monthly[mk][cls.group] || 0) + line.total;

        var dk = dayKey(line.date);
        daily[dk] = daily[dk] || { bulk: 0 };
        daily[dk][cls.group] = (daily[dk][cls.group] || 0) + line.total;
        if (isBulk) daily[dk].bulk += line.total;

        var p = products[line.name] || (products[line.name] = {
          name: line.name, spend: 0, qty: 0, group: cls.group, type: cls.type, sub: cls.subName, area: cls.area,
          servings: 0, shelfDays: n ? n.shelfDays : null, lastsDays: 0, bulkQty: 0, bulkSpend: 0
        });
        p.spend += line.total;
        p.qty += line.quantity;
        if (n) {
          p.servings += n.servings;
          p.lastsDays = Math.max(p.lastsDays, n.lastsDays);
        }
        if (isBulk) { p.bulkQty += line.quantity; p.bulkSpend += line.total; }

        sb.spend += line.total;
        sb.qty += line.quantity;

        if (cls.group === 'nonfood') {
          nonfoodSubs[cls.subName] = (nonfoodSubs[cls.subName] || 0) + line.total;
          var area = nonfoodAreas[cls.area] || (nonfoodAreas[cls.area] = { id: cls.area, spend: 0, items: 0, subs: {} });
          area.spend += line.total;
          area.items += line.quantity;
          var ns = area.subs[cls.sub] || (area.subs[cls.sub] = { id: cls.sub, name: cls.subName, consumable: cls.consumable, spend: 0, items: 0, products: {} });
          ns.spend += line.total;
          ns.items += line.quantity;
          ns.products[line.name] = (ns.products[line.name] || 0) + line.total;
          monthly[mk]['nf:' + cls.area] = (monthly[mk]['nf:' + cls.area] || 0) + line.total;
          daily[dk]['nf:' + cls.area] = (daily[dk]['nf:' + cls.area] || 0) + line.total;
        }
        if (!cls.matched) {
          unclassified[line.name] = (unclassified[line.name] || 0) + line.total;
        }
        if (cls.type) {
          byType[cls.type].spend += line.total;
          byType[cls.type].items += line.quantity;
          if (isBulk) byType[cls.type].bulkSpend += line.total;
          matrix[cls.type][cls.group] += line.total;
        }
        if (n && n.sizeGuessed) sizeGuessed++;
      }

      if (n && frac > 0) {
        addNutrients(g.nutrients, n, frac);
        addNutrients(sb.nutrients, n, frac);
        addNutrients(nutritionTotal, n, frac);
        if (cls.type) addNutrients(byType[cls.type].nutrients, n, frac);
        if (isBulk && bulkMode === 'spread') {
          fortnights.forEach(function (fw) {
            var fs = fw.start.getTime();
            var a0 = Math.max(fs, winStart), a1 = Math.min(fs + FORTNIGHT, winEnd);
            var inFortnight = overlap(t, t + lastsMs, a0, a1) -
              away.reduce(function (sum, r) { return sum + overlap(t, t + lastsMs, Math.max(a0, r.s), Math.min(a1, r.e)); }, 0);
            fw.kcal += n.kcal * Math.max(0, inFortnight) / lastsMs;
          });
        } else {
          fortnights[Math.min(fortnights.length - 1, Math.floor((t - winStart) / FORTNIGHT))].kcal += n.kcal;
        }
      }
    });

    // Period covered, filling months with no shopping so gaps show on the chart.
    var days = range ? (last - first + 1) / DAY : Math.max(1, (last - first) / DAY + 1);
    var weeks = range ? days / 7 : Math.max(1, (last - first) / DAY / 7);
    var awayDays = awayMs / DAY;
    if (awayDays > 0) {
      days = Math.max(1, days - awayDays);
      weeks = Math.max(1 / 7, days / 7);
    }
    var months = [];
    var cursor = new Date(first.getFullYear(), first.getMonth(), 1);
    while (cursor <= last) {
      var key = monthKey(cursor);
      months.push({
        key: key,
        label: cursor.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
        longLabel: cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
        byGroup: monthly[key] || {},
        bulkSpend: bulk.byMonth[key] || 0
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    // Day-by-day buckets for short windows (a month or a week), so charts can show finer detail.
    var dayBuckets = null;
    if (days <= 62) {
      dayBuckets = [];
      for (var dc = new Date(first.getFullYear(), first.getMonth(), first.getDate()); dc <= last; dc = new Date(dc.getFullYear(), dc.getMonth(), dc.getDate() + 1)) {
        var dkey = dayKey(dc);
        var dd = daily[dkey] || { bulk: 0 };
        dayBuckets.push({
          key: dkey,
          label: dc.toLocaleDateString('en-GB', { weekday: days <= 7 ? 'short' : undefined, day: 'numeric', month: 'short' }),
          longLabel: dc.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
          byGroup: dd,
          bulkSpend: dd.bulk
        });
      }
    }

    var paid = 0, savings = 0, biggest = baskets[0];
    baskets.forEach(function (b) {
      paid += b.paid;
      savings += b.savings;
      if (b.paid > biggest.paid) biggest = b;
    });

    var foodSpend = groupIds.reduce(function (s, id) { return s + byGroup[id].spend; }, 0);
    var itemSpend = allGroupIds.reduce(function (s, id) { return s + byGroup[id].spend; }, 0);
    var productList = Object.keys(products).map(function (k) { return products[k]; });

    function topBy(list, field, n) {
      return list.slice().sort(function (a, b) { return b[field] - a[field] || b.spend - a.spend; }).slice(0, n);
    }

    var topByType = {};
    App.TYPES.forEach(function (t) {
      topByType[t.id] = topBy(productList.filter(function (p) { return p.type === t.id; }), 'spend', 5);
    });
    bulk.products = Object.keys(bulkItems).map(function (k) { return bulkItems[k]; })
      .sort(function (a, b) { return b.spend - a.spend; });

    return {
      period: {
        first: first, last: last, weeks: weeks, days: days, awayDays: awayDays,
        months: months, dayBuckets: dayBuckets, fortnights: fortnights
      },
      totals: {
        paid: paid,
        savings: savings,
        shops: baskets.length,
        avgBasket: paid / baskets.length,
        perWeek: paid / weeks,
        itemSpend: itemSpend,
        foodSpend: foodSpend,
        nonfoodSpend: byGroup.nonfood.spend,
        items: allGroupIds.reduce(function (s, id) { return s + byGroup[id].items; }, 0),
        biggest: biggest
      },
      byGroup: byGroup,
      byType: byType,
      matrix: matrix,
      bulk: bulk,
      // Non-food by area, then smaller category, each with its top products. Largest first.
      nonfoodAreas: (App.NONFOOD_AREAS || []).map(function (a) {
        var x = nonfoodAreas[a.id];
        if (!x) return null;
        return {
          id: a.id, name: a.name, spend: x.spend, items: x.items,
          subs: Object.keys(x.subs).map(function (k) {
            var s = x.subs[k];
            return {
              id: s.id, name: s.name, consumable: s.consumable, spend: s.spend, items: s.items,
              products: Object.keys(s.products).map(function (n) { return { name: n, spend: s.products[n] }; })
                .sort(function (p, q) { return q.spend - p.spend; })
            };
          }).sort(function (p, q) { return q.spend - p.spend; })
        };
      }).filter(Boolean).sort(function (p, q) { return q.spend - p.spend; }),
      nonfoodSubs: Object.keys(nonfoodSubs)
        .map(function (k) { return { name: k, spend: nonfoodSubs[k] }; })
        .sort(function (a, b) { return b.spend - a.spend; }),
      subs: Object.keys(subs).map(function (k) { return subs[k]; }).sort(function (a, b) { return b.spend - a.spend; }),
      products: productList,
      topBySpend: topBy(productList, 'spend', 10),
      topByCount: topBy(productList, 'qty', 10),
      topByType: topByType,
      nutrition: { total: nutritionTotal, weeks: weeks, sizeGuessed: sizeGuessed },
      unclassified: Object.keys(unclassified)
        .map(function (k) { return { name: k, spend: unclassified[k] }; })
        .sort(function (a, b) { return b.spend - a.spend; }),
      lineCount: lineCount
    };
  }

  App.Aggregate = { build: build };
})(window.App);
