
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

const DRAG_THRESHOLD = 5;
const DOUBLE_TAP_DELAY = 450;
const DOUBLE_TAP_DISTANCE = 36;
const AUTO_MOVE_DURATION = 180;

// Victory animation state
let victoryAnimationFrame = null;
let victoryCanvas = null;
let victoryDialogTimeout = null;

const VICTORY_DURATION = 1500;

function canInteract() {
  return (
    hasGameStarted &&
    !isPaused &&
    !gameWon &&
    !isAutoCompleting &&
    !isDealing
  );
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
  if (timerStartedAt !== null || isPaused || gameWon) return;

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
// Interface
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
    gameWon;

  newGameButton.disabled = isAutoCompleting || isDealing;

  soundButton.disabled = isAutoCompleting || gameWon;

  timerButton.disabled =
    !hasGameStarted ||
    isAutoCompleting ||
    isDealing ||
    gameWon;
}

function updateSoundButton() {
  soundButton.textContent = audio.muted ? 'Sound Off' : 'Sound On';
  soundButton.setAttribute('aria-pressed', String(audio.muted));
}

// --------------------------------------------------
// Initial Table Setup
// --------------------------------------------------

// SolitaireGame automatically deals cards in its constructor.
// Gather them into the stock so the page initially shows
// an undealt deck. New Game will generate a fresh shuffle.

game.stock.push(...game.tableau.flat());

game.stock.forEach(card => {
  card.faceUp = false;
});

game.tableau = Array.from({ length: 7 }, () => []);
game.waste = [];
game.foundations = Array.from({ length: 4 }, () => []);
game.history = [];
game.score = 0;

function refreshUI() {
  renderVersion += 1;

  renderer.render();
  updateControls();

  scoreValue.textContent = String(game.score);
}

refreshUI();
updateSoundButton();
updateTimerDisplay();

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

  if (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return 0;
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) return 0;

  victoryCanvas = canvas;

  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '99';

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
    const elapsed = now - startedAt;
    const progress = Math.min(
      elapsed / VICTORY_DURATION,
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

    const opacity = progress > 0.8
      ? (1 - progress) / 0.2
      : 1;

    context.globalAlpha = Math.max(0, opacity);

    particles.forEach(particle => {
      const x = (
        particle.x + particle.drift * progress
      ) * width;

      const y = (
        particle.y + particle.speed * progress * 3
      ) * height;

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

  // Play the existing victory sound.
  audio.victory();

  // Celebrate before displaying the victory panel.
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

  // Hide the already-rendered cards until they land.
  tableauCards.flat().forEach(card => {
    card.style.visibility = 'hidden';
  });

  if (playSound && typeof audio.start === 'function') {
    audio.start();
  }

  const reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  if (reduceMotion) {
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

  // Deal in rounds across the seven tableau columns.
  for (let row = 0; row < 7; row++) {
    for (let column = row; column < 7; column++) {
      const actualCard = tableauCards[column][row];

      if (!actualCard) continue;

      const destination = actualCard.getBoundingClientRect();

      const flyingCard = document.createElement('div');
      flyingCard.className = 'card';

      flyingCard.style.position = 'fixed';
      flyingCard.style.left = `${destination.left}px`;
      flyingCard.style.top = `${destination.top}px`;
      flyingCard.style.width = `${destination.width}px`;
      flyingCard.style.height = `${destination.height}px`;
      flyingCard.style.zIndex = '1000';
      flyingCard.style.pointerEvents = 'none';

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

      const finished = animation.finished
        .catch(() => {})
        .then(() => {
          flyingCard.remove();
          actualCard.style.visibility = '';
        });

      animations.push(finished);

      await wait(65);
    }
  }

  await Promise.all(animations);

  isDealing = false;
  updateControls();
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
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return [];
  }

  const destination = destinationType === 'foundation'
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

    // 'translate' preserves the tableau's CSS transform.
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
  if (isPaused || gameWon || isAutoCompleting) return;

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
  if (isAutoCompleting || isDealing) return;

  // Remove any confetti or delayed victory panel.
  stopVictoryCelebration();

  cancelDrag();
  clearLastTap();

  automaticMoveHistory = new WeakMap();

  // Create a new shuffled and dealt game.
  game.newGame();

  hasGameStarted = true;

  resetTimer();

  pauseOverlay.hidden = true;
  victoryOverlay.hidden = true;

  refreshUI();

  // Animate the opening deal and play its existing sound.
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
  if (!canInteract()) return;

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
      if (source.pileIndex === destinationIndex) return false;

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
  if (!canInteract() || source.type === 'foundation') {
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

  // Execute a double-click on the second press.
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
