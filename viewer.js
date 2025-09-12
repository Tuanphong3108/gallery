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
let cropRect = null;

// Hiển thị ảnh
async function showImage(file) {
  const bitmap = await createImageBitmap(file);

  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);

  img.src = canvas.toDataURL();
  img.style.display = "block";
  img.style.transform = `scale(${zoom}) rotate(${rotation}deg)`;

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

// Save trực tiếp (ghi file)
async function saveFile() {
  if (!fileHandles.length) return;
  const fileHandle = fileHandles[currentIndex];
  try {
    const writable = await fileHandle.createWritable();
    await writable.write(await (await fetch(canvas.toDataURL())).blob());
    await writable.close();
    alert("Saved!");
  } catch (e) {
    console.error("Save failed:", e);
    alert("Save failed, try Save As.");
  }
}

// Save As
async function saveFileAs() {
  try {
    const handle = await showSaveFilePicker({
      types: [{ description: "Image file", accept: { "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"] } }]
    });
    const writable = await handle.createWritable();
    await writable.write(await (await fetch(canvas.toDataURL())).blob());
    await writable.close();
    alert("Saved As!");
  } catch (e) {
    console.error("Save As canceled or failed:", e);
  }
}

// Brush
img.addEventListener("mousedown", e => {
  if (!drawing && !cropping) {
    drawing = true;
    ctx.beginPath();
    ctx.moveTo(e.offsetX, e.offsetY);
  } else if (cropping) {
    cropStart = { x: e.offsetX, y: e.offsetY };
  }
});

img.addEventListener("mousemove", e => {
  if (drawing && !cropping) {
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.stroke();
    img.src = canvas.toDataURL();
  }
});

img.addEventListener("mouseup", e => {
  if (drawing) {
    drawing = false;
    saveHistory();
  } else if (cropping && cropStart) {
    const w = e.offsetX - cropStart.x;
    const h = e.offsetY - cropStart.y;
    const cropped = ctx.getImageData(cropStart.x, cropStart.y, w, h);
    canvas.width = Math.abs(w);
    canvas.height = Math.abs(h);
    ctx.putImageData(cropped, 0, 0);
    img.src = canvas.toDataURL();
    saveHistory();
    cropping = false;
  }
});

// Controls
document.getElementById("zoom-in").onclick = () => { zoom += 0.2; img.style.transform = `scale(${zoom}) rotate(${rotation}deg)`; };
document.getElementById("zoom-out").onclick = () => { zoom = Math.max(0.2, zoom - 0.2); img.style.transform = `scale(${zoom}) rotate(${rotation}deg)`; };
document.getElementById("rotate").onclick = () => { rotation = (rotation + 90) % 360; img.style.transform = `scale(${zoom}) rotate(${rotation}deg)`; };

document.getElementById("undo").onclick = undo;
document.getElementById("redo").onclick = redo;
document.getElementById("save").onclick = saveFile;
document.getElementById("save-as").onclick = saveFileAs;
document.getElementById("brush-color").oninput = e => brushColor = e.target.value;
document.getElementById("brush-size").oninput = e => brushSize = e.target.value;
document.getElementById("crop").onclick = () => { cropping = true; };

// Upload fallback
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
