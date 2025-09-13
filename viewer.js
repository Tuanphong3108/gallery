// viewer.js - FULL MERGED
// Features: view/edit (brush/text/crop), pan/zoom/rotate, save/save-as (overwrite if allowed),
// preview confirm modal (created dynamically if missing), toast, info sidebar w/ overlay and ESC,
// launchQueue support, upload fallback, prev/next, file checks (empty/gif/unsupported)

let fileHandles = [];
let currentIndex = 0;
let zoom = 1;
let rotation = 0;

let drawingMode = "none"; // none | brush | text | crop | view
let isDrawing = false;
let canvas = null;
let ctx = null;
let saveHandle = null; // the handle to overwrite if available

// DOM refs (expects index.html to contain these IDs)
const img = document.getElementById("image");
const placeholder = document.getElementById("placeholder");
const filenameInput = document.getElementById("filename");

const fileInput = document.getElementById("fileInput");
const uploadBtn = document.getElementById("uploadBtn");

const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const zoomInBtn = document.getElementById("zoom-in");
const zoomOutBtn = document.getElementById("zoom-out");
const rotateBtn = document.getElementById("rotate");

const viewBtn = document.getElementById("view");
const editBtn = document.getElementById("edit");

const brushBtn = document.getElementById("brush");
const textBtn = document.getElementById("text");
const cropBtn = document.getElementById("crop");
const brushSizeInput = document.getElementById("brushSize");
const colorInput = document.getElementById("color");
const textSizeInput = document.getElementById("textSize");

const saveBtn = document.getElementById("save");
const saveAsBtn = document.getElementById("saveAs");

// Info panel + overlay
const infoBtn = document.getElementById("info");
const fileInfoPanel = document.getElementById("fileInfo");
const closeInfoBtn = document.getElementById("closeInfo");
const infoOverlay = document.getElementById("infoOverlay");
const infoName = document.getElementById("info-name");
const infoType = document.getElementById("info-type");
const infoSize = document.getElementById("info-size");
const infoMod = document.getElementById("info-mod");
const infoRes = document.getElementById("info-res");

// toast element
const toast = document.createElement("div");
toast.className = "toast";
toast.style.display = "none";
document.body.appendChild(toast);

