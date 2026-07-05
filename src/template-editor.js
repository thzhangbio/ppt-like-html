const TEMPLATE_URL = 'VIVOID_同风格正式汇报模板套件.html';
const $ = (id) => document.getElementById(id);
const state = { selected: new Set(), history: [], future: [], templateHead: '', fileHandle: null };

const rolePreset = {
  title: { fontFamily: 'var(--font-display)', fontSize: '38px', fontWeight: '700', color: 'var(--ink)', lineHeight: '1.22' },
  body: { fontFamily: 'var(--font-body)', fontSize: '16.5px', fontWeight: '400', color: 'var(--muted)', lineHeight: '1.7' },
  caption: { fontFamily: 'var(--font-mono)', fontSize: '11.5px', fontWeight: '400', color: 'var(--muted)', lineHeight: '1.5' },
  tag: { fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: '600', color: 'var(--teal-deep)', lineHeight: '1.4' },
  header: { fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: '600', color: 'var(--teal-deep)', lineHeight: '1.4' }
};

const editableSelector = [
  '.headline','.lede','.eyebrow','.tag','.panel','h1','h2','h3','h4','p','li','td','th','.figcap','.footer-note span','.smallnote','.quote','.kpi','.kpi .n','.kpi .l','.placeholder','img','svg'
].join(',');

initTemplateEditor();

async function initTemplateEditor(){
  try{
    const embeddedDeck = $('templateMount')?.querySelector('main.deck');
    if (embeddedDeck) {
      state.templateHead = readEmbeddedTemplateHead();
      document.body.classList.add('editor-ready');
      prepareDeck(); bindChrome(); pushHistory(true);
      toast('已打开可编辑 HTML，可继续编辑并保存');
      return;
    }

    const html = await fetch(TEMPLATE_URL, { cache: 'no-store' }).then(r => {
      if(!r.ok) throw new Error('template fetch failed: ' + r.status);
      return r.text();
    });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    state.templateHead = Array.from(doc.head.children).filter(n => n.tagName !== 'TITLE').map(n => n.outerHTML).join('\n');
    document.head.insertAdjacentHTML('beforeend', state.templateHead);
    const deckNode = doc.querySelector('main.deck') || doc.body;
    $('templateMount').innerHTML = deckNode.outerHTML;
    document.body.classList.add('editor-ready');
    prepareDeck(); bindChrome(); pushHistory(true);
    toast('已加载原始模板：样式与页数保持不变');
  }catch(err){
    $('templateMount').innerHTML = '<div class="loading">模板加载失败。请确认仓库根目录存在 VIVOID_同风格正式汇报模板套件.html，并通过本地服务器或 GitHub Pages 打开。<br>' + escapeHtml(err.message) + '</div>';
  }
}

function deck(){ return document.querySelector('main.deck'); }
function slides(){ return Array.from(document.querySelectorAll('section.slide')); }

function prepareDeck(){
  slides().forEach((slide, slideIndex) => {
    slide.dataset.slideIndex = String(slideIndex + 1);
    slide.querySelectorAll(editableSelector).forEach(el => markEditable(el));
  });
  updateInspector(); updateSelectionBox();
}

function markEditable(el){
  if (el.closest('.editor-chrome') || el.dataset.editable) return;
  el.dataset.editable = '1';
  el.addEventListener('pointerenter', () => el.classList.add('editable-hover'));
  el.addEventListener('pointerleave', () => el.classList.remove('editable-hover'));
  el.addEventListener('pointerdown', onElementPointerDown);
  el.addEventListener('dblclick', onElementDoubleClick);
}

function onElementDoubleClick(ev){
  const el = ev.currentTarget;
  ev.preventDefault(); ev.stopPropagation();
  selectOnly(el);
  if (el.tagName === 'IMG' || el.classList.contains('placeholder')) { replaceImage(el); return; }
  if (isTextLike(el)) {
    pushHistory();
    el.contentEditable = 'true';
    el.focus();
    document.execCommand('selectAll', false, null);
  }
}

