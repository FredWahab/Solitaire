import './style.css';
import { SolitaireGame } from './game/SolitaireGame.js';
import { SolitaireRenderer } from './ui/SolitaireRenderer.js';
import { SolitaireAudio } from './game/SolitaireAudio.js';

// --------------------------------------------------
// Initialization
// --------------------------------------------------

const game = new SolitaireGame();
const audio = new SolitaireAudio();
const app = document.querySelector('#app');
const renderer = new SolitaireRenderer(game, app);

renderer.createBoard();

const $ = selector => app.querySelector(selector);

const newGameButton = $('.new-game-button');
const undoButton = $('.undo-button');
const soundButton = $('.sound-button');
const modeButton = $('.mode-button');
const helpButton = $('.help-button');
const scoreValue = $('.score-value');
const timerButton = $('.timer-button');
const timerValue = $('.timer-value');
const pauseOverlay = $('.pause-overlay');
const resumeButton = $('.resume-button');
const victoryOverlay = $('.victory-overlay');
const playAgainButton = $('.play-again-button');

const modeOverlay = $('.mode-overlay');
const modeCloseButton = $('.mode-close-button');
const modeStartButton = $('.mode-start-button');
const modeStatus = $('.mode-status');
const drawModeInputs = Array.from(
  app.querySelectorAll('input[name="draw-mode"]')
);

const helpOverlay = $('.help-overlay');
const helpCloseButton = $('.help-close-button');
const helpBackButton = $('.help-back-button');
const helpNextButton = $('.help-next-button');
const helpHeading = $('.help-heading');
const helpText = $('.help-text');
const helpVisual = $('.help-visual');
const helpProgress = $('.help-progress');

const stockPile = $('.stock');
const wastePile = $('.waste');
const foundationPiles = Array.from(
  app.querySelectorAll('.foundation')
);
const tableauPiles = Array.from(
  app.querySelectorAll('.tableau')
);

// --------------------------------------------------
// Game State
// --------------------------------------------------

let elapsedMilliseconds = 0;
let timerStartedAt = null;
let timerInterval = null;
let hasTimerStarted = false;

let isPaused = false;
let gameWon = false;
let isAutoCompleting = false;
let isDealing = false;
let hasGameStarted = false;

let dragState = null;
let lastTap = null;
let automaticMoveHistory = new WeakMap();
let renderVersion = 0;

let victoryAnimationFrame = null;
let victoryCanvas = null;
let victoryDialogTimeout = null;

let activeDialog = null;
let helpStep = 0;
let dialogWasTiming = false;
let dialogFocusReturn = null;

const DRAG_THRESHOLD = 5;
const DOUBLE_TAP_DELAY = 450;
const DOUBLE_TAP_DISTANCE = 36;
const AUTO_MOVE_DURATION = 180;
const VICTORY_DURATION = 1500;

const storedMode = localStorage.getItem('solitaire-draw-mode');
let selectedDrawCount = storedMode === '3' ? 3 : 1;

function canInteract() {
  return (
    hasGameStarted &&
    !isPaused &&
    !gameWon &&
    !isAutoCompleting &&
    !isDealing &&
    !activeDialog
  );
}

function isReducedMotion() {
  return window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;
}

// --------------------------------------------------
// Timer
// --------------------------------------------------

function getElapsedMilliseconds() {
  return timerStartedAt === null
    ? elapsedMilliseconds
    : elapsedMilliseconds + performance.now() - timerStartedAt;
}

function updateTimerDisplay() {
  const seconds = Math.floor(getElapsedMilliseconds() / 1000);

  timerValue.textContent =
    `${String(Math.floor(seconds / 60)).padStart(2, '0')}:` +
    `${String(seconds % 60).padStart(2, '0')}`;
}

