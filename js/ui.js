import {
  clamp, fmtTime, applyThemeMode, onSystemThemeChange
} from './config.js';
import { SETTINGS, HISTORY, dom, runtime } from './state.js';
import {
  applyAssistAndHeights, applyDifficulty, applyDisplayTrail, applyKeyboardSpeed,
  centerEntities, drawHeatmaps, gameLoop, fullReset, resetBall, resizeCanvas,
  showResultOverlay, hideResultOverlay, startResumeCountdown,
  syncScoreDOM, updateFTLabel, updateKPIDOM, updateStatsDOM, updateStatsDOMTime
} from './engine.js';
import { saveSettings, saveHistory, DEFAULT_SETTINGS } from './config.js';

// expose fmtTime to engine for its simple bridge
window.fmtTime = fmtTime;

// ---------- Toast ----------
let toastTimer = null;
export function showToast(msg){
  if (!dom.toastEl) return;
  dom.toastEl.textContent = msg;
  dom.toastEl.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  const duration = preferTouchDevice() ? 2000 : 2400;
  toastTimer = setTimeout(() => { dom.toastEl.classList.remove('show'); }, duration);
}
function preferTouchDevice(){ return 'ontouchstart' in window || window.matchMedia('(pointer: coarse)').matches; }

// ---------- Audio ----------
export function ensureAudio(){
  if (!SETTINGS.audio.sfx) return;
  if (!runtime.audioCtx){
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    runtime.audioCtx = new AC();
    runtime.masterGain = runtime.audioCtx.createGain();
    runtime.masterGain.gain.value = clamp(SETTINGS.audio.volume, 0, 1);
    runtime.masterGain.connect(runtime.audioCtx.destination);
  } else if (runtime.audioCtx.state === 'suspended'){
    runtime.audioCtx.resume();
  }
}
function setVolume(v){
  if (!runtime.masterGain) return;
  runtime.masterGain.gain.value = clamp(v, 0, 1);
}
function beep({freq=440, dur=0.08, type='sine', attack=0.002, release=0.08, gain=0.8, detune=0} = {}){
  if (!SETTINGS.audio.sfx) return;
  ensureAudio();
  if (!runtime.audioCtx || !runtime.masterGain) return;

  const t0 = runtime.audioCtx.currentTime;
  const osc = runtime.audioCtx.createOscillator();
  const g = runtime.audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  g.gain.value = 0.0001;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + release);

  osc.connect(g); g.connect(runtime.masterGain);
  osc.start(t0);
  osc.stop(t0 + Math.max(dur, attack + release + 0.01));
}
export function playSfx(kind){
  if (!SETTINGS.audio.sfx) return;
  switch(kind){
    case 'paddle': { const f = 360 + Math.random()*120; beep({freq:f, type:'square', attack:0.003, release:0.09, gain:0.4}); break; }
    case 'wall': { const f = 220 + Math.random()*60; beep({freq:f, type:'triangle', attack:0.002, release:0.06, gain:0.35}); break; }
    case 'score': { beep({freq:440, type:'sine', attack:0.004, release:0.1, gain:0.5}); setTimeout(()=>beep({freq:330, type:'sine', attack:0.004, release:0.12, gain:0.5}), 80); break; }
    case 'win': { beep({freq:523.25, type:'triangle', attack:0.005, release:0.12, gain:0.55}); setTimeout(()=>beep({freq:659.25, type:'triangle', attack:0.005, release:0.12, gain:0.55}), 90); setTimeout(()=>beep({freq:783.99, type:'triangle', attack:0.005, release:0.16, gain:0.6}), 180); break; }
    case 'lose': { beep({freq:220, type:'sawtooth', attack:0.006, release:0.18, gain:0.5}); setTimeout(()=>beep({freq:174.61, type:'sawtooth', attack:0.006, release:0.22, gain:0.45}), 110); break; }
  }
}
export function vibrate(pattern){ try{ if (navigator.vibrate && preferTouchDevice()) navigator.vibrate(pattern); }catch{} }

