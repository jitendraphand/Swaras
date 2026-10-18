const notes = [
    { name: 'C3', freq: 130.81, shape: 'point', sides: 0, color: '#ef4444', hint: 'Dot (Point)' },
    { name: 'D3', freq: 146.83, shape: 'line', sides: 1, color: '#f97316', hint: 'Line' },
    { name: 'E3', freq: 164.81, shape: 'angle', sides: 2, color: '#eab308', hint: 'Angle' },
    { name: 'F3', freq: 174.61, shape: 'triangle', sides: 3, color: '#22c55e', hint: 'Triangle' },
    { name: 'G3', freq: 196.00, shape: 'quad', sides: 4, color: '#14b8a6', hint: 'Quadrilateral' },
    { name: 'A3', freq: 220.00, shape: 'pentagon', sides: 5, color: '#3b82f6', hint: 'Pentagon' },
    { name: 'B3', freq: 246.94, shape: 'hexagon', sides: 6, color: '#8b5cf6', hint: 'Hexagon' },
    { name: 'C4', freq: 261.63, shape: 'heptagon', sides: 7, color: '#ec4899', hint: 'Septagon (Heptagon)' }
];

let audioCtx = null;
let currentOsc = null;
let currentGain = null;
let sequenceTimer = null;
let currentWaveform = 'sine';
let masterVolume = 0.35;

// Live mic detection state
let micStream = null;
let analyser = null;
let micSource = null;
let isListening = false;
let animationId = null;

const canvas = document.getElementById('shapeCanvas');
const ctx = canvas.getContext('2d');
const notesContainer = document.getElementById('notes');
const currentNoteEl = document.getElementById('currentNote');
const freqDisplay = document.getElementById('freqDisplay');
const playSequenceBtn = document.getElementById('playSequence');
const stopBtn = document.getElementById('stopAll');
const waveformSelector = document.getElementById('waveformSelector');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');

const startMicBtn = document.getElementById('startMic');
const stopMicBtn = document.getElementById('stopMic');
const liveFreqEl = document.getElementById('liveFreq');
const liveNoteEl = document.getElementById('liveNote');
const micStatusEl = document.getElementById('micStatus');

// Waveform selector
waveformSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.wave-btn');
    if (!btn) return;
    document.querySelectorAll('.wave-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentWaveform = btn.dataset.wave;
    // If currently playing, restart with new waveform for instant feedback
    if (currentOsc) {
        const currentNoteName = currentNoteEl.textContent.replace(' (playing)', '');
        const note = notes.find(n => n.name === currentNoteName);
        if (note) playNote(note);
    }
});

// Volume control
volumeSlider.addEventListener('input', () => {
    masterVolume = parseFloat(volumeSlider.value);
    volumeValue.textContent = Math.round(masterVolume * 100) + '%';
    if (currentGain && audioCtx) {
        const now = audioCtx.currentTime;
        currentGain.gain.cancelScheduledValues(now);
        currentGain.gain.setValueAtTime(currentGain.gain.value, now);
        currentGain.gain.linearRampToValueAtTime(masterVolume, now + 0.05);
    }
});

async function ensureAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        try {
            await audioCtx.resume();
        } catch (err) {
            console.error('Failed to resume AudioContext:', err);
        }
    }
    return audioCtx;
}

function stopCurrent(immediate = false) {
    if (currentOsc) {
        try {
            if (!immediate && currentGain && audioCtx) {
                const now = audioCtx.currentTime;
                currentGain.gain.cancelScheduledValues(now);
                currentGain.gain.setValueAtTime(Math.max(currentGain.gain.value, 0.001), now);
                currentGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                currentOsc.stop(now + 0.1);
            } else {
                currentOsc.stop();
            }
            currentOsc.disconnect();
        } catch (e) {}
        currentOsc = null;
    }
    if (currentGain) {
        try { currentGain.disconnect(); } catch (e) {}
        currentGain = null;
    }
    document.querySelectorAll('.note-btn.playing').forEach(btn => btn.classList.remove('playing'));
}