function startTimer() {
  if (
    timerStartedAt !== null ||
    isPaused ||
    gameWon ||
    activeDialog
  ) {
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
// Interface Helpers
// --------------------------------------------------

function clearLastTap() {
  lastTap = null;
}

function cancelDrag() {
  if (!dragState) return;

  const currentDrag = dragState;
  dragState = null;

  currentDrag.elements.forEach(element => {
    element.style.translate = '';
    element.style.zIndex = '';
    element.style.pointerEvents = '';
    element.style.filter = '';
  });

  const captured = currentDrag.captureElement;

  if (
    captured?.isConnected &&
    captured.hasPointerCapture(currentDrag.pointerId)
  ) {
    captured.releasePointerCapture(currentDrag.pointerId);
  }
}

function updateControls() {
  undoButton.disabled =
    !hasGameStarted ||
    game.history.length === 0 ||
    isAutoCompleting ||
    isDealing ||
    gameWon ||
    Boolean(activeDialog);

  newGameButton.disabled =
    isAutoCompleting ||
    isDealing ||
    Boolean(activeDialog);

  soundButton.disabled =
    isAutoCompleting ||
    gameWon;

  modeButton.disabled =
    isAutoCompleting ||
    isDealing ||
    Boolean(activeDialog);

  helpButton.disabled =
    isAutoCompleting ||
    isDealing ||
    Boolean(activeDialog);

  timerButton.disabled =
    !hasGameStarted ||
    isAutoCompleting ||
    isDealing ||
    gameWon ||
    Boolean(activeDialog);

  const modeLabel = `Draw ${selectedDrawCount}`;

  modeButton.title = `Game mode: ${modeLabel}`;
  modeButton.setAttribute(
    'aria-label',
    `Game mode, ${modeLabel}`
  );
}

function updateSoundButton() {
  soundButton.textContent =
    audio.muted ? 'Sound Off' : 'Sound On';

  soundButton.setAttribute(
    'aria-pressed',
    String(!audio.muted)
  );
}

function refreshUI() {
  renderVersion += 1;

  renderer.render();
  updateControls();

  scoreValue.textContent = String(game.score);
}

// --------------------------------------------------
// Undealt Initial Table
// --------------------------------------------------

// SolitaireGame creates a dealt game in its constructor.
// Collect its cards into the stock so the initial screen
// displays a single undealt deck.

game.stock.push(...game.tableau.flat());

game.stock.forEach(card => {
  card.faceUp = false;
});

game.tableau = Array.from({ length: 7 }, () => []);
game.waste = [];
game.foundations = Array.from({ length: 4 }, () => []);
game.history = [];
game.score = 0;

refreshUI();
updateSoundButton();
updateTimerDisplay();

// --------------------------------------------------
// Mode Dialog
// --------------------------------------------------

function updateModeDialog() {
  drawModeInputs.forEach(input => {
    input.checked =
      Number(input.value) === selectedDrawCount;
  });

  if (!hasGameStarted) {
    modeStatus.textContent =
      `Selected: Draw ${selectedDrawCount}. ` +
      'Click New Game to begin.';
  } else {
    modeStatus.textContent =
      `Current game: Draw ${game.drawCount}. ` +
      `Next game: Draw ${selectedDrawCount}.`;
  }
}

function openDialog(type) {
  if (
    isDealing ||
    isAutoCompleting ||
    activeDialog
  ) {
    return;
  }

  cancelDrag();
  clearLastTap();

  dialogFocusReturn = document.activeElement;
  dialogWasTiming = timerStartedAt !== null;

  if (dialogWasTiming) {
    stopTimer();
  }

  activeDialog = type;

  if (type === 'mode') {
    updateModeDialog();
    modeOverlay.hidden = false;
    modeCloseButton.focus();
  } else {
    helpStep = 0;
    renderHelpStep();
    helpOverlay.hidden = false;
    helpNextButton.focus();
  }

  updateControls();
}

function closeDialog() {
  if (!activeDialog) return;

  activeDialog = null;
  modeOverlay.hidden = true;
  helpOverlay.hidden = true;

  if (
    dialogWasTiming &&
    !isPaused &&
    !gameWon &&
    hasGameStarted
  ) {
    startTimer();
  }

  dialogWasTiming = false;
  updateControls();

  if (dialogFocusReturn?.isConnected) {
    dialogFocusReturn.focus();
  }

  dialogFocusReturn = null;
}

modeButton.addEventListener('click', () => {
  openDialog('mode');
});

modeCloseButton.addEventListener('click', closeDialog);

drawModeInputs.forEach(input => {
  input.addEventListener('change', () => {
    selectedDrawCount =
      Number(input.value) === 3 ? 3 : 1;

    localStorage.setItem(
      'solitaire-draw-mode',
      String(selectedDrawCount)
    );

    updateModeDialog();
    updateControls();
  });
});

modeStartButton.addEventListener('click', () => {
  closeDialog();
  startNewGame();
});

// --------------------------------------------------
// Interactive Tutorial
// --------------------------------------------------

const tutorialSteps = [
  {
    title: 'The Goal',
    visual: 'A♠  2♠  3♠  →  K♠',
    text:
      'Move all 52 cards into the four foundation piles. ' +
      'Each foundation builds from Ace through King in one suit.'
  },
  {
    title: 'The Seven Tableau Columns',
    visual: '7   6   5   4   3   2   1',
    text:
      'Seven columns form the main playing area. ' +
      'At the start, only the top card of each column is face-up. ' +
      'Move cards away to uncover hidden cards.'
  },
  {
    title: 'Alternating Colors',
    visual: 'K♠  Q♥  J♣  10♦',
    text:
      'Build tableau columns downward in rank, alternating ' +
      'red and black. For example, a red Queen can go on ' +
      'a black King.'
  },
  {
    title: 'Move Sequences',
    visual: '9♣  8♥  7♠',
    text:
      'Drag a face-up card and every card below it together, ' +
      'provided the sequence descends and alternates colors. ' +
      'Double-click or double-tap to try an automatic move.'
  },
  {
    title: 'Stock and Waste',
    visual: '▣  →  A♥',
    text:
      'Click the face-down stock to reveal cards in the waste. ' +
      'Only the top waste card is playable. When the stock is ' +
      'empty, click it to recycle the waste.'
  },
  {
    title: 'Draw 1 or Draw 3',
    visual: '1  /  3',
    text:
      'Draw 1 reveals one stock card per click. Draw 3 reveals ' +
      'up to three cards, making the game more challenging. ' +
      'Choose the mode from the Mode button before a new deal. ' +
      'Both modes allow unlimited passes through the stock.'
  },
  {
    title: 'Foundations and Kings',
    visual: 'A♥  2♥  3♥  4♥',
    text:
      'Build each foundation upward in the same suit. ' +
      'Only Kings, or valid sequences starting with Kings, ' +
      'can move into empty tableau columns.'
  },
  {
    title: 'Useful Controls',
    visual: '↻   ↶   ♫   ⚙   ?',
    text:
      'New Game reshuffles the deck. Undo reverses a move. ' +
      'Sound controls audio. Mode changes the next-game ' +
      'draw setting. The timer can also pause and resume.'
  },
  {
    title: 'You Are Ready!',
    visual: '♠  ♥  ♣  ♦',
    text:
      'Start a game with New Game or click the undealt stock. ' +
      'Move the cards carefully, uncover the hidden ones, ' +
      'and complete all four foundations to win.'
  }
];

function renderHelpStep() {
  const step = tutorialSteps[helpStep];

  helpProgress.textContent =
    `Step ${helpStep + 1} of ${tutorialSteps.length}`;

  helpVisual.textContent = step.visual;
  helpHeading.textContent = step.title;
  helpText.textContent = step.text;

  helpBackButton.disabled = helpStep === 0;

  helpNextButton.textContent =
    helpStep === tutorialSteps.length - 1
      ? 'Finish'
      : 'Next';
}

helpButton.addEventListener('click', () => {
  openDialog('help');
});

helpCloseButton.addEventListener('click', closeDialog);

helpBackButton.addEventListener('click', () => {
  if (helpStep > 0) {
    helpStep -= 1;
    renderHelpStep();
  }
});

helpNextButton.addEventListener('click', () => {
  if (helpStep === tutorialSteps.length - 1) {
    closeDialog();
  } else {
    helpStep += 1;
    renderHelpStep();
  }
});

// Dialog keyboard support
document.addEventListener('keydown', event => {
  if (!activeDialog) return;

  if (event.key === 'Escape') {
    closeDialog();
    return;
  }

  if (event.key !== 'Tab') return;

  const overlay =
    activeDialog === 'mode'
      ? modeOverlay
      : helpOverlay;

  const focusable = Array.from(
    overlay.querySelectorAll(
      'button:not(:disabled), input:not(:disabled)'
    )
  );

  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (
    event.shiftKey &&
    document.activeElement === first
  ) {
    event.preventDefault();
    last.focus();
  } else if (
    !event.shiftKey &&
    document.activeElement === last
  ) {
    event.preventDefault();
    first.focus();
  }
});

// --------------------------------------------------
// Victory Confetti
// --------------------------------------------------

function stopVictoryCelebration() {
  if (victoryAnimationFrame !== null) {
    cancelAnimationFrame(victoryAnimationFrame);
    victoryAnimationFrame = null;
  }

  if (victoryDialogTimeout !== null) {
    clearTimeout(victoryDialogTimeout);
    victoryDialogTimeout = null;
  }

  if (victoryCanvas) {
    victoryCanvas.remove();
    victoryCanvas = null;
  }
}

function playVictoryConfetti() {
  stopVictoryCelebration();

  if (isReducedMotion()) return 0;

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) return 0;

  victoryCanvas = canvas;

  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '99'
  });

  document.body.appendChild(canvas);

  const colors = [
    '#FFD166',
    '#06D6A0',
    '#4CC9F0',
    '#EF476F',
    '#FFFFFF',
    '#A7F3D0'
  ];

  const particles = Array.from({ length: 85 }, () => ({
    x: Math.random(),
    y: -Math.random() * 0.55,
    speed: 0.35 + Math.random() * 0.35,
    drift: (Math.random() - 0.5) * 0.15,
    size: 5 + Math.random() * 6,
    rotation: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 8,
    color: colors[Math.floor(Math.random() * colors.length)]
  }));

  const startedAt = performance.now();

  function animate(now) {
    const progress = Math.min(
      (now - startedAt) / VICTORY_DURATION,
      1
    );

    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);

    if (
      canvas.width !== pixelWidth ||
      canvas.height !== pixelHeight
    ) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    context.globalAlpha =
      progress > 0.8
        ? Math.max(0, (1 - progress) / 0.2)
        : 1;

    particles.forEach(particle => {
      const x =
        (particle.x + particle.drift * progress) * width;

      const y =
        (particle.y + particle.speed * progress * 3) * height;

      context.save();
      context.translate(x, y);

      context.rotate(
        particle.rotation + particle.spin * progress
      );

      context.fillStyle = particle.color;

      context.fillRect(
        -particle.size / 2,
        -particle.size / 2,
        particle.size,
        particle.size * 0.6
      );

      context.restore();
    });

    context.globalAlpha = 1;

    if (progress < 1) {
      victoryAnimationFrame = requestAnimationFrame(animate);
    } else {
      victoryAnimationFrame = null;
      canvas.remove();

      if (victoryCanvas === canvas) {
        victoryCanvas = null;
      }
    }
  }

  victoryAnimationFrame = requestAnimationFrame(animate);
  return VICTORY_DURATION;
}

