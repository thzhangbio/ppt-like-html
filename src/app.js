const SLIDE_W = 1280;
const SLIDE_H = 720;
const $ = (id) => document.getElementById(id);
const uid = () => 'el_' + Math.random().toString(36).slice(2, 9);

const colors = {
  ink: '#15202B', muted: '#57626B', teal: '#1B6B5E', tealDeep: '#123F38',
  tealSoft: '#DDEBE6', amber: '#B8842A', amberSoft: '#F1E3C4', steel: '#3D6E93',
  steelSoft: '#DEE7EE', line: '#B9BBA9', panel: '#FBFBF7', paper: '#F1F1EA'
};

const rolePreset = {
  title: { font: 'serif', size: 54, weight: 700, color: colors.ink, align: 'left' },
  body: { font: 'sans', size: 22, weight: 400, color: colors.muted, align: 'left' },
  caption: { font: 'mono', size: 15, weight: 400, color: colors.muted, align: 'left' },
  tag: { font: 'mono', size: 16, weight: 600, color: colors.tealDeep, align: 'left' },
  header: { font: 'mono', size: 14, weight: 600, color: colors.tealDeep, align: 'left' }
};

const state = {
  zoom: 0.78,
  current: 0,
  selected: new Set(),
  slides: []
};

const els = {
  logo: $('brandLogo'), canvas: $('slideCanvas'), slideList: $('slideList'), selectionBox: $('selectionBox'), marquee: $('marquee'), toast: $('toast')
};

function init() {
  els.logo.src = window.VIVOID_LOGO_DATA || '';
  state.slides.push(makeCoverSlide());
  renderAll();
  bindUI();
  showToast('已载入 VIVOID 同风格 HTML 编辑器原型');
}

function makeSlide(name = '新页面') {
  return { id: uid(), name, background: colors.panel, elements: [] };
}

function makeCoverSlide() {
  const s = makeSlide('封面');
  s.elements.push(
    textEl('VIVOID 三体生物', 110, 80, 260, 30, 'header'),
    textEl('标题填写区\n支持两行主标题', 90, 260, 520, 150, 'title'),
    textEl('用于工作汇报、产品说明、客户汇报、项目复盘。保持米白纸面、衬线标题、墨绿/琥珀强调色。', 92, 420, 660, 80, 'body'),
    imageEl(window.VIVOID_LOGO_DATA, 900, 275, 220, 160, 'contain'),
    shapeEl('roundrect', 830, 240, 360, 240, 'transparent', '#D5D6C9', 2, 18),
    textEl('CONFIDENTIAL', 1040, 640, 120, 20, 'caption')
  );
  return s;
}

function currentSlide() { return state.slides[state.current]; }
function getSelected() { return currentSlide().elements.filter(e => state.selected.has(e.id)); }
function findEl(id) { return currentSlide().elements.find(e => e.id === id); }

function textEl(text, x, y, w, h, role='body') {
  const p = rolePreset[role];
  return { id: uid(), type: 'text', x, y, w, h, z: nextZ(), text, role, font: p.font, fontSize: p.size, fontWeight: p.weight, color: p.color, align: p.align };
}
function imageEl(src, x, y, w, h, fit='contain') {
  return { id: uid(), type: 'image', x, y, w, h, z: nextZ(), src, style: fit === 'cover' ? 'cover' : 'contain', objectFit: fit, objectX: 50, objectY: 50, zoom: 1, radius: 4 };
}
function shapeEl(kind, x, y, w, h, fill=colors.tealSoft, stroke=colors.teal, strokeWidth=2, radius=0) {
  return { id: uid(), type: 'shape', x, y, w, h, z: nextZ(), kind, fill, stroke, strokeWidth, radius };
}
function nextZ() {
  const slide = state.slides[state.current] || { elements: [] };
  return slide.elements.reduce((m,e)=>Math.max(m,e.z||1),0)+1;
}

function renderAll() {
  renderSlideList();
  renderCanvas();
  updateInspector();
}

function renderSlideList() {
  els.slideList.innerHTML = '';
  state.slides.forEach((s, i) => {
    const item = document.createElement('div');
    item.className = 'slide-thumb' + (i === state.current ? ' active' : '');
    item.innerHTML = `<strong>${String(i+1).padStart(2,'0')} ${escapeHtml(s.name)}</strong><span>${s.elements.length} elements</span>`;
    item.onclick = () => { state.current = i; state.selected.clear(); renderAll(); };
    els.slideList.appendChild(item);
  });
}

