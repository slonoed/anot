# OpenAI Realtime Voice App

A minimal web application that uses OpenAI's Realtime API to have voice conversations with AI.

## Features

- Voice input via microphone
- Real-time AI voice responses
- Simple start/stop controls
- WebSocket-based communication with OpenAI

## Setup

1. Install dependencies:
```bash
npm install
```

2. Get your OpenAI API key from [OpenAI Platform](https://platform.openai.com/api-keys)

3. (Optional) Create a `.env` file:
```bash
cp .env.example .env
```
Then add your API key to `.env`:
```
VITE_OPENAI_API_KEY=your_api_key_here
```

Alternatively, you can enter the API key directly in the browser UI.

## Usage

1. Start the development server:
```bash
npm run dev
```

2. Open the app in your browser (usually http://localhost:5173)

3. Enter your OpenAI API key if you haven't set it in `.env`

4. Click "Start Talking" to begin the conversation

5. Allow microphone access when prompted

6. Speak into your microphone and hear the AI respond

7. Click "Stop" to end the conversation

## How It Works

- Uses WebSocket to connect to OpenAI's Realtime API
- Captures audio from your microphone using Web Audio API
- Converts audio to PCM16 format and streams it to OpenAI
- Receives audio responses from OpenAI and plays them back
- Uses server-side voice activity detection (VAD) for turn-taking

## Notes

- Your API key is only used in the browser and never sent anywhere else
- Requires a modern browser with microphone support
- Make sure to allow microphone access when prompted
