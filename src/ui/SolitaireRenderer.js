
export class SolitaireRenderer {
  constructor(game, container) {
    this.game = game;
    this.container = container;

    // Vite asset base path (supports GitHub Pages).
    this.cardBasePath = `${import.meta.env.BASE_URL}cards/`;
  }

  // --------------------------------------------------
  // Board Setup
  // --------------------------------------------------

  createBoard() {
    // Game toolbar
    const toolbar = document.createElement('header');
    toolbar.className = 'game-toolbar';

    const title = document.createElement('h1');
    title.className = 'game-title';
    title.textContent = 'Solitaire';

    // Centered score and timer display
    const stats = document.createElement('div');
    stats.className = 'game-stats';

    const scoreDisplay = document.createElement('div');
    scoreDisplay.className = 'score-display';

    const scoreLabel = document.createElement('span');
    scoreLabel.className = 'stat-label';
    scoreLabel.textContent = 'SCORE';

    const scoreValue = document.createElement('span');
    scoreValue.className = 'score-value';
    scoreValue.textContent = '0';

    scoreDisplay.appendChild(scoreLabel);
    scoreDisplay.appendChild(scoreValue);

    const timerButton = document.createElement('button');
    timerButton.className = 'timer-button';
    timerButton.type = 'button';
    timerButton.title = 'Pause game';
    timerButton.setAttribute('aria-label', 'Pause game');

    const timerLabel = document.createElement('span');
    timerLabel.className = 'stat-label';
    timerLabel.textContent = 'TIME';

    const timerValue = document.createElement('span');
    timerValue.className = 'timer-value';
    timerValue.textContent = '00:00';

    timerButton.appendChild(timerLabel);
    timerButton.appendChild(timerValue);

    stats.appendChild(scoreDisplay);
    stats.appendChild(timerButton);

    // Game controls
    const controls = document.createElement('div');
    controls.className = 'game-controls';

    const newGameButton = document.createElement('button');
    newGameButton.className = 'new-game-button';
    newGameButton.type = 'button';
    newGameButton.textContent = 'New Game';

    const undoButton = document.createElement('button');
    undoButton.className = 'undo-button';
    undoButton.type = 'button';
    undoButton.textContent = 'Undo';

    const soundButton = document.createElement('button');
    soundButton.className = 'sound-button';
    soundButton.type = 'button';
    soundButton.textContent = 'Sound On';
    soundButton.setAttribute('aria-pressed', 'false');

    controls.appendChild(newGameButton);
    controls.appendChild(undoButton);
    controls.appendChild(soundButton);

    toolbar.appendChild(title);
    toolbar.appendChild(stats);
    toolbar.appendChild(controls);

    this.container.appendChild(toolbar);

    // Main board structure
    const board = document.createElement('main');
    board.className = 'game-board';

    const topRow = document.createElement('section');
    topRow.className = 'top-row';

    const tableauRow = document.createElement('section');
    tableauRow.className = 'tableau-row';

    // Stock and waste piles
    const stockPile = this.createPile('stock');
    const wastePile = this.createPile('waste');

    topRow.appendChild(stockPile);
    topRow.appendChild(wastePile);

    // Four foundation piles
    for (let i = 0; i < 4; i++) {
      const foundationPile = this.createPile('foundation', i);
      topRow.appendChild(foundationPile);
    }

    // Seven tableau columns
    for (let i = 0; i < 7; i++) {
      const tableauPile = this.createPile('tableau', i);
      tableauRow.appendChild(tableauPile);
    }

    board.appendChild(topRow);
    board.appendChild(tableauRow);

    this.container.appendChild(board);

    // Pause overlay
    const pauseOverlay = document.createElement('div');
    pauseOverlay.className = 'pause-overlay';
    pauseOverlay.hidden = true;

    const pausePanel = document.createElement('div');
    pausePanel.className = 'pause-panel';

    const pauseTitle = document.createElement('h2');
    pauseTitle.textContent = 'Paused';

    const pauseMessage = document.createElement('p');
    pauseMessage.textContent = 'Your game is paused.';

    const resumeButton = document.createElement('button');
    resumeButton.className = 'resume-button';
    resumeButton.type = 'button';
    resumeButton.textContent = 'Resume';

    pausePanel.appendChild(pauseTitle);
    pausePanel.appendChild(pauseMessage);
    pausePanel.appendChild(resumeButton);

    pauseOverlay.appendChild(pausePanel);
    this.container.appendChild(pauseOverlay);

    // Victory overlay
    const victoryOverlay = document.createElement('div');
    victoryOverlay.className = 'victory-overlay';
    victoryOverlay.hidden = true;

    const victoryPanel = document.createElement('div');
    victoryPanel.className = 'victory-panel';

    const victoryTitle = document.createElement('h2');
    victoryTitle.textContent = 'You Won!';

    const victoryMessage = document.createElement('p');
    victoryMessage.textContent =
      'Congratulations! You completed Solitaire.';

    const playAgainButton = document.createElement('button');
    playAgainButton.className = 'play-again-button';
    playAgainButton.type = 'button';
    playAgainButton.textContent = 'Play Again';

    victoryPanel.appendChild(victoryTitle);
    victoryPanel.appendChild(victoryMessage);
    victoryPanel.appendChild(playAgainButton);

    victoryOverlay.appendChild(victoryPanel);
    this.container.appendChild(victoryOverlay);
  }

