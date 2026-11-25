/* CareMate Assistant. Logged-in users get conversational AI answers through the CareMate server (with safety rules and follow-up questions);
   everyone else, and any time the server is unavailable, gets the built-in answers below. General guidance only. */
(function () {
  const WA = '919096066204';

  /* ---------- Knowledge base: k = keywords, a = answer, more = follow-up chips, link = WhatsApp button ---------- */
  const MAKER_ANSWER = 'CareMate was developed by Janhavi Lunge and her team. You can meet them in the Meet the Team section on the home page.';
  const MAKER = /\b(who|whom|which team|whose)\b[^?]*\b(made|makes?|developed?|develops?|created?|creates?|built|builds?|designed?|designs?|owns?|founded|behind)\b[^?]*\b(app|application|caremate|website|site|this|you|bot|helper|chatbot)\b|\b(developer|creator|founder|owner)\b[^?]*\b(app|application|caremate|website|site|this|you)\b|\b(developed|made|created|built|designed) by\b/i;
  const KB = [
    { k: ['replacement', 'replace', 'instead of', 'substitute', 'diagnose'], a: 'No. CareMate gives general wellness guidance only. It does not diagnose, treat or replace your doctor or dietitian. Please check with them before changing medicines or your diet.', more: ['How is my plan created?', 'Can I ask the dietitian a question?'] },
    { k: ['created', 'how is my plan', 'based on', 'make my plan'], a: 'Your plan is built from your profile: age, weight, height, gender, activity level, food preference, health condition, foods you avoid, yoga time and meal times. Change any of these and the plan updates.', more: ['Will I get the same food every day?', 'Can I choose what I see?'] },
    { k: ['same food', 'every day', 'variety', 'menu', 'diet plan', '7 day', 'seven'], a: 'No. Your diet plan has a different menu for every day, and a fresh set of menus each new week. Each meal also has swap options, so you can change a food you do not like. Foods you avoid are flagged.', more: ['What foods can I avoid?', 'How much water should I drink?'] },
    { k: ['conditions', 'covered', 'support', 'which health', 'what conditions'], a: 'Hypertension, hypotension, diabetes, blood sugar, thyroid, PCOD, PMOS (formerly PCOS), anaemia, low immunity, arthritis and bone health, pregnancy and lactation, child health, detox therapy, kidney stone, cancer malnutrition, IBD, obesity, weight gain and general wellness.', more: ['Tell me about diabetes', 'Tell me about thyroid', 'Tell me about anaemia'] },
    { k: ['choose what', 'what i see', 'areas', 'tick', 'goals', 'help with'], a: 'Yes. In Your goals, tick only what you want (Diet Plan, Yoga, Meditation and Stress Relief, Reminders, Condition Info) and your plan shows just those.' },
    { k: ['location', 'address', 'where', 'akola', 'email', 'mail'], a: 'We are in Akola, Maharashtra. Email: caremate92@gmail.com. You can also message us on WhatsApp.', link: true },
    { k: ['emergency', 'chest pain', 'faint', 'unconscious', 'severe pain', 'blood in', 'suicide', 'breathless', 'cannot breathe', 'seizure'], a: 'This sounds serious. Please call 112 or 108 now, or go to the nearest hospital. CareMate cannot handle emergencies.', urgent: true },
    { k: ['hello', 'hi', 'hey', 'namaste', 'good morning', 'good evening'], a: 'Hello! I am the CareMate helper. Ask me about your plan, health conditions, food, water, yoga, meditation, reminders or privacy.', more: ['How does CareMate work?', 'Which health conditions are covered?'] },
    { k: ['thank', 'thanks', 'ok thanks', 'great'], a: 'You are welcome! Stay hydrated and keep going. One small step every day makes a big difference.' },
    { k: ['does it work', 'get started', 'get my plan', 'how does', 'how do i', 'steps'], a: 'It takes 3 steps: 1) Register or log in. 2) Fill your health profile: age, weight, height, gender, condition and food preference. 3) Tap Get my plan. You get a 7-day diet, yoga, meditation and reminders.', more: ['Is my data safe?', 'Which health conditions are covered?'] },
    { k: ['free', 'cost', 'price', 'fee', 'charge', 'paid'], a: 'You can fill your profile and view your plan on this site. For personal advice from our dietitian, message her on WhatsApp and ask about her consultation details.', link: true },
    { k: ['kidney', 'stone'], a: 'Kidney stones (NIDDK): drinking enough liquid, mainly water, is the most important step. Many professionals suggest 6 to 8 glasses a day, and your doctor may set a higher target. Keep sodium under 2,300 mg a day, do not cut calcium, and for calcium oxalate stones limit nuts, peanuts, spinach, rhubarb and wheat bran. Advice depends on your stone type, so ask your doctor.' },
    { k: ['bp', 'pressure', 'hypertension', 'hypotension'], a: 'WHO: high blood pressure is 140/90 mmHg or higher on two different days and usually has no symptoms. Keep salt under 5 g a day (no pickles, papad, chips), be active for 150 minutes a week, avoid tobacco and limit alcohol. NHS: low pressure is below 90/60 mmHg. Stand up slowly, eat small frequent meals and drink more water. You can log your BP in the profile.', more: ['How do I log blood pressure?'] },
    { k: ['log blood', 'log bp', 'log sugar', 'reading', 'systolic', 'track'], a: 'In your profile, under Your health, tick "I would like to log blood pressure" or "blood sugar", then enter your reading (systolic and diastolic for BP, or level and fasting / post-meal / random for sugar).' },
    { k: ['sugar', 'diabetes', 'diabetic', 'glucose'], a: 'WHO: aim for at least 150 minutes of moderate exercise a week, eat a healthy diet that avoids sugar and saturated fat, and keep a healthy weight. In your plan we also suggest fixed meal times and whole grains with dal. Check your sugar as your doctor advises.' },
    { k: ['pcod', 'pcos', 'pmos'], a: 'PCOS was renamed PMOS (polyendocrine metabolic ovarian syndrome) in May 2026; it is the same condition. WHO: it affects about 10 to 13% of women of reproductive age, and healthy eating and regular activity help even without weight loss. It raises the chance of diabetes and high blood pressure, so ask your doctor about blood tests. These options are shown only for women.' },
    { k: ['thyroid'], a: 'NIDDK: for an underactive thyroid, levothyroxine is usually taken in the morning before eating, with a blood test 6 to 8 weeks after starting. Seaweed such as kelp and iodine supplements can worsen some thyroid conditions, so ask your doctor. Never stop the medicine on your own.' },
    { k: ['anaemia', 'anemia', 'iron', 'hemoglobin', 'haemoglobin'], a: 'WHO: iron-rich foods include lean red meat, fish, poultry, legumes, fortified cereals and dark green leafy vegetables. Vitamin C helps absorption, while tea, coffee, cocoa, bran and calcium reduce it when eaten together. Take supplements only if a health professional recommends them.' },
    { k: ['immunity', 'immune', 'cold', 'infection'], a: 'For low immunity: eat colourful fruit and vegetables, protein, nuts, turmeric and amla, sleep 7 to 8 hours, drink enough water and stay active every day.' },
    { k: ['arthritis', 'bone', 'joint', 'calcium', 'osteoporosis'], a: 'For arthritis and bone health: calcium (milk, curd, ragi, sesame), vitamin D from morning sunlight, gentle joint-friendly yoga, and less salt and processed food. Stop any movement that gives sharp pain.' },
    { k: ['pregnan', 'lactat', 'breastfeed', 'mother'], a: 'NHS: you do not need to eat for two. Take a folic acid supplement, avoid liver, raw or partly cooked eggs, unpasteurised cheese and undercooked meat, and avoid shark, swordfish and marlin. WHO advises exclusive breastfeeding for 6 months. Always follow your gynaecologist’s advice.' },
    { k: ['child', 'kid', 'baby', 'infant'], a: 'For child health, a parent or guardian fills in the profile. Focus on regular meals, fruit and vegetables, milk or curd, protein and play time. Check with your paediatrician for children with medical conditions.' },
    { k: ['obesity', 'obese', 'lose weight', 'weight loss', 'fat', 'overweight'], a: 'WHO: overweight is a BMI of 25 or more and obesity is 30 or more in adults, though risk may start at a lower BMI for many Asian adults. Eat more fruit, vegetables, legumes, whole grains and nuts, cut sugary drinks and fried food, stay active and sleep well. Avoid crash diets.' },
    { k: ['underweight', 'gain weight', 'weight gain', 'thin'], a: 'For weight gain: eat 5 to 6 small meals, add healthy calories like nuts, ghee, banana, milk and paneer, include protein, and do light strength exercise.' },
    { k: ['detox', 'cleanse'], a: 'The detox plan focuses on water (about 3 litres), fresh fruit and vegetables, light home-cooked meals, less sugar and processed food, and good sleep. No extreme fasting.' },
    { k: ['cancer', 'chemo', 'malnutrition'], a: 'For cancer malnutrition: small frequent protein-rich meals, soft easy foods and enough fluids. Your oncologist or dietitian must guide your exact diet, so please share this plan with them.' },
    { k: ['ibd', 'colitis', 'crohn', 'gut', 'digestion', 'acidity', 'constipation'], a: 'NIDDK: researchers have not found that specific foods cause or worsen Crohn’s disease. A food diary can help you spot your own triggers. Talk to your doctor before changing your diet or taking supplements, as poor absorption can cause malnutrition.' },
    { k: ['weight', 'bmi', 'height', 'calorie', 'protein'], a: 'Your calories and protein come from your weight, height, age, gender and activity. Add your height in the profile to see your BMI. The live BMI ring on the profile page updates as you type.' },
    { k: ['water', 'drink', 'hydrate', 'hydration'], a: 'Aim for 2.5 to 3 litres a day (8+ glasses). Kidney stone and detox plans suggest 3 litres. You can set a daily water goal (6 to 12 glasses) in the profile and track it with the + button on your dashboard.' },
    { k: ['avoid', 'allergy', 'allergic', 'gluten', 'dairy', 'nut', 'egg', 'soy', 'seafood', 'lactose'], a: 'In Your preferences, tick the foods you avoid: milk and dairy, gluten, nuts, eggs, fish and seafood or soy. Meals that contain them are flagged so you can swap or skip. Add other allergies in the notes box.' },
    { k: ['veg', 'vegetarian', 'vegan', 'nonveg', 'non veg', 'food preference'], a: 'Choose Vegetarian, Non-vegetarian or Vegan in the profile. Your menu follows that choice.' },
    { k: ['yoga', 'asana', 'pranayama', 'exercise'], a: 'Your yoga routine matches your condition, experience (beginner, some, regular) and the time you choose (10, 20 or 30 minutes). Practise on an empty stomach and stop if you feel pain or dizziness.', more: ['What about meditation?', 'How do reminders work?'] },
    { k: ['meditat', 'stress', 'anxiety', 'calm', 'relax', 'breath', 'mind'], a: 'Meditation and stress relief give you short breathing and mindfulness practices. Even 5 to 10 quiet minutes a day helps. Tick Meditation & Stress Relief in your goals to see them.' },
    { k: ['sleep', 'insomnia', 'tired', 'rest'], a: 'Aim for 7 to 8 hours of sleep. Keep fixed sleep and wake times, avoid screens and caffeine late at night, and have a light dinner at least 2 hours before bed.' },
    { k: ['meal time', 'breakfast', 'lunch', 'dinner', 'timing'], a: 'Set your usual breakfast, lunch and dinner times in Your preferences. Your reminders follow those times.' },
    { k: ['remind', 'alarm', 'notification', 'notify'], a: 'Open Reminders in Your areas to set times for water, meals and yoga. Allow notifications and keep the page open.' },
    { k: ['dark', 'theme', 'light mode', 'night mode', 'font', 'text size', 'settings'], a: 'Use the moon / sun button at the top to switch between light and dark theme. The settings (gear) button lets you change text size, hide the daily quote and calm the animations.' },
    { k: ['private', 'privacy', 'secure', 'safe', 'pin', 'delete', 'data', 'lock', 'stored', 'server'], a: 'Your profile, plan, daily goals and reminders are kept on your device for speed and, when you are logged in, securely synced to your CareMate account so you can use them on another device. Only you and the CareMate admin can see your details; other users never can. Passwords are stored scrambled (hashed), never as plain text. Your profile picture, PIN lock and settings stay on this device only. You can delete your data anytime: tap the shield button on the profile page and choose Delete all my data, which removes it from both your device and your account.' },
    { k: ['login', 'log in', 'register', 'sign up', 'signup', 'account', 'password', 'forgot', 'logout', 'log out'], a: 'Use Login / Register from the home page menu. Use Log out at the top of the profile page when you finish. Password reset will be available once accounts are connected.' },
    { k: ['dietitian', 'contact', 'doctor', 'ask', 'whatsapp', 'consult', 'expert', 'pundkar'], a: 'You can message our dietitian, Dhanashree Pundkar, on WhatsApp for diet questions.', link: true },
    { k: ['who made', 'who developed', 'who created', 'who built', 'who designed', 'developer', 'creator', 'made this', 'developed this', 'made by', 'developed by', 'behind'], a: MAKER_ANSWER, more: ['Where are you located?', 'How does CareMate work?'] },
    { k: ['team', 'about', 'who are you', 'caremate'], a: 'CareMate is a wellness project from Akola, Maharashtra. The food guidance is prepared with our team dietitian, Dhanashree Pundkar. See the About section on the home page to meet the team.', more: ['Where are you located?'] },
    { k: ['back', 'edit', 'change', 'update', 'wrong'], a: 'Use the Back button at the top, or Edit my profile under your plan, to change your details.' },
    { k: ['source', 'sources', 'verified', 'reference', 'who says', 'proof', 'trusted'], a: 'The Condition Info in your plan lists its facts with links to WHO, NHS and NIDDK pages so you can check them yourself. This is general education only, so please confirm anything about your own health with your doctor.', more: ['Is CareMate a replacement for my doctor?'] }
  ];

  /* ---------- Topic menu: each tab shows its own questions ---------- */
  const TOPICS = [
    { id: 'start', icon: 'fa-rocket', label: 'Getting started', q: ['How does CareMate work?', 'How is my plan created?', 'Will I get the same food every day?', 'Can I choose what I see?'] },
    { id: 'cond', icon: 'fa-heart-pulse', label: 'Conditions', q: ['Which health conditions are covered?', 'Tell me about diabetes', 'Tell me about blood pressure', 'Tell me about thyroid', 'Tell me about PMOS (formerly PCOS)', 'Tell me about anaemia', 'Tell me about kidney stones'] },
    { id: 'food', icon: 'fa-bowl-food', label: 'Food & water', q: ['How much water should I drink?', 'What foods can I avoid?', 'Weight loss tips', 'How can I gain weight?', 'Tell me about meal times'] },
    { id: 'well', icon: 'fa-spa', label: 'Yoga & mind', q: ['Tell me about yoga', 'What about meditation?', 'How can I sleep better?', 'How do reminders work?'] },
    { id: 'safe', icon: 'fa-shield-heart', label: 'Safety & help', q: ['Is CareMate a replacement for my doctor?', 'Is my data safe?', 'Can I ask the dietitian a question?', 'Where are you located?'] }
  ];

  /* ---------- Build the chat window ---------- */
  const fab = document.createElement('button');
  fab.className = 'cb-fab'; fab.type = 'button'; fab.setAttribute('aria-label', 'Open CareMate assistant');
  fab.innerHTML = '<i class="fa-solid fa-comment-dots"></i><span class="cb-dot" aria-hidden="true"></span>';
  const box = document.createElement('div');
  box.className = 'cb-box'; box.hidden = true; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'CareMate assistant');
  box.innerHTML =
    '<div class="cb-head">' +
      '<div class="cb-av"><i class="fa-solid fa-heart-pulse"></i></div>' +
      '<div class="cb-ht"><b>CareMate helper</b><small><span class="cb-on"></span>Online · general guidance only</small></div>' +
      '<button type="button" class="cb-clear" aria-label="Clear chat" title="Start over"><i class="fa-solid fa-rotate-right"></i></button>' +
      '<button type="button" class="cb-x" aria-label="Close chat">✕</button>' +
    '</div>' +
    '<div class="cb-tabs" role="tablist" aria-label="Topics"></div>' +
    '<div class="cb-log" aria-live="polite"></div>' +
    '<div class="cb-chips"></div>' +
    '<form class="cb-form"><input type="text" maxlength="500" placeholder="Ask me anything about your wellness" aria-label="Your question"><button class="cb-send" type="submit" aria-label="Send"><i class="fa-solid fa-paper-plane"></i></button></form>' +
    '<div class="cb-note"><i class="fa-solid fa-triangle-exclamation"></i> Not medical advice. In an emergency call <b>112</b> or <b>108</b>. When you are logged in, your questions are sent securely to our AI service to write answers; do not share your name or ID.</div>';
  document.body.append(fab, box);
  const log = box.querySelector('.cb-log'), chips = box.querySelector('.cb-chips'), tabs = box.querySelector('.cb-tabs'), input = box.querySelector('input');

  const time = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  function say(text, who, opts) {
    opts = opts || {};
    const m = document.createElement('div'); m.className = 'cb-m ' + who + (opts.urgent ? ' urgent' : '');
    const t = document.createElement('span'); t.textContent = text; m.append(t);
    if (opts.link) {
      const a = document.createElement('a'); a.className = 'cb-wa'; a.target = '_blank'; a.rel = 'noopener';
      a.innerHTML = '<i class="fa-brands fa-whatsapp"></i> Chat on WhatsApp';
      a.href = 'https://wa.me/' + WA + '?text=' + encodeURIComponent('Hello, I have a question from CareMate.');
      m.append(a);
    }
    if (opts.urgent) {
      const a = document.createElement('a'); a.className = 'cb-wa cb-sos'; a.href = 'tel:112';
      a.innerHTML = '<i class="fa-solid fa-phone"></i> Call 112';
      m.append(a);
    }
    const s = document.createElement('small'); s.className = 'cb-t'; s.textContent = time(); m.append(s);
    log.append(m); log.scrollTop = log.scrollHeight;
    return m;
  }

  function followUps(list) {
    log.querySelectorAll('.cb-more').forEach(n => n.remove());
    if (!list || !list.length) return;
    const w = document.createElement('div'); w.className = 'cb-more';
    list.forEach(q => { const b = document.createElement('button'); b.type = 'button'; b.textContent = q; b.addEventListener('click', () => send(q)); w.append(b); });
    log.append(w); log.scrollTop = log.scrollHeight;
  }

  function typing() {
    const d = document.createElement('div'); d.className = 'cb-m bot cb-typing'; d.innerHTML = '<i></i><i></i><i></i>';
    log.append(d); log.scrollTop = log.scrollHeight; return d;
  }

  const norm = s => ' ' + s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ') + ' ';
  function match(q) {
    const t = norm(q); let best = null, score = 0;
    KB.forEach(e => { const s = e.k.filter(w => t.indexOf(' ' + w + (w.length <= 3 ? ' ' : '')) > -1).length; if (s > score) { score = s; best = e; } });
    return best;
  }
  function answer(q) {
    const best = match(q);
    if (best) { say(best.a, 'bot', { link: best.link, urgent: best.urgent }); followUps(best.more); }
    else { say('I am not sure about that one yet. Try one of the topics above, or ask our dietitian directly.', 'bot', { link: true }); followUps(['How does CareMate work?', 'Which health conditions are covered?']); }
  }
  /* ---- conversational AI (logged-in users; falls back to the built-in answers if the server cannot answer) ---- */
  const history = [];
  const EMERGENCY = /chest pain|cannot breathe|can'?t breathe|trouble breathing|difficulty breathing|heart attack|stroke|suicid|kill myself|end my life|want to die|self[- ]?harm|overdose|unconscious|seizure|severe bleeding|poison/i;
  function context() {
    let p = {}; try { p = JSON.parse(localStorage.getItem('careMateProfile') || '{}') || {}; } catch (e) {}
    const a = parseInt(p.age, 10), g = !a ? '' : a < 13 ? 'child' : a < 18 ? 'teen' : a < 60 ? 'adult' : 'senior';
    return { condition: (p.condition || '').replace(/_/g, ' '), food: p.foodPref || '', ageGroup: g };         // never the name or email
  }
  async function askAI(q) {
    if (!window.CareMateAPI || !CareMateAPI.loggedIn()) return null;
    const r = await CareMateAPI.request('POST', '/api/chat', { messages: history.slice(-10), context: context() });
    if (r.ok) return r.data;
    return r.status === 429 ? { limit: r.error } : null;                 // offline, not set up or error: use built-in answers
  }
  async function send(q) {
    q = q.trim(); if (!q) return;
    log.querySelectorAll('.cb-more').forEach(n => n.remove());
    say(q, 'me'); history.push({ role: 'user', text: q });
    const t = typing();
    if (EMERGENCY.test(q)) { t.remove(); say('This could be serious. Please call 112 or 108 now, or go to the nearest hospital.', 'bot', { urgent: true }); history.push({ role: 'assistant', text: 'Advised calling 112.' }); return; }
    if (MAKER.test(q)) { t.remove(); say(MAKER_ANSWER, 'bot'); history.push({ role: 'assistant', text: MAKER_ANSWER }); followUps(['Where are you located?', 'How does CareMate work?']); return; }
    const ai = await askAI(q);
    if (ai && ai.reply) { t.remove(); say(ai.reply, 'bot', { urgent: ai.urgent }); history.push({ role: 'assistant', text: ai.reply }); followUps(ai.followUps); return; }
    if (ai && ai.limit) { t.remove(); say(ai.limit, 'bot'); return; }
    setTimeout(() => { t.remove(); answer(q); }, 450);
  }

  /* topic tabs + chips */
  function showTopic(id) {
    tabs.querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.id === id)));
    const tp = TOPICS.find(x => x.id === id); chips.innerHTML = '';
    tp.q.forEach(c => { const b = document.createElement('button'); b.type = 'button'; b.textContent = c; b.addEventListener('click', () => send(c)); chips.append(b); });
  }
  TOPICS.forEach(tp => {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.id = tp.id; b.setAttribute('role', 'tab');
    b.innerHTML = '<i class="fa-solid ' + tp.icon + '"></i><span>' + tp.label + '</span>';
    b.addEventListener('click', () => showTopic(tp.id)); tabs.append(b);
  });

  /* welcome message with an info card */
  function welcome() {
    log.innerHTML = '';
    say('Hi! I am your CareMate helper. Pick a topic below or type a question.', 'bot');
    const card = document.createElement('div'); card.className = 'cb-info';
    card.innerHTML =
      '<b>I can help with</b><ul>' +
      '<li><i class="fa-solid fa-utensils"></i> 7-day diet plans</li>' +
      '<li><i class="fa-solid fa-om"></i> Yoga &amp; meditation</li>' +
      '<li><i class="fa-solid fa-heart-pulse"></i> 20+ health conditions</li>' +
      '<li><i class="fa-solid fa-droplet"></i> Water &amp; reminders</li>' +
      '<li><i class="fa-solid fa-lock"></i> Privacy &amp; PIN lock</li>' +
      '<li><i class="fa-solid fa-user-doctor"></i> Dietitian on WhatsApp</li></ul>' +
      '<small><i class="fa-solid fa-location-dot"></i> Akola, Maharashtra · caremate92@gmail.com</small>';
    log.append(card); log.scrollTop = 0;
  }

  box.querySelector('form').addEventListener('submit', e => { e.preventDefault(); send(input.value); input.value = ''; });
  box.querySelector('.cb-clear').addEventListener('click', () => { welcome(); showTopic('start'); input.focus(); });
  const toggle = o => { box.hidden = !o; fab.classList.toggle('open', o); if (o) { if (!log.children.length) { welcome(); showTopic('start'); } input.focus(); } else fab.focus(); };
  fab.addEventListener('click', () => toggle(box.hidden));
  box.querySelector('.cb-x').addEventListener('click', () => toggle(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !box.hidden) toggle(false); });
})();
