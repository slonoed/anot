import './style.css';

// Configuration
const MINI_MODEL = 'gpt-4o-mini-realtime-preview';
const BIG_MODEL = 'gpt-4o-realtime-preview';

const SYSTEM_INSTRUCTIONS = `You are a helpful assistant.
You have access to a note. You can read and update it. The note contains all required context.
When talking to users always keep the note as context.
When user talk to you, read the note and use information from it to answer.
All user questions and asks are realted to the note. When user ask information check if it's in the note.
If user asks to write or remember something, update the note.
Use markdown to make the note structured. Create checklists and sections when it make sense.

After you done changing note and explaning you changes do not ask what you can do.
DO NOT ASK THESE after change:
- how else I can help
- let me know if you want to add something else
`;

// DOM Elements
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="container">
    <div class="main-view">
      <div class="status">Status: <span id="status">Disconnected</span></div>
      <div class="note-section">
        <label for="note-textarea">Notes</label>
        <textarea id="note-textarea" placeholder="Write your notes here..."></textarea>
        <small class="auto-save-indicator">Auto-saved</small>
      </div>
      <div class="controls">
        <button id="settings-btn" type="button">Settings</button>
        <button id="stop-btn" type="button" disabled>Stop</button>
        <button id="start-btn" type="button">Start Talking</button>
      </div>
    </div>
    <div class="settings-view" style="display: none;">
      <div class="settings-header">
        <h2>Settings</h2>
        <button id="close-settings-btn" type="button">Close</button>
      </div>
      <div class="api-key-section">
        <label for="api-key">API Key</label>
        <input type="password" id="api-key" placeholder="Enter OpenAI API Key" />
        <small>Your API key is only used in the browser and never sent anywhere else</small>
      </div>
      <div class="model-section">
        <label for="model-select">Model</label>
        <select id="model-select">
          <option value="${MINI_MODEL}">GPT-4o Mini (Faster, Cheaper)</option>
          <option value="${BIG_MODEL}">GPT-4o (Better Quality)</option>
        </select>
      </div>
      <div class="prompt-section">
        <div class="prompt-header">
          <label for="prompt-display">System Prompt</label>
          <button id="reset-prompt-btn" type="button">Reset</button>
        </div>
        <textarea id="prompt-display"></textarea>
      </div>
    </div>
  </div>
