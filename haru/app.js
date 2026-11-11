'use strict';
/* 하루 (합친 앱): 일정표 시트(일정) + 「프로젝트」 탭(현황)을 한 앱에서. 연결은 bridge.js(연결 키) 그대로. */
(() => {
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
};
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => iso(new Date());
/* 할 일의 날짜: 날짜 칸이 비면 제목 끝 「(11/16)」에서 읽음(관제탑이 날짜를 제목에 적는 줄) */
const due = e => { if (e.date) return e.date; const m = /\((\d{1,2})\/(\d{1,2})\)\s*$/.exec(e.title || ''); if (!m) return ''; const n = new Date(), mo = +m[1]; let y = n.getFullYear(); if (mo < n.getMonth() + 1 - 6) y++; return `${y}-${pad(mo)}-${pad(+m[2])}`; };
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const monday = s => { const d = parse(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const label = s => { const d = parse(s); return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WD[d.getDay()]}요일`; };

/* 그룹: 시트엔 규연·Ella. 옛 이름이 남아 있어도 둘 중 하나로 보여 줌 */
const GROUP = g => ({'숲녘':'Ella','숭녘':'Ella','이음':'Ella','루미노드':'Ella','연가당':'규연','ella':'Ella'}[g] || (g === '규연' || g === 'Ella' ? g : 'Ella'));
const live = e => !e.deleted && e.status !== '취소' && !e.done;

const S = {
  items: [], projects: [], view: 'cal', tab: store.get('haru-tab', 'week'),
  sel: today(), ym: null, group: '전체', proj: null, pfilter: '전체',
  open: store.get('haru-open', null), syncedAt: null, saving: false
};
S.ym = (() => { const d = parse(S.sel); return [d.getFullYear(), d.getMonth()]; })();
const look = () => document.documentElement.dataset.theme || 'moon';

/* ---------- 데이터 ---------- */
const run = () => window.google && google.script && google.script.run;
function apply(state) {
  if (!state) return;
  if (Array.isArray(state.items)) S.items = state.items;
  if (Array.isArray(state.projects)) S.projects = state.projects;
  S.syncedAt = state.syncedAt || S.syncedAt;
  render();
}
function load(manual) {
  const r = run();
  if (!r) { notice('이 기기는 아직 일정표에 연결되지 않았어요.'); $('connect').hidden = false; return; }
  if (manual) toast('불러오는 중…');
  r.withSuccessHandler(s => { notice(''); $('connect').hidden = true; apply(s); store.set('haru-synced', new Date().toISOString()); if (manual) toast('새로 불러왔어요.'); renderSet(); })
   .withFailureHandler(e => { notice('일정표를 불러오지 못했어요: ' + (e && e.message || e)); $('connect').hidden = false; })
   .getHaruState();
}
function notice(t) { const n = $('notice'); n.textContent = t; n.hidden = !t; }
let toastT;
function toast(t, undo) {
  const el = $('toast'); clearTimeout(toastT);
  el.innerHTML = esc(t) + (undo ? ' <button type="button" id="undo">되돌리기</button>' : '');
  el.hidden = false;
  if (undo) $('undo').onclick = () => { el.hidden = true; undo(); };
  toastT = setTimeout(() => { el.hidden = true; }, undo ? 6000 : 2200);
}
function setStatus(e, status, msg, undoStatus) {
  const r = run(); if (!r) return toast('연결 전이라 바꿀 수 없어요.');
  /* 누르자마자 화면에 반영하고, 서버가 실패하면 되돌린다(서버 응답이 몇 초 걸려 「체크가 안 된다」로 보이던 것) */
  const prev = {status: e.status, done: e.done, deleted: e.deleted};
  e.status = status; e.done = status === '완료'; e.deleted = status === '삭제';
  render(); toast('저장 중…');
  r.withSuccessHandler(s => {
    apply(s);
    if (undoStatus) toast(msg, () => { const x = S.items.find(i => i.id === e.id); if (x) setStatus(x, undoStatus, '되돌렸어요.'); });
    else toast(msg);
  }).withFailureHandler(err => { Object.assign(e, prev); render(); toast('저장하지 못했어요: ' + String(err && err.message || err)); })
    .setHaruStatus({id: e.id, version: e.version, status});
}

/* ---------- 공통 그리기 ---------- */
const evs = (date) => S.items.filter(e => live(e) && e.date === date && (S.group === '전체' || GROUP(e.group) === S.group))
  .sort((a, b) => (a.allDay || !a.time ? '' : a.time).localeCompare(b.allDay || !b.time ? '' : b.time));
function timeText(e, wide) {
  if (e.allDay || !e.time) return '종일';
  return wide && e.end ? `${esc(e.time)}<small>~${esc(e.end)}</small>` : esc(e.time);
}
function row(e, opt = {}) {
  const g = GROUP(e.group);
  const dd = opt.date ? due(e) : '';
  const lead = opt.date ? `<span class="dchip">${dd ? (() => { const d = parse(dd); return `${d.getMonth() + 1}/${d.getDate()} ${WD[d.getDay()]}`; })() : '날짜 미정'}</span>`
                        : `<span class="tm">${timeText(e, opt.wide)}</span>`;
  return `<div class="row"><button class="ck" type="button" data-check="${esc(e.id)}" aria-label="${esc(e.title)} 끝냄"></button>${lead}<button class="tt" type="button" data-edit="${esc(e.id)}">${esc(opt.date ? e.title.replace(/\s*\(\d{1,2}\/\d{1,2}\)\s*$/, '') : e.title)}</button><span class="gp ${g}"><i class="dot g-${g}"></i>${g}</span><button class="chev" type="button" data-edit="${esc(e.id)}" aria-label="고치기">›</button></div>`;
}
function groupsHtml() {
  return ['전체', '규연', 'Ella'].map(g => `<button type="button" class="gchip${S.group === g ? ' on' : ''}" data-group="${g}">${g === '전체' ? '' : `<i class="dot g-${g}"></i>`}${g}</button>`).join('');
}

function render() {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === 'v-' + S.view));
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.view === (S.view === 'detail' ? 'proj' : S.view)));
  const showG = store.get('haru-groups', true);
  document.querySelectorAll('[data-groups]').forEach(el => { el.innerHTML = groupsHtml(); el.classList.toggle('hide', !showG); });
  document.querySelector('.brand').textContent = look() === 'green' && S.view === 'sched' ? '하루 일정' : '하루';
  document.body.dataset.view = S.view;
  if (S.view === 'cal') renderCal();
  if (S.view === 'proj') renderProj();
  if (S.view === 'detail') renderDetail();
  if (S.view === 'sched') renderSched();
  if (S.view === 'set') renderSet();
  if (!$('day-sheet').hidden) renderDay();
}

/* ---------- 달력 ---------- */
function renderCal() {
  const [y, m] = S.ym;
  $('m-label').textContent = `${y}년 ${m + 1}월`;
  const first = new Date(y, m, 1), start = addDays(first, -((first.getDay() + 6) % 7)), t = today();
  let h = '';
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i), s = iso(d), list = evs(s);
    const cls = ['day', d.getMonth() !== m && 'out', d.getDay() === 0 && 'sun', s === t && 'today', s === S.sel && 'sel'].filter(Boolean).join(' ');
    const shown = list.slice(0, 3).map(e => `<span class="chip ${GROUP(e.group)}">${esc(e.title.replace(/^(\[[^\]]*\]\s*)+/, ''))}</span>`).join('');
    const more = list.length > 3 ? `<span class="more">+${list.length - 3}</span>` : '';
    const num = d.getMonth() !== m && d.getDate() === 1 ? `${d.getMonth() + 1}/1` : d.getDate();
    h += `<button type="button" class="${cls}" data-day="${s}" aria-label="${label(s)} 일정 ${list.length}개"><span class="num">${num}${list.length ? `<span class="cnt">(${list.length})</span>` : ''}</span>${shown}${more}</button>`;
  }
  $('month').innerHTML = h;
}
function openDay(s) { S.sel = s; $('day-back').hidden = false; $('day-sheet').hidden = false; renderDay(); renderCal(); }
function closeDay() { $('day-back').hidden = true; $('day-sheet').hidden = true; }
function renderDay() {
  $('day-title').textContent = label(S.sel);
  const list = evs(S.sel);
  $('day-list').innerHTML = list.length ? list.map(e => row(e)).join('') : '<p class="empty">이날 일정이 없어요.</p>';
}

/* ---------- 프로젝트 (보기 전용, 시트 「프로젝트」 탭) ---------- */
const stKey = s => /완료/.test(s) ? 'done' : /대기|확인|보류/.test(s) ? 'wait' : 'on';
const stName = {on: '진행중', wait: '대기', done: '완료'};
const stImg = k => `<img class="st" src="img/ic/st-${k}${look() === 'green' ? '-g' : ''}.png" alt="${stName[k]}">`;
function projects() {
  const rows = S.projects; if (!rows || rows.length < 2) return [];
  const H = rows[0].map(h => String(h).trim());
  const col = (...names) => H.findIndex(h => names.includes(h));
  const c = {p: col('프로젝트'), n: col('세부 일', '세부일', '이름'), s: col('상태'), now: col('지금 하는 일', '지금'), next: col('다음 할 일', '다음'), d: col('날짜', '다음 날짜')};
  const map = new Map();
  rows.slice(1).forEach(r => {
    const p = String(r[c.p] || '').trim(), n = String(r[c.n] || '').trim();
    if (!p || !n) return;
    if (!map.has(p)) map.set(p, {name: p, items: []});
    map.get(p).items.push({name: n, st: stKey(String(r[c.s] || '')), now: c.now >= 0 ? String(r[c.now] || '') : '', next: c.next >= 0 ? String(r[c.next] || '') : '', date: c.d >= 0 ? String(r[c.d] || '') : ''});
  });
  return [...map.values()];
}
const md = s => { const m = String(s || '').match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/); return m ? `${+m[2]}/${+m[3]}` : (s || '—'); };
const pimg = name => { const k0 = name.toLowerCase(), k = ['plan', 'ai', 'app'].includes(k0) ? k0 : 'default'; return `img/p-${k}-${look()}.${look() === 'moon' && k !== 'default' ? 'png' : 'webp'}`; };
const countHtml = items => {
  const n = k => items.filter(i => i.st === k).length;
  return ['on', 'wait', 'done'].filter(k => n(k)).map(k => `<span class="${k}">${k === 'on' ? '진행' : k === 'wait' ? '대기' : '완료'} ${n(k)}</span>`).join('<i class="sep">·</i>') || '<span class="done">세부 일 없음</span>';
};
const subHtml = (i, p) => `<div class="sub"><div class="t"><b>${esc(i.name)}</b>${i.now ? `<small>${esc(i.now)}</small>` : ''}</div>${stImg(i.st)}${p ? `<button class="go" type="button" data-detail="${esc(p)}">자세히 ›</button>` : ''}</div>`;
function renderProj() {
  const ps = projects(), all = ps.flatMap(p => p.items);
  const n = k => k === '전체' ? all.length : all.filter(i => stName[i.st] === k).length;
  $('p-filter').innerHTML = ['전체', '진행중', '대기', '완료'].map(k => `<button type="button" data-pf="${k}" class="${S.pfilter === k ? 'on' : ''}">${k === '전체' ? '' : `<i class="dot pf-${k}"></i>`}${k} <span class="n">${n(k)}</span></button>`).join('');
  if (!S.open) S.open = ps.length ? [ps[0].name] : [];
  const keep = i => S.pfilter === '전체' || stName[i.st] === S.pfilter;
  const html = ps.map(p => {
    const items = p.items.filter(keep); if (!items.length) return '';
    const open = S.open.includes(p.name);
    return `<article class="card pcard${open ? ' open' : ''}"><button class="phead" type="button" data-fold="${esc(p.name)}" aria-expanded="${open}"><img class="pimg" src="${pimg(p.name)}" alt=""><span class="pname"><b>${esc(p.name)}</b><span class="counts">${countHtml(p.items)}</span></span><span class="fold" aria-hidden="true">⌄</span></button><div class="pbody">${items.map(i => subHtml(i, p.name)).join('')}<button class="go-all" type="button" data-detail="${esc(p.name)}">자세히 →</button></div></article>`;
  }).join('');
  $('p-list').innerHTML = html || `<p class="empty">${ps.length ? '이 상태인 세부 일이 없어요.' : '프로젝트 현황을 불러오는 중이거나 아직 비어 있어요.'}</p>`;
}
function renderDetail() {
  const p = projects().find(x => x.name === S.proj);
  if (!p) { S.view = 'proj'; return render(); }
  const main = p.items.some(i => i.st === 'on') ? 'on' : p.items.some(i => i.st === 'wait') ? 'wait' : 'done';
  const nexts = p.items.filter(i => i.next).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  $('d-body').innerHTML =
    `<div class="card dhead"><img class="pimg" src="${pimg(p.name)}" alt=""><div><b>${esc(p.name)}</b> ${stImg(main)}<p>${esc(p.items.map(i => i.name).join(' · '))}</p></div></div>` +
    `<section class="card sec"><h4>진행 목록 <span class="c">${p.items.length}</span></h4>${p.items.map(i => subHtml(i)).join('')}</section>` +
    `<section class="card sec"><h4>다음 할 일 <span class="c">${nexts.length}</span></h4>${nexts.length ? nexts.map(i => `<div class="next"><span class="d">${esc(md(i.date))}</span><span>${esc(i.next)} <small style="color:var(--sub)">· ${esc(i.name)}</small></span></div>`).join('') : '<p class="empty">적어 둔 다음 할 일이 없어요.</p>'}</section>`;
}

/* ---------- 일정 ---------- */
function renderSched() {
  document.querySelectorAll('#s-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === S.tab));
  $('strip-wrap').hidden = S.tab === 'todo';
  const mon = monday(S.sel), t = today();
  $('strip').innerHTML = Array.from({length: 7}, (_, i) => {
    const d = addDays(mon, i), s = iso(d);
    return `<button type="button" data-pick="${s}" class="${s === S.sel ? 'on' : ''}${evs(s).length ? ' has' : ''}"${s === t ? ' aria-current="date"' : ''}>${'월화수목금토일'[i]}<b>${d.getDate()}</b></button>`;
  }).join('');
  let h = '';
  if (S.tab === 'week') {
    for (let i = 0; i < 7; i++) {
      const s = iso(addDays(mon, i)), list = evs(s);
      if (list.length) h += `<section class="card daycard"><h4>${label(s)}</h4>${list.map(e => row(e)).join('')}</section>`;
    }
    h = h || '<p class="empty">이번 주 일정이 없어요.</p>';
  } else if (S.tab === 'day') {
    const list = evs(S.sel);
    h = `<section class="card daycard"><h4>${label(S.sel)}<span class="c">${list.length}개</span></h4>${list.length ? list.map(e => row(e, {wide: true})).join('') : '<p class="empty">이날 일정이 없어요.</p>'}</section>`;
  } else {
    const tasks = S.items.filter(e => live(e) && e.type === 'task' && (S.group === '전체' || GROUP(e.group) === S.group))
      .sort((a, b) => (due(a) || '0000').localeCompare(due(b) || '0000') || (a.time || '99').localeCompare(b.time || '99'));
    /* 일주일 안(지난 것·날짜 미정 포함)만 펼치고, 그 뒤는 「나중에」로 접음 */
    const wk = iso(addDays(parse(t), 6)), soon = tasks.filter(e => !due(e) || due(e) <= wk), later = tasks.filter(e => due(e) && due(e) > wk);
    const todays = evs(t).filter(e => e.type !== 'task');
    h = `<section class="card daycard todo"><h4>이번 주 할 일<span class="c">${soon.length}개</span></h4>${soon.length ? soon.map(e => row(e, {date: true})).join('') : '<p class="empty">이번 주 남은 할 일이 없어요.</p>'}` +
        (later.length ? `<button class="later-btn" type="button" data-later>나중에 할 일 ${later.length}개 ${S.later ? '접기 ▴' : '보기 ▾'}</button>${S.later ? later.map(e => row(e, {date: true})).join('') : ''}` : '') + `</section>` +
        `<section class="card daycard today"><h4>오늘 일정<span class="c">${todays.length}개</span></h4>${todays.length ? todays.map(e => row(e, {wide: true})).join('') : '<p class="empty">오늘 일정이 없어요.</p>'}</section>` +
        `<button class="add-btn" type="button" data-add>＋ 추가</button>`;
  }
  $('fab').hidden = S.tab === 'todo';
  $('s-list').innerHTML = h;
}

/* ---------- 설정 ---------- */
function renderSet() {
  const start = store.get('haru-start', 'cal');
  document.querySelectorAll('#set-start button').forEach(b => b.classList.toggle('on', b.dataset.start === start));
  document.querySelectorAll('#set-look button').forEach(b => b.classList.toggle('on', b.dataset.look === look()));
  $('sw-groups').setAttribute('aria-checked', String(store.get('haru-groups', true)));
  const at = store.get('haru-synced', null);
  if (at) { const d = new Date(at); $('last-sync').textContent = `마지막 불러옴 ${iso(d) === today() ? '오늘' : `${d.getMonth() + 1}/${d.getDate()}`} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
  const trash = S.items.filter(e => e.deleted).sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
  $('trash-count').textContent = trash.length;
  $('trash-list').innerHTML = trash.length ? trash.slice(0, 30).map(e => `<div class="row"><span class="tm">${esc(e.date ? e.date.slice(5).replace('-', '/') : '—')}</span><span class="tt">${esc(e.title)}</span><button class="pill-btn small" type="button" data-restore="${esc(e.id)}">복원</button></div>`).join('') : '<p class="empty">삭제된 일정이 없어요.</p>';
}

/* ---------- 추가·수정 창 ---------- */
let editing = null, newId = null;
const segVal = id => document.querySelector(`#${id} button.on`)?.dataset.v;
const segSet = (id, v) => document.querySelectorAll(`#${id} button`).forEach(b => b.classList.toggle('on', b.dataset.v === v));
function openForm(e, preset = {}) {
  editing = e || null; newId = e ? null : 'a' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  $('form-title').textContent = e ? (e.type === 'task' ? '할 일 고치기' : '일정 고치기') : '일정 추가';
  $('f-title').value = e?.title || '';
  segSet('f-type', e?.type || preset.type || 'event');
  segSet('f-group', e ? GROUP(e.group) : (S.group === '전체' ? '규연' : S.group));
  $('f-date').value = e ? e.date : (preset.date ?? S.sel);
  const ad = e ? e.allDay : false;
  $('f-allday').setAttribute('aria-checked', String(ad));
  $('f-time').value = e?.time || ''; $('f-end').value = e?.end || '';
  $('f-place').value = e?.place || ''; $('f-note').value = e?.note || '';
  $('f-delete').hidden = !e; $('form-err').hidden = true;
  timeRows(); $('form-back').hidden = false;
  if (!e) setTimeout(() => $('f-title').focus(), 50);
}
function timeRows() { const ad = $('f-allday').getAttribute('aria-checked') === 'true'; $('f-time-row').hidden = ad; $('f-end-row').hidden = ad; }
function closeForm() { $('form-back').hidden = true; editing = null; }
function formErr(t) { $('form-err').textContent = t; $('form-err').hidden = false; }
function save(ev) {
  ev.preventDefault(); if (S.saving) return;
  const r = run(); if (!r) return formErr('이 기기는 아직 연결 전이에요.');
  const allDay = $('f-allday').getAttribute('aria-checked') === 'true';
  const p = {id: editing?.id || newId, version: editing?.version || null, title: $('f-title').value.trim(), type: segVal('f-type') || 'event', group: segVal('f-group') || '규연',
    date: $('f-date').value, time: allDay ? '' : $('f-time').value, end: allDay ? '' : $('f-end').value, allDay, place: $('f-place').value.trim(), note: $('f-note').value.trim()};
  if (!p.title) return formErr('제목을 적어 주세요.');
  if (!p.date) return formErr('날짜를 골라 주세요.');
  if (!p.time && p.end) return formErr('시작 시간을 먼저 넣어 주세요.');
  if (p.time && p.end && p.end < p.time) return formErr('끝 시간은 시작 시간 뒤로 넣어 주세요.');
  S.saving = true; $('f-save').disabled = true;
  r.withSuccessHandler(s => { S.saving = false; $('f-save').disabled = false; closeForm(); apply(s); toast('저장했어요.'); })
   .withFailureHandler(err => { S.saving = false; $('f-save').disabled = false; formErr(String(err && err.message || err)); })
   .saveHaruEvent(p);
}

/* ---------- 눌렀을 때 ---------- */
function go(view) { S.view = view; closeDay(); render(); $('app').querySelectorAll('.scroll').forEach(s => s.scrollTop = 0); }
document.addEventListener('click', ev => {
  const b = ev.target.closest('button'); if (!b) return;
  const d = b.dataset, find = id => S.items.find(e => e.id === id);
  if (d.view) return go(d.view);
  if (d.group) { S.group = S.group === d.group && d.group !== '전체' ? '전체' : d.group; return render(); }
  if (d.day) return openDay(d.day);
  if (d.check) { const e = find(d.check); if (e) setStatus(e, '완료', e.type === 'task' ? '할 일을 끝냈어요.' : '일정을 끝냈어요.', '예정'); return; }
  if (d.edit) { const e = find(d.edit); if (e) { closeDay(); openForm(e); } return; }
  if (d.restore) { const e = find(d.restore); if (e) setStatus(e, '예정', '복원했어요.'); return; }
  if (d.pf) { S.pfilter = d.pf; return renderProj(); }
  if ('later' in d) { S.later = !S.later; return render(); }
  if (d.fold) { const n = d.fold; S.open = S.open.includes(n) ? S.open.filter(x => x !== n) : [...S.open, n]; store.set('haru-open', S.open); return renderProj(); }
  if (d.detail) { S.proj = d.detail; return go('detail'); }
  if (d.tab) { S.tab = d.tab; store.set('haru-tab', S.tab); return renderSched(); }
  if (d.pick) { S.sel = d.pick; if (S.tab === 'week') S.tab = 'day'; return renderSched(); }
  if (d.start) { store.set('haru-start', d.start); return renderSet(); }
  if (d.look) { document.documentElement.dataset.theme = d.look; try { localStorage.setItem('haru-look', d.look); } catch (_) {} return render(); }
  if (d.v && b.parentElement.classList.contains('seg')) { segSet(b.parentElement.id, d.v); return; }
});
$('start').onclick = () => { $('cover').classList.add('hide'); setTimeout(() => $('cover').hidden = true, 380); };
$('m-prev').onclick = () => { let [y, m] = S.ym; m--; if (m < 0) { m = 11; y--; } S.ym = [y, m]; renderCal(); };
$('m-next').onclick = () => { let [y, m] = S.ym; m++; if (m > 11) { m = 0; y++; } S.ym = [y, m]; renderCal(); };
$('w-prev').onclick = () => { S.sel = iso(addDays(parse(S.sel), -7)); renderSched(); };
$('w-next').onclick = () => { S.sel = iso(addDays(parse(S.sel), 7)); renderSched(); };
$('cal-add').onclick = () => openForm(null, {date: S.sel});
[['month', 'm-next', 'm-prev'], ['strip', 'w-next', 'w-prev']].forEach(([el, nx, pv]) => { let x0 = null; const st = $(el);
  st.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, {passive: true});
  st.addEventListener('touchend', e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) $(dx < 0 ? nx : pv).onclick(); }, {passive: true}); });
