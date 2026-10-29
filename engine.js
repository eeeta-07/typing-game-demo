export const DURATION_MS = 60_000;

export class Game {
  constructor(words, now = () => performance.now(), random = Math.random) {
    if (!Array.isArray(words) || !words.length || words.some(w => !w.text || !/^[a-z]+$/.test(w.romaji))) {
      throw new Error('Invalid words');
    }
    this.words = words;
    this.now = now;
    this.random = random;
    this.state = 'ready';
  }
  start() {
    this.score = 0;
    this.misses = 0;
    this.completed = 0;
    this.index = 0;
    this.previous = -1;
    this.queue = [];
    this.deadline = this.now() + DURATION_MS;
    this.state = 'playing';
    this.nextWord();
  }
  nextWord() {
    if (!this.queue.length) {
      this.queue = this.words.map((_, i) => i);
      for (let i = this.queue.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
      }
      if (this.queue.length > 1 && this.queue[0] === this.previous) {
        [this.queue[0], this.queue[1]] = [this.queue[1], this.queue[0]];
      }
    }
    const pick = this.queue.shift();
    this.previous = pick;
    this.word = this.words[pick];
    this.index = 0;
    this.typed = '';
    // A final ん uses nn so it is confirmed before advancing to the next word.
    const base = this.word.romaji.replace(/n$/, 'nn');
    this.candidates = [''];
    for (let i = 0; i < base.length; i++) {
      const optional = base[i] === 'n' && i < base.length - 1 && /[^aiueoy]/.test(base[i + 1]) && !(i === base.length - 2 && base.endsWith('nn'));
      this.candidates = this.candidates.flatMap(prefix => optional ? [prefix + 'n', prefix + 'nn'] : [prefix + base[i]]);
    }
    this.displayRomaji = this.candidates[0];
  }

  remaining() {
    if (this.state !== 'playing') return 0;
    const remaining = Math.max(0, this.deadline - this.now());
    if (remaining === 0) this.state = 'finished';
    return remaining;
  }
  type(key) {
    if (this.state !== 'playing' || this.remaining() === 0) return 'ignored';
    if (!/^[a-z]$/.test(key)) return 'ignored';
    const next = this.typed + key;
    const matches = this.candidates.filter(candidate => candidate.startsWith(next));
    if (!matches.length) {
      this.misses++;
      return 'miss';
    }
    this.candidates = matches;
    this.typed = next;
    this.displayRomaji = matches[0];
    this.score++;
    this.index = next.length;
    if (matches.some(candidate => candidate === next)) {
      this.completed++;
      this.nextWord();
    }
    return 'correct';
  }
  get accuracy() {
    const total = this.score + this.misses;
    return total ? this.score / total * 100 : 0;
  }
}
