const EMOJIS = ['🔴', '🟡', '🟢', '🔵', '🟣', '🟠', '⭐', '🌸'];
const BG = ['#ffe0e0', '#fff9cc', '#d4f5d4', '#d0e8ff', '#ead6ff', '#ffe3cc', '#fffbe0', '#ffe8f4'];
const DIFF_NAMES = ['', '入门', '简单', '简单', '普通', '普通', '中等', '中等', '困难', '困难', '很难', '很难', '专家', '专家', '大师'];

function getDiffName(lv) {
  if (lv <= 14) return DIFF_NAMES[lv] || '大师';
  if (lv <= 30) return '大师+';
  if (lv <= 60) return '传说';
  if (lv <= 120) return '神话';
  return '无尽';
}

function getLevelConfig(lv) {
  const dim = Math.min(6 + Math.floor((lv - 1) / 5), 8);
  const cols = dim, rows = dim;
  const colors = Math.min(3 + Math.floor((lv - 1) / 4), 8);
  const moves = Math.max(Math.round(40 - (lv - 1) * 0.45), 15);
  const target = Math.round((300 + (lv - 1) * 350) / 100) * 100;
  return { cols, rows, moves, colors, target };
}

let board = [], score = 0, movesLeft = 0, sel = null, busy = false;
let level = 1, unlockedLevel = 1, cfg = {}, history = [];
let cellSize = 40;

function loadData() {
  try {
    let d = JSON.parse(localStorage.getItem('m3v4') || '{}');
    if (!d.unlockedLevel) {
      const old = JSON.parse(localStorage.getItem('m3v3') || '{}');
      if (old.level) {
        d.unlockedLevel = old.level;
        d.history = old.history || [];
      }
    }
    unlockedLevel = d.unlockedLevel || 1;
    level = unlockedLevel;
    history = d.history || [];
  } catch (e) {
    unlockedLevel = 1;
    level = 1;
    history = [];
  }
}

function saveData() {
  try { localStorage.setItem('m3v4', JSON.stringify({ unlockedLevel, history })); } catch (e) { }
}

function calcCellSize(cols) {
  const avail = Math.min(window.innerWidth, 400) - 20 - 12;
  return Math.floor((avail - (cols - 1) * 3) / cols);
}

function startLevel(lv) {
  level = lv;
  cfg = getLevelConfig(lv);
  score = 0;
  movesLeft = cfg.moves;
  sel = null;
  busy = false;
  cellSize = calcCellSize(cfg.cols);
  document.getElementById('lv-text').textContent = '第 ' + lv + ' 关';
  document.getElementById('diff-badge').textContent = getDiffName(lv);
  document.getElementById('target-sm').textContent = cfg.target >= 10000 ? (cfg.target / 1000).toFixed(0) + 'k' : cfg.target;
  document.getElementById('board-overlay').classList.remove('active');
  document.getElementById('board-overlay').innerHTML = '';
  do { board = genBoard(); } while (!hasMove());
  renderBoard(true);
  setMsg('消除方块，达到目标分！');
  updateStats();
  renderHistory();
}

function restartLevel() { startLevel(level); }

function genBoard() {
  let b = [];
  for (let r = 0; r < cfg.rows; r++) {
    b[r] = [];
    for (let c = 0; c < cfg.cols; c++) {
      let v;
      do {
        v = Math.floor(Math.random() * cfg.colors);
      } while (
        (c >= 2 && b[r][c - 1] === v && b[r][c - 2] === v) ||
        (r >= 2 && b[r - 1][c] === v && b[r - 2][c] === v)
      );
      b[r][c] = v;
    }
  }
  return b;
}

function renderBoard(animate) {
  const el = document.getElementById('board');
  el.style.gridTemplateColumns = `repeat(${cfg.cols},${cellSize}px)`;
  el.innerHTML = '';
  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.cols; c++) {
      const d = makeCell(r, c, animate);
      el.appendChild(d);
    }
  }
}

function makeCell(r, c, animate) {
  const v = board[r][c];
  const d = document.createElement('div');
  d.className = 'cell' + (animate ? ' anim-fall' : '');
  d.dataset.r = r;
  d.dataset.c = c;
  d.style.width = cellSize + 'px';
  d.style.height = cellSize + 'px';
  d.style.fontSize = Math.round(cellSize * 0.52) + 'px';
  d.style.background = BG[v];
  if (animate) d.style.animationDelay = (r * 0.03 + c * 0.02) + 's';
  d.textContent = EMOJIS[v];
  if (sel && sel[0] === r && sel[1] === c) d.classList.add('sel');
  d.onclick = () => onCell(r, c);
  return d;
}

function getCellEl(r, c) {
  return document.querySelector(`[data-r="${r}"][data-c="${c}"]`);
}

