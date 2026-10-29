// 업무 현황(team-studio, 루에 1028 디자인)과 실제 데이터를 잇는 어댑터. 화면은 루에 것 그대로, 여기는 데이터·기능만.
// 데이터는 새 관제 UI와 같은 스냅샷(projects)·db projectState를 쓴다(studio-adapter.js가 만든 build()를 같이 씀).
import './team-studio/studio.js';
import './our-studio/dashboard.js?v=2';  // 카드 변경 캐시 무효화
import { build, write } from './studio-adapter.js';
const team = document.getElementById('team');
const ours = document.getElementById('ours');  // 우리 스튜디오(루에 1028 인테리어 화면) — 같은 모델을 쓴다
let selectedId = null;
const studio = window.studio;
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const OWNER_ID = { '이음': 'eum', '루에': 'rue', '규연': 'gyu' };
const fmt = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
let refreshing = false, refreshedAt = 0;

function model() {
  const projects = build().map(p => ({
    ...p,
    tasks: (p.tasks || []).map(t => ({ ...t, ownerId: OWNER_ID[t.owner] })),
    approvals: (p.approvals || []).map(a => ({ ...a, reviewerId: 'gyu' })),
  }));
  // 이음이 "진행 중"인 방이 있으면 그걸 현재 작업으로, 없으면 비워 둔다(기록 없는 상태는 추정하지 않음)
  let eumNow = null;
  for (const p of projects) { if (p.archived) continue; const t = (p.tasks || []).find(t => t.status === '진행 중' && t.ownerId === 'eum'); if (t) { eumNow = { projectId: p.id, taskId: t.id }; break; } }
  let rueNow = null;  // 루에도 같은 규칙: 기록에 "진행 중"으로 적힌 루에 업무가 있으면 그것, 없으면 비움
  for (const p of projects) { if (p.archived) continue; const t = (p.tasks || []).find(t => t.status === '진행 중' && t.ownerId === 'rue'); if (t) { rueNow = { projectId: p.id, taskId: t.id }; break; } }
  const at = Date.parse(studio.snap?.at) || 0;
  return {
    projects, viewerId: 'gyu', demo: false,
    members: [
      { id: 'rue', name: '루에', image: 'rue-work.webp', current: rueNow },
      { id: 'eum', name: '이음', image: 'eum-work.webp', current: eumNow },
      { id: 'gyu', name: '규연', image: 'gyuyeon-human.webp', current: null },
    ],
    connection: refreshing ? { state: 'loading' } : at ? { state: 'ready', updatedAt: fmt.format(at) } : { state: 'unconnected' },
  };
}
const push = () => {
  const m = model(); team.model = m;
  const open = m.projects.filter(p => !p.archived);
  if (!open.some(p => p.id === selectedId)) selectedId = (open.find(p => p.status === '진행 중') || open[0])?.id || null;
  ours.model = { ...m, selectedId };
};
const prev = studio.afterPush; studio.afterPush = () => { prev?.(); push(); };
if (studio.snap) push(); else ours.model = team.model = { projects: [], members: [], viewerId: 'gyu', demo: false, connection: { state: 'loading' } };

for (const el of [team, ours]) el.addEventListener('studio-action', async ({ detail: d }) => {
  if (d.type === 'select') { selectedId = d.projectId; push(); return; }
  if (d.type === 'review' && el === ours) {  // 우리 스튜디오의 컨펌 확인: 방 링크가 있으면 그 방을 연다
    const link = model().projects.flatMap(p => p.approvals || []).find(x => x.id === d.approvalId)?.link;
    if (link) window.open(link, '_blank', 'noopener'); else el.notify('이 컨펌은 열 방 주소가 없어요.');
    return;
  }
  if (d.type === 'refresh') {
    if (refreshing) return;
    if (Date.now() - refreshedAt < 60000) { el.notify('방금 갱신을 요청했어요. 잠시 뒤에 다시 열어 보세요.'); return; }
    refreshing = true; push();
    let ok = false; try { ok = await studio.requestRefresh?.(); } catch {}
    refreshing = false; refreshedAt = Date.now(); push();
    el.notify(ok ? '이음에게 갱신을 요청했어요. 끝나면 이 화면을 새로 열어 주세요.' : '여기서는 요청할 수 없어요. claude.ai 사무실에서 눌러 주세요.');
  } else if (d.type === 'archive') write(d.projectId, { archived: true }, '프로젝트를 보관했어요.', el);
  else if (d.type === 'restore') write(d.projectId, { archived: false }, '프로젝트를 다시 열었어요.', el);
  else if (d.type === 'create') write('u-' + Date.now().toString(36), { custom: true, ...d.values, icon: '✳', color: 'mint', archived: false }, `${d.values.name} 프로젝트를 만들었어요.`, el);
  // review: 방 링크가 있으면 버튼이 곧바로 방을 연다
});

// 화면 전환(업무 현황 · 우리 스튜디오 · 사무실)
const views = { team: document.getElementById('view-team'), ours: document.getElementById('view-ours'), office: document.getElementById('view-office') };
function show(tab) {
  if (!views[tab]) tab = 'team';
  for (const [k, el] of Object.entries(views)) el.hidden = k !== tab;
  document.querySelectorAll('.page-nav button').forEach(b => { if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  document.body.classList.toggle('wide-tab', tab === 'office');
  store.set('vs-tab', tab);
  if (tab === 'office') requestAnimationFrame(() => studio.fit?.());
}
document.querySelectorAll('.page-nav button').forEach(b => b.onclick = () => show(b.dataset.tab));
show(store.get('vs-tab') === 'ours' ? 'ours' : 'team');  // 사무실(3D) 탭은 규연 요청(10/28)으로 뺌. 화면 코드는 숨긴 채 남겨 둠(일 맡기기 요청이 여기를 거침)
