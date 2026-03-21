let wordEntries = [];
let answerWord = '';
let currentGuess = '';
const maxAttempts = 6;
const minOnlineWords = 200;
const minWordLength = 4;
const maxWordLength = 8;
let currentWordLength = 5;
let attempts = 0;
let gameOver = false;
let lastKey = null;
let isSubmitting = false;
const validityCache = new Map();
const keyStates = new Map();
const themeStorageKey = 'wordgame-theme';

applyStoredTheme();
initializeGame();

async function initializeGame() {
    

    try {
        const onlineWords = await loadOnlineVocabulary();
        if (onlineWords.length < minOnlineWords) {
            showPopup('Online vocabulary is too small right now. Try refreshing.');
            return;
        }

        wordEntries = onlineWords.map((word) => ({
            word
        }));

        answerWord = await pickDictionaryAnswer();
        currentWordLength = answerWord.length;
        setWordLengthLabel(currentWordLength);

        attempts = 0;
        gameOver = false;
        currentGuess = '';
        keyStates.clear();

        createGrid();
        createKeyboard();
        setMessage('');
        
    } catch {
        showPopup('Could not load online vocabulary. Check internet and refresh.');
    }
}

async function pickDictionaryAnswer() {
    const candidates = [...wordEntries].sort(() => Math.random() - 0.5);
    const maxChecks = Math.min(40, candidates.length);

    for (let i = 0; i < maxChecks; i++) {
        const word = candidates[i].word;
        if (await isDictionaryWord(word)) {
            return word;
        }
    }

    return candidates[0]?.word || 'apple';
}

async function loadOnlineVocabulary() {
    const urls = [];
    for (let len = minWordLength; len <= maxWordLength; len++) {
        urls.push(`https://api.datamuse.com/words?sp=${'?'.repeat(len)}&max=700`);
    }
    urls.push('https://api.datamuse.com/words?topics=food&max=800');
    urls.push('https://api.datamuse.com/words?topics=nature&max=800');

    const responses = await Promise.all(
        urls.map((url) =>
            fetch(url)
                .then((response) => (response.ok ? response.json() : []))
                .catch(() => [])
        )
    );

    const uniqueWords = new Set();
    responses.flat().forEach((item) => {
        const word = typeof item?.word === 'string' ? item.word.toLowerCase() : '';
        if (
            /^[a-z]+$/.test(word) &&
            word.length >= minWordLength &&
            word.length <= maxWordLength
        ) {
            uniqueWords.add(word);
        }
    });

    return Array.from(uniqueWords);
}

function createGrid() {
    const grid = document.getElementById('game-grid');
    grid.innerHTML = '';
    grid.style.setProperty('--cols', String(currentWordLength));

    for (let i = 0; i < maxAttempts * currentWordLength; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        grid.appendChild(cell);
    }
}

function createKeyboard() {
    const keyboard = document.getElementById('keyboard');
    keyboard.innerHTML = '';

    const rows = [
        ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'Back'],
        ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
        ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Enter']
    ];
    rows.forEach((row) => {
        const rowDiv = document.createElement('div');
        rowDiv.classList.add('keyboard-row');

        row.forEach((char) => {
            const key = document.createElement('div');
            key.textContent = char;
            key.classList.add('key');
            key.dataset.key = char.toLowerCase();
            key.addEventListener('click', () => {
                highlightKey(char);
                handleKey(char);
            });
            rowDiv.appendChild(key);
        });

        keyboard.appendChild(rowDiv);
    });
}

function handleKey(char) {
    if (gameOver || isSubmitting) return;

    const normalized = char.length === 1 ? char.toLowerCase() : char;

    if (normalized === 'Back') {
        currentGuess = currentGuess.slice(0, -1);
    } else if (normalized === 'Enter') {
        submitGuess();
    } else if (/^[a-z]$/.test(normalized) && currentGuess.length < currentWordLength) {
        currentGuess += normalized;
    }

    updateGrid();
}

function updateGrid() {
    const cells = document.querySelectorAll('.cell');

    for (let i = 0; i < maxAttempts * currentWordLength; i++) {
        const row = Math.floor(i / currentWordLength);
        const col = i % currentWordLength;
        const cell = cells[i];

        if (row < attempts) {
            continue;
        }

        if (row === attempts) {
            cell.textContent = currentGuess[col] || '';
        } else {
            cell.textContent = '';
            cell.classList.remove('green', 'yellow', 'gray');
        }
    }
}

async function submitGuess() {
    if (isSubmitting || gameOver) return;

    if (currentGuess.length !== currentWordLength) {
        showPopup(`Enter a ${currentWordLength}-letter word.`);
        return;
    }

    isSubmitting = true;

    try {
        const guessWord = currentGuess.toLowerCase();
        const validWord = await isValidWord(guessWord);
        if (!validWord) {
            showPopup('Not a valid word.');
            return;
        }

        const cells = document.querySelectorAll('.cell');
        const guessArray = guessWord.split('');
        const answerArray = answerWord.split('');
        const letterStates = new Array(currentWordLength).fill('gray');

        guessArray.forEach((letter, i) => {
            if (letter === answerArray[i]) {
                letterStates[i] = 'green';
                updateKeyboardLetterState(letter, 'green');
                answerArray[i] = null;
                guessArray[i] = null;
            }
        });

        guessArray.forEach((letter, i) => {
            if (letter === null) return;
            if (answerArray.includes(letter)) {
                letterStates[i] = 'yellow';
                updateKeyboardLetterState(letter, 'yellow');
                answerArray[answerArray.indexOf(letter)] = null;
            } else {
                letterStates[i] = 'gray';
                updateKeyboardLetterState(letter, 'gray');
            }
        });

        for (let i = 0; i < currentWordLength; i++) {
            const cell = cells[attempts * currentWordLength + i];
            cell.textContent = guessWord[i];
            animateCellReveal(cell, letterStates[i], i * 110);
        }

        if (guessWord === answerWord) {
            gameOver = true;
            showGameEndMessage(true);
            return;
        }

        attempts += 1;
        if (attempts >= maxAttempts) {
            gameOver = true;
            showGameEndMessage(false);
            return;
        }

        
        currentGuess = '';
        updateGrid();
    } finally {
        isSubmitting = false;
    }
}