  createPile(type, index = null) {
    const pile = document.createElement('div');
    pile.classList.add('pile', type);

    if (index !== null) {
      pile.dataset.index = index;
    }

    return pile;
  }

  // --------------------------------------------------
  // Card Assets
  // --------------------------------------------------

  getCardFacePath(card) {
    const rankNames = {
      1: 'ace',
      11: 'jack',
      12: 'queen',
      13: 'king'
    };

    const rank = rankNames[card.rank] ?? String(card.rank);
    const suit = card.suit;

    return `${this.cardBasePath}card fronts/${suit}/${rank} of ${suit}.svg`;
  }

  getCardBackPath() {
    return `${this.cardBasePath}card backs/card back blue.svg`;
  }

  // --------------------------------------------------
  // Card Creation
  // --------------------------------------------------

  createCardElement(card) {
    const cardElement = document.createElement('div');
    cardElement.classList.add('card');

    const cardImage = document.createElement('img');
    cardImage.className = 'card-image';
    cardImage.draggable = false;

    if (card.faceUp) {
      cardElement.classList.add('face-up');
      cardImage.src = this.getCardFacePath(card);
      cardImage.alt = `${card.rank} of ${card.suit}`;
    } else {
      cardElement.classList.add('face-down');
      cardImage.src = this.getCardBackPath();
      cardImage.alt = 'Face-down card';
    }

    cardElement.appendChild(cardImage);
    return cardElement;
  }

  // --------------------------------------------------
  // Board Rendering
  // --------------------------------------------------

  render() {
    this.renderStock();
    this.renderWaste();
    this.renderFoundations();
    this.renderTableau();
  }

  renderStock() {
    const stockPile = this.container.querySelector('.stock');
    stockPile.innerHTML = '';

    const hasCards = this.game.stock.length > 0;
    stockPile.classList.toggle('has-cards', hasCards);

    if (!hasCards) {
      return;
    }

    const cardBack = document.createElement('img');
    cardBack.className = 'stock-card-image';
    cardBack.src = this.getCardBackPath();
    cardBack.alt = 'Draw card';
    cardBack.draggable = false;

    stockPile.appendChild(cardBack);
  }

  renderWaste() {
    const wastePile = this.container.querySelector('.waste');
    this.renderTopCard(wastePile, this.game.waste);
  }

  renderFoundations() {
    const foundationPiles =
      this.container.querySelectorAll('.foundation');

    foundationPiles.forEach((pileElement, index) => {
      this.renderTopCard(
        pileElement,
        this.game.foundations[index]
      );
    });
  }

  renderTableau() {
    const tableauPiles =
      this.container.querySelectorAll('.tableau');

    tableauPiles.forEach((pileElement, index) => {
      const cards = this.game.tableau[index];
      pileElement.innerHTML = '';

      cards.forEach((card, cardIndex) => {
        const cardElement = this.createCardElement(card);

        // CSS uses this value to stack tableau cards.
        cardElement.style.setProperty('--card-index', cardIndex);
        pileElement.appendChild(cardElement);
      });
    });
  }

  // --------------------------------------------------
  // Rendering Helpers
  // --------------------------------------------------

  renderTopCard(pileElement, cards) {
    pileElement.innerHTML = '';

    if (cards.length === 0) {
      return;
    }

    const topCard = cards[cards.length - 1];
    pileElement.appendChild(this.createCardElement(topCard));
  }
}
