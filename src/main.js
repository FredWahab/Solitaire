
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
const foundationPiles = Array.from(app.querySelectorAll('.foundation'));
const tableauPiles = Array.from(app.querySelectorAll('.tableau'));

// --------------------------------------------------
// Game State and Timer
// --------------------------------------------------

let elapsedMilliseconds = 0;
let timerStartedAt = null;
let timerInterval = null;
let hasTimerStarted = false;

let isPaused = false;
let gameWon = false;
let isAutoCompleting = false;

function canInteract() {
  return !isPaused && !gameWon && !isAutoCompleting;
}

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

function onSuccessfulAction() {
  if (!isPaused && !gameWon) {
    startTimer();
  }
}

// --------------------------------------------------
// Drag and Automatic Move State
// --------------------------------------------------

let dragState = null;
let lastTap = null;

// Remembers the last tableau destination chosen for
// each card. The card at the start of a sequence is
// used to identify that sequence during cycling.
let automaticMoveHistory = new WeakMap();

const DRAG_THRESHOLD = 5;
const DOUBLE_TAP_DELAY = 350;
const DOUBLE_TAP_DISTANCE = 25;

function clearLastTap() {
  lastTap = null;
}

function cancelDrag() {
  if (!dragState) {
    return;
  }

  const currentDrag = dragState;
  dragState = null;

  currentDrag.elements.forEach(element => {
    element.style.translate = '';
    element.style.zIndex = '';
    element.style.pointerEvents = '';
    element.style.filter = '';
  });

  const captureElement = currentDrag.captureElement;

  if (
    captureElement?.isConnected &&
    captureElement.hasPointerCapture(currentDrag.pointerId)
  ) {
    captureElement.releasePointerCapture(currentDrag.pointerId);
  }
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
  cancelDrag();
  clearLastTap();

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

  cancelDrag();
  clearLastTap();
  refreshUI();

  const startingState = game.getStateSnapshot();

  for (const { tableauIndex, foundationIndex } of moves) {
    const moved = game.moveTableauToFoundation(
      tableauIndex,
      foundationIndex
    );

    if (!moved) {
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
  if (!canInteract()) {
    return;
  }

  if (game.checkWin()) {
    finishGame();
    return;
  }

  const moves = game.getAutoCompleteMoves();

  if (moves && moves.length > 0) {
    void runAutomaticCompletion(moves);
  }
}

function completeMove(moved) {
  if (!moved) {
    return false;
  }

  clearLastTap();
  onSuccessfulAction();

  audio.move();
  refreshUI();

  checkForAutomaticCompletion();

  return true;
}

// --------------------------------------------------
// Pause and Game Controls
// --------------------------------------------------

function pauseGame() {
  if (isPaused || gameWon || isAutoCompleting) {
    return;
  }

  cancelDrag();
  clearLastTap();
  stopTimer();

  isPaused = true;
  pauseOverlay.hidden = false;
}

function resumeGame() {
  if (!isPaused) {
    return;
  }

  isPaused = false;
  pauseOverlay.hidden = true;

  if (hasTimerStarted) {
    startTimer();
  }
}

function startNewGame() {
  if (isAutoCompleting) {
    return;
  }

  cancelDrag();
  clearLastTap();

  automaticMoveHistory = new WeakMap();

  game.newGame();
  resetTimer();

  pauseOverlay.hidden = true;
  victoryOverlay.hidden = true;

  refreshUI();
}

newGameButton.addEventListener('click', startNewGame);
playAgainButton.addEventListener('click', startNewGame);

undoButton.addEventListener('click', () => {
  if (!canInteract()) {
    return;
  }

  cancelDrag();
  clearLastTap();

  if (game.undo()) {
    automaticMoveHistory = new WeakMap();

    onSuccessfulAction();
    audio.undo();
    refreshUI();

    checkForAutomaticCompletion();
  }
});

soundButton.addEventListener('click', () => {
  if (isAutoCompleting || gameWon) {
    return;
  }

  audio.toggleMute();
  updateSoundButton();
});

timerButton.addEventListener('click', pauseGame);
resumeButton.addEventListener('click', resumeGame);

// --------------------------------------------------
// Stock Interaction
// --------------------------------------------------

stockPile.addEventListener('click', () => {
  if (!canInteract()) {
    return;
  }

  cancelDrag();
  clearLastTap();

  if (game.recordMove(() => game.drawCard())) {
    onSuccessfulAction();
    audio.draw();

    refreshUI();
    checkForAutomaticCompletion();
  }
});

// --------------------------------------------------
// Drag Source Identification
// --------------------------------------------------

function getDragSource(cardElement) {
  if (!cardElement) {
    return null;
  }

  const tableauElement = cardElement.closest('.tableau');

  if (tableauElement) {
    const pileIndex = tableauPiles.indexOf(tableauElement);

    if (pileIndex < 0) {
      return null;
    }

    const cardElements = Array.from(
      tableauElement.querySelectorAll('.card')
    );

    const cardIndex = cardElements.indexOf(cardElement);

    if (cardIndex < 0) {
      return null;
    }

    const movingCards = game.tableau[pileIndex].slice(cardIndex);

    if (
      movingCards.length === 0 ||
      !game.isValidSequence(movingCards)
    ) {
      return null;
    }

    return {
      type: 'tableau',
      pileIndex,
      cardIndex,
      card: movingCards[0],
      elements: cardElements.slice(cardIndex)
    };
  }

  if (wastePile.contains(cardElement)) {
    if (game.waste.length === 0) {
      return null;
    }

    return {
      type: 'waste',
      card: game.waste[game.waste.length - 1],
      elements: [cardElement]
    };
  }

  const foundationElement = cardElement.closest('.foundation');

  if (foundationElement) {
    const pileIndex = foundationPiles.indexOf(foundationElement);

    if (pileIndex < 0) {
      return null;
    }

    const foundation = game.foundations[pileIndex];

    if (foundation.length === 0) {
      return null;
    }

    return {
      type: 'foundation',
      pileIndex,
      card: foundation[foundation.length - 1],
      elements: [cardElement]
    };
  }

  return null;
}

// --------------------------------------------------
// Move Execution
// --------------------------------------------------

function moveCard(source, destinationType, destinationIndex) {
  if (!canInteract()) {
    return false;
  }

  if (destinationType === 'tableau') {
    if (
      destinationIndex < 0 ||
      destinationIndex >= tableauPiles.length
    ) {
      return false;
    }

    if (source.type === 'tableau') {
      if (source.pileIndex === destinationIndex) {
        return false;
      }

      return game.recordMove(() =>
        game.moveTableauToTableau(
          source.pileIndex,
          source.cardIndex,
          destinationIndex
        )
      );
    }

    if (source.type === 'waste') {
      return game.recordMove(() =>
        game.moveWasteToTableau(destinationIndex)
      );
    }

    if (source.type === 'foundation') {
      return game.recordMove(() =>
        game.moveFoundationToTableau(
          source.pileIndex,
          destinationIndex
        )
      );
    }
  }

  if (destinationType === 'foundation') {
    if (
      destinationIndex < 0 ||
      destinationIndex >= foundationPiles.length
    ) {
      return false;
    }

    if (source.type === 'waste') {
      return game.recordMove(() =>
        game.moveWasteToFoundation(destinationIndex)
      );
    }

    if (source.type === 'tableau') {
      const sourcePile = game.tableau[source.pileIndex];

      // Only a single top card may enter a foundation.
      if (source.cardIndex !== sourcePile.length - 1) {
        return false;
      }

      return game.recordMove(() =>
        game.moveTableauToFoundation(
          source.pileIndex,
          destinationIndex
        )
      );
    }
  }

  return false;
}

// --------------------------------------------------
// Automatic Card Movement
// --------------------------------------------------

// Double-click or double-tap any valid tableau card,
// including a card in the middle of a sequence.
//
// The clicked card and all cards beneath it move
// together to the next legal tableau destination.
//
// Single cards may also move to foundations.
//
// Repeated automatic moves cycle through legal
// tableau columns.

function autoMoveCard(source) {
  if (!canInteract() || source.type === 'foundation') {
    return false;
  }

  let card;
  let movingCards;

  if (source.type === 'waste') {
    card = game.waste[game.waste.length - 1];

    if (!card) {
      return false;
    }

    movingCards = [card];
  } else {
    const pile = game.tableau[source.pileIndex];

    movingCards = pile.slice(source.cardIndex);

    if (
      movingCards.length === 0 ||
      !game.isValidSequence(movingCards)
    ) {
      return false;
    }

    card = movingCards[0];
  }

  const isSingleCard = movingCards.length === 1;

  // Only single cards can automatically move
  // to a foundation.
  if (isSingleCard) {
    for (let i = 0; i < foundationPiles.length; i++) {
      if (!game.canMoveToFoundation(card, i)) {
        continue;
      }

      const moved = moveCard(source, 'foundation', i);

      if (moved) {
        return completeMove(true);
      }
    }
  }

  // Find legal tableau destinations for the clicked
  // card. The game engine validates the actual move
  // of the complete sequence.
  const destinations = [];

  for (let i = 0; i < tableauPiles.length; i++) {
    if (
      source.type === 'tableau' &&
      source.pileIndex === i
    ) {
      continue;
    }

    if (game.canMoveToTableau(card, i)) {
      destinations.push(i);
    }
  }

  if (destinations.length === 0) {
    return false;
  }

  // Pick the first destination after the last
  // automatically chosen one. Wrap around when
  // necessary.
  const lastDestination = automaticMoveHistory.get(card);

  let nextDestination = destinations[0];

  if (lastDestination !== undefined) {
    nextDestination =
      destinations.find(index => index > lastDestination) ??
      destinations[0];
  }

  const moved = moveCard(
    source,
    'tableau',
    nextDestination
  );

  if (moved) {
    automaticMoveHistory.set(card, nextDestination);
    return completeMove(true);
  }

  return false;
}

// --------------------------------------------------
// Double-Click / Double-Tap Detection
// --------------------------------------------------

function handleCardTap(source, x, y) {
  if (source.type === 'foundation') {
    clearLastTap();
    return;
  }

  const now = performance.now();

  const isDoubleTap =
    lastTap !== null &&
    lastTap.card === source.card &&
    now - lastTap.time <= DOUBLE_TAP_DELAY &&
    Math.hypot(x - lastTap.x, y - lastTap.y) <= DOUBLE_TAP_DISTANCE;

  if (isDoubleTap) {
    clearLastTap();
    autoMoveCard(source);
    return;
  }

  lastTap = {
    card: source.card,
    time: now,
    x,
    y
  };
}

// --------------------------------------------------
// Pointer Down
// --------------------------------------------------

app.addEventListener('pointerdown', event => {
  if (!canInteract() || dragState) {
    return;
  }

  if (event.button !== 0 || !event.isPrimary) {
    return;
  }

  const cardElement = event.target.closest('.card');

  if (!cardElement) {
    return;
  }

  const source = getDragSource(cardElement);

  if (!source) {
    return;
  }

  event.preventDefault();

  dragState = {
    ...source,
    pointerId: event.pointerId,
    captureElement: cardElement,
    startX: event.clientX,
    startY: event.clientY,
    dragging: false
  };

  cardElement.setPointerCapture(event.pointerId);
});

// --------------------------------------------------
// Pointer Move
// --------------------------------------------------

document.addEventListener('pointermove', event => {
  if (
    !dragState ||
    event.pointerId !== dragState.pointerId
  ) {
    return;
  }

  const dx = event.clientX - dragState.startX;
  const dy = event.clientY - dragState.startY;

  if (
    !dragState.dragging &&
    Math.hypot(dx, dy) < DRAG_THRESHOLD
  ) {
    return;
  }

  if (!dragState.dragging) {
    dragState.dragging = true;
    clearLastTap();
  }

  dragState.elements.forEach((element, index) => {
    element.style.zIndex = String(1000 + index);
    element.style.translate = `${dx}px ${dy}px`;
    element.style.pointerEvents = 'none';
    element.style.filter =
      'drop-shadow(0 8px 8px rgba(0,0,0,0.3))';
  });
});

// --------------------------------------------------
// Pointer Up / Drop Handling
// --------------------------------------------------

document.addEventListener('pointerup', event => {
  if (
    !dragState ||
    event.pointerId !== dragState.pointerId
  ) {
    return;
  }

  const source = dragState;
  const wasDragging = source.dragging;

  const target = wasDragging
    ? document.elementFromPoint(event.clientX, event.clientY)
    : null;

  const tableauDestination = target?.closest('.tableau');
  const foundationDestination = target?.closest('.foundation');

  cancelDrag();

  if (!canInteract()) {
    return;
  }

  if (!wasDragging) {
    handleCardTap(
      source,
      event.clientX,
      event.clientY
    );
    return;
  }

  let moved = false;

  if (tableauDestination) {
    const toIndex = tableauPiles.indexOf(
      tableauDestination
    );

    moved = moveCard(source, 'tableau', toIndex);
  } else if (foundationDestination) {
    const foundationIndex = foundationPiles.indexOf(
      foundationDestination
    );

    moved = moveCard(
      source,
      'foundation',
      foundationIndex
    );
  }

  if (moved) {
    completeMove(true);
  }
});

// --------------------------------------------------
// Pointer Cancellation
// --------------------------------------------------

document.addEventListener('pointercancel', event => {
  if (
    dragState &&
    event.pointerId === dragState.pointerId
  ) {
    cancelDrag();
    clearLastTap();
  }
});

// --------------------------------------------------
// Browser Drag Prevention
// --------------------------------------------------

app.addEventListener('dragstart', event => {
  if (event.target.closest('.card')) {
    event.preventDefault();
  }
});