function onElementPointerDown(ev){
  if (ev.button !== 0 || ev.currentTarget.isContentEditable) return;
  const el = ev.currentTarget;
  ev.stopPropagation();
  if (ev.shiftKey || ev.metaKey || ev.ctrlKey) toggleSelect(el); else if (!state.selected.has(el)) selectOnly(el);

  const start = clientPoint(ev);
  const selected = selectedElements();
  const starts = selected.map(el => ({ el, rect: rectInSlide(el) }));
  let moved = false;
  const onMove = (e) => {
    const p = clientPoint(e); const dx = p.x - start.x; const dy = p.y - start.y;
    if (!moved && Math.hypot(dx, dy) < 3) return;
    if (!moved) { pushHistory(); starts.forEach(s => materialize(s.el)); moved = true; }
    starts.forEach(s => { s.el.style.left = Math.round(s.rect.x + dx) + 'px'; s.el.style.top = Math.round(s.rect.y + dy) + 'px'; });
    updateSelectionBox(); updateInspector(false);
  };
  const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
}

function bindChrome(){
  $('btnUndo').onclick = undo; $('btnRedo').onclick = redo; $('btnDelete').onclick = deleteSelected;
  $('btnBringFront').onclick = () => layer('front'); $('btnSendBack').onclick = () => layer('back');
  $('btnImage').onclick = () => { const first = selectedElements()[0]; if (first) replaceImage(first); };
  $('btnSave').onclick = saveEditableHtml;
  $('btnSaveAs').onclick = saveEditableHtmlAs;
  $('btnExport').onclick = exportStaticHtml;
  $('imageInput').onchange = onImagePicked;
  ['propX','propY','propW','propH'].forEach(id => $(id).addEventListener('change', applyBox));
  $('propRole').addEventListener('change', applyRole);
  $('propFontSize').addEventListener('change', applyFontFields);
  $('propColor').addEventListener('change', applyFontFields);
  $('propText').addEventListener('change', applyText);
  $('propFit').addEventListener('change', applyImageFit);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('pointerdown', (ev)=>{ if(!ev.target.closest('[data-editable],.editor-chrome,.editor-selection')) clearSelection(); });
  bindResizeHandle();
}

function bindResizeHandle(){
  const box = $('selectionBox');
  box.querySelector('.resize-handle').addEventListener('pointerdown', (ev)=>{
    ev.preventDefault(); ev.stopPropagation();
    const selected = selectedElements(); if(!selected.length) return;
    pushHistory(); selected.forEach(materialize);
    const start = clientPoint(ev); const group = groupRect(selected); const starts = selected.map(el => ({ el, box: rectInSlide(el) }));
    const onMove = (e)=>{
      const p = clientPoint(e); const sx = Math.max(.05, (group.w + (p.x - start.x)) / group.w); const sy = Math.max(.05, (group.h + (p.y - start.y)) / group.h);
      starts.forEach(item => {
        item.el.style.left = Math.round(group.x + (item.box.x - group.x) * sx) + 'px';
        item.el.style.top = Math.round(group.y + (item.box.y - group.y) * sy) + 'px';
        item.el.style.width = Math.max(8, Math.round(item.box.w * sx)) + 'px';
        item.el.style.height = Math.max(8, Math.round(item.box.h * sy)) + 'px';
      });
      updateSelectionBox(); updateInspector(false);
    };
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
  });
}