// --------------------------------------------------
// Win / Automatic Completion
// --------------------------------------------------

function finishGame() {
  if (gameWon) return;

  gameWon = true;

  stopTimer();
  cancelDrag();
  clearLastTap();

  refreshUI();

  audio.victory();

  const duration = playVictoryConfetti();

  if (duration === 0) {
    victoryOverlay.hidden = false;
    return;
  }

  victoryDialogTimeout = window.setTimeout(() => {
    victoryDialogTimeout = null;

    if (gameWon) {
      victoryOverlay.hidden = false;
    }
  }, duration);
}

function wait(milliseconds) {
  return new Promise(resolve =>
    window.setTimeout(resolve, milliseconds)
  );
}

// --------------------------------------------------
// Animated Opening Deal
// --------------------------------------------------

async function playDealAnimation(playSound = false) {
  isDealing = true;
  updateControls();

  const tableauCards = tableauPiles.map(pile =>
    Array.from(pile.querySelectorAll('.card'))
  );

  tableauCards.flat().forEach(card => {
    card.style.visibility = 'hidden';
  });

  if (playSound && typeof audio.start === 'function') {
    audio.start();
  }

  if (isReducedMotion()) {
    tableauCards.flat().forEach(card => {
      card.style.visibility = '';
    });

    isDealing = false;
    updateControls();
    return;
  }

  const stockRect = stockPile.getBoundingClientRect();
  const cardBackPath = renderer.getCardBackPath();
  const animations = [];

  for (let row = 0; row < 7; row++) {
    for (let column = row; column < 7; column++) {
      const actualCard = tableauCards[column][row];

      if (!actualCard) continue;

      const destination = actualCard.getBoundingClientRect();

      const flyingCard = document.createElement('div');
      flyingCard.className = 'card';

      Object.assign(flyingCard.style, {
        position: 'fixed',
        left: `${destination.left}px`,
        top: `${destination.top}px`,
        width: `${destination.width}px`,
        height: `${destination.height}px`,
        zIndex: '1000',
        pointerEvents: 'none'
      });

      const image = document.createElement('img');
      image.className = 'card-image';
      image.src = cardBackPath;
      image.alt = '';
      image.draggable = false;

      flyingCard.appendChild(image);
      document.body.appendChild(flyingCard);

      const dx = stockRect.left - destination.left;
      const dy = stockRect.top - destination.top;

      const animation = flyingCard.animate(
        [
          {
            transform: `translate(${dx}px, ${dy}px)`
          },
          {
            transform: 'translate(0px, 0px)'
          }
        ],
        {
          duration: 240,
          easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)',
          fill: 'forwards'
        }
      );

      animations.push(
        animation.finished
          .catch(() => {})
          .then(() => {
            flyingCard.remove();
            actualCard.style.visibility = '';
          })
      );

      await wait(65);
    }
  }

  await Promise.all(animations);

  isDealing = false;
  updateControls();
}

