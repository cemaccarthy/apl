/* ═══════════════════════ APL Studio — Dyalog Workbench ═══════════════════════
   Sections: utils · state · editor · highlighting · keyboard · execution engine
             files · tabs · session · modals · settings · init
   ═══════════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

/* ── utils ─────────────────────────────────────────────────────────────── */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const el = (tag, cls, html) => { const n=document.createElement(tag); if(cls)n.className=cls; if(html!=null)n.innerHTML=html; return n; };
const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'f'+Date.now().toString(36)+Math.random().toString(36).slice(2,8));
const debounce = (fn, ms) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };
const fmtSize = n => n<1024 ? n+' B' : n<1048576 ? (n/1024).toFixed(1)+' KB' : (n/1048576).toFixed(1)+' MB';
const fmtWhen = t => {
  const d=Date.now()-t;
  if(d<60e3) return 'now'; if(d<3600e3) return Math.floor(d/60e3)+'m ago';
  if(d<86400e3) return Math.floor(d/3600e3)+'h ago'; return new Date(t).toLocaleDateString();
};

function toast(msg, kind){
  const t = el('div','toast'+(kind?' '+kind:''), esc(msg));
  $('#toasts').appendChild(t);
  setTimeout(()=>{ t.classList.add('out'); setTimeout(()=>t.remove(),320); }, 2600);
}
function download(name, text, mime){
  const a = el('a'); a.href = URL.createObjectURL(new Blob([text],{type:mime||'text/plain;charset=utf-8'}));
  a.download = name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
}

/* ── state & persistence ───────────────────────────────────────────────── */
const LS_FILES='aplstudio.files.v1', LS_UI='aplstudio.ui.v1';
const loadJSON = (k,f)=>{ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):f; }catch(e){ return f; } };

const DB = { files: loadJSON(LS_FILES, {}) };
const UI = Object.assign({ open:[], active:null, kbdClosed:false }, loadJSON(LS_UI, {}));
UI.settings = Object.assign({
  theme:'dark', autosave:true, ctrlGlyphs:true, fontSize:16,
  endpoint:'https://tryapl.org/api/exec'
}, UI.settings||{});

const saveFiles = debounce(()=>{ try{ localStorage.setItem(LS_FILES, JSON.stringify(DB.files)); }catch(e){ toast('Storage full — export your workspace','err'); } }, 350);
const saveUI    = debounce(()=>{ try{ localStorage.setItem(LS_UI, JSON.stringify(UI)); }catch(e){} }, 350);

/* ── glyph keyboard layout (edit freely — one array per row) ───────────── */
const R1=[['⍺','alpha'],['⍵','omega'],['⍳','iota'],['⍸','iota-underbar'],['⍴','rho / shape'],['⍷','epsilon-underbar / find'],['⍋','grade up'],['⍒','grade down'],['⌽','reverse / rotate'],['⊖','rotate first'],['⍉','transpose'],['⌷','squad / index'],['⊂','enclose'],['⊃','pick']];
const R2=[['⊆','partitioned enclose'],['∊','enlist / member-of'],['∪','union'],['∩','intersection'],['~','not / without'],['∧','and'],['∨','or'],['⍱','nor'],['⍲','nand'],['≡','depth / match'],['≢','tally / not-match'],['↑','mix / take'],['↓','drop'],['⌈','ceiling / max'],['⌊','floor / min']];
const R3=[['/','reduce / compress'],['⌿','reduce first'],['\\','scan'],['⍀','scan first'],['¨','each'],['⍨','swap / commute'],['⍣','power'],['⍤','atop'],['⍥','over'],['⍢','stencil'],['⍡','beside'],['⍩','inner product'],['<','less'],['≤','leq'],['=','equals'],['≥','geq'],['>','greater'],['≠','unique / neq']];
const R4=[['⌶','I-beam'],['⌺','quad-divide'],['⍟','log / star-circle'],['⌹','matrix divide'],['⊥','decode'],['⊤','encode'],['|','residue'],['÷','divide'],['✗','times-circle'],['⍫','stiles'],['⌸','index-key'],['⍠','bi-jot'],['⊣','left'],['⊢','right']];
const U1=[['⎕','quad eval'],['⍞','quad quote'],['⍬','zilde'],['∇','del / recursion'],['←','assign'],['→','branch'],['⋄','statement sep'],['⍝','comment'],['○','pi times'],['*','exponential'],['!','factorial'],['+','plus'],['-','minus'],['×','times / sign'],[',','ravel / cat'],['.','outer product'],['⍕','format'],['⍎','execute'],['↑','','']];
U1 = U1.filter(k=>k[0]);

