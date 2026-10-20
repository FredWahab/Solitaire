import { Howl, Howler } from 'howler';

/**
 * SolitaireAudio — curated card sounds from Kenney's CC0 Casino Audio pack,
 * with an original victory cue.
 *
 * Drop-in replacement for the current SolitaireAudio.js.
 * Install the playback dependency once: npm install howler
 *
 * Compatible existing methods: draw(), move(), undo(), victory(), toggleMute()
 * Additional methods for future event-specific hookups:
 *   start(), recycle(), sequence(), foundation(), flip()
 */
export class SolitaireAudio {
  constructor() {
    this.muted = localStorage.getItem('solitaire-muted') === 'true';
    this.lastVariant = new Map();

    const audioBase = `${import.meta.env.BASE_URL}audio/solitaire/`;
    const createGroup = (names, volume) => names.map(name => new Howl({
      src: [`${audioBase}${name}.mp3`],
      volume,
      preload: true,
      html5: false
    }));

    this.sounds = {
      draw: createGroup(['draw-01', 'draw-02', 'draw-03', 'draw-04'], 0.58),
      place: createGroup(['place-01', 'place-02', 'place-03'], 0.52),
      sequence: createGroup(['sequence-01', 'sequence-02'], 0.49),
      foundation: createGroup(['foundation-01', 'foundation-02'], 0.55),
      undo: createGroup(['undo-01', 'undo-02'], 0.44),
      flip: createGroup(['flip-01', 'flip-02'], 0.46),
      recycle: createGroup(['recycle'], 0.53),
      start: createGroup(['game-start'], 0.57),
      victory: createGroup(['victory'], 0.65)
    };

    Howler.mute(this.muted);
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('solitaire-muted', String(this.muted));
    Howler.mute(this.muted);
    return this.muted;
  }

  play(group) {
    if (this.muted) return;
    const sounds = this.sounds[group];
    if (!sounds || sounds.length === 0) return;

    // Vary the short card sounds, and avoid the same sample twice in a row.
    let chosen = 0;
    const previous = this.lastVariant.get(group);
    if (sounds.length > 1) {
      if (previous === undefined) {
        chosen = Math.floor(Math.random() * sounds.length);
      } else {
        chosen = Math.floor(Math.random() * (sounds.length - 1));
        if (chosen >= previous) chosen += 1;
      }
    }
    this.lastVariant.set(group, chosen);
    sounds[chosen].play();
  }

  // The current main.js already calls these methods.
  draw() { this.play('draw'); }
  move() { this.play('place'); }
  undo() { this.play('undo'); }
  victory() { this.play('victory'); }

  // Optional richer sound cues you can wire up later.
  start() { this.play('start'); }
  recycle() { this.play('recycle'); }
  sequence() { this.play('sequence'); }
  foundation() { this.play('foundation'); }
  flip() { this.play('flip'); }
}
