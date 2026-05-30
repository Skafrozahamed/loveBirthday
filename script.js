// ============================================================
// BIRTHDAY STORY — FINAL v11
//
// CORE ARCHITECTURE:
//   ONE audio element only.
//   - iOS unlock: play() called SYNCHRONOUSLY in tap handler
//     with src already set → element stays unlocked forever.
//   - Changing .src after unlock works on all modern iOS (10+).
//   - Volume fades use setInterval (GSAP is unreliable on
//     HTMLAudioElement.volume on mobile Safari).
//   - All 7 audio files preloaded into browser cache so
//     src-switch latency is near zero.
//   - Scene auto-timers match each audio file's exact duration.
// ============================================================

// ─── STATE ──────────────────────────────────────────────────
let currentScene      = -1;
const scenes          = document.querySelectorAll('.story-scene');
let slideshowInterval = null;
let autoTimer         = null;
let isTransitioning   = false;
let globalAnimActive  = true;
let starAnimId        = null;
let petalAnimId       = null;
let storyReady        = false;
let storyBegun        = false;

// ─── SINGLE AUDIO ELEMENT ───────────────────────────────────
const audio = document.getElementById('audioA');
audio.volume = 0;
let currentMusicSrc = null;
let volFadeIv       = null;

const musicMap = {
    0: 'audios/Countdown.mpeg',   // 10.0 s
    1: 'audios/Page1.mpeg',       // 20.0 s
    2: 'audios/Page2.mpeg',       // 28.0 s
    3: 'audios/Page3.mpeg',       // 33.3 s
    4: 'audios/Page4.mpeg',       // 72.0 s
    5: 'audios/Page5.mpeg',       // 36.4 s
    6: 'audios/Page6.mpeg'        // 27.3 s
};
const volMap = { 0:.55, 1:.82, 2:.65, 3:.58, 4:.72, 5:.62, 6:.68 };

// setInterval-based fade — NEVER use GSAP for audio.volume on mobile.
function fadeToVol(target, ms, done) {
    if (volFadeIv) { clearInterval(volFadeIv); volFadeIv = null; }
    const start = audio.volume;
    const diff  = target - start;
    if (Math.abs(diff) < 0.005) { audio.volume = target; if (done) done(); return; }
    const steps = Math.max(15, Math.round(ms / 20));
    let   step  = 0;
    volFadeIv = setInterval(() => {
        step++;
        audio.volume = Math.max(0, Math.min(1, start + diff * (step / steps)));
        if (step >= steps) {
            clearInterval(volFadeIv);
            volFadeIv = null;
            audio.volume = target;
            if (done) done();
        }
    }, 20);
}

function playMusicForScene(idx) {
    const src = musicMap[idx];
    const vol = volMap[idx] || 0.65;
    if (!src || currentMusicSrc === src) return;
    currentMusicSrc = src;

    if (volFadeIv) { clearInterval(volFadeIv); volFadeIv = null; }

    audio.src          = src;
    audio.currentTime  = 0;
    audio.volume       = 0;

    const p = audio.play();
    if (p !== undefined) {
        p.then(() => fadeToVol(vol, 800))
         .catch(err => {
             console.warn('audio.play() rejected:', err.message);
             // Hard fallback: set volume directly and retry once
             audio.volume = vol;
             audio.play().catch(() => {});
         });
    } else {
        fadeToVol(vol, 800);
    }
}

// ─── ASSET PRELOAD ──────────────────────────────────────────
const imageList  = Array.from({ length: 11 }, (_, i) => `images/img${i + 1}.jpg`);
let   assetsToLoad = imageList.length + Object.keys(musicMap).length;
let   assetsLoaded = 0;

function onAsset() {
    assetsLoaded = Math.min(assetsToLoad, assetsLoaded + 1);
    const pct = Math.floor(assetsLoaded / assetsToLoad * 100);
    const bar = document.getElementById('progressBar');
    const txt = document.getElementById('loadingPercent');
    if (bar) bar.style.width = pct + '%';
    if (txt) txt.textContent  = pct + '%';
    if (assetsLoaded >= assetsToLoad && !storyReady) {
        storyReady = true;
        revealTapScreen();
    }
}

