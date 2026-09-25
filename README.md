# Interactive Number Moods

Interactive number and letter grids with subtle moods, drifting motion, and a soft blue CRT glow. Each version is a standalone HTML file with no dependencies or network connection required.

## Try it

Open [numbers.html](numbers.html) for digits 0–9, [letters.html](letters.html) for uppercase A–Z, or [raidės.html](raidės.html) for the 32 uppercase Lithuanian letters in a modern browser. All three versions have the same features and controls. Use a mouse or trackpad for hover effects; touch supports tapping and dragging to select characters.

For a calming, screensaver-like display, double-click the outer margins to enter fullscreen and let the characters drift.

Random letters may unintentionally form offensive or inappropriate words. Use with caution, especially on shared or public displays.

## Features

- **Terminal aesthetic:** pale-blue characters, a dark navy background, scanlines, and a custom cursor.
- **Adaptive density:** rows and columns adjust to the window while character size and spacing stay consistent.
- **Regional moods:** calm, curious, and restless areas slowly wander and vary in strength, easing toward random targets over 45–75 seconds. Their motion and hover responses blend smoothly; selected characters keep their current mood.
- **Nearby hover reactions:** characters shift, enlarge, and brighten as the pointer approaches.
- **Soft selection:** irregular pools of light highlight selected characters, with smooth fades and drift paused in place.
- **Gentle refresh:** automatic updates change one character at a time at irregular intervals, preserve selected characters and avoid the pointer's nearby area. Pressing **R** clears the current selection and refreshes the entire grid in a wave. Characters selected after the wave starts are protected from pending changes.
- **Easter eggs:** Look closely—you may find a few surprises.
- **Fullscreen:** toggle from the page margins in browsers that support fullscreen.
- **Reduced-motion support:** respects the browser preference by disabling drift, movement transitions, and refresh-wave staggering.

## Controls

| Input | Action |
| --- | --- |
| Move the pointer | Influence nearby characters |
| Click or tap a character | Toggle its selection and clear other selections |
| Drag | Select a group of characters |
| Shift + click | Toggle a character without clearing other selections |
| Shift + drag | Add characters to the selection |
| Double-click the outer margins | Toggle fullscreen |
| Escape | Exit fullscreen; otherwise clear the selection |
| R | Clear the selection and refresh the entire grid in a wave |

## Customization

Each HTML file includes its own styles, behavior, and embedded SVG cursor. Keep shared behavior changes in sync across all three files; the `symbols` constant selects the character set. Adjust `moodRegions` for motion and hover behavior, `.number` styles for appearance, and `scheduleAmbientRefresh()` for refresh timing.

## Tests

With Node.js installed, run `node --test tests/*.test.cjs` for selection, character-variant, and mood-transition regression checks. Browser testing is still needed for rendering and fullscreen behavior.

## Current limitations

Reloading generates a fresh field; selections are not saved. Resizing can rearrange surviving characters and discard cells and selections that no longer fit.

## Inspiration

Inspired by the retro computer-screen atmosphere of *Severance*. An independent, unofficial project, not affiliated with the show.

## Author and AI assistance

Created and directed by Kazimieras Badokas, with GPT-6 Astra contributing as an AI assistant.

## License

[MIT License](LICENSE)
