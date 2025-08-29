const canvas = document.getElementById('pong');
const ctx = canvas.getContext('2d');

const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const difficultySelect = document.getElementById('difficulty');
const scoreToWinSelect = document.getElementById('scoreToWin');
const ftLabel = document.getElementById('ftLabel');
const hint = document.getElementById('hint');

const themeToggle = document.getElementById('themeToggle');
const htmlRoot = document.documentElement;

const overlay = document.getElementById('resultOverlay');
const playerResultEl = document.getElementById('playerResult');
const aiResultEl = document.getElementById('aiResult');
const playAgainBtn = document.getElementById('playAgainBtn');

const ASPECT = 2;
let dpr = window.devicePixelRatio || 1;
let cssW = 0, cssH = 0;

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const newCssW = Math.max(200, Math.floor(rect.width));
  const newCssH = Math.floor(newCssW / ASPECT);

  if (cssW && cssH) {
    const sx = newCssW / cssW;
    const sy = newCssH / cssH;
    playerY *= sy;
    aiY *= sy;
    ballX *= sx;
    ballY *= sy;
  }
  cssW = newCssW;
  cssH = newCssH;

  canvas.style.height = `${cssH}px`;
  dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', resizeCanvas);

const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 80;
const BALL_SIZE = 14;
const PADDLE_MARGIN = 30;
const BALL_SPEED_INIT = 360;

const DIFFICULTIES = {
  easy: { speed: 260, error: 18 },
  medium: { speed: 360, error: 12 },
  hard: { speed: 520, error: 6 },
};
let aiCfg = DIFFICULTIES[difficultySelect.value];

let scoreToWin = parseInt(scoreToWinSelect.value, 10);

let playerY = 0;
let aiY = 0;
let ballX = 0;
let ballY = 0;
let ballSpeedX = 0;
let ballSpeedY = 0;
let playerScore = 0;
let aiScore = 0;
let paused = false;
let gameRunning = false;
let gameOver = false;

let resumeCountdown = 0;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function centerEntities() {
  playerY = (cssH - PADDLE_HEIGHT) / 2;
  aiY = (cssH - PADDLE_HEIGHT) / 2;
  ballX = cssW / 2 - BALL_SIZE / 2;
  ballY = cssH / 2 - BALL_SIZE / 2;
}

function serveBall() {
  const dirX = Math.random() < 0.5 ? -1 : 1;
  ballSpeedX = BALL_SPEED_INIT * dirX;
  ballSpeedY = (Math.random() - 0.5) * (BALL_SPEED_INIT * 0.6);
}

function resetBall(scoreReset = false) {
  ballX = cssW / 2 - BALL_SIZE / 2;
  ballY = cssH / 2 - BALL_SIZE / 2;
  if (scoreReset) {
    ballSpeedX = 0;
    ballSpeedY = 0;
  } else {
    serveBall();
  }
}

function fullReset() {
  playerScore = 0;
  aiScore = 0;
  paused = false;
  gameRunning = false;
  gameOver = false;
  resumeCountdown = 0;
  hideResultOverlay();
  centerEntities();
  resetBall(true);
  difficultySelect.disabled = false;
  scoreToWinSelect.disabled = false;
  updateFTLabel();
  updateControls();
  hint.style.opacity = 1;
  syncScoreDOM();
}

function endGame(winner) {
  gameOver = true;
  gameRunning = false;
  paused = false;
  resumeCountdown = 0;

  resetBall(true);

  const playerWin = winner === 'player';
  playerResultEl.textContent = playerWin ? 'WIN' : 'LOSE';
  aiResultEl.textContent = playerWin ? 'LOSE' : 'WIN';
  playerResultEl.classList.toggle('lose', !playerWin);
  aiResultEl.classList.toggle('lose', playerWin);

  showResultOverlay();

  difficultySelect.disabled = false;
  scoreToWinSelect.disabled = false;
  updateControls();
}

function startResumeCountdown(seconds = 3) {
  resumeCountdown = seconds;
  paused = true;
  updateControls();
}

function drawRect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
function drawNet() {
  const netColor = cssVar('--net-color') || '#2c3a4b';
  for (let i = 0; i < cssH; i += 24) drawRect(cssW / 2 - 2, i, 4, 12, netColor);
}
function drawText(text, x, y, size = 32, align = 'left') {
  ctx.fillStyle = cssVar('--text') || '#fff';
  ctx.font = `${size}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace`;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
}
function drawOverlayLabel(label) {
  ctx.save();
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = cssVar('--bg') || '#000';
  ctx.fillRect(0, 0, cssW, cssH);
  ctx.globalAlpha = 1;
  drawText(label, cssW / 2, cssH / 2, 56, 'center');
  ctx.restore();
}

function draw() {
  drawRect(0, 0, cssW, cssH, cssVar('--canvas-bg') || '#0c0f14');
  drawNet();

  const playerColor = cssVar('--player-color') || '#0ff';
  const aiColor = cssVar('--ai-color') || '#f60';
  const ballColor = cssVar('--ball-color') || '#fff';

  drawRect(PADDLE_MARGIN, playerY, PADDLE_WIDTH, PADDLE_HEIGHT, playerColor);
  drawRect(cssW - PADDLE_MARGIN - PADDLE_WIDTH, aiY, PADDLE_WIDTH, PADDLE_HEIGHT, aiColor);
  drawRect(ballX, ballY, BALL_SIZE, BALL_SIZE, ballColor);

  drawText(playerScore, cssW / 2 - 60, 50, 36, 'right');
  drawText(aiScore, cssW / 2 + 60, 50, 36, 'left');

  if (resumeCountdown > 0) {
    const n = Math.ceil(resumeCountdown);
    drawOverlayLabel(String(n));
  } else if (paused && gameRunning) {
    drawOverlayLabel("PAUSED");
  }
}

