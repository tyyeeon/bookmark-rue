// 새 관제 UI(dashboard.js)와 실제 데이터를 잇는 어댑터. 화면은 루에 디자인 그대로, 여기는 데이터·기능만.
// 데이터: 스냅샷의 projects(이음이 방 목록으로 만듦) + db projectState(보관·복원·새 프로젝트, claude.ai 사무실에서만 쓰기)
import './dashboard.js';
const ui = document.getElementById('studio');
const studio = window.studio;
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const ago = t => { const s = Math.max(0, (Date.now() - t) / 1000 | 0); return s < 60 ? '방금' : s < 3600 ? `${s / 60 | 0}분 전` : s < 86400 ? `${s / 3600 | 0}시간 전` : `${s / 86400 | 0}일 전`; };
let overrides = {}, selectedId = store.get('vs-sel') || null, pending = false;

function projectsOf(snap) {
  if (Array.isArray(snap?.projects)) return snap.projects.map(p => ({ ...p }));
  // 예전 스냅샷(projects 없음): 사람 한 명 = 작업 하나
  const people = snap?.people || [];
  return people.length ? [{ id: 'all', name: '사무실', icon: '◈', color: 'mint', status: '대기', owner: null, next: null, summary: '저장된 사무실 현황이에요.', updated: null, tasks: people.map(p => ({ id: p.id, title: p.name || '제목 없는 작업', owner: '이음', status: p.state === 'working' ? '진행 중' : p.state === 'thinking' ? '컨펌 필요' : '대기', next: null })), approvals: [] }] : [];
}
function build() {
  const base = projectsOf(studio.snap).map(p => ({ ...p, ...(overrides[p.id] && 'archived' in overrides[p.id] ? { archived: !!overrides[p.id].archived, status: overrides[p.id].archived ? '완료' : (p.status === '완료' ? '대기' : p.status) } : {}) }));
  const known = new Set(base.map(p => p.id));
  for (const [id, o] of Object.entries(overrides)) if (o.custom && !known.has(id)) base.push({ id, name: o.name, icon: o.icon || '✳', color: o.color || 'mint', status: o.archived ? '완료' : '미확인', owner: o.owner || null, next: o.next || null, summary: '새 프로젝트예요. 방은 이음이 연결해요.', updated: null, archived: !!o.archived, tasks: [], approvals: [] });
  return base;
}
function push() {
  const projects = build();
  if (!projects.some(p => p.id === selectedId && !p.archived)) selectedId = projects.find(p => !p.archived)?.id ?? null;
  const at = Date.parse(studio.snap?.at) || 0;
  ui.model = { projects, selectedId, demo: false, note: at ? `저장된 현황 · ${ago(at)} 기준` : '아직 채워진 현황이 없어요', footer: studio.db ? '함께 만드는 작업 공간' : '보기 전용 · 바꾸기는 claude.ai 사무실에서' };
  studio.afterPush?.();
}
studio.on.snapshot = push;
studio.on.db = db => { db.collection('projectState').onSnapshot(qs => { overrides = Object.fromEntries(qs.docs.map(d => [d.id, d.data()])); push(); }, () => {}); };
if (studio.db) studio.on.db(studio.db);

async function write(id, data, ok, target = ui) {
  if (!studio.db) { target.notify('바꾸기는 claude.ai 사무실에서만 할 수 있어요.'); push(); return; }
  if (pending) return; pending = true;
  try {
    const ref = studio.db.collection('projectState').doc(id);
    await ref.set({ ...(overrides[id] || {}), ...data, updatedAt: new Date().toISOString() });
    overrides[id] = { ...(overrides[id] || {}), ...data }; target.notify(ok);
  } catch { target.notify('저장하지 못했어요. 잠시 뒤에 다시 눌러 주세요.'); }
  pending = false; push();
}
ui.addEventListener('studio-action', ({ detail: d }) => {
  const p = build().find(x => x.id === d.projectId);
  if (d.type === 'select') { selectedId = d.projectId; store.set('vs-sel', selectedId); push(); }
  else if (d.type === 'archive') write(d.projectId, { archived: true }, `${p?.name || '프로젝트'}를 보관했어요.`);
  else if (d.type === 'restore') { selectedId = d.projectId; write(d.projectId, { archived: false }, `${p?.name || '프로젝트'}를 다시 열었어요.`); }
  else if (d.type === 'create') { const id = 'u-' + Date.now().toString(36); selectedId = id; write(id, { custom: true, ...d.values, icon: '✳', color: 'mint', archived: false }, `${d.values.name} 프로젝트를 만들었어요.`); }
  else if (d.type === 'review') { /* 방 링크가 있으면 버튼이 곧바로 방을 연다 */ }
});
ui.addEventListener('studio-floor', ({ detail }) => studio.setFloor(detail.floor));
ui.addEventListener('studio-render', () => requestAnimationFrame(() => studio.fit()));
studio.floor0 = ui.floor;
studio.setFloor(ui.floor);
if (studio.snap) push(); else ui.model = { projects: [], selectedId: null, demo: false, note: '불러오는 중' };

export { build, write, push };
