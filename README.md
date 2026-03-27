# Guess the Word Game
A fun Wordle-style browser game built using HTML, CSS, and JavaScript. Guess hidden word within limited attempts.

## Features
- Dynamic word lengths (4–8 letters)
- Online vocabulary using APIs
- Wordle-style color feedback: Green → Correct position Yellow → Wrong position Red → Not in word
- Retro UI

## Try
https://singhbishtabhishek.github.io/Guess-word-game/

## How It Works
- Words are fetched from the **Datamuse API**
- Each guess is validated using a **dictionary API**
- The game randomly selects a valid word
- Player gets **6 attempts** to guess it

  ## APIs Used
  - https://api.datamuse.com/
  - https://dictionaryapi.dev/
 
  ## How to Play
  - Enter a valid word
  - Use color hints to improve your guess
  - guess within 6 attempts
 
  ## Run locally
  1. Clone the repository:
     ```bash
     https://github.com/singhbishtabhishek/Guess-word-game.git
     ```
  2. Open the folder:
     ```bash
     cd guess-the-word
     ```
  3. Open index.html and play
