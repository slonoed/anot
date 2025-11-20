(function(){const n=document.createElement("link").relList;if(n&&n.supports&&n.supports("modulepreload"))return;for(const e of document.querySelectorAll('link[rel="modulepreload"]'))a(e);new MutationObserver(e=>{for(const o of e)if(o.type==="childList")for(const c of o.addedNodes)c.tagName==="LINK"&&c.rel==="modulepreload"&&a(c)}).observe(document,{childList:!0,subtree:!0});function i(e){const o={};return e.integrity&&(o.integrity=e.integrity),e.referrerPolicy&&(o.referrerPolicy=e.referrerPolicy),e.crossOrigin==="use-credentials"?o.credentials="include":e.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function a(e){if(e.ep)return;e.ep=!0;const o=i(e);fetch(e.href,o)}})();const B="gpt-4o-mini-realtime-preview",O="gpt-4o-realtime-preview",P=`You are a helpful assistant.
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
`;document.querySelector("#app").innerHTML=`
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
          <option value="${B}">GPT-4o Mini (Faster, Cheaper)</option>
          <option value="${O}">GPT-4o (Better Quality)</option>
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
`;let r=null,p=null,s=null,f=[],g=!1;const E=document.querySelector("#start-btn"),_=document.querySelector("#stop-btn"),D=document.querySelector("#settings-btn"),K=document.querySelector("#close-settings-btn"),R=document.querySelector("#reset-prompt-btn"),W=document.querySelector("#status"),h=document.querySelector("#api-key"),S=document.querySelector("#model-select"),m=document.querySelector("#prompt-display"),b=document.querySelector("#note-textarea"),A=document.querySelector(".auto-save-indicator"),L=document.querySelector(".main-view"),N=document.querySelector(".settings-view");function d(t){W.textContent=t}const T="openai-realtime-note",q="openai-realtime-api-key",M="openai-realtime-model",k="openai-realtime-prompt";function x(){return localStorage.getItem(T)||""}function C(t){localStorage.setItem(T,t),j()}function Y(){return localStorage.getItem(q)||void 0||""}function U(t){localStorage.setItem(q,t)}function F(){return localStorage.getItem(M)||O}function G(t){localStorage.setItem(M,t)}function J(){return localStorage.getItem(k)||P}function V(t){localStorage.setItem(k,t)}function $(){localStorage.removeItem(k),m.value=P}function j(){A.style.opacity="1",setTimeout(()=>{A.style.opacity="0"},2e3)}function Q(){return x()}function H(t){b.value=t,C(t)}function z(t){const n=new ArrayBuffer(t.length*2),i=new DataView(n);let a=0;for(let e=0;e<t.length;e++,a+=2){const o=Math.max(-1,Math.min(1,t[e]));i.setInt16(a,o<0?o*32768:o*32767,!0)}return n}async function X(t){if(!s)return;const n=s.createBufferSource();return n.buffer=t,n.connect(s.destination),n.start(),new Promise(i=>{n.onended=()=>i()})}async function Z(){if(!(g||f.length===0)){for(g=!0;f.length>0;){const t=f.shift();await X(t)}g=!1}}async function ee(){const t=h.value.trim();if(!t){alert("Please enter your OpenAI API key");return}try{d("Requesting microphone access...");try{p=await navigator.mediaDevices.getUserMedia({audio:!0})}catch{throw new Error("Microphone access denied. Please allow microphone access in your browser settings and try again.")}d("Connecting..."),s=new AudioContext({sampleRate:24e3}),s.state==="suspended"&&await s.resume();const i=`wss://api.openai.com/v1/realtime?model=${S.value}`;r=new WebSocket(i,["realtime",`openai-insecure-api-key.${t}`,"openai-beta.realtime-v1"]),r.addEventListener("open",()=>{d("Connected"),E.disabled=!0,_.disabled=!1,r.send(JSON.stringify({type:"session.update",session:{modalities:["text","audio"],instructions:m.value,voice:"alloy",input_audio_format:"pcm16",output_audio_format:"pcm16",turn_detection:{type:"server_vad"},tools:[{type:"function",name:"read_note",description:"Read the current content of the user's note",parameters:{type:"object",properties:{},required:[]}},{type:"function",name:"update_note",description:"Update the user's note with new content",parameters:{type:"object",properties:{content:{type:"string",description:"The new content to set for the note"}},required:["content"]}}]}})),te()}),r.addEventListener("message",async a=>{const e=JSON.parse(a.data);if(e.type!=="response.audio.delta"&&e.type!=="input_audio_buffer.speech_started"&&e.type!=="input_audio_buffer.speech_stopped"&&console.log("Received message:",e.type,e),e.type==="response.audio.delta"&&e.delta){const o=atob(e.delta),c=new ArrayBuffer(o.length),y=new Uint8Array(c);for(let u=0;u<o.length;u++)y[u]=o.charCodeAt(u);const l=new Float32Array(c.byteLength/2),w=new DataView(c);for(let u=0;u<l.length;u++)l[u]=w.getInt16(u*2,!0)/32768;const I=s.createBuffer(1,l.length,24e3);I.getChannelData(0).set(l),f.push(I),Z()}if(e.type==="error"&&(console.error("Error from API:",e.error),d(`Error: ${e.error.message}`)),e.type==="response.function_call_arguments.done"){const o=e.name,c=e.call_id,y=JSON.parse(e.arguments);console.log("Function call:",o,y);let l;try{o==="read_note"?l=Q():o==="update_note"?(H(y.content),l="Note updated successfully"):l=JSON.stringify({error:"Unknown function"}),r.send(JSON.stringify({type:"conversation.item.create",item:{type:"function_call_output",call_id:c,output:l}})),r.send(JSON.stringify({type:"response.create"}))}catch(w){console.error("Error executing function:",w)}}}),r.addEventListener("error",a=>{console.error("WebSocket error:",a),d("Error occurred"),v()}),r.addEventListener("close",()=>{d("Disconnected"),v()})}catch(n){console.error("Failed to start:",n),d("Failed to start"),alert("Failed to start: "+n.message),v()}}function te(){if(!p||!s||!r)return;const t=s.createMediaStreamSource(p),n=s.createScriptProcessor(4096,1,1);n.onaudioprocess=i=>{if(r?.readyState===WebSocket.OPEN){const a=i.inputBuffer.getChannelData(0),e=z(a),o=btoa(String.fromCharCode(...new Uint8Array(e)));r.send(JSON.stringify({type:"input_audio_buffer.append",audio:o}))}},t.connect(n),n.connect(s.destination)}function v(){r&&(r.close(),r=null),p&&(p.getTracks().forEach(t=>t.stop()),p=null),s&&(s.close(),s=null),f=[],g=!1,E.disabled=!1,_.disabled=!0,d("Disconnected")}function oe(){L.style.display="none",N.style.display="flex"}function ne(){L.style.display="flex",N.style.display="none"}E.addEventListener("click",ee);_.addEventListener("click",v);D.addEventListener("click",oe);K.addEventListener("click",ne);h.addEventListener("input",()=>{U(h.value)});S.addEventListener("change",()=>{G(S.value)});m.addEventListener("input",()=>{V(m.value)});R.addEventListener("click",$);b.addEventListener("input",()=>{C(b.value)});h.value=Y();S.value=F();m.value=J();b.value=x();"serviceWorker"in navigator&&window.addEventListener("load",()=>{navigator.serviceWorker.register("/service-worker.js").then(t=>{console.log("Service Worker registered successfully:",t.scope)}).catch(t=>{console.log("Service Worker registration failed:",t)})});
