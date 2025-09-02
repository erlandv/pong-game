import {
  ASPECT, PADDLE_WIDTH, BASE_PADDLE_HEIGHT, BALL_SIZE, PADDLE_MARGIN,
  BALL_SPEED_INIT, MAX_BALL_SPEED, PADDLE_SPEEDS, DIFFICULTIES, NUM_BINS,
  clamp, cssVar, hypot
} from './config.js';
import { dom, SETTINGS, HISTORY, runtime } from './state.js';
import { saveHistory } from './config.js';
import { ensureAudio, playSfx, vibrate, updateControls } from './ui.js';

// ---------- Canvas & Resize ----------
export function resizeCanvas(){
  const canvas = dom.canvas;
  const ctx = dom.ctx;
  const rect = canvas.getBoundingClientRect();
  const newCssW = Math.max(200, Math.floor(rect.width));
  const newCssH = Math.floor(newCssW / ASPECT);

  if (runtime.cssW && runtime.cssH) {
    const sx = newCssW / runtime.cssW;
    const sy = newCssH / runtime.cssH;
    runtime.playerY *= sy;
    runtime.aiY *= sy;
    runtime.ballX *= sx;
    runtime.ballY *= sy;
    runtime.ballTrail.forEach(p => { p.x *= sx; p.y *= sy; });
  }
  runtime.cssW = newCssW;
  runtime.cssH = newCssH;

  canvas.style.height = `${runtime.cssH}px`;
  runtime.dpr = (runtime.hiDPIEnabled ? (window.devicePixelRatio || 1) : 1);
  canvas.width = Math.round(runtime.cssW * runtime.dpr);
  canvas.height = Math.round(runtime.cssH * runtime.dpr);
  ctx.setTransform(runtime.dpr, 0, 0, runtime.dpr, 0, 0);

  resizeHeatmapCanvas(dom.heatCanvasP);
  resizeHeatmapCanvas(dom.heatCanvasA);
  drawHeatmaps();
}
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', resizeCanvas);

// ---------- Geometry & Predict ----------
export function predictYAtX(x0, y0, vx, vy, targetX){
  if (vx <= 0) return runtime.cssH/2;
  const range = runtime.cssH - BALL_SIZE;
  const cy0 = y0 + BALL_SIZE/2;
  const t = (targetX - (x0 + BALL_SIZE/2)) / vx;
  if (t <= 0) return cy0;
  const period = 2 * range;
  let y = cy0 + vy * t;

  y = ((y % period) + period) % period;
  if (y > range) y = period - y;
  return y;
}

export function centerEntities() {
  runtime.playerY = (runtime.cssH - runtime.PLAYER_PADDLE_HEIGHT) / 2;
  runtime.aiY = (runtime.cssH - runtime.AI_PADDLE_HEIGHT) / 2;
  runtime.ballX = runtime.cssW / 2 - BALL_SIZE / 2;
  runtime.ballY = runtime.cssH / 2 - BALL_SIZE / 2;
  runtime.prevPlayerY = runtime.playerY;
  runtime.aiTargetY = runtime.cssH / 2;
  runtime.ballTrail = [];
}

export function serveBall(){
  const dirX = Math.random() < 0.5 ? -1 : 1;
  runtime.ballSpeedX = BALL_SPEED_INIT * dirX;
  runtime.ballSpeedY = (Math.random() - 0.5) * (BALL_SPEED_INIT * 0.6);
  aiForceRecalc();
}

export function resetBall(scoreReset = false){
  runtime.ballX = runtime.cssW / 2 - BALL_SIZE / 2;
  runtime.ballY = runtime.cssH / 2 - BALL_SIZE / 2;
  runtime.ballTrail = [];
  if (scoreReset){
    runtime.ballSpeedX = 0;
    runtime.ballSpeedY = 0;
  } else {
    serveBall();
  }
}