$('day-close').onclick = closeDay; $('day-back').onclick = closeDay;
$('day-add').onclick = () => { const s = S.sel; closeDay(); openForm(null, {date: s}); };
$('fab').onclick = () => openForm(null, {type: S.tab === 'todo' ? 'task' : 'event', date: S.tab === 'todo' ? today() : S.sel});
$('s-list').addEventListener('click', ev => { if (ev.target.closest('[data-add]')) $('fab').onclick(); });
document.querySelectorAll('[data-sfold]').forEach(b => b.addEventListener('click', () => { const c = b.closest('.set-card'); c.classList.toggle('folded'); b.setAttribute('aria-expanded', String(!c.classList.contains('folded'))); }));
$('d-back').onclick = () => go('proj');
$('form').onsubmit = save; $('f-cancel').onclick = closeForm; $('form-close').onclick = closeForm;
$('form-back').addEventListener('click', e => { if (e.target === $('form-back')) closeForm(); });
$('f-allday').onclick = () => { const b = $('f-allday'); b.setAttribute('aria-checked', String(b.getAttribute('aria-checked') !== 'true')); timeRows(); };
$('f-delete').onclick = () => { const e = editing; if (!e) return; closeForm(); setStatus(e, '삭제', '삭제했어요.', '예정'); };
$('reload').onclick = () => load(true);
$('sw-groups').onclick = () => { store.set('haru-groups', !store.get('haru-groups', true)); if (!store.get('haru-groups', true)) S.group = '전체'; render(); renderSet(); };
$('trash-btn').onclick = () => { $('trash-list').hidden = !$('trash-list').hidden; };
$('copy-link').onclick = async () => {
  const c = store.get('haru-conn', null);
  if (!c || !c.api || !c.k) return toast('이 기기에 연결 정보가 없어요.');
  const link = `${location.origin}${location.pathname}#api=${encodeURIComponent(c.api)}&k=${encodeURIComponent(c.k)}`;
  try { await navigator.clipboard.writeText(link); toast('새 기기 링크를 복사했어요. 남에게는 보내지 마세요.'); }
  catch (_) { prompt('이 링크를 복사해 새 기기에서 여세요.', link); }
};