function update(dt) {
  dt = Math.min(dt, 0.05);

  if (resumeCountdown > 0) {
    resumeCountdown -= dt;
    if (resumeCountdown > 0) return;
    resumeCountdown = 0;
    paused = false;
    updateControls();
  }

  if (!gameRunning || paused || gameOver) return;

  ballX += ballSpeedX * dt;
  ballY += ballSpeedY * dt;

  if (ballY <= 0 || ballY + BALL_SIZE >= cssH) {
    ballSpeedY *= -1;
    ballY = clamp(ballY, 0, cssH - BALL_SIZE);
  }

  if (
    ballX <= PADDLE_MARGIN + PADDLE_WIDTH &&
    ballY + BALL_SIZE > playerY &&
    ballY < playerY + PADDLE_HEIGHT
  ) {
    ballX = PADDLE_MARGIN + PADDLE_WIDTH;
    ballSpeedX *= -1.05;
    const collidePoint = (ballY + BALL_SIZE / 2) - (playerY + PADDLE_HEIGHT / 2);
    ballSpeedY = collidePoint * 9;
  }

  if (
    ballX + BALL_SIZE >= cssW - PADDLE_MARGIN - PADDLE_WIDTH &&
    ballY + BALL_SIZE > aiY &&
    ballY < aiY + PADDLE_HEIGHT
  ) {
    ballX = cssW - PADDLE_MARGIN - PADDLE_WIDTH - BALL_SIZE;
    ballSpeedX *= -1.05;
    const collidePoint = (ballY + BALL_SIZE / 2) - (aiY + PADDLE_HEIGHT / 2);
    ballSpeedY = collidePoint * 9;
  }

  if (ballX < 0) {
    aiScore++; syncScoreDOM();
    if (aiScore >= scoreToWin) { endGame('ai'); return; }
    resetBall(false);
  } else if (ballX > cssW) {
    playerScore++; syncScoreDOM();
    if (playerScore >= scoreToWin) { endGame('player'); return; }
    resetBall(false);
  }

  const aiCenter = aiY + PADDLE_HEIGHT / 2;
  const target = ballY + BALL_SIZE / 2;
  const delta = target - aiCenter;

  if (Math.abs(delta) > aiCfg.error) {
    const step = Math.sign(delta) * Math.min(Math.abs(delta), aiCfg.speed * dt);
    aiY += step;
  }
  aiY = clamp(aiY, 0, cssH - PADDLE_HEIGHT);
}

let lastTime = performance.now();
function gameLoop(now) {
  const dt = (now - lastTime) / 1000;
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(gameLoop);
}

canvas.addEventListener('mousemove', (evt) => {
  const rect = canvas.getBoundingClientRect();
  const mouseY = evt.clientY - rect.top;
  playerY = clamp(mouseY - PADDLE_HEIGHT / 2, 0, cssH - PADDLE_HEIGHT);
});

startBtn.addEventListener('click', () => {
  if (gameOver) { fullReset(); }
  if (!gameRunning) {
    if (ballSpeedX === 0 && ballSpeedY === 0) serveBall();
    gameRunning = true;
    startResumeCountdown(3);
    difficultySelect.disabled = true;
    scoreToWinSelect.disabled = true;
    hint.style.opacity = 0;
  } else if (paused) {
    startResumeCountdown(3);
  }
  hideResultOverlay();
  updateControls();
});

pauseBtn.addEventListener('click', () => {
  if (!gameRunning || gameOver) return;
  if (!paused) {
    paused = true;
  } else {
    startResumeCountdown(3);
  }
  updateControls();
});

resetBtn.addEventListener('click', fullReset);

difficultySelect.addEventListener('change', () => { aiCfg = DIFFICULTIES[difficultySelect.value]; });
scoreToWinSelect.addEventListener('change', () => {
  scoreToWin = parseInt(scoreToWinSelect.value, 10) || 5;
  updateFTLabel();
});

function updateControls() {
  startBtn.disabled = (gameRunning && !paused && resumeCountdown === 0) || gameOver;
  startBtn.textContent = (!gameRunning || paused || resumeCountdown > 0 || gameOver) ? 'Start Game' : 'Running...';
  pauseBtn.textContent = (paused && resumeCountdown === 0) ? 'Resume' : 'Pause';
  pauseBtn.disabled = !gameRunning || gameOver || resumeCountdown > 0;
}
function syncScoreDOM() {
  const p = document.getElementById('playerScore');
  const a = document.getElementById('aiScore');
  if (p && a) { p.textContent = playerScore; a.textContent = aiScore; }
}
function updateFTLabel() {
  if (ftLabel) ftLabel.textContent = `FT${scoreToWin}`;
}

function showResultOverlay() { overlay.classList.remove('hidden'); }
function hideResultOverlay() { overlay.classList.add('hidden'); }

function autoPauseIfRunning() {
  if (gameRunning && !paused && !gameOver && resumeCountdown === 0) {
    paused = true;
    updateControls();
  }
}
window.addEventListener('blur', autoPauseIfRunning);
document.addEventListener('visibilitychange', () => { if (document.hidden) autoPauseIfRunning(); });

(function initTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initial = saved || (prefersDark ? 'dark' : 'light');
  htmlRoot.setAttribute('data-theme', initial);
  updateThemeButton(initial);
})();

themeToggle.addEventListener('click', () => {
  const current = htmlRoot.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  htmlRoot.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeButton(next);
});
function updateThemeButton(theme) {
  themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b0f14' : '#f4f6fa');
}

resizeCanvas();
centerEntities();
resetBall(true);
updateFTLabel();
updateControls();
syncScoreDOM();
requestAnimationFrame(gameLoop);