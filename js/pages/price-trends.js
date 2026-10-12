// Price trends page: price changes and deal timing for the most frequently bought items, worked out
// afresh from whichever file is loaded and limited to the chosen timeframe.
(function (App) {
  'use strict';

  var UI = App.UI, $ = UI.$, esc = UI.esc, gbp = UI.gbp, pct = UI.pct, round = UI.round;
  var parsed = null;
  var current = null;      // latest App.Prices.analyse result
  var selectedName = null; // item shown in the price-history chart
  var CRITERIA_KEY = 'tesco-prices-list'; // new key, so the new default applies to everyone once
  var criteriaId = 'period-change';
  try { criteriaId = localStorage.getItem(CRITERIA_KEY) || criteriaId; } catch (e) { /* storage unavailable */ }
  if (!App.Prices.CRITERIA.some(function (c) { return c.id === criteriaId; })) criteriaId = 'period-change';

  function shortDate(d) {
    return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '–';
  }

  function signed(v) {
    var p = (v * 100).toFixed(Math.abs(v) < 0.1 ? 1 : 0);
    return (v > 0.0005 ? '+' : '') + p + '%';
  }

  function changeCell(it) {
    if (it.points < 2) return '<span class="muted-text">bought once</span>';
    var icon = it.change > 0.005 ? '▲ ' : it.change < -0.005 ? '▼ ' : '';
    var moved = Math.abs(it.change) > 0.005;
    return icon + signed(it.change) +
      (it.annualChange != null && moved ? '<br><small>' + signed(it.annualChange) + ' a year</small>' : '') +
      (!moved && it.swing > 0.005 ? '<br><small>prices paid varied ' + Math.round(it.swing * 100) + '%</small>' : '');
  }

  function weeks(days) {
    if (days == null) return '–';
    return days < 14 ? Math.round(days) + ' days' : 'every ' + Math.round(days / 7) + ' wks';
  }

  function renderTiles(p) {
    var t = p.totals;
    var n = p.top.length;
    var tiles = [
      ['Price change', signed(t.weightedChange), 'regular prices of these ' + n + ' items, weighted by spend'],
      ['Got dearer', String(t.dearer), t.cheaper + ' got cheaper · ' + t.unchanged + ' unchanged'],
      ['Bought on a deal', t.purchases ? pct(t.dealPurchases / t.purchases) : '–', t.dealPurchases + ' of ' + t.purchases + ' purchases of these items'],
      ['Saved on deals', gbp(t.dealSaved), 'compared with their regular prices'],
      ['Receipt savings', gbp(t.basketSavings), t.shopsWithSavings + ' of ' + t.shops + ' shops had savings']
    ];
    $('price-tiles').innerHTML = tiles.map(function (x) {
      return '<div class="tile"><div class="tile-label">' + x[0] + '</div>' +
        '<div class="tile-value">' + x[1] + '</div><div class="tile-sub">' + x[2] + '</div></div>';
    }).join('');
  }

  function renderTable(p, info) {
    var when = info.all ? 'whole period' : shortDate(info.start) + ' – ' + shortDate(info.end);
    $('h-items').textContent = p.criterion.name.replace(/ in these dates$/, '') + ', ' + when + ': ' +
      p.top.length + ' item' + (p.top.length === 1 ? '' : 's');
    $('table-prices').innerHTML =
      '<thead><tr><th>Item</th><th class="num">Bought</th>' +
      '<th class="num" title="Regular price at the first and latest purchase in the period">Regular price</th>' +
      '<th class="num">Change</th><th class="num">Paid</th>' +
      '<th class="num" title="Purchases at least ' + Math.round(App.Prices.DEAL_THRESHOLD * 100) + '% below the regular price">Deals</th>' +
      '<th class="num">Typical deal</th><th class="num" title="Average gap between separate deals">Deal comes round</th>' +
      '<th class="num">Last deal</th><th class="num" title="Last deal plus the average gap">Next maybe</th></tr></thead><tbody>' +
      p.top.map(function (it, i) {
        var unit = it.perKg ? '/kg' : '';
        var next = it.nextDeal
          ? shortDate(it.nextDeal) + (it.nextIsPast ? '<br><small>already passed</small>' : '')
          : '–';
        return '<tr class="price-row' + (it.name === selectedName ? ' selected' : '') + '" data-i="' + i + '" tabindex="0">' +
          '<td>' + esc(it.name) + '</td>' +
          '<td class="num">' + it.times + '×</td>' +
          '<td class="num">' + gbp(it.firstRegular) + ' → ' + gbp(it.latestRegular) + unit +
            (it.baselineBefore ? '<br><small title="Price going into the selected dates, from your last purchase before them">from ' + shortDate(it.baseDate) + '</small>' : '') + '</td>' +
          '<td class="num">' + changeCell(it) + '</td>' +
          '<td class="num">' + (it.lowest === it.highest ? gbp(it.lowest) : gbp(it.lowest) + '–' + gbp(it.highest)) + unit + '</td>' +
          '<td class="num">' + (it.dealCount ? it.dealCount + ' <small>(' + pct(it.dealShare) + ')</small>' : '–') + '</td>' +
          '<td class="num">' + (it.dealCount ? Math.round(it.avgDiscount * 100) + '% off' : '–') + '</td>' +
          '<td class="num">' + (it.dealRuns > 1 ? weeks(it.avgGapDays) : it.dealRuns === 1 ? 'once' : '–') + '</td>' +
          '<td class="num">' + shortDate(it.lastDeal) + '</td>' +
          '<td class="num">' + next + '</td></tr>';
      }).join('') + '</tbody>';
  }

  function renderHistory() {
    var p = current;
    var it = p.top.filter(function (x) { return x.name === selectedName; })[0] || p.top[0];
    selectedName = it.name;
    $('history-item').innerHTML = p.top.map(function (x) {
      return '<option' + (x.name === it.name ? ' selected' : '') + '>' + esc(x.name) + '</option>';
    }).join('');
    var unit = it.perKg ? '/kg' : '';
    var bits = [
      it.times + ' purchase' + (it.times === 1 ? '' : 's') + ' from ' + shortDate(it.firstDate) + ' to ' + shortDate(it.lastDate),
      'regular price ' + gbp(it.firstRegular) + unit +
        (it.baselineBefore ? ' (going in, from ' + shortDate(it.baseDate) + ')' : '') +
        ' → ' + gbp(it.latestRegular) + unit + (it.points > 1 ? ' (' + signed(it.change) + ')' : '')
    ];
    if (it.dealCount) {
      bits.push(it.dealCount + ' on a deal, typically ' + Math.round(it.avgDiscount * 100) + '% off, saving ' + gbp(it.saved));
      if (it.dealRuns > 1) bits.push('a deal came round about ' + weeks(it.avgGapDays));
    } else {
      bits.push('never bought on a deal');
    }
    $('history-stats').textContent = bits.join(' · ') + '.';
    Array.prototype.forEach.call(document.querySelectorAll('.price-row'), function (row) {
      row.classList.toggle('selected', p.top[+row.getAttribute('data-i')].name === selectedName);
    });
    App.Charts.itemHistory(it);
  }

  function renderMethod() {
    $('price-method').textContent =
      'How this works: item prices in a Tesco export are what you paid, so Clubcard prices and offers appear as dips. ' +
      'An item’s regular price at each purchase is the highest price you paid for it in the previous ' + App.Prices.REGULAR_WINDOW_DAYS +
      ' days (using your whole history, even when shorter dates are chosen). With chosen dates, each item’s price change is measured from its regular price going in (your last purchase of it in the ' +
      App.Prices.BASELINE_LOOKBACK_DAYS + ' days before the start date, if any) to its regular price at the last purchase inside the dates, so a change right at the start still counts. ' +
      'A purchase at least ' + Math.round(App.Prices.DEAL_THRESHOLD * 100) +
      '% below that counts as a deal, and deal purchases within ' + App.Prices.DEAL_RUN_GAP_DAYS + ' days of each other count as the same deal. ' +
      'You only see prices on days you shopped, so deal timings are estimates, and multi-buy offers that don’t change the item price aren’t detected. ' +
      'Loose items sold by weight are compared per kg.';
  }

  function renderCriteria() {
    $('price-criteria').innerHTML = App.Prices.CRITERIA.map(function (c) {
      return '<option value="' + c.id + '"' + (c.id === criteriaId ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    }).join('');
    $('price-criteria').value = criteriaId;
  }

  function renderBlurb(p) {
    var text = p.criterion.blurb + ' ';
    if (!p.top.length) {
      text += 'No items in this period match, so try another option or a longer timeframe.';
    } else {
      text += 'Showing ' + (p.matchingCount > p.top.length ? 'the top ' + p.top.length + ' of ' + p.matchingCount : 'all ' + p.matchingCount) +
        ' matching item' + (p.matchingCount === 1 ? '' : 's') + '.';
      if (p.criterion.id !== 'frequent-all' && (p.constantCount || p.onceCount)) {
        var parts = [];
        if (p.constantCount) parts.push(p.constantCount + ' always cost the same');
        if (p.onceCount) parts.push(p.onceCount + ' were bought only once with no earlier price to compare');
        text += ' Left out: ' + parts.join(' and ') + '.';
      }
    }
    $('criteria-blurb').textContent = text;
  }

  $('price-criteria').addEventListener('change', function (e) {
    criteriaId = e.target.value;
    try { localStorage.setItem(CRITERIA_KEY, criteriaId); } catch (err) { /* storage unavailable */ }
    timeframe.rerender();
  });
  renderCriteria();

  function setEmpty(empty) {
    Array.prototype.forEach.call(document.querySelectorAll('main > section.card, main > section[aria-label="Price summary"]'), function (el) {
      el.hidden = empty;
    });
  }

  var timeframe = App.Timeframe.init({
    storeKey: 'tesco-prices-timeframe',
    render: function (s, info) {
      if (!parsed) return;
      current = App.Prices.analyse(parsed, info.period ? { start: info.period.start, end: info.period.end } : null, criteriaId);
      var empty = !current.top.length;
      setEmpty(empty);
      renderMethod();
      renderBlurb(current);
      if (empty) return;
      renderTiles(current);
      renderTable(current, info);
      renderHistory();
      App.Charts.priceIndex(current);
      App.Charts.savingsByMonth(current);
    }
  });

  $('history-item').addEventListener('change', function (e) {
    selectedName = e.target.value;
    renderHistory();
  });

  function pickRow(row) {
    if (!row || !current) return;
    selectedName = current.top[+row.getAttribute('data-i')].name;
    renderHistory();
    $('h-history').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('table-prices').addEventListener('click', function (e) { pickRow(e.target.closest('.price-row')); });
  $('table-prices').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickRow(e.target.closest('.price-row')); }
  });

  App.Site.init(function (s, ctx) {
    parsed = ctx.parsed; // re-read every time a file is loaded, so the analysis always matches the current file
    timeframe.update(s, ctx.parsed);
  });
})(window.App);
