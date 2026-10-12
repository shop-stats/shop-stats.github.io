// Nutrition page: nutrients bought, spend vs calories by group, and the biggest source of each nutrient,
// for the whole history or a single year, month or week chosen from the timeframe picker.
(function (App) {
  'use strict';

  var UI = App.UI, $ = UI.$, esc = UI.esc, pct = UI.pct, round = UI.round, swatch = UI.swatch;

  // Ranges of a week or less show totals; longer ranges show averages per week.
  function isShort(info) { return !info.all && info.days <= 7; }

  function renderHeadings(info) {
    var oneWeek = isShort(info);
    $('h-weekly').textContent = oneWeek ? 'Nutrients bought in these ' + info.days + ' days' : 'Nutrients bought per week';
    $('weekly-note').textContent = oneWeek
      ? 'Everything bought between these dates, compared with one adult’s weekly reference intake (the UK daily values × 7).'
      : 'Average per week across ' + (info.all ? 'the whole period' : 'the selected dates') +
        ', compared with one adult’s weekly reference intake (the UK daily values × 7).';
  }

  function renderTiles(s, info) {
    var weeks = s.nutrition.weeks;
    var total = s.nutrition.total;
    var oneWeek = isShort(info);
    $('nutri-tiles').innerHTML = App.NUTRIENTS.map(function (n) {
      var weekly = total[n.id] / weeks;
      var share = weekly / (n.ri * 7);
      return '<div class="nutri-tile"><div class="tile-label">' + n.name + (oneWeek ? ' bought' : ' per week') + '</div>' +
        '<div class="tile-value">' + round(weekly) + ' ' + n.unit + '</div>' +
        '<div class="meter" aria-hidden="true"><span style="width:' + Math.min(100, share * 100).toFixed(1) + '%"></span></div>' +
        '<div class="tile-sub">' + pct(share) + ' of one adult’s weekly reference intake' +
        (oneWeek ? '' : ' · ' + round(total[n.id]) + ' ' + n.unit + ' in total') + '</div></div>';
    }).join('');
  }

  function renderSources(s, info) {
    var weeks = s.nutrition.weeks;
    var total = s.nutrition.total;
    var rows = App.NUTRIENTS.map(function (n) {
      var best = null;
      App.GROUPS.forEach(function (g) {
        var v = s.byGroup[g.id].nutrients[n.id];
        if (!best || v > best.v) best = { g: g, v: v };
      });
      return '<tr><td>' + n.name + '</td><td class="num">' + round(total[n.id] / weeks) + ' ' + n.unit + '</td>' +
        '<td>' + (best.v > 0 ? swatch(best.g.id) + esc(best.g.name) : '–') + '</td>' +
        '<td class="num">' + (total[n.id] ? pct(best.v / total[n.id]) : '–') + '</td></tr>';
    }).join('');
    $('table-sources').innerHTML =
      '<thead><tr><th>Nutrient</th><th class="num">' + (isShort(info) ? 'Total' : 'Per week') +
      '</th><th>Biggest source</th><th class="num">Share of total</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>';
  }

  $('legend-calories').innerHTML =
    '<li><span class="swatch" style="background:var(--ink-2)"></span>Share of food spend (solid)</li>' +
    '<li><span class="swatch light" style="background:var(--ink-2)"></span>Share of calories bought (light)</li>';

  var timeframe = App.Timeframe.init({
    storeKey: 'tesco-nutrition-timeframe',
    bulkControls: true,
    render: function (s, info) {
      renderHeadings(info);
      renderTiles(s, info);
      renderSources(s, info);
      App.Charts.caloriesVsSpend(s);
    }
  });

  App.Site.init(function (s, ctx) { timeframe.update(s, ctx.parsed); });
})(window.App);
