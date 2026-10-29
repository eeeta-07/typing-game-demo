import { Game, DURATION_MS } from './engine.js';
import { seededRandom } from './random.js';
import { loadSiteMode } from './demo-ui.js';

const $ = id => document.getElementById(id);
let game;
let siteMode = {demo:false};
let wordList;
let frame;
let countdownTimer;
let view = 'home';
let playerName = 'ゲスト';
let sessionId;
let events = [];
let generation = 0;
let registrationPending = false;
async function api(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {...options, signal: controller.signal});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '接続できません。');
    return data;
  } finally { clearTimeout(timeout); }
}
function discardSession() {
  const id = sessionId;
  sessionId = undefined;
  if (id) fetch(`/api/sessions/${id}`, {method:'DELETE'}).catch(() => {});
}
function returnHome() {
  if (registrationPending) return;
  generation++;
  discardSession();
  clearInterval(countdownTimer);
  cancelAnimationFrame(frame);
  if (game) game.state = 'ready';
  show('home');
  $('username').focus();
}
function show(name) {
  view = name;
  for (const id of ['home', 'countdown', 'play', 'result']) $(id).hidden = id !== name;
}
function draw() {
  $('word').textContent = game.word.text;
  $('typed').textContent = game.displayRomaji.slice(0, game.index);
  $('current').textContent = game.displayRomaji[game.index];
  $('pending').textContent = game.displayRomaji.slice(game.index + 1);
  $('score').textContent = game.score;
  $('miss').textContent = game.misses;
  $('accuracy').textContent = `${game.accuracy.toFixed(1)}%`;
}
function finish() {
  cancelAnimationFrame(frame);
  for (const [id, value] of Object.entries({ 'final-score': game.score, 'final-correct': game.score, 'final-miss': game.misses, 'final-accuracy': `${game.accuracy.toFixed(1)}%`, 'final-completed': game.completed })) $(id).textContent = value;
  $('register').disabled = false;
  $('register').textContent = 'この記録をランキングに登録';
  $('register-status').textContent = '登録すると名前と記録が教室のスクリーンにも表示されます。';
  $('result-player').textContent = `${playerName} さんの記録`;
  show('result');
  $('result-title').focus();
}
function tick() {
  const remaining = game.remaining();
  if (!remaining) return finish();
  $('timer').textContent = (remaining / 1000).toFixed(1);
  $('time-bar').style.width = `${remaining / DURATION_MS * 100}%`;
  frame = requestAnimationFrame(tick);
}
function begin() {
  if (!game || registrationPending || view === 'countdown' || view === 'play') return;
  discardSession();
  const attempt = ++generation;
  $('load-status').textContent = '';
  playerName = $('username').value.normalize('NFC').trim() || 'ゲスト';
  $('player-name').textContent = `${playerName} さん`;
  clearInterval(countdownTimer);
  cancelAnimationFrame(frame);
  show('countdown');
  let count = 3;
  $('count-number').textContent = count;
  countdownTimer = setInterval(async () => {
    count--;
    if (count > 0) { $('count-number').textContent = count; return; }
    clearInterval(countdownTimer);
    $('count-number').textContent = '接続中…';
    try {
      if (siteMode.demo) {
        game = new Game(wordList);
        events = [];
      } else {
      const session = await api('/api/sessions', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:playerName})});
      if (attempt !== generation || view !== 'countdown') {
        fetch(`/api/sessions/${session.id}`, {method:'DELETE'}).catch(() => {});
        return;
      }
      sessionId = session.id;
      events = [];
      game = new Game(session.words, () => performance.now(), seededRandom(session.seed));
      }
    } catch (error) {
      if (attempt !== generation) return;
      returnHome();
      $('load-status').textContent = error.name === 'AbortError' ? '接続がタイムアウトしました。再度スタートしてください。' : error.message;
      return;
    }
    game.start();
    $('word-card').classList.remove('miss');
    $('input-notice').textContent = '半角英数・小文字で入力してください';
    draw();
    show('play');
    $('play').focus();
    tick();
  }, 1000);
}
$('start-form').addEventListener('submit', event => { event.preventDefault(); begin(); });
$('retry').addEventListener('click', begin);
$('back').addEventListener('click', returnHome);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !event.isComposing && (view === 'play' || view === 'countdown')) {
    event.preventDefault();
    returnHome();
    return;
  }
  if (view !== 'play') return;
  if (!game.remaining()) return finish();
  if (event.isComposing || event.keyCode === 229) {
    $('input-notice').textContent = '日本語入力がONです。半角/全角キーなどでOFFにしてください。';
    return;
  }
  if (event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
  if (/^[a-zA-Z]$/.test(event.key) || event.key === ' ' || event.key === 'Backspace') event.preventDefault();
  if (/^[A-Z]$/.test(event.key)) { $('input-notice').textContent = '小文字で入力してください。Caps Lockも確認してください。'; return; }
  const at = DURATION_MS - Math.max(0, game.deadline - game.now());
  const outcome = game.type(event.key);
  if (outcome === 'ignored') return;
  if (!siteMode.demo) events.push({key:event.key, at});
  $('input-notice').textContent = '半角英数・小文字で入力してください';
  $('word-card').classList.toggle('miss', outcome === 'miss');
  draw();
});

$('register').addEventListener('click', async () => {
  if (siteMode.demo || view !== 'result' || !sessionId || registrationPending) return;
  const attempt = generation;
  registrationPending = true;
  $('register').disabled = true;
  $('retry').disabled = true;
  $('back').disabled = true;
  $('register-status').textContent = '登録中…';
  try {
    await api('/api/results', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({sessionId,events})});
    if (attempt !== generation) return;
    $('register').textContent = '登録済み';
    $('register-status').textContent = '登録しました。ランキングに反映されます。';
  } catch (error) {
    if (attempt !== generation) return;
    $('register').disabled = false;
    $('register-status').textContent = error.name === 'AbortError' ? '接続が不安定です。もう一度押しても二重登録にはなりません。' : error.message;
  } finally {
    registrationPending = false;
    $('retry').disabled = false;
    $('back').disabled = false;
  }
});

document.addEventListener('visibilitychange', () => {
  if (view === 'play' && !game.remaining()) finish();
});
try {
  siteMode = await loadSiteMode();
  const response = await fetch('./words.json');
  if (!response.ok) throw new Error('Failed to load');
  wordList = await response.json();
  game = new Game(wordList);
  $('start').disabled = false;
  $('start').textContent = 'スタート';
} catch {
  $('start').textContent = '読み込めませんでした';
  $('load-status').textContent = '読み込めません。ページを再読み込みし、接続先を確認してください。';
}
