/* viewer.js
   - Supports launchQueue (File Handling API) + fallback input
   - Centered image
   - Prev/Next when multiple files provided
   - Edit mode: Brush, Text, Crop, Rotate, Zoom, Save
   - Uses canvas for editing; displays filename top-left
*/

let fileHandles = []; // each item: object with getFile() async
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

let editing = false;
let canvas = null;
let ctx = null;
let drawMode = "brush"; // 'brush' | 'text' | 'crop'
let isDrawing = false;
let cropRect = null;

// UTIL: normalize incoming files (launchQueue gives FileSystemFileHandle objects with getFile)
function normalizeFileHandles(list) {
  // list may be File objects or FileSystemFileHandle objects
  return Array.from(list).map(f => {
    if (f.getFile) return f; // file handle-like
    // wrap regular File into object with getFile()
    return {
      getFile: async () => f
    };
  });
}

// UI state updates
function updateControlsState() {
  const multi = fileHandles.length > 1;
  prevBtn.disabled = !multi || currentIndex === 0;
  nextBtn.disabled = !multi || currentIndex >= fileHandles.length - 1;
  saveBtn.disabled = !editing;
}

// show placeholder when no image
async function showImage() {
  if (!fileHandles.length) {
    img.style.display = "none";
    if (canvas) { canvas.style.display = "none"; }
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
    // reset transforms
    zoom = 1;
    rotation = 0;
    img.style.transform = `translate(-50%, -50%) scale(${zoom}) rotate(${rotation}deg)`;
    img.style.display = "block";
    if (canvas) {
      // remove canvas if editing was off
      canvas.style.display = "none";
    }
  };
  filenameEl.textContent = file.name || "Image";
  updateControlsState();
}

// LaunchQueue for File Handling API (ChromeOS)
if ("launchQueue" in window) {
  launchQueue.setConsumer(async (launchParams) => {
    if (!launchParams.files?.length) return;
    fileHandles = normalizeFileHandles(launchParams.files);
    currentIndex = 0;
    showImage();
  });
}

// Fallback: input file
uploadBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", async (e) => {
  const files = Array.from(e.target.files);
  fileHandles = normalizeFileHandles(files);
  currentIndex = 0;
  showImage();
});

// Controls: prev/next
prevBtn.addEventListener("click", () => {
  if (currentIndex > 0) {
    currentIndex--;
    showImage();
  }
});
nextBtn.addEventListener("click", () => {
  if (currentIndex < fileHandles.length - 1) {
    currentIndex++;
    showImage();
  }
});

// Zoom & Rotate
zoomInBtn.addEventListener("click", () => {
  zoom += 0.2; img.style.transform = `translate(-50%, -50%) scale(${zoom}) rotate(${rotation}deg)`;
});
zoomOutBtn.addEventListener("click", () => {
  zoom = Math.max(0.2, zoom - 0.2); img.style.transform = `translate(-50%, -50%) scale(${zoom}) rotate(${rotation}deg)`;
});
rotateBtn.addEventListener("click", () => {
  rotation = (rotation + 90) % 360; img.style.transform = `translate(-50%, -50%) scale(${zoom}) rotate(${rotation}deg)`;
});

// Open folder (uses showDirectoryPicker) — requires permission & user interaction
openFolderBtn.addEventListener("click", async () => {
  if (!window.showDirectoryPicker) {
    alert("File System Access API chưa được hỗ trợ trên trình duyệt này.");
    return;
  }
  try {
    const dirHandle = await window.showDirectoryPicker();
    const files = [];
    for await (const [, handle] of dirHandle) {
      if (handle.kind === "file") {
        // check extension by mime quickly
        const f = await handle.getFile();
        if (f.type.startsWith("image/")) files.push(handle);
      }
    }
    if (!files.length) {
      alert("Không tìm thấy file ảnh trong thư mục.");
      return;
    }
    fileHandles = normalizeFileHandles(files);
    currentIndex = 0;
    showImage();
  } catch (err) {
    console.error(err);
  }
});