// --------------------------------------------------
// Automatic Completion
// --------------------------------------------------

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
  if (!canInteract()) return;

  if (game.checkWin()) {
    finishGame();
    return;
  }

  const moves = game.getAutoCompleteMoves();

  if (moves && moves.length > 0) {
    void runAutomaticCompletion(moves);
  }
}

// --------------------------------------------------
// Smooth Automatic Card Movement
// --------------------------------------------------

function captureSourceRects(source) {
  return source.elements.map(element =>
    element.getBoundingClientRect()
  );
}

function animateAutomaticMove(
  sourceRects,
  destinationType,
  destinationIndex
) {
  if (
    !sourceRects ||
    !sourceRects.length ||
    typeof Element.prototype.animate !== 'function' ||
    isReducedMotion()
  ) {
    return [];
  }

  const destination =
    destinationType === 'foundation'
      ? foundationPiles[destinationIndex]
      : tableauPiles[destinationIndex];

  if (!destination) return [];

  const cards = Array.from(
    destination.querySelectorAll('.card')
  ).slice(-sourceRects.length);

  if (cards.length !== sourceRects.length) {
    return [];
  }

  return cards.map((element, index) => {
    const start = sourceRects[index];
    const end = element.getBoundingClientRect();

    const dx = start.left - end.left;
    const dy = start.top - end.top;

    return element.animate(
      [
        { translate: `${dx}px ${dy}px` },
        { translate: '0px 0px' }
      ],
      {
        duration: AUTO_MOVE_DURATION,
        easing: 'cubic-bezier(0.22, 0.8, 0.25, 1)'
      }
    );
  });
}

