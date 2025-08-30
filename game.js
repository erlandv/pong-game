const canvas = document.getElementById('pong');
const ctx = canvas.getContext('2d');

const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const ftLabel = document.getElementById('ftLabel');
const hint = document.getElementById('hint');

const themeToggle = document.getElementById('themeToggle');
const settingsBtn = document.getElementById('settingsBtn');
const htmlRoot = document.documentElement;

const overlay = document.getElementById('resultOverlay');
const playerResultEl = document.getElementById('playerResult');
const aiResultEl = document.getElementById('aiResult');

const settingsModal = document.getElementById('settingsModal');
const settingsBackdrop = document.getElementById('settingsBackdrop');
const settingsClose = document.getElementById('settingsClose');
const settingsCancel = document.getElementById('settingsCancel');
const settingsApply = document.getElementById('settingsApply');
const settingsDefaults = document.getElementById('settingsDefaults');
const tabs = Array.from(document.querySelectorAll('.tab'));
const panels = {
  gameplay: document.getElementById('panel-gameplay'),
  controls: document.getElementById('panel-controls'),
  audio: document.getElementById('panel-audio'),
  display: document.getElementById('panel-display'),
};
const gameplayLockHint = document.getElementById('gameplayLockHint');

const optDifficulty = document.getElementById('optDifficulty');
const optScore = document.getElementById('optScore');
const optPaddleSpeed = document.getElementById('optPaddleSpeed');
const optBallCurve = document.getElementById('optBallCurve');
const optBallAccel = document.getElementById('optBallAccel');
const optSpinEnabled = document.getElementById('optSpinEnabled');
const optSpinPower = document.getElementById('optSpinPower');
const optAssist = document.getElementById('optAssist');

const ctrlSchemeRadios = Array.from(document.querySelectorAll('input[name="ctrlScheme"]'));
const optInvertY = document.getElementById('optInvertY');

const optSfx = document.getElementById('optSfx');
const optVolume = document.getElementById('optVolume');

const themeModeRadios = Array.from(document.querySelectorAll('input[name="themeMode"]'));
const optHiDPI = document.getElementById('optHiDPI');

const toastEl = document.getElementById('toast');

const DEFAULT_SETTINGS = {
  gameplay: {
    difficulty: 'medium',
    scoreToWin: 5,
    paddleSpeed: 'normal',
    ballCurve: 'gradual',
    ballAccel: 0.05,
    spinEnabled: true,
    spinPower: 0.6,
    assist: 'off',
  },
  audio: { sfx: true, volume: 0.7 },
  display: { themeMode: 'system', hiDPI: true },
  controls: { scheme: 'auto', invertY: false },
};
let SETTINGS = loadSettings();

const ASPECT = 2;
let hiDPIEnabled = true;
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
  dpr = (hiDPIEnabled ? (window.devicePixelRatio || 1) : 1);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', resizeCanvas);

const PADDLE_WIDTH = 12;
const BASE_PADDLE_HEIGHT = 80;
const BALL_SIZE = 14;
const PADDLE_MARGIN = 30;
const BALL_SPEED_INIT = 360;
const MAX_BALL_SPEED = 920;

let PLAYER_PADDLE_HEIGHT = BASE_PADDLE_HEIGHT;
let AI_PADDLE_HEIGHT = BASE_PADDLE_HEIGHT;

const PADDLE_SPEEDS = { slow: 380, normal: 520, fast: 680 };
let KEYBOARD_PADDLE_SPEED = PADDLE_SPEEDS[SETTINGS.gameplay.paddleSpeed];

const DIFFICULTIES = {
  easy: { speed: 260, error: 18 },
  medium: { speed: 360, error: 12 },
  hard: { speed: 520, error: 6 },
};
let aiCfg = DIFFICULTIES[SETTINGS.gameplay.difficulty];
let aiSpeed = aiCfg.speed;
let aiError = aiCfg.error;

let scoreToWin = SETTINGS.gameplay.scoreToWin;