/* Ctrl+key glyph map for hardware keyboards */
const CTRL_GLYPHS = {
  a:'⍺',b:'⌽',c:'⊂',d:'⍤',e:'⍷',f:'⊆',g:'⌷',i:'⍳',j:'⊃',k:'⍋',l:'⎕',m:'⍒',n:'⌊',
  o:'○',p:'⍉',q:'⍬',r:'⍴',s:'⍸',t:'⍨',u:'↑',v:'↓',w:'⍵',x:'⊥',y:'⊤',z:'⌺',
  '`':'⋄','1':'⌺','2':'⌶','3':'⍟','4':'⌹','5':'⌈','6':'⌊','7':'⊥','8':'⊤','9':'|','0':'÷','-':'✗','=':'⍫',
  ';':'⎕',"'":'⍞','[':'←',']':'→'
};

const SNIPPETS = [
  ['Dfn',       'Name←{\n    ⍝ ⍺ ⍺⍺ ⍵\n    ⍵\n}\n'],
  ['Header',    '\n⍝ ─────────────────────────────────────────\n⍝  \n⍝ ─────────────────────────────────────────\n'],
  ['Print',     '⎕← '],
  ['Assert',    '∧/ '],
];

/* ── theme ─────────────────────────────────────────────────────────────── */
function applyTheme(){
  document.documentElement.dataset.theme = UI.settings.theme;
  $('#btnTheme use').setAttribute('href', UI.settings.theme==='dark' ? '#i-sun' : '#i-moon');
  const tc = document.querySelector('meta[name="theme-color"]');
  if(tc) tc.content = UI.settings.theme==='dark' ? '#0b1017' : '#eef1f7';
}

/* ── editor views ──────────────────────────────────────────────────────── */
const views = new Map();
let saveFlashT = null;

const OPS = '¨⍨⍣⍤⍥⍢⍡⍩∘&⍠/⌿\\⍀';
const CTL = '←→⋄;()[]{}';

function hlLine(src){
  let out='', i=0; const n=src.length;
  const push=(cls,s)=>{ out += cls ? '<span class="tok-'+cls+'">'+esc(s)+'</span>' : esc(s); };
  while(i<n){
    const c=src[i];
    if(c===' '||c==='\t'){ out+=c; i++; continue; }
    if(c==="'"){ let j=i+1,s="'";
      while(j<n){ if(src[j]==="'"){ s+="'"; if(src[j+1]==="'"){s+="'";j+=2;continue;} j++; break; } s+=src[j]; j++; }
      push('str',s); i=j; continue; }
    if(c==='⍝'){ push('com',src.slice(i)); break; }
    if(/[0-9¯]/.test(c)){ let j=i+1; while(j<n&&/[0-9¯.]/.test(src[j]))j++; if(j<n&&/[eE]/.test(src[j])){ j++; while(j<n&&/[0-9¯]/.test(src[j]))j++; } push('num',src.slice(i,j)); i=j; continue; }
    if(c==='⎕'||c==='⍞'){ let j=i+1; while(j<n&&/[A-Za-z0-9_.]/.test(src[j]))j++; push('sys',src.slice(i,j)); i=j; continue; }
    if(/[A-Za-z_∆]/.test(c)){ let j=i+1; while(j<n&&/[A-Za-z0-9_∆]/.test(src[j]))j++; push('',src.slice(i,j)); i=j; continue; }
    if(OPS.includes(c)){ push('op',c); i++; continue; }
    if(CTL.includes(c)){ push('ctl',c); i++; continue; }
    push('fn',c); i++;
  }
  return out;
}
const tokensHTML = t => t.split('\n').map(hlLine).join('\n');

function makeView(file){
  const root = el('div','view hidden'); root.dataset.id = file.id;
  const gut  = el('div','gutter'); const gpre = el('pre'); gut.appendChild(gpre);
  const wrap = el('div','codewrap'); const hl = el('pre');
  const ta   = el('textarea');
  ta.wrap='off'; ta.spellcheck=false; ta.autocapitalize='off'; ta.autocomplete='off'; ta.autocorrect='off';
  ta.setAttribute('autocorrect','off');
  ta.value = file.text;
  wrap.append(hl, ta); root.append(gut, wrap); $('#views').appendChild(root);

  const v = { id:file.id, root, gut, gpre, hl, ta };
  views.set(file.id, v);

  ta.addEventListener('input', ()=>{
    refresh(v);
    const f = DB.files[file.id]; if(!f) return;
    f.text = ta.value; f.modified = Date.now();
    markDirty(file.id, true);
    if(UI.settings.autosave){ saveFiles(); flashSaved(); }
  });
  ta.addEventListener('scroll', ()=>{
    hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft;
    gpre.style.transform = 'translateY(' + (-ta.scrollTop) + 'px)';
  });
  ta.addEventListener('keydown', e=>{
    if(e.key==='Tab' && !e.metaKey && !e.ctrlKey){ e.preventDefault(); insertText(ta,'  '); }
  });
  ['keyup','click','focus'].forEach(ev=>ta.addEventListener(ev, ()=>updatePos(v)));
  refresh(v);
  return v;
}