function onCell(r, c) {
  if (busy) return;
  if (!sel) {
    sel = [r, c];
    const e = getCellEl(r, c);
    if (e) e.classList.add('sel');
    return;
  }
  const [sr, sc] = sel;
  if (sr === r && sc === c) {
    sel = null;
    const e = getCellEl(r, c);
    if (e) e.classList.remove('sel');
    return;
  }
  if ((Math.abs(sr - r) + Math.abs(sc - c)) !== 1) {
    const old = getCellEl(sr, sc);
    if (old) old.classList.remove('sel');
    sel = [r, c];
    const e = getCellEl(r, c);
    if (e) e.classList.add('sel');
    return;
  }
  sel = null;
  trySwap(sr, sc, r, c);
}

async function trySwap(r1, c1, r2, c2) {
  busy = true;
  await animSwap(r1, c1, r2, c2);
  swap(r1, c1, r2, c2);
  const m = getMatches();
  if (m.length === 0) {
    swap(r1, c1, r2, c2);
    await animSwap(r2, c2, r1, c1);
    busy = false;
    renderBoard(false);
    setMsg('无法消除，换个位置试试');
    return;
  }
  movesLeft--;
  await processMatches();
  busy = false;
  if (score >= cfg.target) { showLevelComplete(); return; }
  if (movesLeft <= 0) { showGameOver(); return; }
  if (!hasMove()) {
    setMsg('自动重排！');
    await sleep(500);
    do { board = genBoard(); } while (!hasMove());
    renderBoard(true);
  }
}

async function animSwap(r1, c1, r2, c2) {
  const e1 = getCellEl(r1, c1), e2 = getCellEl(r2, c2);
  const sw = cellSize + 3 + 'px';
  let a1 = '', a2 = '';
  if (c2 > c1) { a1 = 'swap-r'; a2 = 'swap-l'; }
  else if (c2 < c1) { a1 = 'swap-l'; a2 = 'swap-r'; }
  else if (r2 > r1) { a1 = 'swap-d'; a2 = 'swap-u'; }
  else { a1 = 'swap-u'; a2 = 'swap-d'; }
  if (e1) { e1.style.setProperty('--sw', sw); e1.classList.add('anim-' + a1); }
  if (e2) { e2.style.setProperty('--sw', sw); e2.classList.add('anim-' + a2); }
  await sleep(190);
  if (e1) e1.classList.remove('anim-' + a1);
  if (e2) e2.classList.remove('anim-' + a2);
}

async function processMatches() {
  let combo = 0;
  while (true) {
    const m = getMatches();
    if (m.length === 0) break;
    combo++;
    const pts = m.length * 10 + (m.length > 3 ? (m.length - 3) * 30 : 0) + (combo > 1 ? combo * 15 : 0);
    score += pts;
    if (combo > 1) setMsg('连击 x' + combo + '！+' + pts);
    else if (m.length >= 5) setMsg('超级消除！+' + pts);
    else if (m.length >= 4) setMsg('四消！+' + pts);
    else setMsg('+' + pts);
    await animPop(m);
    m.forEach(([r, c]) => board[r][c] = -1);
    dropTiles();
    fillBoard();
    await animFall();
  }
  updateStats();
}

async function animPop(cells) {
  cells.forEach(([r, c]) => {
    const e = getCellEl(r, c);
    if (e) e.classList.add('anim-pop');
  });
  await sleep(290);
}

async function animFall() {
  renderBoard(false);
  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.cols; c++) {
      const e = getCellEl(r, c);
      if (e && !e.classList.contains('anim-fall')) {
        e.classList.add('anim-fall');
        e.style.animationDelay = (Math.random() * 0.04) + 's';
      }
    }
  }
  await sleep(240);
}

function getMatches() {
  const set = new Set();
  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.cols - 2; c++) {
      if (board[r][c] >= 0 && board[r][c] === board[r][c + 1] && board[r][c] === board[r][c + 2]) {
        let l = 3;
        while (c + l < cfg.cols && board[r][c + l] === board[r][c]) l++;
        for (let i = 0; i < l; i++) set.add(r * cfg.cols + c + i);
      }
    }
  }
  for (let c = 0; c < cfg.cols; c++) {
    for (let r = 0; r < cfg.rows - 2; r++) {
      if (board[r][c] >= 0 && board[r][c] === board[r + 1][c] && board[r][c] === board[r + 2][c]) {
        let l = 3;
        while (r + l < cfg.rows && board[r + l][c] === board[r][c]) l++;
        for (let i = 0; i < l; i++) set.add((r + i) * cfg.cols + c);
      }
    }
  }
  return [...set].map(k => [Math.floor(k / cfg.cols), k % cfg.cols]);
}

function dropTiles() {
  for (let c = 0; c < cfg.cols; c++) {
    let empty = [];
    for (let r = cfg.rows - 1; r >= 0; r--) {
      if (board[r][c] === -1) empty.push(r);
      else if (empty.length > 0) {
        board[empty.shift()][c] = board[r][c];
        board[r][c] = -1;
        empty.push(r);
      }
    }
  }
}

function fillBoard() {
  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.cols; c++) {
      if (board[r][c] === -1) board[r][c] = Math.floor(Math.random() * cfg.colors);
    }
  }
}