imageList.forEach(src => {
    const img = new Image();
    img.onload = img.onerror = onAsset;
    img.src = src;
});

// Cache all audio files in the browser so src-switch is instant
Object.values(musicMap).forEach(src => {
    const a = new Audio();
    a.preload = 'auto';
    let fired = false;
    const h = () => { if (!fired) { fired = true; onAsset(); } };
    a.addEventListener('canplaythrough', h, { once: true });
    a.addEventListener('canplay',        h, { once: true });
    a.addEventListener('error',          h, { once: true });
    a.src = src;
    a.load();
});

// Safety: never strand user on loading screen past 9 s
setTimeout(() => {
    if (!storyReady) {
        storyReady    = true;
        assetsLoaded  = assetsToLoad;
        revealTapScreen();
    }
}, 9000);

// ─── TAP-TO-BEGIN ────────────────────────────────────────────
function revealTapScreen() {
    const loader = document.getElementById('loadingScreen');
    const tap    = document.getElementById('tapToBegin');
    if (!tap) return;

    const show = () => {
        if (loader) loader.style.display = 'none';
        tap.style.display = 'flex';
        gsap.fromTo(tap, { opacity: 0 }, { opacity: 1, duration: 1 });

        const go = () => {
            if (storyBegun) return;
            storyBegun = true;
            tap.removeEventListener('click',      go);
            tap.removeEventListener('touchstart', go);

            // ★★★ iOS SAFARI CRITICAL ★★★
            // audio.play() MUST be called synchronously inside a user-gesture
            // handler. We set src first (empty play with no src errors out).
            // After this call the element is permanently unlocked — src can
            // be changed freely for the rest of the session.
            audio.src    = musicMap[0];
            audio.volume = 0;
            audio.play()
                .then(() => audio.pause())   // pause immediately; beginStory() plays it properly
                .catch(() => {});            // some browsers reject play+immediate-pause; ignore

            gsap.to(tap, {
                opacity: 0, duration: 0.6,
                onComplete: () => { tap.style.display = 'none'; beginStory(); }
            });
        };

        tap.addEventListener('click',      go);
        tap.addEventListener('touchstart', go, { passive: true });
    };

    if (loader) {
        gsap.to(loader, { opacity: 0, duration: 0.8, onComplete: show });
    } else {
        show();
    }
}

function beginStory() {
    activateScene(0);
    currentMusicSrc = null;        // force playMusicForScene to not skip scene 0
    playMusicForScene(0);          // Countdown.mpeg — starts RIGHT NOW
    startCountdown();

    setTimeout(() => {
        const hint = document.getElementById('swipeHint');
        if (hint) hint.style.display = 'block';
    }, 12000);
}

// ─── SCENE TRANSITIONS ──────────────────────────────────────
const transOverlay = document.getElementById('transitionOverlay');

function activateScene(idx) {
    if (idx < 0 || idx >= scenes.length) return;
    if (currentScene >= 0) scenes[currentScene].classList.remove('active');
    currentScene = idx;
    scenes[currentScene].classList.add('active');
}

function nextScene() {
    if (isTransitioning) return;
    if (currentScene < 0 || currentScene >= scenes.length - 1) return;
    isTransitioning = true;
    clearTimers();

    gsap.to(transOverlay, {
        opacity: 0.5, duration: 0.28, ease: 'power2.in',
        onComplete: () => {
            activateScene(currentScene + 1);

            // Music fires at the EXACT frame the new scene becomes visible
            playMusicForScene(currentScene);

            gsap.to(transOverlay, { opacity: 0, duration: 0.55, ease: 'power2.out' });
            if (navigator.vibrate) navigator.vibrate(16);
            handleSceneEnter(currentScene);
            setTimeout(() => { isTransitioning = false; }, 650);
        }
    });
}

function clearTimers() {
    if (slideshowInterval) { clearInterval(slideshowInterval); slideshowInterval = null; }
    if (autoTimer)         { clearTimeout(autoTimer);          autoTimer         = null; }
}