function updateKeyboardLetterState(letter, newState) {
    const rank = { gray: 1, yellow: 2, green: 3 };
    const oldState = keyStates.get(letter);

    if (oldState && rank[oldState] >= rank[newState]) {
        return;
    }

    keyStates.set(letter, newState);

    const key = document.querySelector(`.key[data-key="${letter}"]`);
    if (!key) return;

    key.classList.remove('state-green', 'state-yellow', 'state-gray');
    key.classList.add(`state-${newState}`);
}

async function isValidWord(word) {
    const cacheKey = `guess:${word}:${currentWordLength}`;
    if (validityCache.has(cacheKey)) {
        return validityCache.get(cacheKey);
    }

    if (!/^[a-z]+$/.test(word) || word.length !== currentWordLength) {
        validityCache.set(cacheKey, false);
        return false;
    }

    const valid = await isDictionaryWord(word);
    validityCache.set(cacheKey, valid);
    return valid;
}

async function isDictionaryWord(word) {
    const cacheKey = `dict:${word}`;
    if (validityCache.has(cacheKey)) {
        return validityCache.get(cacheKey);
    }

    try {
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
        const valid = response.ok;
        validityCache.set(cacheKey, valid);
        return valid;
    } catch {
        validityCache.set(cacheKey, false);
        return false;
    }
}

function showGameEndMessage(isWin) {
    const resultText = isWin ? 'Correct!' : 'Incorrect.';
    showPopup(`${resultText}\nWord: ${answerWord.toUpperCase()}`, true, true);
}

function setMessage(text) {
    document.getElementById('message').textContent = text;
}

function setWordLengthLabel(length) {
    const label = document.getElementById('word-length-label');
    if (!label) return;
    label.textContent = `${length}-letter word`;
}

function animateCellReveal(cell, stateClass, delayMs) {
    setTimeout(() => {
        cell.classList.remove('flip-reveal');
        cell.classList.remove('green', 'yellow', 'gray');
        void cell.offsetWidth;
        cell.classList.add('flip-reveal');

        setTimeout(() => {
            cell.classList.add(stateClass);
        }, 180);
    }, delayMs);
}

function showPopup(text, sticky = false, showReplay = false) {
    const popup = document.getElementById('popup');
    const popupCard = document.getElementById('popup-card');
    const popupText = document.getElementById('popup-text');
    const closeBtn = document.getElementById('popup-close');
    const replayBtn = document.getElementById('popup-replay');
    if (!popup || !popupCard || !popupText || !closeBtn || !replayBtn) return;

    popupText.textContent = text;
    popupCard.classList.remove('popup-flip');
    void popupCard.offsetWidth;
    popupCard.classList.add('popup-flip');
    popup.classList.remove('hidden');
    replayBtn.style.display = showReplay ? 'inline-block' : 'none';

    if (sticky) {
        closeBtn.style.display = showReplay ? 'none' : 'inline-block';
        return;
    }

    closeBtn.style.display = 'none';
    clearTimeout(showPopup.timerId);
    showPopup.timerId = setTimeout(() => {
        popup.classList.add('hidden');
    }, 1400);
}

showPopup.timerId = null;

function hidePopup() {
    const popup = document.getElementById('popup');
    if (!popup) return;
    popup.classList.add('hidden');
}

function applyStoredTheme() {
    const stored = localStorage.getItem(themeStorageKey);
    const isDark = stored === 'dark';
    document.body.classList.toggle('dark', isDark);
    updateThemeButtonLabel(isDark);
}

function toggleTheme() {
    const isDarkNow = document.body.classList.toggle('dark');
    localStorage.setItem(themeStorageKey, isDarkNow ? 'dark' : 'light');
    updateThemeButtonLabel(isDarkNow);
}

function updateThemeButtonLabel(isDark) {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const next = isDark ? 'light' : 'dark';
    btn.setAttribute('aria-label', `Switch to ${next} mode`);
    btn.setAttribute('title', `Switch to ${next} mode`);
}

function highlightKey(char) {
    const target = char.toLowerCase();
    const keys = document.querySelectorAll('.key');

    keys.forEach((key) => {
        if (key.textContent.toLowerCase() === target) {
            key.classList.add('pressed');
            setTimeout(() => key.classList.remove('pressed'), 150);
        }
    });
}

document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === lastKey) return;
    lastKey = key;

    if (key === 'enter') {
        highlightKey('Enter');
        handleKey('Enter');
    } else if (key === 'backspace') {
        highlightKey('Back');
        handleKey('Back');
    } else if (/^[a-z]$/.test(key)) {
        highlightKey(key);
        handleKey(key);
    }
});

document.addEventListener('keyup', () => {
    lastKey = null;
});

document.getElementById('popup-close')?.addEventListener('click', hidePopup);
document.getElementById('popup-replay')?.addEventListener('click', () => {
    hidePopup();
    initializeGame();
});
document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);

