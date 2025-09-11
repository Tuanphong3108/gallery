/* viewer.js - FULL
   Features:
   - launchQueue (File Handling API) + fallback input
   - center image view
   - prev/next for multiple files
   - edit mode with canvas:
       * Brush drawing with color/size/opacity
       * Text insertion
       * Crop
       * Undo / Redo (snapshot stack)
       * Save (showSaveFilePicker or fallback download)
   - keyboard shortcuts:
       ArrowLeft / ArrowRight, + / -, R, E (edit), Ctrl+Z (undo), Ctrl+Y (redo)
*/

let fileHandles = [];
let currentIndex = 0;
let zoom = 1;
let rotation = 0;

const img = document.getElementById("image");
const filenameEl = document.getElementById("filename");
const placeholder = document.getElementById("placeholder");
const fileInput = document.getElementById("fileInput");
const uploadBtn = document.getElementById("uploadBtn");

const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const zoomInBtn = document.getElementById("zoom-in");
const zoomOutBtn = document.getElementById("zoom-out");
const rotateBtn = document.getElementById("rotate");
const editToggleBtn = document.getElementById("edit-toggle");
const saveBtn = document.getElementById("save");
const openFolderBtn = document.getElementById("open-folder");

const undoBtn = document.getElementById("undo");
const redoBtn = document.getElementById("redo");
const brushColorInput = document.getElementById("brush-color");
const brushSizeInput = document.getElementById("brush-size");
const brushOpacityInput = document.getElementById("brush-opacity");

let editing = false;
let canvas = null;
let ctx = null;
let drawMode = "brush"; // 'brush' | 'text' | 'crop'
let isDrawing = false;
let cropRect = null;

// Undo/Redo stacks
const UNDO_LIMIT = 20;
let undoStack = [];
let redoStack = [];

// Utility to wrap File or FileHandle
function normalizeFileHandles(list) {
  return Array.from(list).map(f => {
    if (f.getFile) return f;
    return { getFile: async () => f };
  });
}

function updateControlsState() {
  const multi = fileHandles.length > 1;
  prevBtn.disabled = !multi || currentIndex === 0;
  nextBtn.disabled = !multi || currentIndex >= fileHandles.length - 1;
  saveBtn.disabled = !editing;
  undoBtn.disabled = undoStack.length === 0;
  redoBtn.disabled = redoStack.length === 0;
}

// Show image or placeholder
async function showImage() {
  if (!fileHandles.length) {
    img.style.display = "none";
    if (canvas) canvas.style.display = "none";
    placeholder.style.display = "flex";
    filenameEl.textContent = "Chưa có ảnh";
    updateControlsState();
    return;
  }

  placeholder.style.display = "none";
  const file = await fileHandles[currentIndex].getFile();
  const url = URL.createObjectURL(file);
  img.src = url;
  img.onload = () => {
    zoom = 1;
    rotation = 0;
    img.style.transform = `translate(-50%, -50%) scale(${zoom}) rotate(${rotation}deg)`;
    img.style.display = "block";
    if (canvas) canvas.style.display = "none";
  };
  filenameEl.textContent = file.name || "Image";
  updateControlsState();
}

// launchQueue (ChromeOS)
if ("launchQueue" in window) {
  launchQueue.setConsumer(async (launchParams) => {
    if (!launchParams.files?.length) return;
    fileHandles = normalizeFileHandles(launchParams.files);
    currentIndex = 0;
    showImage();
  });
}

// fallback input
uploadBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", async (e) => {
  const files = Array.from(e.target.files);
  fileHandles = normalizeFileHandles(files);
  currentIndex = 0;
  showImage();
});

// prev/next
prevBtn.addEventListener("click", () => {
  if (currentIndex > 0) { currentIndex--; showImage(); }
});
nextBtn.addEventListener("click", () => {
  if (currentIndex < fileHandles.length - 1) { currentIndex++; showImage(); }
});

// zoom & rotate
zoomInBtn.addEventListener("click", () => {
  zoom += 0.2; img.style.transform = `translate(-50%, -50%) scale(${zoom}) rotate(${rotation}deg)`;
});
zoomOutBtn.addEventListener("click", () => {
  zoom = Math.max(0.2, zoom - 0.2); img.style.transform = `translate(-50%, -50%) scale(${zoom}) rotate(${rotation}deg)`;
});
rotateBtn.addEventListener("click", () => {
  rotation = (rotation + 90) % 360; img.style.transform = `translate(-50%, -50%) scale(${zoom}) rotate(${rotation}deg)`;
});

// open folder (FS Access)
openFolderBtn.addEventListener("click", async () => {
  if (!window.showDirectoryPicker) {
    alert("File System Access API chưa hỗ trợ ở trình duyệt này.");
    return;
  }
  try {
    const dir = await window.showDirectoryPicker();
    const files = [];
    for await (const [, handle] of dir) {
      if (handle.kind === "file") {
        const f = await handle.getFile();
        if (f.type.startsWith("image/")) files.push(handle);
      }
    }
    if (!files.length) { alert("Không tìm thấy ảnh trong thư mục."); return; }
    fileHandles = normalizeFileHandles(files);
    currentIndex = 0;
    showImage();
  } catch (err) {
    console.error(err);
  }
});