// ---------- Controls / Input ----------
let keyboardToastShown = false;

export function recomputeControlPermissions(showToastOnChange = false){
  const scheme = SETTINGS.controls.scheme;
  runtime.allowMouse = runtime.allowKeyboard = runtime.allowTouch = false;
  if (scheme === 'mouse'){ runtime.allowMouse = true; }
  else if (scheme === 'keyboard'){ runtime.allowKeyboard = true; }
  else if (scheme === 'touch'){ runtime.allowTouch = true; }
  else { if (preferTouchDevice()){ runtime.allowTouch = true; } else { runtime.allowMouse = true; runtime.allowKeyboard = true; } }

  if (showToastOnChange){
    if (runtime.allowKeyboard && runtime.allowMouse) showToast('Control: Auto (Keyboard + Mouse)');
    else if (runtime.allowTouch) showToast('Control: Touch (drag to move paddle)');
    else if (runtime.allowKeyboard) showToast('Control: Keyboard active (W/S or ↑/↓)');
    else if (runtime.allowMouse) showToast('Control: Mouse active');
  }
}

export function updateControls(){
  dom.startBtn.disabled = (runtime.gameRunning && !runtime.paused && runtime.resumeCountdown === 0) || runtime.gameOver;
  dom.startBtn.textContent = (!runtime.gameRunning || runtime.paused || runtime.resumeCountdown > 0 || runtime.gameOver) ? 'Start Game' : 'Running...';
  dom.pauseBtn.textContent = (runtime.paused && runtime.resumeCountdown === 0) ? 'Resume' : 'Pause';
  dom.pauseBtn.disabled = !runtime.gameRunning || runtime.gameOver || runtime.resumeCountdown > 0;
}

export function autoPauseIfRunning(){
  if (runtime.gameRunning && !runtime.paused && !runtime.gameOver && runtime.resumeCountdown === 0){
    runtime.paused = true;
    updateControls();
  }
}
window.addEventListener('blur', autoPauseIfRunning);
document.addEventListener('visibilitychange', () => { if (document.hidden) autoPauseIfRunning(); });

// mouse
dom.canvas.addEventListener('mousemove', (evt) => {
  if (!runtime.allowMouse) return;
  const rect = dom.canvas.getBoundingClientRect();
  let y = evt.clientY - rect.top;
  if (runtime.invertY) y = runtime.cssH - y;
  runtime.playerY = clamp(y - runtime.PLAYER_PADDLE_HEIGHT / 2, 0, runtime.cssH - runtime.PLAYER_PADDLE_HEIGHT);
});

// touch (pointer)
dom.canvas.addEventListener('pointerdown', (e) => {
  if (!runtime.allowTouch) return;
  if (e.pointerType !== 'touch' && preferTouchDevice()) return;
  runtime.touchActive = true;
  dom.canvas.setPointerCapture(e.pointerId);
  ensureAudio();
});
dom.canvas.addEventListener('pointermove', (e) => {
  if (!runtime.allowTouch || !runtime.touchActive) return;
  const rect = dom.canvas.getBoundingClientRect();
  let y = e.clientY - rect.top;
  if (runtime.invertY) y = runtime.cssH - y;
  runtime.playerY = clamp(y - runtime.PLAYER_PADDLE_HEIGHT / 2, 0, runtime.cssH - runtime.PLAYER_PADDLE_HEIGHT);
});
dom.canvas.addEventListener('pointerup', () => { if (!runtime.allowTouch) return; runtime.touchActive = false; });
dom.canvas.addEventListener('pointercancel', () => { if (!runtime.allowTouch) return; runtime.touchActive = false; });

