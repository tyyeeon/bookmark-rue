/* 하루 — 공용 일정표(구글 시트) 연결. UI를 바꿔도 이 파일은 그대로 둔다.
   이 버전은 claude.ai 밖(GitHub Pages)에서 돈다. 시트 읽기·쓰기는 규연 계정의 Apps Script 웹앱이 대신한다.
   연결 정보(api 주소, k 열쇠)는 저장소에 없고, 홈 화면 주소의 # 뒤에만 있다. */
/* ---- 공용 일정표(구글 시트) 연결 ---- */
const SERVER='Google Sheets',SHEET_ID='1FtYFj5a-bfr8ZyaxNE2X6H-e4J4nfRzIFyifzfe5TGM',TAB='Untitled',RANGE=`${TAB}!A1:Z1000`;
const HIDDEN=['삭제','취소'];
let mcp=null,header=[],raw=[],events=[],loaded=false,busy=false;
const pad=n=>String(n).padStart(2,'0');
const nowIso=()=>{const d=new Date(Date.now()+9*3600000);return d.toISOString().slice(0,19)+'+09:00'};
const toMin=t=>{const m=/^(\d{1,2}):(\d{2})/.exec(t||'');return m?(+m[1])*60+(+m[2]):null};
const fromMin=m=>`${pad(Math.floor(m/60)%24)}:${pad(m%60)}`;
function asObj(p){if(typeof p==='string'){try{return JSON.parse(p)}catch{return null}}return p}
function valuesOf(res){const p=asObj(res&&(res.payload??res));if(p&&Array.isArray(p.values))return p.values;const t=res&&Array.isArray(res.content)&&res.content.find(c=>c.type==='text');const q=t&&asObj(t.text);return q&&Array.isArray(q.values)?q.values:[]}
function toEvent(r){return {id:r.id,date:r['날짜'],title:r['제목'],time:r['종일']==='Y'?'':(r['시작']||''),end:r['종일']==='Y'?'':(r['끝']||''),group:r['그룹'],type:(r['유형']==='할일'||r['유형']==='할 일')?'task':'event',place:r['장소'],note:r['메모'],done:r['상태']==='완료',status:r['상태']||'',_r:r}}
function ingest(values){header=(values[0]||[]).map(h=>String(h).trim());raw=[];values.slice(1).forEach((v,i)=>{const o={_row:i+2};header.forEach((h,j)=>o[h]=String(v[j]??'').trim());if(o.id&&/^\d{4}-\d{2}-\d{2}$/.test(o['날짜']||''))raw.push(o)});events=raw.filter(r=>!HIDDEN.includes(r['상태'])).map(toEvent);loaded=true}
const colLetter=n=>{let s='';n++;while(n>0){const m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=Math.floor((n-1)/26)}return s};
/* Apps Script 연결: 주소 # 뒤 api=...&k=... (홈 화면 앱은 사파리와 저장공간이 따로라 매번 주소에서 읽는다) */
function haruConfig(){let h=new URLSearchParams(location.hash.slice(1));let c={api:h.get('api'),k:h.get('k')};
  if(c.api&&c.k){try{localStorage.setItem('haru-conn',JSON.stringify(c))}catch{}return c}
  try{c=JSON.parse(localStorage.getItem('haru-conn')||'null')}catch{c=null}return c&&c.api&&c.k?c:null}
function appsScript(c){const call=async(url,opt)=>{let r;try{r=await fetch(url,opt)}catch{throw{code:'server_unavailable'}}
    let j;try{j=await r.json()}catch{throw{code:'upstream_error'}}if(j.error)throw{code:j.error==='denied'?'denied':'tool_error'};return j};
  return{callTool:async(_s,tool,args)=>{
    if(tool==='get_values')return call(`${c.api}?k=${encodeURIComponent(c.k)}&t=${Date.now()}`);
    if(tool==='update_values')return call(c.api,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({k:c.k,range:String(args.range).split('!').pop(),values:args.values})});
    throw{code:'tool_error'}}}}
