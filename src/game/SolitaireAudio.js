
export class SolitaireAudio {
  constructor() {
    this.muted = localStorage.getItem('solitaire-muted') === 'true';
    this.context = null;
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('solitaire-muted', String(this.muted));
    return this.muted;
  }

  playTone(frequency, duration, volume = 0.10) {
    if (this.muted) return;

    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return;

    if (!this.context) {
      this.context = new AudioContextClass();
    }

    if (this.context.state === 'suspended') {
      this.context.resume();
    }

    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;

    const now = this.context.currentTime;

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    oscillator.connect(gain);
    gain.connect(this.context.destination);

    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  draw() {
    this.playTone(440, 0.06);
  }

  move() {
    this.playTone(520, 0.08);
  }

  undo() {
    this.playTone(330, 0.08);
  }

  
  victory() {
    if (this.muted) return;

    const notes = [523, 659, 784, 1047];

    notes.forEach((frequency, index) => {
      setTimeout(() => {
        this.playTone(frequency, 0.15);
      }, index * 150);
    });
  }
}
