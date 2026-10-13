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

const canvas = document.getElementById('shapeCanvas');
const ctx = canvas.getContext('2d');
const notesContainer = document.getElementById('notes');
const currentNoteEl = document.getElementById('currentNote');
const freqDisplay = document.getElementById('freqDisplay');
const playSequenceBtn = document.getElementById('playSequence');
const stopBtn = document.getElementById('stopAll');

async function ensureAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        console.log('AudioContext created, state:', audioCtx.state);
    }
    if (audioCtx.state === 'suspended') {
        try {
            await audioCtx.resume();
            console.log('AudioContext resumed, state:', audioCtx.state);
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
        } catch (e) {
            console.warn('Stop error:', e);
        }
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
    const radius = 140;

    ctx.clearRect(0, 0, w, h);

    const gradient = ctx.createRadialGradient(cx, cy, 20, cx, cy, radius + 40);
    gradient.addColorStop(0, note.color + '33');
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = note.color;
    ctx.fillStyle = note.color;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (note.shape === 'point') {
        ctx.beginPath();
        ctx.arc(cx, cy, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, 28, 0, Math.PI * 2);
        ctx.stroke();
    } else if (note.shape === 'line') {
        ctx.beginPath();
        ctx.moveTo(cx - radius * 0.7, cy);
        ctx.lineTo(cx + radius * 0.7, cy);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx - radius * 0.7, cy, 8, 0, Math.PI * 2);
        ctx.arc(cx + radius * 0.7, cy, 8, 0, Math.PI * 2);
        ctx.fill();
    } else if (note.shape === 'angle') {
        ctx.beginPath();
        ctx.moveTo(cx - 90, cy + 70);
        ctx.lineTo(cx, cy - 70);
        ctx.lineTo(cx + 90, cy + 70);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy - 70, 8, 0, Math.PI * 2);
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
        ctx.globalAlpha = 0.18;
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    ctx.fillStyle = '#f1f5f9';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(note.name, cx, cy + radius + 36);
}

async function playNote(note) {
    const ctxAudio = await ensureAudioContext();
    if (!ctxAudio || ctxAudio.state !== 'running') {
        console.warn('AudioContext not running. State:', ctxAudio ? ctxAudio.state : 'null');
        currentNoteEl.textContent = 'Click again to enable audio';
        return;
    }

    stopCurrent(true);

    const osc = ctxAudio.createOscillator();
    const gain = ctxAudio.createGain();

    // Triangle is usually more audible than pure sine on many systems
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(note.freq, ctxAudio.currentTime);

    const now = ctxAudio.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.04);

    osc.connect(gain);
    gain.connect(ctxAudio.destination);

    osc.start(now);

    currentOsc = osc;
    currentGain = gain;

    currentNoteEl.textContent = note.name + ' (playing)';
    freqDisplay.textContent = `${note.freq.toFixed(2)} Hz • ${note.hint}`;
    drawShape(note);

    const btn = document.querySelector(`.note-btn[data-note="${note.name}"]`);
    if (btn) btn.classList.add('playing');

    console.log('Playing', note.name, 'at', note.freq, 'Hz');
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
        sequenceTimer = setTimeout(next, 1200);
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
    ctx.fillStyle = '#334155';
    ctx.font = '18px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Click a note to see its shape', canvas.width / 2, canvas.height / 2);
}

playSequenceBtn.addEventListener('click', playSequence);
stopBtn.addEventListener('click', stopAll);

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
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

ctx.fillStyle = '#334155';
ctx.font = '18px system-ui';
ctx.textAlign = 'center';
ctx.fillText('Click a note to see its shape', canvas.width / 2, canvas.height / 2);