function refresh(v){
  v.hl.innerHTML = tokensHTML(v.ta.value) + '\n';
  const lines = v.ta.value.split('\n').length;
  const nums = []; for(let i=1;i<=lines;i++) nums.push(i);
  v.gpre.textContent = nums.join('\n') + '\n';
  v.gut.style.width = (String(lines).length + 3.5) + 'ch';
  v.gpre.style.fontSize = 'var(--code-size)';
}

function updatePos(v){
  if(!v) return;
  const p = v.ta.selectionStart, upto = v.ta.value.slice(0,p);
  const ln = upto.split('\n');
  $('#sbPos').textContent = 'Ln ' + ln.length + ', Col ' + (ln[ln.length-1].length+1);
}
function flashSaved(){
  const s=$('#sbSave'); s.textContent='Saved ✓'; s.classList.add('show');
  clearTimeout(saveFlashT); saveFlashT=setTimeout(()=>s.classList.remove('show'),1500);
}
function markDirty(id, dirty){
  const tab = $('#tabs').querySelector('[data-id="'+id+'"]');
  if(tab) tab.classList.toggle('dirty', !!dirty);
}
function insertText(ta, text){
  ta.focus();
  let ok=false;
  try{ ok = document.execCommand('insertText', false, text); }catch(e){}
  if(!ok){
    const s=ta.selectionStart, e=ta.selectionEnd;
    ta.value = ta.value.slice(0,s) + text + ta.value.slice(e);
    ta.selectionStart = ta.selectionEnd = s + text.length;
    ta.dispatchEvent(new Event('input'));
  }
}
const currentView = () => UI.active && views.get(UI.active);

/* ── files ─────────────────────────────────────────────────────────────── */
function createFile(name, text, open){
  const id = uid();
  DB.files[id] = { id, name, text:text||'', modified:Date.now() };
  saveFiles(); renderFiles();
  if(open) openFile(id);
  return id;
}
function openFile(id){
  const f = DB.files[id]; if(!f) return;
  if(!UI.open.includes(id)){ UI.open.push(id); makeView(f); }
  UI.active = id; saveUI();
  views.forEach((v,k)=>v.root.classList.toggle('hidden', k!==id));
  renderTabs(); renderFiles();
  $('#emptyState').classList.add('hidden');
  const v = views.get(id); if(v){ v.ta.focus({preventScroll:true}); updatePos(v); }
  $('#sbFile').textContent = f.name;
}
function closeTab(id){
  const i = UI.open.indexOf(id); if(i<0) return;
  UI.open.splice(i,1);
  const v = views.get(id); if(v){ v.root.remove(); views.delete(id); }
  if(UI.active===id) UI.active = UI.open[Math.max(0,i-1)] || null;
  saveUI(); renderTabs();
  if(UI.active) openFile(UI.active); else showEmpty();
}
function showEmpty(){
  $('#emptyState').classList.remove('hidden');
  $('#sbFile').textContent='—'; $('#sbPos').textContent='Ln 1, Col 1';
}
function renderFiles(){
  const q = ($('#fileSearch').value||'').toLowerCase();
  const list = $('#fileList'); list.innerHTML='';
  Object.values(DB.files).sort((a,b)=>b.modified-a.modified)
    .filter(f=>!q||f.name.toLowerCase().includes(q))
    .forEach(f=>{
      const li = el('li','fitem'+(f.id===UI.active?' active':''));
      li.dataset.id=f.id;
      li.innerHTML = '<svg class="fic"><use href="#i-file"/></svg>'
        + '<span class="fn">'+esc(f.name)+'</span>'
        + '<span class="fm">'+fmtSize(f.text.length)+' · '+fmtWhen(f.modified)+'</span>'
        + '<button class="fmore" aria-label="File actions"><svg><use href="#i-dots"/></svg></button>';
      list.appendChild(li);
    });
}
function renderTabs(){
  const bar=$('#tabs'); bar.innerHTML='';
  UI.open.forEach(id=>{
    const f=DB.files[id]; if(!f) return;
    const t=el('div','tab'+(id===UI.active?' active':''));
    t.dataset.id=id; t.title=f.name;
    t.innerHTML='<span class="dot"></span><span>'+esc(f.name)+'</span><button class="tx" aria-label="Close"><svg><use href="#i-x"/></svg></button>';
    bar.appendChild(t);
  });
}

