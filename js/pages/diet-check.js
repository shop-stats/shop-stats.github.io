// Diet check page: calories per person per day, the two-week breakdown and the guideline checks.
// With one person on the card, the calorie target comes from their BMR (height, weight, sex, age) × activity.
(function (App) {
  'use strict';

  var UI = App.UI, $ = UI.$, esc = UI.esc, gbp = UI.gbp, pct = UI.pct, round = UI.round, fmtNum = UI.fmtNum;
  var settings = App.Diet.loadSettings();
  var eff = App.Diet.resolve(settings); // settings actually used (personal or manual calorie target)

  function targetText() {
    return eff.kcalTarget.toLocaleString('en-GB') + ' kcal' + (eff.targetSource === 'personal' ? ' personal' : '') + ' target';
  }

  function renderHero(a, info) {
    var day = a.day;
    var ratio = day.kcal / eff.kcalTarget;
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
      '</div></div>';
  }

  function renderFortnights(a, info) {
    var oneWeek = !info.all && info.days < 14; // shorter than one two-week stretch
    $('fortnight-note').hidden = !oneWeek;
    $('fortnight-body').hidden = oneWeek;
    if (oneWeek) return;
    $('table-fortnights').innerHTML =
      '<thead><tr><th>Two weeks from</th><th class="num">Days</th><th class="num">Food &amp; drink bought</th>' +
      '<th class="num">kcal / person / day</th><th class="num">Of target</th></tr></thead><tbody>' +
      a.fortnights.map(function (f) {
        return '<tr><td>' + UI.fmtDate(f.start) + '</td><td class="num">' + f.days + '</td><td class="num">' + gbp(f.spend) +
          '</td><td class="num">' + round(f.kcalPerDay) + '</td><td class="num">' + pct(f.kcalPerDay / eff.kcalTarget) + '</td></tr>';
      }).join('') + '</tbody>';
    App.Charts.fortnightly(a, eff.kcalTarget, a.day.kcal);
  }

  function renderChecks(a) {
    $('scale-note').textContent = settings.scaleToTarget
      ? 'Nutrient amounts are scaled up by ' + fmtNum(a.scale, 2) + '× so this shows what each person would get eating ' +
        eff.kcalTarget.toLocaleString('en-GB') + ' kcal a day of this food. That way, a low result means the food itself is short of that nutrient, not just that some food is bought elsewhere. Problems are listed first.'
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

  var timeframe = App.Timeframe.init({
    storeKey: 'tesco-diet-timeframe',
    bulkControls: true,
    servingsPerDay: function () { return settings.people; }, // more people finish bulk buys sooner
    render: function (s, info) {
      var a = App.Diet.assess(s, eff);
      renderHero(a, info);
      renderFortnights(a, info);
      renderChecks(a);
    }
  });

  // ---------- Personal calorie target (one person only) ----------

  function renderPersonal() {
    var single = settings.people === 1;
    var personal = eff.targetSource === 'personal';
    $('personal').hidden = !single;
    $('in-kcal').disabled = personal;
    $('in-kcal').value = eff.kcalTarget;
    $('kcal-label').textContent = personal ? 'Daily calorie target (from your details below)' : 'Daily calorie target per person';
    if (!single) return;

    var problem = App.Diet.profileProblem(settings.profile);
    if (personal) {
      var act = App.Diet.ACTIVITY.filter(function (x) { return x.factor === settings.profile.activity; })[0];
      $('bmr-result').innerHTML =
        'Your BMR is about <strong>' + round(eff.bmr) + ' kcal</strong> a day at rest. Being ' +
        (act ? esc(act.name.toLowerCase()) + ' (×' + act.factor + ')' : 'this active (×' + settings.profile.activity + ')') +
        ' gives a daily target of <strong>' + eff.kcalTarget.toLocaleString('en-GB') + ' kcal</strong>, used for the checks below. ' +
        'Your iron target is ' + eff.ironTarget + 'mg a day.';
    } else if (problem === 'incomplete') {
      $('bmr-result').textContent = 'Fill in all four details to personalise the target. Until then the manual target of ' +
        settings.kcalTarget.toLocaleString('en-GB') + ' kcal is used.';
    } else {
      $('bmr-result').textContent = problem + ' The manual target of ' + settings.kcalTarget.toLocaleString('en-GB') + ' kcal is used for now.';
    }
  }

  function num(id) {
    var v = parseFloat($(id).value);
    return isFinite(v) ? v : null;
  }

  function syncInputs() {
    $('in-people').value = settings.people;
    $('in-share').value = Math.round(settings.share * 100);
    $('out-share').textContent = Math.round(settings.share * 100) + '%';
    $('in-scale').checked = settings.scaleToTarget;
    $('in-activity').innerHTML = App.Diet.ACTIVITY.map(function (a) {
      return '<option value="' + a.factor + '">' + esc(a.name) + ' (' + esc(a.blurb) + ')</option>';
    }).join('');
    var p = settings.profile;
    $('in-height').value = p.height || '';
    $('in-weight').value = p.weight || '';
    $('in-sex').value = p.sex || '';
    $('in-age').value = p.age || '';
    $('in-activity').value = String(p.activity || 1.375);
    renderPersonal();
  }

  function onInput() {
    var people = parseInt($('in-people').value, 10);
    var share = parseInt($('in-share').value, 10);
    if (people >= 1 && people <= 50) settings.people = people;
    if (share >= 5 && share <= 100) settings.share = share / 100;
    if (!$('in-kcal').disabled) {
      var kcal = parseInt($('in-kcal').value, 10);
      if (kcal >= 500 && kcal <= 6000) settings.kcalTarget = kcal;
    }
    settings.scaleToTarget = $('in-scale').checked;
    settings.profile = {
      height: num('in-height'),
      weight: num('in-weight'),
      sex: $('in-sex').value,
      age: num('in-age'),
      activity: parseFloat($('in-activity').value) || 1.375
    };
    $('out-share').textContent = Math.round(settings.share * 100) + '%';
    App.Diet.saveSettings(settings);
    eff = App.Diet.resolve(settings);
    renderPersonal();
    timeframe.refresh();
  }

  ['in-people', 'in-share', 'in-kcal', 'in-height', 'in-weight', 'in-age'].forEach(function (id) {
    $(id).addEventListener('input', onInput);
  });
  ['in-scale', 'in-sex', 'in-activity'].forEach(function (id) { $(id).addEventListener('change', onInput); });
  syncInputs();

  App.Site.init(function (s, ctx) { timeframe.update(s, ctx.parsed); });
})(window.App);