`;

// State
let ws: WebSocket | null = null;
let mediaStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let audioQueue: AudioBuffer[] = [];
let isPlaying = false;

// DOM references
const startBtn = document.querySelector<HTMLButtonElement>('#start-btn')!;
const stopBtn = document.querySelector<HTMLButtonElement>('#stop-btn')!;
const settingsBtn = document.querySelector<HTMLButtonElement>('#settings-btn')!;
const closeSettingsBtn = document.querySelector<HTMLButtonElement>('#close-settings-btn')!;
const resetPromptBtn = document.querySelector<HTMLButtonElement>('#reset-prompt-btn')!;
const statusEl = document.querySelector<HTMLSpanElement>('#status')!;
const apiKeyInput = document.querySelector<HTMLInputElement>('#api-key')!;
const modelSelect = document.querySelector<HTMLSelectElement>('#model-select')!;
const promptDisplay = document.querySelector<HTMLTextAreaElement>('#prompt-display')!;
const noteTextarea = document.querySelector<HTMLTextAreaElement>('#note-textarea')!;
const autoSaveIndicator = document.querySelector<HTMLElement>('.auto-save-indicator')!;
const mainView = document.querySelector<HTMLDivElement>('.main-view')!;
const settingsView = document.querySelector<HTMLDivElement>('.settings-view')!;

// Update status
function updateStatus(status: string) {
  statusEl.textContent = status;
}

// Local storage keys
const NOTE_STORAGE_KEY = 'openai-realtime-note';
const API_KEY_STORAGE_KEY = 'openai-realtime-api-key';
const MODEL_STORAGE_KEY = 'openai-realtime-model';
const PROMPT_STORAGE_KEY = 'openai-realtime-prompt';

// Load note from local storage
function loadNote(): string {
  return localStorage.getItem(NOTE_STORAGE_KEY) || '';
}

// Save note to local storage
function saveNote(note: string) {
  localStorage.setItem(NOTE_STORAGE_KEY, note);
  showAutoSaveIndicator();
}

// Load API key from local storage
function loadApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE_KEY) || import.meta.env.VITE_OPENAI_API_KEY || '';
}

// Save API key to local storage
function saveApiKey(apiKey: string) {
  localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
}

// Load selected model from local storage
function loadModel(): string {
  return localStorage.getItem(MODEL_STORAGE_KEY) || BIG_MODEL;
}

// Save selected model to local storage
function saveModel(model: string) {
  localStorage.setItem(MODEL_STORAGE_KEY, model);
}

// Load prompt from local storage
function loadPrompt(): string {
  return localStorage.getItem(PROMPT_STORAGE_KEY) || SYSTEM_INSTRUCTIONS;
}

// Save prompt to local storage
function savePrompt(prompt: string) {
  localStorage.setItem(PROMPT_STORAGE_KEY, prompt);
}

// Reset prompt to default
function resetPrompt() {
  localStorage.removeItem(PROMPT_STORAGE_KEY);
  promptDisplay.value = SYSTEM_INSTRUCTIONS;
}

// Show auto-save indicator briefly
function showAutoSaveIndicator() {
  autoSaveIndicator.style.opacity = '1';
  setTimeout(() => {
    autoSaveIndicator.style.opacity = '0';
  }, 2000);
}

// Tool handlers
function handleReadNote(): string {
  return loadNote();
}

function handleUpdateNote(content: string) {
  noteTextarea.value = content;
  saveNote(content);
}

// Convert Float32Array to PCM16
function floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

// Play audio buffer
async function playAudioBuffer(audioBuffer: AudioBuffer) {
  if (!audioContext) return;

  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);
  source.start();

  return new Promise<void>((resolve) => {
    source.onended = () => resolve();
  });
}

// Process audio queue
async function processAudioQueue() {
  if (isPlaying || audioQueue.length === 0) return;

  isPlaying = true;
  while (audioQueue.length > 0) {
    const buffer = audioQueue.shift()!;
    await playAudioBuffer(buffer);
  }
  isPlaying = false;
}

// Start connection
async function startConnection() {
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    alert('Please enter your OpenAI API key');
    return;
  }

  try {
    updateStatus('Requesting microphone access...');

    // Get microphone access first
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (micError) {
      throw new Error('Microphone access denied. Please allow microphone access in your browser settings and try again.');
    }

    updateStatus('Connecting...');

    // Initialize audio context
    audioContext = new AudioContext({ sampleRate: 24000 });

    // Resume audio context on iOS
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    // Connect to OpenAI Realtime API
    const selectedModel = modelSelect.value;
    const url = `wss://api.openai.com/v1/realtime?model=${selectedModel}`;
    ws = new WebSocket(url, [
      'realtime',
      `openai-insecure-api-key.${apiKey}`,
      'openai-beta.realtime-v1',
    ]);

    ws.addEventListener('open', () => {
      updateStatus('Connected');
      startBtn.disabled = true;
      stopBtn.disabled = false;

      // Send session configuration
      ws!.send(
        JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: promptDisplay.value,
            voice: 'alloy',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            turn_detection: {
              type: 'server_vad',
            },
            tools: [
              {
                type: 'function',
                name: 'read_note',
                description: "Read the current content of the user's note",
                parameters: {
                  type: 'object',
                  properties: {},
                  required: [],
                },
              },
              {
                type: 'function',
                name: 'update_note',
                description: "Update the user's note with new content",
                parameters: {
                  type: 'object',
                  properties: {
                    content: {
                      type: 'string',
                      description: 'The new content to set for the note',
                    },
                  },
                  required: ['content'],
                },
              },
            ],
          },
        }),
      );

      // Start capturing audio
      startAudioCapture();
    });

    ws.addEventListener('message', async (event) => {
      const data = JSON.parse(event.data);

      // Log all messages for debugging
      if (
        data.type !== 'response.audio.delta' &&
        data.type !== 'input_audio_buffer.speech_started' &&
        data.type !== 'input_audio_buffer.speech_stopped'
      ) {
        console.log('Received message:', data.type, data);
      }

      if (data.type === 'response.audio.delta' && data.delta) {
        // Decode base64 audio
        const audioData = atob(data.delta);
        const arrayBuffer = new ArrayBuffer(audioData.length);
        const view = new Uint8Array(arrayBuffer);
        for (let i = 0; i < audioData.length; i++) {
          view[i] = audioData.charCodeAt(i);
        }

        // Convert PCM16 to AudioBuffer
        const float32Array = new Float32Array(arrayBuffer.byteLength / 2);
        const dataView = new DataView(arrayBuffer);
        for (let i = 0; i < float32Array.length; i++) {
          float32Array[i] = dataView.getInt16(i * 2, true) / 0x8000;
        }

        const audioBuffer = audioContext!.createBuffer(1, float32Array.length, 24000);
        audioBuffer.getChannelData(0).set(float32Array);

        audioQueue.push(audioBuffer);
        processAudioQueue();
      }

      if (data.type === 'error') {
        console.error('Error from API:', data.error);
        updateStatus(`Error: ${data.error.message}`);
      }

      // Handle function calls
      if (data.type === 'response.function_call_arguments.done') {
        const functionName = data.name;
        const callId = data.call_id;
        const args = JSON.parse(data.arguments);

        console.log('Function call:', functionName, args);

        let result: string;

        try {
          if (functionName === 'read_note') {
            result = handleReadNote();
          } else if (functionName === 'update_note') {
            handleUpdateNote(args.content);
            result = 'Note updated successfully';
          } else {
            result = JSON.stringify({ error: 'Unknown function' });
          }

          // Send function call output back to API
          ws!.send(
            JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: callId,
                output: result,
              },
            }),
          );

          // Trigger response generation
          ws!.send(
            JSON.stringify({
              type: 'response.create',
            }),
          );
        } catch (error) {
          console.error('Error executing function:', error);
        }
      }
    });

    ws.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      updateStatus('Error occurred');
      stopConnection();
    });

    ws.addEventListener('close', () => {
      updateStatus('Disconnected');
      stopConnection();
    });
  } catch (error) {
    console.error('Failed to start:', error);
    updateStatus('Failed to start');
    alert('Failed to start: ' + (error as Error).message);
    stopConnection();
  }
}

