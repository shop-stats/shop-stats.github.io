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

// Areas that group the smaller non-food categories (see App.SUBS in data/nutrition.js).
App.NONFOOD_AREAS = [
  { id: 'cleaning', name: 'Cleaning & laundry' },
  { id: 'personal', name: 'Personal care & hygiene' },
  { id: 'paper',    name: 'Paper, wraps & bags' },
  { id: 'health',   name: 'Health' },
  { id: 'family',   name: 'Baby & pet' },
  { id: 'home',     name: 'Home & kitchen' },
  { id: 'clothing', name: 'Clothing' },
  { id: 'gifts',    name: 'Gifts, cards & flowers' }
];
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
  // Cleaning & laundry
  [['washing up liquid', 'washing-up liquid', 'dishwasher tablets', 'dishwasher tabs', 'dishwasher salt', 'rinse aid'], 'nf_dish'],
  [['washing liquid', 'washing powder', 'washing pods', 'laundry', 'fabric conditioner', 'fabric softener', 'stain remover',
    'non bio', 'colour catcher'], 'nf_laundry'],
  [['toilet cleaner', 'toilet brush', 'toilet block', 'toilet gel', 'limescale', 'bathroom cleaner', 'mould spray'], 'nf_bathroom'],
  [['multi purpose', 'multi-purpose', 'surface cleaner', 'surface spray', 'cleanser spray', 'disinfectant', 'bleach',
    'antibacterial spray', 'antibacterial wipes', 'cleaning wipes', 'glass cleaner', 'kitchen cleaner', 'oven cleaner',
    'floor cleaner', 'furniture polish', 'air freshener'], 'nf_surface'],
  [['microfibre', 'sponges', 'scourer', 'scourers', 'scouring', 'rubber gloves', 'cleaning gloves', 'dusters', 'mop', 'cleaning cloths'], 'nf_cloths'],

  // Paper, wraps & bags
  [['toilet tissue', 'toilet roll', 'toilet rolls', 'kitchen roll', 'kitchen towel', 'paper towels', 'tissues', 'facial tissues'], 'nf_paper'],
  [['kitchen foil', 'tin foil', 'aluminium foil', 'cling film', 'freezer bags', 'sandwich bags', 'food bags', 'bin bags',
    'bin liners', 'baking paper', 'greaseproof', 'parchment'], 'nf_wraps'],
  [['reusable bag', 'reusuable bag', 'bag for life', 'carrier bag'], 'nf_bags'],

  // Personal care & hygiene
  [['toothbrush', 'toothbrushes', 'toothpaste', 'mouthwash', 'dental floss', 'interdental'], 'nf_oral'],
  [['face wash', 'cream wash', 'face scrub', 'facial wash', 'moisturiser', 'face wipes', 'micellar', 'sun cream',
    'suncream', 'neutrogena', 'clean & clear', 'cleanser'], 'nf_skin'],
  [['shower gel', 'body wash', 'handwash', 'hand wash', 'soap', 'bubble bath', 'body lotion', 'hand cream'], 'nf_body'],
  [['shampoo', 'conditioner', 'hair gel', 'hairspray', 'hair spray', 'hair dye'], 'nf_hair'],
  [['deodorant', 'antiperspirant', 'body spray'], 'nf_deodorant'],
  [['razor', 'razors', 'razor blades', 'shaving'], 'nf_shaving'],
  [['tampons', 'sanitary towels', 'sanitary pads', 'panty liners', 'period pants'], 'nf_sanitary'],

  // Health
  [['supplement', 'vitabiotics', 'vitamins', 'multivitamin', 'paracetamol', 'ibuprofen', 'antihistamine',
    'plasters', 'cold & flu', 'throat lozenges', 'rennie', 'gaviscon'], 'nf_health'],

  // Baby & pet
  [['nappies', 'nappy', 'baby wipes', 'baby bottle', 'baby shampoo'], 'nf_baby'],
  [['cat food', 'dog food', 'cat litter', 'dog treats', 'cat treats', 'pet food', 'whiskas', 'felix', 'pedigree', 'bakers dog'], 'nf_pet'],

  // Home & kitchen (specific F&F Home items above already matched, e.g. "F&F Home Charcoal Toilet Brush")
  [['duvet', 'fitted sheet', 'flat sheet', 'pillow', 'pillowcase', 'bath sheet', 'towel', 'towels', 'bath mat', 'bedding', 'throw'], 'nf_bedding'],
  [['go cook', 'frypan', 'frying pan', 'saucepan', 'stockpot', 'grater', 'can opener', 'mixing bowl', 'cleaver', 'knife',
    'chopping board', 'chopping boards', 'utensils', 'food storage', 'klipfresh', 'rib mug', 'mugs', 'tumbler', 'dinner plates',
    'cutlery', 'baking tray', 'stainless steel'], 'nf_kitchenware'],
  [['scissors', 'tape', 'batteries', 'light bulb', 'led bulb', 'glue', 'pens', 'notebook'], 'nf_diy'],
  [['bayswood', 'artificial plant', 'artificial tree', 'artificial flowers', 'candle', 'candles', 'photo frame', 'cushion',
    'vase', 'f&f home'], 'nf_furnishings'],

  // Clothing (F&F items that aren't homeware)
  [['f&f', 'socks', 't-shirt', 'joggers', 'trunks', 'sweatshirt'], 'nf_clothing'],

  // Gifts, cards & flowers
  [['bouquet', 'small roses', 'red roses', 'dozen roses', 'stocks bunch', 'flowers', 'tulips', 'lilies', 'carnations',
    'chrysanthemums'], 'nf_flowers'],
  [['gift bag', 'gift wrap', 'rollwrap', 'wrapping paper', 'everyday open', 'paperlink', 'ukgreetings', 'greetings card',
    'birthday card', 'gift tag'], 'nf_cards'],

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