function completeMove(moved, animation = null) {
  if (!moved) return false;

  clearLastTap();
  onSuccessfulAction();

  audio.move();
  refreshUI();

  const version = renderVersion;

  const animations = animation
    ? animateAutomaticMove(
        animation.rects,
        animation.destinationType,
        animation.destinationIndex
      )
    : [];

  if (animations.length > 0) {
    Promise.allSettled(
      animations.map(item => item.finished)
    ).then(() => {
      if (renderVersion === version) {
        checkForAutomaticCompletion();
      }
    });
  } else {
    checkForAutomaticCompletion();
  }

  return true;
}

// --------------------------------------------------
// Game Controls
// --------------------------------------------------

function pauseGame() {
  if (
    isPaused ||
    gameWon ||
    isAutoCompleting ||
    isDealing ||
    activeDialog
  ) {
    return;
  }

  cancelDrag();
  clearLastTap();
  stopTimer();

  isPaused = true;
  pauseOverlay.hidden = false;
}

function resumeGame() {
  if (!isPaused) return;

  isPaused = false;
  pauseOverlay.hidden = true;

  if (hasTimerStarted) {
    startTimer();
  }
}

function startNewGame() {
  if (
    isAutoCompleting ||
    isDealing ||
    activeDialog
  ) {
    return;
  }

  stopVictoryCelebration();

  cancelDrag();
  clearLastTap();

  automaticMoveHistory = new WeakMap();

  game.newGame(selectedDrawCount);
  hasGameStarted = true;

  resetTimer();

  pauseOverlay.hidden = true;
  victoryOverlay.hidden = true;

  refreshUI();

  void playDealAnimation(true);
}

