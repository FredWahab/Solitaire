
export class SolitaireRenderer {
  constructor(game, container) {
    this.game = game;
    this.container = container;
    this.cardBasePath = `${import.meta.env.BASE_URL}cards/`;
    this.handleResize = () => this.updateTableauHeight();
  }

  // --------------------------------------------------
  // Board Setup
  // --------------------------------------------------

  createBoard() {
    const toolbar = document.createElement('header');
    toolbar.className = 'game-toolbar';

    const title = document.createElement('h1');
    title.className = 'game-title';
    title.textContent = 'Solitaire';

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

    scoreDisplay.append(scoreLabel, scoreValue);

    const timerButton = document.createElement('button');
    timerButton.className = 'timer-button';
    timerButton.type = 'button';
    timerButton.title = 'Pause game';
    timerButton.setAttribute('aria-label', 'Pause game');

    const timerLabel = document.createElement('span');
    timerLabel.className = 'stat-label';
    timerLabel.textContent = 'TIME / PAUSE';

    const timerValue = document.createElement('span');
    timerValue.className = 'timer-value';
    timerValue.textContent = '00:00';

    timerButton.append(timerLabel, timerValue);
    stats.append(scoreDisplay, timerButton);

    // One unified toolbar for desktop and mobile.
    // CSS changes its position based on screen size.

    const controls = document.createElement('nav');
    controls.className = 'game-controls';
    controls.setAttribute('aria-label', 'Game controls');

    const addControl = (className, label, disabled = false) => {
      const button = document.createElement('button');
      button.className = className;
      button.type = 'button';
      button.title = disabled
        ? `${label} (coming soon)`
        : label;
      button.setAttribute('aria-label', label);
      button.disabled = disabled;

      // main.js updates the Sound button's textContent,
      // so the icons are supplied through CSS instead.
      button.textContent = label;

      controls.appendChild(button);
      return button;
    };

    addControl('new-game-button', 'New Game');
    addControl('undo-button', 'Undo');

    const soundButton = addControl('sound-button', 'Sound On');
    soundButton.setAttribute('aria-pressed', 'false');

    // Reserved for Draw 1 / Draw 3 and the tutorial.
    addControl('mode-button', 'Mode', true);
    addControl('help-button', 'Help', true);

    toolbar.append(title, stats, controls);
    this.container.appendChild(toolbar);

    // --------------------------------------------------
    // Board
    // --------------------------------------------------

    const board = document.createElement('main');
    board.className = 'game-board';

    const topRow = document.createElement('section');
    topRow.className = 'top-row';
    topRow.setAttribute(
      'aria-label',
      'Stock, waste, and foundations'
    );

    const tableauRow = document.createElement('section');
    tableauRow.className = 'tableau-row';
    tableauRow.setAttribute('aria-label', 'Tableau');

    topRow.appendChild(this.createPile('stock'));
    topRow.appendChild(this.createPile('waste'));

    for (let i = 0; i < 4; i++) {
      topRow.appendChild(this.createPile('foundation', i));
    }

    for (let i = 0; i < 7; i++) {
      tableauRow.appendChild(this.createPile('tableau', i));
    }

    board.append(topRow, tableauRow);
    this.container.appendChild(board);

    // --------------------------------------------------
    // Footer
    // --------------------------------------------------

    const footer = document.createElement('footer');
    footer.className = 'game-footer';
    footer.append('Made by ');

    const authorLink = document.createElement('a');
    authorLink.href = 'https://github.com/FredWahab';
    authorLink.textContent = 'Fred Wahab';
    authorLink.target = '_blank';
    authorLink.rel = 'noopener noreferrer';

    footer.appendChild(authorLink);
    this.container.appendChild(footer);

    // --------------------------------------------------
    // Pause Overlay
    // --------------------------------------------------

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

    pausePanel.append(
      pauseTitle,
      pauseMessage,
      resumeButton
    );

    pauseOverlay.appendChild(pausePanel);
    this.container.appendChild(pauseOverlay);

    // --------------------------------------------------
    // Victory Overlay
    // --------------------------------------------------

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

    victoryPanel.append(
      victoryTitle,
      victoryMessage,
      playAgainButton
    );

    victoryOverlay.appendChild(victoryPanel);
    this.container.appendChild(victoryOverlay);

    window.addEventListener('resize', this.handleResize);
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

    return (
      `${this.cardBasePath}card fronts/` +
      `${card.suit}/${rank} of ${card.suit}.svg`
    );
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

  // --------------------------------------------------
  // Stock
  // --------------------------------------------------

  renderStock() {
    const stockPile = this.container.querySelector('.stock');
    stockPile.innerHTML = '';

    const hasCards = this.game.stock.length > 0;

    stockPile.classList.toggle('has-cards', hasCards);

    if (!hasCards) return;

    const cardBack = document.createElement('img');
    cardBack.className = 'stock-card-image';
    cardBack.src = this.getCardBackPath();
    cardBack.alt = 'Draw card';
    cardBack.draggable = false;

    stockPile.appendChild(cardBack);
  }

  // --------------------------------------------------
  // Waste
  // --------------------------------------------------

  renderWaste() {
    const wastePile = this.container.querySelector('.waste');
    wastePile.innerHTML = '';

    const cards = this.game.waste;

    if (cards.length === 0) return;

    if (cards.length > 1) {
      const backingCard = document.createElement('img');

      backingCard.className = 'stock-card-image';
      backingCard.src = this.getCardBackPath();
      backingCard.alt = '';
      backingCard.draggable = false;

      Object.assign(backingCard.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: '0'
      });

      wastePile.appendChild(backingCard);
    }

    const topCardElement = this.createCardElement(
      cards[cards.length - 1]
    );

    Object.assign(topCardElement.style, {
      position: 'absolute',
      top: cards.length > 1 ? '3px' : '0',
      left: cards.length > 1 ? '3px' : '0',
      zIndex: '1'
    });

    wastePile.appendChild(topCardElement);
  }