function materialize(el){
  if (el.dataset.absolute === '1') return;
  const slide = el.closest('.slide'); if(!slide) return;
  const r = rectInSlide(el); const cs = getComputedStyle(el);
  const ghost = document.createElement(el.tagName === 'LI' ? 'li' : 'div');
  ghost.className = 'editor-ghost'; ghost.dataset.ghostFor = ensureId(el);
  ghost.style.width = Math.round(el.getBoundingClientRect().width) + 'px';
  ghost.style.height = Math.round(el.getBoundingClientRect().height) + 'px';
  ghost.style.display = cs.display === 'inline' ? 'inline-block' : cs.display;
  ghost.style.margin = cs.margin;
  el.parentNode.insertBefore(ghost, el);
  copyComputedForLift(el, cs);
  slide.appendChild(el);
  el.dataset.absolute = '1'; el.dataset.ghostId = ghost.dataset.ghostFor;
  el.classList.add('editable-absolute');
  Object.assign(el.style, { left: Math.round(r.x)+'px', top: Math.round(r.y)+'px', width: Math.round(r.w)+'px', height: Math.round(r.h)+'px', zIndex: nextZ(slide) });
}
function copyComputedForLift(el, cs){
  ['fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','color','textAlign','backgroundColor','border','borderRadius','padding','display','alignItems','justifyContent'].forEach(p => { try{ el.style[p] = cs[p]; }catch(e){} });
}
function rectInSlide(el){ const slide = el.closest('.slide'); const er = el.getBoundingClientRect(); const sr = slide.getBoundingClientRect(); return { x: er.left - sr.left, y: er.top - sr.top, w: er.width, h: er.height }; }
function groupRect(items){ const rects = items.map(rectInSlide); const x = Math.min(...rects.map(r=>r.x)); const y = Math.min(...rects.map(r=>r.y)); const r = Math.max(...rects.map(r=>r.x+r.w)); const b = Math.max(...rects.map(r=>r.y+r.h)); return {x,y,w:r-x,h:b-y}; }

function selectOnly(el){ clearSelection(false); state.selected.add(el); el.classList.add('editable-selected'); updateSelectionBox(); updateInspector(); }
function toggleSelect(el){ state.selected.has(el) ? (state.selected.delete(el), el.classList.remove('editable-selected')) : (state.selected.add(el), el.classList.add('editable-selected')); updateSelectionBox(); updateInspector(); }
function clearSelection(update=true){ state.selected.forEach(el => { el.classList.remove('editable-selected'); el.contentEditable = 'false'; }); state.selected.clear(); $('selectionBox').classList.add('hidden'); if(update) updateInspector(); }
function selectedElements(){ return Array.from(state.selected).filter(el => el.isConnected); }
function updateSelectionBox(){ const selected = selectedElements(); const box = $('selectionBox'); if(!selected.length){ box.classList.add('hidden'); return; } const g = groupViewportRect(selected); Object.assign(box.style, { left:g.x+'px', top:g.y+'px', width:g.w+'px', height:g.h+'px' }); box.classList.remove('hidden'); }
function groupViewportRect(items){ const rects = items.map(el=>el.getBoundingClientRect()); const x=Math.min(...rects.map(r=>r.left))+scrollX; const y=Math.min(...rects.map(r=>r.top))+scrollY; const r=Math.max(...rects.map(r=>r.right))+scrollX; const b=Math.max(...rects.map(r=>r.bottom))+scrollY; return {x,y,w:r-x,h:b-y}; }