function drawShape(note) {
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = 160;

    ctx.clearRect(0, 0, w, h);

    // Soft radial glow
    const gradient = ctx.createRadialGradient(cx, cy, 30, cx, cy, radius + 50);
    gradient.addColorStop(0, note.color + '40');
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = note.color;
    ctx.fillStyle = note.color;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (note.shape === 'point') {
        ctx.beginPath();
        ctx.arc(cx, cy, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, 32, 0, Math.PI * 2);
        ctx.stroke();
    } else if (note.shape === 'line') {
        ctx.beginPath();
        ctx.moveTo(cx - radius * 0.75, cy);
        ctx.lineTo(cx + radius * 0.75, cy);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx - radius * 0.75, cy, 9, 0, Math.PI * 2);
        ctx.arc(cx + radius * 0.75, cy, 9, 0, Math.PI * 2);
        ctx.fill();
    } else if (note.shape === 'angle') {
        ctx.beginPath();
        ctx.moveTo(cx - 100, cy + 80);
        ctx.lineTo(cx, cy - 80);
        ctx.lineTo(cx + 100, cy + 80);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy - 80, 9, 0, Math.PI * 2);
        ctx.fill();
    } else {
        const sides = note.sides;
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
            const angle = (i * 2 * Math.PI / sides) - Math.PI / 2;
            const x = cx + radius * Math.cos(angle);
            const y = cy + radius * Math.sin(angle);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.globalAlpha = 0.16;
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    ctx.fillStyle = '#f1f5f9';
    ctx.font = 'bold 26px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(note.name, cx, cy + radius + 42);
}

async function playNote(note) {
    const ctxAudio = await ensureAudioContext();
    if (!ctxAudio || ctxAudio.state !== 'running') {
        currentNoteEl.textContent = 'Click again to enable audio';
        return;
    }

    stopCurrent(true);

    const osc = ctxAudio.createOscillator();
    const gain = ctxAudio.createGain();

    osc.type = currentWaveform;
    osc.frequency.setValueAtTime(note.freq, ctxAudio.currentTime);

    const now = ctxAudio.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(masterVolume, now + 0.05);

    osc.connect(gain);
    gain.connect(ctxAudio.destination);

    osc.start(now);

    currentOsc = osc;
    currentGain = gain;

    currentNoteEl.textContent = note.name + ' (playing)';
    freqDisplay.textContent = `${note.freq.toFixed(2)} Hz • ${note.hint} • ${currentWaveform}`;
    drawShape(note);

    const btn = document.querySelector(`.note-btn[data-note="${note.name}"]`);
    if (btn) btn.classList.add('playing');
}

function createButtons() {
    notes.forEach(note => {
        const btn = document.createElement('button');
        btn.className = 'note-btn';
        btn.dataset.note = note.name;
        btn.innerHTML = `${note.name}<span class="shape-hint">${note.hint}</span>`;
        btn.addEventListener('click', () => playNote(note));
        notesContainer.appendChild(btn);
    });
}

function playSequence() {
    stopAll();
    let i = 0;
    function next() {
        if (i >= notes.length) {
            stopAll();
            return;
        }
        playNote(notes[i]);
        i++;
        sequenceTimer = setTimeout(next, 1100);
    }
    next();
}

function stopAll() {
    if (sequenceTimer) {
        clearTimeout(sequenceTimer);
        sequenceTimer = null;
    }
    stopCurrent();
    currentNoteEl.textContent = 'Select a tone';
    freqDisplay.textContent = '';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#64748b';
    ctx.font = '17px Inter, system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Click a note to see its shape', canvas.width / 2, canvas.height / 2);
}

// --- Live Mic Frequency Detection ---

function getClosestNote(freq) {
    if (!freq || freq < 80 || freq > 400) return { name: '--', cents: 0 };
    let closest = notes[0];
    let minDiff = Infinity;
    for (const note of notes) {
        const diff = Math.abs(freq - note.freq);
        if (diff < minDiff) {
            minDiff = diff;
            closest = note;
        }
    }
    const cents = 1200 * Math.log2(freq / closest.freq);
    return { name: closest.name, cents: cents };
}