let playerY = 0, aiY = 0;
let ballX = 0, ballY = 0;
let ballSpeedX = 0, ballSpeedY = 0;
let playerScore = 0, aiScore = 0;
let paused = false, gameRunning = false, gameOver = false;
let resumeCountdown = 0;

let allowMouse = false, allowKeyboard = false, allowTouch = false;
let invertY = !!SETTINGS.controls.invertY;
const pressed = { up: false, down: false };
let touchActive = false;

let prevPlayerY = 0;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const isSettingsOpen = () => !settingsModal.classList.contains('hidden');
function isTypingTarget(el) {
  return el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}
function preferTouchDevice() {
  return 'ontouchstart' in window || window.matchMedia('(pointer: coarse)').matches;
}

function centerEntities() {
  playerY = (cssH - PLAYER_PADDLE_HEIGHT) / 2;
  aiY = (cssH - AI_PADDLE_HEIGHT) / 2;
  ballX = cssW / 2 - BALL_SIZE / 2;
  ballY = cssH / 2 - BALL_SIZE / 2;
  prevPlayerY = playerY;
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
  playerScore = 0; aiScore = 0;
  paused = false; gameRunning = false; gameOver = false; resumeCountdown = 0;
  hideResultOverlay();
  centerEntities();
  resetBall(true);
  updateFTLabel();
  updateControls();
  hint.style.opacity = 1;
  syncScoreDOM();
}

function endGame(winner) {
  gameOver = true; gameRunning = false; paused = false; resumeCountdown = 0;
  resetBall(true);

  const playerWin = winner === 'player';
  playerResultEl.textContent = playerWin ? 'WIN' : 'LOSE';
  aiResultEl.textContent = playerWin ? 'LOSE' : 'WIN';
  playerResultEl.classList.toggle('lose', !playerWin);
  aiResultEl.classList.toggle('lose', playerWin);

  showResultOverlay();
  updateControls();
}

function startResumeCountdown(seconds = 3) {
  resumeCountdown = seconds;
  paused = true;
  updateControls();
}

function applyAssistAndHeights() {
  let playerScale = 1, aiSpeedScale = 1, aiErrorBonus = 0;
  if (SETTINGS.gameplay.assist === 'light') { playerScale = 1.2; aiSpeedScale = 0.85; aiErrorBonus = 3; }
  if (SETTINGS.gameplay.assist === 'strong') { playerScale = 1.4; aiSpeedScale = 0.7; aiErrorBonus = 6; }

  const newPlayerH = Math.round(BASE_PADDLE_HEIGHT * playerScale);
  const newAiH = BASE_PADDLE_HEIGHT;
  const keepCenter = (y, oldH, newH) => clamp(y + (oldH / 2) - (newH / 2), 0, cssH - newH);

  const oldPlayerH = PLAYER_PADDLE_HEIGHT;
  const oldAiH = AI_PADDLE_HEIGHT;
  PLAYER_PADDLE_HEIGHT = newPlayerH;
  AI_PADDLE_HEIGHT = newAiH;

  playerY = keepCenter(playerY, oldPlayerH, PLAYER_PADDLE_HEIGHT);
  aiY = keepCenter(aiY, oldAiH, AI_PADDLE_HEIGHT);

  aiSpeed = aiCfg.speed * aiSpeedScale;
  aiError = aiCfg.error + aiErrorBonus;
}

function applyKeyboardSpeed() { KEYBOARD_PADDLE_SPEED = PADDLE_SPEEDS[SETTINGS.gameplay.paddleSpeed] || 520; }

function applyDifficulty() {
  aiCfg = DIFFICULTIES[SETTINGS.gameplay.difficulty];
  applyAssistAndHeights();
}