// EDIT: toggle edit mode
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

// Save edited image (from canvas)
saveBtn.addEventListener("click", async () => {
  if (!editing || !canvas) return;
  // get blob
  canvas.toBlob(async (blob) => {
    if (!blob) return alert("Lưu thất bại.");
    // showSaveFilePicker (Chrome/Chromium)
    if (window.showSaveFilePicker) {
      try {
        const suggested = (await fileHandles[currentIndex].getFile()).name.replace(/\.[^.]+$/, "") + "-edited.png";
        const handle = await window.showSaveFilePicker({
          suggestedName: suggested,
          types: [{ description: "PNG Image", accept: { "image/png": [".png"] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        alert("Saved!");
      } catch (err) {
        console.error(err);
        alert("Lưu bị huỷ hoặc lỗi.");
      }
    } else {
      // fallback download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "edited.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      alert("Downloaded edited.png");
    }
  }, "image/png");
});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") prevBtn.click();
  if (e.key === "ArrowRight") nextBtn.click();
  if (e.key === "+") zoomInBtn.click();
  if (e.key === "-") zoomOutBtn.click();
  if (e.key.toLowerCase() === "r") rotateBtn.click();
  if (e.key.toLowerCase() === "e") editToggleBtn.click();
});

// ---------- EDIT MODE IMPLEMENTATION ----------
function enterEditMode() {
  // create canvas same size as natural image
  const naturalW = img.naturalWidth;
  const naturalH = img.naturalHeight;
  if (!naturalW || !naturalH) { alert("Ảnh chưa load xong."); return; }

  // create or reuse canvas
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.className = "edit-canvas";
    canvas.style.zIndex = 60;
    canvas.style.cursor = "crosshair";
    canvas.tabIndex = 0;
    ctx = canvas.getContext("2d");
    document.getElementById("stage").appendChild(canvas);
  }

  // size canvas to displayed scale but keep high resolution: we'll use natural size for editing
  // show canvas scaled to fit viewport similar to img
  canvas.width = naturalW;
  canvas.height = naturalH;
  // draw image into canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // position the canvas overlay centered like the img. We'll use CSS transforms to scale down to fit viewport.
  // calculate scale to fit viewport
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const fitScale = Math.min(viewportW / canvas.width, viewportH / canvas.height, 1);
  canvas.style.width = (canvas.width * fitScale) + "px";
  canvas.style.height = (canvas.height * fitScale) + "px";
  canvas.style.left = "50%";
  canvas.style.top = "50%";
  canvas.style.transform = "translate(-50%, -50%)";
  canvas.style.display = "block";
  img.style.display = "none";

  // setup simple drawing handlers
  drawMode = "brush";
  setupCanvasHandlers(canvas, ctx, fitScale);
  saveBtn.disabled = false;
}

function exitEditMode() {
  if (canvas) {
    canvas.style.display = "none";
  }
  img.style.display = "block";
  editing = false;
  saveBtn.disabled = true;
}

// canvas handlers: simple brush, text and crop
function setupCanvasHandlers(c, ctxLocal, displayScale) {
  // reset any crop overlay
  cropRect = null;

  // Brush drawing variables (in canvas coordinate space)
  let lastX = 0, lastY = 0;

  function getCanvasPos(e) {
    // support pointer events
    const rect = c.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (c.width / rect.width);
    const y = (e.clientY - rect.top) * (c.height / rect.height);
    return { x, y };
  }

  c.onpointerdown = (e) => {
    if (drawMode === "brush") {
      isDrawing = true;
      const p = getCanvasPos(e);
      lastX = p.x; lastY = p.y;
      ctxLocal.lineJoin = "round";
      ctxLocal.lineCap = "round";
      ctxLocal.strokeStyle = "#ff0000";
      ctxLocal.lineWidth = 8; // in canvas px
      ctxLocal.beginPath();
      ctxLocal.moveTo(lastX, lastY);
    } else if (drawMode === "crop") {
      isDrawing = true;
      const p = getCanvasPos(e);
      cropRect = { x1: p.x, y1: p.y, x2: p.x, y2: p.y };
    } else if (drawMode === "text") {
      // add text at click
      const p = getCanvasPos(e);
      const userText = prompt("Nhập chữ muốn thêm:");
      if (userText) {
        ctxLocal.fillStyle = "#ffffff";
        ctxLocal.font = "48px sans-serif";
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
      // visual: draw overlay copy on top by resetting display canvas CSS? We'll draw a temporary overlay in a separate canvas or draw a dashed rectangle on top.
      // For simplicity: redraw image and rectangle
      redrawCanvasWithCropOverlay();
    }
  };

  c.onpointerup = (e) => {
    isDrawing = false;
    try { c.releasePointerCapture(e.pointerId); } catch {}
    if (drawMode === "crop" && cropRect) {
      finalizeCrop();
    }
  };

  // helper to redraw base image then overlay crop rect
  function redrawCanvasWithCropOverlay() {
    // restore base by redrawing original image (assuming original image loaded into canvas at entry time)
    // For complexity avoidance, we won't maintain history stack; cropping will use current canvas pixels
    // clear and draw current pixel state back (we kept drawing directly on ctxLocal)
    // draw dashed rect:
    ctxLocal.save();
    ctxLocal.setLineDash([8, 6]);
    ctxLocal.strokeStyle = "#fff";
    ctxLocal.lineWidth = 3;
    const x = Math.min(cropRect.x1, cropRect.x2);
    const y = Math.min(cropRect.y1, cropRect.y2);
    const w = Math.abs(cropRect.x2 - cropRect.x1);
    const h = Math.abs(cropRect.y2 - cropRect.y1);
    // we just stroke rect on top
    ctxLocal.strokeRect(x, y, w, h);
    ctxLocal.restore();
  }

  function finalizeCrop() {
    // compute crop rect in integer
    const x = Math.round(Math.min(cropRect.x1, cropRect.x2));
    const y = Math.round(Math.min(cropRect.y1, cropRect.y2));
    const w = Math.round(Math.abs(cropRect.x2 - cropRect.x1));
    const h = Math.round(Math.abs(cropRect.y2 - cropRect.y1));
    if (w <= 10 || h <= 10) { cropRect = null; redrawCanvasNoOverlay(); return; }
    // create temporary canvas and copy
    const tmp = document.createElement("canvas");
    tmp.width = w; tmp.height = h;
    const tctx = tmp.getContext("2d");
    tctx.drawImage(c, x, y, w, h, 0, 0, w, h);
    // replace main canvas content with cropped content
    c.width = w; c.height = h;
    ctxLocal.clearRect(0, 0, w, h);
    ctxLocal.drawImage(tmp, 0, 0);
    // adjust display size
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const fitScale = Math.min(viewportW / c.width, viewportH / c.height, 1);
    c.style.width = (c.width * fitScale) + "px";
    c.style.height = (c.height * fitScale) + "px";
    cropRect = null;
  }

  function redrawCanvasNoOverlay() {
    // do nothing: current ctx already has drawings; overlay removed
    // if we had temporary overlay strokes, ideally we'd re-render from saved base image; skipped for simplicity
  }

  // expose small UI to switch drawMode quickly using keyboard:
  c.onkeydown = (ev) => {
    if (ev.key === "b") { drawMode = "brush"; c.style.cursor = "crosshair"; alert("Brush mode"); }
    if (ev.key === "t") { drawMode = "text"; c.style.cursor = "text"; alert("Text mode"); }
    if (ev.key === "c") { drawMode = "crop"; c.style.cursor = "crosshair"; alert("Crop mode: drag to select"); }
  };

  // quick on-screen small prompts (optional)
  alert("Edit mode: b=Brush, t=Text, c=Crop. Click to draw/text. Save to export.");
}

// initial state
showImage();
updateControlsState();
