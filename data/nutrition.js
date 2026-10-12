// Sub-categories: food group, default item type and typical nutrition per 100g (or 100ml).
// Values are rounded UK supermarket averages for that kind of product, not exact label values.
//   n    = [kcal, protein g, carbs g, sugars g, fat g, fibre g, salt g] per 100g/ml
//   unit = grams per counted unit (eggs, avocados, wraps...) when the name gives a count but no weight
//   def  = grams to assume when the name gives no size at all
window.App = window.App || {};

App.NUTRIENTS = [
  { id: 'kcal',    name: 'Energy',   unit: 'kcal', ri: 2000 },
  { id: 'protein', name: 'Protein',  unit: 'g',    ri: 50 },
  { id: 'carbs',   name: 'Carbs',    unit: 'g',    ri: 260 },
  { id: 'sugar',   name: 'Sugars',   unit: 'g',    ri: 90 },
  { id: 'fat',     name: 'Fat',      unit: 'g',    ri: 70 },
  { id: 'fibre',   name: 'Fibre',    unit: 'g',    ri: 30 },
  { id: 'salt',    name: 'Salt',     unit: 'g',    ri: 6 },
  { id: 'calcium', name: 'Calcium',  unit: 'mg',   ri: 800 },
  { id: 'iron',    name: 'Iron',     unit: 'mg',   ri: 14 },
  { id: 'vitc',    name: 'Vitamin C', unit: 'mg',  ri: 80 }
];

// Shelf life and serving size: [days it keeps once bought (opened or stored as usual), typical serving g/ml].
// Used to count servings per purchase, estimate how long a purchase lasts and spot bulk buys.
App.SHELF = {
  avocado: [5, 85],      fruit: [7, 100],        citrus: [21, 30],       veg: [10, 80],
  salad: [6, 80],        sweet_potato: [21, 150], tinned_tom: [540, 100], olives: [180, 30],
  rice: [730, 75],       pasta: [730, 75],       noodles: [10, 200],     bread: [6, 80],
  bagel: [6, 85],        cereal: [180, 30],      oats: [365, 40],        pastry: [14, 60],
  rice_cakes: [180, 25],
  milk: [7, 200],        cheese: [42, 30],       mozzarella: [5, 60],    soft_cheese: [10, 30],
  cream: [7, 30],        creme_fraiche: [10, 30], skyr: [14, 150],       yoghurt_pot: [14, 115],
  mince_lean: [3, 125],  mince: [3, 125],        mince_fatty: [3, 125],  steak: [3, 175],
  chicken: [3, 150],     bacon: [7, 50],         salmon: [3, 130],       smoked_salmon: [7, 50],
  tinned_salmon: [730, 100], prawns: [3, 80],    seafood_sticks: [7, 60], eggs: [28, 120],
  deli: [5, 40],         peanut_butter: [180, 20],
  oil: [540, 10],        oil_spray: [540, 2],    butter: [60, 10],       jam: [180, 15],
  honey: [730, 15],      ketchup: [180, 15],     soy: [365, 10],         sweet_sauce: [180, 15],
  mayo: [60, 15],        condiment_misc: [365, 10], spices: [730, 2],    salt: [1825, 1],
  stock: [365, 6],       sugar: [730, 5],        coconut_milk: [540, 100], crispy_onions: [180, 10],
  crisps: [90, 30],      chocolate: [270, 35],   ice_cream: [365, 70],   ice_cream_sandwich: [365, 55],
  gum: [365, 3],         crackers: [90, 25],
  soft_sugar: [270, 330], soft_diet: [270, 330], energy: [365, 500],     energy_zero: [365, 500],
  milkshake: [10, 250],  protein_shake: [10, 330], juice: [7, 150],      smoothie: [5, 150],
  coconut_water: [5, 250], squash: [365, 3],     yoghurt_drink: [10, 125],
  gyoza: [180, 120],     bao: [180, 128],        sushi: [2, 300],        sandwich: [2, 180]
};

