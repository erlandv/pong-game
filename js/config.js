export const ASPECT = 2;
export const PADDLE_WIDTH = 12;
export const BASE_PADDLE_HEIGHT = 80;
export const BALL_SIZE = 14;
export const PADDLE_MARGIN = 30;
export const BALL_SPEED_INIT = 360;
export const MAX_BALL_SPEED = 920;

export const PADDLE_SPEEDS = { slow: 380, normal: 520, fast: 680 };

export const DIFFICULTIES = {
  easy:   { speed: 320, error: 24, reactionDelay: 0.18, predictiveness: 0.55 },
  medium: { speed: 460, error: 14, reactionDelay: 0.12, predictiveness: 0.78 },
  hard:   { speed: 680, error: 8,  reactionDelay: 0.06, predictiveness: 0.95 },
};

export const NUM_BINS = 12;

export const DEFAULT_SETTINGS = {
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

export const DEFAULT_HISTORY = {
  games: 0, wins: 0, losses: 0,
  rallySum: 0, rallyCount: 0,
  heatPlayer: Array(NUM_BINS).fill(0),
  heatAI: Array(NUM_BINS).fill(0),
};

// ---------- General Helpers ----------
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const hypot = (x,y) => Math.sqrt(x*x + y*y);
export const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
export const isTypingTarget = (el) =>
  el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
export const preferTouchDevice = () =>
  'ontouchstart' in window || window.matchMedia('(pointer: coarse)').matches;

export function fmtTime(t){
  t = Math.max(0, Math.floor(t));
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ---------- Settings & History storage ----------
export function loadSettings(){
  try{
    const raw = localStorage.getItem('pong.settings.v1');
    if (!raw) return structuredClone(DEFAULT_SETTINGS);
    const parsed = JSON.parse(raw);
    return {
      gameplay: { ...DEFAULT_SETTINGS.gameplay, ...(parsed.gameplay||{}) },
      audio: { ...DEFAULT_SETTINGS.audio, ...(parsed.audio||{}) },
      display: { ...DEFAULT_SETTINGS.display, ...(parsed.display||{}) },
      controls: { ...DEFAULT_SETTINGS.controls, ...(parsed.controls||{}) },
    };
  }catch{ return structuredClone(DEFAULT_SETTINGS); }
}
export function saveSettings(SETTINGS){
  localStorage.setItem('pong.settings.v1', JSON.stringify(SETTINGS));
}

export function loadHistory(){
  try{
    const raw = localStorage.getItem('pong.history.v1');
    if (!raw) return structuredClone(DEFAULT_HISTORY);
    const p = JSON.parse(raw);
    return {
      games: p.games || 0,
      wins: p.wins || 0,
      losses: p.losses || 0,
      rallySum: p.rallySum || 0,
      rallyCount: p.rallyCount || 0,
      heatPlayer: Array.isArray(p.heatPlayer) && p.heatPlayer.length===NUM_BINS ? p.heatPlayer.slice() : Array(NUM_BINS).fill(0),
      heatAI: Array.isArray(p.heatAI) && p.heatAI.length===NUM_BINS ? p.heatAI.slice() : Array(NUM_BINS).fill(0),
    };
  }catch{ return structuredClone(DEFAULT_HISTORY); }
}
export function saveHistory(HISTORY){
  localStorage.setItem('pong.history.v1', JSON.stringify(HISTORY));
}

// ---------- Theme & Display ----------
export function applyThemeMode(mode, htmlRoot=document.documentElement, themeToggle=document.getElementById('themeToggle')){
  const eff = (mode === 'system')
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : mode;
  htmlRoot.setAttribute('data-theme', eff);

  const isDark = eff === 'dark';
  if (themeToggle) themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', isDark ? '#0f172a' : '#f8fafc');
}

export function onSystemThemeChange(cb){
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  mql.addEventListener('change', cb);
}