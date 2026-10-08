/* ============================================================
 * 通用答题引擎  ——  换 quiz-data.js 即可换主题
 * 验证码 / 答题 / 计分 / 十段式结果 / Canvas 分享卡
 * ============================================================ */

/* ---------- 部署前请改这里 ---------- */
const CONFIG = {
  showFakePV: true,                  // 封面「已完成人数」为氛围数据，可关
  pvBase: 3860,

  /* 结果页底部那张「下一个测试」卡片 —— 这是把人导回你店铺的入口
   *
   * 两种用法二选一：
   *   A. 还没做第二款 → nextLink 填【店铺链接】，标题改成「更多人格测试」
   *   B. 已有第二款   → nextLink 填【第二款的链接】，标题写那一款的名字
   *
   * 链接怎么拿：小红书 App 进你的店铺页 → 右上角分享 → 复制链接
   * 填进去之后完整保留引号，例：nextLink: 'https://www.xiaohongshu.com/...' */
  nextTitle: '更 多 人 格 测 试',
  nextDesc: '点击进入店铺 · 持续上新中',
  nextLink: '',
  nextBtn: '立 即 开 始',
  nextInNewTab: true,                // true=新开标签页（结果页不会丢），false=当前页直接跳

  shotTip: '搜索笔记作者 · 解锁更多测试'
};
/* ---------------------------------- */

/* ===== 验证码算法见 code.js ===== */

/* ===== 工具 ===== */
const $ = id => document.getElementById(id);
function go(id){
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
  window.scrollTo(0, 0);
}
function toast(msg){
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('on'), 1900);
}
function lsGet(k, d){ try { const v = localStorage.getItem(k); return v === null ? d : v; } catch(e){ return d; } }
function lsSet(k, v){ try { localStorage.setItem(k, v); } catch(e){} }

/* ===== 计分：每题三档 2 / 1 / 0，每个维度 3 题，满分 6，中位 3 =====
 * 三档比二选一多出「中间态」，但每维度 3 题必然存在 sum===3 的平局。
 * 平局规则：看该维度第一题是否选了强倾向项（第一反应更能代表你）。
 * 这条规则让八种结果的分布最接近均匀，改题目顺序时记得重跑 check.js。 */
function calcKey(ans){
  const dims = { EI: [], TF: [], AP: [] };
  ans.forEach((v, i) => dims[QUIZ.questions[i].dim].push(v));
  let key = '', spread = 0;
  for (const k in dims){
    const arr = dims[k];
    const sum = arr.reduce((a, b) => a + b, 0);
    const mid = arr.length;                 // 3 题 × 中位 1 = 3
    let hi;
    if (sum > mid) hi = true;
    else if (sum < mid) hi = false;
    else hi = arr[0] === 2;                 // 平局：以该维度第一题为准
    key += (hi ? k[0] : k[1]);
    spread += Math.abs(sum / (arr.length * 2) - 0.5);
  }
  return { key, spread };
}

/* ===== 全局状态 ===== */
let answers = [];
let cur = 0;
let myResult = null;

/* ===== 屏1 验证码 ===== */
function initGate(){
  $('gateTitle').textContent = QUIZ.gateTitle;
  const input = $('codeInput');
  const box = $('codeBox');
  const LEN = currentCode().length;          // 口令长度跟着 code.js 走
  const MAXLEN = Math.max(LEN, 12);
  input.setAttribute('maxlength', String(MAXLEN));

  input.addEventListener('focus', () => box.classList.add('focus'));
  input.addEventListener('blur', () => box.classList.remove('focus'));
  input.addEventListener('input', () => {
    input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, MAXLEN);
    $('codeMsg').textContent = '';
    box.classList.remove('err');
    if (input.value.length === LEN) setTimeout(tryUnlock, 150);
  });
  $('btnUnlock').addEventListener('click', tryUnlock);

  function tryUnlock(){
    const v = input.value.trim();
    if (!v) return fail('请输入验证码');
    if (v.length !== LEN) return fail('验证码位数不对，应为 ' + LEN + ' 位');
    if (!verifyCode(v)) return fail('验证码不正确，请核对后重试');
    lsSet('hq_code', v);
    $('codeMsg').textContent = '';
    go('s-intro');
  }
  function fail(m){
    $('codeMsg').textContent = m;
    box.classList.add('err');
    setTimeout(() => box.classList.remove('err'), 500);
  }
}

