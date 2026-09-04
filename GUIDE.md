# How to Build Lessons — Complete Guide

## Project structure

```
polina_classes/
├── index.html          ← Home page (list of all lessons)
├── style.css           ← All shared styles — do not touch unless redesigning
├── GUIDE.md            ← This file
└── lessons/
    ├── lesson-template.html   ← Blank template — always copy this for new lessons
    ├── lesson-01.html
    ├── lesson-02.html         ← (future)
    ├── images/                ← Put all images here
    │   └── people/            ← Sub-folder for person card photos
    └── audio/                 ← Put all audio files here
```

---

## Adding a new lesson — step by step

### Step 1 — duplicate the template

Copy `lessons/lesson-template.html` and rename it `lessons/lesson-NN.html`  
(e.g. `lesson-02.html`, `lesson-03.html` — always use two digits).

### Step 2 — open the new file and update the top section

Find and replace every `★` placeholder:

```html
<title>Lesson 2 – YOUR TOPIC</title>
```

```html
<h1>Lesson 2 — YOUR TOPIC</h1>
```

```html
<h2>YOUR TOPIC</h2>
<p>📅 18 September 2026 &nbsp;·&nbsp; Lesson 2</p>
```

**Also update the localStorage key** — this is important. Each lesson must have a unique key or students' answers will mix together:

```js
const LESSON_KEY = 'lesson-02';   // ← change the number
```

### Step 3 — add a card on the home page

Open `index.html` and find the comment `ADD MORE LESSONS HERE`. Copy the block below and paste it after it:

```html
<a class="file-folder" href="lessons/lesson-02.html">
  <div class="file-row">
    <span class="file-num">2</span>
    <div class="file-info">
      <span class="file-topic">YOUR TOPIC TITLE</span>
      <span class="file-date">18 September 2026</span>
    </div>
    <div class="file-badges">
      <span class="badge badge-class">Class</span>
      <span class="badge badge-hw">Homework</span>
    </div>
  </div>
</a>
```

> **Folder colours cycle automatically** — you don't set the colour yourself.  
> Lesson 1 = terracotta, 2 = blue, 3 = rose, 4 = gold, 5 = terracotta again, etc.

When the student has submitted homework, change `badge-hw` to `badge-done` to show a green "Done" badge.

---

## Tabs

The template comes with two tabs: **Class Tasks** and **Homework**. You can add more:

```html
<!-- In the tab-bar div -->
<button class="tab-btn" onclick="switchTab('p2', this)">Part 2 · Grammar</button>

<!-- Then add the matching content div -->
<div class="tab-content" id="tab-p2">
  <!-- exercises go here -->
</div>
```

The first tab button should have `class="tab-btn active"` and its content div should have `class="tab-content active"`.

---

## Exercise types

Every exercise goes inside an `.exercise` block:

```html
<div class="exercise" id="ex-UNIQUE-ID">
  <div class="exercise-label">Task 1 — Fill in the Blanks</div>
  <h3>Your instruction for the student.</h3>

  <!-- exercise content here -->

</div>
```

Give every exercise a **unique `id`** (no two exercises on the whole page can share an id).

---

### Fill in the blanks

```html
<p>She decided to <input class="blank" id="f1" data-answer="make"> a decision.</p>
<p>He always <input class="blank" id="f2" data-answer="takes"> risks.</p>

<div class="btn-row">
  <button class="btn btn-primary" onclick="checkHWGaps('ex-UNIQUE-ID')">Check ✓</button>
  <button class="btn btn-ghost"   onclick="resetHWGaps('ex-UNIQUE-ID')">Try again</button>
</div>
```

- `data-answer` = the correct answer in **lowercase**
- Multiple correct answers: separate with `|` → `data-answer="make|do"`
- Give every `<input>` a unique `id` (f1, f2, f3 … or hw1, hw2 … whatever you like)

---

### Multiple choice

Each question is one `.mc-options` block. Use a different `name="mcXX"` for each question.

```html
<p><strong>1. She _____ a speech at the wedding.</strong></p>
<div class="mc-options" data-correct="b">
  <label class="mc-option"><input type="radio" name="mc1" value="a"><span class="mc-bullet">A</span> made</label>
  <label class="mc-option"><input type="radio" name="mc1" value="b"><span class="mc-bullet">B</span> gave</label>
  <label class="mc-option"><input type="radio" name="mc1" value="c"><span class="mc-bullet">C</span> took</label>
</div>

<p><strong>2. He _____ a big mistake.</strong></p>
<div class="mc-options" data-correct="a">
  <label class="mc-option"><input type="radio" name="mc2" value="a"><span class="mc-bullet">A</span> made</label>
  <label class="mc-option"><input type="radio" name="mc2" value="b"><span class="mc-bullet">B</span> did</label>
  <label class="mc-option"><input type="radio" name="mc2" value="c"><span class="mc-bullet">C</span> gave</label>
</div>

<div class="btn-row">
  <button class="btn btn-primary" onclick="checkMCIn('ex-UNIQUE-ID')">Check ✓</button>
  <button class="btn btn-ghost"   onclick="resetMCIn('ex-UNIQUE-ID')">Try again</button>
</div>
```

- `data-correct` = the `value` of the correct option (`"a"`, `"b"`, `"c"`, or `"d"`)
- You can have 2, 3 or 4 options per question
- Always use `checkMCIn('ex-UNIQUE-ID')` (not `checkMC()`), passing the exercise's id