const ERR={denied:'연결 열쇠가 맞지 않아요. 이음이 보내준 주소로 다시 열어 주세요.',needs_reauth:'구글 시트 연결이 만료됐어요. claude.ai 설정 › 커넥터에서 Google Sheets를 다시 연결해 주세요.',server_not_connected:'Google Sheets 커넥터가 연결돼 있지 않아요. claude.ai 설정 › 커넥터에서 연결해 주세요.',selection_required:'Google Sheets 커넥터가 여러 개예요. 뜬 선택창에서 하나를 골라 주세요.',not_in_manifest:'이 화면에 Google Sheets 사용이 허용되지 않았어요.',approval_required:'일정표를 읽으려면 Google Sheets 사용을 허용해 주세요.',blocked_by_policy:'정책 때문에 Google Sheets를 쓸 수 없어요.',tool_error:'일정표를 읽거나 쓰지 못했어요. 시트가 옮겨졌거나 권한이 바뀌었는지 확인해 주세요.',server_unavailable:'구글 시트가 응답하지 않아요. 저장됐는지 확실하지 않으니 다시 불러와 확인해 주세요.',upstream_error:'구글 시트 쪽 오류예요. 저장됐는지 확실하지 않으니 다시 불러와 확인해 주세요.'};
function setStatus(t,retry){const s=$('sync');s.style.display=t?'flex':'none';s.innerHTML=t?`<span>${esc(t)}</span>${retry?'<button class="tiny" id="reload">다시 불러오기</button>':''}`:''}
async function fresh(){const r=await mcp.callTool(SERVER,'get_values',{spreadsheetId:SHEET_ID,range:RANGE},{cache:{refresh:true}});ingest(valuesOf(r))}
async function ensureCols(){const need=['유형','수정시각'].filter(h=>!header.includes(h));if(!need.length)return header;const s=header.length;await mcp.callTool(SERVER,'update_values',{spreadsheetId:SHEET_ID,range:`${TAB}!${colLetter(s)}1:${colLetter(s+need.length-1)}1`,values:[need]});header=[...header,...need];return header}
const rowArray=o=>header.map(h=>h?String(o[h]??''):'');
function failed(err,what){setStatus(ERR[err&&err.code]||`${what}하지 못했어요. 다시 불러와 확인해 주세요.`,true);return false}
async function writeRow(orig,patch){
  if(busy)return false;busy=true;
  try{await fresh();const cur=raw.find(r=>r.id===orig.id);
    if(!cur){setStatus('이 항목을 일정표에서 찾을 수 없어요. 누가 지웠을 수 있어요.',true);render();return false}
    if(['수정시각','상태','제목','날짜','시작'].some(k=>(cur[k]||'')!==(orig[k]||''))){setStatus('방금 루에나 클로드가 이 항목을 바꿨어요. 최신 내용으로 다시 불러왔으니 확인하고 다시 저장해 주세요.');render();return false}
    await ensureCols();const out={...cur,...patch,id:cur.id,'수정시각':nowIso()};if(!out['작성'])out['작성']='규연(앱)';
    await mcp.callTool(SERVER,'update_values',{spreadsheetId:SHEET_ID,range:`${TAB}!A${cur._row}:${colLetter(header.length-1)}${cur._row}`,values:[rowArray(out)]});
    await fresh();setStatus('');return true}
  catch(err){return failed(err,'저장')}finally{busy=false}}
async function addRow(patch){
  if(busy)return false;busy=true;
  try{await fresh();await ensureCols();let id;do{id='a'+Date.now().toString(36)+Math.random().toString(36).slice(2,5)}while(raw.some(r=>r.id===id));
    const out={...patch,id,'작성':'규연(앱)','상태':'예정','수정시각':nowIso()};const last=Math.max(1,...raw.map(r=>r._row));
    await mcp.callTool(SERVER,'update_values',{spreadsheetId:SHEET_ID,range:`${TAB}!A${last+1}:${colLetter(header.length-1)}${last+1}`,values:[rowArray(out)]});
    await fresh();if(!raw.some(r=>r.id===id)){setStatus('저장 요청은 보냈는데 일정표에서 확인이 안 돼요. 다시 불러와 주세요.',true);return false}setStatus('');return true}
  catch(err){return failed(err,'추가')}finally{busy=false}}