// keyboard
document.addEventListener('keydown', (e) => {
  if (!dom.settingsModal.classList.contains('hidden') || e.target && (e.target.tagName==='INPUT'||e.target.tagName==='SELECT'||e.target.tagName==='TEXTAREA'||e.target.isContentEditable)) return;

  ensureAudio();

  if (runtime.allowKeyboard){
    if (e.code === 'ArrowUp' || e.code === 'KeyW'){ runtime.pressed.up = true; e.preventDefault(); if (!keyboardToastShown){ showToast('Keyboard active: W/S or ↑/↓ · Enter=Start · P=Pause · R=Reset'); keyboardToastShown = true; } }
    if (e.code === 'ArrowDown' || e.code === 'KeyS'){ runtime.pressed.down = true; e.preventDefault(); if (!keyboardToastShown){ showToast('Keyboard active: W/S or ↑/↓ · Enter=Start · P=Pause · R=Reset'); keyboardToastShown = true; } }
  }

  if (e.code === 'Enter'){
    e.preventDefault();
    if (runtime.gameOver) { fullReset(); }
    if (!runtime.gameRunning){
      if (runtime.ballSpeedX === 0 && runtime.ballSpeedY === 0) resetBall(false) || null; // serveBall() from resetBall(false)
      runtime.gameRunning = true;
      startResumeCountdown(3);
      if (dom.hint) dom.hint.style.opacity = 0;
      hideResultOverlay();
      updateControls();
    } else if (runtime.paused){
      startResumeCountdown(3);
      updateControls();
    }
  } else if (e.code === 'KeyP'){
    e.preventDefault();
    if (!runtime.gameRunning || runtime.gameOver) return;
    if (!runtime.paused) runtime.paused = true; else startResumeCountdown(3);
    updateControls();
  } else if (e.code === 'KeyR'){
    e.preventDefault();
    fullReset();
  }
});
document.addEventListener('keyup', (e) => {
  if (!runtime.allowKeyboard) return;
  if (e.code === 'ArrowUp' || e.code === 'KeyW') runtime.pressed.up = false;
  if (e.code === 'ArrowDown' || e.code === 'KeyS') runtime.pressed.down = false;
});

// buttons
dom.startBtn.addEventListener('click', () => {
  ensureAudio();
  if (runtime.gameOver) { fullReset(); }
  if (!runtime.gameRunning){
    if (runtime.ballSpeedX === 0 && runtime.ballSpeedY === 0) resetBall(false);
    runtime.gameRunning = true;
    startResumeCountdown(3);
    if (dom.hint) dom.hint.style.opacity = 0;
  } else if (runtime.paused){
    startResumeCountdown(3);
  }
  hideResultOverlay();
  updateControls();
});

dom.pauseBtn.addEventListener('click', () => {
  if (!runtime.gameRunning || runtime.gameOver) return;
  if (!runtime.paused) runtime.paused = true; else startResumeCountdown(3);
  updateControls();
});

dom.resetBtn.addEventListener('click', fullReset);

dom.clearStatsBtn.addEventListener('click', () => {
  runtime.hitsThisRally = 0; runtime.maxRally = 0; runtime.playerHits = 0; runtime.aiHits = 0;
  runtime.wallBounces = 0; runtime.topBallSpeed = 0; runtime.elapsed = 0;
  updateStatsDOM(); updateStatsDOMTime();
  showToast('Stats cleared');
});

dom.resetHistoryBtn.addEventListener('click', () => {
  const ok = window.confirm('Reset all-time history (games, win rate, avg rally, heatmap)?');
  if (!ok) return;
  HISTORY.games = 0; HISTORY.wins = 0; HISTORY.losses = 0;
  HISTORY.rallySum = 0; HISTORY.rallyCount = 0;
  HISTORY.heatPlayer = Array.from({length: 12}, () => 0);
  HISTORY.heatAI = Array.from({length: 12}, () => 0);
  saveHistory(HISTORY);
  updateKPIDOM();
  drawHeatmaps();
  showToast('History reset');
});

