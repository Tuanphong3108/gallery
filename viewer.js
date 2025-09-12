let fileHandles = [];
let currentIndex = 0;
let zoom = 1;
let rotation = 0;
let history = [];
let redoStack = [];

const img = document.getElementById("image");
const filenameLabel = document.getElementById("filename");
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

// Hiển thị ảnh
async function showImage(file) {
  const bitmap = await createImageBitmap(file);

  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);

  img.src = canvas.toDataURL();
  img.style.display = "block";
  img.style.transform = `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom}) rotate(${rotation}deg)`;

  filenameLabel.textContent = file.name;
  placeholder.style.display = "none";

  saveHistory();
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

// Preview Save
function saveFile() {
  if (!fileHandles.length) return alert("No file!");
  pendingFilename = filenameLabel.textContent;
  showPreview(true);
}

function saveFileAs() {
  if (!fileHandles.length) return alert("No file!");
  pendingFilename = "edited_" + filenameLabel.textContent;
  showPreview(false);
}

function showPreview(overwrite) {
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext("2d");

  tempCtx.drawImage(canvas, 0, 0);
  previewDataUrl = tempCanvas.toDataURL();

  document.getElementById("previewImg").src = previewDataUrl;

  // Thông báo mode
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
    // Ghi đè file gốc
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
    // Fallback: tải file mới
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

// Mouse events
img.addEventListener("mousedown", e => {
  if (mode === "pen") {
    drawing = true;
    ctx.beginPath();
    ctx.moveTo(e.offsetX, e.offsetY);
  } else if (mode === "crop") {
    cropping = true;
    cropStart = { x: e.offsetX, y: e.offsetY };
  } else if (mode === "view") {
    isPanning = true;
    panStart = { x: e.clientX, y: e.clientY };
  }
});

img.addEventListener("mousemove", e => {
  if (mode === "pen" && drawing) {
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.stroke();
    img.src = canvas.toDataURL();
  } else if (mode === "view" && isPanning) {
    let dx = e.clientX - panStart.x;
    let dy = e.clientY - panStart.y;
    panOffset.x += dx;
    panOffset.y += dy;
    img.style.transform = `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom}) rotate(${rotation}deg)`;
    panStart = { x: e.clientX, y: e.clientY };
  }
});

img.addEventListener("mouseup", e => {
  if (mode === "pen" && drawing) {
    drawing = false;
    saveHistory();
  } else if (mode === "crop" && cropping && cropStart) {
    const w = e.offsetX - cropStart.x;
    const h = e.offsetY - cropStart.y;
    const cropped = ctx.getImageData(cropStart.x, cropStart.y, w, h);
    canvas.width = Math.abs(w);
    canvas.height = Math.abs(h);
    ctx.putImageData(cropped, 0, 0);
    img.src = canvas.toDataURL();
    saveHistory();
    cropping = false;
  } else if (mode === "view" && isPanning) {
    isPanning = false;
  }
});

// Controls
document.getElementById("zoom-in").onclick = () => {
  zoom += 0.2;
  img.style.transform = `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom}) rotate(${rotation}deg)`;
};
document.getElementById("zoom-out").onclick = () => {
  zoom = Math.max(0.2, zoom - 0.2);
  img.style.transform = `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom}) rotate(${rotation}deg)`;
};
document.getElementById("rotate").onclick = () => {
  rotation = (rotation + 90) % 360;
  img.style.transform = `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom}) rotate(${rotation}deg)`;
};

document.getElementById("undo").onclick = undo;
document.getElementById("redo").onclick = redo;
document.getElementById("save").onclick = saveFile;
document.getElementById("save-as").onclick = saveFileAs;

document.getElementById("brush-color").oninput = e => {
  brushColor = e.target.value;
  mode = "pen";
};
document.getElementById("brush-size").oninput = e => {
  brushSize = e.target.value;
  mode = "pen";
};
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