export function fullReset(){
  runtime.playerScore = 0; runtime.aiScore = 0;
  runtime.paused = false; runtime.gameRunning = false; runtime.gameOver = false; runtime.resumeCountdown = 0;
  hideResultOverlay();
  centerEntities();
  resetBall(true);
  updateFTLabel();
  updateControls();
  if (dom.hint) dom.hint.style.opacity = 1;

  runtime.hitsThisRally = 0; runtime.maxRally = 0; runtime.playerHits = 0; runtime.aiHits = 0;
  runtime.wallBounces = 0; runtime.topBallSpeed = 0; runtime.elapsed = 0;
  updateStatsDOM(); updateStatsDOMTime();

  syncScoreDOM();
}

export function endGame(winner){
  runtime.gameOver = true; runtime.gameRunning = false; runtime.paused = false; runtime.resumeCountdown = 0;
  resetBall(true);

  const playerWin = winner === 'player';
  dom.playerResultEl.textContent = playerWin ? 'WIN' : 'LOSE';
  dom.aiResultEl.textContent = playerWin ? 'LOSE' : 'WIN';
  dom.playerResultEl.classList.toggle('lose', !playerWin);
  dom.aiResultEl.classList.toggle('lose', playerWin);

  showResultOverlay();
  updateControls();

  HISTORY.games += 1;
  if (playerWin) HISTORY.wins += 1; else HISTORY.losses += 1;
  saveHistory(HISTORY);
  updateKPIDOM();

  if (playerWin){ playSfx('win'); vibrate([60, 60, 120]); }
  else { playSfx('lose'); vibrate([30, 30, 30, 30, 30]); }
}

export function startResumeCountdown(seconds = 3){
  runtime.resumeCountdown = seconds;
  runtime.paused = true;
  updateControls();
}

// ---------- Assist, Difficulty, Trail ----------
export function applyAssistAndHeights(){
  let playerScale = 1, aiSpeedScale = 1, aiErrorBonus = 0, delayScale = 1, predictPenalty = 0;
  if (SETTINGS.gameplay.assist === 'light'){ playerScale = 1.2; aiSpeedScale = 0.9;  aiErrorBonus = 3; delayScale = 1.15; predictPenalty = 0.08; }
  if (SETTINGS.gameplay.assist === 'strong'){ playerScale = 1.4; aiSpeedScale = 0.78; aiErrorBonus = 6; delayScale = 1.35; predictPenalty = 0.18; }

  const newPlayerH = Math.round(BASE_PADDLE_HEIGHT * playerScale);
  const newAiH = BASE_PADDLE_HEIGHT;
  const keepCenter = (y, oldH, newH) => clamp(y + (oldH/2) - (newH/2), 0, runtime.cssH - newH);

  const oldPlayerH = runtime.PLAYER_PADDLE_HEIGHT;
  const oldAiH = runtime.AI_PADDLE_HEIGHT;
  runtime.PLAYER_PADDLE_HEIGHT = newPlayerH;
  runtime.AI_PADDLE_HEIGHT = newAiH;

  runtime.playerY = keepCenter(runtime.playerY, oldPlayerH, runtime.PLAYER_PADDLE_HEIGHT);
  runtime.aiY = keepCenter(runtime.aiY, oldAiH, runtime.AI_PADDLE_HEIGHT);

  runtime.aiSpeed = runtime.aiCfg.speed * aiSpeedScale;
  runtime.aiError = runtime.aiCfg.error + aiErrorBonus;
  runtime.aiReactionDelay = runtime.aiCfg.reactionDelay * delayScale;
  runtime.aiPredictiveness = clamp(runtime.aiCfg.predictiveness - predictPenalty, 0, 1);
}

export function applyKeyboardSpeed(){
  runtime.KEYBOARD_PADDLE_SPEED = PADDLE_SPEEDS[SETTINGS.gameplay.paddleSpeed] || 520;
}

export function applyDifficulty(){
  runtime.aiCfg = DIFFICULTIES[SETTINGS.gameplay.difficulty];
  applyAssistAndHeights();
}