/* ===== 屏2 封面 ===== */
function initIntro(){
  $('introTitle').textContent = QUIZ.introTitle;
  $('introSub').textContent = QUIZ.introSub;
  $('introDesc').innerHTML = QUIZ.introDesc.map(t => '<p>' + t + '</p>').join('');

  const metaEl = document.querySelector('.intro-meta');
  if (CONFIG.showFakePV){
    let n = parseInt(lsGet('hq_pv', '0'), 10);
    n = n ? n + Math.floor(Math.random() * 5) : CONFIG.pvBase + Math.floor(Math.random() * 400);
    lsSet('hq_pv', String(n));
    $('pvNum').textContent = n.toLocaleString();
  } else if (metaEl){
    metaEl.remove();
  }

  if (lsGet('hq_result', '')){
    const b = document.createElement('button');
    b.className = 'btn btn-ghost';
    b.style.marginTop = '12px';
    b.textContent = '查 看 我 的 上 次 结 果';
    b.onclick = showCachedResult;
    $('btnStart').after(b);
  }

  $('btnStart').addEventListener('click', () => {
    answers = []; cur = 0; myResult = null;
    renderQuestion();
    go('s-quiz');
  });
}

function showCachedResult(){
  let c = null;
  try { c = JSON.parse(lsGet('hq_result', '')); } catch(e){ c = null; }
  if (!c || !c.answers || !QUIZ.results[c.key]) return;
  answers = c.answers;
  myResult = buildMyResult(answers);
  buildResult();
  go('s-result');
}

function buildMyResult(ans){
  const { key, spread } = calcKey(ans);
  const r = QUIZ.results[key] || QUIZ.results.ETA;
  return Object.assign({}, r, {
    _key: key,
    _sim: Math.min(97, r.baseMatch + Math.min(4, Math.round(spread * 4)))
  });
}

/* ===== 屏3 答题 ===== */
function renderQuestion(){
  const q = QUIZ.questions[cur];
  $('qNum').textContent = String(cur + 1).padStart(2, '0');
  $('quizBar').style.width = (cur / QUIZ.questions.length * 100) + '%';
  $('qText').textContent = q.q;
  $('btnBack').classList.toggle('hide', cur === 0);
  $('qTip').textContent = cur === 0 ? '凭第一反应选择' : '不要多想，选更像你的那个';

  const wrap = $('opts');
  wrap.innerHTML = '';
  q.options.forEach(op => {
    const b = document.createElement('button');
    b.className = 'opt';
    if (answers[cur] === op.v) b.classList.add('on');
    b.textContent = op.t;
    b.onclick = () => pick(op.v);
    wrap.appendChild(b);
  });
}
function pick(v){
  answers[cur] = v;
  clearTimeout(pick._t);
  pick._t = setTimeout(() => {
    if (cur < QUIZ.questions.length - 1){
      cur++;
      renderQuestion();
      window.scrollTo(0, 0);
    } else {
      $('quizBar').style.width = '100%';
      runCalc();
    }
  }, 300);
}
$('btnBack').addEventListener('click', () => {
  if (cur > 0){ cur--; renderQuestion(); }
});

/* ===== 屏4 计算动画 ===== */
function runCalc(){
  go('s-calc');
  const steps = QUIZ.calcSteps;
  let i = 0;
  const timer = setInterval(() => {
    i++;
    const pct = Math.round(i / steps.length * 100);
    $('calcNum').textContent = pct;
    $('calcBar').style.width = pct + '%';
    $('calcStep').textContent = steps[i - 1] || steps[steps.length - 1];
    if (i >= steps.length){
      clearInterval(timer);
      setTimeout(() => {
        myResult = buildMyResult(answers);
        lsSet('hq_result', JSON.stringify({ key: myResult._key, answers: answers }));
        buildResult();
        go('s-result');
      }, 600);
    }
  }, 520);
}

