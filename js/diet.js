// Turns what was bought into an estimated daily intake per person and checks it against UK dietary guidelines.
(function (App) {
  'use strict';

  // Fraction of each sub-category's sugars that counts as "free sugars" (added sugar, honey, syrups, juice).
  var FREE_SUGAR = {
    soft_sugar: 1, energy: 1, juice: 1, smoothie: 1, squash: 1, jam: 1, honey: 1, sugar: 1, ketchup: 1,
    sweet_sauce: 1, condiment_misc: 0.8, chocolate: 0.9, ice_cream: 0.7, ice_cream_sandwich: 0.8, cereal: 0.9,
    milkshake: 0.5, yoghurt_drink: 0.6, yoghurt_pot: 0.5, protein_shake: 0.5, bagel: 0.5, bread: 0.5,
    crackers: 0.5, crispy_onions: 0.8, gyoza: 0.5, bao: 0.7, sushi: 0.6, sandwich: 0.3
  };
  // Red and processed meat, by weight share (deli slices are roughly two-thirds ham and beef).
  var RED_MEAT = { mince_lean: 1, mince: 1, mince_fatty: 1, steak: 1, bacon: 1, deli: 0.67 };
  var OILY_FISH = { salmon: 1, smoked_salmon: 1, tinned_salmon: 1 };
  var JUICE = { juice: 1, smoothie: 1 };

  function foodSubs(s) {
    return s.subs.filter(function (x) { return x.group !== 'nonfood' && x.group !== 'unclassified'; });
  }

  function weighted(s, map, field) {
    return foodSubs(s).reduce(function (sum, x) {
      return sum + (map[x.id] || 0) * (field === 'grams' ? x.nutrients.grams : x.nutrients[field]);
    }, 0);
  }

  // Names of the sub-categories contributing most to a nutrient, e.g. "oats and bread & wraps".
  function topSources(s, valueFn, n) {
    var list = foodSubs(s)
      .map(function (x) { return { name: x.name.toLowerCase(), v: valueFn(x) }; })
      .filter(function (x) { return x.v > 0; })
      .sort(function (a, b) { return b.v - a.v; })
      .slice(0, n || 2)
      .map(function (x) { return x.name; });
    if (list.length < 2) return list.join('');
    return list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
  }

  function status(kind, value, target) {
    var r = target ? value / target : 0;
    if (kind === 'min') {
      if (r >= 1) return { level: 'good', label: 'On track' };
      if (r >= 0.7) return { level: 'warning', label: 'A bit low', dir: 'low' };
      return { level: 'critical', label: 'Low', dir: 'low' };
    }
    if (kind === 'max') {
      if (r <= 1) return { level: 'good', label: 'Within limit' };
      if (r <= 1.3) return { level: 'warning', label: 'A bit high', dir: 'high' };
      return { level: 'critical', label: 'High', dir: 'high' };
    }
    // 'band': energy, where both too little and too much matter.
    if (r < 0.6) return { level: 'critical', label: 'Well below target', dir: 'low' };
    if (r < 0.85) return { level: 'warning', label: 'Below target', dir: 'low' };
    if (r <= 1.15) return { level: 'good', label: 'On target' };
    return { level: 'warning', label: 'Above target', dir: 'high' };
  }

  function assess(s, settings) {
    var people = Math.max(1, settings.people);
    var share = Math.min(1, Math.max(0.05, settings.share));
    var perDay = 1 / (s.period.days * people * share);
    var t = s.nutrition.total;

    var day = {};
    App.NUTRIENTS.forEach(function (n) { day[n.id] = t[n.id] * perDay; });

    // Optionally judge the diet as if enough of it were eaten to meet the calorie target, so the checks
    // reflect what the food is made of rather than how much of a person's food comes from this card.
    var scale = settings.scaleToTarget && day.kcal > 0 ? settings.kcalTarget / day.kcal : 1;
    var per = perDay * scale;
    var nd = {};
    App.NUTRIENTS.forEach(function (n) { nd[n.id] = day[n.id] * scale; });

    var fvGrams = foodSubs(s).filter(function (x) { return x.group === 'fv'; })
      .reduce(function (sum, x) { return sum + x.nutrients.grams; }, 0) * per;
    var juicePerDay = weighted(s, JUICE, 'grams') * per;
    var portions = fvGrams / 80 + Math.min(juicePerDay, 150) / 150; // juice counts as one portion at most
    var freeSugar = weighted(s, FREE_SUGAR, 'sugar') * per;
    var redMeat = weighted(s, RED_MEAT, 'grams') * per;
    var oilyFishWeek = weighted(s, OILY_FISH, 'grams') * per * 7;
    var fatEnergy = t.kcal ? (t.fat * 9) / t.kcal * 100 : 0;

    var src = function (field) { return topSources(s, function (x) { return x.nutrients[field]; }); };
    var srcMap = function (map, field) { return topSources(s, function (x) { return (map[x.id] || 0) * x.nutrients[field]; }); };
    // Wraps a source list in text, or drops it when a short period has no sources to name.
    var phrase = function (before, list, after) { return list ? before + list + after : ''; };

    var checks = [
      {
        id: 'kcal', name: 'Energy', kind: 'band', value: day.kcal, target: settings.kcalTarget, unit: 'kcal', dp: 0,
        targetText: 'target ' + settings.kcalTarget.toLocaleString('en-GB') + ' kcal',
        advice: {
          low: 'If most of what this household eats comes from this card, that is less energy than an adult needs. If you also eat out or shop elsewhere, lower the share slider above.',
          high: 'More energy is being bought than the target.' + phrase(' The biggest calorie sources are ', src('kcal'), '.') + ' Some of it may be wasted or shared with guests.',
          good: 'Food bought roughly matches the calorie target.' + phrase(' The biggest calorie sources are ', src('kcal'), '.')
        }
      },
      {
        id: 'protein', name: 'Protein', kind: 'min', value: nd.protein, target: 50, unit: 'g', dp: 0,
        advice: {
          low: 'Add eggs, beans, lentils, fish, Greek yoghurt or lean meat to more meals.',
          good: 'Plenty of protein' + phrase(', mostly from ', src('protein'), '') + '.'
        }
      },
      {
        id: 'fibre', name: 'Fibre', kind: 'min', value: nd.fibre, target: 30, unit: 'g', dp: 0,
        advice: {
          low: phrase('Fibre currently comes mostly from ', src('fibre'), '. ') + 'Swapping white rice, pasta and bread for wholegrain versions, and adding beans, lentils, veg and fruit, would close the gap.',
          good: 'Fibre intake looks good' + phrase(', mostly from ', src('fibre'), '') + '.'
        }
      },
      {
        id: 'fv', name: 'Fruit & veg', kind: 'min', value: portions, target: 5, unit: 'portions', dp: 1,
        targetText: 'aim for at least 5 a day',
        advice: {
          low: 'About ' + portions.toFixed(1) + ' portions (80g each) a day. Frozen veg, tinned tomatoes, beans and fruit for snacks are cheap ways to add more. Juice only ever counts as one portion.',
          good: 'Enough fruit and veg to reach 5 a day.'
        }
      },
      {
        id: 'fish', name: 'Oily fish', kind: 'min', value: oilyFishWeek, target: 140, unit: 'g/week', dp: 0,
        targetText: 'aim for at least 1 portion (140g) a week',
        advice: {
          low: 'Aim for one portion of oily fish a week, e.g. salmon, mackerel, sardines or trout. Tinned fish is a cheap option.',
          good: 'Salmon purchases cover the one-portion-a-week guideline for oily fish.'
        }
      },
      {
        id: 'redmeat', name: 'Red & processed meat', kind: 'max', value: redMeat, target: 70, unit: 'g', dp: 0,
        targetText: 'keep to 70g a day or less',
        advice: {
          high: 'UK advice is to keep red and processed meat to 70g a day. Swapping some mince for chicken, fish, or lentils and beans in chilli or bolognese would bring this down.',
          good: 'Red and processed meat is within the UK guideline.'
        }
      },
      {
        id: 'sugar', name: 'Free sugars', kind: 'max', value: freeSugar, target: 30, unit: 'g', dp: 0,
        targetText: 'keep to 30g a day or less',
        advice: {
          high: phrase('Mostly from ', srcMap(FREE_SUGAR, 'sugar'), '. ') + 'Sugar-free drinks or water, and smaller amounts of sweet sauces and spreads, would cut this the most.',
          good: 'Added and free sugars are within the 30g daily limit.'
        }
      },
      {
        id: 'salt', name: 'Salt', kind: 'max', value: nd.salt, target: 6, unit: 'g', dp: 1,
        targetText: 'keep to 6g a day or less',
        advice: {
          high: phrase('Mostly from ', src('salt'), '. ') + 'This counts every gram bought, including table salt that may not all be eaten, but it is worth using salty sauces more sparingly.',
          good: 'Salt is within the 6g daily limit.'
        }
      },
      {
        id: 'fat', name: 'Fat (share of energy)', kind: 'max', value: fatEnergy, target: 35, unit: '% of kcal', dp: 0,
        targetText: 'keep to 35% of energy or less',
        advice: {
          high: 'More than 35% of calories come from fat' + phrase(', mostly from ', src('fat'), '') + '. Leaner mince, less mayo and measuring cooking oil would help.',
          good: 'Fat is a reasonable share of total calories.'
        }
      },
      {
        id: 'calcium', name: 'Calcium', kind: 'min', value: nd.calcium, target: 700, unit: 'mg', dp: 0,
        advice: {
          low: 'Milk, yoghurt, cheese, calcium-fortified plant milks, tinned fish with bones and white bread all add calcium.',
          good: 'Enough calcium' + phrase(', mostly from ', src('calcium'), '') + '.'
        }
      },
      {
        id: 'iron', name: 'Iron', kind: 'min', value: nd.iron, target: settings.ironTarget || 14.8, unit: 'mg', dp: 1,
        targetText: settings.ironTarget
          ? 'at least ' + settings.ironTarget + 'mg a day for you'
          : 'at least 14.8mg (women 19–50); men need 8.7mg',
        advice: {
          low: phrase('Iron mostly comes from ', src('iron'), ' at the moment. ') + 'Fortified cereals, beans, lentils, dark green veg and red meat help, and vitamin C at the same meal improves absorption.' +
            (settings.ironTarget ? '' : ' Men need less (8.7mg), so check against who is eating.'),
          good: 'Enough iron' + phrase(', mostly from ', src('iron'), '') + '.'
        }
      },
      {
        id: 'vitc', name: 'Vitamin C', kind: 'min', value: nd.vitc, target: 40, unit: 'mg', dp: 0,
        advice: {
          low: 'Peppers, citrus fruit, berries, kiwi, broccoli and tomatoes are good sources.',
          good: 'Enough vitamin C' + phrase(', mostly from ', src('vitc'), '') + '.'
        }
      }
    ];

    var order = { critical: 0, warning: 1, good: 2 };
    checks.forEach(function (c) {
      c.status = status(c.kind, c.value, c.target);
      c.text = c.advice[c.status.dir || 'good'];
      if (!c.targetText) c.targetText = (c.kind === 'min' ? 'at least ' : 'up to ') + c.target + ' ' + c.unit + ' a day';
    });
    checks.sort(function (a, b) { return order[a.status.level] - order[b.status.level]; });

    // Average daily calories per person in each two-week stretch (the last stretch may be shorter).
    var DAY = 86400000;
    var fortnights = s.period.fortnights.map(function (f) {
      var span = Math.min(14, Math.floor((s.period.last - f.start) / DAY) + 1);
      var days = Math.max(0, Math.round(span - (f.awayDays || 0)));  // days not in a left-out period
      return {
        start: f.start,
        end: f.end,
        days: days,
        awayDays: Math.round(f.awayDays || 0),
        away: days < 1,
        spend: f.foodSpend,
        kcalPerDay: days < 1 ? null : f.kcal / (days * people * share)
      };
    });

    return { day: day, checks: checks, people: people, share: share, scale: scale, fortnights: fortnights };
  }

  var SETTINGS_KEY = 'tesco-diet';
  var DEFAULTS = {
    people: 1, share: 1, kcalTarget: 2000, scaleToTarget: true,
    profile: { height: null, weight: null, sex: '', age: null, activity: 1.375 }
  };

  var ACTIVITY = [
    { factor: 1.2,   name: 'Sedentary', blurb: 'little exercise' },
    { factor: 1.375, name: 'Lightly active', blurb: '1–3 days/week' },
    { factor: 1.55,  name: 'Moderately active', blurb: '3–5 days/week' },
    { factor: 1.725, name: 'Very active', blurb: '6–7 days/week' },
    { factor: 1.9,   name: 'Extra active', blurb: 'physical job' }
  ];

  // Basal metabolic rate (kcal/day at rest) using the Mifflin-St Jeor equation.
  function bmr(p) {
    return 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'male' ? 5 : -161);
  }

  // Returns null when the details are complete and sensible, otherwise a short reason.
  function profileProblem(p) {
    if (!p || !p.height || !p.weight || !p.age || !p.sex) return 'incomplete';
    if (p.height < 120 || p.height > 230) return 'Height should be between 120 and 230 cm.';
    if (p.weight < 30 || p.weight > 300) return 'Weight should be between 30 and 300 kg.';
    if (p.age < 18 || p.age > 100) return 'The calculator is for adults aged 18 to 100.';
    return null;
  }

  // The settings actually used: with one person and complete details, the calorie target comes from
  // their BMR × activity level and the iron target from their sex and age; otherwise the manual target.
  function resolve(settings) {
    var out = Object.assign({}, settings, { targetSource: 'manual', bmr: null, ironTarget: null });
    var p = settings.profile;
    if (settings.people === 1 && !profileProblem(p)) {
      out.bmr = bmr(p);
      out.kcalTarget = Math.round(out.bmr * (p.activity || 1.375) / 10) * 10;
      out.targetSource = 'personal';
      out.ironTarget = p.sex === 'female' && p.age <= 50 ? 14.8 : 8.7;
    }
    return out;
  }

  function loadSettings() {
    var out = Object.assign({}, DEFAULTS);
    try { Object.assign(out, JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null')); } catch (e) { /* storage unavailable */ }
    out.profile = Object.assign({}, DEFAULTS.profile, out.profile);
    return out;
  }

  function saveSettings(settings) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* storage unavailable */ }
  }

  App.Diet = {
    assess: assess, loadSettings: loadSettings, saveSettings: saveSettings,
    resolve: resolve, bmr: bmr, profileProblem: profileProblem, ACTIVITY: ACTIVITY
  };
})(window.App);