// Micronutrients per 100g: [calcium mg, iron mg, vitamin C mg]. Sub-categories not listed count as zero.
// UK white flour is fortified, which is why bread carries calcium and iron.
App.MICRO = {
  avocado: [12, 0.4, 6],      fruit: [8, 0.3, 8],          citrus: [26, 0.6, 53],     veg: [25, 0.4, 25],
  salad: [15, 0.3, 12],       sweet_potato: [24, 0.7, 23], tinned_tom: [12, 0.8, 12], olives: [60, 0.9, 0],
  rice: [10, 0.5, 0],         pasta: [21, 1.3, 0],         noodles: [10, 0.5, 0],     bread: [180, 1.6, 0],
  bagel: [100, 2, 0],         cereal: [80, 8, 0],          oats: [50, 3.8, 0],        pastry: [60, 1, 0],
  rice_cakes: [10, 1, 0],
  milk: [120, 0.03, 1],       cheese: [740, 0.3, 0],       mozzarella: [500, 0.3, 0], soft_cheese: [100, 0.1, 0],
  cream: [65, 0.1, 1],        creme_fraiche: [80, 0.1, 0], skyr: [130, 0.1, 0],       yoghurt_pot: [130, 0.1, 1],
  mince_lean: [6, 2.1, 0],    mince: [8, 1.9, 0],          mince_fatty: [9, 1.7, 0],  steak: [5, 2.3, 0],
  chicken: [10, 0.8, 0],      bacon: [7, 0.6, 0],          salmon: [11, 0.3, 0],      smoked_salmon: [11, 0.6, 0],
  tinned_salmon: [200, 0.7, 0], prawns: [60, 0.5, 0],      seafood_sticks: [15, 0.3, 0], eggs: [50, 1.7, 0],
  deli: [10, 1, 0],           peanut_butter: [40, 2, 0],
  oil: [1, 0.4, 0],           butter: [15, 0, 0],          jam: [20, 0.5, 8],         honey: [5, 0.4, 0],
  ketchup: [15, 0.5, 5],      soy: [20, 2, 0],             sweet_sauce: [15, 0.8, 2], mayo: [10, 0.4, 0],
  condiment_misc: [20, 1, 0], spices: [500, 20, 5],        salt: [25, 0.3, 0],        stock: [60, 2, 0],
  coconut_milk: [10, 1, 1],   crispy_onions: [30, 1.5, 0],
  crisps: [30, 1.2, 5],       chocolate: [180, 1.5, 0],    ice_cream: [100, 0.1, 0.5], ice_cream_sandwich: [80, 1.5, 0],
  crackers: [250, 1.5, 0],
  soft_sugar: [3, 0, 0],      soft_diet: [3, 0, 0],        energy: [3, 0, 0],         energy_zero: [3, 0, 0],
  milkshake: [115, 0.1, 0],   protein_shake: [200, 0.5, 0], juice: [10, 0.2, 35],     smoothie: [12, 0.3, 20],
  coconut_water: [20, 0.1, 2], squash: [5, 0, 0],          yoghurt_drink: [110, 0.1, 0],
  gyoza: [25, 1, 1],          bao: [40, 1, 0],             sushi: [15, 0.6, 1],       sandwich: [100, 1.4, 3]
};