function swap(r1, c1, r2, c2) {
  [board[r1][c1], board[r2][c2]] = [board[r2][c2], board[r1][c1]];
}

function hasMove() {
  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.cols; c++) {
      if (c + 1 < cfg.cols) {
        swap(r, c, r, c + 1);
        if (getMatches().length > 0) { swap(r, c, r, c + 1); return true; }
        swap(r, c, r, c + 1);
      }
      if (r + 1 < cfg.rows) {
        swap(r, c, r + 1, c);
        if (getMatches().length > 0) { swap(r, c, r + 1, c); return true; }
        swap(r, c, r + 1, c);
      }
    }
  }
  return false;
}

function showHint() {
  if (busy) return;
  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.cols; c++) {
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const r2 = r + dr, c2 = c + dc;
        if (r2 >= cfg.rows || c2 >= cfg.cols) continue;
        swap(r, c, r2, c2);
        if (getMatches().length > 0) {
          swap(r, c, r2, c2);
          const e1 = getCellEl(r, c), e2 = getCellEl(r2, c2);
          if (e1) e1.classList.add('hint');
          if (e2) e2.classList.add('hint');
          setMsg('交换这两个方块！');
          setTimeout(() => {
            if (e1) e1.classList.remove('hint');
            if (e2) e2.classList.remove('hint');
          }, 1800);
          return;
        }
        swap(r, c, r2, c2);
      }
    }
  }
  setMsg('没有可用提示');
}

function updateStats() {
  document.getElementById('score').textContent = score;
  document.getElementById('moves').textContent = movesLeft;
  const pct = Math.min(Math.round(score / cfg.target * 100), 100);
  document.getElementById('prog-fill').style.width = pct + '%';
  const allBest = history.filter(h => h.r === 'pass').reduce((m, h) => Math.max(m, h.s), 0);
  document.getElementById('best').textContent = allBest >= 10000 ? (allBest / 1000).toFixed(1) + 'k' : allBest;
}

function recordHistory(result) {
  history.unshift({
    level,
    s: score,
    r: result,
    t: new Date().toLocaleTimeString('zh', { hour: '2-digit', minute: '2-digit' })
  });
  if (history.length > 10) history = history.slice(0, 10);
  saveData();
  renderHistory();
}

function renderHistory() {
  const el = document.getElementById('hlist');
  if (!el) return;
  if (!history.length) {
    el.innerHTML = '<div style="font-size:11px;color:var(--color-text-secondary);text-align:center;padding:5px 0">暂无记录</div>';
    return;
  }
  el.innerHTML = history.map(h =>
    `<div class="hist-row"><span>第${h.level}关 · ${getDiffName(h.level)} · ${h.t}</span><b style="color:${h.r === 'pass' ? 'var(--color-text-success)' : 'var(--color-text-danger)'}">${h.r === 'pass' ? '✓' : '✗'} ${h.s >= 10000 ? (h.s / 1000).toFixed(1) + 'k' : h.s}分</b></div>`
  ).join('');
}

function showLevelComplete() {
  recordHistory('pass');
  const n = level + 1;
  if (n > unlockedLevel) {
    unlockedLevel = n;
    saveData();
  }
  const nc = getLevelConfig(n);
  const overlay = document.getElementById('board-overlay');
  overlay.innerHTML =
    `<div class="modal">
      <h3>第 ${level} 关通过！</h3>
      <div class="big">${score}分</div>
      <p>剩余 ${movesLeft} 步 · 下一关：${getDiffName(n)}<br>目标 ${nc.target >= 10000 ? (nc.target / 1000).toFixed(0) + 'k' : nc.target} 分 · ${nc.cols}×${nc.rows} 棋盘 · ${nc.moves} 步</p>
      <button onclick="hideOverlay();startLevel(${n})">进入第 ${n} 关</button>
      <button onclick="hideOverlay();startLevel(${level})">重玩本关</button>
    </div>`;
  overlay.classList.add('active');
  updateStats();
}

function showGameOver() {
  recordHistory('fail');
  const overlay = document.getElementById('board-overlay');
  overlay.innerHTML =
    `<div class="modal">
      <h3>未达目标</h3>
      <div class="big">${score}分</div>
      <p>目标 ${cfg.target >= 10000 ? (cfg.target / 1000).toFixed(0) + 'k' : cfg.target} 分，差 ${cfg.target >= 10000 ? ((cfg.target - score) / 1000).toFixed(1) + 'k' : cfg.target - score} 分</p>
      <button onclick="hideOverlay();startLevel(${level})">重玩第 ${level} 关</button>
      ${level > 1 ? `<button onclick="hideOverlay();startLevel(1)">从第 1 关开始</button>` : ''}
    </div>`;
  overlay.classList.add('active');
  updateStats();
}

function hideOverlay() {
  const overlay = document.getElementById('board-overlay');
  overlay.classList.remove('active');
  overlay.innerHTML = '';
}

function setMsg(t) { document.getElementById('msg').textContent = t; }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Boot
loadData();
startLevel(level);
