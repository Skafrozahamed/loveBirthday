// ============================================
// CINEMATIC BIRTHDAY STORY v9
// - Two-audio crossfade  → no silence gaps
// - Tap-to-begin gate    → music always on from the first second
// - Scene timers lock-stepped to music durations
// ============================================

// ─────────────────── STATE ───────────────────
let currentScene    = -1;          // -1 = not started yet
const scenes        = document.querySelectorAll('.story-scene');
let slideshowInterval = null;
let autoTimer         = null;
let isTransitioning   = false;
let globalAnimActive  = true;
let starAnimId        = null;
let petalAnimId       = null;
let storyReady        = false;     // assets done?
let storyBegun        = false;     // user tapped?

// ─────────────────── AUDIO (crossfade) ───────────────────
const audioA = document.getElementById('audioA');
const audioB = document.getElementById('audioB');
audioA.volume = audioB.volume = 0;
let primary   = audioA;
let secondary = audioB;
let activeSrc = null;

const musicMap = {
    0: 'audios/Countdown.mpeg',
    1: 'audios/Page1.mpeg',
    2: 'audios/Page2.mpeg',
    3: 'audios/Page3.mpeg',
    4: 'audios/Page4.mpeg',
    5: 'audios/Page5.mpeg',
    6: 'audios/Page6.mpeg'
};
const volMap = { 0:0.42, 1:0.78, 2:0.58, 3:0.52, 4:0.68, 5:0.58, 6:0.62 };

// Crossfade: old track fades out while new track fades in simultaneously.
// No silence, no gap – both play at the same time during the 0.9 s overlap.
function crossfadeTo(sceneIdx) {
    const src = musicMap[sceneIdx];
    const vol = volMap[sceneIdx] || 0.6;

    if (!src || activeSrc === src) return;
    activeSrc = src;

    if (secondary.src !== new URL(src, window.location.href).href) {
        secondary.src = src;
        secondary.load();
    }

    secondary.currentTime = 0;
    secondary.volume = 0;

    const promise = secondary.play();

    const doFade = () => {
        gsap.to(primary, {
            volume: 0,
            duration: 2,
            ease: "power2.inOut",
            onComplete: () => {
                primary.pause();
                primary.currentTime = 0;
            }
        });

        gsap.to(secondary, {
            volume: vol,
            duration: 2,
            ease: "power2.inOut"
        });

        [primary, secondary] = [secondary, primary];
    };

    promise?.then(doFade).catch(console.warn);
}


// ─────────────────── ASSET PRELOAD ───────────────────
const imageList  = Array.from({ length: 11 }, (_, i) => `images/img${i+1}.jpg`);
const audioFiles = Object.values(musicMap);
let assetsToLoad = imageList.length + audioFiles.length;
let assetsLoaded = 0;