function updateInspector(fill=true){
  const selected = selectedElements(); $('selectionInfo').textContent = selected.length ? `已选中 ${selected.length} 个元素` : '未选中元素';
  if(!selected.length) return;
  const first = selected[0]; const r = rectInSlide(first);
  if(fill){ $('propX').value=Math.round(r.x); $('propY').value=Math.round(r.y); $('propW').value=Math.round(r.w); $('propH').value=Math.round(r.h); $('propText').value = isTextLike(first) ? first.innerText.trim() : ''; $('propFontSize').value=parseInt(getComputedStyle(first).fontSize)||''; $('propColor').value=rgbToHex(getComputedStyle(first).color); $('propFit').value = first.tagName === 'IMG' ? (first.style.objectFit || getComputedStyle(first).objectFit || 'contain') : 'contain'; }
}
function applyBox(){ const selected=selectedElements(); if(!selected.length)return; pushHistory(); selected.forEach(el=>{ materialize(el); el.style.left=+$('propX').value+'px'; el.style.top=+$('propY').value+'px'; el.style.width=+$('propW').value+'px'; el.style.height=+$('propH').value+'px'; }); updateSelectionBox(); }
function applyRole(){ const role=$('propRole').value; if(role==='keep')return; const p=rolePreset[role]; if(!p)return; pushHistory(); selectedElements().filter(isTextLike).forEach(el=>{ Object.assign(el.style,p); el.dataset.role=role; }); updateInspector(true); }
function applyFontFields(){ pushHistory(); selectedElements().filter(isTextLike).forEach(el=>{ if($('propFontSize').value) el.style.fontSize=+$('propFontSize').value+'px'; el.style.color=$('propColor').value; }); }
function applyText(){ pushHistory(); selectedElements().filter(isTextLike).forEach(el=>{ el.innerText=$('propText').value; }); updateSelectionBox(); }
function applyImageFit(){ pushHistory(); selectedElements().filter(el=>el.tagName==='IMG').forEach(img=>{ img.style.objectFit=$('propFit').value; img.style.width='100%'; img.style.height='100%'; }); }
function replaceImage(target){ state.imageTarget = target; $('imageInput').click(); }
function onImagePicked(ev){ const file=ev.target.files[0]; if(!file||!state.imageTarget)return; const reader=new FileReader(); reader.onload=()=>{ pushHistory(); let target=state.imageTarget; if(target.tagName==='IMG'){ target.src=reader.result; target.style.objectFit=$('propFit').value || 'contain'; } else { const img=document.createElement('img'); img.src=reader.result; img.dataset.editable='1'; img.style.width='100%'; img.style.height='100%'; img.style.objectFit='contain'; target.innerHTML=''; target.appendChild(img); markEditable(img); } ev.target.value=''; toast('图片已更新'); }; reader.readAsDataURL(file); }
function deleteSelected(){ const selected=selectedElements(); if(!selected.length)return; pushHistory(); selected.forEach(el=>{ const ghost=document.querySelector(`[data-ghost-for="${el.dataset.ghostId}"]`); if(ghost) ghost.remove(); el.remove(); }); clearSelection(); }
function layer(type){ const selected=selectedElements(); if(!selected.length)return; pushHistory(); selected.forEach(materialize); selected.forEach(el=>{ el.style.zIndex = type==='front' ? nextZ(el.closest('.slide')) : 1; }); updateSelectionBox(); }
function nextZ(slide){ return Math.max(1,...Array.from(slide.children).map(n=>parseInt(getComputedStyle(n).zIndex)||1))+1; }

function pushHistory(initial=false){ const d=deck(); if(!d)return; const snap=d.innerHTML; if(!initial){ state.history.push(snap); if(state.history.length>80)state.history.shift(); state.future.length=0; } }
function undo(){ if(!state.history.length){toast('没有可撤销操作');return;} state.future.push(deck().innerHTML); deck().innerHTML=state.history.pop(); clearSelection(false); prepareDeck(); toast('已撤销'); }
function redo(){ if(!state.future.length){toast('没有可恢复操作');return;} state.history.push(deck().innerHTML); deck().innerHTML=state.future.pop(); clearSelection(false); prepareDeck(); toast('已恢复'); }
function onKeyDown(ev){ const active=document.activeElement; const typing=active&&(active.tagName==='INPUT'||active.tagName==='TEXTAREA'||active.tagName==='SELECT'||active.isContentEditable); if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==='z'){ev.preventDefault(); ev.shiftKey?redo():undo(); return;} if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==='y'){ev.preventDefault(); redo(); return;} if(!typing&&(ev.key==='Delete'||ev.key==='Backspace')){ev.preventDefault(); deleteSelected();}}