/* popover menus */
function showPopover(anchor, items){
  const p=$('#popover'); p.innerHTML=''; p.classList.remove('hidden');
  items.forEach(it=>{
    const b=el('button','pitem'+(it.danger?' danger':''),
      (it.glyph?'<span class="pg">'+esc(it.glyph)+'</span>':'<svg><use href="#'+it.icon+'"/></svg>')+'<span>'+esc(it.label)+'</span>');
    b.onclick=()=>{ hidePopover(); it.fn(); };
    p.appendChild(b);
  });
  const r=anchor.getBoundingClientRect();
  requestAnimationFrame(()=>{
    const pw=p.offsetWidth, ph=p.offsetHeight;
    let x=Math.min(r.left, innerWidth-pw-10), y=r.bottom+6;
    if(y+ph>innerHeight-10) y=r.top-ph-6;
    p.style.left=Math.max(10,x)+'px'; p.style.top=y+'px';
  });
}
function hidePopover(){ $('#popover').classList.add('hidden'); }

function fileMenu(btn, id){
  showPopover(btn,[
    {icon:'i-pen',  label:'Rename',      fn:()=>renameFile(id)},
    {icon:'i-copy', label:'Duplicate',   fn:()=>{ const f=DB.files[id]; const nid=createFile(f.name.replace(/(\.\w+)?$/,' copy$1'), f.text, true); toast('Duplicated'); }},
    {icon:'i-down', label:'Download',    fn:()=>download(DB.files[id].name, DB.files[id].text)},
    {icon:'i-trash',label:'Delete', danger:true, fn:()=>deleteFile(id)},
  ]);
}
async function renameFile(id){
  const name = await modal({ title:'Rename file', input:DB.files[id].name, ok:'Rename' });
  if(name==null) return;
  DB.files[id].name = name.trim()||DB.files[id].name; DB.files[id].modified=Date.now();
  saveFiles(); renderFiles(); renderTabs();
  if(UI.active===id) $('#sbFile').textContent=DB.files[id].name;
}
function deleteFile(id){
  modal({ title:'Delete file?', body:'<p>“'+esc(DB.files[id].name)+'” will be removed from this device.</p>', ok:'Delete', danger:true })
  .then(ok=>{ if(!ok) return;
    delete DB.files[id]; saveFiles(); closeTab(id); renderFiles(); toast('Deleted','err');
  });
}

/* import / export */
function importFiles(fileList){
  Array.from(fileList).forEach(f=>{
    const rd=new FileReader();
    rd.onload=()=>{
      let name=f.name, text=String(rd.result);
      if(/\.json$/i.test(name)){
        try{ const j=JSON.parse(text);
          if(j && j.files){ Object.values(j.files).forEach(x=>createFile(x.name||'imported.dyalog', x.text||'', false)); toast('Workspace imported','ok'); renderFiles(); return; }
        }catch(e){}
      }
      createFile(name, text, true); toast('Imported '+name,'ok');
    };
    rd.readAsText(f);
  });
}

/* ── execution engine (TryAPL) ─────────────────────────────────────────── */
let busy=false, pendingContinue=false;
const hist=[]; let histIdx=-1;