export function applyDisplayTrail(){
  const mode = SETTINGS.display.trail || 'medium';
  if (mode === 'off'){ runtime.TRAIL_LEN = 0; runtime.TRAIL_ALPHA_BASE = 0; runtime.TRAIL_ALPHA_GAIN = 0; }
  else if (mode === 'low'){ runtime.TRAIL_LEN = 8; runtime.TRAIL_ALPHA_BASE = 0.03; runtime.TRAIL_ALPHA_GAIN = 0.12; }
  else if (mode === 'high'){ runtime.TRAIL_LEN = 22; runtime.TRAIL_ALPHA_BASE = 0.05; runtime.TRAIL_ALPHA_GAIN = 0.26; }
  else { runtime.TRAIL_LEN = 14; runtime.TRAIL_ALPHA_BASE = 0.04; runtime.TRAIL_ALPHA_GAIN = 0.18; }
}

// ---------- Drawing ----------
function drawRect(x, y, w, h, color){ dom.ctx.fillStyle = color; dom.ctx.fillRect(x, y, w, h); }
function drawNet(){
  const netColor = cssVar('--net-color') || '#334155';
  for (let i = 0; i < runtime.cssH; i += 24) drawRect(runtime.cssW / 2 - 2, i, 4, 12, netColor);
}
function drawText(text, x, y, size = 32, align = 'left'){
  dom.ctx.fillStyle = cssVar('--text') || '#fff';
  dom.ctx.font = `${size}px 'Inter', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace`;
  dom.ctx.textAlign = align;
  dom.ctx.fillText(text, x, y);
}
function drawOverlayLabel(label){
  dom.ctx.save();
  dom.ctx.globalAlpha = 0.72;
  dom.ctx.fillStyle = cssVar('--bg') || '#000';
  dom.ctx.fillRect(0, 0, runtime.cssW, runtime.cssH);
  dom.ctx.globalAlpha = 1;
  drawText(label, runtime.cssW / 2, runtime.cssH / 2, 56, 'center');
  dom.ctx.restore();
}
function drawTrail(){
  if (runtime.TRAIL_LEN <= 0 || runtime.ballTrail.length === 0) return;
  const r = BALL_SIZE/2;
  const color = cssVar('--ball-color') || '#fff';
  for (let i = 0; i < runtime.ballTrail.length; i++){
    const t = i / runtime.ballTrail.length;
    const alpha = runtime.TRAIL_ALPHA_BASE + t * runtime.TRAIL_ALPHA_GAIN;
    dom.ctx.fillStyle = color;
    dom.ctx.globalAlpha = alpha;
    const p = runtime.ballTrail[i];
    dom.ctx.beginPath();
    dom.ctx.arc(p.x + r, p.y + r, r * (0.65 + 0.35*t), 0, Math.PI*2);
    dom.ctx.fill();
  }
  dom.ctx.globalAlpha = 1;
}

export function draw(){
  drawRect(0, 0, runtime.cssW, runtime.cssH, cssVar('--canvas-bg') || '#0c0f14');
  drawNet();
  drawTrail();

  const playerColor = cssVar('--player-color') || '#3b82f6';
  const aiColor = cssVar('--ai-color') || '#ef4444';
  const ballColor = cssVar('--ball-color') || '#fff';

  drawRect(PADDLE_MARGIN, runtime.playerY, PADDLE_WIDTH, runtime.PLAYER_PADDLE_HEIGHT, playerColor);
  drawRect(runtime.cssW - PADDLE_MARGIN - PADDLE_WIDTH, runtime.aiY, PADDLE_WIDTH, runtime.AI_PADDLE_HEIGHT, aiColor);

  dom.ctx.fillStyle = ballColor;
  dom.ctx.beginPath();
  dom.ctx.arc(runtime.ballX + BALL_SIZE / 2, runtime.ballY + BALL_SIZE / 2, BALL_SIZE / 2, 0, Math.PI * 2);
  dom.ctx.fill();

  drawText(runtime.playerScore, runtime.cssW / 2 - 60, 50, 36, 'right');
  drawText(runtime.aiScore,     runtime.cssW / 2 + 60, 50, 36, 'left');

  if (runtime.resumeCountdown > 0) {
    const n = Math.ceil(runtime.resumeCountdown);
    drawOverlayLabel(String(n));
  } else if (runtime.paused && runtime.gameRunning) {
    drawOverlayLabel("PAUSED");
  }
}

// ---------- Heatmap ----------
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

