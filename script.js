let words = [];
let answer = '';
let currentGuess = '';
let maxAttempts = 6;
let attempts = 0;

fetch('words.json')
  .then(response => response.json())
  .then(data => {
    words = data;
    answer = words[Math.floor(Math.random() * words.length)];
    console.log("Answer:", answer); // For testing
    createGrid();
    createKeyboard();
  });

function createGrid() {
    const grid = document.getElementById('game-grid');
    for (let i = 0; i < maxAttempts * 5; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        grid.appendChild(cell);
    }
}

function createKeyboard() {
    const keyboard = document.getElementById('keyboard');
    keyboard.innerHTML = '';

    const rows = [
        ['q','w','e','r','t','y','u','i','o','p','del'],
        ['a','s','d','f','g','h','j','k','l'],
        ['z','x','c','v','b','n','m','Enter']
    ];

    rows.forEach(row => {
        const rowDiv = document.createElement('div');
        rowDiv.classList.add('keyboard-row');

        row.forEach(char => {
            const key = document.createElement('div');
            key.textContent = char;
            key.classList.add('key');

            // Only handle click events here
            key.addEventListener('click', () => handleKey(char));

            rowDiv.appendChild(key);
        });

        keyboard.appendChild(rowDiv);
    });
}

function handleKey(char) {
    // Ignore input if game is over
    if (attempts >= maxAttempts) return;

    if (char === 'Back') {
        currentGuess = currentGuess.slice(0, -1);
    } else if (char === 'Enter') {
        submitGuess();
    } else if (/^[a-z]$/.test(char)) {
        // Only add one letter if current guess is less than 5 letters
        if (currentGuess.length < 5) {
            currentGuess += char;
        }
    }

    updateGrid();
}

function updateGrid() {
    const cells = document.querySelectorAll('.cell');

    for (let i = 0; i < maxAttempts * 5; i++) {
        const row = Math.floor(i / 5);
        const col = i % 5;
        const cell = cells[i];

        if (row < attempts) {
            // already submitted row → do nothing, keep letters and colors
            continue;
        } else if (row === attempts) {
            // current row → show typed letters
            cell.textContent = currentGuess[col] || '';
        } else {
            // future rows → clear
            cell.textContent = '';
        }
    }
}

function submitGuess() {
    if (currentGuess.length !== 5) return;

    const cells = document.querySelectorAll('.cell');

    let guessArray = currentGuess.split('');
    let answerArray = answer.split('');

    // First pass: mark greens
    guessArray.forEach((letter, i) => {
        const cell = cells[attempts * 5 + i];
        if (letter === answerArray[i]) {
            cell.classList.add('green');
            answerArray[i] = null;
            guessArray[i] = null;
        }
    });

    // Second pass: mark yellows
    guessArray.forEach((letter, i) => {
        if (letter === null) return;
        const cell = cells[attempts * 5 + i];
        if (answerArray.includes(letter)) {
            cell.classList.add('yellow');
            answerArray[answerArray.indexOf(letter)] = null;
        } else {
            cell.classList.add('gray');
        }
    });

    // Update message
    if (currentGuess === answer) {
        document.getElementById('message').textContent = 'Correct! You guessed it!';
    } else {
        attempts++;
        if (attempts >= maxAttempts) {
            document.getElementById('message').textContent = `You Lose! The word was ${answer}`;
        }
    }

    currentGuess = ''; // clear current guess after coloring and incrementing attempts
    updateGrid();      // now update the grid — current row is cleared, previous rows remain visible
}


function highlightKey(char) {
    const keys = document.querySelectorAll('.key');
    keys.forEach(k => {
        if (k.textContent.toLowerCase() === char) {
            k.classList.add('pressed');
            setTimeout(() => k.classList.remove('pressed'), 200);
        }
    });
}


document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();

    // Ignore repeated key holding
    if (key === lastKey) return;

    lastKey = key; // mark this key as pressed

    if (key === 'enter') handleKey('Enter');
    else if (key === 'backspace') handleKey('Back');
    else if (/^[a-z]$/.test(key)) handleKey(key);
});

document.addEventListener('keyup', (e) => {
    lastKey = null; // reset when key is released
});

