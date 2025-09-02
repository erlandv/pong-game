# Pong Game

A classic, web-based PONG game built with plain HTML, CSS, and JavaScript. Play as the left paddle against an AI opponent with multiple difficulty levels, customizable settings, sound effects, and detailed gameplay stats.

## Features

- **Game flow:** Start, Pause/Resume, and Reset controls with on-screen buttons and keyboard shortcuts.
- **Score rules:** “First to” target (5, 10, or 15 points), shown on the scoreboard.
- **Difficulty levels:** Easy, Medium, and Hard for the basic AI.
- **Paddle speed:** Choose Slow, Normal, or Fast.
- **Ball speed modes:** Static or Gradual Acceleration with configurable "acceleration per hit".
- **Spin mechanics:** Optional spin when the ball hits the paddle, with adjustable spin intensity.
- **Assist mode:** Off (Classic), Light Assist, or Strong Assist to help with ball control.

### Controls

- **Auto-detect:** Mouse, Keyboard, or Touch.
- **Keyboard:**  
  - `Enter`: Start  
  - `P`: Pause/Resume  
  - `R`: Reset  
  - `W/S` or `Arrow Up/Down`: Move paddle
- **Option to invert the vertical axis.**
- **Mouse:** Move vertically to control the paddle (if selected)
- **Touch:** Drag vertically on mobile (if selected)

### Audio

- Toggle sound effects with a volume slider.
- Includes paddle hits, wall bounces, scoring, and match alerts.

### Display

- **Theme preference:** System, Light, or Dark.
- **High-DPI rendering toggle.**
- **Ball trail:** Adjustable intensity (Off/Low/Medium/High).

### Telemetry (in-match)

- Rally count, ball speed (px/s), player/AI hit counts, wall bounces, and elapsed time.

### Advanced stats (persistent)

- Games played, Wins, Losses, Win Rate, Average Rally.
- Player and AI contact heatmaps.
- Clear/Reset history actions.

## Settings

All settings are available in the “Game Settings” panel with tabs:

- **Gameplay:** Difficulty, Winning Score, Paddle Speed, Ball Speed Mode, Acceleration per Hit, Spin Effect & Spin Intensity, Assist Mode.
- **Controls:** Auto-Detect input method, Invert Vertical Axis, and keyboard reference.
- **Audio:** Sound Effects On/Off and Volume.
- **Display:** Theme (System/Light/Dark), High-DPI Rendering, Ball Trail Intensity, and Reset to Defaults.

## Persistence

The game remembers your preferences and advanced stats in your browser so your settings and history survive page reloads.  
You can clear per-match stats or reset the full history from the UI.

## Credits

Classic PONG (Atari, 1972) as inspiration.

## License
  
Licensed under the [MIT LICENSE](LICENSE).