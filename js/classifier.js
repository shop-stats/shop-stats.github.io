// Assigns each product name a sub-category, food group and item type using App.RULES.
(function (App) {
  'use strict';

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Whole-word match that also works for keywords ending in punctuation ("yo!", "f&f").
  var compiled = App.RULES.map(function (rule) {
    var alts = rule[0].map(escapeRe).join('|');
    return {
      re: new RegExp('(?:^|[^a-z0-9])(?:' + alts + ')(?![a-z0-9])', 'i'),
      sub: rule[1],
      opts: rule[2] || {}
    };
  });

  function classify(name) {
    var text = name.toLowerCase();
    for (var i = 0; i < compiled.length; i++) {
      var r = compiled[i];
      if (r.re.test(text)) {
        var sub = App.SUBS[r.sub];
        if (!sub) break;
        return {
          sub: r.sub,
          subName: sub.name,
          group: sub.group,
          type: sub.group === 'nonfood' ? null : (r.opts.type || sub.type),
          unit: r.opts.unit || sub.unit,
          matched: true
        };
      }
    }
    return { sub: null, subName: 'Unclassified', group: 'unclassified', type: null, matched: false };
  }

  App.Classifier = { classify: classify };
})(window.App);
