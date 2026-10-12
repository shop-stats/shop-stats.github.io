// Shopping list page: a predicted list for the next shop, the top 20 items and what's bought together.
(function (App) {
  'use strict';

  var UI = App.UI, $ = UI.$, esc = UI.esc, gbp = UI.gbp, pct = UI.pct;
  var STORE = 'tesco-list-settings';
  var settings = { group: 'product', pause: true };
  try { Object.assign(settings, JSON.parse(localStorage.getItem(STORE) || 'null')); } catch (e) { /* storage unavailable */ }
  var parsed = null;
  var info = null;          // current date-range info from the timeframe picker
  var planDate = new Date(); // the day the next shop is planned for
  var unticked = {};        // keys the person removed from the suggested list
  var defaultsFor = null;   // which list the default ticks were last set up for
  var result = null;

  function saveSettings() {
    try { localStorage.setItem(STORE, JSON.stringify(settings)); } catch (e) { /* storage unavailable */ }
  }

  function fmtDate(d) { return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function fmtInput(d) {
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  }
  function days(n) { n = Math.round(n); return n + ' day' + (n === 1 ? '' : 's'); }
  function gapText(g) {
    if (g == null) return '–';
    if (g < 1.5) return 'daily';
    if (g >= 13 && g < 70) return 'every ' + Math.round(g / 7) + ' wks';
    if (g >= 70) return 'every ' + Math.round(g / 30) + ' months';
    return 'every ' + days(g);
  }

  // Quiet periods the person left out (via the survey or the Diet check), used to pause the countdown.
  function pausedPeriods() {
    if (!settings.pause || !parsed) return [];
    var answers = App.Survey.load();
    return App.Away.detect(parsed).filter(function (p) { return App.Survey.isExcluded(answers, p.id); });
  }

  // Monthly purchase counts as a tiny bar chart.
  function sparkline(values, label) {
    var max = Math.max.apply(null, values) || 1;
    var w = 4, gap = 1.5, h = 22;
    var bars = values.map(function (v, i) {
      var bh = v ? Math.max(2, v / max * h) : 0;
      return '<rect x="' + (i * (w + gap)) + '" y="' + (h - bh) + '" width="' + w + '" height="' + bh + '" rx="1"></rect>';
    }).join('');
    var width = values.length * (w + gap);
    return '<svg class="spark" width="' + width + '" height="' + h + '" viewBox="0 0 ' + width + ' ' + h + '" role="img" aria-label="' + esc(label) + '">' +
      '<line x1="0" y1="' + (h - 0.5) + '" x2="' + width + '" y2="' + (h - 0.5) + '"></line>' + bars + '</svg>';
  }

  // ---------- Suggested list ----------

  function itemRow(x, reason, section) {
    var key = x.key;
    var on = !unticked[key];
    var est = x.lastPrice * x.usualQty;
    return '<li class="list-item' + (on ? '' : ' off') + '">' +
      '<label><input type="checkbox" data-key="' + esc(key) + '"' + (on ? ' checked' : '') + '>' +
      '<span class="li-main"><span class="li-name">' + esc(key) + (settings.group === 'kind' && x.productCount > 1 ? ' <small>(' + x.productCount + ' products)</small>' : '') +
      (x.household ? ' <span class="badge">' + esc(UI.areaName(x.area)) + '</span>' : '') +
      '</span><span class="li-reason">' + reason + '</span></span>' +
      '<span class="li-qty">×' + x.usualQty + '</span>' +
      '<span class="li-price">' + gbp(est) + '</span></label></li>';
  }

  function dueReason(x) {
    var p = x.prediction;
    var over = Math.round(p.elapsed - p.expectedGap);
    return 'Usually ' + gapText(p.expectedGap) + ' · last bought ' + fmtDate(x.lastDate) +
      (over >= 1 ? ' · ' + days(over) + ' overdue' : ' · due now') +
      (x.trend === 'more' ? ' · buying it more often lately' : '');
  }

  function soonReason(x) {
    var p = x.prediction;
    return 'Usually ' + gapText(p.expectedGap) + ' · last bought ' + fmtDate(x.lastDate) + ' · due in about ' + days(p.daysLeft);
  }

  function renderList() {
    var r = result;
    var sections = [];
    if (r.due.length) {
      sections.push('<h3 class="list-heading">Due now <span class="count">' + r.due.length + '</span></h3><ul class="shop-list">' +
        r.due.map(function (x) { return itemRow(x, dueReason(x)); }).join('') + '</ul>');
    }
    if (r.soon.length) {
      sections.push('<h3 class="list-heading">Due soon <span class="count">' + r.soon.length + '</span></h3><ul class="shop-list">' +
        r.soon.map(function (x) { return itemRow(x, soonReason(x)); }).join('') + '</ul>');
    }
    if (r.late.length) {
      sections.push('<h3 class="list-heading">Overdue: do you still need these? <span class="count">' + r.late.length + '</span></h3>' +
        '<p class="list-note">Not bought for over twice their usual gap, so they’re unticked. Tick any you still want.</p><ul class="shop-list">' +
        r.late.map(function (x) {
          return itemRow(x, 'Usually ' + gapText(x.prediction.expectedGap) + ' · last bought ' + fmtDate(x.lastDate) + ' · ' +
            days(x.prediction.elapsed) + ' ago');
        }).join('') + '</ul>');
    }
    if (r.alsoNeed.length) {
      sections.push('<h3 class="list-heading">You might also need <span class="count">' + r.alsoNeed.length + '</span></h3><ul class="shop-list">' +
        r.alsoNeed.map(function (a) {
          return itemRow(a.item, 'Bought with ' + esc(a.withKey) + ' in ' + pct(a.confidence) + ' of its shops');
        }).join('') + '</ul>');
    }
    $('next-list').innerHTML = sections.length ? sections.join('')
      : '<p class="list-empty">Nothing is due yet for ' + esc(fmtDate(planDate)) + '. Try a later date, or check back after your next shop.</p>';

    var paused = pausedPeriods();
    $('next-intro').innerHTML = 'For a shop on <strong>' + esc(fmtDate(planDate)) + '</strong>, based on how often you’ve bought each item since your first shop' +
      (paused.length ? ', with the countdown paused during ' + paused.length + ' quiet period' + (paused.length === 1 ? '' : 's') : '') +
      '. Untick anything you don’t need; quantities and prices are your usual amount at the last price paid.';
    renderTotal();

    $('stopped-details').hidden = !r.stopped.length;
    if (r.stopped.length) {
      $('stopped-summary').textContent = r.stopped.length + ' item' + (r.stopped.length === 1 ? '' : 's') + ' you seem to have stopped buying';
      $('stopped-list').innerHTML = r.stopped.map(function (x) {
        return '<li>' + esc(x.key) + ' <span class="muted-text">(usually ' + gapText(x.prediction.expectedGap) + ', last bought ' + fmtDate(x.lastDate) + ')</span></li>';
      }).join('');
    }
  }

  function chosenItems() {
    var r = result, out = [];
    r.due.concat(r.soon).concat(r.late).concat(r.alsoNeed.map(function (a) { return a.item; })).forEach(function (x) {
      if (!unticked[x.key] && !out.some(function (y) { return y.key === x.key; })) out.push(x);
    });
    return out;
  }

  function renderTotal() {
    var items = chosenItems();
    var total = items.reduce(function (t, x) { return t + x.lastPrice * x.usualQty; }, 0);
    $('list-total').innerHTML = items.length
      ? '<strong>' + items.length + ' item' + (items.length === 1 ? '' : 's') + '</strong> · about <strong>' + gbp(total) + '</strong> at your last prices'
      : 'No items ticked';
    $('copy-list').disabled = !items.length;
  }

  $('next-list').addEventListener('change', function (e) {
    var box = e.target.closest('input[data-key]');
    if (!box) return;
    var key = box.getAttribute('data-key');
    if (box.checked) delete unticked[key]; else unticked[key] = true;
    box.closest('.list-item').classList.toggle('off', !box.checked);
    renderTotal();
  });

  $('copy-list').addEventListener('click', function () {
    var lines = chosenItems().map(function (x) { return '- ' + x.key + (x.usualQty > 1 ? ' x' + x.usualQty : ''); });
    var text = 'Shopping list for ' + fmtDate(planDate) + '\n' + lines.join('\n');
    var done = function () { $('copy-message').textContent = 'Copied ' + lines.length + ' items'; };
    var fail = function () { $('copy-message').textContent = 'Couldn’t copy automatically. Select the list and copy it.'; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fail); else fail();
  });

  // ---------- Top 20 and combinations ----------

  function renderTop() {
    var r = result;
    var trendText = { more: '▲ More often lately', less: '▼ Less often lately', steady: 'Steady' };
    $('h-top').textContent = 'Your ' + r.top.length + ' most-bought ' + (settings.group === 'kind' ? 'kinds of product' : 'items');
    $('table-top').innerHTML =
      '<thead><tr><th class="num">#</th><th>' + (settings.group === 'kind' ? 'Kind of product' : 'Item') + '</th>' +
      '<th class="num">Shops</th><th class="num">Bought</th><th class="num">Usually</th><th>Trend</th><th>By month</th></tr></thead><tbody>' +
      r.top.map(function (x, i) {
        return '<tr><td class="num">' + (i + 1) + '</td><td>' + UI.swatch(x.group) + esc(x.key) +
          (settings.group === 'kind' && x.productCount > 1 ? ' <small class="muted-text">(' + x.productCount + ' products)</small>' : '') + '</td>' +
          '<td class="num">' + x.shops + ' <small class="muted-text">(' + pct(x.share) + ')</small></td>' +
          '<td class="num">×' + x.qty + '</td>' +
          '<td class="num">' + gapText(x.usualGap) + '</td>' +
          '<td class="trend-cell">' + (x.trend ? trendText[x.trend] : '<span class="muted-text">Not enough yet</span>') + '</td>' +
          '<td>' + sparkline(x.spark, 'Shops including ' + x.key + ' each month') + '</td></tr>';
      }).join('') + '</tbody>';
  }

  function combo(items, together, lift) {
    return '<li><span class="combo-items">' + items.map(function (k) { return '<span class="combo-chip">' + esc(k) + '</span>'; }).join('<span class="plus">+</span>') +
      '</span><span class="combo-stats">Together in ' + together + ' shop' + (together === 1 ? '' : 's') + ' · ' + lift.toFixed(1) + '×</span></li>';
  }

  function renderTogether() {
    var r = result;
    var empty = '<li class="muted-text">No combinations turned up in at least ' + App.Basket.MIN_TOGETHER + ' shops in these dates.</li>';
    $('triples').innerHTML = r.triples.length ? r.triples.map(function (t) { return combo(t.items, t.together, t.lift); }).join('') : empty;
    $('pairs').innerHTML = r.pairs.length ? r.pairs.map(function (p) { return combo(p.items, p.together, p.lift); }).join('') : empty;
  }

  function renderMethod() {
    $('list-method').textContent =
      'How the list works: for each food, drink or everyday household item (cleaning, laundry, toiletries, toilet roll, medicines, baby and pet) bought in at least ' +
      App.Basket.MIN_PURCHASES + ' shops, the site measures the days between the shops that included it, ' +
      'and expects the next one after a blend of your usual gap and your last three gaps, so recent changes count. If you bought more than usual last time, it expects that to last longer. ' +
      'An item is due once that gap has passed, and due soon at ' + Math.round(App.Basket.SOON_SHARE * 100) + '% of it. Items not bought for over ' + App.Basket.STOPPED_FACTOR +
      ' of their usual gaps (and at least two months) are treated as stopped. The suggested list always uses your whole history; the date range only changes the top 20 and the combinations.';
  }

  // ---------- Recalculate ----------

  function recompute() {
    if (!parsed) return;
    result = App.Basket.analyse(parsed, {
      range: info && info.period ? { start: info.period.start, end: info.period.end } : null,
      group: settings.group,
      asOf: planDate,
      paused: pausedPeriods()
    });
    // Overdue items start unticked; do this once per list (not on every redraw, so the person's ticks stick).
    var listId = settings.group + '|' + planDate.toDateString() + '|' + settings.pause;
    if (listId !== defaultsFor) {
      defaultsFor = listId;
      unticked = {};
      result.late.forEach(function (x) { unticked[x.key] = true; });
    }
    renderList();
    renderTop();
    renderTogether();
    renderMethod();
  }

  function syncControls() {
    $('group-product').setAttribute('aria-checked', String(settings.group === 'product'));
    $('group-kind').setAttribute('aria-checked', String(settings.group === 'kind'));
    $('pause-away').checked = settings.pause;
    if (document.activeElement !== $('plan-date')) $('plan-date').value = fmtInput(planDate);
  }

  function setGroup(g) {
    settings.group = g;
    unticked = {};
    saveSettings();
    syncControls();
    recompute();
  }
  $('group-product').addEventListener('click', function () { setGroup('product'); });
  $('group-kind').addEventListener('click', function () { setGroup('kind'); });

  $('pause-away').addEventListener('change', function () {
    settings.pause = this.checked;
    saveSettings();
    recompute();
  });

  $('plan-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var d = App.Timeframe.parseInput($('plan-date').value);
    if (!d) {
      $('plan-error').textContent = 'Enter the date as dd/mm/yyyy, for example ' + fmtInput(new Date()) + '.';
      $('plan-error').hidden = false;
      return;
    }
    if (parsed && d < parsed.baskets[parsed.baskets.length - 1].date) {
      $('plan-error').textContent = 'Choose a date after your last shop in the file (' + fmtDate(parsed.baskets[parsed.baskets.length - 1].date) + ').';
      $('plan-error').hidden = false;
      return;
    }
    $('plan-error').hidden = true;
    planDate = d;
    unticked = {};
    document.activeElement.blur();
    syncControls();
    recompute();
  });

  $('plan-today').addEventListener('click', function () {
    planDate = new Date();
    $('plan-error').hidden = true;
    syncControls();
    recompute();
  });

  var timeframe = App.Timeframe.init({
    storeKey: 'tesco-list-timeframe',
    render: function (s, i) {
      info = i;
      recompute();
    }
  });

  syncControls();

  App.Site.init(function (s, ctx) {
    parsed = ctx.parsed;
    // A plan date before the last shop makes no sense; start from today, or the day after the last shop.
    var last = parsed.baskets[parsed.baskets.length - 1].date;
    if (planDate < last) planDate = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
    defaultsFor = null; // a newly loaded file gets fresh default ticks
    syncControls();
    timeframe.update(s, ctx.parsed);
  });
})(window.App);
