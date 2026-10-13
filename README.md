# Solitaire

A modern, browser-based version of classic Klondike Solitaire, built with vanilla JavaScript, HTML, and CSS.

Arrange cards in descending order with alternating colors, uncover hidden cards, and build all four foundations from Ace to King to win the game.

**[▶ Play Solitaire](https://fredwahab.github.io/Solitaire/)**
![Solitaire gameplay showing the stock, waste, foundations, and tableau](assets/gameplay.png)

## How to Play

The goal is to move all 52 cards into the four foundation piles, organized by suit in ascending order from Ace to King.

- **Build foundations** by placing cards of the same suit in ascending order, starting with an Ace.
- **Arrange tableau cards** in descending order with alternating red and black suits.
- **Move card sequences** between tableau columns when the sequence follows the alternating-color rule.
- **Reveal hidden cards** by moving face-up cards away from covered cards.
- **Draw from the stock** when additional cards are needed.
- **Fill empty tableau columns** with Kings or valid sequences beginning with a King.
- **Complete all four foundations** to win the game.

This version uses **Draw 1** rules with unlimited passes through the stock.

### Controls

| Action | Control |
|---|---|
| Draw a card | Click the stock pile |
| Select a card or sequence | Click a face-up tableau card |
| Move selected cards | Click a valid destination pile |
| Move a waste card | Select the waste card, then click a valid destination |
| Move a foundation card | Select the foundation card, then click a valid tableau destination |
| Undo a move | Undo button |
| Start a new game | New Game button |
| Pause or resume | Click the timer to pause; use Resume to continue |
| Mute or unmute audio | Sound On / Sound Off button |

Only legal moves are accepted. Invalid moves leave the board unchanged.

### Scoring

The game awards points for successful moves and revealing hidden cards.

| Action | Points |
|---|---:|
| Reveal a hidden tableau card | +5 |
| Move a card from waste to tableau | +5 |
| Move a card to a foundation | +10 |
| Move a card from foundation to tableau | -15 |

The score updates throughout the game.

## Features

- Classic Klondike Solitaire gameplay
- Standard 52-card deck with randomized shuffling
- Draw 1 stock mechanics
- Unlimited stock recycling
- Seven tableau columns and four foundation piles
- Legal move validation
- Movement of individual cards and valid card sequences
- Automatic revealing of uncovered tableau cards
- Undo functionality
- Score tracking
- Game timer with pause and resume functionality
- Automatic completion when the remaining cards can be legally moved to the foundations
- Animated automatic completion sequence
- Victory detection and completion dialog
- New Game functionality
- Sound effects with persistent mute settings
- Responsive layout
- Automated deployment to GitHub Pages

## Technology

Solitaire was developed without a game engine or frontend UI framework.

| Technology | Purpose |
|---|---|
| JavaScript (ES Modules) | Game rules, card management, state, and interaction handling |
| HTML5 | Game structure and interface elements |
| CSS3 | Playing-card layout, responsive styling, and visual presentation |
| SVG | Playing-card artwork |
| Web Audio API | Game sound effects |
| Local Storage | Persisting audio preferences |
| Vite | Local development and production builds |
| GitHub Actions | Automated builds and deployment |
| GitHub Pages | Static website hosting |

## Technical Overview

The game separates card data, deck management, gameplay rules, rendering, and audio into individual JavaScript modules.

### Deck and Card Management

Each card is represented by its suit, rank, and face-up state.

The deck contains 52 cards distributed across four suits:

- Clubs
- Diamonds
- Hearts
- Spades

At the start of each game, the deck is shuffled and dealt into the standard Klondike layout.

Seven tableau columns receive an increasing number of cards, with only the top card of each column initially face-up.

The remaining cards form the stock pile.

### Game State

The game maintains separate collections for:

- Stock
- Waste
- Four foundation piles
- Seven tableau columns

Card movement updates these collections according to Klondike rules.

The game logic is maintained separately from the interface, allowing move validation and state changes to be handled independently of rendering.

### Move Validation

Each attempted move is checked against the rules for its destination.

**Tableau moves** require descending ranks with alternating colors. Only Kings or valid sequences beginning with a King can be placed in empty columns.

**Foundation moves** require ascending ranks within the same suit, beginning with an Ace.

Multiple face-up tableau cards can be moved together when they form a valid sequence.

Invalid moves are rejected without changing the game state.

### Stock and Waste Management

The stock uses Draw 1 mechanics.

Clicking the stock reveals one card and places it into the waste pile. The top waste card is available for legal moves to the tableau or foundations.

When the stock is exhausted, the waste can be recycled back into the stock.

This version allows unlimited passes without a scoring penalty.

### Undo System

The game stores snapshots of its state before successful moves.

Undo restores the previous state, including card positions, face-up status, and score.

State snapshots are created using JavaScript's `structuredClone()` functionality.

### Automatic Completion

When the game reaches a state where the remaining cards can be moved directly to the foundations, automatic completion begins.

The game first verifies that:

1. The stock and waste piles are empty.
2. All remaining tableau cards are face-up.
3. Every remaining card can be legally moved to a foundation.

The completion system simulates the remaining moves before starting the animation.

Once a valid completion sequence is confirmed, cards are moved individually to the foundations with a short delay between moves.

Other gameplay interactions are temporarily disabled during this sequence.

After all foundations are completed, the timer stops and the victory dialog appears.

### Timer and Scoring

The timer begins with the first successful move.

Players can pause the timer using the timer control. A pause overlay prevents additional gameplay until the game resumes.

Scoring is updated when qualifying moves are completed.

The timer stops when the game is won.

### Rendering and Input

The interface is rendered using HTML elements styled with CSS.

Playing cards use SVG artwork, allowing them to retain sharp visual detail at different display sizes.

The renderer updates the stock, waste, foundation, and tableau areas to reflect the current game state.

Card selection and destination clicks are handled through JavaScript event listeners.

### Audio

The game uses the Web Audio API for sound effects.

Different sounds accompany card draws, successful moves, undo operations, and victory.

Audio can be enabled or disabled through the interface, and the selected preference is stored in the browser's local storage.

## Running Locally

### Prerequisites

- Node.js
- npm
- Git

### Installation

Clone the repository:

```bash
git clone https://github.com/FredWahab/Solitaire.git
cd Solitaire
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local URL displayed in the terminal.

### Production Build

Generate a production build:

```bash
npm run build
```

The generated files are placed in the `dist/` directory.

To preview the production build locally:

```bash
npm run preview
```

## Deployment

The game is hosted on GitHub Pages:

**https://fredwahab.github.io/Solitaire/**

Deployment is automated using GitHub Actions.

When changes are pushed to the `main` branch, the deployment workflow:

1. Checks out the repository.
2. Installs Node.js and project dependencies.
3. Builds the project using Vite.
4. Uploads the generated production files.
5. Deploys the build to GitHub Pages.

The Vite configuration uses `/Solitaire/` as its base path for GitHub Pages hosting.

## Future Improvements

Potential enhancements include:

- Double-click functionality for moving eligible cards directly to foundations
- Optional hint system
- Draw 3 gameplay mode
- Restarting the current deal
- Move counter and gameplay statistics
- Additional keyboard and accessibility controls
- Further mobile layout refinements
- Additional animations and visual polish

## Playing Card Artwork

Playing-card SVG assets are sourced from:

**[Public Domain and CC0 Playing Cards — Austin Gabriel](https://github.com/AustinGabriel/Public-Domain-and-CC0-Playing-Cards)**

The project includes the original asset attribution information in `public/cards/citation.txt`.

## Author

**Fred Wahab**

[GitHub](https://github.com/FredWahab)

---

Built as a browser game development and JavaScript portfolio project.