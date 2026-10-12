// Overview page: headline numbers, key takeaways and a card linking to each detail page.
(function (App) {
  'use strict';

  var UI = App.UI, $ = UI.$, esc = UI.esc, gbp = UI.gbp, pct = UI.pct, round = UI.round;

  function renderTiles(s) {
    var t = s.totals;
    var tiles = [
      ['Total spent', gbp(t.paid), t.shops + ' shops · ' + round(t.items) + ' items'],
      ['Average shop', gbp(t.avgBasket), gbp(t.perWeek) + ' per week on average'],
      ['Food & drink', pct(t.foodSpend / t.itemSpend), gbp(t.nonfoodSpend, 0) + ' went on non-food'],
      ['Snacks', pct(s.byType.snack.spend / t.foodSpend), 'of food & drink spend'],
      ['Fruit & veg', pct(s.byGroup.fv.spend / t.foodSpend), 'of food & drink spend'],
      ['Bulk buys', pct(s.bulk.spend / t.foodSpend), 'of food spend on long-life items that last weeks'],
      ['Savings', gbp(t.savings), 'Clubcard & offer savings']
    ];
    $('tiles').innerHTML = tiles.map(function (x) {
      return '<div class="tile"><div class="tile-label">' + x[0] + '</div>' +
        '<div class="tile-value">' + x[1] + '</div><div class="tile-sub">' + x[2] + '</div></div>';
    }).join('');
  }

  function busiestMonth(s) {
    function sum(m) { return Object.keys(m.byGroup).reduce(function (t, k) { return t + m.byGroup[k]; }, 0); }
    return s.period.months.slice().sort(function (a, b) { return sum(b) - sum(a); })[0];
  }

  function renderInsights(s) {
    var out = [];
    var food = s.totals.foodSpend;
    var groups = UI.groupsBySpend(s);
    var top = groups[0];
    out.push('<strong>' + esc(top.name) + '</strong> is the biggest slice of food spending at ' +
      pct(s.byGroup[top.id].spend / food) + ' (' + gbp(s.byGroup[top.id].spend, 0) + '), followed by ' +
      esc(groups[1].name) + ' at ' + pct(s.byGroup[groups[1].id].spend / food) + '.');

    var kcal = s.nutrition.total.kcal;
    var snack = s.byType.snack;
    out.push('Snacks take <strong>' + pct(snack.spend / food) + '</strong> of food spend and supply ' +
      pct(snack.nutrients.kcal / kcal) + ' of the calories bought; ingredients take ' +
      pct(s.byType.ingredient.spend / food) + ' of spend for ' + pct(s.byType.ingredient.nutrients.kcal / kcal) + ' of calories.');

    var drinkSubs = s.subs.filter(function (x) { return x.group === 'drinks'; });
    if (drinkSubs.length) {
      out.push('Drinks cost <strong>' + gbp(s.byGroup.drinks.spend, 0) + '</strong> (' + pct(s.byGroup.drinks.spend / food) +
        ' of food spend). ' + esc(drinkSubs[0].name) + ' alone came to ' + gbp(drinkSubs[0].spend, 0) +
        ' across ' + drinkSubs[0].qty + ' bottles or packs.');
    }

    var sugar = s.nutrition.total.sugar;
    if (sugar > 0) {
      out.push('Drinks account for about <strong>' + pct(s.byGroup.drinks.nutrients.sugar / sugar) +
        '</strong> of the sugar bought, and snacks & treats for another ' + pct(s.byGroup.snacks.nutrients.sugar / sugar) + '.');
    }

    if (s.bulk.lines) {
      var bulkNames = s.bulk.products.map(function (p) { return esc(p.sub.toLowerCase()); })
        .filter(function (x, i, a) { return a.indexOf(x) === i; }).slice(0, 3);
      out.push('<strong>' + gbp(s.bulk.spend, 0) + '</strong> (' + pct(s.bulk.spend / food) + ' of food spend) went on ' +
        s.bulk.lines + ' bulk buys: long-life items holding weeks of servings, mostly ' + UI.listText(bulkNames) +
        '. The Nutrition and Diet check pages can spread these over the time they last, or leave them out.');
    }

    var mostOften = s.topByCount[0];
    if (mostOften) {
      out.push('The most-bought item is <strong>' + esc(mostOften.name) + '</strong>: ' + mostOften.qty +
        ' bought, costing ' + gbp(mostOften.spend) + ' in total.');
    }

    var big = s.totals.biggest;
    out.push('The biggest single shop was <strong>' + gbp(big.paid) + '</strong> on ' + UI.fmtDate(big.date) +
      '. Non-food items (mostly ' + esc((s.nonfoodSubs[0] || { name: 'household' }).name.toLowerCase()) + ') made up ' +
      pct(s.totals.nonfoodSpend / s.totals.itemSpend) + ' of all spending, and ' + busiestMonth(s).longLabel + ' was the most expensive month.');

    $('insights').innerHTML = out.map(function (x) { return '<li>' + x + '</li>'; }).join('');
  }

  function renderExplore(s) {
    var food = s.totals.foodSpend;
    var top = UI.groupsBySpend(s)[0];
    var settings = App.Diet.resolve(App.Diet.loadSettings());
    var diet = App.Diet.assess(s, settings);
    var gaps = diet.checks.filter(function (c) { return c.status.dir === 'low' && c.id !== 'kcal'; })
      .map(function (c) { return c.name.charAt(0).toLowerCase() + c.name.slice(1); });
    var mostOften = s.topByCount[0];

    var teasers = {
      groups: esc(top.name) + ' is the top food group at ' + pct(s.byGroup[top.id].spend / food) + ' of food spend.',
      types: 'Ingredients ' + pct(s.byType.ingredient.spend / food) + ' · snacks ' + pct(s.byType.snack.spend / food) +
        ' · drinks ' + pct(s.byType.drink.spend / food) + ' of food spend.',
      trends: 'Most expensive month: ' + busiestMonth(s).longLabel + '.',
      top: mostOften ? 'Most bought: ' + esc(mostOften.name) + ' (×' + mostOften.qty + ').' : '',
      prices: 'The foods whose prices changed the most in the dates you choose, and how often deals came round.',
      nutrition: round(s.nutrition.total.kcal / s.nutrition.weeks) + ' kcal of food bought per week on average.',
      diet: 'About ' + round(diet.day.kcal) + ' kcal per person per day.' +
        (gaps.length ? ' Possible gaps: ' + esc(UI.listText(gaps.slice(0, 3))) + '.' : '')
    };

    $('explore').innerHTML = App.PAGES.filter(function (p) { return p.id !== 'overview'; }).map(function (p) {
      return '<a class="explore-card" href="' + p.href + '"><span class="explore-title">' + esc(p.name) +
        ' <span aria-hidden="true">→</span></span><span class="explore-text">' + (teasers[p.id] || '') + '</span></a>';
    }).join('');
  }

  var timeframe = App.Timeframe.init({
    storeKey: 'tesco-overview-timeframe',
    render: function (s) {
      renderTiles(s);
      renderInsights(s);
      renderExplore(s);
    }
  });

  App.Site.init(function (s, ctx) { timeframe.update(s, ctx.parsed); });
})(window.App);
