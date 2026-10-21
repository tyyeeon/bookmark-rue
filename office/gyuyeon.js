// Decorative owner avatar only. Never enters task/state/request data.
const world = document.getElementById('world');
const app = document.querySelector('.app');
const assets = { human: 'gyuyeon-human.png', squirrel: 'gyuyeon-squirrel.png' };
let mode = 'human';
try { if (localStorage.getItem('office-gyuyeon-mode') === 'squirrel') mode = 'squirrel'; } catch {}
const avatar = document.createElement('button');
avatar.type = 'button'; avatar.id = 'gyuyeon-avatar'; avatar.dataset.floor = '3F';
avatar.className = 'gyuyeon-avatar';
avatar.innerHTML = '<img alt=""><span class="gyuyeon-name">규연 <small>장식 캐릭터</small></span>';
const image = avatar.querySelector('img');
const toggle = document.createElement('button');
toggle.type = 'button'; toggle.className = 'gyuyeon-toggle';
toggle.title = '규연의 장식 캐릭터 모습 전환 · 접속 상태와 무관';
function render() {
  image.src = assets[mode]; image.alt = mode === 'human' ? '쿠키와 보고서를 든 사람 규연' : '쿠키와 보고서를 든 다람쥐 규연';
  avatar.setAttribute('aria-label', `${mode === 'human' ? '사람' : '다람쥐'} 규연 총괄 · 눌러서 모습 전환 · 장식 캐릭터`);
  toggle.textContent = mode === 'human' ? '🐿️' : '🙂';
  toggle.title = mode === 'human' ? '다람쥐 규연으로 변신 · 장식 캐릭터' : '사람 규연으로 변신 · 장식 캐릭터';
  avatar.querySelector('.gyuyeon-name').textContent = '규연 총괄';
  toggle.setAttribute('aria-label', avatar.getAttribute('aria-label'));
}
function change() { mode = mode === 'human' ? 'squirrel' : 'human'; try { localStorage.setItem('office-gyuyeon-mode', mode); } catch {} render(); }
avatar.onclick = toggle.onclick = change;
avatar.addEventListener('pointerdown', e => e.stopPropagation());
avatar.addEventListener('click', e => e.stopPropagation());
image.onload = () => avatar.classList.add('ready');
image.onerror = () => avatar.classList.remove('ready');
world.appendChild(avatar);
document.querySelector('.zoom').appendChild(toggle);
const sync = () => { toggle.hidden = app.dataset.floor !== '*' && app.dataset.floor !== '3F'; };
new MutationObserver(sync).observe(app, { attributes: true, attributeFilter: ['data-floor'] });
render(); sync();
