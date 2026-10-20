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
    // Header and statistics
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

    // Unified controls: desktop and mobile use the same buttons.
    const controls = document.createElement('nav');
    controls.className = 'game-controls';
    controls.setAttribute('aria-label', 'Game controls');

    const addControl = (className, label) => {
      const button = document.createElement('button');
      button.className = className;
      button.type = 'button';
      button.textContent = label;
      button.title = label;
      button.setAttribute('aria-label', label);

      controls.appendChild(button);
      return button;
    };

    addControl('new-game-button', 'New Game');
    addControl('undo-button', 'Undo');

    const soundButton = addControl('sound-button', 'Sound On');
    soundButton.setAttribute('aria-pressed', 'false');

    addControl('mode-button', 'Mode');
    addControl('help-button', 'Help');

    toolbar.append(title, stats, controls);
    this.container.appendChild(toolbar);

    // --------------------------------------------------
    // Game Board
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

    topRow.append(
      this.createPile('stock'),
      this.createPile('waste')
    );

    for (let i = 0; i < 4; i++) {
      topRow.appendChild(this.createPile('foundation', i));
    }

    for (let i = 0; i < 7; i++) {
      tableauRow.appendChild(this.createPile('tableau', i));
    }

    board.append(topRow, tableauRow);
    this.container.appendChild(board);

    // --------------------------------------------------
    // Portfolio Footer
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

    pausePanel.append(pauseTitle, pauseMessage, resumeButton);
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

    // --------------------------------------------------
    // Game Mode Dialog
    // --------------------------------------------------

    const modeOverlay = document.createElement('div');
    modeOverlay.className = 'mode-overlay game-dialog-overlay';
    modeOverlay.hidden = true;

    const modePanel = document.createElement('section');
    modePanel.className = 'game-dialog-panel mode-panel';
    modePanel.setAttribute('role', 'dialog');
    modePanel.setAttribute('aria-modal', 'true');
    modePanel.setAttribute('aria-labelledby', 'mode-title');

    const modeTitle = document.createElement('h2');
    modeTitle.id = 'mode-title';
    modeTitle.textContent = 'Game Mode';

    const modeDescription = document.createElement('p');
    modeDescription.textContent =
      'Choose how many cards to reveal from the stock. ' +
      'Your selection applies when you start a new game.';

    const modeChoices = document.createElement('div');
    modeChoices.className = 'mode-choices';

    // Draw 1 option
    const draw1Label = document.createElement('label');

    const draw1Input = document.createElement('input');
    draw1Input.type = 'radio';
    draw1Input.name = 'draw-mode';
    draw1Input.value = '1';

    const draw1Text = document.createElement('span');
    draw1Text.innerHTML =
      '<strong>Draw 1</strong>' +
      '<small>Easier — one card per draw</small>';

    draw1Label.append(draw1Input, draw1Text);

    // Draw 3 option
    const draw3Label = document.createElement('label');

    const draw3Input = document.createElement('input');
    draw3Input.type = 'radio';
    draw3Input.name = 'draw-mode';
    draw3Input.value = '3';

    const draw3Text = document.createElement('span');
    draw3Text.innerHTML =
      '<strong>Draw 3</strong>' +
      '<small>More challenging — three cards per draw</small>';

    draw3Label.append(draw3Input, draw3Text);
    modeChoices.append(draw1Label, draw3Label);

    const modeStatus = document.createElement('p');
    modeStatus.className = 'mode-status';
    modeStatus.setAttribute('aria-live', 'polite');

    const modeActions = document.createElement('div');
    modeActions.className = 'dialog-actions';

    const modeCloseButton = document.createElement('button');
    modeCloseButton.className = 'mode-close-button';
    modeCloseButton.type = 'button';
    modeCloseButton.textContent = 'Close';

    const modeStartButton = document.createElement('button');
    modeStartButton.className = 'mode-start-button primary-action';
    modeStartButton.type = 'button';
    modeStartButton.textContent = 'New Game';

    modeActions.append(modeCloseButton, modeStartButton);

    modePanel.append(
      modeTitle,
      modeDescription,
      modeChoices,
      modeStatus,
      modeActions
    );

    modeOverlay.appendChild(modePanel);
    this.container.appendChild(modeOverlay);

    // --------------------------------------------------
    // Interactive Tutorial Dialog
    // --------------------------------------------------

    const helpOverlay = document.createElement('div');
    helpOverlay.className = 'help-overlay game-dialog-overlay';
    helpOverlay.hidden = true;

    const helpPanel = document.createElement('section');
    helpPanel.className = 'game-dialog-panel help-panel';
    helpPanel.setAttribute('role', 'dialog');
    helpPanel.setAttribute('aria-modal', 'true');
    helpPanel.setAttribute('aria-labelledby', 'help-title');

    const helpTitle = document.createElement('h2');
    helpTitle.id = 'help-title';
    helpTitle.textContent = 'How to Play';

    const helpProgress = document.createElement('p');
    helpProgress.className = 'help-progress';
    helpProgress.setAttribute('aria-live', 'polite');

    const helpVisual = document.createElement('div');
    helpVisual.className = 'help-visual';
    helpVisual.setAttribute('aria-hidden', 'true');

    const helpHeading = document.createElement('h3');
    helpHeading.className = 'help-heading';

    const helpText = document.createElement('p');
    helpText.className = 'help-text';

    const helpActions = document.createElement('div');
    helpActions.className = 'dialog-actions';

    const helpCloseButton = document.createElement('button');
    helpCloseButton.className = 'help-close-button';
    helpCloseButton.type = 'button';
    helpCloseButton.textContent = 'Close';

    const helpBackButton = document.createElement('button');
    helpBackButton.className = 'help-back-button';
    helpBackButton.type = 'button';
    helpBackButton.textContent = 'Back';

    const helpNextButton = document.createElement('button');
    helpNextButton.className = 'help-next-button primary-action';
    helpNextButton.type = 'button';
    helpNextButton.textContent = 'Next';

    helpActions.append(
      helpCloseButton,
      helpBackButton,
      helpNextButton
    );

    helpPanel.append(
      helpTitle,
      helpProgress,
      helpVisual,
      helpHeading,
      helpText,
      helpActions
    );

    helpOverlay.appendChild(helpPanel);
    this.container.appendChild(helpOverlay);

    window.addEventListener('resize', this.handleResize);
  }

  // --------------------------------------------------
  // Pile Creation
  // --------------------------------------------------

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

  // --------------------------------------------------
  // Waste
  // --------------------------------------------------

  renderWaste() {
    const wastePile = this.container.querySelector('.waste');
    wastePile.innerHTML = '';

    const cards = this.game.waste;

    if (cards.length === 0) {
      return;
    }

    // Show the card back below the playable waste card
    // when more than one card is in the waste.
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
    const piles = this.container.querySelectorAll('.foundation');

    piles.forEach((element, index) => {
      this.renderTopCard(
        element,
        this.game.foundations[index]
      );
    });
  }

  // --------------------------------------------------
  // Tableau
  // --------------------------------------------------

  renderTableau() {
    const piles = this.container.querySelectorAll('.tableau');

    piles.forEach((element, index) => {
      element.innerHTML = '';

      this.game.tableau[index].forEach((card, cardIndex) => {
        const cardElement = this.createCardElement(card);

        cardElement.style.setProperty(
          '--card-index',
          cardIndex
        );

        element.appendChild(cardElement);
      });
    });

    this.updateTableauHeight();
  }

  // --------------------------------------------------
  // Dynamic Tableau Height
  // --------------------------------------------------

  updateTableauHeight() {
    const tableauRow = this.container.querySelector('.tableau-row');

    if (!tableauRow) {
      return;
    }

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

    if (cards.length === 0) {
      return;
    }

    pileElement.appendChild(
      this.createCardElement(cards[cards.length - 1])
    );
  }
}