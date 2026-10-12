// Snacks vs ingredients page: spending by item type, top items per type and the type × group table.
(function (App) {
  'use strict';

  var UI = App.UI, $ = UI.$, esc = UI.esc, gbp = UI.gbp, pct = UI.pct, swatch = UI.swatch;

  function renderCards(s) {
    var food = s.totals.foodSpend;
    var kcal = s.nutrition.total.kcal;
    $('type-cards').innerHTML = App.TYPES.map(function (t) {
      var d = s.byType[t.id];
      return '<div class="type-card"><div class="tile-label">' + swatch(t.id, 'type') + t.name + '</div>' +
        '<div class="tile-value">' + gbp(d.spend, 0) + '</div>' +
        '<div class="tile-sub">' + pct(d.spend / food) + ' of food spend · ' + d.items + ' items</div>' +
        '<div class="tile-sub">' + pct(d.nutrients.kcal / kcal) + ' of calories bought</div>' +
        '<div class="tile-sub">' + (d.bulkSpend ? gbp(d.bulkSpend) + ' of it bulk buys' : 'No bulk buys') + '</div>' +
        '<div class="tile-sub">' + esc(t.blurb) + '</div></div>';
    }).join('');

    $('legend-types').innerHTML = App.TYPES.map(function (t) {
      return '<li>' + swatch(t.id, 'type') + t.name + '</li>';
    }).join('');
  }

  function renderTops(s) {
    $('type-tops').innerHTML = App.TYPES.map(function (t) {
      return UI.topList('Top ' + t.name.toLowerCase(), s.topByType[t.id], function (p) { return gbp(p.spend); },
        swatch(t.id, 'type'));
    }).join('');
  }

  function renderMatrix(s) {
    var head = '<thead><tr><th>Food group</th>' + App.TYPES.map(function (t) {
      return '<th class="num">' + t.name + '</th>';
    }).join('') + '</tr></thead>';
    var rows = App.GROUPS.map(function (g) {
      return '<tr><td>' + swatch(g.id) + esc(g.name) + '</td>' + App.TYPES.map(function (t) {
        var v = s.matrix[t.id][g.id];
        return '<td class="num">' + (v ? gbp(v) : '–') + '</td>';
      }).join('') + '</tr>';
    }).join('');
    var total = '<tr class="total"><td>Total</td>' + App.TYPES.map(function (t) {
      return '<td class="num">' + gbp(s.byType[t.id].spend) + '</td>';
    }).join('') + '</tr>';
    $('table-matrix').innerHTML = head + '<tbody>' + rows + total + '</tbody>';
  }

  var timeframe = App.Timeframe.init({
    storeKey: 'tesco-types-timeframe',
    render: function (s) {
      renderCards(s);
      renderTops(s);
      renderMatrix(s);
      App.Charts.typeSplit(s);
    }
  });

  App.Site.init(function (s, ctx) { timeframe.update(s, ctx.parsed); });
})(window.App);