function renderCanvas() {
  els.canvas.style.background = currentSlide().background;
  els.canvas.style.transform = `scale(${state.zoom})`;
  Array.from(els.canvas.querySelectorAll('.slide-el')).forEach(n => n.remove());
  currentSlide().elements.slice().sort((a,b)=>a.z-b.z).forEach(el => els.canvas.appendChild(renderElement(el)));
  updateSelectionBox();
  $('zoomLabel').textContent = Math.round(state.zoom * 100) + '%';
}

function renderElement(el) {
  const node = document.createElement('div');
  node.className = `slide-el ${el.type}-el` + (state.selected.has(el.id) ? ' selected' : '');
  node.dataset.id = el.id;
  Object.assign(node.style, { left: el.x+'px', top: el.y+'px', width: el.w+'px', height: el.h+'px', zIndex: el.z });

  if (el.type === 'text') {
    node.classList.add('text-el');
    node.dataset.font = el.font;
    node.textContent = el.text;
    node.style.fontSize = el.fontSize + 'px';
    node.style.fontWeight = el.fontWeight;
    node.style.color = el.color;
    node.style.textAlign = el.align;
    node.addEventListener('dblclick', (ev) => {
      ev.stopPropagation();
      selectOnly(el.id); node.contentEditable = 'true'; node.classList.add('editing'); node.focus();
      document.execCommand('selectAll', false, null);
    });
    node.addEventListener('input', () => { el.text = node.textContent; $('propText').value = el.text; });
    node.addEventListener('blur', () => { node.contentEditable = 'false'; node.classList.remove('editing'); });
  }
  if (el.type === 'image') {
    node.classList.add('image-style-' + el.style);
    node.style.borderRadius = el.style === 'circle' ? '999px' : (el.radius || 0) + 'px';
    const img = document.createElement('img');
    img.src = el.src;
    img.style.objectFit = el.objectFit;
    img.style.objectPosition = `${el.objectX}% ${el.objectY}%`;
    img.style.transform = `scale(${el.zoom})`;
    node.appendChild(img);
  }
  if (el.type === 'shape') {
    node.classList.add('shape-' + el.kind);
    node.style.background = el.kind === 'line' ? 'transparent' : el.fill;
    node.style.borderColor = el.stroke;
    node.style.borderWidth = (el.strokeWidth || 1) + 'px';
    node.style.borderRadius = el.kind === 'roundrect' ? (el.radius || 12) + 'px' : node.style.borderRadius;
  }
  node.addEventListener('pointerdown', startElementPointer);
  return node;
}

function startElementPointer(ev) {
  const id = ev.currentTarget.dataset.id;
  const el = findEl(id);
  if (ev.currentTarget.isContentEditable) return;
  ev.stopPropagation(); ev.preventDefault();
  if (ev.shiftKey || ev.metaKey || ev.ctrlKey) {
    state.selected.has(id) ? state.selected.delete(id) : state.selected.add(id);
  } else if (!state.selected.has(id)) {
    selectOnly(id);
  }
  renderCanvas(); updateInspector();
  const selected = getSelected();
  const start = pointFromEvent(ev);
  const starts = selected.map(e => ({ id: e.id, x: e.x, y: e.y }));
  const move = (e) => {
    const p = pointFromEvent(e); const dx = p.x - start.x; const dy = p.y - start.y;
    starts.forEach(st => { const it = findEl(st.id); if (it) { it.x = snap(st.x + dx); it.y = snap(st.y + dy); } });
    renderCanvas(); updateInspector(false);
  };
  const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
}

function bindUI() {
  els.canvas.addEventListener('pointerdown', startCanvasPointer);
  document.querySelectorAll('[data-add]').forEach(btn => btn.onclick = () => insertElement(btn.dataset.add));
  document.querySelectorAll('[data-layout]').forEach(btn => btn.onclick = () => applyLayout(btn.dataset.layout));
  document.querySelectorAll('[data-layer]').forEach(btn => btn.onclick = () => layerOp(btn.dataset.layer));
  $('newSlideBtn').onclick = () => { state.slides.push(makeSlide('新页面')); state.current = state.slides.length-1; state.selected.clear(); renderAll(); };
  $('duplicateSlideBtn').onclick = duplicateSlide;
  $('zoomOutBtn').onclick = () => { state.zoom = Math.max(.35, state.zoom - .08); renderCanvas(); };
  $('zoomInBtn').onclick = () => { state.zoom = Math.min(1.6, state.zoom + .08); renderCanvas(); };
  $('exportHtmlBtn').onclick = exportHtml;
  $('exportJsonBtn').onclick = exportJson;
  $('importJsonInput').onchange = importJson;
  $('imageInput').onchange = handleImageInsert;
  bindInspector();
}

