// Spending over time page: spending by food group per month, or per day when a single month or week is chosen.
(function (App) {
  'use strict';

  var UI = App.UI, $ = UI.$, esc = UI.esc, gbp = UI.gbp, swatch = UI.swatch;
  var includeNonfood = false;

  function series(s) {
    var list = App.GROUPS.slice();
    if (includeNonfood) list.push(App.NONFOOD);
    if (s.byGroup.unclassified.spend > 0) list.push(App.UNCLASSIFIED);
    return list;
  }

  function bucketTotal(m, list) {
    return list.reduce(function (t, g) { return t + (m.byGroup[g.id] || 0); }, 0);
  }

  // Months for long ranges; days when 62 days or fewer are selected.
  function granularity(s, info) {
    var daily = !info.all && info.days <= 62 && s.period.dayBuckets;
    return daily
      ? { buckets: s.period.dayBuckets, unit: 'day', units: 'days', Unit: 'Day' }
      : { buckets: s.period.months, unit: 'month', units: 'months', Unit: 'Month' };
  }

  function renderStats(s, g) {
    var list = series(s);
    var buckets = g.buckets;
    var active = buckets.filter(function (m) { return bucketTotal(m, list) > 0; });
    var sorted = active.slice().sort(function (a, b) { return bucketTotal(b, list) - bucketTotal(a, list); });
    var total = buckets.reduce(function (t, m) { return t + bucketTotal(m, list); }, 0);
    var tiles = [
      ['Average ' + g.unit, gbp(total / buckets.length), 'across ' + buckets.length + ' ' + g.units],
      ['Most expensive ' + g.unit, sorted[0] ? gbp(bucketTotal(sorted[0], list)) : '–', sorted[0] ? sorted[0].longLabel : ''],
      ['Cheapest (with shopping)', sorted.length ? gbp(bucketTotal(sorted[sorted.length - 1], list)) : '–',
        sorted.length ? sorted[sorted.length - 1].longLabel : ''],
      [g.Unit + 's with no shopping', String(buckets.length - active.length), 'of ' + buckets.length],
      ['Bulk buys', gbp(s.bulk.spend), s.bulk.lines + ' long-life purchase' + (s.bulk.lines === 1 ? '' : 's') + ' that last weeks']
    ];
    $('month-tiles').innerHTML = tiles.map(function (x) {
      return '<div class="tile"><div class="tile-label">' + x[0] + '</div>' +
        '<div class="tile-value">' + x[1] + '</div><div class="tile-sub">' + x[2] + '</div></div>';
    }).join('');
  }

  function renderTable(s, g) {
    var list = series(s);
    $('h-monthly').textContent = (g.unit === 'day' ? 'Daily' : 'Monthly') + ' spending by food group';
    $('h-month-table').textContent = (g.unit === 'day' ? 'Daily' : 'Monthly') + ' table';
    $('legend-monthly').innerHTML = list.map(function (gr) {
      return '<li>' + swatch(gr.id) + esc(gr.name) + '</li>';
    }).join('');

    var head = '<thead><tr><th>' + g.Unit + '</th>' + list.map(function (gr) {
      return '<th class="num">' + esc(gr.name) + '</th>';
    }).join('') + '<th class="num">Total</th><th class="num">Of which bulk</th></tr></thead>';
    var rows = g.buckets.map(function (m) {
      var cells = list.map(function (gr) {
        var v = m.byGroup[gr.id] || 0;
        return '<td class="num">' + (v ? gbp(v) : '–') + '</td>';
      }).join('');
      return '<tr><td>' + m.label + '</td>' + cells + '<td class="num">' + gbp(bucketTotal(m, list)) +
        '</td><td class="num">' + (m.bulkSpend ? gbp(m.bulkSpend) : '–') + '</td></tr>';
    }).join('');
    $('table-monthly').innerHTML = head + '<tbody>' + rows + '</tbody>';
  }

  var timeframe = App.Timeframe.init({
    storeKey: 'tesco-trends-timeframe',
    render: function (s, info) {
      var g = granularity(s, info);
      renderStats(s, g);
      renderTable(s, g);
      App.Charts.monthly(s, includeNonfood, g.buckets);
    }
  });

  $('toggle-nonfood').addEventListener('change', function (e) {
    includeNonfood = e.target.checked;
    timeframe.rerender();
  });

  App.Site.init(function (s, ctx) { timeframe.update(s, ctx.parsed); });
})(window.App);
