// Estimates the weight bought for each line and the nutrients that weight contains.
(function (App) {
  'use strict';

  var UNIT_GRAMS = { kg: 1000, g: 1, l: 1000, litre: 1000, litres: 1000, ml: 1 };

  // Grams (or ml) in ONE of the item as named, or null if the name gives no size.
  function packGrams(name, unitGrams) {
    var m = name.match(/(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|l)(?![a-z])/i);
    if (m) return Number(m[1]) * Number(m[2]) * UNIT_GRAMS[m[3].toLowerCase()];

    m = name.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l|litres?)(?![a-z])/i);
    if (m) return Number(m[1]) * UNIT_GRAMS[m[2].toLowerCase()];

    if (unitGrams) {
      if (/twin\s*pack/i.test(name)) return 2 * unitGrams;
      m = name.match(/(\d+)\s*-?\s*pack/i);
      if (m) return Number(m[1]) * unitGrams;
      return unitGrams; // "Each", or a single unnamed unit
    }
    return null;
  }

  function estimateGrams(line, cls) {
    var sub = App.SUBS[cls.sub];
    // Loose items sold by weight carry the actual weight (kg) for the whole line.
    if (line.weightKg > 0) return { grams: line.weightKg * 1000, estimated: false };
    var each = packGrams(line.name, cls.unit);
    if (each != null) return { grams: each * line.quantity, estimated: false };
    return { grams: (sub.def || 0) * line.quantity, estimated: true };
  }

  // A bulk buy keeps for at least a month and holds at least two weeks of servings
  // (at one serving per person per day), e.g. 2kg of rice or a big jar of honey.
  var BULK_MIN_SHELF_DAYS = 30;
  var BULK_MIN_DAYS_OF_SERVINGS = 14;

  // servingsPerDay: how many servings get eaten per day (one per person), used for how long it lasts.
  function nutrientsFor(line, cls, servingsPerDay) {
    var sub = cls.sub && App.SUBS[cls.sub];
    if (!sub || !sub.n) return null;
    var w = estimateGrams(line, cls);
    var f = w.grams / 100;
    var shelf = App.SHELF[cls.sub] || [7, 100];
    var servings = w.grams / shelf[1];
    var servingDays = servings / Math.max(1, servingsPerDay || 1);
    var out = {
      grams: w.grams,
      sizeGuessed: w.estimated,
      servings: servings,
      shelfDays: shelf[0],
      lastsDays: Math.max(1, Math.min(shelf[0], servingDays)), // how long until it's eaten or goes off
      bulk: shelf[0] >= BULK_MIN_SHELF_DAYS && servingDays >= BULK_MIN_DAYS_OF_SERVINGS
    };
    var per100 = sub.n.concat(App.MICRO[cls.sub] || [0, 0, 0]);
    App.NUTRIENTS.forEach(function (nu, i) { out[nu.id] = (per100[i] || 0) * f; });
    return out;
  }

  App.Nutrition = {
    nutrientsFor: nutrientsFor,
    packGrams: packGrams,
    BULK_MIN_SHELF_DAYS: BULK_MIN_SHELF_DAYS,
    BULK_MIN_DAYS_OF_SERVINGS: BULK_MIN_DAYS_OF_SERVINGS
  };
})(window.App);