// Start audio capture
function startAudioCapture() {
  if (!mediaStream || !audioContext || !ws) return;

  const source = audioContext.createMediaStreamSource(mediaStream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);

  processor.onaudioprocess = (e) => {
    if (ws?.readyState === WebSocket.OPEN) {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcm16 = floatTo16BitPCM(inputData);

      // Send audio data as base64
      const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16)));
      ws.send(
        JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: base64,
        }),
      );
    }
  };

  source.connect(processor);
  processor.connect(audioContext.destination);
}

// Stop connection
function stopConnection() {
  if (ws) {
    ws.close();
    ws = null;
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  audioQueue = [];
  isPlaying = false;

  startBtn.disabled = false;
  stopBtn.disabled = true;
  updateStatus('Disconnected');
}

// Settings toggle functions
function showSettings() {
  mainView.style.display = 'none';
  settingsView.style.display = 'flex';
}

function hideSettings() {
  mainView.style.display = 'flex';
  settingsView.style.display = 'none';
}

// Event listeners
startBtn.addEventListener('click', startConnection);
stopBtn.addEventListener('click', stopConnection);
settingsBtn.addEventListener('click', showSettings);
closeSettingsBtn.addEventListener('click', hideSettings);

// API key functionality
apiKeyInput.addEventListener('input', () => {
  saveApiKey(apiKeyInput.value);
});

// Model selection functionality
modelSelect.addEventListener('change', () => {
  saveModel(modelSelect.value);
});

// Prompt functionality
promptDisplay.addEventListener('input', () => {
  savePrompt(promptDisplay.value);
});

resetPromptBtn.addEventListener('click', resetPrompt);

// Note functionality
noteTextarea.addEventListener('input', () => {
  saveNote(noteTextarea.value);
});

// Load saved data on page load
apiKeyInput.value = loadApiKey();
modelSelect.value = loadModel();
promptDisplay.value = loadPrompt();
noteTextarea.value = loadNote();

// Register service worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('Service Worker registered successfully:', registration.scope);
      })
      .catch((error) => {
        console.log('Service Worker registration failed:', error);
      });
  });
}