function handleSceneEnter(idx) {
    if (idx === 1) startBirthdayReveal();
    if (idx === 2) startEmotionalStory();
    if (idx === 3) startTypeConfession();
    if (idx === 4) startPhotoSlideshow();
    if (idx === 5) startWishesSequence();
    if (idx === 6) startFinale();
}

// ─── SWIPE ───────────────────────────────────────────────────
let touchY = 0;
document.addEventListener('touchstart',
    e => { touchY = e.changedTouches[0].clientY; }, { passive: true });
document.addEventListener('touchend', e => {
    if (isTransitioning || currentScene <= 0) return;
    if (touchY - e.changedTouches[0].clientY > 50) nextScene();
}, { passive: true });

// ══════════════════════════════════════════════════════════════
//  SCENE CONTENT  (timings matched to audio file durations)
// ══════════════════════════════════════════════════════════════

// SCENE 0 · COUNTDOWN — 10 s (Countdown.mpeg = 10.0 s)
let countVal = 10;
function startCountdown() {
    const el = document.getElementById('cdown');
    if (!el) return;
    el.textContent = countVal;
    const tick = setInterval(() => {
        countVal--;
        gsap.fromTo(el,
            { scale: 1.5, opacity: 0 },
            { scale: 1,   opacity: 1, duration: 0.32, ease: 'back.out(1.7)' }
        );
        el.textContent = countVal > 0 ? countVal : '✨';
        gsap.to('.ring', { scale: 1.08, duration: 0.1, yoyo: true, repeat: 1, stagger: 0.04 });
        if (countVal <= 0) {
            clearInterval(tick);
            setTimeout(nextScene, 650);   // 10.65 s total ≈ 10.0 s audio ✓
        }
    }, 1000);
}

// SCENE 1 · BIRTHDAY REVEAL — 20 s (Page1.mpeg = 20.0 s)
const birthdayLines = [
    'Today is not just your birthday',
    'Today we celebrate your smile',
    'Your kindness, your existence',
    'Somewhere, someone is grateful you were born'
];
function startBirthdayReveal() {
    const c = document.getElementById('birthdayLinesContainer');
    c.innerHTML = '';
    birthdayLines.forEach((line, i) => {
        const p = document.createElement('p');
        p.textContent = line;
        c.appendChild(p);
        gsap.fromTo(p, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.7, delay: i * 0.65 });
    });
    const btn = document.getElementById('nextBtn1');
    if (btn) { btn.style.display = 'inline-block'; btn.onclick = nextScene; }
    autoTimer = setTimeout(() => { if (currentScene === 1) nextScene(); }, 20000);
}

// SCENE 2 · EMOTIONAL — 28 s (Page2.mpeg = 28.0 s)
const emotionalLines = [
    "I don't know when it started...",
    'Maybe from your smile, maybe from your silence',
    'Slowly, you became part of my thoughts',
    'Some people stay in memories...',
    'You stayed in the heart',
    'And even if words remain unspoken, feelings still exist'
];
function startEmotionalStory() {
    const c = document.getElementById('emotionalTextContainer');
    c.innerHTML = '';
    emotionalLines.forEach((line, i) => {
        const p = document.createElement('p');
        p.textContent = line;
        c.appendChild(p);
        gsap.fromTo(p, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.75, delay: i * 0.58 });
    });
    const btn = document.getElementById('nextBtn2');
    if (btn) { btn.style.display = 'inline-block'; btn.onclick = nextScene; }
    autoTimer = setTimeout(() => { if (currentScene === 2) nextScene(); }, 28000);
}

