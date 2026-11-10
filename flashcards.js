/* ============================================================
   Flashcards — Quizlet-style study sets built from decks.js.
   Put  <div class="fc-app" data-deck="v8"></div>  on any page, then load
   decks.js and flashcards.js. Four modes: Flashcards, Learn, Match, Test.
   Progress is saved per deck in this browser (localStorage "fc-<deck id>").
   Sound: lessons/audio/words/<word>.mp3 (made for every card), else My Dictionary's voice chain.
   ============================================================ */
(function () {
  const SCRIPT = document.currentScript;
  const here = path => SCRIPT && SCRIPT.src ? new URL(path, SCRIPT.src).href : path;
  const AUDIO = here('lessons/audio/words/');

  /* ---- helpers ---- */
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const slug = t => t.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’‘`]/g, "'").replace(/[.,!?;:"“”]/g, ' ').replace(/^to\s+/, '').replace(/\s+/g, ' ').trim();
  function dist(a, b) {   // Levenshtein, for "almost right"
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  // the example sentence with the term in bold (also catches simple forms: reigned, took over…)
  function highlight(c) {
    const e = esc(c.e), first = c.w.split(' ')[0];
    const re = new RegExp('\\b(' + first.slice(0, Math.max(3, first.length - 2)).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[a-z]*' +
      (c.w.includes(' ') ? '(?:\\s+[a-z’]+){0,2}?\\s+' + c.w.split(' ').slice(-1)[0] : '') + ')\\b', 'i');
    return re.test(e) ? e.replace(re, '<b>$1</b>') : e;
  }

  /* ---- sound ---- */
  let current = null;
  function say(text, btn) {
    if (current) { current.pause(); current = null; }
    if (window.speechSynthesis) speechSynthesis.cancel();
    const done = () => btn && btn.classList.remove('playing');
    if (btn) btn.classList.add('playing');
    const a = new Audio(AUDIO + slug(text) + '.mp3');
    current = a;
    a.onended = done;
    a.onerror = () => {   // no file: My Dictionary's chain (Google's British voice, then the device voice)
      if (window.Dictionary) { done(); window.Dictionary.speak(text); return; }
      if (!window.speechSynthesis) { done(); return; }
      const u = new SpeechSynthesisUtterance(text);
      const v = speechSynthesis.getVoices().find(v => v.lang === 'en-GB') || speechSynthesis.getVoices().find(v => /^en/.test(v.lang));
      if (v) u.voice = v;
      u.lang = 'en-GB'; u.rate = .9; u.onend = u.onerror = done;
      speechSynthesis.speak(u);
    };
    a.play().catch(() => {});
  }
  const sayBtn = (text, cls) => {
    const b = el('button', 'fc-say' + (cls ? ' ' + cls : ''));
    b.type = 'button'; b.setAttribute('aria-label', 'Listen: ' + text); b.title = 'Listen';
    b.addEventListener('click', e => { e.stopPropagation(); say(text, b); });
    return b;
  };
  const lvl = l => '<span class="fc-lvl fc-lvl-' + l.toLowerCase() + '">' + (l === 'PV' ? 'phrasal verb' : l) + '</span>';

  /* ============================================================ */
  function mount(root) {
    const deck = (window.DECKS || []).find(d => d.id === root.dataset.deck);
    if (!deck) { root.textContent = 'Deck not found: ' + root.dataset.deck; return; }
    const KEY = 'fc-' + deck.id;
    let st = {};
    try { st = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
    st.known = st.known || {};    // word → true
    st.stage = st.stage || {};    // Learn: word → 0, 1 (chose right), 2 (typed right = mastered)
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
    const cards = deck.cards;
    // the back of a culture-figure card (deck.imgBase + c.img = the portrait)
    const personSide = c =>
      '<div class="fc-pb">' + (c.img ? '<img class="fc-pimg" src="' + esc(here((deck.imgBase || '') + c.img)) + '" alt="" loading="lazy">' : '') +
      '<div class="fc-ptext"><div class="fc-ptr">' + esc(c.t) + '</div>' +
      (c.bio ? '<div class="fc-bio">' + esc(c.bio) + '</div>' : '') +
      (c.keys ? '<div class="fc-keys"><b>Names to know</b><ul>' + c.keys.map(k => Array.isArray(k) ? '<li><span>' + esc(k[0]) + '</span> ' + esc(k[1]) + '</li>' : '<li><span>' + esc(k) + '</span></li>').join('') + '</ul></div>' : '') +
      '<div class="fc-pfact">✨ ' + esc(c.e) + '</div>' + (c.n ? '<div class="fc-note">🔎 ' + esc(c.n) + '</div>' : '') +
      '</div></div>';

    /* ---- culture-figure decks: quiz the CONTENT of the cards, not the Russian name ---- */
    const PERSON = cards.some(c => c.keys || c.bio);
    const nameBits = c => c.w.replace(/^the\s+/i, '').split(/[\s.]+/).filter(x => x.length > 2 && !/^(van|von|de|sisters)$/i.test(x));
    const mask = (c, txt) => nameBits(c).reduce((t, b) => t.replace(new RegExp(b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\w*', 'gi'), '___'), txt);
    const keyName = k => Array.isArray(k) ? k[0] : k;
    const keyInfo = k => Array.isArray(k) ? k[1] : '';
    const ownsName = (c, k) => nameBits(c).some(b => new RegExp(b, 'i').test(keyName(k)));
    // a name that is on two cards (London, Westminster Abbey…) doesn't point to one person
    const keyCount = {};
    cards.forEach(c => new Set((c.keys || []).map(k => norm(keyName(k)))).forEach(n => { keyCount[n] = (keyCount[n] || 0) + 1; }));
    const unique = k => keyCount[norm(keyName(k))] === 1;
    const STOP = new Set('the a an of his her their in on at to for and with by from who what where that this is was as it its one first'.split(' '));
    const words = t => new Set(norm(t).split(' ').filter(w => w.length > 2 && !STOP.has(w)));
    // every clue that points to one person: a key + its explanation, the fact, the lateral clue, the bio, the portrait
    function clues(c) {
      const out = [];
      (c.keys || []).forEach(k => { if (!ownsName(c, k) && unique(k)) out.push({ html: '<b>' + esc(keyName(k)) + '</b>' + (keyInfo(k) ? ' — ' + esc(keyInfo(k)) : '') }); });
      if (c.e) out.push({ html: esc(mask(c, c.e)) });
      if (c.n) out.push({ html: '🔎 ' + esc(mask(c, c.n)) });
      if (c.bio) out.push({ html: esc(mask(c, c.bio.split(/(?<=\.)\s/).slice(0, 2).join(' '))) });
      if (c.img) out.push({ html: '<img class="fc-q-face" src="' + esc(here((deck.imgBase || '') + c.img)) + '" alt="">', face: true });
      return out;
    }
    const clue = c => { const all = clues(c); return all[Math.floor(Math.random() * all.length)]; };
    // person → detail: "which of these is <explanation>?" (distractors are other people's names-to-know)
    function detailQ(c) {
      const own = (c.keys || []).filter(k => keyInfo(k) && !ownsName(c, k) && unique(k));
      if (!own.length) return null;
      const k = own[Math.floor(Math.random() * own.length)];
      const mine = new Set((c.keys || []).map(x => norm(keyName(x))));
      const want = words(keyInfo(k));
      // wrong options of the same kind first: other people's names whose explanation shares a word (river, novel, birthplace…)
      const pool = shuffle(cards.filter(x => x !== c).flatMap(x => (x.keys || []).filter(y => !ownsName(x, y))))
        .filter((v, i, a) => !mine.has(norm(keyName(v))) && a.findIndex(z => norm(keyName(z)) === norm(keyName(v))) === i)
        .map(v => ({ v: keyName(v), score: [...words(keyInfo(v))].filter(w => want.has(w)).length }))
        .sort((a, b) => b.score - a.score);
      return { ask: '<b>' + esc(c.w) + '</b>: ' + esc(keyInfo(k)) + '?', right: keyName(k), opts: shuffle([keyName(k), ...pool.slice(0, 3).map(x => x.v)]) };
    }
    const nameOK = (c, typed) => {
      const t = norm(typed);
      return [c.w, c.w.replace(/^the\s+/i, ''), ...(c.a || [])].some(v => norm(v) === t) || (nameBits(c).length > 1 && norm(nameBits(c).slice(-1)[0]) === t);
    };

    root.innerHTML = '';
    const head = el('div', 'fc-head');
    head.innerHTML = '<div class="fc-title"><b>🃏 ' + esc(deck.name) + '</b><span>' + cards.length + ' cards</span></div>';
    const modes = el('div', 'fc-modes');
    const MODES = [['cards', '🃏 Flashcards'], ['learn', '🎯 Learn'], ['match', '🧩 Match'], ['test', '📝 Test']];
    MODES.forEach(([id, label]) => {
      const b = el('button', 'fc-mode', label); b.type = 'button'; b.dataset.mode = id;
      b.addEventListener('click', () => show(id));
      modes.appendChild(b);
    });
    head.appendChild(modes);
    const body = el('div', 'fc-body');
    root.append(head, body);

    function show(mode) {
      st.mode = mode; save();
      if (current) current.pause();
      modes.querySelectorAll('.fc-mode').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
      body.innerHTML = '';
      ({ cards: flashcards, learn, match, test })[mode]();
    }

    /* ---------------- FLASHCARDS ---------------- */
    function flashcards() {
      let order = st.order && st.order.length ? st.order.map(w => cards.find(c => c.w === w)).filter(Boolean) : cards.slice();
      let i = Math.min(st.pos || 0, order.length);
      const ruFirst = () => !!st.ruFirst;

      const bar = el('div', 'fc-tools');
      const shuf = el('button', 'fc-tool', '🔀 Shuffle'); shuf.type = 'button';
      const side = el('button', 'fc-tool', ''); side.type = 'button';
      const reset = el('button', 'fc-tool', '↺ Start again'); reset.type = 'button';
      bar.append(shuf, side, reset);

      const stage = el('div', 'fc-stage');
      const counts = el('div', 'fc-counts');
      const prog = el('div', 'fc-prog', '<div class="fc-prog-fill"></div>');
      body.append(bar, counts, prog, stage);

      function paintSide() { side.textContent = ruFirst() ? '🇷🇺 Russian first' : '🇬🇧 English first'; }
      function paintCounts() {
        const known = cards.filter(c => st.known[c.w]).length;
        counts.innerHTML = '<span class="k">✓ Know <b>' + known + '</b></span><span class="s">✗ Still learning <b>' +
          cards.filter(c => st.known[c.w] === false).length + '</b></span><span class="n">' + Math.min(i + 1, order.length) + ' / ' + order.length + '</span>';
        prog.firstChild.style.width = (i / order.length * 100) + '%';
      }
      function draw() {
        paintCounts();
        stage.innerHTML = '';
        if (i >= order.length) return finish();
        const c = order[i];
        const person = !!(c.img || c.bio);   // culture-figure card: portrait + who they were + names to know
        const card = el('div', 'fc-card' + (person ? ' fc-person' : ''));
        const en = '<div class="fc-term">' + esc(c.w) + '</div><div class="fc-meta">' + esc(c.p) + ' · ' + lvl(c.l) + '</div>';
        const ru = person ? personSide(c) :
          '<div class="fc-tr">' + esc(c.t) + '</div><div class="fc-ex">“' + highlight(c) + '”</div>' + (c.n ? '<div class="fc-note">💡 ' + esc(c.n) + '</div>' : '');
        card.innerHTML = '<div class="fc-inner"><div class="fc-face fc-front">' + (ruFirst() ? ru : en) + '<div class="fc-hint">tap to flip</div></div>' +
                         '<div class="fc-face fc-back">' + (ruFirst() ? en : ru) + '</div></div>';
        card.querySelectorAll('.fc-face').forEach(f => { if (f.querySelector('.fc-term')) f.appendChild(sayBtn(c.w, 'fc-say-corner')); });
        card.addEventListener('click', () => card.classList.toggle('flipped'));
        const btns = el('div', 'fc-judge');
        const no = el('button', 'fc-no', '✗ Still learning'); no.type = 'button';
        const yes = el('button', 'fc-yes', '✓ Know'); yes.type = 'button';
        const back = el('button', 'fc-prev', '‹ Back'); back.type = 'button'; back.title = 'Previous card'; back.disabled = i === 0;
        no.addEventListener('click', () => judge(false));
        yes.addEventListener('click', () => judge(true));
        back.addEventListener('click', () => { if (i > 0) { i--; st.pos = i; save(); draw(); } });
        btns.append(back, no, yes);
        stage.append(card, btns);
      }
      function judge(ok) {
        st.known[order[i].w] = ok; i++; st.pos = i; save(); draw();
      }
      function finish() {
        const left = cards.filter(c => !st.known[c.w]);
        const box = el('div', 'fc-done');
        box.innerHTML = '<div class="fc-big">' + (left.length ? '💪' : '🎉') + '</div><h3>' +
          (left.length ? 'Round finished: ' + (cards.length - left.length) + ' / ' + cards.length + ' known' : 'You know all ' + cards.length + ' cards!') + '</h3>';
        const row = el('div', 'fc-done-btns');
        if (left.length) {
          const again = el('button', 'btn btn-primary', '✗ Study the ' + left.length + ' “still learning” cards'); again.type = 'button';
          again.addEventListener('click', () => { order = shuffle(left); st.order = order.map(c => c.w); i = 0; st.pos = 0; save(); draw(); });
          row.appendChild(again);
        }
        const learnB = el('button', 'btn btn-ghost', '🎯 Go to Learn'); learnB.type = 'button';
        learnB.addEventListener('click', () => show('learn'));
        row.appendChild(learnB);
        box.appendChild(row);
        stage.appendChild(box);
      }
      shuf.addEventListener('click', () => { order = shuffle(order); st.order = order.map(c => c.w); i = 0; st.pos = 0; save(); draw(); });
      side.addEventListener('click', () => { st.ruFirst = !st.ruFirst; save(); paintSide(); draw(); });
      reset.addEventListener('click', () => { if (!confirm('Start the deck again? Your “know / still learning” marks are cleared.')) return; st.known = {}; st.order = null; order = cards.slice(); i = 0; st.pos = 0; save(); draw(); });
      document.onkeydown = e => {
        if (!root.isConnected || st.mode !== 'cards' || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
        const card = stage.querySelector('.fc-card');
        if (e.key === ' ' && card) { e.preventDefault(); card.classList.toggle('flipped'); }
        if (e.key === 'ArrowRight' && card) judge(true);
        if (e.key === 'ArrowLeft' && card) judge(false);
      };
      paintSide(); draw();
    }

    /* ---------------- LEARN ---------------- */
    // stage 0 → choose the translation · stage 1 → type the English word · stage 2 = mastered
    function learn() {
      const stg = c => st.stage[c.w] || 0;
      const prog = el('div', 'fc-learn-prog');
      const stage = el('div', 'fc-stage');
      body.append(prog, stage);
      let batch = [];
      function paintProg() {
        const m = cards.filter(c => stg(c) === 2).length, half = cards.filter(c => stg(c) === 1).length;
        prog.innerHTML = '<div class="fc-lp-row"><span>🌱 New <b>' + (cards.length - m - half) + '</b></span><span>📈 Learning <b>' + half +
          '</b></span><span>🏆 Mastered <b>' + m + ' / ' + cards.length + '</b></span></div>' +
          '<div class="fc-prog"><div class="fc-prog-fill" style="width:' + (m / cards.length * 100) + '%"></div><div class="fc-prog-half" style="left:' +
          (m / cards.length * 100) + '%;width:' + (half / cards.length * 100) + '%"></div></div>';
      }
      function next() {
        paintProg();
        stage.innerHTML = '';
        const open = cards.filter(c => stg(c) < 2);
        if (!open.length) {
          const box = el('div', 'fc-done', '<div class="fc-big">🏆</div><h3>All ' + cards.length + ' cards mastered!</h3>');
          const again = el('button', 'btn btn-ghost', '↺ Learn again from zero'); again.type = 'button';
          again.addEventListener('click', () => { st.stage = {}; save(); next(); });
          const t = el('button', 'btn btn-primary', '📝 Take the Test'); t.type = 'button';
          t.addEventListener('click', () => show('test'));
          const row = el('div', 'fc-done-btns'); row.append(t, again); box.appendChild(row);
          stage.appendChild(box); return;
        }
        batch = batch.filter(c => stg(c) < 2);
        if (!batch.length) batch = shuffle(open).slice(0, 7);   // 7 cards at a time
        const c = batch[Math.floor(Math.random() * batch.length)];
        if (PERSON) { stg(c) === 0 ? pChoose(c) : (Math.random() < .5 && detailQ(c) ? pDetail(c) : pWrite(c)); return; }
        stg(c) === 0 ? choose(c) : write(c);
      }
      function mark(c, ok) { st.stage[c.w] = ok ? Math.min(2, stg(c) + 1) : 0; save(); }
      function feedback(ok, c, typed, onRight, why) {
        const f = el('div', 'fc-feedback ' + (ok ? 'ok' : 'bad'));
        f._why = why || '';
        f.innerHTML = ok ? '✓ Correct!' : '✗ The answer: <b>' + esc(c.w) + '</b>' + (PERSON ? (f._why ? ' · ' + f._why : '') : ' = ' + esc(c.t)) + (typed ? '<br><small>You wrote: ' + esc(typed) + '</small>' : '');
        const row = el('div', 'fc-fb-btns');
        if (!ok && onRight) {
          const right = el('button', 'btn btn-ghost', 'I was right'); right.type = 'button';
          right.addEventListener('click', () => { onRight(); next(); });
          row.appendChild(right);
        }
        const go = el('button', 'btn btn-primary', 'Continue →'); go.type = 'button';
        go.addEventListener('click', next);
        row.appendChild(go);
        f.appendChild(row);
        stage.appendChild(f);
        if (ok) setTimeout(() => { if (f.isConnected) next(); }, 900);
        else go.focus();
      }
      function choose(c) {
        const box = el('div', 'fc-q');
        box.innerHTML = '<div class="fc-q-label">Choose the translation</div><div class="fc-q-term">' + esc(c.w) + '</div><div class="fc-meta">' + esc(c.p) + ' · ' + lvl(c.l) + '</div>';
        box.querySelector('.fc-q-term').appendChild(sayBtn(c.w));
        const opts = shuffle([c, ...shuffle(cards.filter(x => x !== c)).slice(0, 3)]);
        const grid = el('div', 'fc-opts');
        opts.forEach(o => {
          const b = el('button', 'fc-opt', esc(o.t)); b.type = 'button';
          b.addEventListener('click', () => {
            grid.querySelectorAll('button').forEach(x => x.disabled = true);
            const ok = o === c;
            b.classList.add(ok ? 'ok' : 'bad');
            if (!ok) [...grid.children][opts.indexOf(c)].classList.add('ok');
            mark(c, ok); feedback(ok, c);
          });
          grid.appendChild(b);
        });
        box.appendChild(grid);
        stage.appendChild(box);
      }
      // culture figures, step 1: a clue → choose the person
      function pChoose(c) {
        const q = clue(c);
        const box = el('div', 'fc-q');
        box.innerHTML = '<div class="fc-q-label">' + (q.face ? 'Who is this?' : 'Who is it?') + '</div><div class="fc-q-clue">' + q.html + '</div>';
        const opts = shuffle([c, ...shuffle(cards.filter(x => x !== c)).slice(0, 3)]);
        const grid = el('div', 'fc-opts');
        opts.forEach(o => {
          const b = el('button', 'fc-opt', esc(o.w)); b.type = 'button';
          b.addEventListener('click', () => {
            grid.querySelectorAll('button').forEach(x => x.disabled = true);
            const ok = o === c;
            b.classList.add(ok ? 'ok' : 'bad');
            if (!ok) [...grid.children][opts.indexOf(c)].classList.add('ok');
            mark(c, ok); feedback(ok, c, '', null, esc(c.p));
          });
          grid.appendChild(b);
        });
        box.appendChild(grid);
        stage.appendChild(box);
      }
      // culture figures, step 2a: the person → choose the right detail
      function pDetail(c) {
        const q = detailQ(c);
        const box = el('div', 'fc-q');
        box.innerHTML = '<div class="fc-q-label">Which one?</div><div class="fc-q-clue">' + q.ask + '</div>';
        const grid = el('div', 'fc-opts');
        q.opts.forEach((o, oi) => {
          const b = el('button', 'fc-opt', esc(o)); b.type = 'button';
          b.addEventListener('click', () => {
            grid.querySelectorAll('button').forEach(x => x.disabled = true);
            const ok = o === q.right;
            b.classList.add(ok ? 'ok' : 'bad');
            if (!ok) [...grid.children][q.opts.indexOf(q.right)].classList.add('ok');
            mark(c, ok); feedback(ok, c, '', null, esc(q.right));
          });
          grid.appendChild(b);
        });
        box.appendChild(grid);
        stage.appendChild(box);
      }
      // culture figures, step 2b: a clue → type the name
      function pWrite(c) {
        const q = clue(c);
        const box = el('div', 'fc-q');
        box.innerHTML = '<div class="fc-q-label">Who is it? Type the name</div><div class="fc-q-clue">' + q.html + '</div>';
        const form = el('form', 'fc-write');
        form.innerHTML = '<input type="text" autocomplete="off" spellcheck="false" placeholder="First name and surname…"><button class="btn btn-primary" type="submit">Answer</button>';
        const inp = form.querySelector('input');
        const skip = el('button', 'fc-skip', 'Don’t know'); skip.type = 'button';
        form.appendChild(skip);
        const answer = typed => {
          inp.disabled = true; form.querySelectorAll('button').forEach(x => x.disabled = true);
          const ok = nameOK(c, typed);
          if (!ok && typed && dist(norm(typed), norm(c.w)) <= 2) inp.value += '   ← almost: check the spelling';
          mark(c, ok);
          feedback(ok, c, ok ? '' : typed, () => { st.stage[c.w] = 2; save(); }, esc(c.p));
        };
        form.addEventListener('submit', e => { e.preventDefault(); if (inp.value.trim()) answer(inp.value); });
        skip.addEventListener('click', () => answer(''));
        box.appendChild(form);
        stage.appendChild(box);
        setTimeout(() => inp.focus(), 50);
      }
      function write(c) {
        const box = el('div', 'fc-q');
        box.innerHTML = '<div class="fc-q-label">Type the English word</div><div class="fc-q-term ru">' + esc(c.t) + '</div>' +
          '<div class="fc-meta">' + esc(c.p) + (c.n ? ' · 💡 ' + esc(c.n.replace(new RegExp(c.w, 'ig'), '___')) : '') + '</div>';
        const form = el('form', 'fc-write');
        form.innerHTML = '<input type="text" autocomplete="off" spellcheck="false" placeholder="Type in English…"><button class="btn btn-primary" type="submit">Answer</button>';
        const inp = form.querySelector('input');
        const skip = el('button', 'fc-skip', 'Don’t know'); skip.type = 'button';
        form.appendChild(skip);
        const answer = typed => {
          inp.disabled = true; form.querySelectorAll('button').forEach(x => x.disabled = true);
          const ok = norm(typed) === norm(c.w);
          const close = !ok && typed && dist(norm(typed), norm(c.w)) <= 1;
          mark(c, ok);
          if (close) inp.value += '   ← almost: check the spelling';
          feedback(ok, c, ok ? '' : typed, () => { st.stage[c.w] = 2; save(); });
          if (ok) say(c.w);
        };
        form.addEventListener('submit', e => { e.preventDefault(); if (inp.value.trim()) answer(inp.value); });
        skip.addEventListener('click', () => answer(''));
        box.appendChild(form);
        stage.appendChild(box);
        setTimeout(() => inp.focus(), 50);
      }
      next();
    }

    /* ---------------- MATCH ---------------- */
    function match() {
      const info = el('div', 'fc-match-top');
      const grid = el('div', 'fc-match');
      body.append(info, grid);
      let t0 = 0, timer = null, left = 0, penalty = 0;
      function start() {
        clearInterval(timer);
        const set = shuffle(cards).slice(0, 6);
        left = set.length; penalty = 0;
        const other = c => { if (!PERSON) return c.t; const ks = (c.keys || []).filter(k => !ownsName(c, k)); return ks.length ? keyName(ks[Math.floor(Math.random() * ks.length)]) : c.t; };
        const tiles = shuffle([...set.map(c => ({ c, side: 'en', txt: c.w })), ...set.map(c => ({ c, side: 'ru', txt: other(c) }))]);
        grid.innerHTML = '';
        let picked = null;
        tiles.forEach(tl => {
          const b = el('button', 'fc-tile ' + tl.side, esc(tl.txt)); b.type = 'button';
          b.addEventListener('click', () => {
            if (b.classList.contains('gone')) return;
            if (!picked) { picked = { b, tl }; b.classList.add('sel'); return; }
            if (picked.b === b) { b.classList.remove('sel'); picked = null; return; }
            const ok = picked.tl.c === tl.c && picked.tl.side !== tl.side;
            const a = picked.b; picked = null;
            if (ok) {
              [a, b].forEach(x => { x.classList.remove('sel'); x.classList.add('right'); setTimeout(() => x.classList.add('gone'), 250); });
              if (--left === 0) finish();
            } else {
              penalty += 1;
              [a, b].forEach(x => { x.classList.remove('sel'); x.classList.add('wrong'); setTimeout(() => x.classList.remove('wrong'), 450); });
            }
          });
          grid.appendChild(b);
        });
        t0 = Date.now();
        timer = setInterval(paint, 100);
        paint();
      }
      const secs = () => (Date.now() - t0) / 1000 + penalty;
      function paint() {
        info.innerHTML = '<span>' + (PERSON ? 'Match each person with a name from their card' : 'Match each word with its translation') + ' · a wrong pair adds <b>+1 s</b></span><span class="fc-clock">⏱ ' + secs().toFixed(1) + ' s</span>' +
          (st.best ? '<span class="fc-best">🏅 Best ' + st.best.toFixed(1) + ' s</span>' : '');
        if (!root.isConnected || st.mode !== 'match') clearInterval(timer);
      }
      function finish() {
        clearInterval(timer);
        const s = secs(), best = !st.best || s < st.best;
        if (best) { st.best = s; save(); }
        paint();
        const box = el('div', 'fc-done', '<div class="fc-big">' + (best ? '🏅' : '⏱') + '</div><h3>' + s.toFixed(1) + ' seconds' + (best ? ': a new best!' : '') + '</h3>');
        const again = el('button', 'btn btn-primary', '↺ Play again'); again.type = 'button';
        again.addEventListener('click', start);
        const row = el('div', 'fc-done-btns'); row.appendChild(again); box.appendChild(row);
        setTimeout(() => { grid.innerHTML = ''; grid.appendChild(box); }, 300);
      }
      start();
    }

    /* ---------------- TEST ---------------- */
    function test() {
      const n = Math.min(12, cards.length);
      const pick = shuffle(cards).slice(0, n);
      // 5 × choose the Russian, 3 × choose the English, the rest × write the English
      const qs = pick.map((c, k) => ({ c, type: PERSON ? (k < 5 ? 'p-who' : k < 9 && detailQ(c) ? 'p-detail' : 'p-write') : (k < 5 ? 'mc-ru' : k < 8 ? 'mc-en' : 'write') }));
      const form = el('form', 'fc-test');
      qs.forEach((q, k) => {
        const box = el('div', 'fc-tq');
        box.innerHTML = '<div class="fc-tq-n">' + (k + 1) + '</div>';
        const main = el('div', 'fc-tq-main');
        if (q.type === 'p-write') {
          q.clue = clue(q.c);
          main.innerHTML = '<div class="fc-tq-ask">Who is it? Write the name.</div><div class="fc-q-clue sm">' + q.clue.html + '</div><input type="text" autocomplete="off" spellcheck="false">';
        } else if (q.type === 'p-who' || q.type === 'p-detail') {
          let ask, opts, labels;
          if (q.type === 'p-who') {
            q.clue = clue(q.c);
            ask = '<div class="fc-tq-ask">Who is it?</div><div class="fc-q-clue sm">' + q.clue.html + '</div>';
            opts = shuffle([q.c, ...shuffle(cards.filter(x => x !== q.c)).slice(0, 3)]); labels = opts.map(o => o.w);
          } else {
            const d = detailQ(q.c); q.right = d.right;
            ask = '<div class="fc-tq-ask">' + d.ask + '</div>'; opts = d.opts; labels = d.opts;
          }
          main.innerHTML = ask;
          const og = el('div', 'fc-tq-opts');
          labels.forEach((t, oi) => og.appendChild(el('label', 'fc-tq-opt', '<input type="radio" name="q' + k + '" value="' + oi + '"> <span>' + esc(t) + '</span>')));
          q.opts = opts;
          main.appendChild(og);
        } else if (q.type === 'write') {
          main.innerHTML = '<div class="fc-tq-ask">Write in English: <b>' + esc(q.c.t) + '</b></div><input type="text" autocomplete="off" spellcheck="false">';
        } else {
          const en = q.type === 'mc-ru';
          main.innerHTML = '<div class="fc-tq-ask">' + (en ? 'Translate: <b>' + esc(q.c.w) + '</b>' : 'Which English word means <b>' + esc(q.c.t) + '</b>?') + '</div>';
          const opts = shuffle([q.c, ...shuffle(cards.filter(x => x !== q.c)).slice(0, 3)]);
          const og = el('div', 'fc-tq-opts');
          opts.forEach((o, oi) => {
            const lab = el('label', 'fc-tq-opt', '<input type="radio" name="q' + k + '" value="' + oi + '"> <span>' + esc(en ? o.t : o.w) + '</span>');
            og.appendChild(lab);
          });
          q.opts = opts;
          main.appendChild(og);
        }
        box.appendChild(main);
        q.box = box;
        form.appendChild(box);
      });
      const foot = el('div', 'fc-test-foot', '<button class="btn btn-primary" type="submit">Check my test</button>');
      form.appendChild(foot);
      form.addEventListener('submit', e => {
        e.preventDefault();
        let score = 0;
        qs.forEach((q, k) => {
          let ok, given;
          const target = q.type === 'p-detail' ? q.right : q.c;
          if (q.type === 'write' || q.type === 'p-write') {
            const inp = q.box.querySelector('input'); given = inp.value;
            ok = q.type === 'p-write' ? nameOK(q.c, given) : norm(given) === norm(q.c.w); inp.disabled = true;
          } else {
            const r = q.box.querySelector('input:checked');
            ok = r && q.opts[+r.value] === target;
            q.box.querySelectorAll('.fc-tq-opt').forEach((lab, oi) => {
              lab.querySelector('input').disabled = true;
              if (q.opts[oi] === target) lab.classList.add('ok');
              else if (r && +r.value === oi) lab.classList.add('bad');
            });
          }
          if (ok) score++;
          q.box.classList.add(ok ? 'ok' : 'bad');
          if (!ok) q.box.querySelector('.fc-tq-main').insertAdjacentHTML('beforeend', '<div class="fc-tq-key">✓ ' + (PERSON ? (q.type === 'p-detail' ? esc(q.right) : esc(q.c.w) + ' · ' + esc(q.c.p)) : esc(q.c.w) + ' = ' + esc(q.c.t)) + '</div>');
          if (!ok) st.known[q.c.w] = false;   // goes back into "still learning"
        });
        save();
        foot.innerHTML = '<div class="fc-test-score">' + score + ' / ' + qs.length + (score === qs.length ? ' 🎉' : '') + '</div>';
        const again = el('button', 'btn btn-ghost', '↺ New test'); again.type = 'button';
        again.addEventListener('click', () => show('test'));
        foot.appendChild(again);
        foot.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      body.appendChild(form);
    }

    show(st.mode || 'cards');
  }

  /* ============================================================
     WORD LIST — <div class="fc-list" data-deck="v8"></div>
     every word of a deck on one page: grouped B2 · C1 · phrasal verbs,
     with sound, translation and example. "Hide Russian" turns it into a self-test.
     ============================================================ */
  function wordList(root) {
    const deck = (window.DECKS || []).find(d => d.id === root.dataset.deck);
    if (!deck) { root.textContent = 'Deck not found: ' + root.dataset.deck; return; }
    const isPV = c => /phr/.test(c.p);
    const groups = [
      ['B2 words', 'b2', deck.cards.filter(c => !isPV(c) && c.l === 'B2')],
      ['C1 words', 'c1', deck.cards.filter(c => !isPV(c) && c.l === 'C1')],
      ['Other words', 'b1', deck.cards.filter(c => !isPV(c) && !/^(B2|C1)$/.test(c.l))],
      ['Phrasal verbs', 'pv', deck.cards.filter(isPV)]
    ].filter(g => g[2].length);
    root.innerHTML = '';
    const top = el('div', 'fc-list-top');
    top.innerHTML = '<span class="fc-list-count">' + deck.cards.length + ' words · ' + groups.map(g => g[2].length + ' ' + g[0].replace(' words', '')).join(' · ') + '</span>';
    const hide = el('button', 'fc-tool', '🙈 Hide Russian'); hide.type = 'button';
    hide.addEventListener('click', () => {
      const on = root.classList.toggle('fc-list-test');
      hide.textContent = on ? '👀 Show Russian' : '🙈 Hide Russian';
    });
    top.appendChild(hide);
    root.appendChild(top);
    groups.forEach(([title, cls, cards]) => {
      const h = el('div', 'fc-list-head fc-lh-' + cls, esc(title) + ' <span>' + cards.length + '</span>');
      const grid = el('div', 'fc-list-grid');
      cards.forEach(c => {
        const item = el('div', 'fc-word fc-w-' + cls);
        item.innerHTML =
          '<div class="fc-word-top"><span class="fc-word-term">' + esc(c.w) + '</span><span class="fc-word-pos">' + esc(c.p) + '</span></div>' +
          '<div class="fc-word-tr" title="Tap to show">' + esc(c.t) + '</div>' +
          '<div class="fc-word-ex">' + highlight(c) + '</div>' +
          (c.n ? '<div class="fc-word-note">💡 ' + esc(c.n) + '</div>' : '');
        item.querySelector('.fc-word-top').appendChild(sayBtn(c.w));
        item.querySelector('.fc-word-tr').addEventListener('click', e => e.currentTarget.classList.toggle('peek'));
        grid.appendChild(item);
      });
      root.append(h, grid);
    });
  }

  function init() {
    document.querySelectorAll('.fc-app[data-deck]').forEach(mount);
    document.querySelectorAll('.fc-list[data-deck]').forEach(wordList);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.Flashcards = { mount, wordList, say };
})();