function autoCorrelate(buf, sampleRate) {
    const SIZE = buf.length;
    let rms = 0;
    for (let i = 0; i < SIZE; i++) {
        const val = buf[i];
        rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) return -1;

    let r1 = 0, r2 = SIZE - 1, thres = 0.2;
    for (let i = 0; i < SIZE / 2; i++) {
        if (Math.abs(buf[i]) < thres) { r1 = i; break; }
    }
    for (let i = 1; i < SIZE / 2; i++) {
        if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
    }

    buf = buf.slice(r1, r2);
    const newSize = buf.length;

    const c = new Array(newSize).fill(0);
    for (let i = 0; i < newSize; i++) {
        for (let j = 0; j < newSize - i; j++) {
            c[i] = c[i] + buf[j] * buf[j + i];
        }
    }

    let d = 0; while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < newSize; i++) {
        if (c[i] > maxval) {
            maxval = c[i];
            maxpos = i;
        }
    }

    let T0 = maxpos;
    const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    if (a) T0 = T0 - b / (2 * a);

    return sampleRate / T0;
}

async function startMic() {
    try {
        micStatusEl.textContent = 'Requesting microphone permission...';
        const ctxAudio = await ensureAudioContext();

        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micSource = ctxAudio.createMediaStreamSource(micStream);
        analyser = ctxAudio.createAnalyser();
        analyser.fftSize = 2048;
        micSource.connect(analyser);

        isListening = true;
        startMicBtn.style.display = 'none';
        stopMicBtn.style.display = 'inline-block';
        micStatusEl.textContent = 'Listening... Sing or play a note';

        detectPitch();
    } catch (err) {
        console.error('Mic error:', err);
        micStatusEl.textContent = 'Microphone access denied or unavailable';
        isListening = false;
    }
}

function stopMic() {
    isListening = false;
    if (animationId) cancelAnimationFrame(animationId);
    if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
        micStream = null;
    }
    if (micSource) {
        try { micSource.disconnect(); } catch (e) {}
        micSource = null;
    }
    analyser = null;

    startMicBtn.style.display = 'inline-block';
    stopMicBtn.style.display = 'none';
    liveFreqEl.textContent = 'Live: -- Hz';
    liveNoteEl.textContent = 'Closest note: --';
    micStatusEl.textContent = 'Mic stopped';
}

function detectPitch() {
    if (!isListening || !analyser) return;

    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);

    const sampleRate = audioCtx.sampleRate;
    const freq = autoCorrelate(buffer, sampleRate);

    if (freq > 0) {
        const closest = getClosestNote(freq);
        liveFreqEl.textContent = `Live: ${freq.toFixed(1)} Hz`;
        const centsText = closest.cents ? ` (${closest.cents > 0 ? '+' : ''}${closest.cents.toFixed(0)} cents)` : '';
        liveNoteEl.textContent = `Closest: ${closest.name}${centsText}`;
    } else {
        liveFreqEl.textContent = 'Live: -- Hz';
        liveNoteEl.textContent = 'Closest note: --';
    }

    animationId = requestAnimationFrame(detectPitch);
}

startMicBtn.addEventListener('click', startMic);
stopMicBtn.addEventListener('click', stopMic);

playSequenceBtn.addEventListener('click', playSequence);
stopBtn.addEventListener('click', stopAll);

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    const keyMap = { 'c': 0, 'd': 1, 'e': 2, 'f': 3, 'g': 4, 'a': 5, 'b': 6, 'h': 7 };
    const idx = keyMap[e.key.toLowerCase()];
    if (idx !== undefined && notes[idx]) {
        playNote(notes[idx]);
    }
    if (e.key === 'Escape' || e.key === ' ') {
        e.preventDefault();
        stopAll();
    }
});

createButtons();

// Initial canvas state
ctx.fillStyle = '#64748b';
ctx.font = '17px Inter, system-ui';
ctx.textAlign = 'center';
ctx.fillText('Click a note to see its shape', canvas.width / 2, canvas.height / 2);
