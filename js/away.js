// Spots "quiet periods": stretches of two or more weeks where food shopping drops far below the usual
// level, which usually means the person wasn't buying their own food (e.g. a student at their family home
// for the holidays, or travelling). The Diet check can leave these out so they don't skew daily averages.
(function (App) {
  'use strict';

  var DAY = 86400000;
  var LOW_SHARE = 0.25;   // a week counts as quiet if its food spend is under 25% of a typical week
  var MIN_WEEKS = 2;      // and at least this many quiet weeks run together

  function midnight(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function isoDay(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function fmt(d) { return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }

  function median(xs) {
    var s = xs.slice().sort(function (a, b) { return a - b; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  // A friendly name for a period, based on the holidays it covers.
  function label(start, end) {
    var covers = function (m, d) {
      for (var y = start.getFullYear(); y <= end.getFullYear(); y++) {
        var t = new Date(y, m, d);
        if (t >= start && t <= end) return true;
      }
      return false;
    };
    var months = [];
    for (var c = new Date(start.getFullYear(), start.getMonth(), 1); c <= end; c = new Date(c.getFullYear(), c.getMonth() + 1, 1)) months.push(c.getMonth());
    if (covers(11, 25)) return 'Christmas holidays';
    if (months.indexOf(6) !== -1 && months.indexOf(7) !== -1) return 'Summer';
    if (covers(3, 5) && (end - start) / DAY <= 35) return 'Easter holidays';
    return 'Quiet period';
  }

  // Returns [{ id, start, end, days, weeks, spend, typicalWeek, label, text }], oldest first.
  function detect(parsed) {
    if (!parsed || !parsed.baskets.length) return [];
    var groups = App.GROUPS.map(function (g) { return g.id; });
    var first = midnight(parsed.baskets[0].date);
    var lastDay = midnight(parsed.baskets[parsed.baskets.length - 1].date);
    var nWeeks = Math.floor(Math.round((lastDay - first) / DAY) / 7) + 1;
    var weekly = new Array(nWeeks).fill(0);

    parsed.lines.forEach(function (l) {
      if (groups.indexOf(App.Classifier.classify(l.name).group) === -1) return;
      var w = Math.floor(Math.round((midnight(l.date) - first) / DAY) / 7);
      if (w >= 0 && w < nWeeks) weekly[w] += l.total;
    });

    var active = weekly.filter(function (v) { return v > 0; });
    if (active.length < 3) return [];
    var typical = median(active);
    var low = weekly.map(function (v) { return v < typical * LOW_SHARE; });

    var periods = [];
    for (var i = 0; i < nWeeks; i++) {
      if (!low[i]) continue;
      var j = i;
      while (j + 1 < nWeeks && low[j + 1]) j++;
      if (j - i + 1 >= MIN_WEEKS) {
        var start = addDays(first, i * 7);
        var endDay = addDays(first, j * 7 + 6);
        if (endDay > lastDay) endDay = lastDay;
        var spend = weekly.slice(i, j + 1).reduce(function (a, b) { return a + b; }, 0);
        var days = Math.round((endDay - start) / DAY) + 1;
        periods.push({
          id: isoDay(start),
          start: start,
          end: new Date(addDays(endDay, 1).getTime() - 1),
          days: days,
          weeks: j - i + 1,
          spend: spend,
          typicalWeek: typical,
          label: label(start, endDay),
          text: fmt(start) + ' – ' + fmt(endDay)
        });
      }
      i = j;
    }
    return periods;
  }

  App.Away = { detect: detect, LOW_SHARE: LOW_SHARE, MIN_WEEKS: MIN_WEEKS };
})(window.App);
