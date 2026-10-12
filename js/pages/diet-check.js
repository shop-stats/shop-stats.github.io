// Diet check page: calories per person per day, the two-week breakdown and the guideline checks.
// Who the food feeds, their calorie needs and how much food comes from Tesco come from the "About you"
// survey. Quiet periods (when the person probably wasn't buying their own food) can be left out.
(function (App) {
  'use strict';

  var UI = App.UI, $ = UI.$, esc = UI.esc, gbp = UI.gbp, pct = UI.pct, round = UI.round, fmtNum = UI.fmtNum;
  var MIN_DAYS = 14;        // fewer counted days than this isn't enough for an accurate assessment
  var settings = App.Survey.settings();
  var periods = [];         // detected quiet periods for the loaded file
  var showAnyway = false;   // the person chose to see a rough estimate despite too little data

  function excludedRanges() {
    var a = App.Survey.load();
    return periods.filter(function (p) { return App.Survey.isExcluded(a, p.id); });
  }

  // ---------- Household ----------

  function renderHousehold() {
    var s = settings;
    var el = $('household-summary');
    if (!s.answered) {
      el.innerHTML = '<strong>Answer a few questions about who you shop for</strong> so the check uses the right number of people and calorie needs. ' +
        'Until then it assumes one adult who buys all their food on this card.';
      $('survey-link').textContent = 'Answer the questions';
      $('household-card').classList.add('prompt');
      return;
    }
    $('household-card').classList.remove('prompt');
    $('survey-link').textContent = 'Edit your answers';
    var who = s.people === 1 ? 'Shopping for <strong>just you</strong>' : 'Shopping for <strong>' + s.people + ' people</strong> (' + esc(s.householdText) + ')';
    var share = s.shareName ? ' · ' + esc(s.shareName) + ' of your food comes from Tesco' : '';
    var target = s.people === 1
      ? ' · daily target <strong>' + s.kcalTarget.toLocaleString('en-GB') + ' kcal</strong>' +
        (s.targetSource === 'personal' ? ' from your details' : ' (standard adult; add your details for a personal target)')
      : ' · household target <strong>' + s.householdTarget.toLocaleString('en-GB') + ' kcal a day</strong>, about ' +
        s.kcalTarget.toLocaleString('en-GB') + ' per person';
    el.innerHTML = who + share + target + '.';
  }

  // ---------- Quiet periods ----------

  function renderAway() {
    var card = $('away-card');
    if (!periods.length) { card.hidden = true; return; }
    card.hidden = false;
    var a = App.Survey.load();
    $('away-intro').textContent =
      'These are stretches of two weeks or more when your food shopping dropped far below your usual level, which usually means you weren’t buying your own food ' +
      '(for example staying with family in the holidays, or travelling). Ticked periods are left out, so they don’t pull your daily average down.';
    $('away-list').innerHTML = periods.map(function (p) {
      var checked = App.Survey.isExcluded(a, p.id);
      return '<li><label class="away-item"><input type="checkbox" data-id="' + p.id + '"' + (checked ? ' checked' : '') + '>' +
        '<span><strong>' + esc(p.label) + '</strong>: ' + esc(p.text) + ' <span class="muted-text">(' + p.days + ' days, ' +
        gbp(p.spend) + ' of food bought, against about ' + gbp(p.typicalWeek, 0) + ' in a usual week)</span><br>' +
        '<small>' + (checked ? 'Left out: I wasn’t buying my own food then' : 'Included: I was shopping as normal, just less') + '</small></span></label></li>';
    }).join('');
  }

  $('away-list').addEventListener('change', function (e) {
    var box = e.target.closest('input[data-id]');
    if (!box) return;
    var a = App.Survey.load();
    a.away[box.getAttribute('data-id')] = box.checked;
    App.Survey.save(a);
    renderAway();
    timeframe.refresh();
  });

  // ---------- Results ----------

  function targetText() {
    return settings.kcalTarget.toLocaleString('en-GB') + ' kcal ' + (settings.people === 1 ? (settings.targetSource === 'personal' ? 'personal ' : '') : 'average ') + 'target';
  }

  function renderHero(a, info) {
    var day = a.day;
    var ratio = day.kcal / settings.kcalTarget;
    var lower = function (c) { return c.name.charAt(0).toLowerCase() + c.name.slice(1); };
    var flagged = a.checks.filter(function (c) { return c.status.level !== 'good' && c.id !== 'kcal'; });
    var lows = flagged.filter(function (c) { return c.status.dir === 'low'; }).map(lower);
    var highs = flagged.filter(function (c) { return c.status.dir === 'high'; }).map(lower);

    var who = a.people === 1 ? 'one person' : a.people + ' people';
    var when = info.period ? ' between these dates' : '';
    var text = 'Based on ' + who + ' getting ' + Math.round(a.share * 100) + '% of their food from this card' + when + '. ';
    if (lows.length) text += '<strong>Possibly too little:</strong> ' + esc(UI.listText(lows)) + '. ';
    if (highs.length) text += '<strong>Possibly too much:</strong> ' + esc(UI.listText(highs)) + '. ';
    if (!lows.length && !highs.length) text += 'No obvious gaps against the guidelines.';
    if (info.period && ratio < 0.25) {
      text += ' <em>Very little food was bought in this period, so the checks are based on only a few items.</em>';
    }

    $('diet-hero').innerHTML =
      '<div><div class="tile-label">Estimated calories per person per day</div>' +
      '<div class="big">' + round(day.kcal) + ' <small>kcal</small></div>' +
      '<div class="meter" aria-hidden="true"><span style="width:' + Math.min(100, ratio * 100).toFixed(1) + '%"></span></div>' +
      '<div class="tile-sub">' + pct(ratio) + ' of a ' + targetText() + '</div></div>' +
      '<div class="summary">' + text +
      '<div class="day-macros">' +
        '<span>Protein <b>' + round(day.protein) + 'g</b></span>' +
        '<span>Carbs <b>' + round(day.carbs) + 'g</b></span>' +
        '<span>Fat <b>' + round(day.fat) + 'g</b></span>' +
        '<span>Sugars <b>' + round(day.sugar) + 'g</b></span>' +
        '<span>Fibre <b>' + round(day.fibre) + 'g</b></span>' +
        '<span>Salt <b>' + fmtNum(day.salt, 1) + 'g</b></span>' +
      '</div>' +
      (showAnyway ? '<p class="rough-note">Rough estimate: based on only a few days of shopping.</p>' : '') +
      '</div>';
  }

  function renderFortnights(a, info) {
    var short = !info.all && info.days < 14;
    $('fortnight-note').hidden = !short;
    $('fortnight-body').hidden = short;
    if (short) return;
    $('table-fortnights').innerHTML =
      '<thead><tr><th>Two weeks from</th><th class="num">Days counted</th><th class="num">Food &amp; drink bought</th>' +
      '<th class="num">kcal / person / day</th><th class="num">Of target</th></tr></thead><tbody>' +
      a.fortnights.map(function (f) {
        if (f.away) {
          return '<tr class="away-row"><td>' + UI.fmtDate(f.start) + '</td><td class="num">0</td><td colspan="3">Away (left out)</td></tr>';
        }
        return '<tr><td>' + UI.fmtDate(f.start) + '</td><td class="num">' + f.days + (f.awayDays ? ' <small>(' + f.awayDays + ' away)</small>' : '') +
          '</td><td class="num">' + gbp(f.spend) +
          '</td><td class="num">' + round(f.kcalPerDay) + '</td><td class="num">' + pct(f.kcalPerDay / settings.kcalTarget) + '</td></tr>';
      }).join('') + '</tbody>';
    App.Charts.fortnightly(a, settings.kcalTarget, a.day.kcal);
  }

  function renderChecks(a) {
    $('scale-note').textContent = settings.scaleToTarget
      ? 'Nutrient amounts are scaled up by ' + fmtNum(a.scale, 2) + '× so this shows what each person would get eating ' +
        settings.kcalTarget.toLocaleString('en-GB') + ' kcal a day of this food. That way, a low result means the food itself is short of that nutrient, not just that some food is bought elsewhere. Problems are listed first.'
      : 'Nutrient amounts are what each person gets from the food bought, per day, with no scaling. Problems are listed first.';

    $('diet-checks').innerHTML = a.checks.map(function (c) {
      var fill = Math.min(c.value / c.target, 1.5) / 1.5 * 100;
      return '<div class="check ' + c.status.level + '">' +
        '<div class="check-head"><h4>' + esc(c.name) + '</h4><span class="pill">' + esc(c.status.label) + '</span></div>' +
        '<div class="check-value">' + fmtNum(c.value, c.dp) + ' <small>' + esc(c.unit) + ' · ' + esc(c.targetText) + '</small></div>' +
        '<div class="meter" title="The black tick marks the guideline"><span style="width:' + fill.toFixed(1) + '%"></span><i></i></div>' +
        '<p>' + esc(c.text) + '</p></div>';
    }).join('');
  }

  // Shows "not enough data" instead of the results when too few days of real shopping are left.
  function renderSufficiency(s, info) {
    var counted = Math.round(s.period.days);
    var enough = counted >= MIN_DAYS;
    var showResults = enough || showAnyway;
    $('insufficient').hidden = enough;
    ['intake-card', 'fortnights-card', 'checks-card'].forEach(function (id) { $(id).hidden = !showResults; });
    $('show-anyway').hidden = showAnyway;
    if (!enough) {
      var away = Math.round(s.period.awayDays || 0);
      $('insufficient-text').textContent =
        'Only ' + counted + ' day' + (counted === 1 ? '' : 's') + ' of shopping can be counted ' + (info.all ? 'in your file' : 'between these dates') +
        (away ? ', after leaving out ' + away + ' days when you probably weren’t buying your own food' : '') +
        '. An accurate diet check needs at least ' + MIN_DAYS + ' days, because food bought on one day is eaten over many. ' +
        'Choose a wider date range' + (away ? ', or include a quiet period above if you were shopping as normal' : '') + '.';
    }
    return showResults;
  }

  $('show-anyway').addEventListener('click', function () {
    showAnyway = true;
    timeframe.rerender();
  });

  var timeframe = App.Timeframe.init({
    storeKey: 'tesco-diet-timeframe',
    bulkControls: true,
    servingsPerDay: function () { return settings.people; }, // more people finish bulk buys sooner
    exclude: excludedRanges,
    onEmpty: function () {
      $('insufficient').hidden = true;
    },
    render: function (s, info) {
      if (!renderSufficiency(s, info)) return;
      var a = App.Diet.assess(s, settings);
      renderHero(a, info);
      renderFortnights(a, info);
      renderChecks(a);
    }
  });

  $('in-scale').addEventListener('change', function () {
    var d = App.Diet.loadSettings();
    d.scaleToTarget = this.checked;
    App.Diet.saveSettings(d);
    settings = App.Survey.settings();
    timeframe.rerender();
  });
  $('in-scale').checked = settings.scaleToTarget;

  renderHousehold();

  App.Site.init(function (s, ctx) {
    periods = App.Away.detect(ctx.parsed);
    showAnyway = false;
    renderAway();
    timeframe.update(s, ctx.parsed);
  });
})(window.App);
