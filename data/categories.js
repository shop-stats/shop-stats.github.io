// Food groups, item types and the keyword rules that map a Tesco product name to a sub-category.
// Sub-categories (and their nutrition values) live in data/nutrition.js.
window.App = window.App || {};

// Order matters: it is the colour-slot order and the stacking order in charts.
App.GROUPS = [
  { id: 'dairy',   name: 'Dairy & Alternatives' },
  { id: 'starchy', name: 'Starchy Carbs' },
  { id: 'drinks',  name: 'Drinks' },
  { id: 'oils',    name: 'Oils, Spreads & Condiments' },
  { id: 'snacks',  name: 'Snacks & Treats' },
  { id: 'fv',      name: 'Fruit & Vegetables' },
  { id: 'meals',   name: 'Ready Meals & Convenience' },
  { id: 'protein', name: 'Protein' }
];
App.NONFOOD = { id: 'nonfood', name: 'Non-food' };
App.UNCLASSIFIED = { id: 'unclassified', name: 'Unclassified' };

App.TYPES = [
  { id: 'ingredient', name: 'Ingredients', blurb: 'Cooked with or combined into meals' },
  { id: 'meal',       name: 'Ready meals', blurb: 'Eaten as a meal straight from the pack' },
  { id: 'drink',      name: 'Drinks',      blurb: 'Soft drinks, juice, milkshakes' },
  { id: 'snack',      name: 'Snacks',      blurb: 'Eaten as-is between meals' }
];

