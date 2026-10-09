/* ============================================================
   Polina's Dictionary — Google Apps Script (the "back end").

   This code lives inside the Google Sheet "Polina Dictionary"
   (Extensions → Apps Script). It is NOT used by the website directly;
   this file is only a saved copy. See GUIDE.md → "My Dictionary".

   The sheet's first tab needs these headers in row 1:
     id | word | translation | note | added

   What the website (dictionary.js) sends:
     GET  ?key=SECRET                                  → { words: [ {id, word, translation, note, added}, … ] }
     POST {"key":SECRET, "action":"add", "word":{…}}   → { ok: true }
     POST {"key":SECRET, "action":"delete", "id":"…"}  → { ok: true }
   Anything wrong comes back as { error: "…" }.
   ============================================================ */

const SECRET = '2iu2YZP5xj3GSy7zZfRNQlhAdm4gYqYM';   // must match KEY in dictionary.js
const HEADERS = ['id', 'word', 'translation', 'note', 'added'];

/* ---- list all words ---- */
function doGet(e) {
  if (!e || !e.parameter || e.parameter.key !== SECRET) return reply({ error: 'wrong key' });
  const sh = sheet();
  const values = sh.getDataRange().getValues();
  const head = values.shift().map(h => String(h).trim().toLowerCase());
  const words = values
    .map(row => {
      const w = {};
      head.forEach((h, i) => { if (h) w[h] = text(row[i]); });
      return w;
    })
    .filter(w => w.word);
  return reply({ words: words });
}

/* ---- add or delete one word ---- */
function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return reply({ error: 'bad request' }); }
  if (body.key !== SECRET) return reply({ error: 'wrong key' });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);   // one change at a time
  try {
    const sh = sheet();
    const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).trim().toLowerCase());
    const idCol = head.indexOf('id') + 1;

    if (body.action === 'add') {
      const w = body.word || {};
      if (!w.id || !String(w.word || '').trim()) return reply({ error: 'missing word' });
      if (findRow(sh, idCol, w.id)) return reply({ ok: true });   // already there (sent twice) — nothing to do
      const row = head.map(h => safe(w[h]));
      const r = sh.getLastRow() + 1;
      sh.getRange(r, 1, 1, row.length).setNumberFormat('@').setValues([row]);   // '@' = plain text, no auto-dates
      return reply({ ok: true });
    }

    if (body.action === 'delete') {
      const r = findRow(sh, idCol, body.id);
      if (r) sh.deleteRow(r);
      return reply({ ok: true });
    }

    return reply({ error: 'unknown action' });
  } finally {
    lock.releaseLock();
  }
}

/* ---- helpers ---- */
function sheet() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sh.getLastRow() === 0) sh.appendRow(HEADERS);   // empty tab: write the headers
  return sh;
}

function findRow(sh, idCol, id) {
  if (!idCol || !id || sh.getLastRow() < 2) return 0;
  const ids = sh.getRange(2, idCol, sh.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return 0;
}

function text(v) {
  return v instanceof Date ? v.toISOString() : String(v == null ? '' : v).trim();
}

function safe(v) {
  return String(v == null ? '' : v).replace(/^[=+@]+/, '').slice(0, 200);   // no formulas in the sheet
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
