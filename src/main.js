
import './style.css';
import { SolitaireGame } from './game/SolitaireGame.js';
import { SolitaireRenderer } from './ui/SolitaireRenderer.js';
import { SolitaireAudio } from './game/SolitaireAudio.js';

// --------------------------------------------------
// Game Initialization
// --------------------------------------------------

const game = new SolitaireGame();
const audio = new SolitaireAudio();
const app = document.querySelector('#app');

const renderer = new SolitaireRenderer(game, app);
renderer.createBoard();

// Cache board elements.
// Rendering replaces cards but preserves pile elements.
const newGameButton = app.querySelector('.new-game-button');
const undoButton = app.querySelector('.undo-button');
const soundButton = app.querySelector('.sound-button');
const scoreValue = app.querySelector('.score-value');
const timerButton = app.querySelector('.timer-button');
const timerValue = app.querySelector('.timer-value');
const pauseOverlay = app.querySelector('.pause-overlay');
const resumeButton = app.querySelector('.resume-button');
const victoryOverlay = app.querySelector('.victory-overlay');
const playAgainButton = app.querySelector('.play-again-button');
const stockPile = app.querySelector('.stock');
const wastePile = app.querySelector('.waste');
const foundationPiles = app.querySelectorAll('.foundation');
const tableauPiles = app.querySelectorAll('.tableau');

// --------------------------------------------------
// Game Timer
// --------------------------------------------------

let elapsedMilliseconds = 0;
let timerStartedAt = null;
let timerInterval = null;
let hasTimerStarted = false;

let isPaused = false;
let gameWon = false;
let isAutoCompleting = false;

function getElapsedMilliseconds() {
  if (timerStartedAt === null) {
    return elapsedMilliseconds;
  }

  return elapsedMilliseconds + (performance.now() - timerStartedAt);
}