// EDIT toggle
editToggleBtn.addEventListener("click", async () => {
  if (!fileHandles.length) return alert("Chưa có ảnh để chỉnh.");
  editing = !editing;
  if (editing) {
    enterEditMode();
    editToggleBtn.textContent = "✖️ Close Edit";
  } else {
    exitEditMode();
    editToggleBtn.textContent = "✏️ Edit";
  }
  updateControlsState();
});

// SAVE edited image
saveBtn.addEventListener("click", async () => {
  if (!editing || !canvas) return;
  canvas.toBlob(async (blob) => {
    if (!blob) return alert("Lưu thất bại.");
    if (window.showSaveFilePicker) {
      try {
        const origName = (await fileHandles[currentIndex].getFile()).name || "image";
        const suggested = origName.replace(/\.[^.]+$/, "") + "-edited.png";
        const handle = await window.showSaveFilePicker({
          suggestedName: suggested,
          types: [{ description: "PNG Image", accept: { "image/png": [".png"] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        toast("Saved!");
      } catch (err) {
        console.error(err);
        toast("Save cancelled or failed.");
      }
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "edited.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("Downloaded edited.png");
    }
  }, "image/png");
});

// Undo / Redo logic
function pushUndoSnapshot() {
  if (!canvas) return;
  try {
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    undoStack.push(data);
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    // clear redo on new action
    redoStack = [];
    updateControlsState();
  } catch (err) {
    console.warn("pushUndoSnapshot failed:", err);
  }
}

function undo() {
  if (!undoStack.length) return;
  const last = undoStack.pop();
  // push current to redo
  try {
    const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    redoStack.push(current);
    ctx.putImageData(last, 0, 0);
    updateControlsState();
  } catch (err) {
    console.error("undo error", err);
  }
}

function redo() {
  if (!redoStack.length) return;
  const next = redoStack.pop();
  try {
    const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    undoStack.push(current);
    ctx.putImageData(next, 0, 0);
    updateControlsState();
  } catch (err) {
    console.error("redo error", err);
  }
}

undoBtn.addEventListener("click", undo);
redoBtn.addEventListener("click", redo);

// keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") prevBtn.click();
  if (e.key === "ArrowRight") nextBtn.click();
  if (e.key === "+") zoomInBtn.click();
  if (e.key === "-") zoomOutBtn.click();
  if (e.key.toLowerCase() === "r") rotateBtn.click();
  if (e.key.toLowerCase() === "e") editToggleBtn.click();

  // Ctrl+Z, Ctrl+Y for undo/redo
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    undo();
  }
  if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
    e.preventDefault();
    redo();
  }
});

// toast helper
let toastTimer = null;
function toast(msg, ms = 1400) {
  let t = document.querySelector(".toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.display = "none"; }, ms);
}

// ---------- EDIT MODE ----------
async function enterEditMode() {
  // ensure image loaded
  if (!img.src || !img.naturalWidth) {
    toast("Ảnh chưa load xong.");
    return;
  }

  // create canvas if needed
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.className = "edit-canvas";
    canvas.tabIndex = 0;
    ctx = canvas.getContext("2d");
    document.getElementById("stage").appendChild(canvas);
  }

  // size canvas to natural size (high res)
  const naturalW = img.naturalWidth;
  const naturalH = img.naturalHeight;
  canvas.width = naturalW;
  canvas.height = naturalH;
  // draw image
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // scale canvas to fit viewport
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const fitScale = Math.min(viewportW / canvas.width, viewportH / canvas.height, 1);
  canvas.style.width = (canvas.width * fitScale) + "px";
  canvas.style.height = (canvas.height * fitScale) + "px";
  canvas.style.left = "50%";
  canvas.style.top = "50%";
  canvas.style.transform = "translate(-50%, -50%)";
  canvas.style.display = "block";
  canvas.style.zIndex = 50;
  img.style.display = "none";

  // clear stacks
  undoStack = [];
  redoStack = [];
  // push initial snapshot
  try {
    const init = ctx.getImageData(0, 0, canvas.width, canvas.height);
    undoStack.push(init);
  } catch (err) {
    console.warn("init snapshot failed", err);
  }
  updateControlsState();

  // setup canvas handlers
  drawMode = "brush";
  setupCanvasHandlers(canvas, ctx);
  toast("Edit mode: b=Brush, t=Text, c=Crop. Ctrl+Z undo, Ctrl+Y redo");
}

function exitEditMode() {
  if (canvas) canvas.style.display = "none";
  img.style.display = "block";
  editing = false;
  updateControlsState();
}

// canvas handlers with undo/redo integration
function setupCanvasHandlers(c, ctxLocal) {
  cropRect = null;
  let lastX = 0, lastY = 0;

  function getCanvasPos(e) {
    const rect = c.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (c.width / rect.width);
    const y = (e.clientY - rect.top) * (c.height / rect.height);
    return { x, y };
  }

  c.onpointerdown = (e) => {
    c.focus();
    if (drawMode === "brush") {
      // push snapshot before starting a new brush stroke
      pushUndoSnapshot();
      isDrawing = true;
      const p = getCanvasPos(e);
      lastX = p.x; lastY = p.y;
      ctxLocal.beginPath();
      ctxLocal.moveTo(lastX, lastY);
      ctxLocal.lineJoin = "round";
      ctxLocal.lineCap = "round";
      ctxLocal.strokeStyle = brushColorInput.value;
      ctxLocal.globalAlpha = parseFloat(brushOpacityInput.value);
      ctxLocal.lineWidth = parseInt(brushSizeInput.value, 10);
    } else if (drawMode === "crop") {
      pushUndoSnapshot(); // snapshot before crop interaction
      isDrawing = true;
      const p = getCanvasPos(e);
      cropRect = { x1: p.x, y1: p.y, x2: p.x, y2: p.y };
    } else if (drawMode === "text") {
      pushUndoSnapshot(); // snapshot before adding text
      const p = getCanvasPos(e);
      const userText = prompt("Nhập chữ muốn thêm:");
      if (userText) {
        ctxLocal.fillStyle = brushColorInput.value;
        // scale text size: map brush size to font size
        const fontSize = Math.max(12, parseInt(brushSizeInput.value, 10) * 3);
        ctxLocal.font = `${fontSize}px sans-serif`;
        ctxLocal.fillText(userText, p.x, p.y);
      }
    }
    c.setPointerCapture(e.pointerId);
  };

  c.onpointermove = (e) => {
    if (!isDrawing) return;
    const p = getCanvasPos(e);
    if (drawMode === "brush") {
      ctxLocal.lineTo(p.x, p.y);
      ctxLocal.stroke();
    } else if (drawMode === "crop") {
      cropRect.x2 = p.x; cropRect.y2 = p.y;
      // redraw overlay: easiest is to redraw snapshot then rectangle
      redrawCanvasFromLastSnapshotWithRect(ctxLocal, cropRect);
    }
  };

  c.onpointerup = (e) => {
    isDrawing = false;
    try { c.releasePointerCapture(e.pointerId); } catch {}
    if (drawMode === "crop" && cropRect) {
      finalizeCrop(ctxLocal);
    }
    // after finishing an action, update control states
    updateControlsState();
  };

  // keyboard inside canvas to change modes
  c.onkeydown = (ev) => {
    if (ev.key === "b") { drawMode = "brush"; toast("Brush mode"); }
    if (ev.key === "t") { drawMode = "text"; toast("Text mode"); }
    if (ev.key === "c") { drawMode = "crop"; toast("Crop mode"); }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z") {
      ev.preventDefault(); undo();
    }
    if ((ev.ctrlKey || ev.metaKey) && (ev.key.toLowerCase() === "y" || (ev.shiftKey && ev.key.toLowerCase() === "z"))) {
      ev.preventDefault(); redo();
    }
  };
}

