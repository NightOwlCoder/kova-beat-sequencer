# Beat Sequencer

A purple-themed drum machine with synthesized sounds via Web Audio API.

![Beat Sequencer](https://img.shields.io/badge/size-<50KB-brightgreen) ![No Dependencies](https://img.shields.io/badge/dependencies-none-blue)

## Features

- **16-step grid** with 6 drum sounds (Kick, Snare, Hi-Hat, Tom, Clap, Rim)
- **Synthesized drums** - no external samples, all generated with Web Audio oscillators & noise
- **Real-time BPM control** (60-180 BPM) that changes playback speed instantly
- **Canvas waveform visualization** connected to audio analyzer
- **Pattern persistence** - Save/Load to localStorage
- **Touch-friendly** - 44px minimum touch targets, works on mobile
- **Keyboard shortcuts**:
  - `Space` - Play/Stop
  - `C` - Clear pattern
  - `R` - Randomize pattern
  - `Cmd/Ctrl+S` - Save pattern

## Files

```
beat-sequencer/
├── index.html   (3KB)  - Semantic HTML structure
├── style.css    (11KB) - Purple/neon theme with CSS variables
├── app.js       (25KB) - Audio engine, sequencer, and UI logic
└── README.md
```

## Technical Details

### Audio Synthesis

All drum sounds are generated in real-time using Web Audio API:

- **Kick**: Sine oscillator with frequency sweep (150Hz → 30Hz) + click transient
- **Snare**: Highpass filtered noise + triangle wave body
- **Hi-Hat**: Bandpass filtered high-frequency noise
- **Tom**: Sine oscillator with pitch envelope
- **Clap**: Multiple short noise bursts with bandpass filter
- **Rim**: Triangle + square oscillators for sharp click

### Timing

The sequencer uses `setTimeout` with BPM-based intervals:
- Interval = `60000 / bpm / 4` ms (for 16th notes)
- BPM changes take effect on the next step

### Browser Support

Requires Web Audio API support (all modern browsers).
AudioContext is created on first user interaction to comply with autoplay policies.

## Usage

1. Open `index.html` in a browser
2. Click/tap to dismiss the start overlay (required for audio)
3. Click cells to toggle beats on/off
4. Press Play or hit Space to start the sequence
5. Adjust BPM with the slider
6. Use Clear/Random to modify the pattern
7. Save your pattern to localStorage

## Purple/Neon Theme

CSS custom properties for easy theming:

```css
--purple-primary: #bf5af2;
--purple-dark: #9b4dca;
--bg-dark: #0d0d0f;
```

## License

MIT