// SCENE 3 · TYPEWRITER — 33.3 s (Page3.mpeg = 33.3 s)
// Timing budget: 257 chars × 67 ms = 17.2 s typing
//              + 5 pauses × 1 600 ms = 8.0 s between lines
//              + 8 000 ms end hold   = 8.0 s
//              Total ≈ 33.2 s ✓
const confLines = [
    'I never planned to feel this way...',
    'But your presence became something special',
    'Your smile stayed longer in my mind than it should have',
    "And maybe you'll never fully know this",
    'But somewhere, someone quietly treasures your existence',
    'More than words can ever explain'
];
let typingLock = false;
function startTypeConfession() {
    if (typingLock) return;
    typingLock = true;
    const c = document.getElementById('typewriterArea');
    c.innerHTML = '';
    let lineIdx = 0;
    function typeLine() {
        if (lineIdx >= confLines.length) {
            setTimeout(() => { if (currentScene === 3) nextScene(); }, 8000);
            return;
        }
        const p    = document.createElement('p');
        p.className = 'typed-line';
        c.appendChild(p);
        const text = confLines[lineIdx];
        let   char = 0;
        const iv   = setInterval(() => {
            p.textContent += text[char++];
            if (char >= text.length) {
                clearInterval(iv);
                lineIdx++;
                setTimeout(typeLine, 1600);
            }
        }, 67);
    }
    typeLine();
}

// SCENE 4 · SLIDESHOW — 72 s (Page4.mpeg = 72.0 s)
// 11 images × 6 500 ms = 71.5 s + 1 500 ms end pause = 73 s ≈ 72 s ✓
const captions = [
    'that first smile',   'light that stayed',   'peace in your eyes',
    'quiet warmth',       'memory of laughter',  'a gentle moment',
    'like soft poetry',   'unspoken kindness',   'starlight in you',
    'forever memory',     'you are a whole universe'
];
function startPhotoSlideshow() {
    const c = document.getElementById('cardsContainer');
    c.innerHTML = '';
    const cards = imageList.map((src, i) => {
        const card = document.createElement('div');
        card.className = 'memory-card';
        const img  = document.createElement('div');
        img.className  = 'card-img';
        img.style.backgroundImage = `url('${src}')`;
        const cap  = document.createElement('div');
        cap.className  = 'card-cap';
        cap.textContent = captions[i];
        card.append(img, cap);
        c.appendChild(card);
        return card;
    });
    let idx = 0;
    const show = i => {
        cards.forEach((card, j) => {
            if (j === i) {
                card.classList.remove('blur-transition');
                card.classList.add('active');
            } else {
                if (card.classList.contains('active')) card.classList.add('blur-transition');
                card.classList.remove('active');
            }
        });
    };
    show(0);
    slideshowInterval = setInterval(() => {
        idx++;
        if (idx >= cards.length) {
            clearInterval(slideshowInterval);
            setTimeout(() => { if (currentScene === 4) nextScene(); }, 1500);
        } else {
            show(idx);
        }
    }, 6500);
}

// SCENE 5 · WISHES — 36 s (Page5.mpeg = 36.4 s)
const wishes = [
    'I wish your life becomes gentle',
    'I wish peace finds you everywhere',
    'I wish your dreams choose you',
    'I wish your smile never fades',
    "And even from far away, I'll always pray for your happiness"
];
function startWishesSequence() {
    const c = document.getElementById('wishesList');
    c.innerHTML = '';
    wishes.forEach((text, i) => {
        const d = document.createElement('div');
        d.className   = 'wish-item';
        d.textContent = text;
        c.appendChild(d);
        gsap.fromTo(d,
            { opacity: 0, y: 18, scale: 0.96 },
            { opacity: 1, y: 0,  scale: 1, duration: 0.75, delay: i * 0.62 }
        );
    });
    autoTimer = setTimeout(() => { if (currentScene === 5) nextScene(); }, 36000);
}

// SCENE 6 · FINALE — 27 s (Page6.mpeg = 27.3 s)
function startFinale() {
    document.querySelectorAll('.ending-line').forEach((el, i) => {
        gsap.fromTo(el, { opacity: 0, y: 10 },
            { opacity: 1, y: 0, duration: 0.95, delay: i * 0.75 });
    });
    canvasConfetti({ particleCount: 65, spread: 75, origin: { y: 0.65 },
        colors: ['#ffb7c5', '#ffd966', '#fff', '#c084fc'] });
    setTimeout(() => {
        canvasConfetti({ particleCount: 40, spread: 60, origin: { y: 0.4 },
            colors: ['#ff9fbb', '#ffdf99'], shapes: ['heart'] });
    }, 2200);
    // Fade-out at 24 s; audio ends at 27.3 s (still audible during fade)
    setTimeout(() => {
        stopAllAnimations();
        gsap.to('body', {
            opacity: 0, duration: 3.2, ease: 'power2.out',
            onComplete: () => {
                const rb = document.getElementById('replayButton');
                if (rb) rb.style.display = 'inline-block';
                gsap.to('body', { opacity: 1, duration: 1 });
            }
        });
    }, 24000);
}