App.SUBS = {
  // Non-food: counted in spending, no nutrition.
  nf_home:       { group: 'nonfood', name: 'Home & kitchen' },
  nf_clothing:   { group: 'nonfood', name: 'Clothing' },
  nf_cleaning:   { group: 'nonfood', name: 'Cleaning & household' },
  nf_toiletries: { group: 'nonfood', name: 'Toiletries & beauty' },
  nf_gifts:      { group: 'nonfood', name: 'Gifts, cards & flowers' },
  nf_health:     { group: 'nonfood', name: 'Health & supplements' },

  // Fruit & vegetables
  avocado:      { group: 'fv', type: 'ingredient', name: 'Avocados',        n: [160, 2, 8.5, 0.7, 14.7, 6.7, 0], unit: 170, def: 170 },
  fruit:        { group: 'fv', type: 'snack',      name: 'Fresh fruit',     n: [60, 0.8, 14, 11, 0.2, 2, 0], unit: 150, def: 500 },
  citrus:       { group: 'fv', type: 'ingredient', name: 'Lemons & limes',  n: [29, 1.1, 9, 2.5, 0.3, 2.8, 0], unit: 100, def: 400 },
  veg:          { group: 'fv', type: 'ingredient', name: 'Vegetables',      n: [28, 1.2, 5, 3, 0.3, 2, 0.02], unit: 150, def: 300 },
  salad:        { group: 'fv', type: 'ingredient', name: 'Salad',           n: [16, 0.9, 3, 2.2, 0.2, 1.2, 0.02], unit: 350, def: 250 },
  sweet_potato: { group: 'fv', type: 'ingredient', name: 'Sweet potatoes',  n: [86, 1.6, 20, 4.2, 0.1, 3, 0.1], def: 1000 },
  tinned_tom:   { group: 'fv', type: 'ingredient', name: 'Tinned tomatoes', n: [30, 1.4, 5, 4, 0.2, 1, 0.1], def: 400 },
  olives:       { group: 'fv', type: 'snack',      name: 'Olives',          n: [145, 1, 1, 0, 15, 3, 2.8], def: 130 },

  // Starchy carbs
  rice:       { group: 'starchy', type: 'ingredient', name: 'Rice',         n: [355, 7, 78, 0.3, 0.8, 1.2, 0], def: 500 },
  pasta:      { group: 'starchy', type: 'ingredient', name: 'Pasta',        n: [355, 12.5, 71, 3, 1.5, 3, 0.01], def: 500 },
  noodles:    { group: 'starchy', type: 'ingredient', name: 'Noodles',      n: [140, 3.6, 28, 0.5, 1, 1.3, 0.5], def: 400 },
  bread:      { group: 'starchy', type: 'ingredient', name: 'Bread & wraps', n: [250, 9, 44, 4, 3.5, 4, 1], unit: 62, def: 800 },
  bagel:      { group: 'starchy', type: 'ingredient', name: 'Bagels',       n: [260, 9, 50, 9, 1.5, 3, 0.9], unit: 85, def: 425 },
  cereal:     { group: 'starchy', type: 'ingredient', name: 'Cereal',       n: [380, 9, 74, 18, 3.5, 8, 0.5], def: 375 },
  oats:       { group: 'starchy', type: 'ingredient', name: 'Oats',         n: [375, 11, 60, 1, 8, 9, 0], def: 1000 },
  pastry:     { group: 'starchy', type: 'ingredient', name: 'Pastry',       n: [400, 6, 38, 1.5, 25, 1.5, 0.9], def: 375 },
  rice_cakes: { group: 'starchy', type: 'snack',      name: 'Rice cakes',   n: [390, 8, 81, 0.6, 3, 3, 0.8], def: 130 },

  // Dairy & alternatives
  milk:          { group: 'dairy', type: 'ingredient', name: 'Milk',          n: [64, 3.4, 4.7, 4.7, 3.6, 0, 0.11], def: 2272 },
  cheese:        { group: 'dairy', type: 'ingredient', name: 'Hard cheese',   n: [410, 25, 0.1, 0.1, 34, 0, 1.8], def: 400 },
  mozzarella:    { group: 'dairy', type: 'ingredient', name: 'Mozzarella',    n: [250, 18, 1, 1, 19, 0, 0.5], def: 125 },
  soft_cheese:   { group: 'dairy', type: 'ingredient', name: 'Soft cheese',   n: [230, 5.5, 4, 3.5, 21, 0, 0.7], def: 200 },
  cream:         { group: 'dairy', type: 'ingredient', name: 'Cream',         n: [445, 1.7, 2.6, 2.6, 48, 0, 0.05], def: 300 },
  creme_fraiche: { group: 'dairy', type: 'ingredient', name: 'Crème fraîche', n: [165, 2.8, 4.5, 4, 15, 0, 0.1], def: 300 },
  skyr:          { group: 'dairy', type: 'ingredient', name: 'Skyr',          n: [60, 11, 4, 4, 0.2, 0, 0.1], def: 450 },
  yoghurt_pot:   { group: 'dairy', type: 'snack',      name: 'Yoghurt pots',  n: [85, 4, 12, 11, 2, 0.5, 0.15], def: 480 },

  // Protein
  mince_lean:     { group: 'protein', type: 'ingredient', name: 'Lean beef mince', n: [125, 21.5, 0, 0, 4.5, 0, 0.15], def: 500 },
  mince:          { group: 'protein', type: 'ingredient', name: 'Beef mince',      n: [215, 19, 0, 0, 15.5, 0, 0.15], def: 500 },
  mince_fatty:    { group: 'protein', type: 'ingredient', name: 'Beef mince (20%)', n: [250, 17, 0, 0, 20, 0, 0.15], def: 500 },
  steak:          { group: 'protein', type: 'ingredient', name: 'Steak',           n: [165, 25, 0, 0, 7, 0, 0.15], def: 300 },
  chicken:        { group: 'protein', type: 'ingredient', name: 'Chicken',         n: [150, 19, 0, 0, 8, 0, 0.2], def: 600 },
  bacon:          { group: 'protein', type: 'ingredient', name: 'Bacon',           n: [240, 16, 0.5, 0.5, 19.5, 0, 3], def: 300 },
  salmon:         { group: 'protein', type: 'ingredient', name: 'Salmon',          n: [205, 20, 0, 0, 13.5, 0, 0.15], def: 500 },
  smoked_salmon:  { group: 'protein', type: 'ingredient', name: 'Smoked salmon',   n: [185, 23, 0, 0, 10, 0, 3], def: 120 },
  tinned_salmon:  { group: 'protein', type: 'ingredient', name: 'Tinned salmon',   n: [150, 20, 0, 0, 7.5, 0, 1], def: 418 },
  prawns:         { group: 'protein', type: 'ingredient', name: 'Prawns',          n: [70, 15, 0, 0, 1, 0, 1.5], def: 250 },
  seafood_sticks: { group: 'protein', type: 'snack',      name: 'Seafood sticks',  n: [100, 7, 15, 4.5, 0.5, 0, 1.8], def: 250 },
  eggs:           { group: 'protein', type: 'ingredient', name: 'Eggs',            n: [140, 13, 0.2, 0.2, 10, 0, 0.4], unit: 60, def: 360 },
  deli:           { group: 'protein', type: 'ingredient', name: 'Sliced deli meat', n: [140, 22, 1.5, 1, 5, 0, 2], def: 120 },
  peanut_butter:  { group: 'protein', type: 'ingredient', name: 'Peanut butter',   n: [600, 25, 13, 6, 50, 6, 0.6], def: 340 },

  // Oils, spreads & condiments
  oil:            { group: 'oils', type: 'ingredient', name: 'Cooking oil',       n: [825, 0, 0, 0, 91.6, 0, 0], def: 500 },
  oil_spray:      { group: 'oils', type: 'ingredient', name: 'Oil spray',         n: [480, 0, 0, 0, 53, 0, 0], def: 190 },
  butter:         { group: 'oils', type: 'ingredient', name: 'Butter',            n: [740, 0.6, 0.6, 0.6, 82, 0, 1.6], def: 250 },
  jam:            { group: 'oils', type: 'ingredient', name: 'Jam',               n: [250, 0.4, 61, 60, 0.1, 0.8, 0.03], def: 454 },
  honey:          { group: 'oils', type: 'ingredient', name: 'Honey',             n: [330, 0.4, 82, 82, 0, 0, 0.03], def: 340 },
  ketchup:        { group: 'oils', type: 'ingredient', name: 'Ketchup',           n: [100, 1.2, 23, 22, 0.1, 0.5, 1.8], def: 700 },
  soy:            { group: 'oils', type: 'ingredient', name: 'Soy sauce',         n: [60, 7, 6, 2, 0, 0, 13], def: 150 },
  sweet_sauce:    { group: 'oils', type: 'ingredient', name: 'Teriyaki & chilli sauce', n: [170, 1.5, 38, 34, 0.2, 0.5, 4.5], def: 250 },
  mayo:           { group: 'oils', type: 'ingredient', name: 'Mayonnaise',        n: [650, 1.5, 3, 2.5, 70, 0, 1.3], def: 300 },
  condiment_misc: { group: 'oils', type: 'ingredient', name: 'Sushi condiments & vinegar', n: [60, 2, 10, 8, 1, 1, 1.5], def: 100 },
  spices:         { group: 'oils', type: 'ingredient', name: 'Herbs & spices',    n: [300, 12, 40, 4, 6, 25, 0.2], def: 50 },
  salt:           { group: 'oils', type: 'ingredient', name: 'Salt',              n: [0, 0, 0, 0, 0, 0, 97], def: 350 },
  stock:          { group: 'oils', type: 'ingredient', name: 'Stock cubes',       n: [250, 8, 30, 3, 10, 1, 45], def: 142 },
  sugar:          { group: 'oils', type: 'ingredient', name: 'Sugar',             n: [400, 0, 100, 100, 0, 0, 0], def: 1000 },
  coconut_milk:   { group: 'oils', type: 'ingredient', name: 'Coconut milk',      n: [75, 0.6, 1.5, 1, 7.5, 0, 0.05], def: 400 },
  crispy_onions:  { group: 'oils', type: 'ingredient', name: 'Crispy onions',     n: [600, 6, 41, 6, 45, 4, 1.2], def: 100 },

  // Snacks & treats
  crisps:             { group: 'snacks', type: 'snack', name: 'Crisps',               n: [535, 6.5, 55, 3.5, 31, 4, 1.3], def: 150 },
  chocolate:          { group: 'snacks', type: 'snack', name: 'Chocolate',            n: [485, 8, 59, 51, 23, 1.5, 0.6], def: 200 },
  ice_cream:          { group: 'snacks', type: 'snack', name: 'Ice cream',            n: [95, 1.7, 11.5, 10.5, 4.8, 0, 0.1], def: 1000 },
  ice_cream_sandwich: { group: 'snacks', type: 'snack', name: 'Ice cream sandwiches', n: [260, 4, 35, 20, 11, 1, 0.3], def: 330 },
  gum:                { group: 'snacks', type: 'snack', name: 'Chewing gum',          n: [155, 0, 62, 0, 0.4, 0, 0], def: 64 },
  crackers:           { group: 'snacks', type: 'snack', name: 'Crackers',             n: [520, 10, 55, 3, 28, 2.5, 2.2], def: 150 },

  // Drinks
  soft_sugar:    { group: 'drinks', type: 'drink', name: 'Sugary soft drinks',  n: [38, 0, 9.5, 9.5, 0, 0, 0.01], def: 2000 },
  soft_diet:     { group: 'drinks', type: 'drink', name: 'Diet soft drinks',    n: [1, 0, 0, 0, 0, 0, 0.02], def: 2000 },
  energy:        { group: 'drinks', type: 'drink', name: 'Energy drinks',       n: [46, 0, 11, 11, 0, 0, 0.1], def: 500 },
  energy_zero:   { group: 'drinks', type: 'drink', name: 'Sugar-free energy drinks', n: [2, 0, 1, 0, 0, 0, 0.1], def: 500 },
  milkshake:     { group: 'drinks', type: 'drink', name: 'Milkshakes',          n: [65, 3.4, 9.5, 9, 1.6, 0, 0.12], def: 950 },
  protein_shake: { group: 'drinks', type: 'drink', name: 'Protein shakes',      n: [60, 10, 4.5, 3, 0.5, 0, 0.15], def: 500 },
  juice:         { group: 'drinks', type: 'drink', name: 'Fruit juice',         n: [45, 0.6, 10, 9.5, 0.1, 0.3, 0], def: 1000 },
  smoothie:      { group: 'drinks', type: 'drink', name: 'Smoothies',           n: [58, 0.7, 12.5, 11, 0.2, 1.3, 0], def: 750 },
  coconut_water: { group: 'drinks', type: 'drink', name: 'Coconut water',       n: [20, 0.2, 4.5, 4, 0, 0, 0.1], def: 1000 },
  squash:        { group: 'drinks', type: 'drink', name: 'Squash (concentrate)', n: [8, 0.1, 1, 0.5, 0, 0, 0.02], def: 66 },
  yoghurt_drink: { group: 'drinks', type: 'drink', name: 'Yoghurt drinks',      n: [80, 3, 13, 12, 1.5, 0, 0.12], def: 825 },

  // Ready meals & convenience
  gyoza:    { group: 'meals', type: 'meal', name: 'Gyoza',          n: [200, 9, 28, 3, 5.5, 2, 1.2], def: 240 },
  bao:      { group: 'meals', type: 'meal', name: 'Bao buns',       n: [240, 10, 36, 9, 6, 2, 1], def: 256 },
  sushi:    { group: 'meals', type: 'meal', name: 'Sushi',          n: [160, 6, 28, 5, 2.5, 1, 1.1], def: 300 },
  sandwich: { group: 'meals', type: 'meal', name: 'Sandwiches',     n: [230, 11, 24, 3, 10, 2, 1.1], def: 180 }
};
