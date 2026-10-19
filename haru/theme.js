'use strict';
/* 이음: 설정 > 테마에서 1번 숲빛 유리(/haru/) ↔ 2번 연두 잎사귀(/haru2/) 전환. 고른 테마를 기억해 다음에 그 화면으로 연다. */
(()=>{
  const me=document.currentScript.dataset.theme, names={'1':'숲빛 유리','2':'연두 잎사귀'}, paths={'1':'haru/','2':'haru2/'};
  const base=location.href.replace(/haru2?\/(index\.html)?(#.*)?$/,'');
  const go=t=>location.replace(base+paths[t]+location.hash);
  let saved=null;try{saved=localStorage.getItem('haru-theme');}catch(_){}
  if(saved&&saved!==me&&names[saved]){go(saved);return;}
  document.addEventListener('DOMContentLoaded',()=>{
    const row=[...document.querySelectorAll('#settings .settings-row')].find(r=>/테마/.test(r.textContent));if(!row)return;
    const value=row.lastElementChild;value.textContent=names[me]+' · 바꾸기';
    row.style.cursor='pointer';row.setAttribute('role','button');row.tabIndex=0;row.setAttribute('aria-label','테마 바꾸기, 지금 '+names[me]);
    const flip=()=>{const t=me==='1'?'2':'1';try{localStorage.setItem('haru-theme',t);}catch(_){}go(t);};
    row.addEventListener('click',flip);row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();flip();}});
  });
})();
