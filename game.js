const canvas = document.getElementById('pong');
const ctx = canvas.getContext('2d');

const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const difficultySelect = document.getElementById('difficulty');
const hint = document.getElementById('hint');

const themeToggle = document.getElementById('themeToggle');
const htmlRoot = document.documentElement;

const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 80;
const BALL_SIZE = 14;
const PADDLE_MARGIN = 30;

const DIFFICULTIES = {
  easy: { speed: 3, error: 18 },
  medium: { speed: 5, error: 12 },
  hard: { speed: 7, error: 6 },
};
let aiCfg = DIFFICULTIES[difficultySelect.value];

let playerY = (canvas.height - PADDLE_HEIGHT) / 2;
let aiY = (canvas.height - PADDLE_HEIGHT) / 2;
let ballX = canvas.width / 2 - BALL_SIZE / 2;
let ballY = canvas.height / 2 - BALL_SIZE / 2;
let ballSpeedX = 0;
let ballSpeedY = 0;
let playerScore = 0;
let aiScore = 0;
let paused = false;
let gameRunning = false;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function serveBall() {
  const dirX = Math.random() < 0.5 ? -1 : 1;
  ballSpeedX = 5 * dirX;
  ballSpeedY = (Math.random() - 0.5) * 8;
}

function resetBall(scoreReset = false) {
  ballX = canvas.width / 2 - BALL_SIZE / 2;
  ballY = canvas.height / 2 - BALL_SIZE / 2;
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
  playerY = (canvas.height - PADDLE_HEIGHT) / 2;
  aiY = (canvas.height - PADDLE_HEIGHT) / 2;
  paused = false;
  gameRunning = false;
  resetBall(true);
  difficultySelect.disabled = false;
  updateControls();
  hint.style.opacity = 1;
  syncScoreDOM();
}

function drawRect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
function drawNet() {
  const netColor = cssVar('--net-color') || '#2c3a4b';
  for (let i = 0; i < canvas.height; i += 24) drawRect(canvas.width / 2 - 2, i, 4, 12, netColor);
}
function drawText(text, x, y, size = 32, align = 'left') {
  ctx.fillStyle = cssVar('--text') || '#fff';
  ctx.font = `${size}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace`;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
}
function drawPauseOverlay() {
  ctx.save();
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = cssVar('--bg') || '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = 1;
  drawText("PAUSED", canvas.width / 2, canvas.height / 2, 48, 'center');
  ctx.restore();
}

function draw() {
  drawRect(0, 0, canvas.width, canvas.height, cssVar('--canvas-bg') || '#0c0f14');
  drawNet();

  const playerColor = cssVar('--player-color') || '#0ff';
  const aiColor = cssVar('--ai-color') || '#f60';
  const ballColor = cssVar('--ball-color') || '#fff';

  drawRect(PADDLE_MARGIN, playerY, PADDLE_WIDTH, PADDLE_HEIGHT, playerColor);
  drawRect(canvas.width - PADDLE_MARGIN - PADDLE_WIDTH, aiY, PADDLE_WIDTH, PADDLE_HEIGHT, aiColor);
  drawRect(ballX, ballY, BALL_SIZE, BALL_SIZE, ballColor);

  drawText(playerScore, canvas.width / 2 - 60, 50, 36, 'right');
  drawText(aiScore, canvas.width / 2 + 60, 50, 36, 'left');

  if (paused) drawPauseOverlay();
}

function update() {
  if (!gameRunning || paused) return;

  ballX += ballSpeedX;
  ballY += ballSpeedY;

  if (ballY <= 0 || ballY + BALL_SIZE >= canvas.height) {
    ballSpeedY *= -1;
    ballY = clamp(ballY, 0, canvas.height - BALL_SIZE);
  }

  if (ballX <= PADDLE_MARGIN + PADDLE_WIDTH && ballY + BALL_SIZE > playerY && ballY < playerY + PADDLE_HEIGHT) {
    ballX = PADDLE_MARGIN + PADDLE_WIDTH;
    ballSpeedX *= -1.05;
    const collidePoint = (ballY + BALL_SIZE / 2) - (playerY + PADDLE_HEIGHT / 2);
    ballSpeedY = collidePoint * 0.22;
  }

  if (ballX + BALL_SIZE >= canvas.width - PADDLE_MARGIN - PADDLE_WIDTH && ballY + BALL_SIZE > aiY && ballY < aiY + PADDLE_HEIGHT) {
    ballX = canvas.width - PADDLE_MARGIN - PADDLE_WIDTH - BALL_SIZE;
    ballSpeedX *= -1.05;
    const collidePoint = (ballY + BALL_SIZE / 2) - (aiY + PADDLE_HEIGHT / 2);
    ballSpeedY = collidePoint * 0.22;
  }

  if (ballX < 0) { aiScore++; syncScoreDOM(); resetBall(false); }
  else if (ballX > canvas.width) { playerScore++; syncScoreDOM(); resetBall(false); }

  const aiCenter = aiY + PADDLE_HEIGHT / 2;
  const target = ballY + BALL_SIZE / 2;
  const delta = target - aiCenter;
  if (Math.abs(delta) > aiCfg.error) {
    const step = Math.sign(delta) * Math.min(Math.abs(delta), aiCfg.speed);
    aiY += step;
  }
  aiY = clamp(aiY, 0, canvas.height - PADDLE_HEIGHT);
}

function gameLoop() { update(); draw(); requestAnimationFrame(gameLoop); }

canvas.addEventListener('mousemove', (evt) => {
  const rect = canvas.getBoundingClientRect();
  const mouseY = evt.clientY - rect.top;
  playerY = clamp(mouseY - PADDLE_HEIGHT / 2, 0, canvas.height - PADDLE_HEIGHT);
});

startBtn.addEventListener('click', () => {
  if (!gameRunning) {
    if (ballSpeedX === 0 && ballSpeedY === 0) serveBall();
    gameRunning = true;
    paused = false;
    difficultySelect.disabled = true;
    hint.style.opacity = 0;
  } else if (paused) {
    paused = false;
  }
  updateControls();
});

pauseBtn.addEventListener('click', () => {
  if (!gameRunning) return;
  paused = !paused;
  updateControls();
});

resetBtn.addEventListener('click', fullReset);

difficultySelect.addEventListener('change', () => { aiCfg = DIFFICULTIES[difficultySelect.value]; });

function updateControls() {
  startBtn.disabled = gameRunning && !paused;
  startBtn.textContent = (!gameRunning || paused) ? 'Start Game' : 'Running...';
  pauseBtn.textContent = paused ? 'Resume' : 'Pause';
  pauseBtn.disabled = !gameRunning;
}
function syncScoreDOM() {
  const p = document.getElementById('playerScore');
  const a = document.getElementById('aiScore');
  if (p && a) { p.textContent = playerScore; a.textContent = aiScore; }
}

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
  themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Ganti ke light mode' : 'Ganti ke dark mode');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b0f14' : '#f4f6fa');
}

updateControls();
syncScoreDOM();
gameLoop();