function applyThemeMode(mode) {
  const eff = (mode === 'system')
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : mode;
  htmlRoot.setAttribute('data-theme', eff);
  themeToggle.setAttribute('aria-label', eff === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', eff === 'dark' ? '#0b0f14' : '#f4f6fa');
}
function initThemeFromSettings() {
  applyThemeMode(SETTINGS.display.themeMode);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (SETTINGS.display.themeMode === 'system') applyThemeMode('system');
  });
}
themeToggle.addEventListener('click', () => {
  const currEff = htmlRoot.getAttribute('data-theme');
  const next = (currEff === 'dark') ? 'light' : 'dark';
  SETTINGS.display.themeMode = next;
  saveSettings();
  applyThemeMode(SETTINGS.display.themeMode);
});

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

  drawRect(PADDLE_MARGIN, playerY, PADDLE_WIDTH, PLAYER_PADDLE_HEIGHT, playerColor);
  drawRect(cssW - PADDLE_MARGIN - PADDLE_WIDTH, aiY, PADDLE_WIDTH, AI_PADDLE_HEIGHT, aiColor);
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

  if (allowKeyboard) {
    let dir = 0;
    if (pressed.up) dir -= 1;
    if (pressed.down) dir += 1;
    if (invertY) dir *= -1;
    if (dir !== 0) {
      playerY += dir * KEYBOARD_PADDLE_SPEED * dt;
      playerY = clamp(playerY, 0, cssH - PLAYER_PADDLE_HEIGHT);
    }
  }

  ballX += ballSpeedX * dt;
  ballY += ballSpeedY * dt;

  if (ballY <= 0 || ballY + BALL_SIZE >= cssH) {
    ballSpeedY *= -1;
    ballY = clamp(ballY, 0, cssH - BALL_SIZE);
  }

  if (
    ballX <= PADDLE_MARGIN + PADDLE_WIDTH &&
    ballY + BALL_SIZE > playerY &&
    ballY < playerY + PLAYER_PADDLE_HEIGHT
  ) {
    ballX = PADDLE_MARGIN + PADDLE_WIDTH;

    if (SETTINGS.gameplay.ballCurve === 'gradual') {
      ballSpeedX = -ballSpeedX * (1 + SETTINGS.gameplay.ballAccel);
    } else {
      ballSpeedX = -ballSpeedX;
    }

    const collidePoint = (ballY + BALL_SIZE / 2) - (playerY + PLAYER_PADDLE_HEIGHT / 2);
    ballSpeedY = collidePoint * 9;

    if (SETTINGS.gameplay.spinEnabled) {
      const paddleVelY = (playerY - prevPlayerY) / dt;
      const spinCoeff = 0.12 * SETTINGS.gameplay.spinPower;
      ballSpeedY += paddleVelY * spinCoeff;
    }

    ballSpeedX = Math.sign(ballSpeedX) * Math.min(Math.abs(ballSpeedX), MAX_BALL_SPEED);
    ballSpeedY = Math.sign(ballSpeedY) * Math.min(Math.abs(ballSpeedY), MAX_BALL_SPEED);
  }

  if (
    ballX + BALL_SIZE >= cssW - PADDLE_MARGIN - PADDLE_WIDTH &&
    ballY + BALL_SIZE > aiY &&
    ballY < aiY + AI_PADDLE_HEIGHT
  ) {
    ballX = cssW - PADDLE_MARGIN - PADDLE_WIDTH - BALL_SIZE;

    if (SETTINGS.gameplay.ballCurve === 'gradual') {
      ballSpeedX = -ballSpeedX * (1 + SETTINGS.gameplay.ballAccel);
    } else {
      ballSpeedX = -ballSpeedX;
    }

    const collidePoint = (ballY + BALL_SIZE / 2) - (aiY + AI_PADDLE_HEIGHT / 2);
    ballSpeedY = collidePoint * 9;

    ballSpeedX = Math.sign(ballSpeedX) * Math.min(Math.abs(ballSpeedX), MAX_BALL_SPEED);
    ballSpeedY = Math.sign(ballSpeedY) * Math.min(Math.abs(ballSpeedY), MAX_BALL_SPEED);
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

  const aiCenter = aiY + AI_PADDLE_HEIGHT / 2;
  const target = ballY + BALL_SIZE / 2;
  const delta = target - aiCenter;

  if (Math.abs(delta) > aiError) {
    const step = Math.sign(delta) * Math.min(Math.abs(delta), aiSpeed * dt);
    aiY += step;
  }
  aiY = clamp(aiY, 0, cssH - AI_PADDLE_HEIGHT);

  prevPlayerY = playerY;
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
  if (!allowMouse) return;
  const rect = canvas.getBoundingClientRect();
  let y = evt.clientY - rect.top;
  if (invertY) y = cssH - y;
  playerY = clamp(y - PLAYER_PADDLE_HEIGHT / 2, 0, cssH - PLAYER_PADDLE_HEIGHT);
});

