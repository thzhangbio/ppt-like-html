(function patchPptLikeHtmlEditor(){
  const SLIDE_W_FIX = 1280;
  const SLIDE_H_FIX = 720;
  const style = document.createElement('style');
  style.textContent = '.canvas-wrap{position:relative;flex:0 0 auto}.stage-scroller{align-items:center!important;justify-content:center!important}';
  document.head.appendChild(style);

  const history = [];
  const future = [];
  let restoring = false;

  function snapshot(){
    return JSON.stringify({slides: state.slides, current: state.current});
  }
  function restore(snap){
    restoring = true;
    const data = JSON.parse(snap);
    state.slides = data.slides || [];
    state.current = Math.max(0, Math.min(data.current || 0, state.slides.length - 1));
    state.selected.clear();
    renderAll();
    restoring = false;
  }
  function commit(){
    if (restoring) return;
    history.push(snapshot());
    if (history.length > 80) history.shift();
    future.length = 0;
  }
  function undo(){
    if (!history.length) { showToast('没有可撤销的操作'); return; }
    future.push(snapshot());
    restore(history.pop());
    showToast('已撤销');
  }
  function redo(){
    if (!future.length) { showToast('没有可恢复的操作'); return; }
    history.push(snapshot());
    restore(future.pop());
    showToast('已恢复');
  }
  function isTypingTarget(el){
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
  }
  function deleteSelected(){
    if (!state.selected.size) return;
    commit();
    currentSlide().elements = currentSlide().elements.filter(el => !state.selected.has(el.id));
    state.selected.clear();
    renderAll();
    showToast('已删除选中元素');
  }

  function installCanvasFit(){
    const scroller = document.getElementById('stageScroller');
    const canvas = document.getElementById('slideCanvas');
    if (!scroller || !canvas) return;
    let wrap = document.getElementById('canvasWrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'canvasWrap';
      wrap.className = 'canvas-wrap';
      scroller.insertBefore(wrap, canvas);
      wrap.appendChild(canvas);
    }
    const oldRenderCanvas = renderCanvas;
    window.renderCanvas = renderCanvas = function patchedRenderCanvas(){
      oldRenderCanvas();
      canvas.style.transformOrigin = 'top left';
      wrap.style.width = `${SLIDE_W_FIX * state.zoom}px`;
      wrap.style.height = `${SLIDE_H_FIX * state.zoom}px`;
    };
    window.fitToScreen = function fitToScreen(){
      const rect = scroller.getBoundingClientRect();
      const availableW = Math.max(320, rect.width - 72);
      const availableH = Math.max(240, rect.height - 72);
      state.zoom = Math.min(1, availableW / SLIDE_W_FIX, availableH / SLIDE_H_FIX);
      renderCanvas();
    };
    const zoomLabel = document.getElementById('zoomLabel');
    if (zoomLabel && !document.getElementById('fitZoomBtn')) {
      const btn = document.createElement('button');
      btn.id = 'fitZoomBtn';
      btn.textContent = '适合屏幕';
      btn.onclick = () => window.fitToScreen();
      zoomLabel.parentElement.appendChild(btn);
    }
    window.addEventListener('resize', debounce(() => window.fitToScreen(), 120));
    setTimeout(() => window.fitToScreen(), 0);
  }

  function patchMutationFunctions(){
    const oldInsertElement = insertElement;
    window.insertElement = insertElement = function patchedInsertElement(kind){
      if (kind !== 'image') commit();
      return oldInsertElement(kind);
    };

    const oldHandleImageInsert = handleImageInsert;
    window.handleImageInsert = handleImageInsert = function patchedHandleImageInsert(ev){
      commit();
      return oldHandleImageInsert(ev);
    };

    const oldApplyLayout = applyLayout;
    window.applyLayout = applyLayout = function patchedApplyLayout(type){
      commit();
      return oldApplyLayout(type);
    };

    const oldDuplicateSlide = duplicateSlide;
    window.duplicateSlide = duplicateSlide = function patchedDuplicateSlide(){
      commit();
      return oldDuplicateSlide();
    };

    const oldLayerOp = layerOp;
    window.layerOp = layerOp = function patchedLayerOp(op){
      if (state.selected.size) commit();
      return oldLayerOp(op);
    };

    const oldStartElementPointer = startElementPointer;
    window.startElementPointer = startElementPointer = function patchedStartElementPointer(ev){
      commit();
      return oldStartElementPointer(ev);
    };

    const oldStartGroupPointer = startGroupPointer;
    window.startGroupPointer = startGroupPointer = function patchedStartGroupPointer(ev){
      commit();
      return oldStartGroupPointer(ev);
    };
  }

  function patchInspectorFunctions(){
    window.applyCommon = applyCommon = function patchedApplyCommon(){
      getSelected().forEach(e=>{
        e.x = Number.isFinite(+$('propX').value) ? +$('propX').value : e.x;
        e.y = Number.isFinite(+$('propY').value) ? +$('propY').value : e.y;
        e.w = Number.isFinite(+$('propW').value) ? +$('propW').value : e.w;
        e.h = Number.isFinite(+$('propH').value) ? +$('propH').value : e.h;
      });
      renderCanvas();
    };

    window.applyText = applyText = function patchedApplyText(){
      getSelected().filter(e=>e.type==='text').forEach(e=>{
        const oldRole = e.role;
        e.text = $('propText').value;
        e.role = $('propRole').value;
        if (e.role !== oldRole && rolePreset[e.role]) {
          const p = rolePreset[e.role];
          e.font = p.font;
          e.fontSize = p.size;
          e.fontWeight = p.weight;
          e.color = p.color;
          e.align = p.align;
          $('propFont').value = e.font;
          $('propFontSize').value = e.fontSize;
          $('propFontWeight').value = e.fontWeight;
          $('propColor').value = e.color;
          $('propAlign').value = e.align;
        } else {
          e.font = $('propFont').value;
          e.fontSize = +$('propFontSize').value;
          e.fontWeight = $('propFontWeight').value;
          e.color = $('propColor').value;
          e.align = $('propAlign').value;
        }
      });
      renderCanvas();
      updateInspector(true);
    };

    ['propX','propY','propW','propH','propText','propRole','propFont','propFontSize','propFontWeight','propColor','propAlign','propImageStyle','propObjectFit','propImageZoom','propImageRadius','propObjectX','propObjectY','propShapeKind','propFill','propStroke','propStrokeWidth','propRadius'].forEach(id=>{
      const node = document.getElementById(id);
      if (!node || node.dataset.historyPatched) return;
      node.dataset.historyPatched = '1';
      node.addEventListener('focus', () => { node.dataset.beforeEdit = snapshot(); });
      node.addEventListener('change', () => {
        const before = node.dataset.beforeEdit;
        if (before) {
          history.push(before);
          if (history.length > 80) history.shift();
          future.length = 0;
          delete node.dataset.beforeEdit;
        }
      }, true);
    });
  }

  function installKeyboard(){
    document.addEventListener('keydown', (ev)=>{
      const active = document.activeElement;
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') {
        ev.preventDefault();
        ev.shiftKey ? redo() : undo();
        return;
      }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'y') {
        ev.preventDefault();
        redo();
        return;
      }
      if (!isTypingTarget(active) && (ev.key === 'Delete' || ev.key === 'Backspace')) {
        ev.preventDefault();
        deleteSelected();
      }
    });
  }

  function debounce(fn, ms){
    let timer;
    return function(){ clearTimeout(timer); timer = setTimeout(fn, ms); };
  }

  installCanvasFit();
  patchMutationFunctions();
  patchInspectorFunctions();
  installKeyboard();
  renderAll();
  showToast('紧急修复已加载：适合屏幕 / Ctrl+Z / Delete / 角色样式联动');
})();