newGameButton.addEventListener('click', startNewGame);
playAgainButton.addEventListener('click', startNewGame);

undoButton.addEventListener('click', () => {
  if (!canInteract()) return;

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
  if (isAutoCompleting || gameWon) return;

  audio.toggleMute();
  updateSoundButton();
});

timerButton.addEventListener('click', pauseGame);
resumeButton.addEventListener('click', resumeGame);

// --------------------------------------------------
// Stock Interaction
// --------------------------------------------------

stockPile.addEventListener('click', () => {
  // Clicking the initial deck starts the first game.
  if (!hasGameStarted) {
    if (!activeDialog) {
      startNewGame();
    }

    return;
  }

  if (!canInteract()) return;

  cancelDrag();
  clearLastTap();

  const recycling = game.stock.length === 0;

  if (game.recordMove(() => game.drawCard())) {
    onSuccessfulAction();

    if (
      recycling &&
      typeof audio.recycle === 'function'
    ) {
      audio.recycle();
    } else {
      audio.draw();
    }

    refreshUI();
    checkForAutomaticCompletion();
  }
});

// --------------------------------------------------
// Card Selection
// --------------------------------------------------

function getDragSource(cardElement) {
  if (!cardElement) return null;

  const tableauElement = cardElement.closest('.tableau');

  if (tableauElement) {
    const pileIndex = tableauPiles.indexOf(tableauElement);

    if (pileIndex < 0) return null;

    const elements = Array.from(
      tableauElement.querySelectorAll('.card')
    );

    const cardIndex = elements.indexOf(cardElement);

    if (cardIndex < 0) return null;

    const movingCards = game.tableau[pileIndex].slice(cardIndex);

    if (
      !movingCards.length ||
      !game.isValidSequence(movingCards)
    ) {
      return null;
    }

    return {
      type: 'tableau',
      pileIndex,
      cardIndex,
      card: movingCards[0],
      elements: elements.slice(cardIndex)
    };
  }

  if (wastePile.contains(cardElement)) {
    const card = game.waste.at(-1);

    return card
      ? {
          type: 'waste',
          card,
          elements: [cardElement]
        }
      : null;
  }

  const foundationElement = cardElement.closest('.foundation');

  if (foundationElement) {
    const pileIndex = foundationPiles.indexOf(
      foundationElement
    );

    if (pileIndex < 0) return null;

    const card = game.foundations[pileIndex].at(-1);

    return card
      ? {
          type: 'foundation',
          pileIndex,
          card,
          elements: [cardElement]
        }
      : null;
  }

  return null;
}

// --------------------------------------------------
// Card Movement
// --------------------------------------------------