canvas.addEventListener('pointerdown', (e) => {
  if (!allowTouch) return;
  if (e.pointerType !== 'touch' && preferTouchDevice()) return;
  touchActive = true;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!allowTouch || !touchActive) return;
  const rect = canvas.getBoundingClientRect();
  let y = e.clientY - rect.top;
  if (invertY) y = cssH - y;
  playerY = clamp(y - PLAYER_PADDLE_HEIGHT / 2, 0, cssH - PLAYER_PADDLE_HEIGHT);
});
canvas.addEventListener('pointerup', () => { if (!allowTouch) return; touchActive = false; });
canvas.addEventListener('pointercancel', () => { if (!allowTouch) return; touchActive = false; });

let keyboardToastShown = false;
document.addEventListener('keydown', (e) => {
  if (!allowKeyboard) return;

  if (isSettingsOpen() || isTypingTarget(e.target)) return;

  if (e.code === 'ArrowUp' || e.code === 'KeyW') { pressed.up = true; e.preventDefault(); if (!keyboardToastShown) { showToast('Keyboard active: W/S or ↑/↓ · Enter=Start · P=Pause · R=Reset'); keyboardToastShown = true; } }
  if (e.code === 'ArrowDown' || e.code === 'KeyS') { pressed.down = true; e.preventDefault(); if (!keyboardToastShown) { showToast('Keyboard active: W/S or ↑/↓ · Enter=Start · P=Pause · R=Reset'); keyboardToastShown = true; } }

  if (e.code === 'Enter') {
    e.preventDefault();
    if (gameOver) { fullReset(); }
    if (!gameRunning) {
      if (ballSpeedX === 0 && ballSpeedY === 0) serveBall();
      gameRunning = true;
      startResumeCountdown(3);
      hint.style.opacity = 0;
      hideResultOverlay();
      updateControls();
    } else if (paused) {
      startResumeCountdown(3);
      updateControls();
    }
  } else if (e.code === 'KeyP') {
    e.preventDefault();
    if (!gameRunning || gameOver) return;
    if (!paused) paused = true; else startResumeCountdown(3);
    updateControls();
  } else if (e.code === 'KeyR') {
    e.preventDefault();
    fullReset();
  }
});
document.addEventListener('keyup', (e) => {
  if (!allowKeyboard) return;
  if (e.code === 'ArrowUp' || e.code === 'KeyW') pressed.up = false;
  if (e.code === 'ArrowDown' || e.code === 'KeyS') pressed.down = false;
});

startBtn.addEventListener('click', () => {
  if (gameOver) { fullReset(); }
  if (!gameRunning) {
    if (ballSpeedX === 0 && ballSpeedY === 0) serveBall();
    gameRunning = true;
    startResumeCountdown(3);
    hint.style.opacity = 0;
  } else if (paused) {
    startResumeCountdown(3);
  }
  hideResultOverlay();
  updateControls();
});

pauseBtn.addEventListener('click', () => {
  if (!gameRunning || gameOver) return;
  if (!paused) paused = true; else startResumeCountdown(3);
  updateControls();
});

resetBtn.addEventListener('click', fullReset);

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
function updateFTLabel() { if (ftLabel) ftLabel.textContent = `FT${scoreToWin}`; }

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

