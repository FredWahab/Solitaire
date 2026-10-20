import './style.css';
import { SolitaireGame } from './game/SolitaireGame.js';
import { SolitaireRenderer } from './ui/SolitaireRenderer.js';
import { SolitaireAudio } from './game/SolitaireAudio.js';

// ==================================================
// Initialization
// ==================================================

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

// ==================================================
// Constants
// ==================================================

const DRAG_THRESHOLD = 5;
const DOUBLE_TAP_DELAY = 450;
const DOUBLE_TAP_DISTANCE = 36;

const AUTO_MOVE_DURATION = 180;
const UNDO_DURATION = 230;
const RECYCLE_DURATION = 300;
const DRAW_DURATION = 185;

const VICTORY_DURATION = 1500;

// ==================================================
// Game State
// ==================================================

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

// ==================================================
// Game Mode State
// ==================================================

const storedMode = localStorage.getItem(
  'solitaire-draw-mode'
);

let selectedDrawCount = storedMode === '3' ? 3 : 1;
let pendingDrawCount = selectedDrawCount;

// ==================================================
// General Helpers
// ==================================================

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

function canAnimate() {
  return (
    !isReducedMotion() &&
    typeof Element.prototype.animate === 'function'
  );
}

function wait(milliseconds) {
  return new Promise(resolve => {
    window.setTimeout(resolve, milliseconds);
  });
}

function cardKey(card) {
  return `${card.suit}-${card.rank}`;
}

function getCardImage(card, faceUp = card.faceUp) {
  return faceUp
    ? renderer.getCardFacePath(card)
    : renderer.getCardBackPath();
}

// ==================================================
// Timer
// ==================================================

function getElapsedMilliseconds() {
  return timerStartedAt === null
    ? elapsedMilliseconds
    : elapsedMilliseconds +
        performance.now() - timerStartedAt;
}

function updateTimerDisplay() {
  const seconds = Math.floor(
    getElapsedMilliseconds() / 1000
  );

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
    timerInterval = window.setInterval(
      updateTimerDisplay,
      250
    );
  }
}