// ---------- Settings Modal ----------
export function openSettings(initialTab='gameplay'){
  if (runtime.gameRunning && !runtime.paused && runtime.resumeCountdown === 0){ runtime.paused = true; updateControls(); }

  dom.tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === initialTab));
  Object.entries(dom.panels).forEach(([k,el]) => el.classList.toggle('active', k===initialTab));

  dom.optDifficulty.value = SETTINGS.gameplay.difficulty;
  dom.optScore.value = String(SETTINGS.gameplay.scoreToWin);
  dom.optPaddleSpeed.value = SETTINGS.gameplay.paddleSpeed;
  dom.optBallCurve.value = SETTINGS.gameplay.ballCurve;
  dom.optBallAccel.value = String(SETTINGS.gameplay.ballAccel);
  dom.optSpinEnabled.checked = !!SETTINGS.gameplay.spinEnabled;
  dom.optSpinPower.value = String(SETTINGS.gameplay.spinPower);
  dom.optAssist.value = SETTINGS.gameplay.assist;

  dom.ctrlSchemeRadios.forEach(r => r.checked = (r.value === SETTINGS.controls.scheme));
  dom.optInvertY.checked = !!SETTINGS.controls.invertY;

  dom.optSfx.checked = !!SETTINGS.audio.sfx;
  dom.optVolume.value = String(SETTINGS.audio.volume);
  dom.themeModeRadios.forEach(r => r.checked = (r.value === SETTINGS.display.themeMode));
  dom.optHiDPI.checked = !!SETTINGS.display.hiDPI;
  dom.optTrail.value = SETTINGS.display.trail || 'medium';

  document.getElementById('optBallAccelValue').textContent = parseFloat(dom.optBallAccel.value).toFixed(2);
  document.getElementById('optSpinPowerValue').textContent = parseFloat(dom.optSpinPower.value).toFixed(2);
  document.getElementById('optVolumeValue').textContent = Math.round(parseFloat(dom.optVolume.value) * 100) + '%';

  dom.gameplayLockHint.style.display = runtime.gameRunning && !runtime.gameOver ? 'block' : 'none';
  dom.settingsModal.classList.remove('hidden');

  dom.optBallAccel.addEventListener('input', () => {
    document.getElementById('optBallAccelValue').textContent = parseFloat(dom.optBallAccel.value).toFixed(2);
  });
  dom.optSpinPower.addEventListener('input', () => {
    document.getElementById('optSpinPowerValue').textContent = parseFloat(dom.optSpinPower.value).toFixed(2);
  });
  dom.optVolume.addEventListener('input', () => {
    document.getElementById('optVolumeValue').textContent = Math.round(parseFloat(dom.optVolume.value) * 100) + '%';
  });
}
export function closeSettings(){ dom.settingsModal.classList.add('hidden'); }