function loadSettings() {
  try {
    const raw = localStorage.getItem('pong.settings.v1');
    if (!raw) return structuredClone(DEFAULT_SETTINGS);
    const parsed = JSON.parse(raw);
    return {
      gameplay: { ...DEFAULT_SETTINGS.gameplay, ...(parsed.gameplay || {}) },
      audio: { ...DEFAULT_SETTINGS.audio, ...(parsed.audio || {}) },
      display: { ...DEFAULT_SETTINGS.display, ...(parsed.display || {}) },
      controls: { ...DEFAULT_SETTINGS.controls, ...(parsed.controls || {}) },
    };
  } catch (e) {
    return structuredClone(DEFAULT_SETTINGS);
  }
}
function saveSettings() {
  localStorage.setItem('pong.settings.v1', JSON.stringify(SETTINGS));
}

function openSettings(initialTab = 'gameplay') {
  if (gameRunning && !paused && resumeCountdown === 0) { paused = true; updateControls(); }

  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === initialTab));
  Object.entries(panels).forEach(([k, el]) => el.classList.toggle('active', k === initialTab));

  optDifficulty.value = SETTINGS.gameplay.difficulty;
  optScore.value = String(SETTINGS.gameplay.scoreToWin);
  optPaddleSpeed.value = SETTINGS.gameplay.paddleSpeed;
  optBallCurve.value = SETTINGS.gameplay.ballCurve;
  optBallAccel.value = String(SETTINGS.gameplay.ballAccel);
  optSpinEnabled.checked = !!SETTINGS.gameplay.spinEnabled;
  optSpinPower.value = String(SETTINGS.gameplay.spinPower);
  optAssist.value = SETTINGS.gameplay.assist;

  ctrlSchemeRadios.forEach(r => r.checked = (r.value === SETTINGS.controls.scheme));
  optInvertY.checked = !!SETTINGS.controls.invertY;

  optSfx.checked = !!SETTINGS.audio.sfx;
  optVolume.value = String(SETTINGS.audio.volume);
  themeModeRadios.forEach(r => r.checked = (r.value === SETTINGS.display.themeMode));
  optHiDPI.checked = !!SETTINGS.display.hiDPI;

  gameplayLockHint.style.display = gameRunning && !gameOver ? 'block' : 'none';
  settingsModal.classList.remove('hidden');
}
function closeSettings() { settingsModal.classList.add('hidden'); }

function gatherSettingsFromUI() {
  const next = structuredClone(SETTINGS);
  next.gameplay.difficulty = optDifficulty.value;
  next.gameplay.scoreToWin = parseInt(optScore.value, 10) || 5;
  next.gameplay.paddleSpeed = optPaddleSpeed.value;
  next.gameplay.ballCurve = optBallCurve.value;
  next.gameplay.ballAccel = Math.max(0, Math.min(0.15, parseFloat(optBallAccel.value) || 0));
  next.gameplay.spinEnabled = !!optSpinEnabled.checked;
  next.gameplay.spinPower = Math.max(0, Math.min(1, parseFloat(optSpinPower.value) || 0));
  next.gameplay.assist = optAssist.value;

  const cs = ctrlSchemeRadios.find(r => r.checked)?.value || 'auto';
  next.controls.scheme = cs;
  next.controls.invertY = !!optInvertY.checked;

  next.audio.sfx = !!optSfx.checked;
  next.audio.volume = parseFloat(optVolume.value);

  const selTheme = themeModeRadios.find(r => r.checked)?.value || 'system';
  next.display.themeMode = selTheme;
  next.display.hiDPI = !!optHiDPI.checked;
  return next;
}

function gameplayChanged(next, curr) {
  return next.gameplay.difficulty !== curr.gameplay.difficulty ||
    next.gameplay.scoreToWin !== curr.gameplay.scoreToWin ||
    next.gameplay.paddleSpeed !== curr.gameplay.paddleSpeed ||
    next.gameplay.ballCurve !== curr.gameplay.ballCurve ||
    Math.abs(next.gameplay.ballAccel - curr.gameplay.ballAccel) > 1e-6 ||
    next.gameplay.spinEnabled !== curr.gameplay.spinEnabled ||
    Math.abs(next.gameplay.spinPower - curr.gameplay.spinPower) > 1e-6 ||
    next.gameplay.assist !== curr.gameplay.assist;
}
function controlsChanged(next, curr) {
  return next.controls.scheme !== curr.controls.scheme ||
    next.controls.invertY !== curr.controls.invertY;
}

