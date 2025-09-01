import { SETTINGS, runtime } from './state.js';
import {
  applyDifficulty, applyKeyboardSpeed, applyDisplayTrail,
  centerEntities, resetBall, resizeCanvas, gameLoop, updateKPIDOM, drawHeatmaps,
  updateFTLabel, updateStatsDOM, updateStatsDOMTime, syncScoreDOM
} from './engine.js';
import { initThemeFromSettings, recomputeControlPermissions } from './ui.js';

(function boot(){
  initThemeFromSettings();
  runtime.hiDPIEnabled = !!SETTINGS.display.hiDPI;
  applyDisplayTrail();
  resizeCanvas();
  applyDifficulty();
  applyKeyboardSpeed();
  runtime.scoreToWin = SETTINGS.gameplay.scoreToWin;
  centerEntities();
  resetBall(true);
  updateFTLabel();
  recomputeControlPermissions(true);
  updateStatsDOM(); updateStatsDOMTime();
  updateKPIDOM();
  drawHeatmaps();
  syncScoreDOM();
  requestAnimationFrame(gameLoop);
})();