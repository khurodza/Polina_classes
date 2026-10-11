/* ============================================================
   My Dictionary — Polina's personal word list.
   Loaded by every page. On the home page and lesson pages it adds a
   "+ Word" button in the corner and an "📖 Add to dictionary" bubble
   under selected text. On dictionary.html it also draws the full list.

   Words live in a Google Sheet (see GUIDE.md → "My Dictionary").
   A copy is kept in localStorage, so the list shows instantly and
   words added offline are sent the next time the site is online.

   Pronunciation: a recording from lessons/audio/words/ if there is
   one (every flashcard word has one), else Google's British voice
   (words and phrases), else the device's own English voice.

   To switch the buttons off on one page (e.g. during a mock test),
   load the script with data-off:  <script src="../dictionary.js" data-off></script>
   ============================================================ */
(function () {
  /* ---- settings ---- */
  const API = 'https://script.google.com/macros/s/AKfycbz4Qg7s1TOpngkXQGfKO0m1g6b3STCYmA7a2zhA5ICJbY8RGzn8J0GFva4q-y-GL09V/exec';   // ← paste the Apps Script web app URL here (ends in /exec)
  const KEY = '2iu2YZP5xj3GSy7zZfRNQlhAdm4gYqYM';   // must match SECRET in dictionary-apps-script.gs
  const LANG = 'ru';                                  // translate into Russian
  const LANG_NAME = 'Russian';

  const CACHE_KEY = 'polina-dictionary-words';
  const QUEUE_KEY = 'polina-dictionary-queue';

  const SCRIPT = document.currentScript;
  const here = path => SCRIPT && SCRIPT.src ? new URL(path, SCRIPT.src).href : path;
  const WORDS_AUDIO = here('lessons/audio/words/');
  const DICT_HREF = here('dictionary.html');

  /* ---- localStorage helpers ---- */
  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
  }
  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  let words = readJSON(CACHE_KEY, []);
  let queue = readJSON(QUEUE_KEY, []);
  let status = API ? 'idle' : 'notset';   // idle | syncing | saved | offline | notset
  const listeners = [];

  function changed() {
    writeJSON(CACHE_KEY, words);
    writeJSON(QUEUE_KEY, queue);
    listeners.forEach(fn => fn());
  }
  function setStatus(s) { status = s; listeners.forEach(fn => fn()); }

  function clean(w) {
    return {
      id: String(w.id || ''),
      word: String(w.word || '').trim(),
      translation: String(w.translation || '').trim(),
      note: String(w.note || '').trim(),
      added: w.added ? String(w.added) : ''
    };
  }

  /* ---- talking to the Google Sheet ---- */
  async function post(body) {
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },   // avoids a CORS preflight Apps Script can't answer
      body: JSON.stringify(Object.assign({ key: KEY }, body))
    });
    const res = await r.json();
    if (res.error) throw new Error(res.error);
  }

  async function flush() {
    while (queue.length) {
      await post(queue[0]);
      queue.shift();
      writeJSON(QUEUE_KEY, queue);
    }
  }

  let syncing = null;
  function sync() {
    if (!API) { setStatus('notset'); return Promise.resolve(); }   // sheet not connected yet: keep words on this device
    if (syncing) return syncing;
    setStatus('syncing');
    syncing = (async () => {
      try {
        await flush();
        const r = await fetch(API + '?key=' + encodeURIComponent(KEY));
        const res = await r.json();
        if (res.error) throw new Error(res.error);
        // sheet headers may carry stray spaces or capitals ("Translation ") — normalise them
        const tidy = row => Object.fromEntries(Object.entries(row).map(([k, v]) => [k.trim().toLowerCase(), v]));
        words = res.words.map(tidy).map(clean).filter(w => w.word);
        changed();
        setStatus('saved');
      } catch (e) {
        setStatus('offline');
      } finally {
        syncing = null;
      }
    })();
    return syncing;
  }

  function find(word) {
    const w = word.trim().toLowerCase();
    return words.find(x => x.word.toLowerCase() === w);
  }

  function add(word, translation, note) {
    const w = clean({
      id: (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2)),
      word: word.replace(/^=+/, ''),   // a leading "=" would turn into a formula in the sheet
      translation: translation.replace(/^=+/, ''),
      note: (note || '').replace(/^=+/, ''),
      added: new Date().toISOString()
    });
    words.push(w);
    queue.push({ action: 'add', word: w });
    changed();
    sync();
    return w;
  }

  function remove(id) {
    if (!id) return;
    words = words.filter(w => w.id !== id);
    const i = queue.findIndex(q => q.action === 'add' && q.word.id === id);
    if (i >= 0) queue.splice(i, 1);        // never reached the sheet — just forget it
    else queue.push({ action: 'delete', id });
    changed();
    sync();
  }

  /* ---- translation suggestions (MyMemory, free, no key); only answers in Russian letters ---- */
  async function suggest(text) {
    const url = 'https://api.mymemory.translated.net/get?langpair=en|' + LANG + '&q=' + encodeURIComponent(text);
    const res = await (await fetch(url)).json();
    const out = [];
    const push = t => {
      t = String(t || '').trim();
      if (t && !/MYMEMORY|QUERY LENGTH/i.test(t) && /[а-яё]/i.test(t) && !out.some(o => o.toLowerCase() === t.toLowerCase())) out.push(t);
    };
    push(res.responseData && res.responseData.translatedText);
    (res.matches || []).sort((a, b) => b.match - a.match).forEach(m => push(m.translation));
    return out.slice(0, 4);
  }

  /* ---- pronunciation ---- */
  // Google's British voice refuses requests that say which website they come from, so this page
  // doesn't send its address with requests (nothing else on the site needs it).
  if (!document.querySelector('meta[name="referrer"]')) {
    const m = document.createElement('meta');
    m.name = 'referrer'; m.content = 'no-referrer';
    document.head.prepend(m);
  }
  const googleVoice = text => 'https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=en-GB&q=' + encodeURIComponent(text.slice(0, 190));
  let current = null, currentBtn = null, playToken = 0;

  function stop() {
    playToken++;
    if (current) { current.pause(); current = null; }
    if (window.speechSynthesis) speechSynthesis.cancel();
    if (currentBtn) currentBtn.classList.remove('playing');
    currentBtn = null;
  }

  function fileName(text) {
    return text.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  // last resort: the device's own voice. Prefer the natural-sounding ones where the device has them.
  const GOOD_VOICE = /natural|neural|premium|enhanced|google uk english|daniel|serena|kate|arthur|martha|libby|sonia|ryan/i;
  function tts(text, done) {
    if (!window.speechSynthesis) { done(); return; }
    const u = new SpeechSynthesisUtterance(text);
    const en = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang));
    const gb = en.filter(v => /GB/i.test(v.lang));
    const v = gb.find(v => GOOD_VOICE.test(v.name)) || en.find(v => GOOD_VOICE.test(v.name)) || gb[0] || en[0];
    if (v) u.voice = v;
    u.lang = v ? v.lang : 'en-GB';
    u.rate = 0.9;
    u.onend = u.onerror = done;
    speechSynthesis.speak(u);
  }

  function playUrl(url, wait) {
    return new Promise((resolve, reject) => {
      const a = new Audio(url);
      current = a;
      const slow = setTimeout(() => { a.pause(); reject(); }, wait);   // won't start in time: move on
      a.onplaying = () => clearTimeout(slow);
      a.onended = () => resolve(true);
      a.onerror = () => { clearTimeout(slow); reject(); };
      a.play().catch(() => { clearTimeout(slow); reject(); });
    });
  }

  async function speak(text, btn) {
    const same = btn && currentBtn === btn;
    stop();
    if (same || !text.trim()) return;
    const mine = playToken;   // a newer speak() or stop() changes playToken
    currentBtn = btn || null;
    if (btn) btn.classList.add('playing');
    const done = () => { if (btn) btn.classList.remove('playing'); if (currentBtn === btn) currentBtn = null; };
    const tryUrl = async (url, wait) => {
      if (mine !== playToken) return false;
      try { await playUrl(url, wait); return true; } catch (e) { return false; }
    };
    // 1. our own recording (every flashcard word has one) · 2. Google's British voice · 3. the device's voice
    if (await tryUrl(WORDS_AUDIO + fileName(text) + '.mp3', 2500)) { done(); return; }
    if (await tryUrl(googleVoice(text), 2500)) { done(); return; }
    if (mine !== playToken) return;
    tts(text, done);
  }

  /* ---- small message at the bottom of the screen ---- */
  function toast(msg) {
    let t = document.getElementById('dictToast');
    if (!t) {
      t = el('div', 'dict-toast');
      t.id = 'dictToast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 1900);
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function shake(input) {
    input.classList.remove('dict-shake'); void input.offsetWidth; input.classList.add('dict-shake');
    input.focus();
  }

  /* ============================================================
     ADD-WORD FORM — used both in the pop-up window and on
     dictionary.html. Fills `box` with the fields and buttons.
     ============================================================ */
  function buildForm(box, opts) {
    box.innerHTML =
      '<label class="dict-field"><span>English word or phrase</span>' +
        '<span class="dict-input-row"><input type="text" name="word" maxlength="80" autocomplete="off" placeholder="e.g. set off">' +
        '<button type="button" class="dict-say dict-listen" aria-label="Listen"></button></span></label>' +
      '<label class="dict-field"><span>' + LANG_NAME + '</span>' +
        '<span class="dict-input-row"><input type="text" name="translation" maxlength="120" autocomplete="off" placeholder="Translation">' +
        '<button type="button" class="btn btn-ghost dict-suggest">Suggest</button></span></label>' +
      '<div class="dict-suggestions" hidden></div>' +
      '<label class="dict-field"><span>Note <i>(optional)</i></span>' +
        '<input type="text" name="note" maxlength="120" autocomplete="off" placeholder="e.g. Lesson 9, set off on a journey"></label>' +
      '<p class="dict-msg" aria-live="polite"></p>' +
      '<div class="btn-row"><button type="submit" class="btn btn-primary">+ Add to my dictionary</button></div>';

    const form = box.closest('form');
    const word = box.querySelector('[name=word]');
    const tr = box.querySelector('[name=translation]');
    const note = box.querySelector('[name=note]');
    const msg = box.querySelector('.dict-msg');
    const sug = box.querySelector('.dict-suggestions');
    const sugBtn = box.querySelector('.dict-suggest');

    if (opts.word) word.value = opts.word;

    box.querySelector('.dict-listen').addEventListener('click', e => speak(word.value, e.currentTarget));

    const checkDuplicate = () => {
      const old = find(word.value);
      msg.className = 'dict-msg' + (old ? ' warn' : '');
      msg.textContent = old ? 'Already in your dictionary: ' + old.word + ' = ' + old.translation : '';
    };
    word.addEventListener('input', () => { sug.hidden = true; checkDuplicate(); });
    checkDuplicate();

    sugBtn.addEventListener('click', async () => {
      const text = word.value.trim();
      if (!text) { word.focus(); return; }
      sugBtn.disabled = true;
      sugBtn.textContent = '…';
      try {
        const list = await suggest(text);
        sug.innerHTML = '';
        if (!list.length) throw new Error();
        sug.appendChild(el('span', 'dict-sug-label', 'Tap one:'));
        list.forEach(t => {
          const b = el('button', 'dict-chip', t);
          b.type = 'button';
          b.addEventListener('click', () => { tr.value = t; sug.hidden = true; tr.focus(); });
          sug.appendChild(b);
        });
        if (!tr.value) tr.value = list[0];
        sug.hidden = false;
      } catch (e) {
        msg.className = 'dict-msg warn';
        msg.textContent = 'No suggestion right now. Type the translation yourself.';
      }
      sugBtn.disabled = false;
      sugBtn.textContent = 'Suggest';
    });

    form.addEventListener('submit', e => {
      e.preventDefault();
      const missing = !word.value.trim() ? word : !tr.value.trim() ? tr : null;
      if (missing) { shake(missing); return; }
      const w = add(word.value, tr.value, note.value);
      toast('Added: ' + w.word);
      form.reset();
      sug.hidden = true;
      msg.textContent = '';
      if (opts.onAdded) opts.onAdded(w);
      else word.focus();
    });

    return { word, tr, sugBtn };
  }

  /* ============================================================
     "+ Word" BUTTON + pop-up window (all other pages)
     ============================================================ */
  function openDialog(prefill) {
    const overlay = el('div', 'dict-overlay');
    overlay.innerHTML =
      '<form class="dict-dialog" role="dialog" aria-modal="true" aria-labelledby="dictDlgTitle">' +
        '<button type="button" class="dict-close" aria-label="Close">×</button>' +
        '<h2 id="dictDlgTitle">📖 New word</h2>' +
        '<div class="dict-form"></div>' +
        '<a class="dict-open-link" href="' + DICT_HREF + '">Open my dictionary →</a>' +
      '</form>';
    document.body.appendChild(overlay);
    document.body.classList.add('dict-open');

    const close = () => {
      stop();
      overlay.classList.add('closing');
      document.body.classList.remove('dict-open');
      document.removeEventListener('keydown', onKey);
      setTimeout(() => overlay.remove(), 220);
    };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('.dict-close').addEventListener('click', close);

    const f = buildForm(overlay.querySelector('.dict-form'), { word: prefill, onAdded: close });
    setTimeout(() => (prefill ? f.tr : f.word).focus(), 50);
    if (prefill && !find(prefill)) f.sugBtn.click();   // selected text: fetch a translation straight away
  }

  /* the selected text, tidied: "  cat." → "cat"; '' if nothing usable */
  function selectedText() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return '';
    const node = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
    if (node && node.closest('input, textarea, select, .dict-overlay, .dict-pop')) return '';
    const t = String(sel).replace(/\s+/g, ' ').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}’']+$/gu, '').replace(/[’']+$/, '');
    return t.length <= 80 && /\p{L}/u.test(t) ? t : '';
  }

  function addFloatingButton() {
    const fab = el('button', 'dict-fab', '+ Word');
    fab.type = 'button';
    fab.title = 'Add a word to my dictionary (select a word in the text first)';
    let picked = '';
    // read the selection before the tap clears it
    fab.addEventListener('pointerdown', () => { picked = selectedText(); });
    fab.addEventListener('click', () => { openDialog(picked); picked = ''; });
    document.body.appendChild(fab);
  }

  /* ============================================================
     SELECTION BUBBLE — select a word or phrase anywhere in the
     text and an "Add to dictionary" button appears right below it.
     ============================================================ */
  function addSelectionBubble() {
    const pop = el('button', 'dict-pop', '📖 Add to dictionary');
    pop.type = 'button';
    pop.hidden = true;
    document.body.appendChild(pop);
    let text = '', timer = null;

    function place() {
      const sel = window.getSelection();
      const rects = sel.rangeCount ? sel.getRangeAt(0).getClientRects() : [];
      if (!rects.length) { pop.hidden = true; return; }
      const first = rects[0], last = rects[rects.length - 1];
      pop.hidden = false;
      const w = pop.offsetWidth, h = pop.offsetHeight;
      // below the selection (above it near the bottom of the screen); phone menus sit above
      let top = last.bottom + 10;
      if (top + h > innerHeight - 70) top = first.top - h - 10;   // keep clear of the corner button
      const mid = (Math.min(first.left, last.left) + Math.max(first.right, last.right)) / 2;
      pop.style.left = Math.max(8, Math.min(innerWidth - w - 8, mid - w / 2)) + 'px';
      pop.style.top = Math.max(8, top) + 'px';
    }

    function update() {
      text = selectedText();
      if (!text || document.querySelector('.dict-overlay')) { pop.hidden = true; return; }
      place();
    }

    document.addEventListener('selectionchange', () => {
      clearTimeout(timer);
      // hide a moment later: on phones, tapping the bubble clears the selection just before the click
      if (!selectedText()) { timer = setTimeout(() => { pop.hidden = true; }, 400); return; }
      timer = setTimeout(update, 250);   // wait until she stops dragging
    });
    addEventListener('scroll', () => { if (!pop.hidden) place(); }, { passive: true });
    addEventListener('resize', () => { if (!pop.hidden) place(); });

    pop.addEventListener('pointerdown', e => e.preventDefault());   // keep the selection on desktop
    pop.addEventListener('click', () => {
      const t = text;
      pop.hidden = true;
      window.getSelection().removeAllRanges();
      if (t) openDialog(t);
    });
  }

  /* ============================================================
     DICTIONARY PAGE (dictionary.html, element #dictPage)
     ============================================================ */
  function formatDate(iso) {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  function setupPage(page) {
    buildForm(page.querySelector('.dict-form'), {});
    const list = page.querySelector('.dict-list');
    const search = page.querySelector('.dict-search');
    const count = page.querySelector('.dict-count');
    const state = page.querySelector('.dict-status');

    const STATUS = {
      idle: '',
      syncing: '⟳ Saving…',
      saved: '☁️ Saved in the cloud',
      offline: '⚠️ No connection — your words are safe on this device and will be saved later',
      notset: '⚠️ Not connected to the Google Sheet yet — words are kept on this device only'
    };

    function render() {
      const shownStatus = status === 'notset' ? 'notset' : queue.length && status !== 'syncing' ? 'offline' : status;
      state.textContent = STATUS[shownStatus];
      state.className = 'dict-status ' + shownStatus;
      const q = search.value.trim().toLowerCase();
      const shown = words
        .filter(w => !q || (w.word + ' ' + w.translation + ' ' + w.note).toLowerCase().includes(q))
        .sort((a, b) => String(b.added).localeCompare(String(a.added)));
      count.textContent = words.length === 1 ? '1 word' : words.length + ' words';
      list.innerHTML = '';
      if (!shown.length) {
        list.appendChild(el('p', 'dict-empty', words.length ? 'Nothing found.' : 'Your dictionary is empty. Add your first word above!'));
        return;
      }
      shown.forEach(w => {
        const row = el('div', 'dict-item');
        const play = el('button', 'dict-say');
        play.type = 'button';
        play.setAttribute('aria-label', 'Listen: ' + w.word);
        play.addEventListener('click', () => speak(w.word, play));
        const text = el('div', 'dict-text');
        text.appendChild(el('span', 'dict-word', w.word));
        text.appendChild(el('span', 'dict-tr', w.translation));
        if (w.note) text.appendChild(el('span', 'dict-note', w.note));
        const side = el('div', 'dict-side');
        side.appendChild(el('span', 'dict-date', formatDate(w.added)));
        if (w.id) {
          const del = el('button', 'dict-del', '×');
          del.type = 'button';
          del.setAttribute('aria-label', 'Delete ' + w.word);
          del.addEventListener('click', () => {
            if (confirm('Delete “' + w.word + '” from your dictionary?')) remove(w.id);
          });
          side.appendChild(del);
        }
        row.append(play, text, side);
        list.appendChild(row);
      });
    }

    listeners.push(render);
    search.addEventListener('input', render);
    render();
  }

  /* ---- public API ---- */
  window.Dictionary = { add, remove, sync, speak, open: openDialog, get words() { return words.slice(); } };

  function start() {
    const page = document.getElementById('dictPage');
    if (page) setupPage(page);
    else if (!(SCRIPT && SCRIPT.hasAttribute('data-off'))) { addFloatingButton(); addSelectionBubble(); }
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  window.addEventListener('online', () => sync());
})();
