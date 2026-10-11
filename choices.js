/* ============================================================
   Choices — turns the drop-down gaps of a practice lesson into
   question cards: the sentence on top, the options as lettered tiles (A, B, C) below.
   • every <select class="ans"> (except word-box gaps with data-bank) gets a row of buttons;
     the select stays hidden underneath, so the lesson's own Check / Try again code keeps working
   • the "___" in the sentence shows the chosen answer
   • after Check: the right answer turns green, a wrong choice red
   Load it after the lesson's own script:  <script src="../choices.js"></script>
   ============================================================ */
(function () {
  function enhance(sel) {
    if (sel.dataset.bank !== undefined || sel.closest('.ch')) return;
    const opts = [...sel.options].filter(o => o.value !== '');
    if (!opts.length) return;

    const wrap = document.createElement('span');
    wrap.className = 'ch';
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    const group = document.createElement('span');
    group.className = 'ch-group';
    group.setAttribute('role', 'radiogroup');
    wrap.appendChild(group);

    const btns = opts.map((o, k) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ch-btn';
      b.dataset.v = o.value;
      b.innerHTML = '<span class="ch-l">' + String.fromCharCode(65 + k) + '</span><span class="ch-t"></span>';
      b.querySelector('.ch-t').textContent = o.value;
      b.setAttribute('role', 'radio');
      b.addEventListener('click', () => {
        if (sel.disabled) return;
        sel.value = sel.value === o.value ? '' : o.value;   // tap again to clear
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        sync();
      });
      group.appendChild(b);
      return b;
    });

    // the gap in the sentence: "___" becomes a slot that shows the chosen answer
    let slot = null;
    const row = sel.closest('.answer-row');
    if (row) { row.classList.add('ch-card'); row.appendChild(wrap); }   // question card: sentence on top, tiles below
    const txt = row && row.querySelector('.ar-txt');
    if (txt) {
      const walker = document.createTreeWalker(txt, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const i = node.nodeValue.indexOf('___');
        if (i < 0) continue;
        const after = node.splitText(i);
        after.nodeValue = after.nodeValue.slice(3);
        slot = document.createElement('span');
        slot.className = 'ch-slot';
        after.parentNode.insertBefore(slot, after);
        break;
      }
    }

    function sync() {
      const v = sel.value, done = sel.disabled;
      const keys = (sel.dataset.answer || '').split('|');
      btns.forEach(b => {
        const isV = b.dataset.v === v, isKey = keys.includes(b.dataset.v);
        b.classList.toggle('on', isV && !done);
        b.classList.toggle('right', done && isKey);
        b.classList.toggle('wrong', done && isV && !isKey);
        b.classList.toggle('dim', done && !isV && !isKey);
        b.setAttribute('aria-checked', isV ? 'true' : 'false');
        b.disabled = done;
      });
      if (slot) {
        slot.textContent = v || '';
        slot.classList.toggle('filled', !!v);
        slot.classList.toggle('right', done && keys.includes(v));
        slot.classList.toggle('wrong', done && !keys.includes(v));
      }
    }
    // the lesson's own code marks the select (class, disabled) and clears it on Try again: follow it
    new MutationObserver(sync).observe(sel, { attributes: true, attributeFilter: ['class', 'disabled'] });
    sel.addEventListener('change', sync);
    sync();
  }

  function init() { document.querySelectorAll('select.ans').forEach(enhance); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