function setEngine(state){
  const c=$('#statusChip'); c.classList.remove('ok','err');
  if(state===true){ c.classList.add('ok'); $('#statusTxt').textContent='TryAPL · online'; }
  else if(state===false){ c.classList.add('err'); $('#statusTxt').textContent='TryAPL · unreachable'; }
}
async function postExec(code){
  const ctl=new AbortController(); const to=setTimeout(()=>ctl.abort(), 25000);
  try{
    const res = await fetch(UI.settings.endpoint,{
      method:'POST', credentials:'omit', signal:ctl.signal,
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ code, 'continue': pendingContinue?1:0 })
    });
    if(!res.ok) throw new Error('HTTP '+res.status);
    const txt = await res.text();
    let j; try{ j=JSON.parse(txt); }catch(e){ return { lines: txt.split('\n'), err:'', cont:false }; }
    let lines = j.Result ?? j.result ?? [];
    if(typeof lines==='string') lines=[lines];
    const err  = j.ErrorMessage || j.errorMessage || '';
    let cont   = !!(j.Continue ?? j.continue);
    if((j.ReturnCode ?? j.returnCode)===1001) cont=true;
    return { lines, err, cont };
  } finally { clearTimeout(to); }
}
function appendBlock(type, text, label){
  const tr=$('#transcript');
  const nearBottom = tr.scrollHeight - tr.scrollTop - tr.clientHeight < 80;
  const b=el('div','blk '+type);
  if(label) b.appendChild(el('span','lbl',esc(label)));
  b.appendChild(document.createTextNode(text));
  tr.appendChild(b);
  if(nearBottom) tr.scrollTop = tr.scrollHeight;
  return b;
}
function appendBusy(){
  const b=el('div','blk busy','<i></i><i></i><i></i>');
  $('#transcript').appendChild(b);
  $('#transcript').scrollTop = $('#transcript').scrollHeight;
  return b;
}
async function execCode(code, label){
  if(busy){ toast('Still executing…'); return; }
  if(!code.trim()){ toast('Nothing to run'); return; }
  busy=true;
  appendBlock('in', code, label);
  const bk=appendBusy();
  try{
    const r=await postExec(code);
    bk.remove();
    if(r.lines && r.lines.length) appendBlock('out', r.lines.join('\n'));
    if(r.err) appendBlock('err', r.err);
    if(!r.lines.length && !r.err && !r.cont) appendBlock('sys','(no output)');
    pendingContinue = r.cont;
    $('#sessForm').classList.toggle('cont', pendingContinue);
    $('#sessInput').placeholder = pendingContinue ? '…continue multi-line input' : 'APL expression…';
    setEngine(true);
  }catch(e){
    bk.remove();
    setEngine(false);
    appendBlock('err','Could not reach the execution engine.\n'+(e.name==='AbortError'?'Timed out.':e.message||e)+'\nCheck Settings → Endpoint, or your connection.');
  }
  busy=false;
}
function runSelection(){
  const v=currentView(); if(!v) return;
  const ta=v.ta;
  let code = ta.value.slice(ta.selectionStart, ta.selectionEnd);
  let label=null;
  if(!code.trim()){
    const upto=ta.value.slice(0,ta.selectionStart).split('\n');
    const ln=upto.length;
    code=ta.value.split('\n')[ln-1]||'';
    label='line '+ln;
  }
  execCode(code, label);
}
function runFile(){
  const v=currentView(); if(!v) return;
  const f=DB.files[v.id];
  execCode(v.ta.value, f.name);
}

/* ── session panel ─────────────────────────────────────────────────────── */
function sessionWelcome(){
  appendBlock('sys',
    'APL Studio · session\n' +
    'Code executes on Dyalog\u2019s free TryAPL engine — network required.\n' +
    'Each Run is one request, so send setup lines together with the code that uses them.\n\n' +
    '⌘↵ run selection/line   ⌘S save   ⌘K keyboard\n' +
    'Ctrl+letter inserts glyphs, e.g. Ctrl+I → ⍳');
}

/* ── modal ─────────────────────────────────────────────────────────────── */
function modal(opts){
  return new Promise(res=>{
    const root=$('#modalRoot'); root.innerHTML='';
    const back=el('div','mback'); const box=el('div','mbox');
    box.appendChild(el('h3',null,esc(opts.title)));
    if(opts.body) box.appendChild(el('div','mbody',opts.body));
    let inp=null;
    if(opts.input!=null){ inp=el('input'); inp.value=opts.input; inp.spellcheck=false; box.appendChild(inp); }
    const btns=el('div','mbtns');
    const cancel=el('button','btn','Cancel');
    const ok=el('button','btn'+(opts.danger?'':' primary'), esc(opts.ok||'OK'));
    btns.append(cancel,ok); box.appendChild(btns);
    root.append(back,box);
    const done=v=>{ root.innerHTML=''; res(v); };
    cancel.onclick=()=>done(opts.input!=null?null:false);
    back.onclick=cancel.onclick;
    ok.onclick=()=>done(opts.input!=null?inp.value:true);
    (inp||ok).focus();
    if(inp) inp.onkeydown=e=>{ if(e.key==='Enter')ok.click(); if(e.key==='Escape')cancel.click(); };
    box.onkeydown=e=>{ if(e.key==='Escape')cancel.click(); };
  });
}
function helpModal(){
  modal({ title:'Help & shortcuts', ok:'Close', body:
    '<h4>Hardware keyboard</h4><table>' +
    '<tr><td>⌘↵ / Ctrl+↵</td><td>run selection or current line</td></tr>' +
    '<tr><td>⌘⇧↵</td><td>run entire file</td></tr>' +
    '<tr><td>⌘S</td><td>save file</td></tr>' +
    '<tr><td>⌘O</td><td>files drawer</td></tr>' +
    '<tr><td>⌘K</td><td>toggle glyph keyboard</td></tr>' +
    '<tr><td>Ctrl + letter</td><td>insert glyph — i ⍳ · r ⍴ · w ⍵ · a ⍺ · l ⎕ · u ↑ …</td></tr>' +
    '<tr><td>Ctrl + digit</td><td>1 ⌺ · 4 ⌹ · 5 ⌈ · 6 ⌊ · 7 ⊥ · 8 ⊤ · 0 ÷</td></tr>' +
    '</table>' +
    '<h4>Execution</h4><p>Statements are sent to <b>tryapl.org/api/exec</b> (a real Dyalog interpreter). Each Run is a fresh request — keep dependent lines in one selection. If your host blocks the request (CORS), point Settings → Endpoint at your own proxy; see README for a 10-line Cloudflare Worker example.</p>' +
    '<h4>Files</h4><p>Everything is stored in this browser (localStorage). Export your workspace JSON regularly if the work matters.</p>' +
    '<h4>About</h4><p>Unofficial tool — not affiliated with Dyalog Ltd. Set ⎕IO on first line of a Run if you rely on index origin.</p>'
  });
}