/* ===== 屏5 结果：十段式 ===== */
function buildResult(){
  const r = myResult;
  const M = QUIZ.dimMeta;
  const first = r.name.slice(0, -1);
  const last = r.name.slice(-1);
  let html = '';

  /* 01 主卡 */
  html += `
  <div class="rv" style="padding-top:34px">
    <div class="r-hero">
      <div class="r-lab">你 的 灵 魂 原 型</div>
      <h1 class="r-name">${first}<span class="last">${last}</span></h1>
      <div class="r-tag">${r.tag}</div>
      <div class="r-stat">
        <div><div class="k" id="simNum">0</div><div class="t">相 似 度</div></div>
        <div><div class="k">${r.rarity}</div><div class="t">稀 缺 度</div></div>
      </div>
      <div class="r-dim">${r.dimText}</div>
    </div>
  </div>`;

  /* 02 人格解读 */
  html += `
  <div class="r-sec rv">
    <div class="r-sec-t">人 格 解 读</div>
    ${r.intro.map(p => '<p class="r-p">' + p + '</p>').join('')}
  </div>`;

  /* 03 灵魂数据 */
  html += '<div class="r-sec rv"><div class="r-sec-t">你 的 灵 魂 数 据</div>';
  ['EI', 'TF', 'AP'].forEach(k => {
    const isHi = myResult._key.indexOf(k[0]) >= 0;
    const val = isHi ? r.meters[k] : 100 - r.meters[k];
    const label = isHi ? M[k].hiLabel : M[k].loLabel;
    html += `
    <div class="meter">
      <div class="meter-hd"><span class="n">${label}</span><span class="v">${val}%</span></div>
      <div class="meter-tr"><div class="meter-fi" data-w="${val}"></div></div>
      <div class="meter-nt">${r.meterNote[k]}</div>
    </div>`;
  });
  html += '</div>';

  /* 04 隐藏面 */
  html += `
  <div class="r-sec rv">
    <div class="r-sec-t">你 的 隐 藏 面</div>
    <div class="mask-box">
      <div class="line"><span class="lb">表 面</span>${r.maskedLabel}</div>
      <div class="line real"><span class="lb">真 实</span>${r.maskedReal}</div>
    </div>
  </div>`;

  /* 05 天赋 */
  html += `
  <div class="r-sec rv">
    <div class="r-sec-t">你 的 三 个 天 赋</div>
    <ul class="list">${r.gifts.map(g => '<li>' + g + '</li>').join('')}</ul>
  </div>`;

  /* 06 软肋 */
  html += `
  <div class="r-sec rv">
    <div class="r-sec-t">你 最 该 小 心 的 地 方</div>
    <ul class="list flaw">${r.flaws.map(f => '<li>' + f + '</li>').join('')}</ul>
  </div>`;

  /* 07 典故 */
  html += `
  <div class="r-sec rv">
    <div class="r-sec-t">来 自 历 史 的 印 证</div>
    <div class="story">
      <div class="yr">${r.story.year}</div>
      <div class="tx">${r.story.text}</div>
      <div class="fm">— 如果你不信，去查一查这段 —</div>
    </div>
  </div>`;

  /* 08 合拍 / 相克 */
  html += `
  <div class="r-sec rv">
    <div class="r-sec-t">你 与 谁 最 合 得 来</div>
    <div class="two">
      <div><div class="h">天 生 合 拍</div><div class="nm">${r.match.good}</div><div class="wx">${r.match.goodWhy}</div></div>
      <div class="bad"><div class="h">最 难 相 处</div><div class="nm">${r.match.bad}</div><div class="wx">${r.match.badWhy}</div></div>
    </div>
  </div>`;

  /* 09 关键词 + 签名 */
  html += `
  <div class="r-sec rv">
    <div class="r-sec-t">你 今 年 的 关 键 词</div>
    <div class="kw-box">
      <div class="kw">${r.keyword}</div>
      <div class="kw-lb">A N N U A L &nbsp; K E Y W O R D</div>
      <div class="sig">${r.signature}</div>
      <div class="sig-copy" id="btnCopySig">复 制 我 的 专 属 签 名</div>
    </div>
  </div>`;

  /* 10 金句 */
  html += `
  <div class="rv">
    <div class="quote">
      <div class="qt">${r.quote}</div>
      <div class="mark">这 句 话 建 议 你 截 图</div>
    </div>
  </div>`;

  /* 操作区 */
  html += `
  <div class="acts rv">
    <button class="btn btn-line" id="btnShot">生 成 我 的 结 果 卡</button>
    <button class="btn btn-seal" id="btnAgain">再 测 一 次</button>
    <p class="r-share-tip">结果卡可保存后发朋友圈 / 小红书<br>看看有没有人和你是同一位</p>
  </div>`;

  /* 导流 */
  html += `
  <div class="next rv" id="btnNext">
    <div class="lb">下 一 个 测 试</div>
    <div class="ti">${CONFIG.nextTitle}</div>
    <div class="ds">${CONFIG.nextDesc}</div>
    <div class="sig-copy" style="margin-top:0">${CONFIG.nextBtn}</div>
  </div>`;

  html += `<div class="disclaim rv">${QUIZ.disclaimer}</div>`;

  $('result').innerHTML = html;

  setTimeout(() => animateResult(r._sim), 120);

  $('btnShot').onclick = makeCard;
  $('btnAgain').onclick = () => {
    answers = []; cur = 0; myResult = null;
    renderQuestion();
    go('s-quiz');
  };
  $('btnCopySig').onclick = () => { copyText(r.signature); toast('签名已复制'); };
  $('btnNext').onclick = () => {
    if (!CONFIG.nextLink) return toast('即将上线，敬请期待');
    if (CONFIG.nextInNewTab){
      const w = window.open(CONFIG.nextLink, '_blank');
      if (!w) location.href = CONFIG.nextLink;    // 被浏览器拦截时退回当前页跳转
    } else {
      location.href = CONFIG.nextLink;
    }
  };
}

