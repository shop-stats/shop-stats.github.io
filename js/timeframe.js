// Date-range picker shared by every page: a double-ended slider over the days covered by the loaded file,
// plus start and end boxes that take dd/mm/yyyy dates. The page provides an empty <section id="timeframe">
// and calls init({ storeKey, render, bulkControls }); each page remembers its own range via storeKey.
// bulkControls adds the bulk-buy checkboxes and list (nutrition pages); without it bulk buys count on the
// day they were bought. render(summary, info) gets info = { all, type, start, end, days, period }.
(function (App) {
  'use strict';

  var DAY = 86400000;
  var UI = App.UI, $ = UI.$, esc = UI.esc, gbp = UI.gbp;

  function midnight(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function endOfDay(d) { return new Date(addDays(midnight(d), 1).getTime() - 1); }
  function dayIndex(from, d) { return Math.round((midnight(d) - from) / DAY); }

  function fmtInput(d) {
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  }
  function fmtLong(d) {
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function isoDay(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // Reads dd/mm/yyyy (also d/m/yyyy, dd-mm-yyyy or dd.mm.yyyy). Returns null if it isn't a real date.
  function parseInput(text) {
    var m = String(text).trim().match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
    if (!m) return null;
    var d = new Date(+m[3], +m[2] - 1, +m[1]);
    return d.getDate() === +m[1] && d.getMonth() === +m[2] - 1 ? d : null;
  }

  function renderMarkup(opts) {
    var bulk = opts.bulkControls
      ? '<div class="bulk-toggles">' +
          '<label class="toggle"><input type="checkbox" id="tf-bulk" checked> Include bulk buys</label>' +
          '<label class="toggle"><input type="checkbox" id="tf-spread" checked> Spread them over how long they last</label>' +
        '</div>'
      : '';
    var bulkList = opts.bulkControls
      ? '<details class="bulk-list" id="tf-bulk-details" hidden>' +
          '<summary id="tf-bulk-summary"></summary>' +
          '<p class="muted">Bulk buys keep for at least a month and hold at least two weeks of servings (one serving per person per day). ' +
          '“Lasts about” is the shorter of the shelf life and the time to eat every serving.</p>' +
          '<div class="table-scroll"><table class="data" id="tf-bulk-list"></table></div>' +
        '</details>'
      : '';
    var el = $('timeframe');
    el.className = 'timeframe';
    el.setAttribute('aria-label', 'Date range');
    el.innerHTML =
      '<div class="range-block">' +
        '<div class="range-head"><span class="range-title">Date range</span>' +
          '<span class="range-dates" id="tf-range-dates" aria-live="polite"></span></div>' +
        '<div class="range-slider" id="tf-slider">' +
          '<div class="range-spark" id="tf-spark" aria-hidden="true"></div>' +
          '<div class="range-track" aria-hidden="true"><div class="range-fill" id="tf-fill"></div></div>' +
          '<input type="range" id="tf-from" min="0" max="1" step="1" value="0" aria-label="Start date">' +
          '<input type="range" id="tf-to" min="0" max="1" step="1" value="1" aria-label="End date">' +
        '</div>' +
        '<div class="range-ends"><span id="tf-min-label"></span><span id="tf-max-label"></span></div>' +
      '</div>' +
      '<form class="range-inputs" id="tf-form" novalidate>' +
        '<label class="field"><span>Start (dd/mm/yyyy)</span>' +
          '<input type="text" id="tf-start" inputmode="numeric" placeholder="dd/mm/yyyy" autocomplete="off" maxlength="10"></label>' +
        '<label class="field"><span>End (dd/mm/yyyy)</span>' +
          '<input type="text" id="tf-end" inputmode="numeric" placeholder="dd/mm/yyyy" autocomplete="off" maxlength="10"></label>' +
        '<button type="submit" class="btn btn-small">Apply</button>' +
        '<button type="button" class="btn btn-ghost btn-small" id="tf-all">Whole period</button>' +
      '</form>' +
      '<p class="range-error" id="tf-error" hidden></p>' +
      bulk +
      '<p class="tf-summary" id="tf-summary" aria-live="polite"></p>' +
      bulkList;
  }

  function init(opts) {
    renderMarkup(opts);
    var parsed = null, last = null;
    var dataStart = null, maxIndex = 0;
    var from = 0, to = 0;  // selected day indices from dataStart
    var choice = { start: null, end: null, includeBulk: true, spreadBulk: true };
    try { Object.assign(choice, JSON.parse(localStorage.getItem(opts.storeKey) || 'null')); } catch (e) { /* storage unavailable */ }

    function save() {
      choice.start = from === 0 && to === maxIndex ? null : isoDay(addDays(dataStart, from));
      choice.end = from === 0 && to === maxIndex ? null : isoDay(addDays(dataStart, to));
      try { localStorage.setItem(opts.storeKey, JSON.stringify(choice)); } catch (e) { /* storage unavailable */ }
    }

    function bulkMode() {
      if (!opts.bulkControls) return 'include';
      if (!choice.includeBulk) return 'exclude';
      return choice.spreadBulk ? 'spread' : 'include';
    }

    function setError(msg) {
      $('tf-error').textContent = msg || '';
      $('tf-error').hidden = !msg;
    }

    // Moves the slider handles, fill and text to match from/to (without recalculating the page).
    function syncControls() {
      var a = $('tf-from'), b = $('tf-to');
      a.max = b.max = String(maxIndex);
      a.value = String(from);
      b.value = String(to);
      var pct = function (i) { return maxIndex ? i / maxIndex * 100 : 0; };
      $('tf-fill').style.left = pct(from) + '%';
      $('tf-fill').style.width = (pct(to) - pct(from)) + '%';
      // Keep the start handle reachable when both handles sit at the far right.
      a.style.zIndex = from >= maxIndex - 1 ? 5 : 3;
      var s = addDays(dataStart, from), e = addDays(dataStart, to);
      a.setAttribute('aria-valuetext', fmtLong(s));
      b.setAttribute('aria-valuetext', fmtLong(e));
      var days = to - from + 1;
      $('tf-range-dates').textContent = fmtLong(s) + ' – ' + fmtLong(e) + ' · ' + days + ' day' + (days === 1 ? '' : 's');
      if (document.activeElement !== $('tf-start')) $('tf-start').value = fmtInput(s);
      if (document.activeElement !== $('tf-end')) $('tf-end').value = fmtInput(e);
      if (opts.bulkControls) {
        $('tf-bulk').checked = choice.includeBulk;
        $('tf-spread').checked = choice.spreadBulk;
        $('tf-spread').disabled = !choice.includeBulk;
      }
    }

    // Weekly spending drawn behind the slider, so it's clear where the shopping happened.
    function renderSpark() {
      var weeks = Math.floor(maxIndex / 7) + 1;
      var totals = new Array(weeks).fill(0);
      parsed.baskets.forEach(function (b) {
        var w = Math.min(weeks - 1, Math.floor(dayIndex(dataStart, b.date) / 7));
        totals[w] += b.paid;
      });
      var max = Math.max.apply(null, totals) || 1;
      $('tf-spark').innerHTML = totals.map(function (t) {
        // Square-root scale so one huge shop doesn't flatten every other week.
        return '<span style="height:' + (t ? Math.max(10, Math.sqrt(t / max) * 100) : 0) + '%"></span>';
      }).join('');
    }

    function show() {
      if (!parsed) return;
      var all = from === 0 && to === maxIndex;
      var start = addDays(dataStart, from);
      var end = endOfDay(addDays(dataStart, to));
      var main = document.querySelector('main');
      var s = App.Aggregate.build(parsed, {
        range: all ? null : { start: start, end: end },
        bulk: bulkMode(),
        servingsPerDay: opts.servingsPerDay ? opts.servingsPerDay() : 1,
        exclude: opts.exclude ? opts.exclude() : null
      });
      if (!s || (s.totals.foodSpend <= 0 && s.nutrition.total.kcal <= 0)) {
        main.classList.add('tf-empty');
        $('tf-summary').textContent = (opts.exclude && opts.exclude().length)
          ? 'There’s no shopping to assess between these dates once left-out periods are removed. Widen the range, or include a period below.'
          : 'No food or drink was bought between these dates. Widen the range to see results.';
        if (opts.onEmpty) opts.onEmpty();
        if (opts.bulkControls) $('tf-bulk-details').hidden = true;
        last = null;
        return;
      }
      main.classList.remove('tf-empty');
      var days = Math.round(s.period.days);
      var bulkText = !s.bulk.lines ? 'no bulk buys' :
        !opts.bulkControls ? gbp(s.bulk.spend) + ' on bulk buys' :
        s.bulk.excluded ? 'bulk buys left out (' + gbp(s.bulk.spend) + ')' :
        s.bulk.mode === 'spread' ? 'bulk buys spread over the time they last' :
        'bulk buys counted when bought (' + gbp(s.bulk.spend) + ')';
      $('tf-summary').innerHTML = '<strong>' + (all ? 'Whole period' : 'Selected dates') + '</strong><br>' +
        s.totals.shops + ' shop' + (s.totals.shops === 1 ? '' : 's') + ' · ' + gbp(s.totals.foodSpend) + ' of food &amp; drink · ' +
        days + ' day' + (days === 1 ? '' : 's') +
        (s.period.awayDays >= 1 ? ' counted (' + Math.round(s.period.awayDays) + ' left out)' : '') + ' · ' + bulkText;
      renderBulkList(s);
      var info = {
        all: all,
        type: all ? 'all' : 'range',
        start: start,
        end: end,
        days: days,
        period: all ? null : { start: start, end: end, label: fmtLong(start) + ' – ' + fmtLong(end) }
      };
      last = { summary: s, info: info };
      opts.render(s, info);
    }

    function renderBulkList(s) {
      if (!opts.bulkControls) return;
      var list = s.bulk.products;
      $('tf-bulk-details').hidden = !list.length;
      if (!list.length) return;
      $('tf-bulk-summary').textContent = list.length + ' bulk buy' + (list.length === 1 ? '' : 's') + ' in this period (' + gbp(s.bulk.spend) + ')';
      $('tf-bulk-list').innerHTML =
        '<thead><tr><th>Product</th><th class="num">Bought</th><th class="num">Servings</th>' +
        '<th class="num" title="Shorter of its shelf life and the time to eat every serving">Lasts about</th><th class="num">Spent</th></tr></thead><tbody>' +
        list.map(function (p) {
          return '<tr><td>' + esc(p.name) + '</td><td class="num">×' + p.qty + '</td><td class="num">' + UI.round(p.servings) +
            '</td><td class="num">' + UI.round(p.lastsDays) + ' days</td><td class="num">' + gbp(p.spend) + '</td></tr>';
        }).join('') + '</tbody>';
    }

    function setRange(a, b, opt) {
      from = Math.max(0, Math.min(a, maxIndex));
      to = Math.max(from, Math.min(b, maxIndex));
      syncControls();
      if (!opt || !opt.preview) { save(); show(); }
    }

    // Slider: preview the dates while dragging, recalculate when released.
    function onSlide(e) {
      var a = +$('tf-from').value, b = +$('tf-to').value;
      if (e.target.id === 'tf-from' && a > b) a = b;
      if (e.target.id === 'tf-to' && b < a) b = a;
      setError('');
      setRange(a, b, { preview: e.type === 'input' });
    }
    ['tf-from', 'tf-to'].forEach(function (id) {
      $(id).addEventListener('input', onSlide);
      $(id).addEventListener('change', onSlide);
    });

    // Typed dates: applied with Enter or the Apply button.
    $('tf-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var s = parseInput($('tf-start').value), en = parseInput($('tf-end').value);
      if (!s || !en) {
        setError('Enter both dates as dd/mm/yyyy, for example ' + fmtInput(dataStart) + '.');
        return;
      }
      if (en < s) { setError('The end date is before the start date.'); return; }
      var a = dayIndex(dataStart, s), b = dayIndex(dataStart, en);
      var notes = [];
      if (a < 0) { a = 0; notes.push('the start was moved to ' + fmtInput(dataStart) + ', the first day in the file'); }
      if (b > maxIndex) { b = maxIndex; notes.push('the end was moved to ' + fmtInput(addDays(dataStart, maxIndex)) + ', the last day in the file'); }
      if (a > maxIndex || b < 0) {
        setError('Those dates are outside the file, which covers ' + fmtInput(dataStart) + ' to ' + fmtInput(addDays(dataStart, maxIndex)) + '.');
        return;
      }
      setError(notes.length ? 'Adjusted to fit the data: ' + notes.join(' and ') + '.' : '');
      document.activeElement.blur();
      setRange(a, b);
    });

    $('tf-all').addEventListener('click', function () {
      setError('');
      setRange(0, maxIndex);
    });

    if (opts.bulkControls) {
      var onBulk = function () {
        choice.includeBulk = $('tf-bulk').checked;
        choice.spreadBulk = $('tf-spread').checked;
        save();
        syncControls();
        show();
      };
      $('tf-bulk').addEventListener('change', onBulk);
      $('tf-spread').addEventListener('change', onBulk);
    }

    return {
      // Called with the whole-history summary and parsed data whenever a file is loaded (from App.Site.init).
      update: function (summary, parsedData) {
        parsed = parsedData;
        if (!parsed) return;
        dataStart = midnight(parsed.baskets[0].date);
        maxIndex = dayIndex(dataStart, parsed.baskets[parsed.baskets.length - 1].date);
        $('tf-min-label').textContent = fmtLong(dataStart);
        $('tf-max-label').textContent = fmtLong(addDays(dataStart, maxIndex));
        renderSpark();
        // Restore this page's saved range, clipped to the loaded file.
        var a = 0, b = maxIndex;
        if (choice.start && choice.end) {
          var ps = new Date(choice.start + 'T00:00:00'), pe = new Date(choice.end + 'T00:00:00');
          a = dayIndex(dataStart, ps);
          b = dayIndex(dataStart, pe);
          if (b < 0 || a > maxIndex || isNaN(a) || isNaN(b)) { a = 0; b = maxIndex; }
        }
        setRange(a, b);
      },
      // Re-renders the current selection without recomputing it (e.g. after a settings change).
      rerender: function () { if (last) opts.render(last.summary, last.info); },
      // Recomputes the current selection (e.g. when the number of people changes how long food lasts).
      refresh: show
    };
  }

  App.Timeframe = { init: init, parseInput: parseInput };
})(window.App);
