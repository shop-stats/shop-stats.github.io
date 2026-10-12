// Top items page: most money spent, most often bought, and a searchable list of every product
// with its servings, shelf life and whether it was a bulk buy.
(function (App) {
  'use strict';

  var UI = App.UI, $ = UI.$, esc = UI.esc, gbp = UI.gbp, swatch = UI.swatch, round = UI.round;
  var products = [];
  var sort = { key: 'spend', dir: -1 };

  function bulkBadge(p) {
    return p.bulkQty ? '<span class="badge" title="Long-life item bought in an amount that lasts weeks">Bulk</span>' : '';
  }

  function keeps(days) {
    if (days == null) return '–';
    if (days >= 365) return Math.round(days / 365 * 10) / 10 + ' yr';
    if (days >= 60) return Math.round(days / 30) + ' mo';
    if (days >= 14) return Math.round(days / 7) + ' wk';
    return days + ' d';
  }

  function renderTops(s) {
    $('top-items').innerHTML =
      UI.topList('Most money spent', s.topBySpend, function (p) { return gbp(p.spend) + '<br><small>×' + p.qty + '</small>'; }) +
      UI.topList('Bought most often', s.topByCount, function (p) { return '×' + p.qty + '<br><small>' + gbp(p.spend) + '</small>'; });
  }

  function renderAll() {
    var q = $('product-search').value.trim().toLowerCase();
    var filter = $('product-filter').value;
    var list = products.filter(function (p) {
      if (filter === 'bulk' && !p.bulkQty) return false;
      if (filter === 'regular' && p.bulkQty) return false;
      if (filter === 'food' && (p.group === 'nonfood' || p.group === 'unclassified')) return false;
      if (filter === 'household' && p.group !== 'nonfood') return false;
      return !q || p.name.toLowerCase().indexOf(q) !== -1 || UI.categoryLabel(p).toLowerCase().indexOf(q) !== -1 ||
        (p.sub || '').toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) {
      var x = a[sort.key], y = b[sort.key];
      if (x == null) x = -1;
      if (y == null) y = -1;
      return (typeof x === 'string' ? x.localeCompare(y) : x - y) * sort.dir;
    });

    var arrow = function (key) { return sort.key === key ? (sort.dir < 0 ? ' ↓' : ' ↑') : ''; };
    var th = function (key, label, cls, title) {
      return '<th' + (cls ? ' class="' + cls + '"' : '') + (title ? ' title="' + title + '"' : '') +
        '><button type="button" class="sort" data-key="' + key + '">' + label + arrow(key) + '</button></th>';
    };
    $('table-products').innerHTML =
      '<thead><tr>' + th('name', 'Product') + '<th>Category</th>' +
        th('qty', 'Bought', 'num') + th('spend', 'Spent', 'num') +
        th('servings', 'Servings', 'num', 'Estimated servings in everything bought') +
        th('shelfDays', 'Keeps', 'num', 'Typical shelf life once bought') +
      '</tr></thead><tbody>' +
      list.map(function (p) {
        return '<tr><td>' + esc(p.name) + bulkBadge(p) + '</td><td>' +
          (p.group === 'unclassified' ? 'Unclassified' : swatch(p.group) + esc(UI.categoryLabel(p))) +
          '</td><td class="num">×' + p.qty + '</td><td class="num">' + gbp(p.spend) +
          '</td><td class="num">' + (p.servings ? round(p.servings) : '–') +
          '</td><td class="num">' + keeps(p.shelfDays) + '</td></tr>';
      }).join('') + '</tbody>';
    $('product-count').textContent = list.length + ' of ' + products.length + ' products';
  }

  $('product-search').addEventListener('input', renderAll);
  $('product-filter').addEventListener('change', renderAll);
  $('table-products').addEventListener('click', function (e) {
    var btn = e.target.closest('button.sort');
    if (!btn) return;
    var key = btn.getAttribute('data-key');
    sort = { key: key, dir: sort.key === key ? -sort.dir : (key === 'name' ? 1 : -1) };
    renderAll();
  });

  var timeframe = App.Timeframe.init({
    storeKey: 'tesco-top-timeframe',
    render: function (s) {
      products = s.products;
      renderTops(s);
      renderAll();
    }
  });

  App.Site.init(function (s, ctx) { timeframe.update(s, ctx.parsed); });
})(window.App);