// [keywords, subCategory, options]. First match wins, so specific phrases come before generic words.
// Keywords match whole words/phrases, case-insensitive. options.unit overrides grams per counted unit.
App.RULES = [
  // Non-food first, so e.g. "Lemon Washing Up Liquid" never matches lemons.
  [['f&f home', 'go cook', 'stockpot', 'chopping boards', 'bamboo utensils', 'stainless steel', 'scissors',
    'tape', 'pillow', 'bath mat', 'artificial', 'food storage', 'reusable bag', 'reusuable bag'], 'nf_home'],
  [['f&f'], 'nf_clothing'],
  [['washing up liquid', 'washing liquid', 'cleanser', 'microfibre', 'toilet tissue'], 'nf_cleaning'],
  [['toothbrush', 'toothpaste', 'face wash', 'cream wash', 'face scrub', 'moisturiser', 'shower gel',
    'deodorant', 'handwash', 'neutrogena', 'clean & clear'], 'nf_toiletries'],
  [['bouquet', 'roses', 'stocks bunch', 'gift bag', 'rollwrap', 'everyday open', 'paperlink', 'ukgreetings'], 'nf_gifts'],
  [['supplement', 'vitabiotics'], 'nf_health'],

  // Names that contain misleading words ("sandwich", "rice", "sushi", "chicken").
  [['ice cream mini sandwiches', 'ice cream sandwich'], 'ice_cream_sandwich'],
  [['ice cream'], 'ice_cream'],
  [['sandwich'], 'sandwich'],
  [['gyoza', 'gyozas'], 'gyoza'],
  [['bao buns', 'bao bun'], 'bao'],
  [['sushi rice', 'basmati'], 'rice'],
  [['sushi ginger', 'sushi nori', 'nori', 'wasabi', 'vinegar'], 'condiment_misc'],
  [['yo!', 'sushi'], 'sushi'],
  [['rice cakes'], 'rice_cakes'],
  [['bagels', 'bagel'], 'bagel'],

  // Drinks before fruit/milk/sugar words ("Apple, Lemon & Ginger Juice", "No Sugar Cola").
  [['protein shake'], 'protein_shake'],
  [['milkshake', 'frijj', 'milk drink'], 'milkshake'],
  [['yoghurt drink'], 'yoghurt_drink'],
  [['smoothie'], 'smoothie'],
  [['juice'], 'juice'],
  [['coconut water'], 'coconut_water'],
  [['squash'], 'squash'],
  [['energy ultra', 'drink ultra'], 'energy_zero'],
  [['monster energy', 'red bull', 'energy drink'], 'energy'],
  [['zero sugar', 'diet', 'pepsi max', 'no sugar', 'no added sugar'], 'soft_diet'],
  [['cola', 'fanta', 'sprite', 'ginger beer', 'lemonade', 'soft drink', 'pepsi'], 'soft_sugar'],

  // Snacks & treats.
  [['crisps', 'wotsits', 'walkers'], 'crisps'],
  [['snickers', 'chocolate'], 'chocolate'],
  [['chewing gum'], 'gum'],
  [['crackers'], 'crackers'],
  [['olives'], 'olives'],

  // Oils, spreads & condiments (before produce words like "onion", "garlic").
  [['crispy onions'], 'crispy_onions'],
  [['granules', 'garlic powder', 'black pepper', 'cinnamon', 'paprika', 'mixed herbs', 'mixed spice', 'chilli flakes'], 'spices'],
  [['sea salt', 'table salt'], 'salt'],
  [['stock cubes', 'stock cube'], 'stock'],
  [['soy sauce'], 'soy'],
  [['teriyaki', 'sriracha'], 'sweet_sauce'],
  [['ketchup'], 'ketchup'],
  [['mayo', 'mayonnaise'], 'mayo'],
  [['oil spray'], 'oil_spray'],
  [['olive oil', 'wok oil', 'vegetable oil', 'sunflower oil'], 'oil'],
  [['coconut milk'], 'coconut_milk'],
  [['granulated sugar', 'caster sugar'], 'sugar'],
  [['peanut butter'], 'peanut_butter'],
  [['butter'], 'butter'],
  [['jam'], 'jam'],
  [['cereal', 'hoops', 'shredded wheat', 'granola'], 'cereal'],
  [['honey'], 'honey'],

  // Dairy.
  [['skyr'], 'skyr'],
  [['yoghurt', 'yogurt'], 'yoghurt_pot'],
  [['creme fraiche'], 'creme_fraiche'],
  [['double cream', 'single cream'], 'cream'],
  [['soft cheese'], 'soft_cheese'],
  [['mozzarella'], 'mozzarella'],
  [['cheddar', 'pecorino', 'cheese'], 'cheese'],
  [['milk'], 'milk'],

  // Protein.
  [['cured ham', 'roast beef', 'roast chicken breast', 'sliced ham'], 'deli'],
  [['lean beef'], 'mince_lean'],
  [['20% fat'], 'mince_fatty'],
  [['mince'], 'mince'],
  [['steak'], 'steak'],
  [['bacon'], 'bacon'],
  [['chicken'], 'chicken'],
  [['smoked salmon'], 'smoked_salmon'],
  [['pink salmon'], 'tinned_salmon'],
  [['salmon'], 'salmon'],
  [['prawns'], 'prawns'],
  [['seafood sticks'], 'seafood_sticks'],
  [['eggs'], 'eggs'],

  // Starchy carbs.
  [['oats', 'porridge'], 'oats'],
  [['spaghetti', 'tagliatelle', 'pasta', 'penne', 'fusilli'], 'pasta'],
  [['noodles', 'udon'], 'noodles'],
  [['pastry'], 'pastry'],
  [['bread', 'loaf', 'wraps', 'tortilla', 'sourdough'], 'bread'],

  // Fruit & vegetables.
  [['chopped tomatoes', 'tomato puree'], 'tinned_tom'],
  [['avocado', 'avocados'], 'avocado'],
  [['lemons', 'limes'], 'citrus'],
  [['sweet potato', 'sweet potatoes'], 'sweet_potato'],
  [['lettuce'], 'salad', { unit: 500 }],
  [['cucumber', 'radish', 'tomatoes'], 'salad'],
  [['onions', 'spring onions', 'carrots', 'peppers', 'broccoli', 'spinach', 'courgette', 'mushrooms'], 'veg'],
  [['bananas', 'banana', 'apple', 'apples', 'peach', 'fig', 'grapes', 'strawberries', 'mango', 'pineapple', 'oranges'], 'fruit']
];