function animateResult(sim){
  const el = $('simNum');
  if (el){
    let n = 0;
    const step = () => {
      n += Math.max(1, Math.ceil((sim - n) / 6));
      el.textContent = n >= sim ? sim : n;
      if (n < sim) requestAnimationFrame(step);
    };
    step();
  }
  setTimeout(() => {
    document.querySelectorAll('.meter-fi').forEach(f => { f.style.width = f.dataset.w + '%'; });
  }, 280);

  const items = document.querySelectorAll('#result .rv');
  if ('IntersectionObserver' in window){
    const io = new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting){ e.target.classList.add('show'); io.unobserve(e.target); } });
    }, { threshold: 0.05 });
    items.forEach(i => io.observe(i));
  } else {
    items.forEach(i => i.classList.add('show'));
  }
}

function copyText(t){
  const ta = document.createElement('textarea');
  ta.value = t;
  ta.style.position = 'absolute';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch(e){}
  document.body.removeChild(ta);
}

/* ===== Canvas 分享卡 ===== */
function makeCard(){
  const r = myResult;
  const W = 750, H = 1334;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const F = (s) => '400 ' + s + 'px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
  const INK = '#1F1D1A', INK2 = '#4A453F', INK3 = '#8A837A', SEAL = '#B23A2E', GOLD = '#B08D3F';

  c.fillStyle = '#FAF8F3'; c.fillRect(0, 0, W, H);
  c.strokeStyle = '#E4DFD4'; c.lineWidth = 2;
  c.strokeRect(38, 38, W - 76, H - 76);
  c.fillStyle = SEAL; c.fillRect(38, 38, W - 76, 5);

  c.textBaseline = 'alphabetic';

  c.fillStyle = SEAL;
  roundRect(c, W - 132, 84, 62, 62, 8); c.fill();
  c.fillStyle = '#fff'; c.font = F(32); c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('测', W - 101, 117);
  c.textBaseline = 'alphabetic'; c.textAlign = 'left';

  c.fillStyle = GOLD; c.font = F(20);
  spaced(c, '趣 味 心 理 投 射', 78, 122, 8);
  c.fillStyle = INK3; c.font = F(22);
  spaced(c, '你 的 灵 魂 原 型', 78, 176, 7);

  const nm = r.name;
  c.font = F(94);
  c.fillStyle = INK;
  const head = nm.slice(0, -1);
  c.fillText(head, 76, 300);
  const hw = c.measureText(head).width;
  c.fillStyle = SEAL;
  c.fillText(nm.slice(-1), 76 + hw, 300);

  c.fillStyle = INK2; c.font = F(30);
  c.fillText(r.tag, 76, 356);

  c.fillStyle = SEAL; c.font = F(46);
  c.fillText(r._sim + '%', 76, 434);
  c.fillStyle = INK3; c.font = F(19);
  c.fillText('相似度', 76, 466);

  c.fillStyle = SEAL; c.font = F(46);
  c.fillText(r.rarity, 266, 434);
  c.fillStyle = INK3; c.font = F(19);
  c.fillText('稀缺度', 266, 466);

  c.strokeStyle = '#E4DFD4'; c.lineWidth = 1;
  line(c, 76, 514, W - 76, 514);

  c.fillStyle = INK2; c.font = F(25);
  let y = wrap(c, r.intro[0], 76, 566, W - 152, 42, 3);

  y += 30;
  c.fillStyle = '#F5F1E8';
  roundRect(c, 76, y, W - 152, 150, 12); c.fill();
  c.fillStyle = '#8A9A94'; c.font = F(18); c.textAlign = 'left';
  c.fillText('别人眼里 / 真实的你', 102, y + 38);
  c.fillStyle = INK; c.font = F(23);
  const yy = wrap(c, r.maskedReal.replace('真实的你 — ', ''), 102, y + 80, W - 204, 38, 2);
  y = Math.max(y + 150, yy + 20);

  y += 48;
  c.fillStyle = GOLD; c.font = F(18);
  spaced(c, '今 年 关 键 词', 76, y, 6);
  y += 64;
  c.fillStyle = INK; c.font = F(58);
  spaced(c, r.keyword, 76, y, 16);

  y += 72;
  c.fillStyle = INK2; c.font = F(24);
  y = wrap(c, r.signature, 76, y, W - 152, 40, 3);

  const qTop = H - 430;
  c.strokeStyle = '#E4DFD4'; c.lineWidth = 1;
  line(c, 76, qTop, W - 76, qTop);
  c.fillStyle = SEAL; c.font = F(30); c.textAlign = 'center';
  c.fillText('「', W / 2, qTop + 60);
  c.fillStyle = INK; c.font = F(34);
  wrap(c, r.quote, W / 2, qTop + 116, W - 190, 52, 4, 'center');
  c.fillStyle = SEAL; c.font = F(30);
  c.fillText('」', W / 2, qTop + 352);

  c.fillStyle = INK3; c.font = F(20); c.textAlign = 'center';
  c.fillText(CONFIG.shotTip, W / 2, H - 86);
  c.font = F(16);
  c.fillText(QUIZ.disclaimer, W / 2, H - 54);

  const holder = $('shotHolder');
  holder.innerHTML = '';
  const img = new Image();
  img.src = cv.toDataURL('image/png');
  holder.appendChild(img);
  $('shotMask').classList.add('on');
}

