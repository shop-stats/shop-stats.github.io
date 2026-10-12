// Food groups page: spending by food group, plus the non-food breakdown.
(function (App) {
  'use strict';

  var UI = App.UI, $ = UI.$, esc = UI.esc, gbp = UI.gbp, pct = UI.pct, swatch = UI.swatch;

  function renderTable(s) {
    var food = s.totals.foodSpend;
    var groups = UI.groupsBySpend(s);
    var rows = groups.map(function (g) {
      var d = s.byGroup[g.id];
      return '<tr><td>' + swatch(g.id) + esc(g.name) + '</td><td class="num">' + d.items +
        '</td><td class="num">' + gbp(d.spend) + '</td><td class="num">' + (d.bulkSpend ? gbp(d.bulkSpend) : '–') +
        '</td><td class="num">' + pct(d.spend / food) + '</td></tr>';
    }).join('');
    $('table-groups').innerHTML =
      '<thead><tr><th>Food group</th><th class="num">Items</th><th class="num">Spent</th>' +
      '<th class="num" title="Long-life items bought in amounts that last weeks">Of which bulk</th><th class="num">Share</th></tr></thead>' +
      '<tbody>' + rows + '<tr class="total"><td>All food &amp; drink</td><td class="num">' +
      groups.reduce(function (n, g) { return n + s.byGroup[g.id].items; }, 0) +
      '</td><td class="num">' + gbp(food) + '</td><td class="num">' + gbp(s.bulk.spend) + '</td><td class="num">100%</td></tr></tbody>';
  }

  function renderNonfood(s) {
    var nf = s.byGroup.nonfood;
    var unc = s.byGroup.unclassified;
    $('nonfood').innerHTML =
      '<h3>' + swatch('nonfood') + 'Non-food: ' + gbp(nf.spend) + ' (' + pct(nf.spend / s.totals.itemSpend) + ' of everything)</h3>' +
      '<ul>' + s.nonfoodSubs.map(function (x) {
        return '<li><span>' + esc(x.name) + '</span><span>' + gbp(x.spend) + '</span></li>';
      }).join('') +
      (unc.spend > 0 ? '<li><span>Unclassified items</span><span>' + gbp(unc.spend) + '</span></li>' : '') +
      '</ul>';
  }

  // What each group is mostly made of, by sub-category.
  function renderBreakdown(s) {
    $('group-breakdown').innerHTML = UI.groupsBySpend(s).map(function (g) {
      var subs = s.subs.filter(function (x) { return x.group === g.id; }).slice(0, 5);
      return '<div class="top-list"><h3>' + swatch(g.id) + esc(g.name) + '</h3><ol>' + subs.map(function (x) {
        return '<li><span class="name">' + esc(x.name) + '<small>×' + x.qty + '</small></span>' +
          '<span class="val">' + gbp(x.spend) + '</span></li>';
      }).join('') + '</ol></div>';
    }).join('');
  }

  var timeframe = App.Timeframe.init({
    storeKey: 'tesco-groups-timeframe',
    render: function (s) {
      renderTable(s);
      renderNonfood(s);
      renderBreakdown(s);
      App.Charts.groupSpend(s);
    }
  });

  App.Site.init(function (s, ctx) { timeframe.update(s, ctx.parsed); });
})(window.App);