function drawHeatmap(cvs, bins, colorA='#3b82f6', colorB='#3dd9ff'){
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

  c.fillStyle = cssVar('--muted') || '#94a3b8';
  c.font = '10px system-ui, -apple-system, Segoe UI, Roboto';
  c.fillText('Top', 4, 12);
  c.fillText('Bottom', 4, h-4);
}

export function drawHeatmaps(){
  drawHeatmap(dom.heatCanvasP, HISTORY.heatPlayer, cssVar('--player-color')||'#3b82f6', '#60a5fa');
  drawHeatmap(dom.heatCanvasA, HISTORY.heatAI, cssVar('--ai-color')||'#ef4444', '#f87171');
}

// ---------- AI ----------
function aiForceRecalc(factor = 0.0){ runtime.aiRecalcCooldown = Math.max(0.0, runtime.aiReactionDelay * factor); }
function aiUpdateTarget(){
  if (runtime.ballSpeedX > 0){
    const aiLineXCenter = runtime.cssW - PADDLE_MARGIN - PADDLE_WIDTH - BALL_SIZE/2;
    const predicted = predictYAtX(runtime.ballX, runtime.ballY, runtime.ballSpeedX, runtime.ballSpeedY, aiLineXCenter);
    const naive = runtime.ballY + BALL_SIZE/2;
    const mix = runtime.aiPredictiveness;
    let target = naive * (1 - mix) + predicted * mix;
    const noise = (Math.random()*2 - 1) * runtime.aiError;
    target += noise;
    runtime.aiTargetY = clamp(target, runtime.AI_PADDLE_HEIGHT/2, runtime.cssH - runtime.AI_PADDLE_HEIGHT/2);
  } else {
    const noise = (Math.random()*2 - 1) * (runtime.aiError * 0.6);
    runtime.aiTargetY = clamp(runtime.cssH/2 + noise, runtime.AI_PADDLE_HEIGHT/2, runtime.cssH - runtime.AI_PADDLE_HEIGHT/2);
  }
}