async function saveEditableHtml(){
  if (!state.fileHandle) return saveEditableHtmlAs();
  const html = await buildEditableHtml();
  await writeFileHandle(state.fileHandle, html);
  toast('已保存到当前文件');
}
async function saveEditableHtmlAs(){
  const html = await buildEditableHtml();
  const name = 'VIVOID_同风格正式汇报模板套件_可编辑.html';
  if (window.showSaveFilePicker) {
    try {
      state.fileHandle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'Editable HTML', accept: { 'text/html': ['.html'] } }] });
      await writeFileHandle(state.fileHandle, html);
      toast('已另存为可继续编辑的 HTML');
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn(err);
    }
  }
  download(name, html, 'text/html');
  toast('浏览器不支持直接保存，已下载可编辑 HTML');
}
async function writeFileHandle(handle, content){ const writable = await handle.createWritable(); await writable.write(content); await writable.close(); }

async function buildEditableHtml(){
  const deckHtml = deck().outerHTML;
  const editorCss = await readAssetText('src/template-editor.css', 'style[data-editor-style]');
  const editorJs = await readAssetText('src/template-editor.js', 'script[data-editor-runtime]');
  const templateHead = state.templateHead || readEmbeddedTemplateHead();
  return `<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1" />\n<title>ppt-like-html · 可编辑副本</title>\n${templateHead}\n<script type="application/json" id="pptlikeTemplateHeadJson">${escapeJsonForScript(templateHead)}</script>\n<style data-editor-style>\n${editorCss}\n</style>\n</head>\n<body>\n${editorChromeHtml()}\n<div id="templateMount" class="template-mount">\n${deckHtml}\n</div>\n<input id="imageInput" type="file" accept="image/*" hidden />\n<div id="selectionBox" class="editor-selection hidden"><span class="resize-handle"></span></div>\n<div id="toast" class="editor-toast hidden"></div>\n<script data-editor-runtime>\n${editorJs.replace(/<\\/script/gi,'<\\\\/script')}\n</script>\n</body>\n</html>`;
}
function editorChromeHtml(){ return document.getElementById('editorChrome').outerHTML; }
async function readAssetText(url, inlineSelector){ const inline = document.querySelector(inlineSelector); if (inline) return inline.textContent; try { return await fetch(url, { cache:'no-store' }).then(r=>r.text()); } catch { return ''; } }
function readEmbeddedTemplateHead(){ const json = document.getElementById('pptlikeTemplateHeadJson'); if (json) { try { return JSON.parse(json.textContent); } catch {} } return Array.from(document.head.children).filter(n => !n.closest('.editor-chrome') && n.tagName !== 'TITLE' && !n.matches('[data-editor-style],script,#pptlikeTemplateHeadJson')).map(n=>n.outerHTML).join('\n'); }
function escapeJsonForScript(value){ return JSON.stringify(value).replace(/<\//g,'<\\/'); }

function exportStaticHtml(){ const clean=deck().cloneNode(true); clean.querySelectorAll('[data-editable]').forEach(n=>{ n.removeAttribute('data-editable'); n.removeAttribute('data-absolute'); n.removeAttribute('data-ghost-id'); n.removeAttribute('data-role'); n.classList.remove('editable-hover','editable-selected'); n.contentEditable='false'; }); clean.querySelectorAll('.editor-ghost').forEach(n=>n.remove()); const html='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>VIVOID edited deck</title>'+state.templateHead+'</head><body>'+clean.outerHTML+'</body></html>'; download('VIVOID_同风格正式汇报模板套件_静态导出.html', html, 'text/html'); }
function download(name, content, type){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([content],{type})); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
function isTextLike(el){ return !['IMG','SVG','TABLE'].includes(el.tagName) && !el.querySelector('img,svg,table'); }
function ensureId(el){ if(!el.dataset.editorId) el.dataset.editorId='ed_'+Math.random().toString(36).slice(2,9); return el.dataset.editorId; }
function clientPoint(ev){ return {x:ev.clientX,y:ev.clientY}; }
function rgbToHex(rgb){ const m=rgb.match(/\d+/g); if(!m)return '#15202b'; return '#'+m.slice(0,3).map(x=>(+x).toString(16).padStart(2,'0')).join(''); }
function escapeHtml(s){ return String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.remove('hidden'); clearTimeout(toast.t); toast.t=setTimeout(()=>t.classList.add('hidden'),1800); }