document.getElementById('revealSecret')?.addEventListener('click', () => {
    const s = document.getElementById('secretIdentity');
    if (!s) return;
    s.style.display = 'block';
    gsap.fromTo(s, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 1 });
    canvasConfetti({ particleCount: 35, spread: 45, origin: { y: 0.8 },
        colors: ['#ffe0b5', '#ffb3ba'] });
});
document.getElementById('replayButton')?.addEventListener('click', () => location.reload());

// ─── STARS ───────────────────────────────────────────────────
const starCanvas = document.getElementById('starCanvas');
const starCtx    = starCanvas.getContext('2d');
let stars = [];
function resizeStar() { starCanvas.width = window.innerWidth; starCanvas.height = window.innerHeight; }
window.addEventListener('resize', resizeStar);
resizeStar();
for (let i = 0; i < 140; i++) stars.push({
    x: Math.random() * starCanvas.width,  y: Math.random() * starCanvas.height,
    r: Math.random() * 1.6 + 0.2,         a: Math.random() * 0.45 + 0.15,
    vy: Math.random() * 0.10 + 0.02,      tw: Math.random() * 0.02 + 0.005,
    to: Math.random() * Math.PI * 2
});
function drawStars(t) {
    if (!globalAnimActive) return;
    starCtx.clearRect(0, 0, starCanvas.width, starCanvas.height);
    stars.forEach(s => {
        const a = s.a + Math.sin(t * s.tw + s.to) * 0.14;
        starCtx.beginPath();
        starCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        starCtx.fillStyle = `rgba(255,235,230,${Math.max(0, Math.min(1, a))})`;
        starCtx.fill();
        s.y -= s.vy;
        if (s.y < 0) { s.y = starCanvas.height; s.x = Math.random() * starCanvas.width; }
    });
    starAnimId = requestAnimationFrame(drawStars);
}
drawStars(0);

// ─── PETALS ──────────────────────────────────────────────────
const petalCanvas = document.getElementById('petalCanvas');
const petalCtx    = petalCanvas.getContext('2d');
let petals = [];
function resizePetal() { petalCanvas.width = window.innerWidth; petalCanvas.height = window.innerHeight; }
resizePetal();
window.addEventListener('resize', resizePetal);
const petalChars = ['🌸', '💮', '✨', '🌺'];
for (let i = 0; i < 22; i++) petals.push({
    x: Math.random() * petalCanvas.width,  y: Math.random() * petalCanvas.height,
    size: 6 + Math.random() * 7,            vy: 0.3 + Math.random() * 0.65,
    vx: Math.sin(Math.random() * Math.PI * 2) * 0.28,
    char: petalChars[Math.floor(Math.random() * petalChars.length)],
    a: 0.18 + Math.random() * 0.28
});
function drawPetals() {
    if (!globalAnimActive) return;
    petalCtx.clearRect(0, 0, petalCanvas.width, petalCanvas.height);
    petals.forEach(p => {
        petalCtx.globalAlpha = p.a;
        petalCtx.font = `${p.size}px "Segoe UI Emoji"`;
        petalCtx.fillText(p.char, p.x, p.y);
        p.y -= p.vy; p.x += p.vx;
        if (p.y + p.size < 0) { p.y = petalCanvas.height; p.x = Math.random() * petalCanvas.width; }
    });
    petalCtx.globalAlpha = 1;
    petalAnimId = requestAnimationFrame(drawPetals);
}
drawPetals();

function stopAllAnimations() {
    if (starAnimId)  cancelAnimationFrame(starAnimId);
    if (petalAnimId) cancelAnimationFrame(petalAnimId);
    globalAnimActive = false;
}

// Edge case: assets done before this script ran
if (assetsLoaded >= assetsToLoad && !storyReady) {
    storyReady = true;
    revealTapScreen();
}
