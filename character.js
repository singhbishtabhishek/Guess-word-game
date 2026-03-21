(() => {
    const mount = document.getElementById("character-layer");
    if (!mount) return;

    // Change these paths to your own files.
    const characterAssets = {
        marioSrc: "assets/mario.png",
        coinSrc: "assets/coin.png",
        useMarioImage: true,
        useCoinImage: true
    };

    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    mount.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const marioEl = document.createElement("img");
    marioEl.alt = "";
    marioEl.setAttribute("aria-hidden", "true");
    marioEl.style.position = "absolute";
    marioEl.style.width = "64px";
    marioEl.style.height = "64px";
    marioEl.style.imageRendering = "pixelated";
    marioEl.style.pointerEvents = "none";
    marioEl.style.zIndex = "900";
    marioEl.style.display = "none";
    mount.appendChild(marioEl);

    let marioImageReady = false;
    if (characterAssets.useMarioImage && characterAssets.marioSrc) {
        marioEl.src = characterAssets.marioSrc;
        marioEl.addEventListener("load", () => {
            marioImageReady = true;
        });
        marioEl.addEventListener("error", () => {
            marioImageReady = false;
            marioEl.style.display = "none";
        });
    }

    const palette = {
        ".": null,
        h: "#c72828",
        s: "#f0c59a",
        r: "#d84a4a",
        o: "#2d5ec9",
        b: "#4c3320",
        m: "#5f4028",
        e: "#121212"
    };

    const idleFrame = [
        "....hhhhhhhh....",
        "...hhhhhhhhhh...",
        "...hhsssssshh...",
        "...hssseesssh...",
        "...hssmmmsssh...",
        "...hssssssss....",
        "....rrrorrr.....",
        "...rrrooorrr....",
        "...rrooooorr....",
        "...rrooooorr....",
        "....oooooo......",
        "....o.oo.o......",
        "....o.oo.o......",
        "...bb....bb.....",
        "..bbb....bbb....",
        "................"
    ];

    const walkFrames = [
        idleFrame,
        [
            "....hhhhhhhh....",
            "...hhhhhhhhhh...",
            "...hhsssssshh...",
            "...hssseesssh...",
            "...hssmmmsssh...",
            "...hssssssss....",
            "....rrrorrr.....",
            "...rrrooorrr....",
            "...rrooooorr....",
            "...rrooooorr....",
            "....oooooo......",
            "....oo.ooo......",
            "....oo.ooo......",
            "...bb....bb.....",
            "....bbb.bb......",
            "................"
        ]
    ];

    const spriteSize = 16;
    const scale = 4;
    const actorSize = spriteSize * scale;
    const updateSolidsEvery = 8;
    const stepHeight = 20;
    const keys = { left: false, right: false };
    let frameCount = 0;
    let solids = [];
    let score = 0;

    const coinEl = document.createElement("div");
    coinEl.setAttribute("aria-hidden", "true");
    coinEl.style.position = "absolute";
    coinEl.style.width = "14px";
    coinEl.style.height = "14px";
    coinEl.style.background = "#f9d447";
    coinEl.style.border = "2px solid #5b3b00";
    coinEl.style.boxSizing = "border-box";
    coinEl.style.zIndex = "899";
    coinEl.style.imageRendering = "pixelated";
    coinEl.style.backgroundRepeat = "no-repeat";
    coinEl.style.backgroundPosition = "center";
    coinEl.style.backgroundSize = "contain";
    mount.appendChild(coinEl);

    let coinImageReady = false;
    if (characterAssets.useCoinImage && characterAssets.coinSrc) {
        const coinImageProbe = new Image();
        coinImageProbe.addEventListener("load", () => {
            coinImageReady = true;
            coinEl.style.backgroundImage = `url("${characterAssets.coinSrc}")`;
            coinEl.style.backgroundColor = "transparent";
            coinEl.style.border = "0";
        });
        coinImageProbe.addEventListener("error", () => {
            coinImageReady = false;
        });
        coinImageProbe.src = characterAssets.coinSrc;
    }

    const scoreEl = document.createElement("div");
    scoreEl.setAttribute("aria-hidden", "true");
    scoreEl.style.position = "absolute";
    scoreEl.style.left = "12px";
    scoreEl.style.top = "12px";
    scoreEl.style.padding = "6px 8px";
    scoreEl.style.fontFamily = '"Press Start 2P", monospace';
    scoreEl.style.fontSize = "10px";
    scoreEl.style.background = "#f9d447";
    scoreEl.style.border = "2px solid #121212";
    scoreEl.style.color = "#121212";
    scoreEl.style.zIndex = "901";
    mount.appendChild(scoreEl);

    const coin = {
        x: 0,
        y: 0,
        size: 14,
        active: false,
        bob: 0
    };

    const state = {
        x: 40,
        y: Math.max(window.innerHeight - actorSize - 8, 20),
        vx: 0,
        vy: 0,
        speed: 2.5,
        gravity: 0.36,
        jumpVelocity: -8.1,
        facing: 1,
        onGround: false,
        frameIndex: 0,
        frameTick: 0
    };

    function worldFloor() {
        return Math.max(window.innerHeight - actorSize - 8, 20);
    }

    function maxX() {
        return Math.max(window.innerWidth - actorSize - 8, 8);
    }

    function captureSolids() {
        const nodes = document.querySelectorAll(".cell, .key");
        const list = [];

        nodes.forEach((node) => {
            const rect = node.getBoundingClientRect();
            if (rect.width < 8 || rect.height < 8) return;

            list.push({
                x: rect.left,
                y: rect.top,
                w: rect.width,
                h: rect.height
            });
        });

        solids = list;
    }

    function updateScoreUI() {
        scoreEl.textContent = `COINS ${score}`;
    }

    function respawnCoin() {
        if (solids.length === 0) {
            coin.active = false;
            coinEl.style.display = "none";
            return;
        }

        const keyPlatforms = solids.filter((block) => block.w > 20 && block.h > 20);
        const pool = keyPlatforms.length > 0 ? keyPlatforms : solids;
        const block = pool[Math.floor(Math.random() * pool.length)];

        coin.x = Math.round(block.x + block.w / 2 - coin.size / 2);
        coin.y = Math.round(block.y - coin.size - 6);
        coin.bob = Math.random() * Math.PI * 2;
        coin.active = true;
        coinEl.style.display = "block";
    }

    function updateCoinPosition() {
        if (!coin.active) {
            coinEl.style.display = "none";
            return;
        }

        if (!coinImageReady) {
            coinEl.style.backgroundColor = "#f9d447";
            coinEl.style.border = "2px solid #5b3b00";
        }

        coin.bob += 0.12;
        const bobY = Math.round(Math.sin(coin.bob) * 2);
        coinEl.style.left = `${coin.x}px`;
        coinEl.style.top = `${coin.y + bobY}px`;
    }

    function tryCollectCoin() {
        if (!coin.active) return;

        const actorLeft = state.x + 6;
        const actorTop = state.y + 4;
        const actorRight = state.x + actorSize - 6;
        const actorBottom = state.y + actorSize - 4;

        const coinLeft = coin.x;
        const coinTop = coin.y;
        const coinRight = coin.x + coin.size;
        const coinBottom = coin.y + coin.size;

        const overlaps =
            actorLeft < coinRight &&
            actorRight > coinLeft &&
            actorTop < coinBottom &&
            actorBottom > coinTop;

        if (!overlaps) return;

        score += 1;
        updateScoreUI();
        respawnCoin();
    }

    function drawFrame(frame) {
        if (marioImageReady) {
            canvas.style.display = "none";
            return;
        }

        canvas.style.display = "block";
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        if (state.facing < 0) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }

        for (let y = 0; y < frame.length; y += 1) {
            const row = frame[y];
            for (let x = 0; x < row.length; x += 1) {
                const key = row[x];
                const color = palette[key];
                if (!color) continue;

                ctx.fillStyle = color;
                ctx.fillRect(x, y, 1, 1);
            }
        }

        ctx.restore();
    }

    function currentFrame() {
        const isMoving = Math.abs(state.vx) > 0.1;
        if (!isMoving || !state.onGround) {
            return idleFrame;
        }

        state.frameTick += 1;
        if (state.frameTick % 9 === 0) {
            state.frameIndex = (state.frameIndex + 1) % walkFrames.length;
        }

        return walkFrames[state.frameIndex];
    }

    function resolveHorizontal(nextX) {
        return Math.min(Math.max(nextX, 8), maxX());
    }

    function tryStepUp(direction) {
        if (!state.onGround || direction === 0) return;

        const frontX = direction > 0 ? state.x + actorSize + 1 : state.x - 1;
        const actorMidY = state.y + actorSize - 1;
        let bestTop = Number.NEGATIVE_INFINITY;

        for (let i = 0; i < solids.length; i += 1) {
            const block = solids[i];
            const inFront = frontX >= block.x && frontX <= block.x + block.w;
            if (!inFront) continue;

            const blockTop = block.y;
            const feetAboveTop = actorMidY - blockTop;
            if (feetAboveTop < -2 || feetAboveTop > stepHeight) continue;

            if (blockTop > bestTop) {
                bestTop = blockTop;
            }
        }

        if (bestTop !== Number.NEGATIVE_INFINITY) {
            state.y = bestTop - actorSize;
            state.vy = 0;
            state.onGround = true;
        }
    }

    function resolveVertical(nextY, prevY) {
        let resolvedY = nextY;
        let grounded = false;
        const actorLeft = state.x;
        const actorRight = state.x + actorSize;

        if (state.vy >= 0) {
            const prevBottom = prevY + actorSize;
            const nextBottom = nextY + actorSize;
            let landingY = Number.POSITIVE_INFINITY;

            for (let i = 0; i < solids.length; i += 1) {
                const block = solids[i];
                const overlapX = actorRight > block.x + 2 && actorLeft < block.x + block.w - 2;
                if (!overlapX) continue;

                const platformTop = block.y;
                const crossedTopFace = prevBottom <= platformTop + 2 && nextBottom >= platformTop;
                const nearTopSnap = prevBottom <= platformTop + 10 && nextBottom >= platformTop - 4;
                if (!crossedTopFace && !nearTopSnap) continue;

                const candidateLandingY = platformTop - actorSize;
                if (candidateLandingY < landingY) {
                    landingY = candidateLandingY;
                }
            }

            if (landingY !== Number.POSITIVE_INFINITY) {
                resolvedY = landingY;
                state.vy = 0;
                grounded = true;
            }
        }

        const floor = worldFloor();
        if (resolvedY >= floor) {
            resolvedY = floor;
            state.vy = 0;
            grounded = true;
        }

        state.onGround = grounded;
        return resolvedY;
    }

    function stepPhysics() {
        let direction = 0;
        if (keys.left && !keys.right) {
            state.vx = -state.speed;
            state.facing = -1;
            direction = -1;
        } else if (keys.right && !keys.left) {
            state.vx = state.speed;
            state.facing = 1;
            direction = 1;
        } else {
            state.vx = 0;
        }

        if (direction !== 0) {
            tryStepUp(direction);
        }

        state.vy += state.gravity;
        if (state.vy > 11) state.vy = 11;

        state.x = resolveHorizontal(state.x + state.vx);
        const prevY = state.y;
        state.y = resolveVertical(state.y + state.vy, prevY);
    }

    function updatePosition() {
        const left = `${Math.round(state.x)}px`;
        const top = `${Math.round(state.y)}px`;

        canvas.style.left = left;
        canvas.style.top = top;

        if (marioImageReady) {
            marioEl.style.display = "block";
            marioEl.style.left = left;
            marioEl.style.top = top;
            marioEl.style.transform = state.facing < 0 ? "scaleX(-1)" : "scaleX(1)";
            marioEl.style.transformOrigin = "center";
        } else {
            marioEl.style.display = "none";
        }
    }

    function jump() {
        if (!state.onGround) return;
        state.vy = state.jumpVelocity;
        state.onGround = false;
    }

    function animate() {
        frameCount += 1;
        if (frameCount % updateSolidsEvery === 0) {
            captureSolids();
            if (!coin.active && solids.length > 0) {
                respawnCoin();
            }
        }

        stepPhysics();
        tryCollectCoin();
        updateCoinPosition();
        drawFrame(currentFrame());
        updatePosition();
        requestAnimationFrame(animate);
    }

    function onKeyDown(event) {
        if (event.key === "ArrowLeft") {
            keys.left = true;
            event.preventDefault();
            return;
        }

        if (event.key === "ArrowRight") {
            keys.right = true;
            event.preventDefault();
            return;
        }

        if ((event.key === "ArrowUp" || event.key === " ") && !event.repeat) {
            jump();
            event.preventDefault();
        }
    }

    function onKeyUp(event) {
        if (event.key === "ArrowLeft") keys.left = false;
        if (event.key === "ArrowRight") keys.right = false;
    }

    function onResize() {
        captureSolids();
        state.x = Math.min(Math.max(state.x, 8), maxX());
        state.y = Math.min(state.y, worldFloor());
        respawnCoin();
        updatePosition();
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    window.addEventListener("resize", onResize);

    captureSolids();
    updateScoreUI();
    respawnCoin();
    updatePosition();
    animate();
})();