function insertElement(kind) {
  if (kind === 'image') { $('imageInput').click(); return; }
  const s = currentSlide();
  if (kind === 'text-title') s.elements.push(textEl('双击编辑标题', 120, 160, 520, 80, 'title'));
  if (kind === 'text-body') s.elements.push(textEl('双击编辑正文内容', 130, 280, 420, 70, 'body'));
  if (kind === 'caption') s.elements.push(textEl('Fig.01 — 图注说明', 130, 600, 360, 24, 'caption'));
  if (kind === 'rect') s.elements.push(shapeEl('rect', 180, 180, 220, 120));
  if (kind === 'roundrect') s.elements.push(shapeEl('roundrect', 180, 180, 260, 150, colors.paper, colors.line, 1, 8));
  if (kind === 'circle') s.elements.push(shapeEl('circle', 180, 180, 150, 150));
  if (kind === 'hex') s.elements.push(shapeEl('hex', 180, 180, 160, 140));
  if (kind === 'line') s.elements.push(shapeEl('line', 160, 240, 320, 1, 'transparent', colors.teal, 3));
  state.selected.clear(); state.selected.add(s.elements[s.elements.length-1].id); renderAll();
}

function handleImageInsert(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { const el = imageEl(reader.result, 180, 160, 360, 240, 'cover'); currentSlide().elements.push(el); selectOnly(el.id); renderAll(); };
  reader.readAsDataURL(file); e.target.value = '';
}

function applyLayout(type) {
  const s = makeSlide(labelForLayout(type));
  if (type === 'cover') {
    s.elements.push(textEl('汇报标题填写区', 90, 240, 600, 90, 'title'), textEl('副标题 / 汇报周期 / 部门', 92, 350, 620, 52, 'body'), imageEl(window.VIVOID_LOGO_DATA, 880, 265, 180, 150, 'contain'));
  }
  if (type === 'chapter') {
    s.elements.push(textEl('§01', 100, 160, 120, 40, 'tag'), textEl('章节标题', 100, 220, 620, 90, 'title'), textEl('用于进入新的工作板块，保留大面积留白。', 104, 330, 620, 60, 'body'));
  }
  if (type === 'two-image') {
    s.elements.push(textEl('单页双图对照标题', 80, 90, 720, 60, 'title'), placeholderImage(90, 200, 500, 300, '图 A'), placeholderImage(690, 200, 500, 300, '图 B'), textEl('Fig. — 左右图对照说明', 90, 535, 500, 24, 'caption'));
  }
  if (type === 'four-grid') {
    s.elements.push(textEl('四图并列展示', 80, 75, 680, 60, 'title'));
    [[90,170],[370,170],[650,170],[930,170]].forEach((p,i)=>s.elements.push(placeholderImage(p[0],p[1],230,280,'图 '+(i+1))));
  }
  if (type === 'diagram') {
    s.elements.push(textEl('图解展示页', 80, 75, 600, 60, 'title'), shapeEl('circle', 520, 280, 150, 150, colors.amberSoft, colors.amber, 2), textEl('核心问题', 545, 335, 100, 35, 'tag'));
    [[240,210,'输入'],[840,210,'输出'],[240,430,'证据'],[840,430,'沉淀']].forEach(([x,y,t])=>{s.elements.push(shapeEl('roundrect',x,y,210,84,colors.paper,colors.line,1,8));s.elements.push(textEl(t,x+55,y+26,110,30,'tag'));});
  }
  if (type === 'flow') {
    s.elements.push(textEl('横向流程图', 80, 75, 600, 60, 'title'));
    ['信息收集','结构化沉淀','系统化管理','业务应用','复核优化'].forEach((t,i)=>{const x=95+i*220;s.elements.push(shapeEl('roundrect',x,300,160,80, i===2?colors.tealSoft:colors.paper, i===2?colors.teal:colors.line,1,8));s.elements.push(textEl(t,x+25,328,120,30,'tag')); if(i<4) s.elements.push(shapeEl('line',x+170,340,70,1,'transparent',colors.amber,3));});
  }
  if (type === 'fishbone') {
    s.elements.push(textEl('鱼骨图：问题原因分析', 80, 75, 720, 60, 'title'), shapeEl('line',210,380,760,1,'transparent',colors.teal,3), textEl('核心问题',980,360,160,40,'tag'));
    ['方法','材料','设备','人员','流程','环境'].forEach((t,i)=>{const x=260+i*115; const y=i%2?425:300; s.elements.push(shapeEl('line',x,380,90,1,'transparent',colors.line,2)); s.elements.push(textEl(t,x-10,y,90,28,'caption'));});
  }
  if (type === 'matrix') {
    s.elements.push(textEl('2×2 矩阵分析', 80, 75, 620, 60, 'title'), shapeEl('line',640,180,1,360,'transparent',colors.line,2), shapeEl('line',360,360,560,1,'transparent',colors.line,2));
    [[390,210,'高价值 / 易落地'],[680,210,'高价值 / 难落地'],[390,420,'低价值 / 易落地'],[680,420,'低价值 / 难落地']].forEach(([x,y,t])=>s.elements.push(textEl(t,x,y,210,32,'tag')));
  }
  state.slides.push(s); state.current = state.slides.length - 1; state.selected.clear(); renderAll(); showToast('已插入版式：' + s.name);
}
function labelForLayout(t){return ({cover:'封面',chapter:'章节页','two-image':'单页双图','four-grid':'四图并列',diagram:'图解展示',flow:'流程图',fishbone:'鱼骨图',matrix:'2×2 矩阵'})[t] || '版式';}
function placeholderImage(x,y,w,h,label){const e=shapeEl('roundrect',x,y,w,h,'#F6F6F1','#B9BBA9',1,10); e.placeholder=label; return e;}

