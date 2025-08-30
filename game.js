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
const statRally = document.getElementById('statRally');
const statMaxRally = document.getElementById('statMaxRally');
const statSpeed = document.getElementById('statSpeed');
const statHitsP = document.getElementById('statHitsP');
const statHitsAI = document.getElementById('statHitsAI');
const statWalls = document.getElementById('statWalls');
const statTime = document.getElementById('statTime');
const clearStatsBtn = document.getElementById('clearStats');
const kpiGames = document.getElementById('kpiGames');
const kpiWins = document.getElementById('kpiWins');
const kpiLosses = document.getElementById('kpiLosses');
const kpiWinRate = document.getElementById('kpiWinRate');
const kpiAvgRally = document.getElementById('kpiAvgRally');
const resetHistoryBtn = document.getElementById('resetHistory');
const heatCanvasP = document.getElementById('heatPlayer');
const heatCanvasA = document.getElementById('heatAI');
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
const optTrail = document.getElementById('optTrail');
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
  display: { themeMode: 'system', hiDPI: true, trail: 'medium' },
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
    ballTrail.forEach(p => { p.x *= sx; p.y *= sy; });
  }
  cssW = newCssW;
  cssH = newCssH;

  canvas.style.height = `${cssH}px`;
  dpr = (hiDPIEnabled ? (window.devicePixelRatio || 1) : 1);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  resizeHeatmapCanvas(heatCanvasP);
  resizeHeatmapCanvas(heatCanvasA);
  drawHeatmaps();
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
  easy:   { speed: 320, error: 24, reactionDelay: 0.18, predictiveness: 0.55 },
  medium: { speed: 460, error: 14, reactionDelay: 0.12, predictiveness: 0.78 },
  hard:   { speed: 680, error: 8,  reactionDelay: 0.06, predictiveness: 0.95 },
};
let aiCfg = DIFFICULTIES[SETTINGS.gameplay.difficulty];
let aiSpeed = aiCfg.speed;
let aiError = aiCfg.error;
let aiReactionDelay = aiCfg.reactionDelay;
let aiPredictiveness = aiCfg.predictiveness;
let aiTargetY = 0;
let aiRecalcCooldown = 0;

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

let TRAIL_LEN = 14;
let TRAIL_ALPHA_BASE = 0.04;
let TRAIL_ALPHA_GAIN = 0.18;

let ballTrail = [];

let hitsThisRally = 0;
let maxRally = 0;
let playerHits = 0;
let aiHits = 0;
let wallBounces = 0;
let topBallSpeed = 0;
let elapsed = 0;

const NUM_BINS = 12;
const DEFAULT_HISTORY = {
  games: 0, wins: 0, losses: 0,
  rallySum: 0, rallyCount: 0,
  heatPlayer: Array(NUM_BINS).fill(0),
  heatAI: Array(NUM_BINS).fill(0),
};
let HISTORY = loadHistory();

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const isSettingsOpen = () => !settingsModal.classList.contains('hidden');
function isTypingTarget(el){
  return el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}
function preferTouchDevice(){
  return 'ontouchstart' in window || window.matchMedia('(pointer: coarse)').matches;
}

