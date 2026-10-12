// "About you" survey: one question at a time, with follow-up questions only when they apply.
(function (App) {
  'use strict';

  var UI = App.UI, $ = UI.$, esc = UI.esc, gbp = UI.gbp;
  var S = App.Survey;
  var answers = S.load();
  var periods = [];   // quiet periods found in the loaded file
  var current = 0;    // index into STEPS
  var editing = null; // step id being changed from the summary, to return there afterwards

  function num(v) { var n = parseInt(v, 10); return isFinite(n) ? n : null; }

  function choiceList(name, options, value) {
    return '<div class="choices" role="radiogroup">' + options.map(function (o) {
      return '<label class="choice' + (value === o.id ? ' selected' : '') + '">' +
        '<input type="radio" name="' + name + '" value="' + o.id + '"' + (value === o.id ? ' checked' : '') + '>' +
        '<span>' + esc(o.name) + (o.note ? '<small>' + esc(o.note) + '</small>' : '') + '</span></label>';
    }).join('') + '</div>';
  }

  function numberField(id, label, value, min, max) {
    return '<label class="field number-field"><span>' + esc(label) + '</span>' +
      '<input type="number" id="' + id + '" min="' + min + '" max="' + max + '" step="1" inputmode="numeric" value="' + (value == null ? '' : value) + '"></label>';
  }

  function radioValue(name) {
    var r = document.querySelector('input[name="' + name + '"]:checked');
    return r ? r.value : null;
  }

  var YES_NO = [{ id: 'yes', name: 'Yes' }, { id: 'no', name: 'No' }];

  var STEPS = [
    {
      id: 'livesAlone',
      title: 'Do you live alone?',
      help: '',
      choice: true,
      render: function () { return choiceList('livesAlone', YES_NO, answers.livesAlone); },
      read: function () {
        var v = radioValue('livesAlone');
        if (!v) return 'Choose yes or no.';
        answers.livesAlone = v;
        if (v === 'yes') answers.hasChildren = null;
      },
      summary: function () { return answers.livesAlone === 'yes' ? 'Yes' : 'No'; }
    },
    {
      id: 'livesWith',
      title: 'How many people do you live with, not counting you?',
      help: 'Include everyone in your home: partners, flatmates, family and children.',
      show: function () { return answers.livesAlone === 'no'; },
      render: function () { return numberField('in-lives-with', 'Number of other people', answers.livesWith || 1, 1, 15); },
      read: function () {
        var n = num($('in-lives-with').value);
        if (n == null || n < 1 || n > 15) return 'Enter a number from 1 to 15.';
        answers.livesWith = n;
      },
      summary: function () { return answers.livesWith + (answers.livesWith === 1 ? ' other person' : ' other people'); }
    },
    {
      id: 'hasChildren',
      title: 'Do any children live with you?',
      help: 'Anyone under 18. Children need less energy than adults, so this makes the household target more accurate.',
      show: function () { return answers.livesAlone === 'no'; },
      choice: true,
      render: function () { return choiceList('hasChildren', YES_NO, answers.hasChildren); },
      read: function () {
        var v = radioValue('hasChildren');
        if (!v) return 'Choose yes or no.';
        answers.hasChildren = v;
      },
      summary: function () { return answers.hasChildren === 'yes' ? 'Yes' : 'No'; }
    },
    {
      id: 'children',
      title: 'How many children are in each age group?',
      help: 'Leave a box at 0 if no children are that age.',
      show: function () { return answers.livesAlone === 'no' && answers.hasChildren === 'yes'; },
      render: function () {
        return '<div class="number-row">' + S.CHILD_BANDS.map(function (b) {
          return numberField('in-kids-' + b.id, b.name, answers.children[b.id] || 0, 0, 15);
        }).join('') + '</div>';
      },
      read: function () {
        var total = 0, vals = {};
        for (var i = 0; i < S.CHILD_BANDS.length; i++) {
          var b = S.CHILD_BANDS[i];
          var n = num($('in-kids-' + b.id).value);
          if (n == null || n < 0) return 'Enter 0 or more in each box.';
          vals[b.id] = n;
          total += n;
        }
        if (total < 1) return 'Enter at least one child, or go back and answer “No”.';
        if (total > answers.livesWith) return 'That’s more children than the ' + answers.livesWith + ' people you said you live with.';
        answers.children = vals;
      },
      summary: function () {
        return S.CHILD_BANDS.filter(function (b) { return answers.children[b.id]; })
          .map(function (b) { return answers.children[b.id] + ' aged ' + b.name.toLowerCase(); }).join(', ');
      }
    },
    {
      id: 'shopFor',
      title: 'How many people do you buy food for on this Tesco card?',
      help: '',
      render: function () {
        var size = S.householdSize(answers);
        this.help = 'Include yourself. ' + (size > 1
          ? 'If the shopping feeds everyone you live with, that’s ' + size + '.'
          : 'If it’s only for you, that’s 1.');
        $('q-help').textContent = this.help;
        return numberField('in-shop-for', 'Number of people, including you', answers.shopFor || size, 1, 20);
      },
      read: function () {
        var n = num($('in-shop-for').value);
        if (n == null || n < 1 || n > 20) return 'Enter a number from 1 to 20.';
        answers.shopFor = n;
      },
      summary: function () { return answers.shopFor === 1 ? 'Just me' : answers.shopFor + ' people'; }
    },
    {
      id: 'share',
      title: 'Roughly how much of your food comes from your Tesco shopping?',
      help: 'Think about everything you eat: other shops, eating out, takeaways and meals at work or school.',
      choice: true,
      render: function () { return choiceList('share', S.SHARE, answers.share); },
      read: function () {
        var v = radioValue('share');
        if (!v) return 'Choose one option.';
        answers.share = v;
      },
      summary: function () {
        var o = S.SHARE.filter(function (x) { return x.id === answers.share; })[0];
        return o ? o.name : '';
      }
    },
    {
      id: 'awayTimes',
      title: 'Are there times when you don’t buy your own food?',
      help: 'For example as a student living at your family home in the holidays, staying with a partner, or travelling. During those times there’s not enough shopping data for an accurate diet check, so they can be left out.',
      render: function () {
        var html = choiceList('awayTimes', [
          { id: 'yes', name: 'Yes, sometimes' },
          { id: 'no', name: 'No, I always buy my own food' },
          { id: 'unsure', name: 'Not sure' }
        ], answers.awayTimes);
        if (periods.length) {
          html += '<div class="detected"><p><strong>Quiet periods in your file.</strong> Food shopping dropped far below your usual level at these times. ' +
            'Tick the ones when you weren’t buying your own food; they’ll be left out of the diet check.</p><ul class="away-list">' +
            periods.map(function (p) {
              var on = S.isExcluded(answers, p.id);
              return '<li><label class="away-item"><input type="checkbox" class="away-box" data-id="' + p.id + '"' + (on ? ' checked' : '') + '>' +
                '<span><strong>' + esc(p.label) + '</strong>: ' + esc(p.text) +
                ' <span class="muted-text">(' + p.days + ' days, ' + gbp(p.spend) + ' of food)</span></span></label></li>';
            }).join('') + '</ul></div>';
        } else {
          html += '<p class="muted detected">Load your Tesco file and the site will spot quiet periods automatically, so you can choose which to leave out.</p>';
        }
        return html;
      },
      read: function () {
        var v = radioValue('awayTimes');
        if (!v) return 'Choose one option.';
        answers.awayTimes = v;
        Array.prototype.forEach.call(document.querySelectorAll('.away-box'), function (b) {
          answers.away[b.getAttribute('data-id')] = b.checked;
        });
      },
      summary: function () {
        var label = { yes: 'Yes, sometimes', no: 'No', unsure: 'Not sure' }[answers.awayTimes] || '';
        var left = periods.filter(function (p) { return S.isExcluded(answers, p.id); });
        return label + (periods.length ? ' · ' + (left.length ? left.length + ' quiet period' + (left.length === 1 ? '' : 's') + ' left out' : 'no quiet periods left out') : '');
      }
    },
    {
      id: 'profile',
      title: 'About you (optional)',
      help: 'Used to work out your own daily calorie need: your basal metabolic rate (Mifflin-St Jeor) times how active you are. Skip this to use the standard 2,000 kcal.',
      optional: true,
      render: function () {
        var p = answers.profile;
        return '<div class="personal-grid">' +
          '<label class="field"><span>Sex</span><select id="in-sex"><option value="">Choose…</option>' +
            '<option value="female"' + (p.sex === 'female' ? ' selected' : '') + '>Female</option>' +
            '<option value="male"' + (p.sex === 'male' ? ' selected' : '') + '>Male</option></select></label>' +
          numberField('in-age', 'Age', p.age, 18, 100) +
          numberField('in-height', 'Height (cm)', p.height, 120, 230) +
          '<label class="field"><span>Weight (kg)</span><input type="number" id="in-weight" min="30" max="300" step="0.1" inputmode="decimal" value="' + (p.weight || '') + '"></label>' +
          '<label class="field field-wide"><span>Activity level</span><select id="in-activity">' +
            App.Diet.ACTIVITY.map(function (a) {
              return '<option value="' + a.factor + '"' + (a.factor === (p.activity || 1.375) ? ' selected' : '') + '>' + esc(a.name) + ' (' + esc(a.blurb) + ')</option>';
            }).join('') + '</select></label></div>';
      },
      read: function () {
        var p = {
          sex: $('in-sex').value,
          age: num($('in-age').value),
          height: num($('in-height').value),
          weight: parseFloat($('in-weight').value) || null,
          activity: parseFloat($('in-activity').value) || 1.375
        };
        var anything = p.sex || p.age || p.height || p.weight;
        if (anything) {
          var problem = App.Diet.profileProblem(p);
          if (problem === 'incomplete') return 'Fill in all four details, or choose “Skip this question”.';
          if (problem) return problem;
        }
        answers.profile = p;
      },
      skip: function () { answers.profile = S.blank().profile; },
      summary: function () {
        var p = answers.profile;
        if (App.Diet.profileProblem(p)) return 'Skipped (standard 2,000 kcal)';
        return (p.sex === 'female' ? 'Female' : 'Male') + ', ' + p.age + ', ' + p.height + ' cm, ' + p.weight + ' kg';
      }
    }
  ];

  function visibleSteps() {
    return STEPS.filter(function (s) { return !s.show || s.show(); });
  }

  // ---------- Rendering ----------

  function showStep(i) {
    current = i;
    var step = STEPS[i];
    var vis = visibleSteps();
    var pos = vis.indexOf(step);
    $('survey-card').hidden = false;
    $('summary-card').hidden = true;
    $('q-step').textContent = 'Question ' + (pos + 1) + ' of ' + vis.length;
    $('progress-bar').style.width = ((pos) / vis.length * 100) + '%';
    $('q-title').textContent = step.title;
    $('q-help').textContent = step.help || '';
    $('q-body').innerHTML = step.render.call(step);
    $('q-error').hidden = true;
    $('q-back').hidden = pos === 0 && !editing;
    $('q-back').textContent = editing ? 'Cancel' : 'Back';
    $('q-skip').hidden = !step.optional;
    $('q-next').textContent = editing ? 'Save' : (pos === vis.length - 1 ? 'Finish' : 'Next');
    var first = $('q-body').querySelector('input:checked, input, select');
    if (first && document.activeElement && document.activeElement !== document.body) first.focus();
  }

  function nextIndex(from) {
    for (var i = from + 1; i < STEPS.length; i++) if (!STEPS[i].show || STEPS[i].show()) return i;
    return -1;
  }

  function prevIndex(from) {
    for (var i = from - 1; i >= 0; i--) if (!STEPS[i].show || STEPS[i].show()) return i;
    return -1;
  }

  function advance() {
    var err = STEPS[current].read();
    if (err) {
      $('q-error').textContent = err;
      $('q-error').hidden = false;
      return;
    }
    S.save(answers);
    if (editing) {
      // A changed answer can reveal follow-up questions that still need answering.
      var gap = firstUnanswered();
      editing = null;
      if (gap !== -1) { showStep(gap); return; }
      finish();
      return;
    }
    var n = nextIndex(current);
    if (n === -1) finish(); else showStep(n);
  }

  function firstUnanswered() {
    for (var i = 0; i < STEPS.length; i++) {
      var s = STEPS[i];
      if (s.show && !s.show()) continue;
      if (s.id === 'livesAlone' && !answers.livesAlone) return i;
      if (s.id === 'hasChildren' && !answers.hasChildren) return i;
      if (s.id === 'children' && !S.childCount(answers)) return i;
      if (s.id === 'shopFor' && !answers.shopFor) return i;
      if (s.id === 'share' && !answers.share) return i;
      if (s.id === 'awayTimes' && !answers.awayTimes) return i;
    }
    return -1;
  }

  function finish() {
    answers.completed = true;
    S.save(answers);
    renderSummary();
  }

  function renderSummary() {
    $('survey-card').hidden = true;
    $('summary-card').hidden = false;
    var st = S.settings();
    $('summary-result').innerHTML = st.people === 1
      ? 'The diet check will assess food for <strong>just you</strong>, with a daily target of <strong>' + st.kcalTarget.toLocaleString('en-GB') + ' kcal</strong>' +
        (st.targetSource === 'personal' ? ' from your details.' : ' (standard adult).')
      : 'The diet check will assess food for <strong>' + st.people + ' people</strong> (' + esc(st.householdText) + '), with a household target of <strong>' +
        st.householdTarget.toLocaleString('en-GB') + ' kcal a day</strong>, about ' + st.kcalTarget.toLocaleString('en-GB') + ' per person.';
    $('answer-list').innerHTML = STEPS.filter(function (s) { return !s.show || s.show(); }).map(function (s) {
      return '<div class="answer-row"><dt>' + esc(s.title) + '</dt><dd>' + esc(s.summary() || '–') +
        ' <button type="button" class="link-btn" data-edit="' + s.id + '">Change</button></dd></div>';
    }).join('');
  }

  // ---------- Events ----------

  $('q-form').addEventListener('submit', function (e) { e.preventDefault(); advance(); });

  // Single-choice questions move on as soon as an answer is picked.
  $('q-body').addEventListener('change', function (e) {
    if (e.target.type !== 'radio') return;
    Array.prototype.forEach.call(document.querySelectorAll('.choice'), function (c) {
      c.classList.toggle('selected', c.querySelector('input').checked);
    });
    $('q-error').hidden = true;
    if (STEPS[current].choice) setTimeout(advance, 180);
  });

  $('q-back').addEventListener('click', function () {
    if (editing) { editing = null; renderSummary(); return; }
    var p = prevIndex(current);
    if (p !== -1) showStep(p);
  });

  $('q-skip').addEventListener('click', function () {
    var step = STEPS[current];
    if (step.skip) step.skip();
    S.save(answers);
    if (editing) { editing = null; finish(); return; }
    var n = nextIndex(current);
    if (n === -1) finish(); else showStep(n);
  });

  $('answer-list').addEventListener('click', function (e) {
    var b = e.target.closest('[data-edit]');
    if (!b) return;
    var id = b.getAttribute('data-edit');
    editing = id;
    showStep(STEPS.findIndex(function (s) { return s.id === id; }));
  });

  $('restart').addEventListener('click', function () {
    var keepAway = answers.away;
    answers = S.blank();
    answers.away = keepAway;
    S.save(answers);
    editing = null;
    showStep(0);
  });

  App.Site.init(function (s, ctx) {
    periods = App.Away.detect(ctx.parsed);
    if (answers.completed && firstUnanswered() === -1) renderSummary();
    else showStep(Math.max(0, firstUnanswered()));
  }, { dataOptional: true });
})(window.App);