export function gatherSettingsFromUI(){
  const next = structuredClone(SETTINGS);

  next.gameplay.difficulty = dom.optDifficulty.value;
  next.gameplay.scoreToWin = parseInt(dom.optScore.value, 10) || 5;
  next.gameplay.paddleSpeed = dom.optPaddleSpeed.value;
  next.gameplay.ballCurve = dom.optBallCurve.value;
  next.gameplay.ballAccel = Math.max(0, Math.min(0.15, parseFloat(dom.optBallAccel.value) || 0));
  next.gameplay.spinEnabled = !!dom.optSpinEnabled.checked;
  next.gameplay.spinPower = Math.max(0, Math.min(1, parseFloat(dom.optSpinPower.value) || 0));
  next.gameplay.assist = dom.optAssist.value;

  const cs = dom.ctrlSchemeRadios.find(r => r.checked)?.value || 'auto';
  next.controls.scheme = cs;
  next.controls.invertY = !!dom.optInvertY.checked;

  next.audio.sfx = !!dom.optSfx.checked;
  next.audio.volume = parseFloat(dom.optVolume.value);

  const selTheme = dom.themeModeRadios.find(r => r.checked)?.value || 'system';
  next.display.themeMode = selTheme;
  next.display.hiDPI = !!dom.optHiDPI.checked;
  next.display.trail = dom.optTrail.value || 'medium';
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

export function applySettings(next, {confirmRestartIfNeeded=true} = {}){
  const needRestart = gameplayChanged(next, SETTINGS);
  const controlsDiff = controlsChanged(next, SETTINGS);
  const audioDiff = audioChanged(next, SETTINGS);
  const displayDiff = displayChanged(next, SETTINGS);

  // replace contents of SETTINGS
  Object.assign(SETTINGS.gameplay, next.gameplay);
  Object.assign(SETTINGS.controls, next.controls);
  Object.assign(SETTINGS.audio, next.audio);
  Object.assign(SETTINGS.display, next.display);
  saveSettings(SETTINGS);

  if (displayDiff){
    applyThemeMode(SETTINGS.display.themeMode, dom.htmlRoot, dom.themeToggle);
    const prevHi = runtime.hiDPIEnabled;
    runtime.hiDPIEnabled = !!SETTINGS.display.hiDPI;
    applyDisplayTrail();
    if (prevHi !== runtime.hiDPIEnabled) resizeCanvas(); else drawHeatmaps();
  }

  if (audioDiff){
    if (!SETTINGS.audio.sfx && runtime.audioCtx && runtime.audioCtx.state !== 'closed'){
      // do nothing (mute)
    } else {
      ensureAudio();
      setVolume(SETTINGS.audio.volume);
    }
  }

  // gameplay
  if (needRestart && runtime.gameRunning && !runtime.gameOver && confirmRestartIfNeeded){
    const ok = window.confirm('Changing gameplay settings will restart the match. Continue?');
    if (!ok){ openSettings('gameplay'); return; }
    runtime.aiCfg = null; // will be set below
    runtime.scoreToWin = SETTINGS.gameplay.scoreToWin;
    applyKeyboardSpeed();
    applyDifficulty();
    updateFTLabel();
    fullReset();
  } else {
    runtime.aiCfg = null;
    runtime.scoreToWin = SETTINGS.gameplay.scoreToWin;
    applyKeyboardSpeed();
    applyDifficulty();
    updateFTLabel();
  }

  if (controlsDiff){
    runtime.invertY = !!SETTINGS.controls.invertY;
    recomputeControlPermissions(true);
  }
}

// settings modal wires
dom.settingsBtn.addEventListener('click', () => openSettings('gameplay'));
dom.settingsClose.addEventListener('click', closeSettings);
dom.settingsCancel.addEventListener('click', closeSettings);
dom.settingsBackdrop.addEventListener('click', closeSettings);
dom.settingsApply.addEventListener('click', () => {
  const next = gatherSettingsFromUI();
  applySettings(next, {confirmRestartIfNeeded:true});
  closeSettings();
});
dom.settingsDefaults.addEventListener('click', () => {
  applySettings(structuredClone(DEFAULT_SETTINGS), {confirmRestartIfNeeded:true});
  closeSettings();
});

dom.tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    dom.tabs.forEach(t => t.classList.toggle('active', t === tab));
    Object.entries(dom.panels).forEach(([key, el]) => el.classList.toggle('active', tab.dataset.tab === key));
  });
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !dom.settingsModal.classList.contains('hidden')) closeSettings();
});

// Theme init & toggle
export function initThemeFromSettings(){
  applyThemeMode(SETTINGS.display.themeMode, dom.htmlRoot, dom.themeToggle);
  onSystemThemeChange(() => {
    if (SETTINGS.display.themeMode === 'system') applyThemeMode('system', dom.htmlRoot, dom.themeToggle);
  });
}
dom.themeToggle?.addEventListener('click', () => {
  const currEff = dom.htmlRoot.getAttribute('data-theme');
  const next = (currEff === 'dark') ? 'light' : 'dark';
  SETTINGS.display.themeMode = next;
  saveSettings(SETTINGS);
  applyThemeMode(SETTINGS.display.themeMode, dom.htmlRoot, dom.themeToggle);
});