function fmtTime(t){
  t = Math.max(0, Math.floor(t));
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function hypot(x,y){ return Math.sqrt(x*x + y*y); }

function predictYAtX(x0, y0, vx, vy, targetX){
  if (vx <= 0) return cssH/2;
  const range = cssH - BALL_SIZE;
  const cy0 = y0 + BALL_SIZE/2;
  const t = (targetX - (x0 + BALL_SIZE/2)) / vx;
  if (t <= 0) return cy0;
  const period = 2 * range;
  let y = cy0 + vy * t;

  y = ((y % period) + period) % period;
  if (y > range) y = period - y;
  return y;
}

function centerEntities() {
  playerY = (cssH - PLAYER_PADDLE_HEIGHT) / 2;
  aiY = (cssH - AI_PADDLE_HEIGHT) / 2;
  ballX = cssW / 2 - BALL_SIZE / 2;
  ballY = cssH / 2 - BALL_SIZE / 2;
  prevPlayerY = playerY;
  aiTargetY = cssH / 2;
  ballTrail = [];
}

function serveBall(){
  const dirX = Math.random() < 0.5 ? -1 : 1;
  ballSpeedX = BALL_SPEED_INIT * dirX;
  ballSpeedY = (Math.random() - 0.5) * (BALL_SPEED_INIT * 0.6);
  aiForceRecalc();
}

function resetBall(scoreReset = false){
  ballX = cssW / 2 - BALL_SIZE / 2;
  ballY = cssH / 2 - BALL_SIZE / 2;
  ballTrail = [];
  if (scoreReset){
    ballSpeedX = 0;
    ballSpeedY = 0;
  } else {
    serveBall();
  }
}

function fullReset(){
  playerScore = 0; aiScore = 0;
  paused = false; gameRunning = false; gameOver = false; resumeCountdown = 0;
  hideResultOverlay();
  centerEntities();
  resetBall(true);
  updateFTLabel();
  updateControls();
  hint.style.opacity = 1;

  hitsThisRally = 0; maxRally = 0; playerHits = 0; aiHits = 0;
  wallBounces = 0; topBallSpeed = 0; elapsed = 0;
  updateStatsDOM(); updateStatsDOMTime();

  syncScoreDOM();
}

function endGame(winner){
  gameOver = true; gameRunning = false; paused = false; resumeCountdown = 0;
  resetBall(true);

  const playerWin = winner === 'player';
  playerResultEl.textContent = playerWin ? 'WIN' : 'LOSE';
  aiResultEl.textContent = playerWin ? 'LOSE' : 'WIN';
  playerResultEl.classList.toggle('lose', !playerWin);
  aiResultEl.classList.toggle('lose', playerWin);

  showResultOverlay();
  updateControls();

  HISTORY.games += 1;
  if (playerWin) HISTORY.wins += 1; else HISTORY.losses += 1;
  saveHistory();
  updateKPIDOM();

  if (playerWin){ playSfx('win'); vibrate([60, 60, 120]); }
  else { playSfx('lose'); vibrate([30, 30, 30, 30, 30]); }
}

function startResumeCountdown(seconds = 3){
  resumeCountdown = seconds;
  paused = true;
  updateControls();
}

function applyAssistAndHeights(){

  let playerScale = 1, aiSpeedScale = 1, aiErrorBonus = 0, delayScale = 1, predictPenalty = 0;
  if (SETTINGS.gameplay.assist === 'light'){ playerScale = 1.2; aiSpeedScale = 0.9;  aiErrorBonus = 3; delayScale = 1.15; predictPenalty = 0.08; }
  if (SETTINGS.gameplay.assist === 'strong'){ playerScale = 1.4; aiSpeedScale = 0.78; aiErrorBonus = 6; delayScale = 1.35; predictPenalty = 0.18; }

  const newPlayerH = Math.round(BASE_PADDLE_HEIGHT * playerScale);
  const newAiH = BASE_PADDLE_HEIGHT;
  const keepCenter = (y, oldH, newH) => clamp(y + (oldH/2) - (newH/2), 0, cssH - newH);

  const oldPlayerH = PLAYER_PADDLE_HEIGHT;
  const oldAiH = AI_PADDLE_HEIGHT;
  PLAYER_PADDLE_HEIGHT = newPlayerH;
  AI_PADDLE_HEIGHT = newAiH;

  playerY = keepCenter(playerY, oldPlayerH, PLAYER_PADDLE_HEIGHT);
  aiY = keepCenter(aiY, oldAiH, AI_PADDLE_HEIGHT);

  aiSpeed = aiCfg.speed * aiSpeedScale;
  aiError = aiCfg.error + aiErrorBonus;
  aiReactionDelay = aiCfg.reactionDelay * delayScale;
  aiPredictiveness = clamp(aiCfg.predictiveness - predictPenalty, 0, 1);
}

function applyKeyboardSpeed(){ KEYBOARD_PADDLE_SPEED = PADDLE_SPEEDS[SETTINGS.gameplay.paddleSpeed] || 520; }

function applyDifficulty(){
  aiCfg = DIFFICULTIES[SETTINGS.gameplay.difficulty];
  applyAssistAndHeights();
}

function applyDisplayTrail(){
  const mode = SETTINGS.display.trail || 'medium';
  if (mode === 'off'){ TRAIL_LEN = 0; TRAIL_ALPHA_BASE = 0; TRAIL_ALPHA_GAIN = 0; }
  else if (mode === 'low'){ TRAIL_LEN = 8; TRAIL_ALPHA_BASE = 0.03; TRAIL_ALPHA_GAIN = 0.12; }
  else if (mode === 'high'){ TRAIL_LEN = 22; TRAIL_ALPHA_BASE = 0.05; TRAIL_ALPHA_GAIN = 0.26; }
  else { TRAIL_LEN = 14; TRAIL_ALPHA_BASE = 0.04; TRAIL_ALPHA_GAIN = 0.18; }
}

function applyThemeMode(mode){
  const eff = (mode === 'system')
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : mode;
  htmlRoot.setAttribute('data-theme', eff);
  themeToggle.setAttribute('aria-label', eff === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', eff === 'dark' ? '#0b0f14' : '#f4f6fa');
}
function initThemeFromSettings(){
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

let audioCtx = null, masterGain = null;
function ensureAudio(){
  if (!SETTINGS.audio.sfx) return;
  if (!audioCtx){
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = clamp(SETTINGS.audio.volume, 0, 1);
    masterGain.connect(audioCtx.destination);
  } else if (audioCtx.state === 'suspended'){
    audioCtx.resume();
  }
}
function setVolume(v){
  if (!masterGain) return;
  masterGain.gain.value = clamp(v, 0, 1);
}
function beep({freq=440, dur=0.08, type='sine', attack=0.002, release=0.08, gain=0.8, detune=0} = {}){
  if (!SETTINGS.audio.sfx) return;
  ensureAudio();
  if (!audioCtx || !masterGain) return;

  const t0 = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  g.gain.value = 0.0001;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + release);

  osc.connect(g); g.connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + Math.max(dur, attack + release + 0.01));
}
function playSfx(kind){
  if (!SETTINGS.audio.sfx) return;
  switch(kind){
    case 'paddle': { const f = 360 + Math.random()*120; beep({freq:f, type:'square', attack:0.003, release:0.09, gain:0.4}); break; }
    case 'wall': { const f = 220 + Math.random()*60; beep({freq:f, type:'triangle', attack:0.002, release:0.06, gain:0.35}); break; }
    case 'score': { beep({freq:440, type:'sine', attack:0.004, release:0.1, gain:0.5}); setTimeout(()=>beep({freq:330, type:'sine', attack:0.004, release:0.12, gain:0.5}), 80); break; }
    case 'win': { beep({freq:523.25, type:'triangle', attack:0.005, release:0.12, gain:0.55}); setTimeout(()=>beep({freq:659.25, type:'triangle', attack:0.005, release:0.12, gain:0.55}), 90); setTimeout(()=>beep({freq:783.99, type:'triangle', attack:0.005, release:0.16, gain:0.6}), 180); break; }
    case 'lose': { beep({freq:220, type:'sawtooth', attack:0.006, release:0.18, gain:0.5}); setTimeout(()=>beep({freq:174.61, type:'sawtooth', attack:0.006, release:0.22, gain:0.45}), 110); break; }
  }
}
function vibrate(pattern){ try{ if (navigator.vibrate && preferTouchDevice()) navigator.vibrate(pattern); }catch{} }

function drawRect(x, y, w, h, color){ ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
function drawNet(){
  const netColor = cssVar('--net-color') || '#2c3a4b';
  for (let i = 0; i < cssH; i += 24) drawRect(cssW / 2 - 2, i, 4, 12, netColor);
}
function drawText(text, x, y, size = 32, align = 'left'){
  ctx.fillStyle = cssVar('--text') || '#fff';
  ctx.font = `${size}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace`;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
}
function drawOverlayLabel(label){
  ctx.save();
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = cssVar('--bg') || '#000';
  ctx.fillRect(0, 0, cssW, cssH);
  ctx.globalAlpha = 1;
  drawText(label, cssW / 2, cssH / 2, 56, 'center');
  ctx.restore();
}

function drawTrail(){
  if (TRAIL_LEN <= 0 || ballTrail.length === 0) return;
  const r = BALL_SIZE/2;
  const color = cssVar('--ball-color') || '#fff';
  for (let i = 0; i < ballTrail.length; i++){
    const t = i / ballTrail.length;
    const alpha = TRAIL_ALPHA_BASE + t * TRAIL_ALPHA_GAIN;
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    const p = ballTrail[i];
    ctx.beginPath();
    ctx.arc(p.x + r, p.y + r, r * (0.65 + 0.35*t), 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function draw(){
  drawRect(0, 0, cssW, cssH, cssVar('--canvas-bg') || '#0c0f14');
  drawNet();
  drawTrail();

  const playerColor = cssVar('--player-color') || '#0ff';
  const aiColor = cssVar('--ai-color') || '#f60';
  const ballColor = cssVar('--ball-color') || '#fff';

  drawRect(PADDLE_MARGIN, playerY, PADDLE_WIDTH, PLAYER_PADDLE_HEIGHT, playerColor);
  drawRect(cssW - PADDLE_MARGIN - PADDLE_WIDTH, aiY, PADDLE_WIDTH, AI_PADDLE_HEIGHT, aiColor);
  drawRect(ballX, ballY, BALL_SIZE, BALL_SIZE, ballColor);

  drawText(playerScore, cssW / 2 - 60, 50, 36, 'right');
  drawText(aiScore,     cssW / 2 + 60, 50, 36, 'left');

  if (resumeCountdown > 0) {
    const n = Math.ceil(resumeCountdown);
    drawOverlayLabel(String(n));
  } else if (paused && gameRunning) {
    drawOverlayLabel("PAUSED");
  }
}

function aiForceRecalc(factor = 0.0){ aiRecalcCooldown = Math.max(0.0, aiReactionDelay * factor); }
function aiUpdateTarget(){
  if (ballSpeedX > 0){
    const aiLineXCenter = cssW - PADDLE_MARGIN - PADDLE_WIDTH - BALL_SIZE/2;
    const predicted = predictYAtX(ballX, ballY, ballSpeedX, ballSpeedY, aiLineXCenter);
    const naive = ballY + BALL_SIZE/2;
    const mix = aiPredictiveness;
    let target = naive * (1 - mix) + predicted * mix;
    const noise = (Math.random()*2 - 1) * aiError;
    target += noise;
    aiTargetY = clamp(target, AI_PADDLE_HEIGHT/2, cssH - AI_PADDLE_HEIGHT/2);
  } else {
    const noise = (Math.random()*2 - 1) * (aiError * 0.6);
    aiTargetY = clamp(cssH/2 + noise, AI_PADDLE_HEIGHT/2, cssH - AI_PADDLE_HEIGHT/2);
  }
}

function update(dt){
  dt = Math.min(dt, 0.05);

  if (resumeCountdown > 0) {
    resumeCountdown -= dt;
    if (resumeCountdown > 0) return;
    resumeCountdown = 0;
    paused = false;
    updateControls();
  }

  if (!gameRunning || paused || gameOver) return;

  elapsed += dt;
  updateStatsDOMTime();

  if (allowKeyboard){
    let dir = 0;
    if (pressed.up) dir -= 1;
    if (pressed.down) dir += 1;
    if (invertY) dir *= -1;
    if (dir !== 0){
      playerY += dir * KEYBOARD_PADDLE_SPEED * dt;
      playerY = clamp(playerY, 0, cssH - PLAYER_PADDLE_HEIGHT);
    }
  }

  ballX += ballSpeedX * dt;
  ballY += ballSpeedY * dt;

  if (TRAIL_LEN > 0){
    ballTrail.push({x: ballX, y: ballY});
    if (ballTrail.length > TRAIL_LEN) ballTrail.shift();
  }

  const speedNow = hypot(ballSpeedX, ballSpeedY);
  topBallSpeed = Math.max(topBallSpeed, speedNow);
  statSpeed.textContent = Math.round(speedNow);

  if (ballY <= 0 || ballY + BALL_SIZE >= cssH) {
    ballSpeedY *= -1;
    ballY = clamp(ballY, 0, cssH - BALL_SIZE);
    wallBounces++; statWalls.textContent = wallBounces;
    playSfx('wall'); vibrate([8]);
    aiForceRecalc(0.35);
  }

  if (
    ballX <= PADDLE_MARGIN + PADDLE_WIDTH &&
    ballY + BALL_SIZE > playerY &&
    ballY < playerY + PLAYER_PADDLE_HEIGHT
  ){
    ballX = PADDLE_MARGIN + PADDLE_WIDTH;

    if (SETTINGS.gameplay.ballCurve === 'gradual'){
      ballSpeedX = -ballSpeedX * (1 + SETTINGS.gameplay.ballAccel);
    } else {
      ballSpeedX = -ballSpeedX;
    }

    const collidePoint = (ballY + BALL_SIZE/2) - (playerY + PLAYER_PADDLE_HEIGHT/2);
    ballSpeedY = collidePoint * 9;

    if (SETTINGS.gameplay.spinEnabled){
      const paddleVelY = (playerY - prevPlayerY) / dt;
      const spinCoeff = 0.12 * SETTINGS.gameplay.spinPower;
      ballSpeedY += paddleVelY * spinCoeff;
    }

    ballSpeedX = Math.sign(ballSpeedX) * Math.min(Math.abs(ballSpeedX), MAX_BALL_SPEED);
    ballSpeedY = Math.sign(ballSpeedY) * Math.min(Math.abs(ballSpeedY), MAX_BALL_SPEED);

    hitsThisRally++; playerHits++; updateStatsDOM();
    playSfx('paddle'); vibrate([12]);
    aiForceRecalc(0.2);

    const norm = clamp((ballY + BALL_SIZE/2 - playerY) / PLAYER_PADDLE_HEIGHT, 0, 1);
    const idx = Math.min(NUM_BINS-1, Math.floor(norm * NUM_BINS));
    HISTORY.heatPlayer[idx] += 1; saveHistory(); drawHeatmaps();
  }

  if (
    ballX + BALL_SIZE >= cssW - PADDLE_MARGIN - PADDLE_WIDTH &&
    ballY + BALL_SIZE > aiY &&
    ballY < aiY + AI_PADDLE_HEIGHT
  ){
    ballX = cssW - PADDLE_MARGIN - PADDLE_WIDTH - BALL_SIZE;

    if (SETTINGS.gameplay.ballCurve === 'gradual'){
      ballSpeedX = -ballSpeedX * (1 + SETTINGS.gameplay.ballAccel);
    } else {
      ballSpeedX = -ballSpeedX;
    }

    const collidePoint = (ballY + BALL_SIZE/2) - (aiY + AI_PADDLE_HEIGHT/2);
    ballSpeedY = collidePoint * 9;

    ballSpeedX = Math.sign(ballSpeedX) * Math.min(Math.abs(ballSpeedX), MAX_BALL_SPEED);
    ballSpeedY = Math.sign(ballSpeedY) * Math.min(Math.abs(ballSpeedY), MAX_BALL_SPEED);

    hitsThisRally++; aiHits++; updateStatsDOM();
    playSfx('paddle'); vibrate([10]);

    const normA = clamp((ballY + BALL_SIZE/2 - aiY) / AI_PADDLE_HEIGHT, 0, 1);
    const idxA = Math.min(NUM_BINS-1, Math.floor(normA * NUM_BINS));
    HISTORY.heatAI[idxA] += 1; saveHistory(); drawHeatmaps();
  }

  if (ballX < 0){
    aiScore++; syncScoreDOM(); playSfx('score'); vibrate([20,40,20]);
    HISTORY.rallySum += hitsThisRally; HISTORY.rallyCount += 1;
    maxRally = Math.max(maxRally, hitsThisRally);
    hitsThisRally = 0; updateStatsDOM(); saveHistory(); updateKPIDOM();

    if (aiScore >= scoreToWin){ endGame('ai'); return; }
    resetBall(false);
  } else if (ballX > cssW){
    playerScore++; syncScoreDOM(); playSfx('score'); vibrate([20,40,20]);
    HISTORY.rallySum += hitsThisRally; HISTORY.rallyCount += 1;
    maxRally = Math.max(maxRally, hitsThisRally);
    hitsThisRally = 0; updateStatsDOM(); saveHistory(); updateKPIDOM();

    if (playerScore >= scoreToWin){ endGame('player'); return; }
    resetBall(false);
  }

  aiRecalcCooldown -= dt;
  if (aiRecalcCooldown <= 0){
    aiUpdateTarget();
    aiRecalcCooldown = aiReactionDelay;
  }
  const aiCenter = aiY + AI_PADDLE_HEIGHT / 2;
  const delta = aiTargetY - aiCenter;

  if (Math.abs(delta) > aiError){
    const step = Math.sign(delta) * Math.min(Math.abs(delta), aiSpeed * dt);
    aiY += step;
  }
  aiY = clamp(aiY, 0, cssH - AI_PADDLE_HEIGHT);

  prevPlayerY = playerY;
}

let lastTime = performance.now();
function gameLoop(now){
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
  ensureAudio();
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
  if (isSettingsOpen() || isTypingTarget(e.target)) return;

  ensureAudio();

  if (allowKeyboard){
    if (e.code === 'ArrowUp' || e.code === 'KeyW'){ pressed.up = true; e.preventDefault(); if (!keyboardToastShown){ showToast('Keyboard active: W/S or ↑/↓ · Enter=Start · P=Pause · R=Reset'); keyboardToastShown = true; } }
    if (e.code === 'ArrowDown' || e.code === 'KeyS'){ pressed.down = true; e.preventDefault(); if (!keyboardToastShown){ showToast('Keyboard active: W/S or ↑/↓ · Enter=Start · P=Pause · R=Reset'); keyboardToastShown = true; } }
  }

  if (e.code === 'Enter'){
    e.preventDefault();
    if (gameOver) { fullReset(); }
    if (!gameRunning){
      if (ballSpeedX === 0 && ballSpeedY === 0) serveBall();
      gameRunning = true;
      startResumeCountdown(3);
      hint.style.opacity = 0;
      hideResultOverlay();
      updateControls();
    } else if (paused){
      startResumeCountdown(3);
      updateControls();
    }
  } else if (e.code === 'KeyP'){
    e.preventDefault();
    if (!gameRunning || gameOver) return;
    if (!paused) paused = true; else startResumeCountdown(3);
    updateControls();
  } else if (e.code === 'KeyR'){
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
  ensureAudio();
  if (gameOver) { fullReset(); }
  if (!gameRunning){
    if (ballSpeedX === 0 && ballSpeedY === 0) serveBall();
    gameRunning = true;
    startResumeCountdown(3);
    hint.style.opacity = 0;
  } else if (paused){
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

clearStatsBtn.addEventListener('click', () => {
  hitsThisRally = 0; maxRally = 0; playerHits = 0; aiHits = 0;
  wallBounces = 0; topBallSpeed = 0; elapsed = 0;
  updateStatsDOM(); updateStatsDOMTime();
  showToast('Stats cleared');
});

resetHistoryBtn.addEventListener('click', () => {
  const ok = window.confirm('Reset all-time history (games, win rate, avg rally, heatmap)?');
  if (!ok) return;
  HISTORY = structuredClone(DEFAULT_HISTORY);
  saveHistory();
  updateKPIDOM();
  drawHeatmaps();
  showToast('History reset');
});

function updateControls(){
  startBtn.disabled = (gameRunning && !paused && resumeCountdown === 0) || gameOver;
  startBtn.textContent = (!gameRunning || paused || resumeCountdown > 0 || gameOver) ? 'Start Game' : 'Running...';
  pauseBtn.textContent = (paused && resumeCountdown === 0) ? 'Resume' : 'Pause';
  pauseBtn.disabled = !gameRunning || gameOver || resumeCountdown > 0;
}
function syncScoreDOM(){
  const p = document.getElementById('playerScore');
  const a = document.getElementById('aiScore');
  if (p && a){ p.textContent = playerScore; a.textContent = aiScore; }
}
function updateFTLabel(){ if (ftLabel) ftLabel.textContent = `FT${scoreToWin}`; }

function updateStatsDOM(){
  if (statRally) statRally.textContent = hitsThisRally;
  if (statMaxRally) statMaxRally.textContent = maxRally;
  if (statHitsP) statHitsP.textContent = playerHits;
  if (statHitsAI) statHitsAI.textContent = aiHits;
  if (statWalls) statWalls.textContent = wallBounces;
  if (statSpeed) statSpeed.textContent = Math.round(hypot(ballSpeedX, ballSpeedY));
}
function updateStatsDOMTime(){ if (statTime) statTime.textContent = fmtTime(elapsed); }

function updateKPIDOM(){
  const g = HISTORY.games || 0;
  const w = HISTORY.wins || 0;
  const l = HISTORY.losses || 0;
  const rc = HISTORY.rallyCount || 0;
  const rs = HISTORY.rallySum || 0;

  if (kpiGames) kpiGames.textContent = g;
  if (kpiWins) kpiWins.textContent = w;
  if (kpiLosses) kpiLosses.textContent = l;
  if (kpiWinRate) kpiWinRate.textContent = g ? `${Math.round((w/g)*100)}%` : '0%';
  if (kpiAvgRally) kpiAvgRally.textContent = rc ? (rs/rc).toFixed(1) : '0.0';
}

function resizeHeatmapCanvas(cvs){
  if (!cvs) return;
  const rect = cvs.getBoundingClientRect();
  const w = Math.max(260, Math.floor(rect.width));
  const h = Math.floor(w / 6.5);
  const d = window.devicePixelRatio || 1;
  cvs.width = Math.round(w * d);
  cvs.height = Math.round(h * d);
  cvs.style.height = `${h}px`;
  const ctx2 = cvs.getContext('2d');
  ctx2.setTransform(d, 0, 0, d, 0, 0);
}

function drawHeatmap(cvs, bins, colorA='#00ffff', colorB='#ff6000'){
  if (!cvs) return;
  const c = cvs.getContext('2d');
  const w = Math.floor(cvs.width / (window.devicePixelRatio || 1));
  const h = Math.floor(cvs.height / (window.devicePixelRatio || 1));
  c.clearRect(0,0,w,h);

  c.fillStyle = 'rgba(255,255,255,0.03)';
  c.fillRect(0, 0, w, h);

  const max = Math.max(1, ...bins);
  const pad = 6;
  const barW = (w - pad*2) / bins.length;
  for (let i=0;i<bins.length;i++){
    const v = bins[i];
    const ratio = v / max;
    const bh = ratio * (h - pad*2);
    const x = pad + i*barW;
    const y = h - pad - bh;

    const grad = c.createLinearGradient(0, y, 0, y+bh);
    grad.addColorStop(0, colorA);
    grad.addColorStop(1, colorB);
    c.fillStyle = grad;

    c.fillRect(Math.floor(x)+0.5, y, Math.max(2, barW-2), bh);
  }

  c.fillStyle = cssVar('--muted') || '#9fb0c3';
  c.font = '10px system-ui, -apple-system, Segoe UI, Roboto';
  c.fillText('Top', 4, 12);
  c.fillText('Bottom', 4, h-4);
}

function drawHeatmaps(){
  drawHeatmap(heatCanvasP, HISTORY.heatPlayer, cssVar('--player-color')||'#00ffff', '#3dd9ff');
  drawHeatmap(heatCanvasA, HISTORY.heatAI, cssVar('--ai-color')||'#ff6000', '#ff9a66');
}

function showResultOverlay(){ overlay.classList.remove('hidden'); }
function hideResultOverlay(){ overlay.classList.add('hidden'); }

function autoPauseIfRunning(){
  if (gameRunning && !paused && !gameOver && resumeCountdown === 0){
    paused = true;
    updateControls();
  }
}
window.addEventListener('blur', autoPauseIfRunning);
document.addEventListener('visibilitychange', () => { if (document.hidden) autoPauseIfRunning(); });

function loadSettings(){
  try{
    const raw = localStorage.getItem('pong.settings.v1');
    if (!raw) return structuredClone(DEFAULT_SETTINGS);
    const parsed = JSON.parse(raw);
    return {
      gameplay: { ...DEFAULT_SETTINGS.gameplay, ...(parsed.gameplay||{}) },
      audio: { ...DEFAULT_SETTINGS.audio, ...(parsed.audio||{}) },
      display: { ...DEFAULT_SETTINGS.display, ...(parsed.display||{}) }, // merges new 'trail'
      controls: { ...DEFAULT_SETTINGS.controls, ...(parsed.controls||{}) },
    };
  }catch(e){
    return structuredClone(DEFAULT_SETTINGS);
  }
}
function saveSettings(){
  localStorage.setItem('pong.settings.v1', JSON.stringify(SETTINGS));
}

function loadHistory(){
  try{
    const raw = localStorage.getItem('pong.history.v1');
    if (!raw) return structuredClone(DEFAULT_HISTORY);
    const parsed = JSON.parse(raw);
    return {
      games: parsed.games || 0,
      wins: parsed.wins || 0,
      losses: parsed.losses || 0,
      rallySum: parsed.rallySum || 0,
      rallyCount: parsed.rallyCount || 0,
      heatPlayer: Array.isArray(parsed.heatPlayer) && parsed.heatPlayer.length===NUM_BINS ? parsed.heatPlayer.slice() : Array(NUM_BINS).fill(0),
      heatAI: Array.isArray(parsed.heatAI) && parsed.heatAI.length===NUM_BINS ? parsed.heatAI.slice() : Array(NUM_BINS).fill(0),
    };
  }catch(e){ return structuredClone(DEFAULT_HISTORY); }
}
function saveHistory(){
  localStorage.setItem('pong.history.v1', JSON.stringify(HISTORY));
}

function openSettings(initialTab='gameplay'){
  if (gameRunning && !paused && resumeCountdown === 0){ paused = true; updateControls(); }

  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === initialTab));
  Object.entries(panels).forEach(([k,el]) => el.classList.toggle('active', k===initialTab));

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
  optTrail.value = SETTINGS.display.trail || 'medium';

  gameplayLockHint.style.display = gameRunning && !gameOver ? 'block' : 'none';
  settingsModal.classList.remove('hidden');
}
function closeSettings(){ settingsModal.classList.add('hidden'); }

function gatherSettingsFromUI(){
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
  next.display.trail = optTrail.value || 'medium';
  return next;
}

function gameplayChanged(a,b){
  return a.gameplay.difficulty !== b.gameplay.difficulty ||
         a.gameplay.scoreToWin !== b.gameplay.scoreToWin ||
         a.gameplay.paddleSpeed !== b.gameplay.paddleSpeed ||
         a.gameplay.ballCurve   !== b.gameplay.ballCurve   ||
         Math.abs(a.gameplay.ballAccel - b.gameplay.ballAccel) > 1e-6 ||
         a.gameplay.spinEnabled !== b.gameplay.spinEnabled ||
         Math.abs(a.gameplay.spinPower - b.gameplay.spinPower) > 1e-6 ||
         a.gameplay.assist      !== b.gameplay.assist;
}
function controlsChanged(a,b){ return a.controls.scheme !== b.controls.scheme || a.controls.invertY !== b.controls.invertY; }
function audioChanged(a,b){ return a.audio.sfx !== b.audio.sfx || Math.abs(a.audio.volume - b.audio.volume) > 1e-6; }
function displayChanged(a,b){ return a.display.themeMode !== b.display.themeMode || a.display.hiDPI !== b.display.hiDPI || a.display.trail !== b.display.trail; }

function applySettings(next, {confirmRestartIfNeeded=true} = {}){
  const needRestart = gameplayChanged(next, SETTINGS);
  const controlsDiff = controlsChanged(next, SETTINGS);
  const audioDiff = audioChanged(next, SETTINGS);
  const displayDiff = displayChanged(next, SETTINGS);

  SETTINGS = next;
  saveSettings();

  if (displayDiff){
    applyThemeMode(SETTINGS.display.themeMode);
    const prevHi = hiDPIEnabled;
    hiDPIEnabled = !!SETTINGS.display.hiDPI;
    applyDisplayTrail();
    if (prevHi !== hiDPIEnabled) resizeCanvas(); else drawHeatmaps();
  }

  if (audioDiff){
    if (!SETTINGS.audio.sfx && audioCtx && audioCtx.state !== 'closed'){
    } else {
      ensureAudio();
      setVolume(SETTINGS.audio.volume);
    }
  }

  if (needRestart && gameRunning && !gameOver && confirmRestartIfNeeded){
    const ok = window.confirm('Changing gameplay settings will restart the match. Continue?');
    if (!ok){ openSettings('gameplay'); return; }
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

  if (controlsDiff){
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
  applySettings(next, {confirmRestartIfNeeded:true});
  closeSettings();
});
settingsDefaults.addEventListener('click', () => {
  applySettings(structuredClone(DEFAULT_SETTINGS), {confirmRestartIfNeeded:true});
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

function recomputeControlPermissions(showToastOnChange = false){
  const scheme = SETTINGS.controls.scheme;
  allowMouse = allowKeyboard = allowTouch = false;
  if (scheme === 'mouse'){ allowMouse = true; }
  else if (scheme === 'keyboard'){ allowKeyboard = true; }
  else if (scheme === 'touch'){ allowTouch = true; }
  else { if (preferTouchDevice()){ allowTouch = true; } else { allowMouse = true; allowKeyboard = true; } }

  if (showToastOnChange){
    if (allowKeyboard && allowMouse) showToast('Control: Auto (Keyboard + Mouse)');
    else if (allowTouch) showToast('Control: Touch (drag to move paddle)');
    else if (allowKeyboard) showToast('Control: Keyboard active (W/S or ↑/↓)');
    else if (allowMouse) showToast('Control: Mouse active');
  }
}

let toastTimer = null;
function showToast(msg){
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.classList.remove('show'); }, 2400);
}

(function boot(){
  initThemeFromSettings();
  hiDPIEnabled = !!SETTINGS.display.hiDPI;
  applyDisplayTrail();
  resizeCanvas();
  applyDifficulty();
  applyKeyboardSpeed();
  scoreToWin = SETTINGS.gameplay.scoreToWin;
  centerEntities();
  resetBall(true);
  updateFTLabel();
  recomputeControlPermissions(true);
  updateControls();
  updateStatsDOM(); updateStatsDOMTime();
  updateKPIDOM();
  drawHeatmaps();
  syncScoreDOM();
  requestAnimationFrame(gameLoop);
})();