function moveCard(source, destinationType, destinationIndex) {
  if (!canInteract()) return false;

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

      if (
        source.cardIndex !== sourcePile.length - 1
      ) {
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
// Automatic Movement: Double-Click / Double-Tap
// --------------------------------------------------

function autoMoveCard(source) {
  if (
    !canInteract() ||
    source.type === 'foundation'
  ) {
    return false;
  }

  const movingCards = source.type === 'waste'
    ? game.waste.slice(-1)
    : game.tableau[source.pileIndex].slice(source.cardIndex);

  if (
    !movingCards.length ||
    !game.isValidSequence(movingCards)
  ) {
    return false;
  }

  const card = movingCards[0];

  // Only a single card may move to a foundation.
  if (movingCards.length === 1) {
    for (let i = 0; i < foundationPiles.length; i++) {
      if (!game.canMoveToFoundation(card, i)) {
        continue;
      }

      const rects = captureSourceRects(source);

      if (moveCard(source, 'foundation', i)) {
        return completeMove(true, {
          rects,
          destinationType: 'foundation',
          destinationIndex: i
        });
      }
    }
  }

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

  if (!destinations.length) {
    return false;
  }

  const lastDestination = automaticMoveHistory.get(card);

  const destinationIndex = lastDestination === undefined
    ? destinations[0]
    : destinations.find(index => index > lastDestination) ??
      destinations[0];

  const rects = captureSourceRects(source);

  if (moveCard(source, 'tableau', destinationIndex)) {
    automaticMoveHistory.set(card, destinationIndex);

    return completeMove(true, {
      rects,
      destinationType: 'tableau',
      destinationIndex
    });
  }

  return false;
}

// --------------------------------------------------
// Pointer Handling
// --------------------------------------------------

function isSecondTap(source, event) {
  return (
    lastTap !== null &&
    lastTap.card === source.card &&
    lastTap.pointerType === event.pointerType &&
    performance.now() - lastTap.time <= DOUBLE_TAP_DELAY &&
    Math.hypot(
      event.clientX - lastTap.x,
      event.clientY - lastTap.y
    ) <= DOUBLE_TAP_DISTANCE
  );
}

app.addEventListener('pointerdown', event => {
  if (
    !canInteract() ||
    dragState ||
    event.button !== 0 ||
    !event.isPrimary
  ) {
    return;
  }

  const cardElement = event.target.closest('.card');

  if (!cardElement) {
    clearLastTap();
    return;
  }

  const source = getDragSource(cardElement);

  if (!source) {
    clearLastTap();
    return;
  }

  event.preventDefault();

  // Execute an automatic move on the second tap.
  if (
    source.type !== 'foundation' &&
    isSecondTap(source, event)
  ) {
    clearLastTap();
    autoMoveCard(source);
    return;
  }

  clearLastTap();

  dragState = {
    ...source,
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    captureElement: cardElement,
    startX: event.clientX,
    startY: event.clientY,
    dragging: false
  };

  cardElement.setPointerCapture(event.pointerId);
});

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
    ? document.elementFromPoint(
        event.clientX,
        event.clientY
      )
    : null;

  const tableauDestination = target?.closest('.tableau');
  const foundationDestination = target?.closest('.foundation');

  cancelDrag();

  if (!canInteract()) return;

  if (!wasDragging) {
    if (source.type !== 'foundation') {
      lastTap = {
        card: source.card,
        pointerType: source.pointerType,
        time: performance.now(),
        x: event.clientX,
        y: event.clientY
      };
    }

    return;
  }

  let moved = false;

  if (tableauDestination) {
    moved = moveCard(
      source,
      'tableau',
      tableauPiles.indexOf(tableauDestination)
    );
  } else if (foundationDestination) {
    moved = moveCard(
      source,
      'foundation',
      foundationPiles.indexOf(foundationDestination)
    );
  }

  if (moved) {
    completeMove(true);
  }
});

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
// Prevent Native Browser Card Dragging
// --------------------------------------------------

app.addEventListener('dragstart', event => {
  if (event.target.closest('.card')) {
    event.preventDefault();
  }
});