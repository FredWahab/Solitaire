
import { Deck } from './Deck.js';

export class SolitaireGame {
  constructor() {
    this.drawCount = 1;
    this.newGame();
  }

  // --------------------------------------------------
  // Game Setup
  // --------------------------------------------------

  newGame(drawCount = this.drawCount) {
    this.drawCount = drawCount === 3 ? 3 : 1;

    this.deck = new Deck();
    this.deck.shuffle();

    this.stock = [];
    this.waste = [];
    this.foundations = Array.from({ length: 4 }, () => []);
    this.tableau = Array.from({ length: 7 }, () => []);

    this.score = 0;
    this.history = [];

    this.deal();
  }

  deal() {
    // Deal 1–7 cards into the tableau columns.
    // Only the top card of each column is face up.
    for (let column = 0; column < 7; column++) {
      for (let row = 0; row <= column; row++) {
        const card = this.deck.cards.pop();
        card.faceUp = row === column;
        this.tableau[column].push(card);
      }
    }

    // Remaining cards become the stock.
    this.stock = [...this.deck.cards];
    this.deck.cards = [];
  }

  // --------------------------------------------------
  // Stock and Waste
  // --------------------------------------------------

  drawCard() {
    // Recycle the waste when the stock is empty.
    if (this.stock.length === 0) {
      if (this.waste.length === 0) {
        return false;
      }

      // Reverse the waste into a new face-down stock.
      this.stock = this.waste.reverse();

      this.stock.forEach(card => {
        card.faceUp = false;
      });

      this.waste = [];
      return true;
    }

    // Draw one or three cards, depending on game mode.
    // If fewer than three remain, draw what's available.
    const amount = Math.min(this.drawCount, this.stock.length);

    for (let i = 0; i < amount; i++) {
      const card = this.stock.pop();
      card.faceUp = true;
      this.waste.push(card);
    }

    return true;
  }

  // --------------------------------------------------
  // Move Validation
  // --------------------------------------------------

  canMoveToFoundation(card, foundationIndex) {
    const foundation = this.foundations[foundationIndex];

    if (!foundation) {
      return false;
    }

    // Empty foundations accept only Aces.
    if (foundation.length === 0) {
      return card.rank === 1;
    }

    const topCard = foundation[foundation.length - 1];

    // Foundations build upward in the same suit.
    return (
      card.suit === topCard.suit &&
      card.rank === topCard.rank + 1
    );
  }

  canMoveToTableau(card, tableauIndex) {
    const tableauPile = this.tableau[tableauIndex];

    if (!tableauPile) {
      return false;
    }

    // Empty tableau columns accept only Kings.
    if (tableauPile.length === 0) {
      return card.rank === 13;
    }

    const topCard = tableauPile[tableauPile.length - 1];

    if (!topCard.faceUp) {
      return false;
    }

    // Tableau cards alternate colors and descend in rank.
    return (
      this.isRed(card) !== this.isRed(topCard) &&
      card.rank === topCard.rank - 1
    );
  }

  isRed(card) {
    return card.suit === 'hearts' ||
      card.suit === 'diamonds';
  }

  isValidSequence(cards) {
    // Verify a face-up descending, alternating-color sequence.
    for (let i = 0; i < cards.length; i++) {
      if (!cards[i].faceUp) {
        return false;
      }

      if (i === 0) {
        continue;
      }

      const previous = cards[i - 1];
      const current = cards[i];

      if (
        this.isRed(previous) === this.isRed(current) ||
        current.rank !== previous.rank - 1
      ) {
        return false;
      }
    }

    return true;
  }

  // --------------------------------------------------
  // Tableau Movement
  // --------------------------------------------------

  moveTableauToTableau(fromIndex, cardIndex, toIndex) {
    if (fromIndex === toIndex) {
      return false;
    }

    const sourcePile = this.tableau[fromIndex];
    const destinationPile = this.tableau[toIndex];

    if (!sourcePile || !destinationPile) {
      return false;
    }

    const movingCards = sourcePile.slice(cardIndex);

    if (
      movingCards.length === 0 ||
      !this.isValidSequence(movingCards) ||
      !this.canMoveToTableau(movingCards[0], toIndex)
    ) {
      return false;
    }

    sourcePile.splice(cardIndex);
    destinationPile.push(...movingCards);

    this.revealTopCard(sourcePile);

    return true;
  }

  moveWasteToTableau(tableauIndex) {
    if (this.waste.length === 0) {
      return false;
    }

    const card = this.waste[this.waste.length - 1];

    if (!this.canMoveToTableau(card, tableauIndex)) {
      return false;
    }

    this.waste.pop();
    this.tableau[tableauIndex].push(card);

    this.score += 5;

    return true;
  }