function startCanvasPointer(ev) {
  if (ev.target !== els.canvas) return;
  state.selected.clear(); updateInspector(); renderCanvas();
  const start = pointFromEvent(ev); const mq = els.marquee;
  mq.classList.remove('hidden');
  const move = (e) => {
    const p = pointFromEvent(e);
    const x = Math.min(start.x,p.x), y = Math.min(start.y,p.y), w=Math.abs(p.x-start.x), h=Math.abs(p.y-start.y);
    Object.assign(mq.style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px'});
    state.selected.clear();
    currentSlide().elements.forEach(el=>{ if (intersects({x,y,w,h}, el)) state.selected.add(el.id); });
    renderCanvas(); mq.classList.remove('hidden'); Object.assign(mq.style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px'}); updateInspector(false);
  };
  const up = () => { mq.classList.add('hidden'); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
}
function intersects(a,b){return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;}

function updateSelectionBox(){
  const box = els.selectionBox; const selected = getSelected();
  if (selected.length <= 1) { box.classList.add('hidden'); return; }
  const b = bbox(selected); Object.assign(box.style,{left:b.x+'px',top:b.y+'px',width:b.w+'px',height:b.h+'px'}); box.classList.remove('hidden'); box.onpointerdown = startGroupPointer;
}
function bbox(items){const x=Math.min(...items.map(e=>e.x)), y=Math.min(...items.map(e=>e.y)); const r=Math.max(...items.map(e=>e.x+e.w)), b=Math.max(...items.map(e=>e.y+e.h)); return {x,y,w:r-x,h:b-y};}
function startGroupPointer(ev){ev.stopPropagation(); ev.preventDefault(); const handle=ev.target.dataset.handle; const items=getSelected(); const b=bbox(items); const start=pointFromEvent(ev); const starts=items.map(e=>({...e}));
  const move=e=>{const p=pointFromEvent(e), dx=p.x-start.x, dy=p.y-start.y; if(handle){let sx=1+(dx/b.w), sy=1+(dy/b.h); if(handle.includes('w')) sx=1-(dx/b.w); if(handle.includes('n')) sy=1-(dy/b.h); sx=Math.max(.1,sx); sy=Math.max(.1,sy); starts.forEach(st=>{const it=findEl(st.id); it.x=snap(b.x+(st.x-b.x)*sx); it.y=snap(b.y+(st.y-b.y)*sy); it.w=Math.max(10,snap(st.w*sx)); it.h=Math.max(10,snap(st.h*sy));});}else{starts.forEach(st=>{const it=findEl(st.id); it.x=snap(st.x+dx); it.y=snap(st.y+dy);});} renderCanvas(); updateInspector(false);};
  const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);}; window.addEventListener('pointermove',move); window.addEventListener('pointerup',up);
}

function bindInspector(){
  const ids=['propX','propY','propW','propH']; ids.forEach(id=>$(id).addEventListener('input',applyCommon));
  ['propText','propRole','propFont','propFontSize','propFontWeight','propColor','propAlign'].forEach(id=>$(id).addEventListener('input',applyText));
  ['propImageStyle','propObjectFit','propImageZoom','propImageRadius','propObjectX','propObjectY'].forEach(id=>$(id).addEventListener('input',applyImage));
  ['propShapeKind','propFill','propStroke','propStrokeWidth','propRadius'].forEach(id=>$(id).addEventListener('input',applyShape));
}
function updateInspector(fill=true){const selected=getSelected(); $('selectionInfo').textContent=selected.length?`已选中 ${selected.length} 个元素`:'未选中元素'; document.querySelectorAll('.text-inspector,.image-inspector,.shape-inspector').forEach(n=>n.classList.add('hidden')); if(!selected.length)return; const e=selected[0]; if(fill){$('propX').value=Math.round(e.x);$('propY').value=Math.round(e.y);$('propW').value=Math.round(e.w);$('propH').value=Math.round(e.h);} if(selected.length===1){ if(e.type==='text'){document.querySelector('.text-inspector').classList.remove('hidden'); if(fill){$('propText').value=e.text;$('propRole').value=e.role;$('propFont').value=e.font;$('propFontSize').value=e.fontSize;$('propFontWeight').value=e.fontWeight;$('propColor').value=e.color;$('propAlign').value=e.align;}} if(e.type==='image'){document.querySelector('.image-inspector').classList.remove('hidden'); if(fill){$('propImageStyle').value=e.style;$('propObjectFit').value=e.objectFit;$('propImageZoom').value=e.zoom;$('propImageRadius').value=e.radius;$('propObjectX').value=e.objectX;$('propObjectY').value=e.objectY;}} if(e.type==='shape'){document.querySelector('.shape-inspector').classList.remove('hidden'); if(fill){$('propShapeKind').value=e.kind;$('propFill').value=toHex(e.fill);$('propStroke').value=toHex(e.stroke);$('propStrokeWidth').value=e.strokeWidth;$('propRadius').value=e.radius;}}}}
function applyCommon(){getSelected().forEach(e=>{e.x=+$('propX').value||e.x;e.y=+$('propY').value||e.y;e.w=+$('propW').value||e.w;e.h=+$('propH').value||e.h;});renderCanvas();}
function applyText(){getSelected().filter(e=>e.type==='text').forEach(e=>{e.text=$('propText').value;e.role=$('propRole').value;e.font=$('propFont').value;e.fontSize=+$('propFontSize').value;e.fontWeight=$('propFontWeight').value;e.color=$('propColor').value;e.align=$('propAlign').value;});renderCanvas();}
function applyImage(){getSelected().filter(e=>e.type==='image').forEach(e=>{e.style=$('propImageStyle').value;e.objectFit=$('propObjectFit').value;e.zoom=+$('propImageZoom').value;e.radius=+$('propImageRadius').value;e.objectX=+$('propObjectX').value;e.objectY=+$('propObjectY').value;});renderCanvas();}
function applyShape(){getSelected().filter(e=>e.type==='shape').forEach(e=>{e.kind=$('propShapeKind').value;e.fill=$('propFill').value;e.stroke=$('propStroke').value;e.strokeWidth=+$('propStrokeWidth').value;e.radius=+$('propRadius').value;});renderCanvas();}
function selectOnly(id){state.selected.clear();state.selected.add(id);} function snap(v){return Math.round(v);} function pointFromEvent(ev){const r=els.canvas.getBoundingClientRect(); return {x:(ev.clientX-r.left)/state.zoom,y:(ev.clientY-r.top)/state.zoom};}
function toHex(v){if(!v||v==='transparent')return '#ffffff';return v;}
function escapeHtml(s){return String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}

function layerOp(op){const selected=getSelected(); if(!selected.length)return; const all=currentSlide().elements; if(op==='front'){const max=Math.max(...all.map(e=>e.z)); selected.forEach((e,i)=>e.z=max+1+i);} if(op==='back'){const min=Math.min(...all.map(e=>e.z)); selected.forEach((e,i)=>e.z=min-1-i);} if(op==='up')selected.forEach(e=>e.z+=1); if(op==='down')selected.forEach(e=>e.z-=1); normalizeZ(); renderCanvas();}
function normalizeZ(){currentSlide().elements.sort((a,b)=>a.z-b.z).forEach((e,i)=>e.z=i+1);}
function duplicateSlide(){const clone=JSON.parse(JSON.stringify(currentSlide())); clone.id=uid(); clone.name=currentSlide().name+' 副本'; clone.elements.forEach(e=>e.id=uid()); state.slides.splice(state.current+1,0,clone); state.current++; state.selected.clear(); renderAll();}

function exportJson(){download('ppt-like-html-project.json', JSON.stringify({version:1,slides:state.slides},null,2),'application/json');}
function importJson(e){const f=e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=()=>{try{const data=JSON.parse(r.result); state.slides=data.slides||[]; state.current=0; state.selected.clear(); renderAll(); showToast('JSON 已导入');}catch(err){showToast('JSON 解析失败');}}; r.readAsText(f);}
function exportHtml(){download('ppt-like-export.html', buildExportHtml(), 'text/html');}
function buildExportHtml(){const slideHtml=state.slides.map((s,i)=>`<section class="export-slide">${s.elements.sort((a,b)=>a.z-b.z).map(renderExportEl).join('')}</section>`).join('\n'); return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>ppt-like-html export</title><style>${exportCss()}</style></head><body>${slideHtml}</body></html>`;}
function renderExportEl(e){let style=`left:${e.x}px;top:${e.y}px;width:${e.w}px;height:${e.h}px;z-index:${e.z};`; if(e.type==='text')return `<div class="x text ${e.font}" style="${style}font-size:${e.fontSize}px;font-weight:${e.fontWeight};color:${e.color};text-align:${e.align};">${escapeHtml(e.text).replace(/\n/g,'<br>')}</div>`; if(e.type==='image')return `<div class="x image ${e.style}" style="${style}border-radius:${e.style==='circle'?'999px':e.radius+'px'}"><img src="${e.src}" style="object-fit:${e.objectFit};object-position:${e.objectX}% ${e.objectY}%;transform:scale(${e.zoom})"></div>`; return `<div class="x shape ${e.kind}" style="${style}background:${e.kind==='line'?'transparent':e.fill};border-color:${e.stroke};border-width:${e.strokeWidth}px;border-radius:${e.kind==='roundrect'?e.radius+'px':'0'}"></div>`;}
function exportCss(){return `:root{--panel:#FBFBF7;--line:#B9BBA9;--ink:#15202B;--font-display:Georgia,serif;--font-body:Arial,sans-serif;--font-mono:monospace}body{margin:0;background:#dcdcd1}.export-slide{width:1280px;height:720px;position:relative;background:var(--panel);margin:30px auto;border:1px solid var(--line);overflow:hidden;box-shadow:0 24px 60px rgba(16,27,41,.16)}.export-slide:before{content:"";position:absolute;left:56px;right:56px;top:46px;height:1px;background:var(--line)}.x{position:absolute;box-sizing:border-box;overflow:hidden}.text.serif{font-family:var(--font-display)}.text.sans{font-family:var(--font-body)}.text.mono{font-family:var(--font-mono)}.image img{width:100%;height:100%;display:block;transform-origin:center}.image.frame{border:1px solid var(--line);padding:8px;background:#fff}.image.circle{border-radius:999px}.shape{border-style:solid}.shape.circle{border-radius:999px}.shape.hex{clip-path:polygon(25% 5%,75% 5%,100% 50%,75% 95%,25% 95%,0 50%)}.shape.line{height:0!important;background:transparent!important;border:0!important;border-top-style:solid!important}`;}
function download(name, content, type){const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([content],{type})); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function showToast(msg){els.toast.textContent=msg; els.toast.classList.remove('hidden'); clearTimeout(showToast.t); showToast.t=setTimeout(()=>els.toast.classList.add('hidden'),1800);}

init();
