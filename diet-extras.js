/* CareMate diet helpers: calorie targets per meal, food swap options, portion guide and the weekly shopping list.
 * Pure functions (no storage). Used by the Diet Plan in script.js. Load before script.js. */
window.CareMateDiet = (function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- 1) calories: your daily estimate shared across the five meals (a target, not an analysis of each dish) ---------- */
  const SHARE = [0.25, 0.10, 0.30, 0.10, 0.25];                       // breakfast, mid-morning, lunch, evening, dinner
  const mealKcal = (daily, i) => daily ? Math.round(daily * SHARE[i] / 10) * 10 : null;

  /* ---------- 2) swap options ----------
     flags: d dairy · e egg · m meat · f fish · n nuts · s soy · g gluten · k kidney caution */
  const SWAPS = [
    [/paneer|tofu/i,                 'paneer',   [['tofu', 's'], ['soya chunks', 's'], ['a bowl of sprouts', ''], ['1 extra katori of dal', ''], ['boiled chickpeas', '']]],
    [/\bmilk\b/i,                    'milk',     [['soy milk', 's'], ['almond milk', 'n'], ['a bowl of curd', 'd'], ['a glass of buttermilk', 'd']]],
    [/\bcurd\b|raita/i,              'curd',     [['a glass of buttermilk', 'd'], ['soy curd', 's'], ['a cucumber and onion salad', '']]],
    [/\brice\b/i,                    'rice',     [['1 jowar roti', ''], ['1 ragi roti', ''], ['1 katori cooked millet (foxtail or kodo)', ''], ['1 katori dalia', 'g']]],
    [/\brotis?\b|paratha/i,          'roti',     [['jowar roti', ''], ['bajra roti', ''], ['ragi roti', ''], ['multigrain roti', 'g']]],
    [/poha/i,                        'poha',     [['vegetable dalia', 'g'], ['oats upma', ''], ['2 idlis with sambar', '']]],
    [/\boats\b/i,                    'oats',     [['vegetable dalia', 'g'], ['ragi porridge', ''], ['vegetable poha', '']]],
    [/idli|dosa|uttapam|chilla|cheela/i, 'chilla or dosa', [['besan chilla', ''], ['moong dal chilla', ''], ['ragi dosa', ''], ['vegetable oats chilla', '']]],
    [/banana|grapes|mango/i,         'sweet fruit', [['a bowl of papaya', ''], ['1 guava', ''], ['1 apple', ''], ['1 pear', '']]],
    [/almonds?|walnuts?|peanuts?|\bnuts\b/i, 'nuts', [['pumpkin seeds', ''], ['sunflower seeds', ''], ['roasted chana', ''], ['walnuts', 'n'], ['almonds', 'n']]],
    [/\bdal\b/i,                     'dal',      [['moong dal', ''], ['masoor dal', ''], ['toor dal', ''], ['urad dal', '']]],
    [/rajma|chole|chana|lobia/i,     'pulses',   [['sprouted moong', ''], ['lobia', ''], ['kala chana', ''], ['rajma', '']]],
    [/\begg|omelette|bhurji/i,       'egg',      [['paneer bhurji', 'd'], ['moong dal chilla', ''], ['tofu scramble', 's']]],
    [/chicken|fish/i,                'chicken or fish', [['paneer (small portion)', 'd'], ['tofu', 's'], ['soya chunks curry', 's'], ['dal with a bowl of curd', 'd']]]
  ];
  function ok(flags, p) {
    const av = p.avoid || [], veg = p.foodPref !== 'nonveg';
    if (flags.includes('d') && (p.foodPref === 'vegan' || av.includes('dairy'))) return false;
    if (flags.includes('e') && (veg || av.includes('eggs'))) return false;
    if (flags.includes('m') && veg) return false;
    if (flags.includes('f') && (veg || av.includes('seafood'))) return false;
    if (flags.includes('n') && (av.includes('nuts') || p.condition === 'kidney')) return false;
    if (flags.includes('s') && (av.includes('soy') || p.condition === 'kidney')) return false;
    if (flags.includes('g') && av.includes('gluten')) return false;
    return true;
  }
  /* returns { btn, panel } (empty strings when no swap makes sense for this meal) */
  function swaps(text, p) {
    const lower = text.toLowerCase(), groups = [];
    for (const [re, label, alts] of SWAPS) {
      if (!re.test(text)) continue;
      const list = alts.filter(a => ok(a[1], p) && !lower.includes(a[0].toLowerCase().replace(/^\d+ (extra )?(katori of )?/, ''))).slice(0, 3).map(a => a[0]);
      if (list.length) groups.push([label, list]);
      if (groups.length === 2) break;
    }
    if (!groups.length) return { btn: '', panel: '' };
    return {
      btn: '<button type="button" class="cm-swapbtn" aria-expanded="false"><i class="fa-solid fa-arrows-rotate"></i> Swap options</button>',
      panel: '<div class="cm-swaps" hidden>' + groups.map(g => `<p>Instead of <span class="cm-sw-src">${esc(g[0])}</span>: ${g[1].map(esc).join(' · ')}</p>`).join('') + '</div>'
    };
  }

  /* ---------- 3) portion guide (household measures, approximate) ---------- */
  function portion(personal) {
    const rows = [
      ['Rice or dal', '1 katori (small bowl), about 150 g cooked'],
      ['Roti', '1 medium roti, about 30 g of flour (6-inch)'],
      ['Sabzi', '1 katori, about 100 to 150 g'],
      ['Salad', '1 small bowl of raw vegetables'],
      ['Curd', '1 katori, about 100 g'],
      ['Milk', '1 glass, about 200 ml'],
      ['Paneer or tofu', 'About 50 g, a matchbox-size piece'],
      ['Fruit', '1 medium fruit, or 1 katori of cut fruit'],
      ['Nuts and seeds', 'A small handful, about 5 to 8 nuts'],
      ['Ghee or oil', '1 teaspoon (5 ml) per meal']
    ];
    return `${personal ? `<p class="cm-note">${esc(personal)}</p>` : ''}
      <table class="cm-table cm-kv">${rows.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</table>
      <p class="cm-note">Household measures are approximate. Your own katori and roti size may differ a little.</p>`;
  }

  /* ---------- 3b) protein guide: your daily target and common sources (approximate values) ----------
     flags: d dairy · e egg · m meat · f fish · n nuts · s soy */
  const PROTEIN = [
    ['Dal, cooked', '1 katori (150 g)', '5 to 8 g', ''],
    ['Rajma, chole or lobia, cooked', '1 katori (150 g)', '8 to 12 g', ''],
    ['Sprouts', '1 katori (100 g)', '3 to 7 g', ''],
    ['Soya chunks, dry', '25 g', '12 to 13 g', 's'],
    ['Tofu', '100 g', '8 to 10 g', 's'],
    ['Paneer', '50 g', '9 to 10 g', 'd'],
    ['Milk', '1 glass (200 ml)', '6 to 7 g', 'd'],
    ['Curd', '1 katori (100 g)', '3 to 4 g', 'd'],
    ['Egg', '1 whole egg', 'about 6 g', 'e'],
    ['Chicken, cooked', '100 g', '25 to 27 g', 'm'],
    ['Fish, cooked', '100 g', '20 to 22 g', 'f'],
    ['Peanuts', 'A small handful (30 g)', '7 to 8 g', 'n'],
    ['Almonds', '10 almonds', '2 to 3 g', 'n'],
    ['Oats, dry', '40 g', 'about 5 g', ''],
    ['Roti', '1 medium roti', 'about 3 g', '']
  ];
  function proteinGuide(p, target) {
    const av = p.avoid || [], veg = p.foodPref !== 'nonveg', vegan = p.foodPref === 'vegan';
    const rows = PROTEIN.filter(r => {
      const f = r[3];
      if (f.includes('d') && (vegan || av.includes('dairy'))) return false;
      if (f.includes('e') && (veg || av.includes('eggs'))) return false;
      if (f.includes('m') && veg) return false;
      if (f.includes('f') && (veg || av.includes('seafood'))) return false;
      if (f.includes('n') && av.includes('nuts')) return false;
      if (f.includes('s') && av.includes('soy')) return false;
      return true;
    });
    const special = ['pregnancy', 'child', 'cancer', 'kidney'].includes(p.condition);
    const top = target
      ? `<div class="cm-pro-top"><b>About ${target} g</b><span>of protein a day, from your weight and health focus. That is about ${Math.round(target * 0.25 / 5) * 5} g at each main meal and ${Math.round(target * 0.125 / 5) * 5} g at each snack.</span></div>`
      : `<p class="cm-note">Add your weight in your profile to see your daily protein target.</p>`;
    return `${top}
      ${special ? '<p class="cm-note">Your protein need depends on your health. Please ask your doctor or dietitian for your exact target.</p>' : ''}
      <table class="cm-table cm-kv cm-pro">${rows.map(r => `<tr><td>${esc(r[0])}<small>${esc(r[1])}</small></td><td>${esc(r[2])}</td></tr>`).join('')}</table>
      <p class="cm-note">Spread protein across the day and add a source to every meal. Dal with roti or rice together gives a good mix. Values are approximate and change with cooking and brand.</p>`;
  }

  /* ---------- 4) weekly shopping list, built from this week's seven menus ---------- */
  const SHOP = [
    ['Grains and flour', /\brotis?\b|paratha|chapati/i, 'Whole wheat flour (atta)'], ['Grains and flour', /jowar/i, 'Jowar flour'], ['Grains and flour', /bajra/i, 'Bajra flour'],
    ['Grains and flour', /ragi/i, 'Ragi flour'], ['Grains and flour', /brown rice|\brice\b|khichdi|pulao/i, 'Rice'], ['Grains and flour', /poha/i, 'Poha'],
    ['Grains and flour', /\boats\b/i, 'Oats'], ['Grains and flour', /dalia|daliya/i, 'Broken wheat (dalia)'], ['Grains and flour', /upma/i, 'Rava or oats for upma'],
    ['Grains and flour', /idli|dosa|uttapam/i, 'Idli or dosa batter'], ['Grains and flour', /bread|toast/i, 'Multigrain bread'], ['Grains and flour', /besan|chilla|cheela/i, 'Besan (gram flour)'],
    ['Grains and flour', /makhana/i, 'Makhana'], ['Grains and flour', /corn/i, 'Sweet corn'],
    ['Pulses and sprouts', /\bdal\b|masoor|toor|khichdi/i, 'Dal (moong, masoor, toor)'], ['Pulses and sprouts', /moong|sprouts?/i, 'Moong or mixed sprouts'],
    ['Pulses and sprouts', /rajma/i, 'Rajma'], ['Pulses and sprouts', /chole|chana|hummus/i, 'Chickpeas (chana)'], ['Pulses and sprouts', /lobia/i, 'Lobia'], ['Pulses and sprouts', /soya/i, 'Soya chunks'],
    ['Vegetables', /palak|spinach|methi|greens/i, 'Leafy greens (palak, methi)'], ['Vegetables', /lauki|bottle gourd/i, 'Lauki (bottle gourd)'], ['Vegetables', /bhindi/i, 'Bhindi'],
    ['Vegetables', /cabbage/i, 'Cabbage'], ['Vegetables', /carrot/i, 'Carrot'], ['Vegetables', /cucumber/i, 'Cucumber'], ['Vegetables', /tomato/i, 'Tomato'],
    ['Vegetables', /onion/i, 'Onion'], ['Vegetables', /beetroot/i, 'Beetroot'], ['Vegetables', /beans/i, 'French beans'], ['Vegetables', /baingan|brinjal/i, 'Brinjal'],
    ['Vegetables', /sweet potato/i, 'Sweet potato'], ['Vegetables', /ridge gourd|tinda|poriyal|kofta/i, 'Seasonal gourds'], ['Vegetables', /vegetable|sabzi|salad|soup/i, 'Mixed seasonal vegetables'],
    ['Fruit', /banana/i, 'Banana'], ['Fruit', /papaya/i, 'Papaya'], ['Fruit', /apple/i, 'Apple'], ['Fruit', /pear/i, 'Pear'], ['Fruit', /orange|sweet lime|kiwi/i, 'Orange, sweet lime or kiwi'],
    ['Fruit', /guava/i, 'Guava'], ['Fruit', /watermelon|muskmelon/i, 'Watermelon or muskmelon'], ['Fruit', /grapes/i, 'Grapes'], ['Fruit', /seasonal fruit|fruit chaat|fruit bowl|fruit/i, 'Other seasonal fruit'],
    ['Dairy and eggs', /(?<!soy |almond |plant )\bmilk\b/i, 'Milk'], ['Dairy and eggs', /(?<!plant-based )\bcurd\b|raita|buttermilk/i, 'Curd and buttermilk'], ['Dairy and eggs', /paneer/i, 'Paneer'],
    ['Dairy and eggs', /ghee/i, 'Ghee'], ['Dairy and eggs', /\begg|omelette|bhurji/i, 'Eggs'],
    ['Plant alternatives', /soy or other plant milk|soy milk|almond milk/i, 'Plant milk (soy or almond)'], ['Plant alternatives', /plant-based curd/i, 'Plant-based curd'], ['Plant alternatives', /tofu/i, 'Tofu'],
    ['Nuts and seeds', /almond/i, 'Almonds'], ['Nuts and seeds', /walnut/i, 'Walnuts'], ['Nuts and seeds', /peanut/i, 'Peanuts'], ['Nuts and seeds', /seeds/i, 'Pumpkin or other seeds'], ['Nuts and seeds', /coconut/i, 'Coconut or coconut water'],
    ['Fish and chicken', /chicken/i, 'Chicken'], ['Fish and chicken', /fish/i, 'Fish'],
    ['Flavour and extras', /lemon|lime\b/i, 'Lemons'], ['Flavour and extras', /mint|chutney|coriander/i, 'Mint, coriander and green chillies'], ['Flavour and extras', /tulsi|green tea|\btea\b/i, 'Tulsi or green tea']
  ];
  const ORDER = ['Grains and flour', 'Pulses and sprouts', 'Vegetables', 'Fruit', 'Dairy and eggs', 'Plant alternatives', 'Nuts and seeds', 'Fish and chicken', 'Flavour and extras'];
  function shopList(menu) {
    const counts = new Map();
    menu.forEach(day => day.forEach(meal => SHOP.forEach(([cat, re, name]) => { if (re.test(meal)) { const k = cat + '|' + name; counts.set(k, (counts.get(k) || 0) + 1); } })));
    return ORDER.map(cat => ({ cat, items: [...counts].filter(([k]) => k.startsWith(cat + '|')).map(([k, n]) => ({ name: k.split('|')[1], n })) })).filter(g => g.items.length);
  }
  function shop(menu, week, checked) {
    const groups = shopList(menu), total = groups.reduce((s, g) => s + g.items.length, 0), done = groups.reduce((s, g) => s + g.items.filter(i => checked.includes(i.name)).length, 0);
    return `<p class="cm-note">Everything in your Week ${week} menu. Quantities depend on how many people you cook for, so each item shows how many meals use it.</p>
      <p class="cm-shop-count"><b>${done} of ${total}</b> bought</p>
      ${groups.map(g => `<h4 class="cm-shop-h">${esc(g.cat)}</h4><ul class="cm-shop">${g.items.map(i => `
        <li><label><input type="checkbox" data-item="${esc(i.name)}" ${checked.includes(i.name) ? 'checked' : ''}><span>${esc(i.name)}</span><small>${i.n} ${i.n === 1 ? 'meal' : 'meals'}</small></label></li>`).join('')}</ul>`).join('')}
      <div class="cm-shop-actions"><button type="button" class="cm-btn small" id="cmShopCopy"><i class="fa-solid fa-copy"></i> Copy list</button></div>`;
  }
  const shopText = (menu, week) => 'CareMate shopping list, Week ' + week + '\n' + shopList(menu).map(g => '\n' + g.cat + '\n' + g.items.map(i => '- ' + i.name).join('\n')).join('\n');

  return { mealKcal, swaps, portion, proteinGuide, shop, shopText };
})();