function onAsset() {
    assetsLoaded++;
    const pct = Math.min(100, Math.floor(assetsLoaded / assetsToLoad * 100));
    const bar  = document.getElementById('progressBar');
    const txt  = document.getElementById('loadingPercent');
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
audioFiles.forEach(src => {
    const a = new Audio();
    a.preload = 'auto';
    a.oncanplaythrough = a.onerror = onAsset;
    a.src = src;
    a.load();
});

// ─────────────────── TAP TO BEGIN ───────────────────
function revealTapScreen() {
    const loader = document.getElementById('loadingScreen');
    const tap    = document.getElementById('tapToBegin');

    gsap.to(loader, {
        opacity: 0, duration: 0.9,
        onComplete: () => {
            loader.style.display = 'none';
            tap.style.display    = 'flex';
            gsap.fromTo(tap, { opacity: 0 }, { opacity: 1, duration: 1 });

            // one-time tap/click  → start everything
            const go = () => {
                if (storyBegun) return;
                storyBegun = true;
                tap.removeEventListener('click',      go);
                tap.removeEventListener('touchstart', go);
                gsap.to(tap, { opacity: 0, duration: 0.7,
                    onComplete: () => { tap.style.display = 'none'; beginStory(); }
                });
            };
            tap.addEventListener('click',      go);
            tap.addEventListener('touchstart', go, { passive: true });
        }
    });
}

function beginStory() {
    // show scene 0, start countdown + music simultaneously
    activateScene(0);
    crossfadeTo(0);
    startCountdown();

    // show swipe hint from scene 1 onwards
    setTimeout(() => {
        const hint = document.getElementById('swipeHint');
        if (hint) hint.style.display = 'block';
    }, 12000);
}

// ─────────────────── SCENE SWITCHING ───────────────────
const transOverlay = document.getElementById('transitionOverlay');

function activateScene(idx) {
    if (idx < 0 || idx >= scenes.length) return;
    if (currentScene >= 0) scenes[currentScene].classList.remove('active');
    currentScene = idx;
    scenes[currentScene].classList.add('active');
}

function nextScene() {
function nextScene() {
    if (isTransitioning) return;
    if (currentScene < 0 || currentScene >= scenes.length - 1) return;

    isTransitioning = true;
    clearTimers();

    gsap.to(transOverlay, {
        opacity: 0.45,
        duration: 0.7,
        ease: "power2.inOut",

        onComplete: () => {

            activateScene(currentScene + 1);

            gsap.fromTo(
                scenes[currentScene],
                {
                    opacity: 0,
                    scale: 1.03
                },
                {
                    opacity: 1,
                    scale: 1,
                    duration: 1.2,
                    ease: "power2.out"
                }
            );

            crossfadeTo(currentScene);

            gsap.to(transOverlay, {
                opacity: 0,
                duration: 0.9,
                ease: "power2.inOut"
            });

            handleSceneEnter(currentScene);

            setTimeout(() => {
                isTransitioning = false;
            }, 1200);
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

// ─────────────────── SWIPE ───────────────────
let touchY = 0;
document.addEventListener('touchstart', e => { touchY = e.changedTouches[0].clientY; }, { passive: true });
document.addEventListener('touchend', e => {
    if (isTransitioning || currentScene <= 0) return;
    if (touchY - e.changedTouches[0].clientY > 55) nextScene();
}, { passive: true });

// ══════════════════════════════════════════════
//  SCENE CONTENT FUNCTIONS
// ══════════════════════════════════════════════

// ─── SCENE 0 · COUNTDOWN (10 sec) ───
let count = 10;
function startCountdown() {
    const el = document.getElementById('cdown');
    if (!el) return;
    el.textContent = count;

    const tick = setInterval(() => {
        count--;
        if (el) {
            gsap.fromTo(el,
                { scale: 1.45, opacity: 0 },
                { scale: 1,    opacity: 1, duration: 0.38, ease: 'back.out(1.7)' }
            );
            el.textContent = count > 0 ? count : '✨';
            // pulse the rings on every beat
            gsap.to('.ring', { scale: 1.06, duration: 0.12, yoyo: true, repeat: 1, stagger: 0.05 });
        }
        if (count <= 0) {
            clearInterval(tick);
            setTimeout(nextScene, 700);
        }
    }, 1000);
}

// ─── SCENE 1 · BIRTHDAY REVEAL (20 sec) ───
const birthdayLines = [
    "Today is not just your birthday",
    "Today we celebrate your smile",
    "Your kindness, your existence",
    "Somewhere, someone is grateful you were born"
];
function startBirthdayReveal() {
    const c = document.getElementById('birthdayLinesContainer');
    c.innerHTML = '';
    birthdayLines.forEach((line, i) => {
        const p = document.createElement('p');
        p.textContent = line;
        c.appendChild(p);
        gsap.fromTo(p,
            { opacity: 0, y: 14 },
            { opacity: 1, y: 0, duration: 0.7, delay: i * 0.65 }
        );
    });
    const btn = document.getElementById('nextBtn1');
    if (btn) { btn.style.display = 'inline-block'; btn.onclick = nextScene; }
    autoTimer = setTimeout(() => { if (currentScene === 1) nextScene(); }, 20000);
}

// ─── SCENE 2 · EMOTIONAL (28 sec) ───
const emotionalLines = [
    "I don't know when it started...",
    "Maybe from your smile, maybe from your silence",
    "Slowly, you became part of my thoughts",
    "Some people stay in memories...",
    "You stayed in the heart",
    "And even if words remain unspoken, feelings still exist"
];
function startEmotionalStory() {
    const c = document.getElementById('emotionalTextContainer');
    c.innerHTML = '';
    emotionalLines.forEach((line, i) => {
        const p = document.createElement('p');
        p.textContent = line;
        c.appendChild(p);
        gsap.fromTo(p,
            { opacity: 0, y: 12 },
            { opacity: 1, y: 0, duration: 0.75, delay: i * 0.58 }
        );
    });
    const btn = document.getElementById('nextBtn2');
    if (btn) { btn.style.display = 'inline-block'; btn.onclick = nextScene; }
    autoTimer = setTimeout(() => { if (currentScene === 2) nextScene(); }, 28000);
}

// ─── SCENE 3 · TYPEWRITER (33 sec) ───
const confLines = [
    "I never planned to feel this way...",
    "But your presence became something special",
    "Your smile stayed longer in my mind than it should have",
    "And maybe you'll never fully know this",
    "But somewhere, someone quietly treasures your existence",
    "More than words can ever explain"
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
            setTimeout(() => { if (currentScene === 3) nextScene(); }, 3200);
            return;
        }
        const p    = document.createElement('p');
        p.className = 'typed-line';
        c.appendChild(p);
        const text = confLines[lineIdx];
        let char   = 0;
        const iv   = setInterval(() => {
            p.textContent += text[char++];
            if (char >= text.length) {
                clearInterval(iv);
                lineIdx++;
                setTimeout(typeLine, 1350);
            }
        }, 52);
    }
    typeLine();
}

// ─── SCENE 4 · SLIDESHOW (72 sec, 11 imgs) ───
const captions = [
    "that first smile", "light that stayed", "peace in your eyes",
    "quiet warmth", "memory of laughter", "a gentle moment",
    "like soft poetry", "unspoken kindness", "starlight in you",
    "forever memory", "you are a whole universe"
];
function startPhotoSlideshow() {
    const c = document.getElementById('cardsContainer');
    c.innerHTML = '';
    const cards = imageList.map((src, i) => {
        const card   = document.createElement('div');
        card.className = 'memory-card';
        const img    = document.createElement('div');
        img.className  = 'card-img';
        img.style.backgroundImage = `url('${src}')`;
        const cap    = document.createElement('div');
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

    // 72 sec / 11 images ≈ 6.5 s per card
    slideshowInterval = setInterval(() => {
        idx++;
        if (idx >= cards.length) {
            clearInterval(slideshowInterval);
            setTimeout(() => { if (currentScene === 4) nextScene(); }, 2000);
        } else {
            show(idx);
        }
    }, 8000);
}

// ─── SCENE 5 · WISHES (36 sec) ───
const wishes = [
    "I wish your life becomes gentle",
    "I wish peace finds you everywhere",
    "I wish your dreams choose you",
    "I wish your smile never fades",
    "And even from far away, I'll always pray for your happiness"
];
function startWishesSequence() {
    const c = document.getElementById('wishesList');
    c.innerHTML = '';
    wishes.forEach((text, i) => {
        const d = document.createElement('div');
        d.className = 'wish-item';
        d.textContent = text;
        c.appendChild(d);
        gsap.fromTo(d,
            { opacity: 0, y: 18, scale: 0.96 },
            { opacity: 1, y: 0,  scale: 1,    duration: 0.75, delay: i * 0.62 }
        );
    });
    autoTimer = setTimeout(() => { if (currentScene === 5) nextScene(); }, 36000);
}

// ─── SCENE 6 · FINALE (27 sec) ───
function startFinale() {
    document.querySelectorAll('.ending-line').forEach((el, i) => {
        gsap.fromTo(el,
            { opacity: 0, y: 10 },
            { opacity: 1, y: 0,  duration: 0.95, delay: i * 0.75 }
        );
    });
    canvasConfetti({ particleCount:65, spread:75, origin:{y:0.65}, colors:['#ffb7c5','#ffd966','#fff','#c084fc'] });
    setTimeout(() => {
        canvasConfetti({ particleCount:40, spread:60, origin:{y:0.4}, colors:['#ff9fbb','#ffdf99'], shapes:['heart'] });
    }, 2200);
    setTimeout(() => {
        stopAllAnimations();
        gsap.to('body', { opacity: 0, duration: 3.2, ease: 'power2.out',
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
    canvasConfetti({ particleCount:35, spread:45, origin:{y:0.8}, colors:['#ffe0b5','#ffb3ba'] });
});
document.getElementById('replayButton')?.addEventListener('click', () => location.reload());

// ══════════════════════════════════════════════
//  BACKGROUND: STARS & PETALS
// ══════════════════════════════════════════════
const starCanvas = document.getElementById('starCanvas');
const starCtx    = starCanvas.getContext('2d');
let   stars      = [];
function resizeStar() {
    starCanvas.width  = window.innerWidth;
    starCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeStar);
resizeStar();
for (let i = 0; i < 140; i++) {
    stars.push({
        x:  Math.random() * starCanvas.width,
        y:  Math.random() * starCanvas.height,
        r:  Math.random() * 1.6 + 0.2,
        a:  Math.random() * 0.45 + 0.15,
        vy: Math.random() * 0.1  + 0.02,
        tw: Math.random() * 0.02 + 0.005,
        to: Math.random() * Math.PI * 2
    });
}
function drawStars(t) {
    if (!globalAnimActive) return;
    starCtx.clearRect(0, 0, starCanvas.width, starCanvas.height);
    stars.forEach(s => {
        const tw = s.a + Math.sin(t * s.tw + s.to) * 0.14;
        starCtx.beginPath();
        starCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        starCtx.fillStyle = `rgba(255,235,230,${Math.max(0, Math.min(1, tw))})`;
        starCtx.fill();
        s.y -= s.vy;
        if (s.y < 0) { s.y = starCanvas.height; s.x = Math.random() * starCanvas.width; }
    });
    starAnimId = requestAnimationFrame(drawStars);
}
drawStars(0);

const petalCanvas = document.getElementById('petalCanvas');
const petalCtx    = petalCanvas.getContext('2d');
let   petals      = [];
function resizePetal() {
    petalCanvas.width  = window.innerWidth;
    petalCanvas.height = window.innerHeight;
}
resizePetal();
window.addEventListener('resize', resizePetal);
const petalChars = ['🌸','💮','✨','🌺'];
for (let i = 0; i < 22; i++) {
    petals.push({
        x:    Math.random() * petalCanvas.width,
        y:    Math.random() * petalCanvas.height,
        size: 6 + Math.random() * 7,
        vy:   0.3 + Math.random() * 0.65,
        vx:   Math.sin(Math.random() * Math.PI * 2) * 0.28,
        char: petalChars[Math.floor(Math.random() * petalChars.length)],
        a:    0.18 + Math.random() * 0.28
    });
}
function drawPetals() {
    if (!globalAnimActive) return;
    petalCtx.clearRect(0, 0, petalCanvas.width, petalCanvas.height);
    petals.forEach(p => {
        petalCtx.globalAlpha = p.a;
        petalCtx.font = `${p.size}px "Segoe UI Emoji"`;
        petalCtx.fillText(p.char, p.x, p.y);
        p.y -= p.vy;
        p.x += p.vx;
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

// Edge case: if assets finished loading before script ran
if (assetsLoaded >= assetsToLoad && !storyReady) {
    storyReady = true;
    revealTapScreen();
}


[audioA, audioB].forEach(audio => {

    audio.addEventListener("ended", () => {
        console.log("Track finished");
    });

    audio.addEventListener("error", (e) => {
        console.error("Audio error:", e);
    });

    audio.addEventListener("stalled", () => {
        console.log("Audio stalled");
    });

});