---

### Matching

Each matching exercise needs a unique `data-exid`. Pairs are linked by matching `data-pair` numbers.  
Shuffle the right column so answers don't line up visually.

```html
<div class="match-grid">
  <div class="match-col" data-side="left">
    <div class="match-item" data-pair="1" onclick="selectMatch(this,'ex-match-01')">make a decision</div>
    <div class="match-item" data-pair="2" onclick="selectMatch(this,'ex-match-01')">take a risk</div>
    <div class="match-item" data-pair="3" onclick="selectMatch(this,'ex-match-01')">give a speech</div>
  </div>
  <div class="match-col" data-side="right">
    <div class="match-item" data-pair="3" onclick="selectMatch(this,'ex-match-01')">выступить с речью</div>
    <div class="match-item" data-pair="1" onclick="selectMatch(this,'ex-match-01')">принять решение</div>
    <div class="match-item" data-pair="2" onclick="selectMatch(this,'ex-match-01')">рискнуть</div>
  </div>
</div>

<div class="btn-row">
  <button class="btn btn-ghost" onclick="resetMatchEx('ex-match-01')">Reset</button>
</div>
```

- The string `'ex-match-01'` in every `onclick` must match the `id` you give the exercise div
- Each exercise on the page needs a different id: `ex-match-01`, `ex-match-02`, etc.

---

### Word-choice (inline buttons)

Good for sentences where the student picks the right verb from two or three options.

```html
<p>
  She 
  <span class="word-choice">
    <button class="word-choice-btn" onclick="selectWord(this)">make</button>
    <button class="word-choice-btn" onclick="selectWord(this)">do</button>
    <button class="word-choice-btn" onclick="selectWord(this)">give</button>
  </span>
  a lot of effort every day.
</p>
```

There is no automatic check button for word-choice — students self-check by discussing with you.

---

### Free writing

```html
<textarea class="free-write" id="fw-lesson2-q1" placeholder="Write your answer here…" rows="5"></textarea>
<div class="char-count" id="cc-fw-lesson2-q1">0 characters</div>
```

- Give each textarea a unique `id`
- Add `id="cc-SAME-ID"` on the char-count div to get the live counter
- Saves automatically on every keystroke

---

### Listening (audio + multiple choice)

```html
<div class="listen-item">
  <div class="listen-header">
    <span class="listen-num">1</span>
    <audio controls><source src="audio/YOUR-FILE.mp3" type="audio/mpeg"></audio>
  </div>
  <div class="mc-options" data-correct="b">
    <label class="mc-option"><input type="radio" name="mp1" value="a"><span class="mc-bullet">A</span> Option A</label>
    <label class="mc-option"><input type="radio" name="mp1" value="b"><span class="mc-bullet">B</span> Option B</label>
    <label class="mc-option"><input type="radio" name="mp1" value="c"><span class="mc-bullet">C</span> Option C</label>
  </div>
</div>
```

Put all audio files in `lessons/audio/`. Wrap all listen-items in one exercise div and use `checkMCIn('ex-UNIQUE-ID')`.

---

### Wordwall game (link button — NOT embed)

Wordwall blocks embedding in local files. Use a link button instead:

```html
<a class="wordwall-btn" href="https://wordwall.net/play/GAME-ID" target="_blank">
  ▶ Play the game
</a>
```

Replace `GAME-ID` with the number from your Wordwall game URL.

---

### Images

Put image files in `lessons/images/` and reference them with a relative path:

```html
<img class="media-img" src="images/my-photo.jpg" alt="Description">
```

For person cards (culture section), use:

```html
<div class="person-grid">
  <div class="person-card">
    <img class="person-photo" src="images/people/person-name.jpg" alt="Name">
    <div class="person-card-body">
      <div class="person-name">Full Name</div>
      <span class="p-badge badge-tech">Technology</span>
      <p class="person-desc">Description text here.</p>
    </div>
  </div>
</div>
```

Badge colour classes: `badge-tech` (blue), `badge-music` (purple), `badge-theatre` (pink), `badge-art` (green), `badge-lit` (gold).

---

## Answers and saving

- All answers save automatically to the **student's browser** on their device
- Answers persist between sessions as long as the student uses the **same browser on the same device**
- If a student switches device or clears their browser data, answers are lost
- You (the teacher) cannot see students' answers — the site is designed for students to review their own work

---

## Publishing to GitHub Pages

1. Upload the whole `polina_classes` folder to a GitHub repository
2. In the repository: **Settings → Pages → Source → Deploy from branch → main / root**
3. GitHub gives you a URL like `https://yourusername.github.io/polina_classes/`
4. Share that URL with students — they bookmark it and access lessons from any browser

> Answers still save per-device (see above). GitHub Pages doesn't change that.

---

## Checklist when adding a new lesson

- [ ] Copied `lesson-template.html` → renamed to `lesson-NN.html`
- [ ] Updated `<title>`, `<h1>`, `<h2>`, and the date in the new file
- [ ] Changed `LESSON_KEY = 'lesson-NN'` to a unique key
- [ ] Added a `.file-folder` block in `index.html`
- [ ] Placed any image files in `lessons/images/`
- [ ] Placed any audio files in `lessons/audio/`
- [ ] Every exercise has a unique `id`
- [ ] Every input/textarea has a unique `id`
- [ ] Every MC question group has a unique `name="mcXX"`