/* ── glyph keyboard dock ───────────────────────────────────────────────── */
function buildKeyboard(){
  const host=$('#kbdRows');
  const addRow=(keys,cls)=>{
    const row=el('div','krow '+(cls||''));
    keys.forEach(([g,name])=>{
      const b=el('button','key',esc(g));
      b.type='button'; b.title=name||g; b.dataset.g=g;
      row.appendChild(b);
    });
    host.appendChild(row);
  };
  addRow(R1); addRow(R2); addRow(R3); addRow(R4);
  addRow(U1,'util');
  $('#kbd').classList.toggle('gap-after-r4', true);

  host.addEventListener('pointerdown', e=>{
    const k=e.target.closest('.key'); if(!k) return;
    e.preventDefault();
    k.classList.add('flash'); setTimeout(()=>k.classList.remove('flash'),180);
    const target = (document.activeElement===$('#sessInput')) ? $('#sessInput') : (currentView()||{}).ta;
    if(target){ const s=target.selectionStart; insertText(target,k.dataset.g); target.selectionStart=target.selectionEnd=s+k.dataset.g.length; }
    else toast('Tap the editor or session field first');
  });
}
function setKbd(open){
  UI.kbdClosed=!open; saveUI();
  $('#kbd').classList.toggle('closed',!open);
  $('#btnKbd').setAttribute('aria-pressed', open?'true':'false');
}

/* ── settings ──────────────────────────────────────────────────────────── */
function bindSettings(){
  $('#optAutosave').checked=UI.settings.autosave;
  $('#optCtrl').checked=UI.settings.ctrlGlyphs;
  $('#optEndpoint').value=UI.settings.endpoint;
  $('#optFontVal').textContent=UI.settings.fontSize;
  $('#optAutosave').onchange=e=>{ UI.settings.autosave=e.target.checked; saveUI(); toast('Autosave '+(e.target.checked?'on':'off')); };
  $('#optCtrl').onchange=e=>{ UI.settings.ctrlGlyphs=e.target.checked; saveUI(); };
  $('#optEndpoint').onchange=e=>{ UI.settings.endpoint=e.target.value.trim()||UI.settings.endpoint; saveUI(); toast('Endpoint updated','ok'); };
  const setFont=d=>{
    UI.settings.fontSize=Math.max(12,Math.min(24,UI.settings.fontSize+d));
    document.documentElement.style.setProperty('--code-size',UI.settings.fontSize+'px');
    $('#optFontVal').textContent=UI.settings.fontSize; saveUI();
    views.forEach(refresh);
  };
  $('#optFontMinus').onclick=()=>setFont(-1);
  $('#optFontPlus').onclick=()=>setFont(1);
  $('#btnTestEp').onclick=async()=>{
    $('#btnTestEp').textContent='Testing…';
    try{ const r=await postExec('1+1'); setEngine(true); toast('Engine replied: '+r.lines.join(' '),'ok'); }
    catch(e){ setEngine(false); toast('Connection failed — '+e.message,'err'); }
    $('#btnTestEp').textContent='Test connection';
  };
  $('#btnHelp').onclick=()=>{ $('#settingsPop').classList.add('hidden'); helpModal(); };
}
function toggleSettings(){
  const p=$('#settingsPop'); p.classList.toggle('hidden'); hidePopover();
}

