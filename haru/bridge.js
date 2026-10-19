'use strict';
/* 이음: 안내 띠 없는 주소에서 google.script.run 대신 하루 연결 창구(Apps Script)로 보낸다. app.js는 루에 원본 그대로. */
(()=>{
  const p=new URLSearchParams(location.hash.slice(1));let c=null;
  if(p.get('api')&&p.get('k')){c={api:p.get('api'),k:p.get('k')};try{localStorage.setItem('haru-conn',JSON.stringify(c));}catch(_){}}
  else{try{c=JSON.parse(localStorage.getItem('haru-conn')||'null');}catch(_){}}
  if(!c||!/^https:\/\/script\.google\.com\//.test(c.api))return;
  const runner=(ok,fail)=>{
    const call=(fn,payload)=>{fetch(c.api,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({k:c.k,fn,payload}),redirect:'follow'})
      .then(r=>r.json()).then(j=>{if(!j||j.ok!==true)throw new Error((j&&j.error)||'연결하지 못했어요.');ok&&ok(j.result);})
      .catch(e=>fail&&fail(e instanceof Error?e:new Error(String(e))));};
    return {withSuccessHandler:f=>runner(f,fail),withFailureHandler:f=>runner(ok,f),
      getHaruState:()=>call('getHaruState'),saveHaruEvent:x=>call('saveHaruEvent',x),setHaruStatus:x=>call('setHaruStatus',x)};
  };
  window.google={script:{run:runner()}};
})();
