# Teleprompter PWA

A simple, functional teleprompter app that works on Android (and any modern browser).

## Features

- Write or paste scripts with save/load support
- Full-screen scrolling text display
- Adjustable scroll speed and font size
- Mirror mode for teleprompter mirrors
- Optional countdown before starting
- RTL mode for Arabic and other right-to-left scripts
- Screen stays on during prompting (Wake Lock API)
- Works offline after first visit
- Installable on Android home screen
- Live RTL preview while editing to verify mixed Arabic/English flow before starting teleprompter

## Install on Android

1. Open the app URL in Chrome
2. Tap the browser menu (three dots)
3. Tap **"Add to Home Screen"** or **"Install app"**
4. The app icon appears on your home screen

## Run Locally

```bash
npx serve .
```

Then open `http://localhost:3000` in your browser.

## How to Use

1. Type or paste your script in the editor
2. Adjust font size and scroll speed
3. Toggle mirror mode or RTL mode for Arabic script and verify preview directly in the editor
4. Tap **Start Prompting**
5. Tap anywhere to play/pause
6. Use the on-screen controls for speed and font size adjustments