function updateTimerDisplay() {
  const totalSeconds = Math.floor(getElapsedMilliseconds() / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  timerValue.textContent =
    `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function startTimer() {
  if (timerStartedAt !== null || isPaused || gameWon) {
    return;
  }

  hasTimerStarted = true;
  timerStartedAt = performance.now();

  if (timerInterval === null) {
    timerInterval = window.setInterval(updateTimerDisplay, 250);
  }
}

function stopTimer() {
  if (timerStartedAt !== null) {
    elapsedMilliseconds += performance.now() - timerStartedAt;
    timerStartedAt = null;
  }

  if (timerInterval !== null) {
    window.clearInterval(timerInterval);
    timerInterval = null;
  }

  updateTimerDisplay();
}

function resetTimer() {
  stopTimer();

  elapsedMilliseconds = 0;
  hasTimerStarted = false;
  isPaused = false;
  gameWon = false;

  updateTimerDisplay();
}

function pauseGame() {
  if (isPaused || gameWon || isAutoCompleting) {
    return;
  }

  stopTimer();
  isPaused = true;
  clearSelection();
  pauseOverlay.hidden = false;
}

function resumeGame() {
  if (!isPaused) {
    return;
  }

  isPaused = false;
  pauseOverlay.hidden = true;

  // Resume only if the timer had already started.
  if (hasTimerStarted) {
    startTimer();
  }
}

function onSuccessfulAction() {
  if (isPaused || gameWon) {
    return;
  }

  startTimer();
}

// --------------------------------------------------
// Card Selection
// --------------------------------------------------

// Selection formats:
// { type: 'waste' }
// { type: 'tableau', pileIndex: 0, cardIndex: 0 }
// { type: 'foundation', pileIndex: 0 }

let selection = null;

function clearSelection() {
  selection = null;

  app.querySelectorAll('.card.selected').forEach(card => {
    card.classList.remove('selected');
  });
}

function selectCard(cardElement, newSelection) {
  const isSameSelection =
    selection !== null &&
    selection.type === newSelection.type &&
    selection.pileIndex === newSelection.pileIndex &&
    selection.cardIndex === newSelection.cardIndex;

  clearSelection();

  if (isSameSelection) {
    return;
  }

  selection = newSelection;
  cardElement.classList.add('selected');
}

// --------------------------------------------------
// Interface Updates
// --------------------------------------------------

function updateControls() {
  undoButton.disabled =
    game.history.length === 0 ||
    isAutoCompleting ||
    gameWon;

  newGameButton.disabled = isAutoCompleting;
  soundButton.disabled = isAutoCompleting || gameWon;
  timerButton.disabled = isAutoCompleting || gameWon;
}

function updateSoundButton() {
  soundButton.textContent = audio.muted ? 'Sound Off' : 'Sound On';
  soundButton.setAttribute('aria-pressed', String(audio.muted));
}

function updateScoreDisplay() {
  scoreValue.textContent = String(game.score);
}

function refreshUI() {
  renderer.render();
  updateControls();
  updateScoreDisplay();
}

refreshUI();
updateSoundButton();
updateTimerDisplay();

// --------------------------------------------------
// Victory and Automatic Completion
// --------------------------------------------------

function finishGame() {
  if (gameWon) {
    return;
  }

  gameWon = true;
  stopTimer();
  clearSelection();
  refreshUI();

  audio.victory();
  victoryOverlay.hidden = false;
}

function wait(milliseconds) {
  return new Promise(resolve => {
    window.setTimeout(resolve, milliseconds);
  });
}

async function runAutomaticCompletion(moves) {
  isAutoCompleting = true;
  clearSelection();
  refreshUI();

  // Save the position before the automated sequence.
  // Normal Undo history remains untouched until completion.
  const startingState = game.getStateSnapshot();

  for (const { tableauIndex, foundationIndex } of moves) {
    const moved = game.moveTableauToFoundation(
      tableauIndex,
      foundationIndex
    );

    if (!moved) {
      // Restore the board if an unexpected move fails.
      game.stock = startingState.stock;
      game.waste = startingState.waste;
      game.foundations = startingState.foundations;
      game.tableau = startingState.tableau;
      game.score = startingState.score;

      isAutoCompleting = false;
      refreshUI();
      return;
    }

    audio.move();
    refreshUI();

    // Show each card being placed into its foundation.
    await wait(130);
  }

  isAutoCompleting = false;

  if (game.checkWin()) {
    finishGame();
  } else {
    refreshUI();
  }
}

function checkForAutomaticCompletion() {
  if (isPaused || gameWon || isAutoCompleting) {
    return;
  }

  // A normal final move can already have completed the game.
  if (game.checkWin()) {
    finishGame();
    return;
  }

  // The game model verifies that every remaining card
  // can legally reach a foundation before we begin.
  const moves = game.getAutoCompleteMoves();

  if (moves && moves.length > 0) {
    void runAutomaticCompletion(moves);
  }
}

// --------------------------------------------------
// Game Controls
// --------------------------------------------------

function startNewGame() {
  if (isAutoCompleting) {
    return;
  }

  game.newGame();
  resetTimer();
  clearSelection();

  pauseOverlay.hidden = true;
  victoryOverlay.hidden = true;

  refreshUI();
}

newGameButton.addEventListener('click', startNewGame);
playAgainButton.addEventListener('click', startNewGame);

undoButton.addEventListener('click', () => {
  if (isPaused || gameWon || isAutoCompleting) {
    return;
  }

  if (game.undo()) {
    onSuccessfulAction();
    audio.undo();
    clearSelection();
    refreshUI();

    checkForAutomaticCompletion();
  }
});

soundButton.addEventListener('click', () => {
  if (isPaused || gameWon || isAutoCompleting) {
    return;
  }

  audio.toggleMute();
  updateSoundButton();
});

timerButton.addEventListener('click', pauseGame);
resumeButton.addEventListener('click', resumeGame);

// --------------------------------------------------
// Stock and Waste Interaction
// --------------------------------------------------

stockPile.addEventListener('click', () => {
  if (isPaused || gameWon || isAutoCompleting) {
    return;
  }

  clearSelection();

  if (game.recordMove(() => game.drawCard())) {
    onSuccessfulAction();
    audio.draw();
    refreshUI();

    checkForAutomaticCompletion();
  }
});

wastePile.addEventListener('click', () => {
  if (
    isPaused ||
    gameWon ||
    isAutoCompleting ||
    game.waste.length === 0
  ) {
    return;
  }

  const cardElement = wastePile.querySelector('.card');

  if (cardElement) {
    selectCard(cardElement, { type: 'waste' });
  }
});

// --------------------------------------------------
// Tableau Interaction
// --------------------------------------------------

tableauPiles.forEach((pile, tableauIndex) => {
  pile.addEventListener('click', event => {
    if (isPaused || gameWon || isAutoCompleting) {
      return;
    }

    const cardElement = event.target.closest('.card');

    // Attempt to move the selected card to this tableau column.
    if (selection !== null) {
      let moved = false;

      if (selection.type === 'waste') {
        moved = game.recordMove(() =>
          game.moveWasteToTableau(tableauIndex)
        );
      } else if (selection.type === 'foundation') {
        moved = game.recordMove(() =>
          game.moveFoundationToTableau(
            selection.pileIndex,
            tableauIndex
          )
        );
      } else if (
        selection.type === 'tableau' &&
        selection.pileIndex !== tableauIndex
      ) {
        moved = game.recordMove(() =>
          game.moveTableauToTableau(
            selection.pileIndex,
            selection.cardIndex,
            tableauIndex
          )
        );
      }

      if (moved) {
        onSuccessfulAction();
        audio.move();
        clearSelection();
        refreshUI();

        checkForAutomaticCompletion();
        return;
      }
    }

    if (!cardElement) {
      return;
    }

    const cards = game.tableau[tableauIndex];
    const cardElements = Array.from(pile.querySelectorAll('.card'));
    const cardIndex = cardElements.indexOf(cardElement);

    if (cardIndex === -1 || !cards[cardIndex].faceUp) {
      return;
    }

    selectCard(cardElement, {
      type: 'tableau',
      pileIndex: tableauIndex,
      cardIndex
    });
  });
});

// --------------------------------------------------
// Foundation Interaction
// --------------------------------------------------

foundationPiles.forEach((pile, foundationIndex) => {
  pile.addEventListener('click', () => {
    if (isPaused || gameWon || isAutoCompleting) {
      return;
    }

    // Select or deselect a foundation card.
    if (selection === null || selection.type === 'foundation') {
      const cardElement = pile.querySelector('.card');

      if (cardElement) {
        selectCard(cardElement, {
          type: 'foundation',
          pileIndex: foundationIndex
        });
      } else {
        clearSelection();
      }

      return;
    }

    // Attempt to move the selected card into the foundation.
    let moved = false;

    if (selection.type === 'waste') {
      moved = game.recordMove(() =>
        game.moveWasteToFoundation(foundationIndex)
      );
    } else if (selection.type === 'tableau') {
      const cards = game.tableau[selection.pileIndex];

      if (selection.cardIndex === cards.length - 1) {
        moved = game.recordMove(() =>
          game.moveTableauToFoundation(
            selection.pileIndex,
            foundationIndex
          )
        );
      }
    }

    clearSelection();

    if (!moved) {
      return;
    }

    onSuccessfulAction();
    refreshUI();

    if (game.checkWin()) {
      finishGame();
    } else {
      audio.move();
      checkForAutomaticCompletion();
    }
  });
});
