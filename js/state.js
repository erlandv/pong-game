import {
  DEFAULT_SETTINGS, loadSettings, loadHistory, NUM_BINS
} from './config.js';

export const dom = {
  canvas: document.getElementById('pong'),
  ctx: document.getElementById('pong')?.getContext('2d'),

  startBtn: document.getElementById('startBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  resetBtn: document.getElementById('resetBtn'),
  ftLabel: document.getElementById('ftLabel'),
  hint: document.getElementById('hint'),

  themeToggle: document.getElementById('themeToggle'),
  settingsBtn: document.getElementById('settingsBtn'),
  htmlRoot: document.documentElement,

  overlay: document.getElementById('resultOverlay'),
  playerResultEl: document.getElementById('playerResult'),
  aiResultEl: document.getElementById('aiResult'),

  statRally: document.getElementById('statRally'),
  statMaxRally: document.getElementById('statMaxRally'),
  statSpeed: document.getElementById('statSpeed'),
  statHitsP: document.getElementById('statHitsP'),
  statHitsAI: document.getElementById('statHitsAI'),
  statWalls: document.getElementById('statWalls'),
  statTime: document.getElementById('statTime'),
  clearStatsBtn: document.getElementById('clearStats'),

  kpiGames: document.getElementById('kpiGames'),
  kpiWins: document.getElementById('kpiWins'),
  kpiLosses: document.getElementById('kpiLosses'),
  kpiWinRate: document.getElementById('kpiWinRate'),
  kpiAvgRally: document.getElementById('kpiAvgRally'),
  resetHistoryBtn: document.getElementById('resetHistory'),

  heatCanvasP: document.getElementById('heatPlayer'),
  heatCanvasA: document.getElementById('heatAI'),

  settingsModal: document.getElementById('settingsModal'),
  settingsBackdrop: document.getElementById('settingsBackdrop'),
  settingsClose: document.getElementById('settingsClose'),
  settingsCancel: document.getElementById('settingsCancel'),
  settingsApply: document.getElementById('settingsApply'),
  settingsDefaults: document.getElementById('settingsDefaults'),
  tabs: Array.from(document.querySelectorAll('.tab')),
  panels: {
    gameplay: document.getElementById('panel-gameplay'),
    controls: document.getElementById('panel-controls'),
    audio: document.getElementById('panel-audio'),
    display: document.getElementById('panel-display'),
  },
  gameplayLockHint: document.getElementById('gameplayLockHint'),

  optDifficulty: document.getElementById('optDifficulty'),
  optScore: document.getElementById('optScore'),
  optPaddleSpeed: document.getElementById('optPaddleSpeed'),
  optBallCurve: document.getElementById('optBallCurve'),
  optBallAccel: document.getElementById('optBallAccel'),
  optSpinEnabled: document.getElementById('optSpinEnabled'),
  optSpinPower: document.getElementById('optSpinPower'),
  optAssist: document.getElementById('optAssist'),

  ctrlSchemeRadios: Array.from(document.querySelectorAll('input[name="ctrlScheme"]')),
  optInvertY: document.getElementById('optInvertY'),

  optSfx: document.getElementById('optSfx'),
  optVolume: document.getElementById('optVolume'),

  themeModeRadios: Array.from(document.querySelectorAll('input[name="themeMode"]')),
  optHiDPI: document.getElementById('optHiDPI'),
  optTrail: document.getElementById('optTrail'),
  toastEl: document.getElementById('toast'),
};

export const SETTINGS = loadSettings();
export const HISTORY = loadHistory();

export const runtime = {
  // canvas metrics
  hiDPIEnabled: true,
  dpr: window.devicePixelRatio || 1,
  cssW: 0,
  cssH: 0,

  // scoreboard / game flags
  scoreToWin: SETTINGS.gameplay.scoreToWin,
  paused: false,
  gameRunning: false,
  gameOver: false,
  resumeCountdown: 0,

  // inputs
  allowMouse: false,
  allowKeyboard: false,
  allowTouch: false,
  invertY: !!SETTINGS.controls.invertY,
  pressed: { up: false, down: false },
  touchActive: false,

  // trail
  TRAIL_LEN: 14,
  TRAIL_ALPHA_BASE: 0.04,
  TRAIL_ALPHA_GAIN: 0.18,

  // stats
  hitsThisRally: 0,
  maxRally: 0,
  playerHits: 0,
  aiHits: 0,
  wallBounces: 0,
  topBallSpeed: 0,
  elapsed: 0,

  // audio
  audioCtx: null,
  masterGain: null,

  // AI config (filled at boot)
  aiCfg: null,
  aiSpeed: 0,
  aiError: 0,
  aiReactionDelay: 0,
  aiPredictiveness: 0,
  aiTargetY: 0,
  aiRecalcCooldown: 0,

  // player/ball state
  PLAYER_PADDLE_HEIGHT: 80,
  AI_PADDLE_HEIGHT: 80,
  KEYBOARD_PADDLE_SPEED: 520,

  playerY: 0,
  aiY: 0,
  prevPlayerY: 0,

  ballX: 0,
  ballY: 0,
  ballSpeedX: 0,
  ballSpeedY: 0,
  playerScore: 0,
  aiScore: 0,

  ballTrail: [],

  lastTime: performance.now(),
};

export function resetHistoryArraysIfNeeded(){
  if (!Array.isArray(HISTORY.heatPlayer) || HISTORY.heatPlayer.length !== NUM_BINS) HISTORY.heatPlayer = Array(NUM_BINS).fill(0);
  if (!Array.isArray(HISTORY.heatAI) || HISTORY.heatAI.length !== NUM_BINS) HISTORY.heatAI = Array(NUM_BINS).fill(0);
}
resetHistoryArraysIfNeeded();