// redraw canvas showing current pixel state + dashed crop rect (uses current ctx contents)
function redrawCanvasFromLastSnapshotWithRect(ctxLocal, rect) {
  // For simplicity, we assume ctxLocal contains the up-to-date drawing.
  // We'll overlay rect on top.
  // First, redraw base image (no history/undo applied here to avoid complexity)
  // Then draw rect:
  ctxLocal.save();
  ctxLocal.setLineDash([8, 6]);
  ctxLocal.strokeStyle = "#ffffff";
  ctxLocal.lineWidth = 3;
  const x = Math.min(rect.x1, rect.x2);
  const y = Math.min(rect.y1, rect.y2);
  const w = Math.abs(rect.x2 - rect.x1);
  const h = Math.abs(rect.y2 - rect.y1);
  // draw rectangle on top without clearing previous strokes (simple approach)
  ctxLocal.strokeRect(x, y, w, h);
  ctxLocal.restore();
}

// finalize crop
function finalizeCrop(ctxLocal) {
  if (!cropRect) return;
  const x = Math.round(Math.min(cropRect.x1, cropRect.x2));
  const y = Math.round(Math.min(cropRect.y1, cropRect.y2));
  const w = Math.round(Math.abs(cropRect.x2 - cropRect.x1));
  const h = Math.round(Math.abs(cropRect.y2 - cropRect.y1));
  if (w <= 8 || h <= 8) { cropRect = null; return; }
  const tmp = document.createElement("canvas");
  tmp.width = w; tmp.height = h;
  const tctx = tmp.getContext("2d");
  tctx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
  // replace main canvas content
  canvas.width = w; canvas.height = h;
  ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(tmp, 0, 0);
  // resize display
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const fitScale = Math.min(viewportW / canvas.width, viewportH / canvas.height, 1);
  canvas.style.width = (canvas.width * fitScale) + "px";
  canvas.style.height = (canvas.height * fitScale) + "px";
  cropRect = null;
  // push final crop snapshot
  try { const snap = ctx.getImageData(0,0,canvas.width,canvas.height); undoStack.push(snap); if (undoStack.length > UNDO_LIMIT) undoStack.shift(); } catch {}
  redoStack = [];
  updateControlsState();
}

// initial
showImage();
updateControlsState();
