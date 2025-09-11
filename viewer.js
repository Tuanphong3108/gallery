let fileHandles = [];
let currentIndex = 0;
let zoom = 1;
let rotation = 0;
let history = [];
let redoStack = [];

const img = document.getElementById("image");
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
let drawing = false;
let brushColor = "#ff0000";
let brushSize = 5;

// Hiển thị ảnh
async function showImage() {
  if (!fileHandles.length) return;
  const file = await fileHandles[currentIndex].getFile();
  const bitmap = await createImageBitmap(file);

  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  ctx.drawImage(bitmap, 0, 0);

  img.src = canvas.toDataURL();
  img.style.transform = `scale(${zoom}) rotate(${rotation}deg)`;

  saveHistory(); // lưu state đầu tiên
}

// Lưu lịch sử để undo
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

// Save trực tiếp
async function saveFile() {
  if (!fileHandles.length) return;
  const fileHandle = fileHandles[currentIndex];
  const writable = await fileHandle.createWritable();
  await writable.write(await (await fetch(canvas.toDataURL())).blob());
  await writable.close();
  alert("Saved!");
}

// Save As
async function saveFileAs() {
  const handle = await showSaveFilePicker({
    types: [
      {
        description: "Image file",
        accept: { "image/png": [".png"], "image/jpeg": [".jpg"] }
      }
    ]
  });
  const writable = await handle.createWritable();
  await writable.write(await (await fetch(canvas.toDataURL())).blob());
  await writable.close();
  alert("Saved As!");
}

// Edit: vẽ brush
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

// File Handling API
if ("launchQueue" in window) {
  launchQueue.setConsumer(async (launchParams) => {
    if (!launchParams.files.length) return;
    fileHandles = launchParams.files;
    currentIndex = 0;
    showImage();
  });
}
