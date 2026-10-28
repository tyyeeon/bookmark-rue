const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const e = escapeHTML;
const asset = name => new URL(`./assets/${name}`, import.meta.url).href;
const style = new URL('./dashboard.css', import.meta.url).href;
const statusClass = s => ({'진행 중':'working','컨펌 필요':'review','완료':'done','대기':'waiting','미확인':'unknown'}[s] || 'unknown');
const badge = s => `<span class="status ${statusClass(s)}"><i></i>${e(s)}</span>`;
const avatar = name => `<span class="avatar ${name==='이음'?'lilac':name==='규연'?'peach':'mint'}">${e(name?.slice(0,1)||'?')}</span>`;

export class LuminodeDashboard extends HTMLElement {
  #model={projects:[],selectedId:null,demo:false};
  #floor='3'; #tab='tasks'; #filter='all'; #archive=false; #search=''; #focus=null;
  constructor(){super();this.attachShadow({mode:'open'});}
  connectedCallback(){this.render();}
  set model(value){this.#model={...value,projects:value.projects||[]};this.render();}
  get model(){return structuredClone(this.#model);}
  action(type,extra={}){this.dispatchEvent(new CustomEvent('studio-action',{detail:{type,projectId:this.#model.selectedId,...extra},bubbles:true,composed:true}));}
  notify(message){const t=this.shadowRoot.querySelector('#toast');t.textContent=message;t.hidden=false;clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>t.hidden=true,4500);}
  render(){
    const {projects,selectedId,demo}=this.#model;
    const p=projects.find(x=>x.id===selectedId&&!x.archived);
    const approvals=p?.approvals||[], mine=(p?.tasks||[]).filter(t=>t.owner==='규연'&&t.status!=='완료'&&t.status!=='컨펌 필요');
    const pending=approvals.length+mine.length;
    const connection=this.#model.connection||{state:'unconnected'};
    const freshness=demo?'샘플 화면 · 실제 업무 연결 전':connection.state==='loading'?'기록을 불러오는 중':connection.state==='error'?'새로고침 실패 · 다시 시도해 주세요':connection.state==='ready'?`마지막 기록 · ${connection.updatedAt||'시각 미제공'}`:'실제 업무 미연결';
    const room=new URL('./concepts/interior-office-v1.webp',import.meta.url).href;
    this.shadowRoot.innerHTML=`<link rel="stylesheet" href="${style}">
      <main class="interior-app" aria-label="우리 셋의 스튜디오">
        <div class="interior-plane">
          <img class="interior-image" src="${room}" alt="사무실 안에서 본 규연, 이음, 루에의 책상과 프로젝트 게시판, 컨펌 편지함">
          <button class="desk-hotspot gyuyeon-desk" data-sheet="mine" aria-label="규연의 할 일 ${mine.length}건"><span>규연</span>${mine.length?`<b>${mine.length}</b>`:''}</button>
          <button class="desk-hotspot eum-desk" data-person="이음" aria-label="이음이 맡은 업무 보기"><span>이음</span><small>↗</small></button>
          <button class="desk-hotspot rue-desk" data-person="루에" aria-label="루에가 맡은 업무 보기"><span>루에</span><small>↗</small></button>
          <button class="object-hotspot project-board" data-sheet="progress" aria-label="프로젝트 게시판: ${e(p?.name||'프로젝트 미선택')} 진행상태"><span class="object-tag">프로젝트<br><b>${e(p?.status||'미확인')}</b></span></button>
          <button class="object-hotspot mail-tray" data-sheet="inbox" aria-label="컨펌 편지함: 컨펌 ${approvals.length}건, 내 할 일 ${mine.length}건"><span class="mail-badge">${approvals.length}</span><span class="mail-caption">컨펌함 ↗</span></button>
        </div>
        <div class="interior-top"><button class="interior-project" data-picker><span class="tiny-star">✳</span><span>${e(p?.name||'프로젝트 선택')}</span><small>⌄</small></button><button class="interior-refresh" data-refresh ${connection.state==='loading'?'disabled':''} aria-label="업무 기록 새로고침">↻</button></div>
        <div class="interior-sync" role="status">${e(freshness)}</div>
        <div class="interior-hint"><span>✧</span> 이름표 · 게시판 · 편지함을 눌러봐요</div>
      </main><dialog id="modal" aria-labelledby="modal-title"></dialog><div id="toast" role="status" hidden></div>`;
    this.bind();
  }
  personState(name){const tasks=this.tasksForPerson(name);return tasks.find(t=>t.status==='진행 중')?.status||tasks.find(t=>t.status!=='완료')?.status||(tasks.length?'완료':'미확인');}
  personSummary(name){const p=this.#model.projects.find(p=>p.id===this.#model.selectedId);const t=(p?.tasks||[]).filter(t=>t.owner===name&&t.status!=='완료');return t[0]?.title||'확인된 작업 없음';}
  centerScene(){const scroll=this.shadowRoot.querySelector('.scene-scroll');if(scroll)scroll.scrollLeft=(scroll.scrollWidth-scroll.clientWidth)/2;}
  tasksForPerson(name){const p=this.#model.projects.find(p=>p.id===this.#model.selectedId);return (p?.tasks||[]).filter(t=>t.owner===name);}
  taskCards(tasks){return tasks.length?`<div class="work-cards">${tasks.map(t=>`<article class="work-card"><div class="card-meta">${badge(t.status)}<span>${e(t.owner||'담당 미정')}</span></div><h3>${e(t.title)}</h3><div class="next-line"><span>다음</span><p>${e(t.next||'확인된 다음 작업 없음')}</p></div></article>`).join('')}</div>`:`<div class="empty"><span>✧</span><h3>확인된 작업이 없어요</h3><p>업무 기록을 연결하면 여기에 보여요.</p></div>`;}
  showSheet(kind,name){
    const p=this.#model.projects.find(p=>p.id===this.#model.selectedId&&!p.archived),tasks=p?.tasks||[],approvals=p?.approvals||[];
    let title='',eyebrow='',body='';
    if(kind==='person'){title=`${name}의 작업`;eyebrow='TEAM WORK';body=`<div class="person-heading"><img src="${asset(name==='루에'?'rue-work.webp':'eum-work.webp')}" alt=""><div><b>${e(name)}</b><span>${e(p?.name||'선택한 프로젝트 없음')}</span></div></div>${this.taskCards(this.tasksForPerson(name))}`;}
    if(kind==='progress'){title='지금 어디까지 왔나요?';eyebrow='PROJECT STATUS';body=p?`<div class="project-focus"><span class="project-icon large ${e(p.color)}">${e(p.icon)}</span><div><small>현재 프로젝트</small><h3>${e(p.name)}</h3></div>${badge(p.status)}</div><div class="fact-grid"><div><small>담당</small><b>${e(p.owner||'미지정')}</b></div><div><small>최근 기록</small><b>${e(p.updated||'확인된 기록 없음')}</b></div></div><div class="next-focus"><small>다음 한 걸음</small><p>${e(p.next||'정해진 작업이 없어요.')}</p></div><h3 class="section-title">작업별 현황 <span>${tasks.length}</span></h3>${this.taskCards(tasks)}<button class="archive-button" data-archive="${e(p.id)}">완료 후 보관하기 ↗</button>`:this.emptyView();}
    if(kind==='mine'){title='규연의 할 일';eyebrow='YOUR NEXT STEP';body=`<p class="sheet-description">직접 맡은 작업을 모았어요. 컨펌 요청은 아래에서 따로 확인해요.</p>${this.taskCards(tasks.filter(t=>t.owner==='규연'&&t.status!=='완료'&&t.status!=='컨펌 필요'))}<button class="button full" data-sheet="inbox">컨펌 요청 보기 · ${approvals.length}</button>`;}
    if(kind==='inbox'){title='규연, 이것만 확인해 줘';eyebrow='YOUR ATTENTION';const mine=tasks.filter(t=>t.owner==='규연'&&t.status!=='완료'&&t.status!=='컨펌 필요');body=`<div class="inbox-summary"><span>컨펌 필요 <b>${approvals.length}</b></span><span>내 할 일 <b>${mine.length}</b></span></div><h3 class="section-title">컨펌이 필요한 것</h3>${approvals.length?approvals.map(a=>`<button class="decision-card" data-approval="${e(a.id)}"><span class="decision-eyebrow">${e(a.owner||'담당 미정')}의 확인 요청</span><b>${e(a.title)}</b><p>${e(a.description||a.next)}</p><span class="decision-next">내용 보고 검토하기 →</span></button>`).join(''):'<div class="empty compact"><p>미결 컨펌 기록이 없어요.</p></div>'}<h3 class="section-title">내가 해야 할 것</h3>${this.taskCards(mine)}`;}
    if(kind==='projects'){title='프로젝트 서랍';eyebrow='PROJECT DRAWER';body=`<div class="drawer-actions"><button class="button primary" data-new>＋ 새 프로젝트</button><button class="button" data-sheet="archive">보관함 열기</button></div><div class="picker-list">${this.#model.projects.filter(p=>!p.archived).map(p=>`<button data-pick="${e(p.id)}"><span class="project-icon ${e(p.color)}">${e(p.icon)}</span><span><b>${e(p.name)}</b><small>${e(p.next||'다음 작업 미정')}</small></span>${p.id===this.#model.selectedId?'<span class="current">선택됨 ✓</span>':badge(p.status)}</button>`).join('')||'<p class="sheet-description">진행 중인 프로젝트가 없어요.</p>'}</div>`;}
    if(kind==='archive'){title='보관한 프로젝트';eyebrow='FINISHED CHAPTERS';body=`<label class="search-box">⌕ <input id="archive-search" type="search" placeholder="프로젝트 검색" value="${e(this.#search)}" aria-label="보관된 프로젝트 검색"></label><div id="archive-results">${this.archiveCards(this.#model.projects.filter(p=>p.archived))}</div>`;}
    const dialog=this.openModal(`<span class="eyebrow">${eyebrow}</span><h2 id="modal-title">${e(title)}</h2>${this.#model.demo?'<div class="sample-note">화면 검토용 샘플 · 실제 업무 아님</div>':''}${body}`);dialog.classList.add('sheet');
    this.bindSheet(dialog);
  }
  bindSheet(root){
    root.querySelectorAll('[data-sheet]').forEach(b=>b.onclick=()=>this.showSheet(b.dataset.sheet));
    root.querySelectorAll('[data-new]').forEach(b=>b.onclick=()=>this.newProject());
    root.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{root.close();this.action('select',{projectId:b.dataset.pick});});
    root.querySelectorAll('[data-archive]').forEach(b=>b.onclick=()=>this.lifecycleDialog('archive',b.dataset.archive));
    root.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>this.lifecycleDialog('restore',b.dataset.restore));
    root.querySelectorAll('[data-approval]').forEach(b=>b.onclick=()=>this.reviewDialog(b.dataset.approval));
    root.querySelector('#archive-search')?.addEventListener('input',ev=>{this.#search=ev.target.value;root.querySelector('#archive-results').innerHTML=this.archiveCards(this.#model.projects.filter(p=>p.archived));this.bindRestores();});
  }
  officeScene(){
    // Scene coordinates and foreground polygons copied from the read-only source, not redesigned.
    const chairs=this.#floor==='3'?[[566,279,'eum'],[1136,551,'rue']]:[[609,299,'codex'],[831,410,'claude'],[833,658,'rue']];
    const sprites={eum:[174,205,.52],rue:[154,223,.42],claude:[164,218,.36],codex:[164,220,.41]};
    const fg=this.#floor==='3'?['405,272 465,250 658,314 662,367 635,395 584,418 407,335','473,241 529,266 529,297 473,273','719,412 767,397 890,446 892,496 851,523 720,468','779,393 821,413 821,443 779,425','956,543 1024,523 1253,590 1254,664 1198,694 1152,708 958,613','1037,509 1096,541 1096,574 1037,542']:['428,278 495,242 618,306 624,342 620,381 582,415 439,353 428,345','661,408 722,357 853,424 863,452 858,501 817,536 677,471 660,464','653,653 716,601 849,670 856,747 814,785 668,719 653,710'];
    return `<svg viewBox="0 0 1626 975" role="img" aria-label="기존 ${this.#floor}층 3D 사무실과 원본 캐릭터"><image href="${asset(`floor-${this.#floor}f.webp`)}" width="1626" height="975"/>${chairs.map(([x,y,k])=>{const [px,py,s]=sprites[k];return `<image href="${asset(k+'-work.webp')}" x="${x-px*s}" y="${y-py*s}" width="${300*s}" height="${300*s}"/>`;}).join('')}<defs><clipPath id="desk-foreground">${fg.map(points=>`<polygon points="${points}"/>`).join('')}</clipPath></defs><image href="${asset(`floor-${this.#floor}f.webp`)}" width="1626" height="975" clip-path="url(#desk-foreground)"/></svg>`;
  }
  taskView(tasks){
    const filtered=tasks.filter(t=>this.#filter==='all'||t.status===this.#filter);
    return `<div class="filters" aria-label="작업 상태 필터">${['all','진행 중','컨펌 필요','대기','완료'].map(s=>`<button data-filter="${s}" aria-pressed="${s===this.#filter}">${s==='all'?'전체':s}</button>`).join('')}</div>${filtered.length?`<div class="task-table" role="table" aria-label="프로젝트 작업 현황"><div class="table-head" role="row"><span role="columnheader">작업</span><span role="columnheader">상태</span><span role="columnheader">담당</span><span role="columnheader">다음 작업</span></div>${filtered.map(t=>`<div class="task-row" role="row"><strong role="cell"><span class="task-mark">◇</span>${e(t.title)}</strong><div role="cell">${badge(t.status)}</div><div class="owner-cell" role="cell">${avatar(t.owner)}${e(t.owner||'미지정')}</div><span class="task-next" role="cell">${e(t.next||'미정')}</span></div>`).join('')}</div>`:`<div class="empty compact"><span>✧</span><h3>표시할 작업이 없어요</h3><p>${tasks.length?'다른 상태를 선택해 보세요.':'확인된 작업이 연결되면 여기에 보여요.'}</p></div>`}`;
  }
  approvalView(approvals){return approvals.length?`<div class="approval-list">${approvals.map(a=>`<button class="approval-card" data-approval="${e(a.id)}"><span class="approval-symbol">◷</span><span><b>${e(a.title)}</b><small>${e(a.owner||'담당 미정')} · ${e(a.next)}</small></span><span class="review-word">검토하기 →</span></button>`).join('')}</div>`:'<div class="empty compact"><span>✓</span><h3>기다리는 컨펌이 없어요</h3><p>확인이 필요한 일이 생기면 이곳에서 모아 볼 수 있어요.</p></div>';}
  emptyView(){return `<div class="empty full panel"><span>✳</span><div class="eyebrow">A NEW CHAPTER</div><h1>다음 프로젝트를 시작해 볼까요?</h1><p>새로 만들거나, 보관함에서 이어서 진행할 수 있어요.</p><div class="button-row"><button class="button primary" data-new>＋ 새 프로젝트</button><button class="button" data-view="archive">보관함 열기</button></div></div>`;}
  archiveView(projects){return `<div class="page-heading"><div><div class="eyebrow">PROJECT ARCHIVE</div><h1>잘 마친 일들을, 차곡차곡<span class="flower">✧</span></h1><p>보관한 프로젝트는 언제든 다시 이어갈 수 있어요.</p></div><button class="button" data-view="active">관제로 돌아가기 →</button></div><section class="panel archive-panel"><div class="archive-top"><h2>보관된 프로젝트 <span class="muted">${projects.length}</span></h2><label class="search-box">⌕ <input id="archive-search" type="search" placeholder="프로젝트 검색" value="${e(this.#search)}" aria-label="보관된 프로젝트 검색"></label></div><div id="archive-results">${this.archiveCards(projects)}</div></section>`;}
  archiveCards(projects){const filtered=projects.filter(p=>p.name.toLowerCase().includes(this.#search.toLowerCase()));return filtered.length?`<div class="archive-grid">${filtered.map(p=>`<article class="archived-card"><div class="card-title"><span class="project-icon large ${e(p.color)}">${e(p.icon)}</span>${badge('완료')}</div><h3>${e(p.name)}</h3><p>${e(p.summary)}</p><div class="archive-owner">${avatar(p.owner)}${e(p.owner||'담당 미정')}</div><button class="button restore" data-restore="${e(p.id)}">다시 진행하기 <span>↗</span></button></article>`).join('')}</div>`:`<div class="empty"><span>▤</span><h3>${projects.length?'검색 결과가 없어요':'아직 보관된 프로젝트가 없어요'}</h3><p>${projects.length?'다른 이름으로 찾아보세요.':'완료한 프로젝트를 보관하면 이곳에 남아요.'}</p></div>`;}
  bind(){
    const root=this.shadowRoot;
    root.querySelector('[data-picker]').onclick=()=>this.showSheet('projects');
    root.querySelector('[data-refresh]').onclick=()=>this.action('refresh');
    root.querySelectorAll('[data-sheet]').forEach(b=>b.onclick=()=>this.showSheet(b.dataset.sheet));
    root.querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>this.showSheet('person',b.dataset.person));
  }
  restoreFocus(selector){this.shadowRoot.querySelector(selector)?.focus({preventScroll:true});}
  bindRestores(){this.shadowRoot.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>this.lifecycleDialog('restore',b.dataset.restore));}
  openModal(content){
    const dialog=this.shadowRoot.querySelector('#modal');this.#focus=this.shadowRoot.activeElement;
    if(dialog.open)dialog.close();dialog.classList.remove('sheet');
    dialog.innerHTML=`<button class="modal-close icon-button" aria-label="닫기">×</button>${content}`;
    const close=()=>{dialog.close();this.#focus?.focus();};
    dialog.querySelector('.modal-close').onclick=close;
    dialog.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=close);
    dialog.addEventListener('cancel',()=>queueMicrotask(()=>this.#focus?.focus()),{once:true});
    dialog.showModal();return dialog;
  }
  picker(){
    const d=this.openModal(`<span class="eyebrow">SWITCH PROJECT</span><h2 id="modal-title">어떤 프로젝트로 갈까요?</h2><p class="modal-description">프로젝트를 교체해도 기존 작업은 그대로 남아요.</p><div class="picker-list">${this.#model.projects.filter(p=>!p.archived).map(p=>`<button data-pick="${e(p.id)}"><span class="project-icon ${e(p.color)}">${e(p.icon)}</span><span><b>${e(p.name)}</b><small>${e(p.next||'다음 작업 미정')}</small></span>${p.id===this.#model.selectedId?'<span class="current">선택됨 ✓</span>':badge(p.status)}</button>`).join('')}</div>`);
    d.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{d.close();this.#tab='tasks';this.#filter='all';this.action('select',{projectId:b.dataset.pick});this.restoreFocus('[data-picker]');});
  }
  newProject(){
    const d=this.openModal(`<span class="eyebrow">A FRESH START</span><h2 id="modal-title">새 프로젝트</h2><p class="modal-description">이름부터 시작해요. 나머지는 천천히 채워도 괜찮아요.</p><form><label>프로젝트 이름 <span class="required">필수</span><input name="name" required maxlength="50" placeholder="어떤 일을 함께 만들어 볼까요?" autocomplete="off"></label><label>담당<input name="owner" maxlength="40" placeholder="아직 정하지 않았다면 비워 두세요"></label><label>다음 작업<textarea name="next" maxlength="200" placeholder="가장 먼저 할 일 한 가지"></textarea></label><p class="form-error" role="alert" hidden></p><div class="button-row"><button type="button" class="button" data-cancel>취소</button><button class="button primary" type="submit">프로젝트 만들기</button></div></form>`);
    d.querySelector('form').onsubmit=ev=>{ev.preventDefault();const f=new FormData(ev.target),name=f.get('name').trim();const error=d.querySelector('.form-error');if(!name){error.textContent='공백 대신 프로젝트 이름을 입력해 주세요.';error.hidden=false;return;}if(this.#model.projects.some(p=>p.name.toLowerCase()===name.toLowerCase())){error.textContent='같은 이름이 있어요. 구분할 수 있는 이름을 써 주세요.';error.hidden=false;return;}d.close();this.#archive=false;this.#filter='all';this.#tab='tasks';this.action('create',{values:{name,owner:f.get('owner').trim()||null,next:f.get('next').trim()||null}});this.restoreFocus('[data-picker]');};
  }
  lifecycleDialog(type,id){
    const p=this.#model.projects.find(x=>x.id===id);if(!p)return;
    const archive=type==='archive';
    const d=this.openModal(`<span class="eyebrow">${archive?'PROJECT ARCHIVE':'WELCOME BACK'}</span><h2 id="modal-title">${archive?'완료하고 보관할까요?':'프로젝트를 다시 진행할까요?'}</h2><div class="confirm-project"><span class="project-icon large ${e(p.color)}">${e(p.icon)}</span><b>${e(p.name)}</b></div><p class="modal-description">${archive?'이 프로젝트를 완료 상태로 보관함에 옮겨요. 작업과 컨펌 기록은 남으며 언제든 복원할 수 있어요.':'보관함에서 꺼내 현재 프로젝트로 선택해요. 프로젝트는 대기 상태로 시작하고 기존 작업 기록은 유지해요.'}</p>${archive&&(p.approvals||[]).length?`<p class="pending-notice">컨펌 ${p.approvals.length}건이 남아 있어요. 보관해도 자동 승인되지 않아요.</p>`:''}<p class="muted small">${this.#model.demo?'미리보기에서는 샘플 화면에만 반영돼요.':''}</p><div class="button-row"><button class="button" data-cancel>취소</button><button class="button primary" id="confirm-action">${archive?'완료 후 보관':'복원하고 열기'}</button></div>`);
    d.querySelector('#confirm-action').onclick=()=>{d.close();this.#archive=archive;this.#tab='tasks';this.#filter='all';this.action(type,{projectId:id});this.notify(this.#model.demo?(archive?'샘플 프로젝트를 보관했어요.':'샘플 프로젝트를 복원했어요.'):'처리 요청을 전달했어요.');this.restoreFocus(archive?'[data-view="active"]':'[data-picker]');};
  }
  reviewDialog(id){
    const p=this.#model.projects.find(p=>p.id===this.#model.selectedId),a=p?.approvals?.find(a=>a.id===id);if(!a)return;
    const d=this.openModal(`<span class="eyebrow">NEEDS YOUR EYES</span><h2 id="modal-title">${e(a.title)}</h2><p class="modal-description">${e(a.description)}</p><div class="review-meta">담당 · ${e(a.owner)}<br>다음 작업 · ${e(a.next)}</div><div class="button-row"><button class="button" data-cancel>닫기</button><button class="button primary" id="review-action">검토 요청 확인</button></div>`);
    d.querySelector('#review-action').onclick=()=>{d.close();this.action('review',{approvalId:id});this.restoreFocus(`[data-approval="${id}"]`);};
  }
}
customElements.define('our-studio', LuminodeDashboard); // 이음 패치: 이름 충돌 방지