  moveFoundationToTableau(foundationIndex, tableauIndex) {
    const foundation = this.foundations[foundationIndex];

    if (!foundation?.length) {
      return false;
    }

    const card = foundation[foundation.length - 1];

    if (!this.canMoveToTableau(card, tableauIndex)) {
      return false;
    }

    foundation.pop();
    this.tableau[tableauIndex].push(card);

    this.score -= 15;

    return true;
  }

  // --------------------------------------------------
  // Foundation Movement
  // --------------------------------------------------

  moveWasteToFoundation(foundationIndex) {
    if (this.waste.length === 0) {
      return false;
    }

    const card = this.waste[this.waste.length - 1];

    if (!this.canMoveToFoundation(card, foundationIndex)) {
      return false;
    }

    this.waste.pop();
    this.foundations[foundationIndex].push(card);

    this.score += 10;

    return true;
  }

  moveTableauToFoundation(tableauIndex, foundationIndex) {
    const tableauPile = this.tableau[tableauIndex];

    if (!tableauPile?.length) {
      return false;
    }

    const card = tableauPile[tableauPile.length - 1];

    if (
      !card.faceUp ||
      !this.canMoveToFoundation(card, foundationIndex)
    ) {
      return false;
    }

    tableauPile.pop();
    this.foundations[foundationIndex].push(card);

    this.score += 10;
    this.revealTopCard(tableauPile);

    return true;
  }

  // --------------------------------------------------
  // Automatic Completion
  // --------------------------------------------------

  getAutoCompleteMoves() {
    // All cards must be visible and out of stock/waste.
    if (this.stock.length > 0 || this.waste.length > 0) {
      return null;
    }

    if (
      this.tableau.some(pile =>
        pile.some(card => !card.faceUp)
      )
    ) {
      return null;
    }

    // Simulate the remaining moves without changing the game.
    const tableau = this.tableau.map(pile => [...pile]);
    const foundations = this.foundations.map(pile => [...pile]);
    const moves = [];

    let foundMove = true;

    while (foundMove) {
      foundMove = false;

      for (
        let tableauIndex = 0;
        tableauIndex < tableau.length;
        tableauIndex++
      ) {
        const pile = tableau[tableauIndex];

        if (pile.length === 0) {
          continue;
        }

        const card = pile[pile.length - 1];

        for (
          let foundationIndex = 0;
          foundationIndex < foundations.length;
          foundationIndex++
        ) {
          const foundation = foundations[foundationIndex];
          const topCard = foundation[foundation.length - 1];

          const canMove = foundation.length === 0
            ? card.rank === 1
            : card.suit === topCard.suit &&
              card.rank === topCard.rank + 1;

          if (!canMove) {
            continue;
          }

          pile.pop();
          foundation.push(card);

          moves.push({ tableauIndex, foundationIndex });
          foundMove = true;
          break;
        }
      }
    }

    const completed = foundations.every(
      pile => pile.length === 13
    );

    return completed && moves.length > 0 ? moves : null;
  }

  canAutoComplete() {
    return this.getAutoCompleteMoves() !== null;
  }

  // --------------------------------------------------
  // Helpers and Game Status
  // --------------------------------------------------

  revealTopCard(pile) {
    if (pile.length === 0) {
      return;
    }

    const topCard = pile[pile.length - 1];

    if (!topCard.faceUp) {
      topCard.faceUp = true;
      this.score += 5;
    }
  }

  checkWin() {
    return this.foundations.every(
      foundation => foundation.length === 13
    );
  }

  // --------------------------------------------------
  // Undo History
  // --------------------------------------------------

  getStateSnapshot() {
    return structuredClone({
      stock: this.stock,
      waste: this.waste,
      foundations: this.foundations,
      tableau: this.tableau,
      score: this.score
    });
  }

  saveState() {
    this.history.push(this.getStateSnapshot());
  }

  recordMove(action) {
    // Capture the state before attempting the move.
    const previousState = this.getStateSnapshot();
    const moved = action();

    // Invalid moves should not enter Undo history.
    if (moved) {
      this.history.push(previousState);
    }

    return moved;
  }

  undo() {
    if (this.history.length === 0) {
      return false;
    }

    const previousState = this.history.pop();

    this.stock = previousState.stock;
    this.waste = previousState.waste;
    this.foundations = previousState.foundations;
    this.tableau = previousState.tableau;
    this.score = previousState.score;

    return true;
  }
}