// preview modal (created lazily)
function ensurePreviewModal() {
  if (document.getElementById("previewModal")) return;
  const modal = document.createElement("div");
  modal.id = "previewModal";
  modal.style.position = "fixed";
  modal.style.inset = "0";
  modal.style.display = "flex";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
  modal.style.background = "rgba(0,0,0,0.6)";
  modal.style.zIndex = 9999;

  modal.innerHTML = `
    <div id="previewInner" style="background:#222;padding:12px;border-radius:10px;max-width:90%;max-height:90%;text-align:center;color:#fff">
      <h3 style="margin:0 0 8px">Preview</h3>
      <img id="previewImg" style="max-width:100%;max-height:60vh;border:2px solid #444;margin-bottom:8px" />
      <p id="previewNote" style="margin:6px 0"></p>
      <p id="savingStatus" style="display:none;margin:6px 0;color:#9f0;font-weight:bold">Saving...</p>
      <div style="display:flex;gap:8px;justify-content:center">
        <button id="previewConfirm" style="padding:8px 12px;border-radius:8px">✅ Confirm</button>
        <button id="previewCancel" style="padding:8px 12px;border-radius:8px">❌ Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById("previewCancel").onclick = () => { hidePreviewModal(); };
  document.getElementById("previewConfirm").onclick = () => { confirmSaveFromModal(); };
}

// toast helpers
function showToast(msg, time = 2000) {
  toast.textContent = msg;
  toast.style.display = "block";
  setTimeout(() => { toast.style.display = "none"; }, time);
}

// ================= LaunchQueue (file handler) =================
if ("launchQueue" in window) {
  launchQueue.setConsumer(async (launchParams) => {
    if (!launchParams.files.length) return;
    fileHandles = launchParams.files;
    currentIndex = 0;
    saveHandle = fileHandles[0];
    await showImage();
  });
}

// ================= Show Image / Error =================
async function showImage() {
  if (!fileHandles.length) return showError("No image loaded");
  try {
    const file = await fileHandles[currentIndex].getFile();
    if (!file || file.size === 0) return showError("This file is empty");
    if (file.type === "image/gif") return showError("GIF files are not supported right now");
    if (!file.type.startsWith("image/")) return showError("Unsupported file type");

    // Reset any canvas editor
    if (canvas) {
      canvas.remove();
      canvas = null;
      ctx = null;
    }

    const url = URL.createObjectURL(file);
    zoom = 1; rotation = 0;
    img.src = url;
    img.style.display = "block";
    img.style.transform = `translate(-50%, -50%) scale(${zoom}) rotate(${rotation}deg)`;
    placeholder.style.display = "none";
    filenameInput.value = file.name;

    // Update File Info
    infoName.textContent = file.name;
    infoType.textContent = file.type || "Unknown";
    infoSize.textContent = (file.size / 1024).toFixed(1) + " KB";
    infoMod.textContent = file.lastModified ? new Date(file.lastModified).toLocaleString() : "-";
    img.onload = () => {
      infoRes.textContent = `${img.naturalWidth} x ${img.naturalHeight}px`;
    };

    // Save handle (if fileHandles provided by launchQueue it's a handle)
    saveHandle = fileHandles[currentIndex];

  } catch (err) {
    console.error(err);
    showError("Failed to load file");
  }
}

function showError(msg) {
  img.style.display = "none";
  placeholder.style.display = "flex";
  // if placeholder contains <p> use that, else replace
  const p = placeholder.querySelector("p");
  if (p) p.textContent = "🚫 " + msg;
  else placeholder.innerHTML = `<p>🚫 ${msg}</p>`;
}

// ================= Controls (zoom/rotate/pan) =================
zoomInBtn?.addEventListener("click", () => { zoom += 0.2; updateTransform(); });
zoomOutBtn?.addEventListener("click", () => { zoom = Math.max(0.2, zoom - 0.2); updateTransform(); });
rotateBtn?.addEventListener("click", () => { rotation = (rotation + 90) % 360; updateTransform(); });

function updateTransform() {
  img.style.transform = `translate(-50%, -50%) scale(${zoom}) rotate(${rotation}deg)`;
}

// panning (view mode)
let isPanning = false, panStart = {x:0,y:0}, panOffset = {x:0,y:0};
img.addEventListener("mousedown", (e) => {
  if (drawingMode === "view") {
    isPanning = true;
    panStart = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
    document.body.style.cursor = "grabbing";
  }
});
window.addEventListener("mousemove", (e) => {
  if (isPanning) {
    panOffset.x = e.clientX - panStart.x;
    panOffset.y = e.clientY - panStart.y;
    img.style.transform = `translate(calc(-50% + ${panOffset.x}px), calc(-50% + ${panOffset.y}px)) scale(${zoom}) rotate(${rotation}deg)`;
  }
});
window.addEventListener("mouseup", () => {
  if (isPanning) {
    isPanning = false;
    document.body.style.cursor = "";
  }
});

// prev / next
prevBtn?.addEventListener("click", async () => {
  if (currentIndex > 0) {
    currentIndex--;
    await showImage();
  }
});
nextBtn?.addEventListener("click", async () => {
  if (currentIndex < fileHandles.length - 1) {
    currentIndex++;
    await showImage();
  }
});

// ================= Upload fallback =================
uploadBtn?.addEventListener("click", () => fileInput.click());
fileInput?.addEventListener("change", async (e) => {
  if (!e.target.files.length) return;
  const files = Array.from(e.target.files);
  // create fake handles wrapping File objects so rest of code uses getFile()
  fileHandles = files.map(f => ({
    getFile: async () => f,
    // fake createWritable -> fallback will download instead
    createWritable: undefined
  }));
  currentIndex = 0;
  saveHandle = null;
  await showImage();
});

// ================= View/Edit toggles =================
viewBtn?.addEventListener("click", () => {
  drawingMode = "view";
  document.body.classList.add("view-mode");
  showToast("View mode");
});
editBtn?.addEventListener("click", () => {
  drawingMode = "none";
  document.body.classList.remove("view-mode");
  showToast("Edit mode");
});

// ================= Canvas editor setup =================
function setupCanvasIfNeeded() {
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.className = "edit-canvas";
    canvas.style.left = "50%";
    canvas.style.top = "50%";
    canvas.style.transform = "translate(-50%, -50%)";
    document.getElementById("stage").appendChild(canvas);
    ctx = canvas.getContext("2d");
    bindCanvasEvents();
  }
  // size canvas to natural image size and draw current state
  // when image is rotated we draw the unrotated pixels (we store rotation separately)
  // for simplicity, editor works on original orientation; rotation will be applied when saving final
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
}

// canvas event binding (must be called after canvas created)
function bindCanvasEvents() {
  // mouse coords relative to canvas
  function getOffset(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (canvas.width / rect.width), y: (e.clientY - rect.top) * (canvas.height / rect.height) };
  }

  let cropStart = null;

  canvas.addEventListener("mousedown", (e) => {
    if (drawingMode === "brush") {
      isDrawing = true;
      const o = getOffset(e);
      ctx.beginPath();
      ctx.moveTo(o.x, o.y);
      ctx.strokeStyle = colorInput.value || "#ff0000";
      ctx.lineWidth = parseFloat(brushSizeInput.value || 5);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    } else if (drawingMode === "crop") {
      isDrawing = true;
      cropStart = getOffset(e);
    }
  });

  canvas.addEventListener("mousemove", (e) => {
    if (!isDrawing) return;
    const o = getOffset(e);
    if (drawingMode === "brush") {
      ctx.lineTo(o.x, o.y);
      ctx.stroke();
    } else if (drawingMode === "crop" && cropStart) {
      // draw rubberband overlay: we will redraw image then draw rect
      ctx.putImageData( ctx.getImageData(0,0,canvas.width,canvas.height), 0, 0); // not ideal but ok
      // we instead keep a copy: simpler approach - draw using a temporary overlay canvas is left out for brevity
      // For UX purposes, leave cropping selection visual minimal (can be improved)
    }
  });

  canvas.addEventListener("mouseup", (e) => {
    if (!isDrawing) return;
    const o = getOffset(e);
    if (drawingMode === "brush") {
      isDrawing = false;
      showToast("Stroke added");
    } else if (drawingMode === "crop") {
      // perform crop
      const sx = Math.round(Math.min(cropStart.x, o.x));
      const sy = Math.round(Math.min(cropStart.y, o.y));
      const sw = Math.round(Math.abs(o.x - cropStart.x));
      const sh = Math.round(Math.abs(o.y - cropStart.y));
      if (sw <= 0 || sh <= 0) { isDrawing = false; cropStart = null; showToast("Invalid crop"); return; }
      const imageData = ctx.getImageData(sx, sy, sw, sh);
      canvas.width = sw;
      canvas.height = sh;
      ctx.putImageData(imageData, 0, 0);
      isDrawing = false;
      cropStart = null;
      showToast("Cropped");
    }
  });

  // click to add text
  canvas.addEventListener("click", (e) => {
    if (drawingMode !== "text") return;
    const o = getOffset(e);
    const text = prompt("Enter text:");
    if (!text) return;
    ctx.fillStyle = colorInput.value || "#000";
    ctx.font = `${parseInt(textSizeInput.value || 24,10)}px sans-serif`;
    ctx.fillText(text, o.x, o.y);
    showToast("Text added");
  });
}

// ================= Tools handlers =================
brushBtn?.addEventListener("click", () => { setupCanvasIfNeeded(); drawingMode = "brush"; showToast("Brush mode"); });
textBtn?.addEventListener("click", () => { setupCanvasIfNeeded(); drawingMode = "text"; showToast("Text mode"); });
cropBtn?.addEventListener("click", () => { setupCanvasIfNeeded(); drawingMode = "crop"; showToast("Crop mode"); });

// ================= Save / Save As (with preview confirm modal) =================
let pendingFilename = null;
let previewDataUrl = null;
let previewOverwrite = false;

saveBtn?.addEventListener("click", async () => {
  if (!img.src && !canvas) return showToast("No image to save");
  pendingFilename = filenameInput.value || "image.png";
  previewOverwrite = true;
  await preparePreviewAndShow(true);
});
saveAsBtn?.addEventListener("click", async () => {
  if (!img.src && !canvas) return showToast("No image to save");
  pendingFilename = filenameInput.value ? ("edited-" + filenameInput.value) : "edited-image.png";
  previewOverwrite = false;
  await preparePreviewAndShow(false);
});

async function preparePreviewAndShow(overwrite) {
  ensurePreviewModal();
  // build final preview (apply rotation and use canvas edits if present)
  const blob = await getFinalBlob(); // blob of final image PNG
  previewDataUrl = URL.createObjectURL(blob);
  const previewImg = document.getElementById("previewImg");
  const previewNote = document.getElementById("previewNote");
  const savingStatus = document.getElementById("savingStatus");
  previewImg.src = previewDataUrl;
  previewNote.textContent = overwrite ? "This will overwrite the current file." : "This will download as a new file.";
  savingStatus.style.display = "none";
  document.getElementById("previewModal").style.display = "flex";
}

function hidePreviewModal() {
  const modal = document.getElementById("previewModal");
  if (modal) modal.style.display = "none";
}

// called when user clicks Confirm in modal
async function confirmSaveFromModal() {
  const savingStatus = document.getElementById("savingStatus");
  const overwrite = previewOverwrite;
  // show saving...
  savingStatus.style.display = "block";

  try {
    const blob = await (await fetch(previewDataUrl)).blob();

    if (overwrite && fileHandles.length && fileHandles[currentIndex] && fileHandles[currentIndex].createWritable) {
      // overwrite using handle
      const h = fileHandles[currentIndex];
      const w = await h.createWritable();
      await w.write(blob);
      await w.close();
      savingStatus.style.display = "none";
      showToast("Saved ✅");
    } else {
      // Save As - always download
      const name = pendingFilename || "edited-image.png";
      downloadBlob(blob, name);
      savingStatus.style.display = "none";
      showToast("Downloaded ✅");
    }
  } catch (e) {
    console.error(e);
    savingStatus.style.display = "none";
    showToast("Save failed ❌");
  } finally {
    hidePreviewModal();
  }
}

function downloadBlob(blob, name) {
  const link = document.createElement("a");
  link.download = name;
  link.href = URL.createObjectURL(blob);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

// produce final Blob from either canvas (edits) or image element, applying rotation
async function getFinalBlob() {
  // source canvas = canvas (if editing) else a temp canvas copy of img
  let srcCanvas;
  if (canvas) {
    // use current edit canvas
    srcCanvas = canvas;
  } else {
    // build canvas from image natural size
    srcCanvas = document.createElement("canvas");
    srcCanvas.width = img.naturalWidth || img.width;
    srcCanvas.height = img.naturalHeight || img.height;
    const sctx = srcCanvas.getContext("2d");
    sctx.drawImage(img, 0, 0, srcCanvas.width, srcCanvas.height);
  }

  // if rotation is 0, simply toBlob from srcCanvas
  const angle = rotation % 360;
  if (angle === 0) {
    return await new Promise(resolve => srcCanvas.toBlob(resolve, "image/png"));
  }

  // handle rotated output: create temporay canvas big enough to hold rotated image
  const rad = angle * Math.PI / 180;
  const w = srcCanvas.width, h = srcCanvas.height;
  const newW = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
  const newH = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad));
  const tmp = document.createElement("canvas");
  tmp.width = Math.round(newW);
  tmp.height = Math.round(newH);
  const tctx = tmp.getContext("2d");
  tctx.translate(tmp.width / 2, tmp.height / 2);
  tctx.rotate(rad);
  tctx.drawImage(srcCanvas, -w/2, -h/2);
  return await new Promise(resolve => tmp.toBlob(resolve, "image/png"));
}

// ================= Preview modal setup (ensureConfirm created earlier) =================
ensurePreviewModal(); // ensure exists and wired

// ================= Info panel (overlay, open/close with blur, ESC, click outside) =================
function openInfoPanel() {
  fileInfoPanel.classList.remove("hidden");
  fileInfoPanel.classList.remove("fade-out");
  infoOverlay.classList.add("active");
}
function closeInfoPanel() {
  fileInfoPanel.classList.add("fade-out");
  infoOverlay.classList.remove("active");
  fileInfoPanel.addEventListener("animationend", () => {
    fileInfoPanel.classList.add("hidden");
    fileInfoPanel.classList.remove("fade-out");
  }, { once: true });
}

infoBtn?.addEventListener("click", () => {
  if (fileInfoPanel.classList.contains("hidden")) openInfoPanel(); else closeInfoPanel();
});
closeInfoBtn?.addEventListener("click", closeInfoPanel);
infoOverlay?.addEventListener("click", closeInfoPanel);

// ESC -> close
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !fileInfoPanel.classList.contains("hidden")) {
    closeInfoPanel();
  }
});

// click outside panel close (if overlay not present for some reason)
document.addEventListener("click", (e) => {
  if (!fileInfoPanel.classList.contains("hidden")) {
    if (!fileInfoPanel.contains(e.target) && e.target !== infoBtn && !infoOverlay.contains(e.target)) {
      closeInfoPanel();
    }
  }
});

// ================= Utilities =================
function showSavingPopup() {
  // small helper if needed — but primary saving UI is the preview modal
  showToast("Saving...");
}
function hideSavingPopup(msg) {
  if (msg) showToast(msg);
}

// initial state: show placeholder
placeholder.style.display = "flex";
img.style.display = "none";

// export for debugging if needed
window.__gallery = {
  showImage, showError, getFinalBlob
};
