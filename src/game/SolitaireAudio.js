import { Howl, Howler } from 'howler';

/**
 * SolitaireAudio
 *
 * Audio management for Klondike Solitaire.
 *
 * Uses Howler.js with the Web Audio backend for reliable
 * cross-browser playback, including iPhone Safari.
 *
 * Features:
 * - Persistent mute preference
 * - Varied card sounds
 * - Coordinated Draw 3 sounds
 * - Stock recycling sound
 * - Opening deal and victory audio
 */

export class SolitaireAudio {
  constructor() {
    this.muted =
      localStorage.getItem('solitaire-muted') === 'true';

    this.lastVariant = new Map();

    // Used to cycle through distinct samples during
    // multi-card draws.
    this.drawSequenceIndex = 0;

    const audioBase =
      `${import.meta.env.BASE_URL}audio/solitaire/`;

    const createGroup = (names, volume) =>
      names.map(name => new Howl({
        src: [`${audioBase}${name}.mp3`],
        volume,
        preload: true,
        html5: false,
        pool: 8
      }));

    this.sounds = {
      draw: createGroup(
        ['draw-01', 'draw-02', 'draw-03', 'draw-04'],
        0.62
      ),

      place: createGroup(
        ['place-01', 'place-02', 'place-03'],
        0.52
      ),

      sequence: createGroup(
        ['sequence-01', 'sequence-02'],
        0.49
      ),

      foundation: createGroup(
        ['foundation-01', 'foundation-02'],
        0.55
      ),

      undo: createGroup(
        ['undo-01', 'undo-02'],
        0.44
      ),

      flip: createGroup(
        ['flip-01', 'flip-02'],
        0.46
      ),

      recycle: createGroup(
        ['recycle'],
        0.53
      ),

      start: createGroup(
        ['game-start'],
        0.57
      ),

      victory: createGroup(
        ['victory'],
        0.65
      )
    };

    Howler.mute(this.muted);
  }

  // --------------------------------------------------
  // Mute
  // --------------------------------------------------

  toggleMute() {
    this.muted = !this.muted;

    localStorage.setItem(
      'solitaire-muted',
      String(this.muted)
    );

    Howler.mute(this.muted);

    return this.muted;
  }

  // --------------------------------------------------
  // General Sound Playback
  // --------------------------------------------------

  play(group) {
    if (this.muted) return;

    const sounds = this.sounds[group];

    if (!sounds || sounds.length === 0) {
      return;
    }

    let chosen = 0;
    const previous = this.lastVariant.get(group);

    // Preserve variety while avoiding the same sample
    // on consecutive actions.
    if (sounds.length > 1) {
      if (previous === undefined) {
        chosen = Math.floor(
          Math.random() * sounds.length
        );
      } else {
        chosen = Math.floor(
          Math.random() * (sounds.length - 1)
        );

        if (chosen >= previous) {
          chosen += 1;
        }
      }
    }

    this.lastVariant.set(group, chosen);

    sounds[chosen].play();
  }

  // --------------------------------------------------
  // Draw Sounds
  // --------------------------------------------------

  draw() {
    this.play('draw');
  }

  /**
   * Begin a multi-card draw sequence.
   *
   * Select a starting sound variant, then advance
   * through the available samples for each card.
   *
   * This avoids repeatedly choosing samples at
   * random during a fast three-card animation.
   */
  beginDrawSequence() {
    const sounds = this.sounds.draw;

    if (!sounds || sounds.length === 0) {
      return;
    }

    const previous = this.lastVariant.get('draw');

    let startingIndex = Math.floor(
      Math.random() * sounds.length
    );

    if (
      sounds.length > 1 &&
      startingIndex === previous
    ) {
      startingIndex =
        (startingIndex + 1) % sounds.length;
    }

    this.drawSequenceIndex = startingIndex;
  }

  /**
   * Play one sound for one card in the sequence.
   *
   * main.js calls this when each card begins
   * moving from stock to waste.
   */
  drawSequence() {
    if (this.muted) return;

    const sounds = this.sounds.draw;

    if (!sounds || sounds.length === 0) {
      return;
    }

    const index =
      this.drawSequenceIndex % sounds.length;

    const sound = sounds[index];

    this.lastVariant.set('draw', index);

    // Play the selected sound immediately.
    // Howler can use another pooled voice when a
    // previous sample is still playing.
    sound.play();

    this.drawSequenceIndex =
      (index + 1) % sounds.length;
  }

  // --------------------------------------------------
  // Other Game Sounds
  // --------------------------------------------------

  move() {
    this.play('place');
  }

  undo() {
    this.play('undo');
  }

  victory() {
    this.play('victory');
  }

  start() {
    this.play('start');
  }

  recycle() {
    this.play('recycle');
  }

  sequence() {
    this.play('sequence');
  }

  foundation() {
    this.play('foundation');
  }

  flip() {
    this.play('flip');
  }
}