  // --------------------------------------------------
  // Foundations
  // --------------------------------------------------

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

  // --------------------------------------------------
  // Tableau
  // --------------------------------------------------

  renderTableau() {
    const tableauPiles =
      this.container.querySelectorAll('.tableau');

    tableauPiles.forEach((pileElement, index) => {
      const cards = this.game.tableau[index];
      pileElement.innerHTML = '';

      cards.forEach((card, cardIndex) => {
        const cardElement = this.createCardElement(card);

        cardElement.style.setProperty(
          '--card-index',
          cardIndex
        );

        pileElement.appendChild(cardElement);
      });
    });

    // Absolutely positioned cards don't contribute
    // to their parent's layout height.
    this.updateTableauHeight();
  }

  // --------------------------------------------------
  // Dynamic Tableau Height
  // --------------------------------------------------

  updateTableauHeight() {
    const tableauRow =
      this.container.querySelector('.tableau-row');

    if (!tableauRow) return;

    // Clear the previous height before measuring.
    tableauRow.style.minHeight = '';

    const top = tableauRow.getBoundingClientRect().top;
    let bottom = top;

    tableauRow.querySelectorAll('.tableau').forEach(pile => {
      const cards = pile.querySelectorAll('.card');
      const lastCard = cards[cards.length - 1];

      const visibleEnd = lastCard || pile;

      bottom = Math.max(
        bottom,
        visibleEnd.getBoundingClientRect().bottom
      );
    });

    tableauRow.style.minHeight =
      `${Math.ceil(bottom - top + 2)}px`;
  }

  // --------------------------------------------------
  // Rendering Helper
  // --------------------------------------------------

  renderTopCard(pileElement, cards) {
    pileElement.innerHTML = '';

    if (cards.length === 0) return;

    pileElement.appendChild(
      this.createCardElement(cards[cards.length - 1])
    );
  }
}