// ---------- Update (physics + rules) ----------
export function update(dt){
  dt = Math.min(dt, 0.05);

  if (runtime.resumeCountdown > 0) {
    runtime.resumeCountdown -= dt;
    if (runtime.resumeCountdown > 0) return;
    runtime.resumeCountdown = 0;
    runtime.paused = false;
    updateControls();
  }

  if (!runtime.gameRunning || runtime.paused || runtime.gameOver) return;

  runtime.elapsed += dt;
  updateStatsDOMTime();

  if (runtime.allowKeyboard){
    let dir = 0;
    if (runtime.pressed.up) dir -= 1;
    if (runtime.pressed.down) dir += 1;
    if (runtime.invertY) dir *= -1;
    if (dir !== 0){
      runtime.playerY += dir * runtime.KEYBOARD_PADDLE_SPEED * dt;
      runtime.playerY = clamp(runtime.playerY, 0, runtime.cssH - runtime.PLAYER_PADDLE_HEIGHT);
    }
  }

  runtime.ballX += runtime.ballSpeedX * dt;
  runtime.ballY += runtime.ballSpeedY * dt;

  if (runtime.TRAIL_LEN > 0){
    runtime.ballTrail.push({x: runtime.ballX, y: runtime.ballY});
    if (runtime.ballTrail.length > runtime.TRAIL_LEN) runtime.ballTrail.shift();
  }

  const speedNow = hypot(runtime.ballSpeedX, runtime.ballSpeedY);
  runtime.topBallSpeed = Math.max(runtime.topBallSpeed, speedNow);
  if (dom.statSpeed) dom.statSpeed.textContent = Math.round(speedNow);

  // wall collisions
  if (runtime.ballY <= 0 || runtime.ballY + BALL_SIZE >= runtime.cssH) {
    runtime.ballSpeedY *= -1;
    runtime.ballY = clamp(runtime.ballY, 0, runtime.cssH - BALL_SIZE);
    runtime.wallBounces++; if (dom.statWalls) dom.statWalls.textContent = runtime.wallBounces;
    playSfx('wall'); vibrate([8]);
    aiForceRecalc(0.35);
  }

  // player paddle
  if (
    runtime.ballX <= PADDLE_MARGIN + PADDLE_WIDTH &&
    runtime.ballY + BALL_SIZE > runtime.playerY &&
    runtime.ballY < runtime.playerY + runtime.PLAYER_PADDLE_HEIGHT
  ){
    runtime.ballX = PADDLE_MARGIN + PADDLE_WIDTH;

    if (SETTINGS.gameplay.ballCurve === 'gradual'){
      runtime.ballSpeedX = -runtime.ballSpeedX * (1 + SETTINGS.gameplay.ballAccel);
    } else {
      runtime.ballSpeedX = -runtime.ballSpeedX;
    }

    const collidePoint = (runtime.ballY + BALL_SIZE/2) - (runtime.playerY + runtime.PLAYER_PADDLE_HEIGHT/2);
    runtime.ballSpeedY = collidePoint * 9;

    if (SETTINGS.gameplay.spinEnabled){
      const paddleVelY = (runtime.playerY - runtime.prevPlayerY) / dt;
      const spinCoeff = 0.12 * SETTINGS.gameplay.spinPower;
      runtime.ballSpeedY += paddleVelY * spinCoeff;
    }

    runtime.ballSpeedX = Math.sign(runtime.ballSpeedX) * Math.min(Math.abs(runtime.ballSpeedX), MAX_BALL_SPEED);
    runtime.ballSpeedY = Math.sign(runtime.ballSpeedY) * Math.min(Math.abs(runtime.ballSpeedY), MAX_BALL_SPEED);

    runtime.hitsThisRally++; runtime.playerHits++; updateStatsDOM();
    playSfx('paddle'); vibrate([12]);
    aiForceRecalc(0.2);

    const norm = clamp((runtime.ballY + BALL_SIZE/2 - runtime.playerY) / runtime.PLAYER_PADDLE_HEIGHT, 0, 1);
    const idx = Math.min(NUM_BINS-1, Math.floor(norm * NUM_BINS));
    HISTORY.heatPlayer[idx] += 1; saveHistory(HISTORY); drawHeatmaps();
  }

  // ai paddle
  if (
    runtime.ballX + BALL_SIZE >= runtime.cssW - PADDLE_MARGIN - PADDLE_WIDTH &&
    runtime.ballY + BALL_SIZE > runtime.aiY &&
    runtime.ballY < runtime.aiY + runtime.AI_PADDLE_HEIGHT
  ){
    runtime.ballX = runtime.cssW - PADDLE_MARGIN - PADDLE_WIDTH - BALL_SIZE;

    if (SETTINGS.gameplay.ballCurve === 'gradual'){
      runtime.ballSpeedX = -runtime.ballSpeedX * (1 + SETTINGS.gameplay.ballAccel);
    } else {
      runtime.ballSpeedX = -runtime.ballSpeedX;
    }

    const collidePoint = (runtime.ballY + BALL_SIZE/2) - (runtime.aiY + runtime.AI_PADDLE_HEIGHT/2);
    runtime.ballSpeedY = collidePoint * 9;

    runtime.ballSpeedX = Math.sign(runtime.ballSpeedX) * Math.min(Math.abs(runtime.ballSpeedX), MAX_BALL_SPEED);
    runtime.ballSpeedY = Math.sign(runtime.ballSpeedY) * Math.min(Math.abs(runtime.ballSpeedY), MAX_BALL_SPEED);

    runtime.hitsThisRally++; runtime.aiHits++; updateStatsDOM();
    playSfx('paddle'); vibrate([10]);

    const normA = clamp((runtime.ballY + BALL_SIZE/2 - runtime.aiY) / runtime.AI_PADDLE_HEIGHT, 0, 1);
    const idxA = Math.min(NUM_BINS-1, Math.floor(normA * NUM_BINS));
    HISTORY.heatAI[idxA] += 1; saveHistory(HISTORY); drawHeatmaps();
  }

  // score
  if (runtime.ballX < 0){
    runtime.aiScore++; syncScoreDOM(); playSfx('score'); vibrate([20,40,20]);
    HISTORY.rallySum += runtime.hitsThisRally; HISTORY.rallyCount += 1;
    runtime.maxRally = Math.max(runtime.maxRally, runtime.hitsThisRally);
    runtime.hitsThisRally = 0; updateStatsDOM(); saveHistory(HISTORY); updateKPIDOM();

    if (runtime.aiScore >= runtime.scoreToWin){ endGame('ai'); return; }
    resetBall(false);
  } else if (runtime.ballX > runtime.cssW){
    runtime.playerScore++; syncScoreDOM(); playSfx('score'); vibrate([20,40,20]);
    HISTORY.rallySum += runtime.hitsThisRally; HISTORY.rallyCount += 1;
    runtime.maxRally = Math.max(runtime.maxRally, runtime.hitsThisRally);
    runtime.hitsThisRally = 0; updateStatsDOM(); saveHistory(HISTORY); updateKPIDOM();

    if (runtime.playerScore >= runtime.scoreToWin){ endGame('player'); return; }
    resetBall(false);
  }

  // AI move
  runtime.aiRecalcCooldown -= dt;
  if (runtime.aiRecalcCooldown <= 0){
    aiUpdateTarget();
    runtime.aiRecalcCooldown = runtime.aiReactionDelay;
  }
  const aiCenter = runtime.aiY + runtime.AI_PADDLE_HEIGHT / 2;
  const delta = runtime.aiTargetY - aiCenter;

  if (Math.abs(delta) > runtime.aiError){
    const step = Math.sign(delta) * Math.min(Math.abs(delta), runtime.aiSpeed * dt);
    runtime.aiY += step;
  }
  runtime.aiY = clamp(runtime.aiY, 0, runtime.cssH - runtime.AI_PADDLE_HEIGHT);

  runtime.prevPlayerY = runtime.playerY;
}

