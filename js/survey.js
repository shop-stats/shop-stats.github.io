// The "About you" survey: stores the answers and turns them into the settings the Diet check uses
// (how many people the food feeds, their calorie needs, how much food comes from Tesco, and which
// quiet periods to leave out). Answers are kept in this browser only.
(function (App) {
  'use strict';

  var KEY = 'tesco-survey';

  var SHARE = [
    { id: 'nearly-all', name: 'Nearly all of it', phrase: 'nearly all', value: 0.95 },
    { id: 'most', name: 'Most of it', phrase: 'most', value: 0.75 },
    { id: 'half', name: 'About half', phrase: 'about half', value: 0.5 },
    { id: 'less', name: 'Less than half', phrase: 'less than half', value: 0.3 }
  ];

  // Typical daily energy needs (kcal) used for people other than you. Adults use the UK reference intake;
  // children use rounded averages of UK estimated requirements for each age band.
  var NEEDS = { adult: 2000, u5: 1200, c5to10: 1700, c11to17: 2300 };
  var CHILD_BANDS = [
    { id: 'u5', name: 'Under 5' },
    { id: 'c5to10', name: '5 to 10' },
    { id: 'c11to17', name: '11 to 17' }
  ];

  function blank() {
    return {
      completed: false,
      livesAlone: null,
      livesWith: 1,
      hasChildren: null,
      children: { u5: 0, c5to10: 0, c11to17: 0 },
      shopFor: null,
      share: null,
      awayTimes: null,
      away: {},
      profile: { height: null, weight: null, sex: '', age: null, activity: 1.375 }
    };
  }

  function load() {
    var a = blank();
    try {
      var saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved) {
        Object.assign(a, saved);
        a.children = Object.assign(blank().children, saved.children);
        a.profile = Object.assign(blank().profile, saved.profile);
        a.away = saved.away || {};
      } else {
        // Carry over details entered on the old Diet check form, if any.
        var old = JSON.parse(localStorage.getItem('tesco-diet') || 'null');
        if (old && old.profile) a.profile = Object.assign(a.profile, old.profile);
      }
    } catch (e) { /* storage unavailable */ }
    return a;
  }

  function save(a) {
    a.updatedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) { /* storage unavailable */ }
  }

  function householdSize(a) {
    return a.livesAlone === 'no' ? 1 + Math.max(1, +a.livesWith || 1) : 1;
  }

  function childCount(a) {
    if (a.livesAlone !== 'no' || a.hasChildren !== 'yes') return 0;
    return CHILD_BANDS.reduce(function (t, b) { return t + (+a.children[b.id] || 0); }, 0);
  }

  // Whether a detected quiet period is left out of the Diet check.
  function isExcluded(a, periodId) {
    if (a.away && Object.prototype.hasOwnProperty.call(a.away, periodId)) return !!a.away[periodId];
    return a.awayTimes !== 'no'; // left out by default unless the person said they always buy their own food
  }

  function list(xs) {
    return xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];
  }

  // Settings for App.Diet.assess, plus a description of the household.
  function settings() {
    var a = load();
    var diet = App.Diet.loadSettings();
    var people = Math.max(1, Math.min(50, +a.shopFor || householdSize(a)));

    // Children are counted first among the people shopped for (you are always one of them).
    var kids = { u5: 0, c5to10: 0, c11to17: 0 };
    var room = people - 1;
    if (a.livesAlone === 'no' && a.hasChildren === 'yes') {
      CHILD_BANDS.forEach(function (b) {
        var n = Math.min(room, Math.max(0, +a.children[b.id] || 0));
        kids[b.id] = n;
        room -= n;
      });
    }
    var kidTotal = kids.u5 + kids.c5to10 + kids.c11to17;
    var adults = people - kidTotal;

    var p = a.profile;
    var personal = !App.Diet.profileProblem(p);
    var bmr = personal ? App.Diet.bmr(p) : null;
    var you = personal ? Math.round(bmr * (p.activity || 1.375) / 10) * 10 : NEEDS.adult;
    var total = you + (adults - 1) * NEEDS.adult + kids.u5 * NEEDS.u5 + kids.c5to10 * NEEDS.c5to10 + kids.c11to17 * NEEDS.c11to17;

    var shareOpt = SHARE.filter(function (s) { return s.id === a.share; })[0];

    var parts = [];
    parts.push(adults === 1 ? '1 adult' : adults + ' adults');
    CHILD_BANDS.forEach(function (b) {
      if (kids[b.id]) parts.push(kids[b.id] + ' child' + (kids[b.id] === 1 ? '' : 'ren') + ' aged ' + b.name.toLowerCase());
    });

    return {
      answered: !!a.completed,
      people: people,
      share: shareOpt ? shareOpt.value : 1,
      shareName: shareOpt ? shareOpt.phrase : null,
      kcalTarget: Math.round(total / people / 10) * 10, // average per person, for the per-person figures
      householdTarget: total,
      yourTarget: you,
      targetSource: personal ? 'personal' : 'standard',
      bmr: bmr,
      ironTarget: people === 1 && personal ? (p.sex === 'female' && p.age <= 50 ? 14.8 : 8.7) : null,
      scaleToTarget: diet.scaleToTarget,
      profile: p,
      adults: adults,
      kids: kids,
      householdText: list(parts),
      answers: a
    };
  }

  App.Survey = {
    load: load, save: save, blank: blank, settings: settings, isExcluded: isExcluded,
    householdSize: householdSize, childCount: childCount,
    SHARE: SHARE, NEEDS: NEEDS, CHILD_BANDS: CHILD_BANDS
  };
})(window.App);
