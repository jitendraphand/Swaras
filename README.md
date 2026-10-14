# Swaras

Interactive web app that associates musical tones (C3 to C4) with geometric shapes for better mental registration through visualization.

## Concept

Each tone is paired with a progressive geometric form:

| Note | Frequency (Hz) | Shape              |
|------|----------------|--------------------|
| C3   | 130.81         | Dot (Point)        |
| D3   | 146.83         | Line               |
| E3   | 164.81         | Angle              |
| F3   | 174.61         | Triangle           |
| G3   | 196.00         | Quadrilateral      |
| A3   | 220.00         | Pentagon           |
| B3   | 246.94         | Hexagon            |
| C4   | 261.63         | Septagon (Heptagon)|

## Features

- Play individual notes with Web Audio API (triangle wave with soft envelope)
- Real-time shape visualization on canvas
- Play ascending sequence
- Keyboard support (C D E F G A B H)
- **Live microphone frequency detector** — shows real-time pitch (Hz) and closest note while singing or playing
- Responsive design
- No dependencies — pure HTML/CSS/JS

## Live Mic Frequency

Click **Start Mic Frequency** to begin. The browser will ask for microphone permission. While listening:

- Displays the detected fundamental frequency in Hz
- Shows the closest note from the C3–C4 range and the cents offset
- Works best with a clear monophonic source (voice, single instrument note)

Requires a modern browser with Web Audio API and microphone support (Chrome, Firefox, Edge, Safari on recent devices). Must be served over HTTPS.

## GitHub Pages

This repository is set up for GitHub Pages.

### To publish:

1. Go to the repository **Settings** → **Pages**
2. Under **Build and deployment** → **Source**: select **Deploy from a branch**
3. Branch: `main` / `/ (root)`
4. Click **Save**
5. The site will be available at: `https://jitendraphand.github.io/Swaras/`

(It may take a minute or two for the first deployment.)

## Local Development

Just open `index.html` in a modern browser. Audio requires a user gesture to start (browser policy). Microphone access also requires a user gesture and HTTPS for production use.

## License

MIT
