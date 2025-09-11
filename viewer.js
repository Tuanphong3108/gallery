let fileHandles = [];
let currentIndex = 0;
let zoom = 1;
let rotation = 0;
let history = [];
let redoStack = [];
let cropping = false;
let cropStart = null;
let cropRect = null;

const img = document.getElementById("image");
const filenameLabel = document.getElementById("filename");
const upload = document.getElementById("upload");
const fileInput = document.getElementById("file-input");

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
let drawing = false;
let brushColor = "#ff0000";
let brushSize = 5;

const overlay = document.createElement("div");
overlay.style.position = "absolute";
overlay.style.border = "2px dashed #0f0";
overlay.style.pointerEvents = "none";
document.getElementById("viewer").appendChild(overlay);

// Hiển thị ảnh
async function showImage() {
  if (!fileHandles.length) return;

  const file = await fileHandles[currentIndex].getFile();
  const bitmap = await createImageBitmap(file);

  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);

  img.src = canvas.toDataURL();
  img.style.display = "block";
  img.style.transform = `scale(${zoom}) rotate(${rotation}deg)`;

  filenameLabel.textContent = file.name;
  upload.style.display = "none";

  saveHistory(); // lưu trạng thái đầu
}

// Lịch sử để undo/redo
function saveHistory() {
  history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  if (history.length > 20) history.shift(); // giữ 20 bước
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

// Save trực tiếp
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
      types: [
        {
          description: "Image file",
          accept: { "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"] }
        }
      ]
    });
    const writable = await handle.createWritable();
    await writable.write(await (await fetch(canvas.toDataURL())).blob());
    await writable.close();
    alert("Saved As!");
  } catch (e) {
    console.error("Save As canceled or failed:", e);
  }
}

// Brush vẽ
img.addEventListener("mousedown", e => {
  drawing = true;
  ctx.beginPath();
  ctx.moveTo(e.offsetX, e.offsetY);
});
img.addEventListener("mousemove", e => {
  if (!drawing) return;
  ctx.lineTo(e.offsetX, e.offsetY);
  ctx.strokeStyle = brushColor;
  ctx.lineWidth = brushSize;
  ctx.lineCap = "round";
  ctx.stroke();
  img.src = canvas.toDataURL();
});
img.addEventListener("mouseup", () => {
  if (drawing) {
    drawing = false;
    saveHistory();
  }
});

// Controls
document.getElementById("zoom-in").onclick = () => { zoom += 0.2; showImage(); };
document.getElementById("zoom-out").onclick = () => { zoom = Math.max(0.2, zoom - 0.2); showImage(); };
document.getElementById("rotate").onclick = () => { rotation = (rotation + 90) % 360; showImage(); };

document.getElementById("undo").onclick = undo;
document.getElementById("redo").onclick = redo;
document.getElementById("save").onclick = saveFile;
document.getElementById("save-as").onclick = saveFileAs;
document.getElementById("brush-color").oninput = e => brushColor = e.target.value;
document.getElementById("brush-size").oninput = e => brushSize = e.target.value;

// Upload fallback (nếu không mở qua File Handling API)
fileInput.onchange = () => {
  fileHandles = Array.from(fileInput.files).map(f => ({
    getFile: async () => f
  }));
  currentIndex = 0;
  showImage();
};

// File Handling API (ChromeOS / Edge / Windows)
if ("launchQueue" in window) {
  launchQueue.setConsumer(async (launchParams) => {
    if (!launchParams.files.length) return;
    fileHandles = launchParams.files;
    currentIndex = 0;
    showImage();
  });
}


// Bật chế độ crop
document.getElementById("crop").onclick = () => {
  cropping = !cropping;
  overlay.style.display = cropping ? "block" : "none";
  if (!cropping) {
    overlay.style.width = "0";
    overlay.style.height = "0";
  }
};

// Khi click chuột để chọn vùng crop
img.addEventListener("mousedown", e => {
  if (cropping) {
    cropStart = { x: e.offsetX, y: e.offsetY };
    overlay.style.left = `${e.offsetX}px`;
    overlay.style.top = `${e.offsetY}px`;
    overlay.style.width = "0";
    overlay.style.height = "0";
  }
});

// Kéo chuột để vẽ khung crop
img.addEventListener("mousemove", e => {
  if (cropping && cropStart) {
    const x = Math.min(cropStart.x, e.offsetX);
    const y = Math.min(cropStart.y, e.offsetY);
    const w = Math.abs(cropStart.x - e.offsetX);
    const h = Math.abs(cropStart.y - e.offsetY);

    overlay.style.left = `${x}px`;
    overlay.style.top = `${y}px`;
    overlay.style.width = `${w}px`;
    overlay.style.height = `${h}px`;

    cropRect = { x, y, w, h };
  }
});

// Thả chuột để xác nhận crop
img.addEventListener("mouseup", () => {
  if (cropping && cropRect) {
    const { x, y, w, h } = cropRect;
    const cropped = ctx.getImageData(x, y, w, h);

    canvas.width = w;
    canvas.height = h;
    ctx.putImageData(cropped, 0, 0);

    img.src = canvas.toDataURL();
    saveHistory();

    overlay.style.width = "0";
    overlay.style.height = "0";
    cropping = false;
    cropRect = null;
  }
});
