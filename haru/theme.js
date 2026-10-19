'use strict';
/* 이음: 설정 > 테마에서 1번 숲빛 유리(/haru/) ↔ 2번 연두 잎사귀(/haru2/) 전환, 위 그룹 버튼 줄 숨기기. 둘 다 이 기기에 기억한다. */
(()=>{
  const me=document.currentScript.dataset.theme, names={'1':'숲빛 유리','2':'연두 잎사귀'}, paths={'1':'haru/','2':'haru2/'};
  const base=location.origin+location.pathname.replace(/haru2?\/(index\.html)?$/,'');
  const go=t=>location.replace(base+paths[t]+location.search+location.hash);
  const get=k=>{try{return localStorage.getItem(k);}catch(_){return null;}}, set=(k,v)=>{try{localStorage.setItem(k,v);}catch(_){}};
  const saved=get('haru-theme');
  if(saved&&saved!==me&&names[saved]){go(saved);return;}
  const st=document.createElement('style');st.textContent='.hide-filters #filters{display:none!important}html{background:#72845a}html.haru-sa{height:auto!important;min-height:min(100lvh,calc(100% + env(safe-area-inset-top)))!important}body{position:fixed!important;inset:0!important;height:auto!important;padding-top:max(10px,env(safe-area-inset-top))!important}#haru-v4{height:100%!important}';document.head.appendChild(st);
  if(navigator.standalone||matchMedia('(display-mode: standalone)').matches)document.documentElement.classList.add('haru-sa');
  document.addEventListener('DOMContentLoaded',()=>{
    const app=document.getElementById('haru-v4')||document.body;
    const rows=[...document.querySelectorAll('#settings .settings-row')];
    const themeRow=rows.find(r=>/테마/.test(r.textContent));if(!themeRow)return;
    const tap=(row,fn)=>{row.style.cursor='pointer';row.setAttribute('role','button');row.tabIndex=0;row.addEventListener('click',fn);row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn();}});};
    themeRow.lastElementChild.textContent=names[me]+' · 바꾸기';
    tap(themeRow,()=>{const t=me==='1'?'2':'1';set('haru-theme',t);go(t);});
    const groupRow=themeRow.cloneNode(true);
    const icon=groupRow.querySelector('.setting-symbol');if(icon)icon.innerHTML='<svg viewBox="0 0 24 24"><rect x="3" y="7" width="7" height="5" rx="2.5"/><rect x="14" y="7" width="7" height="5" rx="2.5"/><path d="M3 17h18"/></svg>';
    const label=groupRow.querySelector('.setting-label');if(label){[...label.childNodes].filter(n=>n.nodeType===3).forEach(n=>n.remove());label.append('위 그룹 버튼');}
    themeRow.after(groupRow);
    const apply=()=>{const hide=get('haru-hide-filters')==='1';app.classList.toggle('hide-filters',hide);groupRow.lastElementChild.textContent=hide?'숨김 · 보이기':'보임 · 숨기기';};
    tap(groupRow,()=>{const hide=get('haru-hide-filters')!=='1';set('haru-hide-filters',hide?'1':'0');if(hide){const all=document.querySelector('#filters [data-group="전체"]');if(all&&!all.classList.contains('active'))all.click();}apply();});
    apply();
    const linkRow=themeRow.cloneNode(true);
    const li=linkRow.querySelector('.setting-symbol');if(li)li.innerHTML='<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>';
    const ll=linkRow.querySelector('.setting-label');if(ll){[...ll.childNodes].filter(n=>n.nodeType===3).forEach(n=>n.remove());ll.append('홈 화면용 링크');}
    groupRow.after(linkRow);linkRow.lastElementChild.textContent='복사하기';
    const copy=t=>navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(t):Promise.reject();
    const fallback=t=>{const ta=document.createElement('textarea');ta.value=t;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();ta.setSelectionRange(0,t.length);const ok=document.execCommand('copy');ta.remove();return ok;};
    tap(linkRow,()=>{let c=null;try{c=JSON.parse(get('haru-conn')||'null');}catch(_){}
      if(!c||!c.api||!c.k){linkRow.lastElementChild.textContent='연결 정보 없음';return;}
      const url=base+paths['1']+'#api='+c.api+'&k='+encodeURIComponent(c.k);
      const done=()=>{linkRow.lastElementChild.textContent='복사했어요';setTimeout(()=>{linkRow.lastElementChild.textContent='복사하기';},3000);};
      copy(url).then(done,()=>{fallback(url)?done():linkRow.lastElementChild.textContent='복사 실패';});});
  });
})();
