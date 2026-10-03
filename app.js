/* ============================================================
   词根词缀刷题库 · 应用逻辑
   ============================================================ */
(function () {
  'use strict';

  var NL = String.fromCharCode(10);
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var K_CUSTOM = 'yy_custom_v1';
  var K_PROG = 'yy_prog_v1';
  var K_PREF = 'yy_pref_v1';

  /* ---------------- 工具 ---------------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function isCJK(code) {
    return (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf);
  }
  function firstCJK(s) {
    for (var i = 0; i < s.length; i++) { if (isCJK(s.charCodeAt(i))) return i; }
    return -1;
  }
  function hasCJK(s) { return firstCJK(s) >= 0; }
  function stripCR(s) { return s.split(String.fromCharCode(13)).join(''); }
  function stripPos(s) {
    var m = s.match(/^[A-Za-z]{1,4}[.．,，][ ]?/);
    if (m && hasCJK(s.slice(m[0].length))) s = s.slice(m[0].length);
    return s;
  }
  function isCJOp(code) {
    return isCJK(code) || (code >= 0x3000 && code <= 0x303f) || (code >= 0xff00 && code <= 0xffef);
  }
  // OCR / 复制文本常在每个汉字之间插空格，这里把「汉字 空格 汉字」的缝补回去
  function joinCJKSpace(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      if (c === ' ' && out.length) {
        var a = out.charCodeAt(out.length - 1);
        var b = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
        if (isCJOp(a) && isCJOp(b)) continue;
      }
      out += c;
    }
    return out.replace(/[ ]{2,}/g, ' ').trim();
  }
  function shortGloss(cn) {
    var s = stripPos(String(cn || '').trim());
    s = s.replace(/^[.][ ]*/, '');
    var parts = s.split(/[；;，,]/);
    s = (parts[0] || '').trim();
    if (!s) s = String(cn || '').trim();
    if (s.length > 22) s = s.slice(0, 21) + '…';
    return s;
  }
  function shuffle(a) {
    var r = a.slice();
    for (var i = r.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = r[i]; r[i] = r[j]; r[j] = t;
    }
    return r;
  }
  function sampleN(arr, n, keyFn) {
    var seen = {};
    var pool = shuffle(arr).filter(function (x) {
      var k = keyFn ? keyFn(x) : x;
      if (k == null) return false;
      if (seen[k]) return false;
      seen[k] = 1; return true;
    });
    return pool.slice(0, n);
  }
  function normWord(s) {
    return String(s || '').toLowerCase().split(' ').join('').split('-').join('').split('_').join('');
  }
  function today() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  /* ---------------- 词库 ---------------- */
  var CUSTOM = { groups: [] };
  var DB = { groups: [] };

  function loadCustom() {
    try {
      var raw = localStorage.getItem(K_CUSTOM);
      if (raw) CUSTOM = JSON.parse(raw);
    } catch (e) { CUSTOM = { groups: [] }; }
    if (!CUSTOM || !CUSTOM.groups) CUSTOM = { groups: [] };
  }
  function saveCustom() {
    try { localStorage.setItem(K_CUSTOM, JSON.stringify(CUSTOM)); } catch (e) {}
  }
  function buildDB() {
    DB.groups = (window.LIBRARY.groups || []).concat(CUSTOM.groups || []);
  }
  function allAffixes() {
    var out = [];
    DB.groups.forEach(function (g) {
      (g.affixes || []).forEach(function (a) {
        out.push({
          affix: a.affix, gloss: a.gloss, group: g.name, gid: g.id,
          pages: g.pages || '—', files: g.files || [], words: a.words || [], custom: !!g.custom
        });
      });
    });
    return out;
  }
  function allWords() {
    var out = [];
    allAffixes().forEach(function (a) {
      a.words.forEach(function (w) {
        out.push({
          w: w.w, ph: w.ph || '', pos: w.pos || '', cn: w.cn || '',
          affix: a.affix, gloss: a.gloss, group: a.group, gid: a.gid, pages: a.pages, files: a.files
        });
      });
    });
    return out;
  }
  function scopedAffixes() {
    if (S.scope === 'all') return allAffixes();
    return allAffixes().filter(function (a) { return a.gid === S.scope; });
  }
  function scopedWords() {
    if (S.scope === 'all') return allWords();
    return allWords().filter(function (w) { return w.gid === S.scope; });
  }

  /* ---------------- 状态 ---------------- */
  var S = {
    view: 'quiz',
    board: 'affix',
    qtype: 'auto',
    scope: 'all',
    count: 20,
    queue: [], idx: 0, answered: false, picked: -1,
    right: 0, wrong: 0, sessionWrong: [],
    running: false,
    wrongBook: []
  };

  function loadProg() {
    try {
      var raw = localStorage.getItem(K_PROG);
      if (raw) {
        var o = JSON.parse(raw);
        S.wrongBook = o.wrongBook || [];
      }
    } catch (e) { S.wrongBook = []; }
    try {
      var p = localStorage.getItem(K_PREF);
      if (p) {
        var q = JSON.parse(p);
        if (q.board) S.board = q.board;
        if (q.qtype) S.qtype = q.qtype;
        if (q.scope) S.scope = q.scope;
        if (q.count) S.count = q.count;
      }
    } catch (e) {}
  }
  function saveProg() {
    try { localStorage.setItem(K_PROG, JSON.stringify({ wrongBook: S.wrongBook })); } catch (e) {}
  }
  function savePref() {
    try {
      localStorage.setItem(K_PREF, JSON.stringify({ board: S.board, qtype: S.qtype, scope: S.scope, count: S.count }));
    } catch (e) {}
  }
  function addWrong(type, key, label, cn) {
    for (var i = 0; i < S.wrongBook.length; i++) {
      if (S.wrongBook[i].type === type && S.wrongBook[i].key === key) return;
    }
    S.wrongBook.unshift({ type: type, key: key, label: label, cn: cn, ts: Date.now() });
    if (S.wrongBook.length > 300) S.wrongBook.length = 300;
    saveProg();
    paintStats();
  }
  function removeWrong(type, key) {
    S.wrongBook = S.wrongBook.filter(function (x) { return !(x.type === type && x.key === key); });
    saveProg(); paintStats();
  }
  function paintStats() {
    $('#s-right').textContent = S.right;
    $('#s-wrong').textContent = S.wrongBook.length;
  }

  /* ---------------- 视图切换 ---------------- */
  function showView(v) {
    S.view = v;
    $$('nav button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-view') === v); });
    $$('.view').forEach(function (p) { p.classList.toggle('on', p.id === 'view-' + v); });
    if (v === 'affix') renderAffixList();
    if (v === 'words') renderWords();
    if (v === 'add') renderImport();
  }

  /* ---------------- 出题设置 ---------------- */
  var BOARDS = [
    { id: 'affix', label: '词根词缀' },
    { id: 'word', label: '单词' },
    { id: 'mix', label: '两者混合' }
  ];
  var QTYPES = {
    affix: [
      { id: 'auto', label: '全部混合' },
      { id: 'affix2mean', label: '词缀 → 含义' },
      { id: 'mean2affix', label: '含义 → 词缀' },
      { id: 'affix2word', label: '词缀 → 例词' }
    ],
    word: [
      { id: 'auto', label: '全部混合' },
      { id: 'word2mean', label: '单词 → 释义' },
      { id: 'mean2word', label: '释义 → 单词' },
      { id: 'spell', label: '看释义拼写' }
    ]
  };
  QTYPES.mix = [QTYPES.affix[0]].concat(QTYPES.affix.slice(1), QTYPES.word.slice(1));

  var QTAG = {
    affix2mean: '词缀 → 含义', mean2affix: '含义 → 词缀', affix2word: '词缀 → 例词',
    word2mean: '单词 → 释义', mean2word: '释义 → 单词', spell: '看释义拼写'
  };

  function chips(host, items, current, onPick) {
    host.innerHTML = items.map(function (it) {
      return '<button class="chip' + (it.id === current ? ' on' : '') + '" data-id="' + esc(it.id) + '">' + esc(it.label) + '</button>';
    }).join('');
    host.onclick = function (e) {
      var b = e.target.closest('.chip');
      if (!b) return;
      onPick(b.getAttribute('data-id'));
    };
  }

  function renderSetup() {
    chips($('#set-board'), BOARDS, S.board, function (id) {
      S.board = id;
      if (QTYPES[id].map(function (x) { return x.id; }).indexOf(S.qtype) < 0) S.qtype = 'auto';
      savePref(); renderSetup();
    });
    chips($('#set-qtype'), QTYPES[S.board], S.qtype, function (id) { S.qtype = id; savePref(); renderSetup(); });

    var scopes = [{ id: 'all', label: '全部' }].concat(DB.groups.map(function (g) {
      return { id: g.id, label: g.name.split(' ').join('') };
    }));
    chips($('#set-scope'), scopes, S.scope, function (id) { S.scope = id; savePref(); renderSetup(); });

    var counts = [10, 20, 30, 50, 999].map(function (n) {
      return { id: String(n), label: n === 999 ? '全部' : (n + ' 题') };
    });
    chips($('#set-count'), counts, String(S.count), function (id) { S.count = parseInt(id, 10); savePref(); renderSetup(); });

    updatePoolHint();
    $('#btn-again').disabled = S.wrongBook.length === 0;
    $('#btn-again').textContent = S.wrongBook.length ? ('重做错题本（' + S.wrongBook.length + '）') : '重做错题本';
  }

  function updatePoolHint() {
    var a = scopedAffixes(), w = scopedWords();
    var n = Math.min(S.count, Math.max(a.length, w.length));
    $('#poolHint').textContent = '当前范围可出题：' + a.length + ' 个词缀 · ' + w.length + ' 个单词 ｜ 本次抽取 ' +
      (S.count > 900 ? (Math.max(a.length, w.length) + ' 题') : (S.count + ' 题'));
  }

  /* ---------------- 出题引擎 ---------------- */
  /* 题型按素材对象分两类：词缀类题型只能吃词缀对象，单词类题型只能吃单词对象。
     混着配会让 explainHTML 读到不存在的 .words 而崩掉整轮。 */
  var AFFIX_TYPES = ['affix2mean', 'mean2affix', 'affix2word'];
  var WORD_TYPES = ['word2mean', 'mean2word', 'spell'];

  function pickType(item) {
    if (S.qtype !== 'auto') return S.qtype;
    var pool;
    if (S.board === 'affix') pool = ['affix2mean', 'affix2mean', 'mean2affix', 'affix2word'];
    else if (S.board === 'word') pool = ['word2mean', 'word2mean', 'mean2word', 'spell'];
    else pool = ['affix2mean', 'mean2affix', 'affix2word', 'word2mean', 'mean2word', 'spell'];
    if (item) {
      var want = item.words ? AFFIX_TYPES : WORD_TYPES;
      var fit = pool.filter(function (t) { return want.indexOf(t) >= 0; });
      if (fit.length) pool = fit;
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function makeQ(type, item) {
    var A = allAffixes(), W = allWords();
    if (AFFIX_TYPES.indexOf(type) >= 0 && !item.words) return null;
    if (WORD_TYPES.indexOf(type) >= 0 && !item.w) return null;
    var q = { type: type, options: [], answerIdx: -1, big: '', bigCls: '', ask: '', meta: '', focus: item, kind: 'affix', answerText: '' };

    if (type === 'affix2mean') {
      q.kind = 'affix'; q.focus = item;
      q.big = item.affix; q.bigCls = '';
      q.ask = '这个前缀表示什么意思？';
      q.meta = item.group + ' · 共 ' + item.words.length + ' 个例词';
      var d1 = sampleN(A.filter(function (x) { return x.gloss !== item.gloss; }), 3, function (x) { return x.gloss; });
      var o1 = shuffle([item.gloss].concat(d1.map(function (x) { return x.gloss; })));
      q.options = o1;
      q.answerIdx = o1.indexOf(item.gloss);
      q.answerText = item.gloss;

    } else if (type === 'mean2affix') {
      q.kind = 'affix'; q.focus = item;
      q.big = item.gloss; q.bigCls = 'zh';
      q.ask = '下面哪个前缀表示这个意思？';
      q.meta = item.group;
      var d2 = sampleN(A.filter(function (x) { return x.affix !== item.affix && x.gloss !== item.gloss; }), 3, function (x) { return x.affix; });
      var o2 = shuffle([item.affix].concat(d2.map(function (x) { return x.affix; })));
      q.options = o2;
      q.answerIdx = o2.indexOf(item.affix);
      q.answerText = item.affix;

    } else if (type === 'affix2word') {
      q.kind = 'affix'; q.focus = item;
      q.big = item.affix; q.bigCls = '';
      q.ask = '下列哪个单词是用这个前缀构成的？';
      q.meta = '含义：' + item.gloss;
      if (!item.words.length) return null;
      var own = sampleN(item.words, 1)[0];
      var d3 = sampleN(W.filter(function (x) { return x.affix !== item.affix; }), 3, function (x) { return x.w; });
      var o3 = shuffle([own.w].concat(d3.map(function (x) { return x.w; })));
      q.options = o3;
      q.answerIdx = o3.indexOf(own.w);
      q.answerText = own.w;

    } else if (type === 'word2mean') {
      q.kind = 'word'; q.focus = item;
      q.big = item.w; q.bigCls = '';
      q.ask = '这个单词的意思是？';
      q.meta = (item.ph ? '[' + item.ph + ']  ' : '') + (item.pos ? item.pos + '  ' : '') + item.affix + ' · ' + item.gloss;
      var ans = shortGloss(item.cn);
      var d4 = sampleN(W.filter(function (x) { return x.w !== item.w && shortGloss(x.cn) !== ans; }), 3, function (x) { return shortGloss(x.cn); });
      var o4 = shuffle([ans].concat(d4.map(function (x) { return shortGloss(x.cn); })));
      q.options = o4;
      q.answerIdx = o4.indexOf(ans);
      q.answerText = ans;

    } else if (type === 'mean2word') {
      q.kind = 'word'; q.focus = item;
      var ans2 = shortGloss(item.cn);
      q.big = ans2; q.bigCls = 'zh';
      q.ask = '下面哪个单词是这个意思？';
      q.meta = '前缀 ' + item.affix + ' · ' + item.gloss;
      var d5 = sampleN(W.filter(function (x) { return x.w !== item.w && shortGloss(x.cn) !== ans2; }), 3, function (x) { return x.w; });
      var o5 = shuffle([item.w].concat(d5.map(function (x) { return x.w; })));
      q.options = o5;
      q.answerIdx = o5.indexOf(item.w);
      q.answerText = item.w;

    } else if (type === 'spell') {
      q.kind = 'word'; q.focus = item;
      q.big = shortGloss(item.cn); q.bigCls = 'zh';
      q.ask = '把对应的英文单词拼出来';
      var hint = item.w.charAt(0) + '…' + '，共 ' + item.w.replace(/[^A-Za-z]/g, '').length + ' 个字母 · 前缀 ' + item.affix;
      q.meta = hint;
      q.answerText = item.w;
    }
    if (q.answerIdx < 0 && type !== 'spell') return null;
    return q;
  }

  function startQuiz(customQueue) {
    var A = scopedAffixes(), W = scopedWords();
    var queue = [];
    if (customQueue) {
      queue = customQueue;
    } else {
      var affixOnly = S.board === 'affix', wordOnly = S.board === 'word';
      if (S.board === 'mix' && S.qtype !== 'auto') {
        if (AFFIX_TYPES.indexOf(S.qtype) >= 0) affixOnly = true; else wordOnly = true;
      }
      var items = [];
      if (!wordOnly) items = items.concat(A);
      if (!affixOnly) items = items.concat(W);
      if (!items.length) { alert('当前范围没有可用的题目，换个范围试试。'); return; }
      var need = Math.min(S.count > 900 ? items.length : S.count, items.length);
      var picks = shuffle(items).slice(0, need);
      var guard = 0;
      while (queue.length < need && guard < 4000) {
        guard++;
        var it = picks[Math.floor(Math.random() * picks.length)];
        var t = pickType(it);
        var q = null;
        try { q = makeQ(t, it); } catch (e) { q = null; }
        if (q) queue.push(q);
      }
      queue = queue.slice(0, need);
    }
    if (!queue.length) { alert('没能生成题目，请调整设置。'); return; }
    S.queue = queue; S.idx = 0; S.right = 0; S.wrong = 0; S.sessionWrong = [];
    S.running = true; S.answered = false; S.picked = -1;
    paintStats();
    $('#setupCard').style.display = 'none';
    renderQ();
  }

  function renderQ() {
    var q = S.queue[S.idx];
    if (!q) { finish(); return; }
    S.answered = false; S.picked = -1;
    var total = S.queue.length;
    var pct = Math.round((S.idx / total) * 100);
    var body = '';
    body += '<div class="qhead"><span class="qno">' + (S.idx + 1) + ' / ' + total + '</span>' +
      '<span class="qtag">' + esc(QTAG[q.type] || q.type) + '</span><span class="sp"></span>' +
      '<span>本轮 ✓' + S.right + ' · ✕' + S.wrong + '</span></div>';
    body += '<div class="bar"><i style="width:' + pct + '%"></i></div>';
    body += '<div class="stem"><div class="big ' + q.bigCls + '">' + esc(q.big) + '</div>';
    body += '<div class="ask">' + esc(q.ask) + '</div>';
    if (q.meta) body += '<div class="meta">' + esc(q.meta) + '</div>';
    body += '</div>';

    if (q.type === 'spell') {
      body += '<input class="spellin" id="spellin" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="在这里拼写…">';
      body += '<div class="btnrow"><button class="btn" id="btn-spell">提交</button>' +
        '<button class="btn ghost small" id="btn-skip">不会，看答案</button></div>';
    } else {
      var two = q.options.every(function (o) { return String(o).length <= 12; });
      body += '<div class="opts' + (two ? ' two' : '') + '" id="opts">';
      q.options.forEach(function (o, i) {
        var isEn = /^[A-Za-z]/.test(String(o));
        body += '<button class="opt" data-i="' + i + '"><span class="key">' + 'ABCD'.charAt(i) + '</span>' +
          '<span class="txt"><span class="' + (isEn ? 'en' : '') + '">' + esc(o) + '</span></span></button>';
      });
      body += '</div>';
    }
    body += '<div id="exHost"></div><div id="nextHost"></div>';

    $('#stage').innerHTML = '<div class="card pad">' + body + '</div>';
    if (q.type === 'spell') {
      var inp = $('#spellin');
      inp.focus();
      inp.onkeydown = function (e) {
        if (e.key === 'Enter') { e.preventDefault(); if (!S.answered) submitSpell(true); else next(); }
      };
      $('#btn-spell').onclick = function () { if (!S.answered) submitSpell(true); else next(); };
      $('#btn-skip').onclick = function () { if (!S.answered) submitSpell(false); };
    } else {
      $('#opts').onclick = function (e) {
        var b = e.target.closest('.opt');
        if (!b || S.answered) return;
        answerOpt(parseInt(b.getAttribute('data-i'), 10));
      };
    }
  }

  function lockOpts() {
    $$('#opts .opt').forEach(function (el) { el.classList.add('lock'); });
  }

  function answerOpt(i) {
    var q = S.queue[S.idx];
    S.answered = true; S.picked = i;
    var ok = i === q.answerIdx;
    lockOpts();
    var el = $('#opts .opt[data-i="' + i + '"]');
    if (el) el.classList.add(ok ? 'ok' : 'no');
    if (!ok) {
      var cel = $('#opts .opt[data-i="' + q.answerIdx + '"]');
      if (cel) cel.classList.add('ok');
    }
    settle(q, ok, q.options[i]);
  }

  function submitSpell(withAnswer) {
    var q = S.queue[S.idx];
    S.answered = true;
    var inp = $('#spellin');
    var val = withAnswer && inp ? inp.value : '';
    var ok = withAnswer && normWord(val) === normWord(q.answerText);
    if (inp) {
      inp.readOnly = true;
      inp.style.borderColor = ok ? 'var(--green)' : 'var(--red)';
      inp.style.color = ok ? 'var(--green)' : 'var(--red)';
    }
    var bs = $('#btn-spell');
    if (bs) bs.textContent = '下一题';
    var bk = $('#btn-skip');
    if (bk) bk.style.display = 'none';
    settle(q, ok, val);
  }

  function settle(q, ok, userAns) {
    if (ok) { S.right++; } else {
      S.wrong++;
      var ref = q.kind === 'word' ? q.focus.w : q.focus.affix;
      S.sessionWrong.push({ label: ref, cn: q.kind === 'word' ? q.focus.cn : q.focus.gloss, ref: ref, type: q.type });
      addWrong(q.type, ref, ref, q.kind === 'word' ? q.focus.cn : q.focus.gloss);
    }
    paintStats();
    var head = $('#stage .qhead');
    if (head) head.lastElementChild.textContent = '本轮 ✓' + S.right + ' · ✕' + S.wrong;
    var bar = $('#stage .bar i');
    if (bar) bar.style.width = Math.round(((S.idx + 1) / S.queue.length) * 100) + '%';

    $('#exHost').innerHTML = explainHTML(q, ok, userAns);
    $('#nextHost').innerHTML = '<div class="btnrow"><button class="btn" id="btn-next">' +
      (S.idx + 1 >= S.queue.length ? '看结果' : '下一题') + '</button>' +
      '<span class="hint" style="margin:0">按 Enter 继续</span></div>';
    $('#btn-next').onclick = next;
  }

  function explainHTML(q, ok, userAns) {
    var h = '';
    h += '<div class="explain">';
    if (ok) {
      h += '<div class="verdict ok"><span class="mark">✓</span>回答正确' + (q.type === 'spell' ? '　' + esc(q.answerText) : '') + '</div>';
    } else {
      h += '<div class="verdict no"><span class="mark">✕</span>答错了，正确答案是　<u>' + esc(q.answerText) + '</u>';
      if (q.type !== 'spell' && userAns != null && userAns !== '') h += '<span style="font-weight:400;font-size:13.5px;color:var(--muted);margin-left:8px">你选了 ' + esc(userAns) + '</span>';
      h += '</div>';
    }

    var f = q.focus;
    var wordList = '';
    var hiWord = q.kind === 'word' ? f.w : (q.type === 'affix2word' ? q.answerText : '');
    var affixItem = null;
    if (q.kind === 'affix') { affixItem = f; }
    else {
      affixItem = allAffixes().filter(function (x) { return x.affix === f.affix; })[0] || null;
    }

    h += '<div class="exgrid split">';
    h += '<div class="exbox"><div class="lbl">词根词缀</div>';
    if (affixItem) {
      h += '<div class="affixline"><span class="a">' + esc(affixItem.affix) + '</span><span class="g">' + esc(affixItem.gloss) + '</span></div>';
      var affixWords = affixItem.words || [];
      h += '<div class="tags"><span class="tag">' + esc(affixItem.group) + '</span><span class="tag">' + esc(affixItem.pages) + '</span><span class="tag">' + affixWords.length + ' 个例词</span></div>';
      h += '<div class="wlist" style="margin-top:12px">';
      affixWords.forEach(function (w) {
        var hi = (w.w === hiWord);
        h += '<div class="wrow' + (hi ? ' hi' : '') + '"><span class="w">' + esc(w.w) + '</span>' +
          '<span class="p">' + esc(w.ph ? '[' + w.ph + ']' : '') + '</span>' +
          '<span class="c">' + (w.pos ? '<b>' + esc(w.pos) + '</b> ' : '') + esc(w.cn) + '</span></div>';
      });
      h += '</div>';
    } else {
      h += '<div class="empty">（该词缀已不在词库中）</div>';
    }
    h += '</div>';

    h += '<div class="exbox"><div class="lbl">' + (q.kind === 'word' ? '单词详情 / 来源' : '来源书页') + '</div>';
    if (q.kind === 'word') {
      h += '<div class="affixline"><span class="a">' + esc(f.w) + '</span></div>';
      h += '<div class="tags">' + (f.ph ? '<span class="tag">[' + esc(f.ph) + ']</span>' : '') +
        (f.pos ? '<span class="tag">' + esc(f.pos) + '</span>' : '') +
        '<span class="tag">' + esc(f.affix) + ' ' + esc(f.gloss) + '</span>' +
        '<span class="tag">' + esc(f.pages) + '</span></div>';
      h += '<div class="wrow" style="border-bottom:0;margin-top:10px"><span class="c">' + esc(f.cn) + '</span></div>';
      h += linkStudy(f.w);
    } else {
      h += '<div style="font-size:13.5px;color:var(--ink-soft);margin-bottom:10px">' + esc(q.ask) + '</div>';
    }
    h += renderThumbs(f.files);
    h += '</div></div></div>';
    return h;
  }

  function linkStudy(w) {
    return '<div style="margin-top:10px"><a href="https://www.bing.com/dict/search?q=' + encodeURIComponent(w) +
      '" target="_blank" rel="noopener" style="font-family:var(--mono);font-size:11px;color:var(--blue)">查词典 ↗</a></div>';
  }
  function renderThumbs(files) {
    if (!files || !files.length) return '';
    return '<div class="thumbs">' + files.map(function (f) {
      var name = f.split('/').pop();
      return '<div class="thumb" data-img="' + esc(f) + '"><img src="' + esc(f) + '" alt="' + esc(name) + '" loading="lazy"><span>' + esc(name) + '</span></div>';
    }).join('') + '</div>';
  }

  function next() {
    S.idx++;
    if (S.idx >= S.queue.length) { finish(); return; }
    renderQ();
  }

  function finish() {
    var total = S.right + S.wrong;
    var rate = total ? Math.round((S.right / total) * 100) : 0;
    var h = '';
    h += '<div class="card pad"><div class="qhead"><span class="qno">本轮结束</span><span class="qtag">' +
      esc(QTAG[S.queue[0] ? S.queue[0].type : ''] || 'RESULTS') + '</span><span class="sp"></span><span>' + today() + '</span></div>';
    h += '<div class="score"><div><div class="lbl">正确率</div><div class="big">' + rate + '<small>%</small></div></div>' +
      '<div class="sub2">共 ' + total + ' 题 · 正确 <b style="color:var(--green)">' + S.right + '</b> 题 · 错误 <b style="color:var(--red)">' + S.wrong + '</b> 题</div></div>';

    if (S.sessionWrong.length) {
      h += '<h2 style="font-size:15px">本轮错题 <em>' + S.sessionWrong.length + ' ITEMS</em></h2><div class="wrongwall">' +
        S.sessionWrong.map(function (x) {
          return '<div class="wi"><span class="w">' + esc(x.label) + '</span><span class="c">' + esc(shortGloss(x.cn)) + '</span></div>';
        }).join('') + '</div>';
    } else {
      h += '<div class="empty">全对，漂亮。</div>';
    }
    h += '<div class="btnrow"><button class="btn" id="btn-again2">再来一轮</button>' +
      (S.sessionWrong.length ? '<button class="btn ghost" id="btn-redo">只重做本轮错题</button>' : '') +
      '<button class="btn ghost small" id="btn-back">改设置</button></div></div>';
    $('#stage').innerHTML = h;

    $('#btn-again2').onclick = function () { startQuiz(); };
    $('#btn-back').onclick = function () { $('#setupCard').style.display = ''; $('#stage').innerHTML = ''; renderSetup(); };
    var rd = $('#btn-redo');
    if (rd) rd.onclick = function () { redoWrong(S.sessionWrong); };
    renderSetup();
  }

  function redoWrong(list) {
    var queue = [];
    list.forEach(function (x) {
      var q = null;
      if (x.type === 'affix2word' || x.type === 'affix2mean' || x.type === 'mean2affix') {
        var a = allAffixes().filter(function (z) { return z.affix === x.ref; })[0];
        if (a) q = makeQ(x.type, a);
      } else {
        var w = allWords().filter(function (z) { return z.w === x.ref; })[0];
        if (w) q = makeQ(x.type, w);
      }
      if (q) queue.push(q);
    });
    if (!queue.length) { alert('错题对应的词条已被删除，无法重做。'); return; }
    S.queue = queue; S.idx = 0; S.right = 0; S.wrong = 0; S.sessionWrong = [];
    S.answered = false; S.picked = -1;
    paintStats();
    $('#setupCard').style.display = 'none';
    renderQ();
  }

  /* ---------------- 词缀库 ---------------- */
  function renderAffixList() {
    var host = $('#affixList');
    var h = '';
    DB.groups.forEach(function (g) {
      h += '<div class="grp">';
      h += '<div class="grp-head"><h3>' + esc(g.name) + '</h3><span class="rule"></span><span class="pg">' +
        esc(g.pages || '') + (g.custom ? ' · 自建' : '') + '</span></div>';
      h += '<div class="relations"><b>关系图</b>' + (g.affixes || []).map(function (a) {
        return '<span data-af="' + esc(a.affix) + '">' + esc(a.affix) + '</span>';
      }).join('') + '</div>';
      (g.affixes || []).forEach(function (a) {
        h += '<div class="afcard" id="af-' + esc(slug(a.affix)) + '"><div class="top">' +
          '<span class="no">' + (a.n || '') + '</span>' +
          '<span class="a">' + esc(a.affix) + '</span>' +
          '<span class="g">' + esc(a.gloss) + '</span>' +
          '<span class="cnt">' + (a.words || []).length + ' 个词 ／ 点开看例词</span></div>' +
          '<div class="ws">' + (a.words || []).map(function (w) {
            return '<div class="wrow"><span class="w">' + esc(w.w) + '</span><span class="p">' +
              esc(w.ph ? '[' + w.ph + ']' : '') + '</span><span class="c">' +
              (w.pos ? '<b>' + esc(w.pos) + '</b> ' : '') + esc(w.cn) + '</span></div>';
          }).join('') + '</div></div>';
      });
      h += '</div>';
    });
    if (!DB.groups.length) h = '<div class="empty">词库是空的。</div>';
    host.innerHTML = h;

    host.onclick = function (e) {
      var rel = e.target.closest('.relations span');
      if (rel) {
        var card = document.getElementById('af-' + slug(rel.getAttribute('data-af')));
        if (card) {
          $$('.afcard').forEach(function (c) { c.classList.remove('open'); });
          card.classList.add('open');
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }
      var top = e.target.closest('.afcard .top');
      if (top) { top.parentNode.classList.toggle('open'); }
      var th = e.target.closest('.thumb');
      if (th) openLB(th.getAttribute('data-img'));
    };
  }
  function slug(s) { return String(s).replace(/[^A-Za-z0-9]/g, '-'); }

  /* ---------------- 单词库 ---------------- */
  function renderWords() {
    var kw = ($('#wsearch').value || '').trim().toLowerCase();
    var all = allWords();
    var list = all.filter(function (w) {
      if (!kw) return true;
      return (w.w.toLowerCase().indexOf(kw) >= 0) || (w.cn.indexOf(kw) >= 0) ||
        (w.affix.toLowerCase().indexOf(kw) >= 0) || (w.gloss.indexOf(kw) >= 0);
    });
    $('#wcount').textContent = '共 ' + all.length + ' 个单词' + (kw ? '，匹配 ' + list.length + ' 个' : '') +
      ' · 按前缀归类，点一行看详情';
    var h = '<div class="wt-head"><span>单词 / 音标</span><span>中文释义</span><span>前缀</span></div>';
    h += list.map(function (w, i) {
      return '<div class="wt-row" data-i="' + i + '"><span class="w">' + esc(w.w) +
        '<em>' + esc(w.ph ? '[' + w.ph + '] ' + (w.pos || '') : (w.pos || '')) + '</em></span>' +
        '<span class="c">' + esc(w.cn) + '</span><span class="t">' + esc(w.affix) + ' ' + esc(w.gloss) + '</span></div>' +
        '<div class="wt-detail" id="wtd-' + i + '" style="display:none"></div>';
    }).join('');
    if (!list.length) h += '<div class="wt-row"><span class="c">没找到匹配的单词。</span></div>';
    $('#wordTable').innerHTML = h;

    $('#wordTable').onclick = function (e) {
      var th = e.target.closest('.thumb');
      if (th) { openLB(th.getAttribute('data-img')); return; }
      var row = e.target.closest('.wt-row');
      if (!row || !row.getAttribute('data-i')) return;
      var i = parseInt(row.getAttribute('data-i'), 10);
      var w = list[i];
      var host = document.getElementById('wtd-' + i);
      if (host.style.display !== 'none') { host.style.display = 'none'; row.classList.remove('open'); return; }
      row.classList.add('open');
      var af = allAffixes().filter(function (x) { return x.affix === w.affix; })[0];
      host.innerHTML = '<div class="exgrid split">' +
        '<div class="exbox"><div class="lbl">词根词缀</div>' +
        (af ? '<div class="affixline"><span class="a">' + esc(af.affix) + '</span><span class="g">' + esc(af.gloss) + '</span></div>' +
          '<div class="tags"><span class="tag">' + esc(af.group) + '</span><span class="tag">' + esc(af.pages) + '</span></div>' +
          '<div class="wlist" style="margin-top:12px">' + af.words.map(function (z) {
            return '<div class="wrow' + (z.w === w.w ? ' hi' : '') + '"><span class="w">' + esc(z.w) + '</span><span class="p">' +
              esc(z.ph ? '[' + z.ph + ']' : '') + '</span><span class="c">' +
              (z.pos ? '<b>' + esc(z.pos) + '</b> ' : '') + esc(z.cn) + '</span></div>';
          }).join('') + '</div>' : '<div class="empty">—</div>') + '</div>' +
        '<div class="exbox"><div class="lbl">单词详情 / 来源</div>' +
        '<div class="affixline"><span class="a">' + esc(w.w) + '</span></div>' +
        '<div class="tags">' + (w.pos ? '<span class="tag">' + esc(w.pos) + '</span>' : '') +
        '<span class="tag">' + esc(w.pages) + '</span></div>' +
        '<div class="wrow" style="border-bottom:0;margin-top:10px"><span class="c">' + esc(w.cn) + '</span></div>' +
        linkStudy(w.w) + renderThumbs(w.files) + '</div></div>';
      host.style.display = '';
    };
  }

  /* ---------------- 图片库（IndexedDB） ---------------- */
  var IDB = {
    db: null,
    open: function () {
      return new Promise(function (res, rej) {
        if (IDB.db) return res(IDB.db);
        var r = indexedDB.open('yy_imgs', 1);
        r.onupgradeneeded = function (e) {
          var db = e.target.result;
          if (!db.objectStoreNames.contains('img')) db.createObjectStore('img', { keyPath: 'id' });
        };
        r.onsuccess = function (e) { IDB.db = e.target.result; res(IDB.db); };
        r.onerror = function () { rej(new Error('IndexedDB 不可用')); };
      });
    },
    put: function (rec) {
      return IDB.open().then(function (db) {
        return new Promise(function (res, rej) {
          var tx = db.transaction('img', 'readwrite');
          tx.objectStore('img').put(rec);
          tx.oncomplete = function () { res(rec); };
          tx.onerror = function () { rej(tx.error); };
        });
      });
    },
    all: function () {
      return IDB.open().then(function (db) {
        return new Promise(function (res, rej) {
          var tx = db.transaction('img', 'readonly');
          var rq = tx.objectStore('img').getAll();
          rq.onsuccess = function () { res(rq.result || []); };
          rq.onerror = function () { rej(rq.error); };
        });
      });
    },
    del: function (id) {
      return IDB.open().then(function (db) {
        return new Promise(function (res) {
          var tx = db.transaction('img', 'readwrite');
          tx.objectStore('img').delete(id);
          tx.oncomplete = function () { res(); };
        });
      });
    }
  };

  var IMGS = [];

  function renderImport() {
    IDB.all().then(function (list) {
      IMGS = list.sort(function (a, b) { return a.ts - b.ts; });
      paintImgs();
    }).catch(function () { paintImgs(); });
    renderCustomList();
  }

  function paintImgs() {
    var g = $('#prevgrid');
    if (!IMGS.length) { g.innerHTML = '<div class="empty">还没有照片。</div>'; return; }
    g.innerHTML = IMGS.map(function (im) {
      return '<div class="pi" title="' + esc(im.name) + '"><img src="' + im.dataUrl + '" alt=""><span>' +
        (im.text ? '已识别' : '待识别') + '</span></div>';
    }).join('');
    $('#btn-ocr').disabled = !IMGS.length;
    var pending = IMGS.filter(function (x) { return !x.text; }).length;
    $('#ocrStatus').textContent = '已存 ' + IMGS.length + ' 张照片，其中 ' + (IMGS.length - pending) + ' 张有识别结果。';
    var txt = IMGS.filter(function (x) { return x.text; }).map(function (x) { return x.text; }).join(NL + NL);
    if (txt && !$('#ocrText').value.trim()) $('#ocrText').value = txt;
    var n = parseLines($('#ocrText').value);
    $('#parseHint').textContent = n.length ? ('当前文本可解析出 ' + n.length + ' 个词缀 / ' +
      n.reduce(function (s, x) { return s + x.words.length; }, 0) + ' 个单词') : '把课本内容贴进上面的框，就可以解析。';
  }

  function addFiles(files) {
    var arr = Array.prototype.slice.call(files).filter(function (f) { return /^image[\/]/.test(f.type); });
    if (!arr.length) return;
    var jobs = arr.map(function (f) {
      return new Promise(function (res) {
        var r = new FileReader();
        r.onload = function () {
          var rec = { id: 'i' + Date.now() + Math.floor(Math.random() * 9999), name: f.name, dataUrl: r.result, text: '', ts: Date.now() };
          IDB.put(rec).then(function () { res(rec); }).catch(function () { res(null); });
        };
        r.onerror = function () { res(null); };
        r.readAsDataURL(f);
      });
    });
    Promise.all(jobs).then(function () { renderImport(); });
  }

  /* ---------------- OCR ---------------- */
  function loadTesseract() {
    return new Promise(function (res, rej) {
      if (window.Tesseract) return res(window.Tesseract);
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.4/dist/tesseract.min.js';
      s.onload = function () { window.Tesseract ? res(window.Tesseract) : rej(new Error('引擎加载异常')); };
      s.onerror = function () { rej(new Error('OCR 引擎下载失败（首次使用需要联网）')); };
      document.head.appendChild(s);
    });
  }

  function setStatus(el, msg, cls) {
    el.className = 'status' + (cls ? ' ' + cls : '');
    el.textContent = msg;
  }

  function runOCR() {
    var st = $('#ocrStatus');
    var todo = IMGS.filter(function (x) { return !x.text; });
    if (!todo.length) todo = IMGS.slice();
    if (!todo.length) return;
    $('#btn-ocr').disabled = true;
    setStatus(st, '正在加载 OCR 引擎（首次约 15MB）…');
    var worker = null;
    loadTesseract().then(function (T) {
      setStatus(st, '引擎已加载，初始化中文识别模型…');
      return T.createWorker('chi_sim+eng', 1, {
        logger: function (m) {
          if (m && m.status) setStatus(st, '识别中：' + m.status + (m.progress ? ' ' + Math.round(m.progress * 100) + '%' : ''));
        }
      });
    }).then(function (w) {
      worker = w;
      var chain = Promise.resolve();
      todo.forEach(function (im, i) {
        chain = chain.then(function () {
          setStatus(st, '识别第 ' + (i + 1) + ' / ' + todo.length + ' 张：' + im.name);
          return worker.recognize(im.dataUrl).then(function (r) {
            im.text = cleanOCR(r.data.text);
            return IDB.put(im);
          });
        });
      });
      return chain;
    }).then(function () {
      setStatus(st, '识别完成，共 ' + todo.length + ' 张。可以在下面直接校对文字。', 'ok');
      if (worker) worker.terminate();
      $('#ocrText').value = IMGS.filter(function (x) { return x.text; }).map(function (x) { return x.text; }).join(NL + NL);
      paintImgs();
      $('#btn-ocr').disabled = false;
    }).catch(function (err) {
      setStatus(st, '识别失败：' + (err && err.message ? err.message : err) + '　→ 可以改用「直接粘贴文字」的方式导入。', 'err');
      if (worker) worker.terminate();
      $('#btn-ocr').disabled = false;
    });
  }

  function cleanOCR(t) {
    var lines = stripCR(String(t || '')).split(NL);
    var out = [];
    lines.forEach(function (raw) {
      var l = raw.split('|').join(' ').split('　').join(' ');
      l = joinCJKSpace(l);
      if (!l) return;
      if (/^=+/.test(l)) return;                       // 跳过 ===== 文件名 ===== 分隔行
      if (!/[A-Za-z\u4e00-\u9fff]/.test(l)) return;    // 丢掉纯标点噪音行
      out.push(l);
    });
    return out.join(NL);
  }

  /* ---------------- 文本解析 ---------------- */
  // 词缀行：编号 + 词缀（带中划线）+ 中文含义
  var RE_AFFIX = /^[0-9]{0,2}[ .．·、，,)(]*([A-Za-z][A-Za-z()]{0,13}[-—–一])[ ]*[:：—–一]?[ ]*(.+)$/;
  // 词缀行备选：必须有编号，且词缀后必须跟分隔符（避免误吞单词行）
  var RE_AFFIX2 = /^([0-9]{1,2})[ .．·、，,)(]+([A-Za-z][A-Za-z()]{0,12})[ ]*[:：—–一][ ]*(.+)$/;

  function leadingNum(line) {
    var m = line.match(/^[0-9]{1,2}/);
    return m ? parseInt(m[0], 10) : null;
  }

  function cleanGloss(s) {
    var t = s.replace(/[ ]+[A-Za-z][A-Za-z]{2,}.*$/, '');
    var b = t.indexOf('[');
    if (b > 0) t = t.slice(0, b);
    t = t.replace(/[ ]+$/, '');
    if (t.length > 26) t = t.slice(0, 26);
    return t;
  }

  function looksLikeAffixLine(line) {
    var m = line.match(RE_AFFIX);
    if (m && m[2]) {
      var rest = m[2].trim();
      if (rest && hasCJK(rest) && !/^[A-Za-z]/.test(rest) && !/^[-—–一]/.test(rest)) {
        return { affix: m[1], gloss: cleanGloss(rest) };
      }
    }
    var m2 = line.match(RE_AFFIX2);
    if (m2) {
      var r2 = m2[3].trim();
      if (r2 && hasCJK(r2) && !/^[A-Za-z]/.test(r2) && !/^[-—–一]/.test(r2) && m2[2].length >= 2) {
        return { affix: m2[2], gloss: cleanGloss(r2) };
      }
    }
    return null;
  }

  function parseLines(text) {
    var lines = stripCR(String(text || '')).split(NL);
    var out = [];
    var cur = null;
    lines.forEach(function (raw) {
      var line = joinCJKSpace(raw);
      if (!line || /^=+/.test(line)) return;
      if (!/[A-Za-z]/.test(line)) return;

      var af = looksLikeAffixLine(line);
      if (af) {
        var name = af.affix;
        if (!/[-—–一]$/.test(name)) name = name + '-';
        cur = { n: leadingNum(line), affix: name, gloss: af.gloss, words: [] };
        out.push(cur);
        return;
      }
      var w = parseWordLine(line);
      if (w) {
        if (!cur) { cur = { n: null, affix: '（未归类）', gloss: '', words: [] }; out.push(cur); }
        if (!cur.words.some(function (z) { return z.w === w.w; })) cur.words.push(w);
      }
    });
    return out.filter(function (g) { return g.affix !== '（未归类）' || g.words.length; });
  }

  function isPos(tk) {
    return /^[A-Za-z]{1,5}[.．,，]$/.test(tk);
  }

  function parseWordLine(line) {
    var i = line.indexOf('[');
    var j = i >= 0 ? line.indexOf(']', i) : -1;
    var ph = '', body = line;
    if (i > 0 && j > i) {
      ph = line.slice(i + 1, j).trim();
      body = line.slice(0, i) + ' ' + line.slice(j + 1);
    }
    var cut = firstCJK(body);
    if (cut < 0) return null;                      // 没有中文释义，不是词条行
    var head = body.slice(0, cut).replace(/^[0-9]{1,2}[ .．·、，,)]*/, '');
    var cn = body.slice(cut).replace(/^[ ]*[:：]?[ ]*/, '');
    if (!cn || !hasCJK(cn)) return null;

    var toks = head.split(' ');
    var word = '', pos = '';
    for (var t = 0; t < toks.length; t++) {
      var tk = toks[t].replace(/^[^A-Za-z]+/, '').replace(/[^A-Za-z.．,，-]+$/, '').trim();
      if (!tk) continue;
      if (isPos(tk)) { pos = pos ? pos + ' ' + tk : tk; continue; }
      if (!word) word = tk;
    }
    if (!word || !/[A-Za-z]/.test(word)) return null;
    if (!/^[-A-Za-z.]+$/.test(word)) return null;

    // 释义里如果还带着词性（OCR 常把 n． 粘在中文前），也提出来
    var pm = cn.match(/^[A-Za-z]{1,5}[.．,，][ ]*/);
    if (pm && hasCJK(cn.slice(pm[0].length))) {
      var p = pm[0].replace(/[ ]+$/, '').replace(/[．,，]$/, '.');
      if (!pos) pos = p;
      cn = cn.slice(pm[0].length).trim();
    }
    if (!cn || cn.length < 2) return null;
    return { w: word, ph: ph, pos: pos, cn: cn };
  }

  var PARSED = null;

  function doParse() {
    var st = $('#parseStatus');
    var res = parseLines($('#ocrText').value);
    var nw = res.reduce(function (s, x) { return s + x.words.length; }, 0);
    if (!res.length || !nw) {
      setStatus(st, '没解析出内容。检查一下格式：词缀行要写成「5. ex-：向外、前任」，例词行要带中文释义。', 'err');
      $('#btn-commit').disabled = true;
      $('#parsePreview').style.display = 'none';
      return;
    }
    PARSED = res;
    setStatus(st, '解析出 ' + res.length + ' 个词缀 / ' + nw + ' 个单词。确认无误后点「确认加入词库」。', 'ok');
    $('#btn-commit').disabled = false;
    var box = $('#parsePreview');
    box.style.display = '';
    box.innerHTML = '<div class="wt-head"><span>词缀</span><span>含义 / 例词</span><span>数量</span></div>' + res.map(function (g) {
      return '<div class="wt-row" style="cursor:default"><span class="w">' + esc(g.affix) +
        (g.n ? '<em>#' + g.n + '</em>' : '') + '</span><span class="c">' +
        esc(g.gloss) + ' — ' + esc(g.words.map(function (w) { return w.w; }).join('、')) +
        '</span><span class="t">' + g.words.length + ' 词</span></div>';
    }).join('');
  }

  function commitParsed() {
    if (!PARSED || !PARSED.length) return;
    var name = '自定义 · ' + today();
    var g = CUSTOM.groups.filter(function (x) { return x.name === name; })[0];
    if (!g) { g = { id: 'c' + Date.now(), name: name, pages: '自建', files: [], custom: true, affixes: [] }; CUSTOM.groups.push(g); }
    PARSED.forEach(function (p, i) {
      var exist = g.affixes.filter(function (a) { return a.affix === p.affix; })[0];
      if (exist) {
        p.words.forEach(function (w) {
          if (!exist.words.some(function (z) { return z.w === w.w; })) exist.words.push(w);
        });
      } else {
        g.affixes.push({ n: p.n || (i + 1), affix: p.affix, gloss: p.gloss, words: p.words });
      }
    });
    saveCustom(); buildDB();
    PARSED = null;
    $('#btn-commit').disabled = true;
    $('#parsePreview').style.display = 'none';
    setStatus($('#parseStatus'), '已加入词库：' + g.affixes.length + ' 个词缀。去「开始刷题」里把范围选成「' + name + '」就能练了。', 'ok');
    renderCustomList(); renderSetup(); $('#ocrText').value = '';
    paintFooter();
  }

  function renderCustomList() {
    var host = $('#customList');
    if (!CUSTOM.groups.length) { host.innerHTML = '<div class="empty">还没有自定义词条。导入后会出现在这里。</div>'; return; }
    var h = '';
    CUSTOM.groups.forEach(function (g) {
      h += '<div style="margin:6px 0 4px;font-family:var(--mono);font-size:11px;color:var(--muted);letter-spacing:.6px">' + esc(g.name) + '</div>';
      (g.affixes || []).forEach(function (a) {
        h += '<div class="ci"><span class="a">' + esc(a.affix) + '</span><span class="g">' + esc(a.gloss) + '</span>' +
          '<span class="n">' + (a.words || []).length + ' 词</span>' +
          '<button data-g="' + esc(g.id) + '" data-a="' + esc(a.affix) + '">删除</button></div>';
      });
    });
    host.innerHTML = h;
    host.onclick = function (e) {
      var b = e.target.closest('button[data-a]');
      if (!b) return;
      var gid = b.getAttribute('data-g'), af = b.getAttribute('data-a');
      var g = CUSTOM.groups.filter(function (x) { return x.id === gid; })[0];
      if (!g) return;
      g.affixes = g.affixes.filter(function (a) { return a.affix !== af; });
      CUSTOM.groups = CUSTOM.groups.filter(function (x) { return x.affixes.length; });
      saveCustom(); buildDB(); renderCustomList(); renderSetup(); paintFooter();
    };
  }

  function exportJSON() {
    var data = JSON.stringify({ book: 'custom', groups: CUSTOM.groups }, null, 2);
    var blob = new Blob([data], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '词根词缀自建词库.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function importJSON(file) {
    var r = new FileReader();
    r.onload = function () {
      try {
        var o = JSON.parse(r.result);
        var gs = o.groups || o;
        if (!Array.isArray(gs)) throw new Error('格式不对');
        gs.forEach(function (g) {
          g.custom = true;
          if (!g.id) g.id = 'c' + Date.now() + Math.floor(Math.random() * 999);
          if (!g.name) g.name = '自定义 · ' + today();
          CUSTOM.groups.push(g);
        });
        saveCustom(); buildDB(); renderCustomList(); renderSetup(); paintFooter();
        setStatus($('#parseStatus'), '已导入 ' + gs.length + ' 个分组。', 'ok');
      } catch (e) {
        setStatus($('#parseStatus'), '导入失败：' + e.message, 'err');
      }
    };
    r.readAsText(file);
  }

  /* ---------------- 灯箱 / 快捷键 ---------------- */
  function openLB(src) {
    $('#lbimg').src = src;
    $('#lightbox').classList.add('on');
  }

  function bindKeys() {
    document.addEventListener('keydown', function (e) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (S.view !== 'quiz' || !S.running) return;
      var q = S.queue[S.idx];
      if (!q) return;
      if (e.key === 'Enter') {
        // 按钮被鼠标点中后回车会自己触发 click，别再叠加一次
        if (e.target && e.target.id === 'btn-next') return;
        e.preventDefault();
        if (S.answered) next();
        return;
      }
      if (S.answered) return;
      var k = e.key.toUpperCase();
      var idx = -1;
      if (k >= '1' && k <= '4') idx = parseInt(k, 10) - 1;
      else if ('ABCD'.indexOf(k) >= 0) idx = 'ABCD'.indexOf(k);
      if (idx >= 0 && q.options && idx < q.options.length) { e.preventDefault(); answerOpt(idx); }
    });
  }

  /* ---------------- 页脚 ---------------- */
  function paintFooter() {
    var a = allAffixes(), w = allWords();
    $('#f-affix').textContent = a.length;
    $('#f-word').textContent = w.length;
    $('#hcount').innerHTML = a.length + ' 个词缀 · ' + w.length + ' 个单词';
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    loadCustom();
    if (!CUSTOM.groups.length && window.SEED_CUSTOM) CUSTOM = window.SEED_CUSTOM;
    buildDB();
    loadProg();
    paintStats();
    paintFooter();
    $('#f-time').textContent = '构建日期 ' + today();

    $$('nav button').forEach(function (b) {
      b.onclick = function () { showView(b.getAttribute('data-view')); };
    });

    renderSetup();

    $('#btn-start').onclick = function () { startQuiz(); };
    $('#btn-again').onclick = function () {
      var list = S.wrongBook.map(function (x) { return { label: x.label, cn: x.cn, ref: x.key, type: x.type }; });
      redoWrong(list);
    };

    $('#wsearch').oninput = renderWords;

    $('#drop').onclick = function () { $('#file').click(); };
    $('#file').onchange = function (e) { addFiles(e.target.files); e.target.value = ''; };
    ['dragenter', 'dragover'].forEach(function (ev) {
      $('#drop').addEventListener(ev, function (e) { e.preventDefault(); $('#drop').classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      $('#drop').addEventListener(ev, function (e) { e.preventDefault(); $('#drop').classList.remove('over'); });
    });
    $('#drop').addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files); });

    $('#btn-ocr').onclick = runOCR;
    $('#btn-cleartext').onclick = function () { $('#ocrText').value = ''; paintImgs(); };
    $('#ocrText').oninput = function () {
      var n = parseLines($('#ocrText').value);
      $('#parseHint').textContent = n.length ? ('可解析出 ' + n.length + ' 个词缀 / ' +
        n.reduce(function (s, x) { return s + x.words.length; }, 0) + ' 个单词') : '把课本内容贴进上面的框，就可以解析。';
    };
    $('#btn-parse').onclick = doParse;
    $('#btn-commit').onclick = commitParsed;
    $('#btn-export').onclick = exportJSON;
    $('#btn-import').onclick = function () { $('#jsonfile').click(); };
    $('#jsonfile').onchange = function (e) { if (e.target.files[0]) importJSON(e.target.files[0]); e.target.value = ''; };
    $('#btn-reset').onclick = function () {
      if (!confirm('确定清空所有自己导入的词缀？课本自带的内容不会受影响。')) return;
      CUSTOM = { groups: [] };
      saveCustom(); buildDB(); renderCustomList(); renderSetup(); paintFooter();
      setStatus($('#parseStatus'), '已清空自定义词库。', 'ok');
    };

    $('#lightbox').onclick = function () { $('#lightbox').classList.remove('on'); };
    document.addEventListener('click', function (e) {
      var th = e.target.closest('.thumb');
      if (th) { e.preventDefault(); openLB(th.getAttribute('data-img')); }
    });
    bindKeys();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