function applySettings(next, { confirmRestartIfNeeded = true } = {}) {
  const needRestart = gameplayChanged(next, SETTINGS);
  const controlsDiff = controlsChanged(next, SETTINGS);

  SETTINGS = next;
  saveSettings();

  applyThemeMode(SETTINGS.display.themeMode);
  const hiChanged = (hiDPIEnabled !== !!SETTINGS.display.hiDPI);
  hiDPIEnabled = !!SETTINGS.display.hiDPI;
  if (hiChanged) resizeCanvas();

  if (needRestart && gameRunning && !gameOver && confirmRestartIfNeeded) {
    const ok = window.confirm('Changing gameplay settings will restart the match. Continue?');
    if (!ok) { openSettings('gameplay'); return; }

    aiCfg = DIFFICULTIES[SETTINGS.gameplay.difficulty];
    scoreToWin = SETTINGS.gameplay.scoreToWin;
    applyKeyboardSpeed();
    applyAssistAndHeights();
    updateFTLabel();
    fullReset();
  } else {
    aiCfg = DIFFICULTIES[SETTINGS.gameplay.difficulty];
    scoreToWin = SETTINGS.gameplay.scoreToWin;
    applyKeyboardSpeed();
    applyAssistAndHeights();
    updateFTLabel();
  }

  if (controlsDiff) {
    invertY = !!SETTINGS.controls.invertY;
    recomputeControlPermissions(true);
  }
}

settingsBtn.addEventListener('click', () => openSettings('gameplay'));
settingsClose.addEventListener('click', closeSettings);
settingsCancel.addEventListener('click', closeSettings);
settingsBackdrop.addEventListener('click', closeSettings);
settingsApply.addEventListener('click', () => {
  const next = gatherSettingsFromUI();
  applySettings(next, { confirmRestartIfNeeded: true });
  closeSettings();
});
settingsDefaults.addEventListener('click', () => {
  applySettings(structuredClone(DEFAULT_SETTINGS), { confirmRestartIfNeeded: true });
  closeSettings();
});

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.toggle('active', t === tab));
    Object.entries(panels).forEach(([key, el]) => el.classList.toggle('active', tab.dataset.tab === key));
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !settingsModal.classList.contains('hidden')) closeSettings();
});

function recomputeControlPermissions(showToastOnChange = false) {
  const scheme = SETTINGS.controls.scheme;

  allowMouse = allowKeyboard = allowTouch = false;
  if (scheme === 'mouse') { allowMouse = true; }
  else if (scheme === 'keyboard') { allowKeyboard = true; }
  else if (scheme === 'touch') { allowTouch = true; }
  else {
    if (preferTouchDevice()) { allowTouch = true; }
    else { allowMouse = true; allowKeyboard = true; }
  }

  if (showToastOnChange) {
    if (allowKeyboard && allowMouse) showToast('Control: Auto (Keyboard + Mouse)');
    else if (allowTouch) showToast('Control: Touch (drag to move paddle)');
    else if (allowKeyboard) showToast('Control: Keyboard active (W/S or ↑/↓)');
    else if (allowMouse) showToast('Control: Mouse active');
  }
}

let toastTimer = null;
function showToast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.classList.remove('show'); }, 2400);
}

(function boot() {
  initThemeFromSettings();
  hiDPIEnabled = !!SETTINGS.display.hiDPI;
  resizeCanvas();
  applyDifficulty();
  applyKeyboardSpeed();
  scoreToWin = SETTINGS.gameplay.scoreToWin;
  centerEntities();
  resetBall(true);
  updateFTLabel();
  recomputeControlPermissions(true);
  updateControls();
  syncScoreDOM();
  requestAnimationFrame(gameLoop);
})();