// ---------- Overlay ----------
export function showResultOverlay(){ dom.overlay.classList.remove('hidden'); }
export function hideResultOverlay(){ dom.overlay.classList.add('hidden'); }

// ---------- Loop ----------
export function gameLoop(now){
  const dt = (now - runtime.lastTime) / 1000;
  runtime.lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(gameLoop);
}

// ---------- Public small updaters hooked by UI ----------
export function updateFTLabel(){ if (dom.ftLabel) dom.ftLabel.textContent = `FT${runtime.scoreToWin}`; }
export function syncScoreDOM(){
  const p = document.getElementById('playerScore');
  const a = document.getElementById('aiScore');
  if (p && a){ p.textContent = runtime.playerScore; a.textContent = runtime.aiScore; }
}
export function updateStatsDOM(){
  if (dom.statRally) dom.statRally.textContent = runtime.hitsThisRally;
  if (dom.statMaxRally) dom.statMaxRally.textContent = runtime.maxRally;
  if (dom.statHitsP) dom.statHitsP.textContent = runtime.playerHits;
  if (dom.statHitsAI) dom.statHitsAI.textContent = runtime.aiHits;
  if (dom.statWalls) dom.statWalls.textContent = runtime.wallBounces;
  if (dom.statSpeed) dom.statSpeed.textContent = Math.round(hypot(runtime.ballSpeedX, runtime.ballSpeedY));
}
export function updateStatsDOMTime(){ if (dom.statTime) dom.statTime.textContent = (window.fmtTime || ((t)=>`${t}`))(runtime.elapsed); } // actual fmt set in ui.js
export function updateKPIDOM(){
  const g = HISTORY.games || 0;
  const w = HISTORY.wins || 0;
  const l = HISTORY.losses || 0;
  const rc = HISTORY.rallyCount || 0;
  const rs = HISTORY.rallySum || 0;

  if (dom.kpiGames) dom.kpiGames.textContent = g;
  if (dom.kpiWins) dom.kpiWins.textContent = w;
  if (dom.kpiLosses) dom.kpiLosses.textContent = l;
  if (dom.kpiWinRate) dom.kpiWinRate.textContent = g ? `${Math.round((w/g)*100)}%` : '0%';
  if (dom.kpiAvgRally) dom.kpiAvgRally.textContent = rc ? (rs/rc).toFixed(1) : '0.0';
}

// export things used by UI
export { resizeHeatmapCanvas };