/* ── seed content ──────────────────────────────────────────────────────── */
const WELCOME =
'⍝ ──────────────────────────────────────────────────────\n' +
'⍝  Welcome to APL Studio — a pocket Dyalog workbench\n' +
'⍝ ──────────────────────────────────────────────────────\n' +
'⍝\n' +
'⍝  ⌘↵         run the selection (or the current line)\n' +
'⍝  ⌘S         save            ⌘K   glyph keyboard\n' +
'⍝  Ctrl+key   insert glyphs   (Ctrl+I → ⍳,  Ctrl+W → ⍵)\n' +
'⍝\n' +
'⍝  Code runs on TryAPL. Each Run is one request.\n' +
'⍝\n' +
'Avg←{+/⍵÷≢⍵}\n' +
'⍝      Avg 12 19 28\n' +
'\n' +
'Cube←{⍵*3}\n' +
'⍝      Cube ¯1+2×⍳5\n' +
'\n' +
'⍝ Select the next line and press ⌘↵ :\n' +
'+/⍳100\n';

const EXAMPLES =
'⍝ ── APL classics ──────────────────────────────────────\n' +
'⍝ Select a line, press ⌘↵.\n' +
'\n' +
'Primes←{(~⍵∊⍵∘.×⍵)/⍵}        ⍝ sieve of composites\n' +
'⍝      Primes 1↓⍳50\n' +
'\n' +
'Next←{2+/0,⍵,0}              ⍝ next Pascal row\n' +
'⍝      Next⍣4⊢1\n' +
'\n' +
'⍝      5?52                  ⍝ deal 5 from 52\n' +
'⍝      ⍋\'APL STUDIO\'         ⍝ grade up\n' +
'⍝      3 3⍴⍳9                ⍝ reshape\n' +
'⍝      ?⍨100                 ⍝ deal 100 unique\n';

function seed(){
  if(Object.keys(DB.files).length) return false;
  const w=createFile('welcome.dyalog', WELCOME, false);
  createFile('examples.dyalog', EXAMPLES, false);
  UI.open=[w]; UI.active=w; saveUI();
  return true;
}

