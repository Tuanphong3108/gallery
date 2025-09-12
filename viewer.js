let fileHandles = [];
let currentIndex = 0;
let zoom = 1;
let rotation = 0;
let history = [];
let redoStack = [];

const img = document.getElementById("image");
const filenameInput = document.getElementById("filename");
const placeholder = document.getElementById("placeholder");
const fileInput = document.getElementById("file-input");

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");

let drawing = false;
let brushColor = "#ff0000";
let brushSize = 5;
let cropping = false;
let cropStart = null;

let mode = "none"; // "none", "pen", "crop", "view"
let isPanning = false;
let panStart = { x: 0, y: 0 };
let panOffset = { x: 0, y: 0 };

let pendingFilename = null;
let previewDataUrl = null;

// Hiển thị ảnh (reset pan, center)
async function showImage(file) {
  const bitmap = await createImageBitmap(file);

  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);

  img.src = canvas.toDataURL();
  img.style.display = "block";

  // reset pan/zoom/rotation
  zoom = 1;
  rotation = 0;
  panOffset = { x: 0, y: 0 };
  centerImage();

  filenameInput.value = file.name;
  placeholder.style.display = "none";

  saveHistory();
}

// Căn giữa ảnh
function centerImage() {
  img.style.transform = `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom}) rotate(${rotation}deg)`;
}

// Lưu lịch sử để undo/redo
function saveHistory() {
  history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  if (history.length > 20) history.shift();
  redoStack = [];
}

function undo() {
  if (history.length > 1) {
    redoStack.push(history.pop());
    ctx.putImageData(history[history.length - 1], 0, 0);
    img.src = canvas.toDataURL();
  }
}

function redo() {
  if (redoStack.length) {
    const state = redoStack.pop();
    history.push(state);
    ctx.putImageData(state, 0, 0);
    img.src = canvas.toDataURL();
  }
}

// Render ảnh cuối cùng với rotation vào dataURL
function getFinalDataUrl() {
  const tempCanvas = document.createElement("canvas");
  const angleRad = rotation * Math.PI / 180;

  let newW = Math.abs(canvas.width * Math.cos(angleRad)) + Math.abs(canvas.height * Math.sin(angleRad));
  let newH = Math.abs(canvas.width * Math.sin(angleRad)) + Math.abs(canvas.height * Math.cos(angleRad));

  tempCanvas.width = newW;
  tempCanvas.height = newH;
  const tempCtx = tempCanvas.getContext("2d");

  tempCtx.translate(newW / 2, newH / 2);
  tempCtx.rotate(angleRad);
  tempCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);

  return tempCanvas.toDataURL();
}

// Preview Save
function saveFile() {
  if (!fileHandles.length) return alert("No file!");
  pendingFilename = filenameInput.value || "image.png";
  showPreview(true);
}

function saveFileAs() {
  if (!fileHandles.length) return alert("No file!");
  pendingFilename = filenameInput.value || "edited.png";
  showPreview(false);
}

function showPreview(overwrite) {
  previewDataUrl = getFinalDataUrl();
  document.getElementById("previewImg").src = previewDataUrl;

  if (overwrite && fileHandles[currentIndex].createWritable) {
    document.getElementById("previewNote").textContent =
      "This will overwrite the original file.";
  } else {
    document.getElementById("previewNote").textContent =
      "This will download a new file.";
  }

  document.getElementById("previewPopup").style.display = "flex";
}

async function confirmSave() {
  if (fileHandles.length && fileHandles[currentIndex].createWritable) {
    try {
      const fileHandle = fileHandles[currentIndex];
      const writable = await fileHandle.createWritable();
      await writable.write(await (await fetch(previewDataUrl)).blob());
      await writable.close();
      alert("File overwritten successfully!");
    } catch (e) {
      console.error("Save failed:", e);
      alert("Save failed, try Save As.");
    }
  } else {
    const link = document.createElement("a");
    link.download = pendingFilename;
    link.href = previewDataUrl;
    link.click();
  }
  cancelSave();
}

function cancelSave() {
  document.getElementById("previewPopup").style.display = "none";
  pendingFilename = null;
  previewDataUrl = null;
}

// Controls
document.getElementById("zoom-in").onclick = () => { zoom += 0.2; centerImage(); };
document.getElementById("zoom-out").onclick = () => { zoom = Math.max(0.2, zoom - 0.2); centerImage(); };
document.getElementById("rotate").onclick = () => { rotation = (rotation + 90) % 360; centerImage(); };

document.getElementById("undo").onclick = undo;
document.getElementById("redo").onclick = redo;
document.getElementById("save").onclick = saveFile;
document.getElementById("save-as").onclick = saveFileAs;

document.getElementById("brush-color").oninput = e => { brushColor = e.target.value; mode = "pen"; };
document.getElementById("brush-size").oninput = e => { brushSize = e.target.value; mode = "pen"; };
document.getElementById("crop").onclick = () => { mode = "crop"; };
document.getElementById("view").onclick = () => { mode = "view"; };

// Upload fallback
document.getElementById("upload").onclick = () => fileInput.click();
fileInput.onchange = () => {
  const files = Array.from(fileInput.files);
  if (!files.length) return;
  fileHandles = files.map(f => ({ getFile: async () => f }));
  currentIndex = 0;
  showImage(files[0]);
};

// File Handling API
if ("launchQueue" in window) {
  launchQueue.setConsumer(async (launchParams) => {
    if (!launchParams.files.length) return;
    fileHandles = launchParams.files;
    currentIndex = 0;
    const file = await fileHandles[0].getFile();
    showImage(file);
  });
}