function roundRect(c, x, y, w, h, r){
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function line(c, x1, y1, x2, y2){
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
}
function spaced(c, text, x, y, gap){
  let cx = x;
  for (const ch of String(text)){
    c.fillText(ch, cx, y);
    cx += c.measureText(ch).width + gap;
  }
}
function wrap(c, text, x, y, maxW, lh, maxLine, align){
  c.textAlign = align || 'left';
  const chars = String(text).split('');
  let ln = '', ty = y, lines = 0;
  for (let i = 0; i < chars.length; i++){
    const test = ln + chars[i];
    if (c.measureText(test).width > maxW && ln){
      c.fillText(ln, x, ty);
      ty += lh; lines++;
      if (maxLine && lines >= maxLine) return ty;
      ln = chars[i];
    } else {
      ln = test;
    }
  }
  if (ln && (!maxLine || lines < maxLine)){ c.fillText(ln, x, ty); ty += lh; }
  return ty;
}

/* ===== 弹层 ===== */
$('btnCloseShot').addEventListener('click', () => $('shotMask').classList.remove('on'));
$('shotMask').addEventListener('click', e => {
  if (e.target === $('shotMask')) $('shotMask').classList.remove('on');
});

/* ===== 启动 ===== */
(function boot(){
  initGate();
  initIntro();

  const saved = lsGet('hq_code', '');
  let unlocked = saved && verifyCode(saved);

  const q = location.search.match(/[?&]c=([A-Za-z0-9]{1,12})/);
  if (!unlocked && q && verifyCode(q[1])){
    lsSet('hq_code', q[1].toUpperCase());
    unlocked = true;
  }
  if (unlocked) go('s-intro');
})();