/* ── global events ─────────────────────────────────────────────────────── */
function bindGlobal(){
  $('#btnFiles').onclick = ()=>document.body.classList.add('files-open');
  $('#btnFilesClose').onclick = $('#filesBackdrop').onclick = ()=>document.body.classList.remove('files-open');
  $('#fileSearch').oninput = renderFiles;

  $('#btnNewFile').onclick = $('#btnEmptyNew').onclick = async ()=>{
    const name=await modal({title:'New file', input:'untitled.dyalog', ok:'Create'});
    if(name==null) return;
    createFile(name.trim()||'untitled.dyalog','',true);
    document.body.classList.remove('files-open');
  };
  $('#btnEmptyOpen').onclick = ()=>document.body.classList.add('files-open');
  $('#btnImport').onclick = ()=>$('#importInput').click();
  $('#importInput').onchange = e=>{ importFiles(e.target.files); e.target.value=''; };
  $('#btnExportAll').onclick = ()=>{
    download('apl-studio-workspace.json', JSON.stringify({exported:new Date().toISOString(), files:DB.files}, null, 2), 'application/json');
    toast('Workspace exported','ok');
  };

  $('#fileList').addEventListener('click', e=>{
    const more=e.target.closest('.fmore');
    const li=e.target.closest('.fitem'); if(!li) return;
    if(more){ fileMenu(more, li.dataset.id); return; }
    openFile(li.dataset.id);
    if(innerWidth<900) document.body.classList.remove('files-open');
  });

  $('#tabs').addEventListener('click', e=>{
    const x=e.target.closest('.tx'); const t=e.target.closest('.tab'); if(!t) return;
    if(x){ closeTab(t.dataset.id); return; }
    openFile(t.dataset.id);
  });
  $('#btnSnip').onclick = e=>{
    showPopover(e.currentTarget, SNIPPETS.map(([label,text])=>({glyph:'⍝',label,fn:()=>{
      const v=currentView(); if(v){ insertText(v.ta,text); }
    }})));
  };

  $('#btnRun').onclick = runSelection;
  $('#btnRunFile').onclick = runFile;
  $('#btnSession').onclick = ()=>{
    document.body.classList.toggle('nosession');
    $('#btnSession').setAttribute('aria-pressed', document.body.classList.contains('nosession')?'false':'true');
  };
  $('#btnKbd').onclick = ()=>setKbd(UI.kbdClosed);
  $('#kbdHandle').onclick = ()=>setKbd(UI.kbdClosed);
  $('#btnTheme').onclick = ()=>{ UI.settings.theme = UI.settings.theme==='dark'?'light':'dark'; applyTheme(); saveUI(); };
  $('#btnSettings').onclick = toggleSettings;

  $('#sessForm').onsubmit = e=>{
    e.preventDefault();
    const inp=$('#sessInput'); const t=inp.value; if(!t.trim()) return;
    inp.value=''; hist.push(t); histIdx=hist.length;
    execCode(t);
  };
  $('#sessInput').addEventListener('keydown', e=>{
    if(e.key==='ArrowUp'){ e.preventDefault(); if(histIdx>0)histIdx--; $('#sessInput').value=hist[histIdx]||''; }
    if(e.key==='ArrowDown'){ e.preventDefault(); if(histIdx<hist.length-1){histIdx++;$('#sessInput').value=hist[histIdx];} else {histIdx=hist.length;$('#sessInput').value='';} }
  });
  $('#btnSessClear').onclick = ()=>{ $('#transcript').innerHTML=''; sessionWelcome(); };
  $('#btnSessReset').onclick = ()=>{ pendingContinue=false; $('#sessForm').classList.remove('cont'); execCode(')RESET'); };
  $('#btnSessCopy').onclick = async ()=>{
    try{ await navigator.clipboard.writeText($('#transcript').innerText); toast('Transcript copied','ok'); }
    catch(e){ toast('Copy blocked by browser','err'); }
  };

  /* global shortcuts */
  window.addEventListener('keydown', e=>{
    const mod=e.metaKey||e.ctrlKey;
    if(mod && e.key==='Enter'){ e.preventDefault(); e.shiftKey?runFile():runSelection(); return; }
    if(e.metaKey && e.key.toLowerCase()==='s'){ e.preventDefault();
      const v=currentView(); if(v){ const f=DB.files[v.id]; f.text=v.ta.value; f.modified=Date.now(); saveFiles(); flashSaved(); markDirty(f.id,false); }
      return;
    }
    if(e.metaKey && e.key.toLowerCase()==='o'){ e.preventDefault(); document.body.classList.add('files-open'); return; }
    if(e.metaKey && e.key.toLowerCase()==='k'){ e.preventDefault(); setKbd(UI.kbdClosed); return; }
    /* Ctrl+glyph insertion */
    if(e.ctrlKey && !e.metaKey && !e.altKey && UI.settings.ctrlGlyphs){
      const g=CTRL_GLYPHS[e.key.toLowerCase()] ?? CTRL_GLYPHS[e.key];
      const v=currentView();
      if(g && v && document.activeElement===v.ta){
        e.preventDefault(); insertText(v.ta,g);
        const key=$$('#kbdRows .key').find(k=>k.dataset.g===g);
        if(key){ key.classList.add('flash'); setTimeout(()=>key.classList.remove('flash'),180); }
      }
    }
  });

  document.addEventListener('click', e=>{
    if(!e.target.closest('#popover') && !e.target.closest('.fmore') && !e.target.closest('#btnSnip')) hidePopover();
    if(!e.target.closest('#settingsPop') && !e.target.closest('#btnSettings')) $('#settingsPop').classList.add('hidden');
  });

  window.addEventListener('beforeunload', ()=>{ localStorage.setItem(LS_FILES, JSON.stringify(DB.files)); localStorage.setItem(LS_UI, JSON.stringify(UI)); });

  /* keep dock above the software keyboard */
  if(window.visualViewport){
    const vv=window.visualViewport;
    const fix=()=>{ const off=window.innerHeight-(vv.height+vv.offsetTop); $('#kbd').style.bottom=Math.max(0,off)+'px'; };
    vv.addEventListener('resize',fix); vv.addEventListener('scroll',fix);
  }
}

/* ── init ──────────────────────────────────────────────────────────────── */
function init(){
  applyTheme();
  document.documentElement.style.setProperty('--code-size', UI.settings.fontSize+'px');
  const fresh = seed();
  UI.open = UI.open.filter(id=>DB.files[id]);
  if(UI.active && !DB.files[UI.active]) UI.active = UI.open[0]||null;
  UI.open.forEach(id=>makeView(DB.files[id]));
  renderFiles(); renderTabs();
  if(UI.active) openFile(UI.active); else showEmpty();
  buildKeyboard(); setKbd(!UI.kbdClosed);
  bindSettings(); bindGlobal();
  sessionWelcome();
  if(fresh) setTimeout(()=>toast('Welcome — select a line and press ⌘↵','ok'), 700);
  if('serviceWorker' in navigator && location.protocol.startsWith('http')){
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
}
init();
})();