function stopTimer() {
  if (timerStartedAt !== null) {
    elapsedMilliseconds +=
      performance.now() - timerStartedAt;

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

// ==================================================
// Interface Helpers
// ==================================================

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

  const displayedMode = hasGameStarted
    ? game.drawCount
    : selectedDrawCount;

  modeButton.title =
    `Game mode: Draw ${displayedMode}`;

  modeButton.setAttribute(
    'aria-label',
    `Game mode, Draw ${displayedMode}`
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

// ==================================================
// Initial Undealt Table
// ==================================================

game.stock.push(...game.tableau.flat());

game.stock.forEach(card => {
  card.faceUp = false;
});

game.tableau = Array.from(
  { length: 7 },
  () => []
);

game.waste = [];

game.foundations = Array.from(
  { length: 4 },
  () => []
);

game.history = [];
game.score = 0;

refreshUI();
updateSoundButton();
updateTimerDisplay();

// ==================================================
// Mode Dialog
// ==================================================

function updateModeDialog() {
  drawModeInputs.forEach(input => {
    input.checked =
      Number(input.value) === pendingDrawCount;
  });

  if (!hasGameStarted) {
    modeStatus.textContent =
      `Selected: Draw ${pendingDrawCount}. ` +
      'Start a new game to apply this mode.';

    return;
  }

  if (pendingDrawCount === game.drawCount) {
    modeStatus.textContent =
      `Current game: Draw ${game.drawCount}.`;
  } else {
    modeStatus.textContent =
      `Current game: Draw ${game.drawCount}. ` +
      `New game: Draw ${pendingDrawCount}.`;
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
    pendingDrawCount = hasGameStarted
      ? game.drawCount
      : selectedDrawCount;

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

  if (activeDialog === 'mode') {
    pendingDrawCount = hasGameStarted
      ? game.drawCount
      : selectedDrawCount;
  }

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

modeCloseButton.addEventListener(
  'click',
  closeDialog
);

drawModeInputs.forEach(input => {
  input.addEventListener('change', () => {
    pendingDrawCount =
      Number(input.value) === 3 ? 3 : 1;

    updateModeDialog();
  });
});

modeStartButton.addEventListener('click', () => {
  const newDrawCount = pendingDrawCount;

  closeDialog();

  selectedDrawCount = newDrawCount;
  pendingDrawCount = newDrawCount;

  localStorage.setItem(
    'solitaire-draw-mode',
    String(selectedDrawCount)
  );

  startNewGame();
});

// ==================================================
// Interactive Tutorial
// ==================================================

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

helpCloseButton.addEventListener(
  'click',
  closeDialog
);

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

// ==================================================
// Dialog Keyboard Support
// ==================================================

document.addEventListener('keydown', event => {
  if (!activeDialog) return;

  if (event.key === 'Escape') {
    closeDialog();
    return;
  }

  if (event.key !== 'Tab') return;

  const overlay = activeDialog === 'mode'
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

// ==================================================
// Victory Confetti
// ==================================================

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

  const particles = Array.from(
    { length: 85 },
    () => ({
      x: Math.random(),
      y: -Math.random() * 0.55,
      speed: 0.35 + Math.random() * 0.35,
      drift: (Math.random() - 0.5) * 0.15,
      size: 5 + Math.random() * 6,
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 8,
      color: colors[
        Math.floor(Math.random() * colors.length)
      ]
    })
  );

  const startedAt = performance.now();

  function animate(now) {
    const progress = Math.min(
      (now - startedAt) / VICTORY_DURATION,
      1
    );

    const width = window.innerWidth;
    const height = window.innerHeight;

    const dpr = Math.min(
      window.devicePixelRatio || 1,
      2
    );

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

    context.globalAlpha = progress > 0.8
      ? Math.max(0, (1 - progress) / 0.2)
      : 1;

    particles.forEach(particle => {
      const x =
        (particle.x +
          particle.drift * progress) * width;

      const y =
        (particle.y +
          particle.speed * progress * 3) * height;

      context.save();
      context.translate(x, y);

      context.rotate(
        particle.rotation +
        particle.spin * progress
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
      victoryAnimationFrame =
        requestAnimationFrame(animate);
    } else {
      victoryAnimationFrame = null;
      canvas.remove();

      if (victoryCanvas === canvas) {
        victoryCanvas = null;
      }
    }
  }

  victoryAnimationFrame =
    requestAnimationFrame(animate);

  return VICTORY_DURATION;
}

// ==================================================
// Win / Automatic Completion
// ==================================================

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

// ==================================================
// Animation Utilities
// ==================================================

/**
 * Create a floating visual card without modifying the
 * actual game state.
 */
function createFlyingCard(
  card,
  rect,
  faceUp = card.faceUp
) {
  const element = document.createElement('div');
  element.className = 'card';

  Object.assign(element.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    zIndex: '1000',
    pointerEvents: 'none',
    margin: '0',
    transform: 'none',
    translate: 'none'
  });

  const image = document.createElement('img');
  image.className = 'card-image';

  image.src = getCardImage(card, faceUp);
  image.alt = '';
  image.draggable = false;

  element.appendChild(image);
  document.body.appendChild(element);

  return element;
}

/**
 * Move a temporary card between two screen positions.
 *
 * Its visual representation is independent of the
 * underlying SolitaireGame state.
 */
async function flyCard(
  card,
  fromRect,
  toRect,
  {
    duration = 200,
    faceUp = card.faceUp,
    reverseFace = false
  } = {}
) {
  if (!canAnimate()) return;

  const element = createFlyingCard(
    card,
    fromRect,
    faceUp
  );

  const dx = toRect.left - fromRect.left;
  const dy = toRect.top - fromRect.top;

  const animation = element.animate(
    [
      {
        transform: 'translate(0px, 0px)',
        opacity: 1
      },
      {
        transform: `translate(${dx}px, ${dy}px)`,
        opacity: 1
      }
    ],
    {
      duration,
      easing: 'cubic-bezier(0.22, 0.75, 0.25, 1)',
      fill: 'forwards'
    }
  );

  try {
    await animation.finished;
  } catch {
    // The final UI render remains authoritative.
  } finally {
    element.remove();
  }
}

/**
 * Locate individual cards as currently rendered.
 *
 * Stock cards have no individual DOM elements, so
 * their position is represented by the stock pile.
 */
function captureCardPositions() {
  const positions = new Map();

  tableauPiles.forEach((pile, pileIndex) => {
    const elements = Array.from(
      pile.querySelectorAll('.card')
    );

    game.tableau[pileIndex].forEach((card, index) => {
      const element = elements[index];

      if (!element) return;

      positions.set(cardKey(card), {
        card,
        rect: element.getBoundingClientRect(),
        zone: 'tableau',
        pileIndex,
        index,
        visible: true
      });
    });
  });

  foundationPiles.forEach((pile, pileIndex) => {
    const element = pile.querySelector('.card');
    const cards = game.foundations[pileIndex];

    if (!element || cards.length === 0) return;

    const card = cards.at(-1);

    positions.set(cardKey(card), {
      card,
      rect: element.getBoundingClientRect(),
      zone: 'foundation',
      pileIndex,
      index: cards.length - 1,
      visible: true
    });
  });

  const wasteElements = Array.from(
    wastePile.querySelectorAll('.card')
  );

  const visibleWasteCount = wasteElements.length;

  game.waste
    .slice(-visibleWasteCount)
    .forEach((card, index) => {
      const element = wasteElements[index];

      if (!element) return;

      positions.set(cardKey(card), {
        card,
        rect: element.getBoundingClientRect(),
        zone: 'waste',
        pileIndex: 0,
        index:
          game.waste.length -
          visibleWasteCount +
          index,
        visible: true
      });
    });

  // The stock is visually a single face-down pile.
  const stockRect = stockPile.getBoundingClientRect();

  game.stock.forEach((card, index) => {
    positions.set(cardKey(card), {
      card,
      rect: stockRect,
      zone: 'stock',
      pileIndex: 0,
      index,
      visible: false
    });
  });

  return positions;
}

/**
 * Record the actual location of every card,
 * including cards not individually visible.
 */
function captureCardLocations() {
  const locations = new Map();

  const add = (cards, zone, pileIndex = 0) => {
    cards.forEach((card, index) => {
      locations.set(cardKey(card), {
        card,
        zone,
        pileIndex,
        index
      });
    });
  };

  add(game.stock, 'stock');
  add(game.waste, 'waste');

  game.tableau.forEach((cards, index) => {
    add(cards, 'tableau', index);
  });

  game.foundations.forEach((cards, index) => {
    add(cards, 'foundation', index);
  });

  return locations;
}

function sameCardLocation(before, after) {
  return (
    before.zone === after.zone &&
    before.pileIndex === after.pileIndex
  );
}

// ==================================================
// Animated Opening Deal
// ==================================================

async function playDealAnimation(playSound = false) {
  isDealing = true;
  updateControls();

  const tableauCards = tableauPiles.map(pile =>
    Array.from(pile.querySelectorAll('.card'))
  );

  tableauCards.flat().forEach(card => {
    card.style.visibility = 'hidden';
  });

  if (playSound) {
    audio.start();
  }

  if (!canAnimate()) {
    tableauCards.flat().forEach(card => {
      card.style.visibility = '';
    });

    isDealing = false;
    updateControls();
    return;
  }

  const stockRect = stockPile.getBoundingClientRect();
  const animations = [];

  for (let row = 0; row < 7; row++) {
    for (let column = row; column < 7; column++) {
      const actualCard = tableauCards[column][row];

      if (!actualCard) continue;

      const destination =
        actualCard.getBoundingClientRect();

      const card = game.tableau[column][row];

      const flyingCard = createFlyingCard(
        card,
        destination,
        false
      );

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

// ==================================================
// Automatic Completion
// ==================================================

async function runAutomaticCompletion(moves) {
  isAutoCompleting = true;

  cancelDrag();
  clearLastTap();
  refreshUI();

  const startingState = game.getStateSnapshot();

  for (const {
    tableauIndex,
    foundationIndex
  } of moves) {
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

// ==================================================
// Automatic Card Movement
// ==================================================

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
    !canAnimate()
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

// ==================================================
// Animated Undo - HOTFIX
// ==================================================

/**
 * Undo the last action and animate the cards back
 * toward their original positions.
 *
 * The game engine still performs exactly one Undo.
 * This function only controls presentation.
 */
async function performAnimatedUndo() {
  if (!canInteract()) return;

  cancelDrag();
  clearLastTap();

  const beforeLocations = captureCardLocations();
  const beforePositions = captureCardPositions();

  // One game-engine Undo, unchanged.
  if (!game.undo()) return;

  automaticMoveHistory = new WeakMap();

  isDealing = true;

  // Render the restored state to determine where
  // the cards need to finish.
  refreshUI();

  const afterLocations = captureCardLocations();
  const afterPositions = captureCardPositions();

  const movements = [];

  for (const [key, destination] of afterLocations) {
    const source = beforeLocations.get(key);

    if (!source) continue;

    if (sameCardLocation(source, destination)) {
      continue;
    }

    const before = beforePositions.get(key);
    const after = afterPositions.get(key);

    let fromRect = before?.rect;
    let toRect = after?.rect;

    // A previously invisible stock card begins
    // at the stock pile.
    if (!fromRect && source.zone === 'stock') {
      fromRect = stockPile.getBoundingClientRect();
    }

    // A card returning to stock ends at the deck.
    if (!toRect && destination.zone === 'stock') {
      toRect = stockPile.getBoundingClientRect();
    }

    // A buried card returning to the waste has no
    // independent visible destination. The waste
    // pile is its visual destination.
    if (!toRect && destination.zone === 'waste') {
      toRect = wastePile.getBoundingClientRect();
    }

    // A buried waste card departing the waste pile
    // similarly begins at the waste location.
    if (!fromRect && source.zone === 'waste') {
      fromRect = wastePile.getBoundingClientRect();
    }

    if (!fromRect || !toRect) {
      continue;
    }

    // Cards in the restored state remain hidden
    // while their floating counterparts move.
    let destinationElement = null;

    if (after?.visible) {
      const destinationPile =
        destination.zone === 'tableau'
          ? tableauPiles[destination.pileIndex]
          : destination.zone === 'foundation'
            ? foundationPiles[destination.pileIndex]
            : destination.zone === 'waste'
              ? wastePile
              : null;

      if (destinationPile) {
        if (destination.zone === 'tableau') {
          destinationElement = Array.from(
            destinationPile.querySelectorAll('.card')
          )[destination.index];
        } else if (destination.zone === 'foundation') {
          destinationElement =
            destinationPile.querySelector('.card');
        } else if (destination.zone === 'waste') {
          const visibleCards = Array.from(
            wastePile.querySelectorAll('.card')
          );

          const firstVisibleIndex =
            game.waste.length - visibleCards.length;

          destinationElement =
            visibleCards[
              destination.index - firstVisibleIndex
            ];
        }
      }
    }

    // Animate only individually visible cards,
    // plus transitions into and out of stock.
    const shouldAnimate =
      Boolean(before?.visible) ||
      Boolean(after?.visible) ||
      source.zone === 'stock' ||
      destination.zone === 'stock';

    if (!shouldAnimate) continue;

    if (destinationElement) {
      destinationElement.style.visibility = 'hidden';
    }

    movements.push({
      card: destination.card,
      fromRect,
      toRect,
      destinationElement,
      faceUp: source.zone !== 'stock' &&
        (before?.card?.faceUp ?? true)
    });
  }

  audio.undo();

  try {
    if (canAnimate() && movements.length > 0) {
      await Promise.all(
        movements.map(async movement => {
          await flyCard(
            movement.card,
            movement.fromRect,
            movement.toRect,
            {
              duration: UNDO_DURATION,
              faceUp: movement.faceUp
            }
          );
        })
      );
    }
  } finally {
    movements.forEach(movement => {
      if (movement.destinationElement?.isConnected) {
        movement.destinationElement.style.visibility = '';
      }
    });

    isDealing = false;

    onSuccessfulAction();
    refreshUI();
    checkForAutomaticCompletion();
  }
}

// ==================================================
// Game Controls
// ==================================================

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

newGameButton.addEventListener(
  'click',
  startNewGame
);

playAgainButton.addEventListener(
  'click',
  startNewGame
);

undoButton.addEventListener('click', () => {
  void performAnimatedUndo();
});

soundButton.addEventListener('click', () => {
  if (isAutoCompleting || gameWon) return;

  audio.toggleMute();
  updateSoundButton();
});

timerButton.addEventListener('click', pauseGame);
resumeButton.addEventListener('click', resumeGame);

// ==================================================
// Animated Stock Draw - HOTFIX
// ==================================================

/**
 * Reveal one card, move it from stock to waste,
 * and play exactly one associated draw sound.
 */
async function animateStockDraw(card, sequence = false) {
  const stockRect = stockPile.getBoundingClientRect();

  // Render only the waste, preserving the remainder
  // of the board throughout the draw sequence.
  renderer.renderWaste();

  const wasteCards = Array.from(
    wastePile.querySelectorAll('.card')
  );

  const destinationCard = wasteCards.at(-1);

  // Start the sound at the same point as the visual.
  if (sequence) {
    audio.drawSequence();
  } else {
    audio.draw();
  }

  if (!destinationCard) {
    return;
  }

  const destinationRect =
    destinationCard.getBoundingClientRect();

  if (!canAnimate()) return;

  destinationCard.style.visibility = 'hidden';

  try {
    await flyCard(
      card,
      stockRect,
      destinationRect,
      {
        duration: DRAW_DURATION,
        faceUp: true
      }
    );
  } finally {
    if (destinationCard.isConnected) {
      destinationCard.style.visibility = '';
    }
  }
}

// ==================================================
// Stock Recycling - HOTFIX
// ==================================================

/**
 * Animate the visible waste cards moving back
 * toward the stock as a face-down deck.
 *
 * This is one recorded move for Undo.
 */
async function animateStockRecycle() {
  if (
    !canInteract() ||
    game.stock.length !== 0 ||
    game.waste.length === 0
  ) {
    return;
  }

  const wasteCards = game.waste.slice();
  const stockRect = stockPile.getBoundingClientRect();

  const wasteElements = Array.from(
    wastePile.querySelectorAll('.card')
  );

  const visibleCards = wasteCards.slice(
    -wasteElements.length
  );

  const outgoingCards = visibleCards.map(
    (card, index) => ({
      card,
      rect: wasteElements[index]
        ?.getBoundingClientRect()
        ?? wastePile.getBoundingClientRect()
    })
  );

  if (!game.recordMove(() => game.drawCard())) {
    return;
  }

  isDealing = true;
  refreshUI();

  // The new face-down stock is already in the
  // game state, but keep its image invisible
  // while the returning cards are animated.
  const stockImage = stockPile.querySelector(
    '.stock-card-image'
  );

  if (stockImage) {
    stockImage.style.visibility = 'hidden';
  }

  // Play once, at the beginning of the transition.
  // Do not add a second shuffle or draw sound.
  audio.recycle();

  try {
    if (canAnimate()) {
      const animations = outgoingCards.map(
        async ({ card, rect }, index) => {
          // Small stagger creates the impression of
          // the waste cards being collected together.
          await wait(index * 45);

          await flyCard(
            card,
            rect,
            stockRect,
            {
              duration: RECYCLE_DURATION,
              faceUp: true
            }
          );
        }
      );

      await Promise.all(animations);
    }
  } finally {
    if (stockImage?.isConnected) {
      stockImage.style.visibility = '';
    }

    isDealing = false;

    onSuccessfulAction();
    refreshUI();
    checkForAutomaticCompletion();
  }
}

// ==================================================
// Stock Interaction
// ==================================================

stockPile.addEventListener('click', async () => {
  // First interaction starts the initial deal.
  if (!hasGameStarted) {
    if (!activeDialog) {
      startNewGame();
    }

    return;
  }

  if (!canInteract()) return;

  cancelDrag();
  clearLastTap();

  // Empty stock: animate the waste returning.
  if (game.stock.length === 0) {
    await animateStockRecycle();
    return;
  }

  const drawAmount = Math.min(
    game.drawCount,
    game.stock.length
  );

  // Exactly one Undo snapshot for Draw 1 or Draw 3.
  if (!game.recordMove(() => game.drawCard())) {
    return;
  }

  const drawnCards = game.waste.splice(-drawAmount);

  isDealing = true;
  updateControls();

  // Select the coordinated sound sequence only for
  // multi-card draws.
  const useSequence = drawnCards.length > 1;

  if (useSequence) {
    audio.beginDrawSequence();
  }

  try {
    for (const card of drawnCards) {
      game.waste.push(card);

      await animateStockDraw(
        card,
        useSequence
      );

      // A small pause separates successive card
      // sounds and prevents them from blurring
      // together on mobile speakers.
      if (useSequence) {
        await wait(55);
      }
    }
  } finally {
    isDealing = false;

    onSuccessfulAction();
    refreshUI();
    checkForAutomaticCompletion();
  }
});

// ==================================================
// Card Selection
// ==================================================

function getDragSource(cardElement) {
  if (!cardElement) return null;

  const tableauElement =
    cardElement.closest('.tableau');

  if (tableauElement) {
    const pileIndex = tableauPiles.indexOf(
      tableauElement
    );

    if (pileIndex < 0) return null;

    const elements = Array.from(
      tableauElement.querySelectorAll('.card')
    );

    const cardIndex = elements.indexOf(cardElement);

    if (cardIndex < 0) return null;

    const movingCards =
      game.tableau[pileIndex].slice(cardIndex);

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

  const foundationElement =
    cardElement.closest('.foundation');

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

// ==================================================
// Card Movement
// ==================================================

function moveCard(
  source,
  destinationType,
  destinationIndex
) {
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
        game.moveWasteToFoundation(
          destinationIndex
        )
      );
    }

    if (source.type === 'tableau') {
      const sourcePile =
        game.tableau[source.pileIndex];

      if (
        source.cardIndex !==
        sourcePile.length - 1
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

// ==================================================
// Automatic Movement: Double-Click / Double-Tap
// ==================================================

function autoMoveCard(source) {
  if (
    !canInteract() ||
    source.type === 'foundation'
  ) {
    return false;
  }

  const movingCards = source.type === 'waste'
    ? game.waste.slice(-1)
    : game.tableau[source.pileIndex].slice(
        source.cardIndex
      );

  if (
    !movingCards.length ||
    !game.isValidSequence(movingCards)
  ) {
    return false;
  }

  const card = movingCards[0];

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

  const lastDestination =
    automaticMoveHistory.get(card);

  const destinationIndex =
    lastDestination === undefined
      ? destinations[0]
      : destinations.find(
          index => index > lastDestination
        ) ?? destinations[0];

  const rects = captureSourceRects(source);

  if (
    moveCard(
      source,
      'tableau',
      destinationIndex
    )
  ) {
    automaticMoveHistory.set(
      card,
      destinationIndex
    );

    return completeMove(true, {
      rects,
      destinationType: 'tableau',
      destinationIndex
    });
  }

  return false;
}

// ==================================================
// Pointer Handling
// ==================================================

function isSecondTap(source, event) {
  return (
    lastTap !== null &&
    lastTap.card === source.card &&
    lastTap.pointerType === event.pointerType &&
    performance.now() - lastTap.time <=
      DOUBLE_TAP_DELAY &&
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

  const cardElement =
    event.target.closest('.card');

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

  cardElement.setPointerCapture(
    event.pointerId
  );
});

document.addEventListener('pointermove', event => {
  if (
    !dragState ||
    event.pointerId !== dragState.pointerId
  ) {
    return;
  }

  const dx =
    event.clientX - dragState.startX;

  const dy =
    event.clientY - dragState.startY;

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

  dragState.elements.forEach(
    (element, index) => {
      element.style.zIndex =
        String(1000 + index);

      element.style.translate =
        `${dx}px ${dy}px`;

      element.style.pointerEvents = 'none';

      element.style.filter =
        'drop-shadow(0 8px 8px rgba(0,0,0,0.3))';
    }
  );
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

  const tableauDestination =
    target?.closest('.tableau');

  const foundationDestination =
    target?.closest('.foundation');

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
      tableauPiles.indexOf(
        tableauDestination
      )
    );
  } else if (foundationDestination) {
    moved = moveCard(
      source,
      'foundation',
      foundationPiles.indexOf(
        foundationDestination
      )
    );
  }

  if (moved) {
    completeMove(true);
  }
});

document.addEventListener(
  'pointercancel',
  event => {
    if (
      dragState &&
      event.pointerId === dragState.pointerId
    ) {
      cancelDrag();
      clearLastTap();
    }
  }
);

// ==================================================
// Prevent Native Browser Card Dragging
// ==================================================

app.addEventListener('dragstart', event => {
  if (event.target.closest('.card')) {
    event.preventDefault();
  }
});