/* 연결 안 된 기기: 새 기기 링크 또는 웹 앱 주소 + 키를 붙여 넣어 연결 */
$('connect').onclick = () => {
  const a = (prompt('새 기기 링크를 붙여 넣거나, Apps Script 웹 앱 주소(…/exec)를 붙여 넣어 주세요.') || '').trim();
  if (!a) return;
  let api = a, k = '';
  const h = a.indexOf('#');
  if (h >= 0) { const p = new URLSearchParams(a.slice(h + 1)); api = p.get('api') || ''; k = p.get('k') || ''; }
  if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(api)) return toast('웹 앱 주소가 아니에요. script.google.com 으로 시작하고 /exec 로 끝나야 해요.');
  if (!k) { const old = store.get('haru-conn', null); if (old && old.k && confirm('지금 저장된 키를 그대로 쓸까요? (서버만 새로 만들고 키는 같을 때)')) k = old.k; }
  if (!k) k = (prompt('Code.gs 맨 위 API_KEY 값을 붙여 넣어 주세요.') || '').trim().replace(/^['"]|['"]$/g, '');
  if (!k) return;
  store.set('haru-conn', {api, k});
  location.reload();
};

/* ---------- 시작 ---------- */
if (location.hash.includes('k=')) history.replaceState(null, '', location.pathname);
S.view = store.get('haru-start', 'cal');
const cached = store.get('haru-cache', null);
if (cached) apply(cached); else render();
load(false);
})();
