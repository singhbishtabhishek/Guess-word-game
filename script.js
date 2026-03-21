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
const definitionCache = new Map();

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

        attempts = 0;
        gameOver = false;
        currentGuess = '';
        keyStates.clear();

        createGrid();
        createKeyboard();
        
        
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

        guessArray.forEach((letter, i) => {
            const cell = cells[attempts * currentWordLength + i];
            cell.textContent = letter;
            if (letter === answerArray[i]) {
                cell.classList.add('green');
                updateKeyboardLetterState(letter, 'green');
                answerArray[i] = null;
                guessArray[i] = null;
            }
        });

        guessArray.forEach((letter, i) => {
            if (letter === null) return;
            const cell = cells[attempts * currentWordLength + i];
            if (answerArray.includes(letter)) {
                cell.classList.add('yellow');
                updateKeyboardLetterState(letter, 'yellow');
                answerArray[answerArray.indexOf(letter)] = null;
            } else {
                cell.classList.add('gray');
                updateKeyboardLetterState(letter, 'gray');
            }
        });

        if (guessWord === answerWord) {
            gameOver = true;
            await showGameEndMessage(true);
            return;
        }

        attempts += 1;
        if (attempts >= maxAttempts) {
            gameOver = true;
            await showGameEndMessage(false);
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

async function getWordDefinition(word) {
    if (definitionCache.has(word)) {
        return definitionCache.get(word);
    }

    let definition = 'Definition not found.';

    try {
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
        if (response.ok) {
            const data = await response.json();
            const extracted = data?.[0]?.meanings?.[0]?.definitions?.[0]?.definition;
            if (typeof extracted === 'string' && extracted.trim()) {
                definition = extracted.trim();
            }
        }
    } catch {
        definition = 'Definition not found.';
    }

    definitionCache.set(word, definition);
    return definition;
}

async function showGameEndMessage(isWin) {
    const definition = await getWordDefinition(answerWord);
    const resultText = isWin ? 'Correct!' : 'Incorrect.';
    if (definition === 'Definition not found.') {
        showPopup(`${resultText}\nWord: ${answerWord.toUpperCase()}\nNo meaning found.`, true);
    } else {
        showPopup(`${resultText}\nWord: ${answerWord.toUpperCase()}\nMeaning: ${definition}`, true);
    }
}

function setMessage(text) {
    document.getElementById('message').textContent = text;
}

function showPopup(text, sticky = false) {
    const popup = document.getElementById('popup');
    const popupText = document.getElementById('popup-text');
    const closeBtn = document.getElementById('popup-close');
    if (!popup || !popupText || !closeBtn) return;

    popupText.textContent = text;
    popup.classList.remove('hidden');

    if (sticky) {
        closeBtn.style.display = 'inline-block';
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

