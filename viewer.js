let fileHandles = [];
let currentIndex = 0;
let zoom = 1, rotation = 0;
let drawingMode = "none";
let isDrawing = false;
let ctx, canvas;
let saveHandle = null;

const img = document.getElementById("image");
const placeholder = document.getElementById("placeholder");
const filenameInput = document.getElementById("filename");
const toast = document.createElement("div");
toast.className = "toast"; document.body.appendChild(toast);

const fileInfoPanel = document.getElementById("fileInfo");
const infoBtn = document.getElementById("info");
const closeInfoBtn = document.getElementById("closeInfo");
const overlay = document.getElementById("overlay");

const infoName = document.getElementById("info-name");
const infoType = document.getElementById("info-type");
const infoSize = document.getElementById("info-size");
const infoMod = document.getElementById("info-mod");
const infoRes = document.getElementById("info-res");

// ===== LaunchQueue =====
if ("launchQueue" in window) {
  launchQueue.setConsumer(async (launchParams) => {
    if (!launchParams.files.length) return;
    fileHandles = launchParams.files;
    currentIndex = 0;
    saveHandle = fileHandles[0];
    showImage();
  });
}

// ===== Show image =====
async function showImage() {
  if (!fileHandles.length) return showError("No image loaded");
  try {
    const file = await fileHandles[currentIndex].getFile();
    if (!file || file.size === 0) return showError("This file is empty");
    if (file.type === "image/gif") return showError("GIF not supported");
    if (!file.type.startsWith("image/")) return showError("Unsupported file");

    const url = URL.createObjectURL(file);
    zoom = 1; rotation = 0;
    img.src = url; img.style.display = "block";
    if (canvas) canvas.style.display = "none";
    placeholder.style.display = "none";
    filenameInput.value = file.name;

    img.onload = () => {
      infoRes.textContent = `${img.naturalWidth}x${img.naturalHeight}`;
    };

    infoName.textContent = file.name;
    infoType.textContent = file.type || "Unknown";
    infoSize.textContent = (file.size / 1024).toFixed(1) + " KB";
    infoMod.textContent = file.lastModified ? new Date(file.lastModified).toLocaleString() : "-";

  } catch (err) {
    console.error(err);
    showError("Failed to load file");
  }
}

function showError(msg) {
  img.style.display = "none";
  if (canvas) canvas.style.display = "none";
  placeholder.style.display = "flex";
  placeholder.innerHTML = `
    <div style="text-align:center">
      <div style="font-size:48px; margin-bottom:12px">🚫</div>
      <p>${msg}</p>
      <button onclick="window.close()">Close app</button>
    </div>
  `;
}

// ===== Controls =====
document.getElementById("zoom-in").onclick = () => { zoom += 0.2; applyTransform(); };
document.getElementById("zoom-out").onclick = () => { zoom = Math.max(0.2, zoom - 0.2); applyTransform(); };
document.getElementById("rotate").onclick = () => { rotation = (rotation + 90) % 360; applyTransform(); };

function applyTransform() {
  img.style.transform = `translate(-50%, -50%) scale(${zoom}) rotate(${rotation}deg)`;
}

// ===== Upload =====
document.getElementById("uploadBtn").onclick = () => document.getElementById("fileInput").click();
document.getElementById("fileInput").onchange = async (e) => {
  if (e.target.files.length) {
    const file = e.target.files[0];
    fileHandles = [await fakeHandle(file)];
    saveHandle = null;
    currentIndex = 0;
    showImage();
  }
};

async function fakeHandle(file) {
  return { getFile: async () => file };
}

// ===== View/Edit mode =====
function enterViewMode() {
  document.body.classList.add("view-mode");
  showToast("View mode");
  if (canvas) canvas.style.display = "none";
  img.style.display = "block";
}

function enterEditMode() {
  document.body.classList.remove("view-mode");
  showToast("Edit mode");
  setupCanvas();
  img.style.display = "none";
  canvas.style.display = "block";
}

document.getElementById("view").onclick = enterViewMode;
document.getElementById("edit").onclick = enterEditMode;

// ===== Panning (chỉ trong View) =====
let isPanning = false, startX, startY, offsetX = 0, offsetY = 0;
img.addEventListener("mousedown", (e) => {
  if (document.body.classList.contains("view-mode")) {
    isPanning = true;
    startX = e.clientX - offsetX;
    startY = e.clientY - offsetY;
  }
});
window.addEventListener("mousemove", (e) => {
  if (isPanning) {
    offsetX = e.clientX - startX;
    offsetY = e.clientY - startY;
    img.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px)) scale(${zoom}) rotate(${rotation}deg)`;
  }
});
window.addEventListener("mouseup", () => isPanning = false);

// ===== Canvas =====
function setupCanvas() {
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.className = "edit-canvas";
    document.getElementById("stage").appendChild(canvas);
    ctx = canvas.getContext("2d");
    bindCanvas();
  }
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  ctx.drawImage(img, 0, 0);
}

function bindCanvas() {
  canvas.addEventListener("mousedown", (e) => {
    if (drawingMode === "brush") {
      isDrawing = true;
      ctx.strokeStyle = document.getElementById("color").value;
      ctx.lineWidth = document.getElementById("brushSize").value;
      ctx.beginPath();
      ctx.moveTo(e.offsetX, e.offsetY);
    } else if (drawingMode === "crop") {
      isDrawing = true;
      canvas.cropX = e.offsetX;
      canvas.cropY = e.offsetY;
    }
  });

  canvas.addEventListener("mousemove", (e) => {
    if (isDrawing && drawingMode === "brush") {
      ctx.lineTo(e.offsetX, e.offsetY);
      ctx.stroke();
    }
  });

  canvas.addEventListener("mouseup", (e) => {
    if (drawingMode === "brush") {
      isDrawing = false;
    } else if (drawingMode === "crop") {
      const w = e.offsetX - canvas.cropX;
      const h = e.offsetY - canvas.cropY;
      const data = ctx.getImageData(canvas.cropX, canvas.cropY, w, h);
      canvas.width = w; canvas.height = h;
      ctx.putImageData(data, 0, 0);
      isDrawing = false;
      showToast("Cropped");
    }
  });

  canvas.addEventListener("click", (e) => {
    if (drawingMode === "text") {
      const t = prompt("Enter text:");
      if (t) {
        ctx.fillStyle = document.getElementById("color").value;
        ctx.font = `${document.getElementById("textSize").value}px sans-serif`;
        ctx.fillText(t, e.offsetX, e.offsetY);
      }
    }
  });
}

// ===== Tools =====
document.getElementById("brush").onclick = () => { setupCanvas(); drawingMode = "brush"; showToast("Brush mode"); };
document.getElementById("text").onclick = () => { setupCanvas(); drawingMode = "text"; showToast("Text mode"); };
document.getElementById("crop").onclick = () => { setupCanvas(); drawingMode = "crop"; showToast("Crop mode"); };

// ===== Save =====
document.getElementById("save").onclick = async () => {
  if (!canvas) return showToast("Nothing to save");
  showSavingPopup();
  try {
    if (saveHandle && saveHandle.createWritable) {
      const writable = await saveHandle.createWritable();
      await writable.write(await new Promise(r => canvas.toBlob(r)));
      await writable.close();
      hideSavingPopup("Saved ✅");
    } else {
      downloadCanvas(filenameInput.value);
      hideSavingPopup("Downloaded ✅");
    }
  } catch {
    hideSavingPopup("Save failed ❌");
  }
};

document.getElementById("saveAs").onclick = () => {
  if (!canvas) return showToast("Nothing to save");
  downloadCanvas("edited-" + filenameInput.value);
};

function downloadCanvas(name) {
  const link = document.createElement("a");
  link.download = name;
  canvas.toBlob((blob) => {
    link.href = URL.createObjectURL(blob);
    link.click();
  });
}

// ===== Info =====
infoBtn.onclick = () => { fileInfoPanel.classList.toggle("hidden"); overlay.classList.toggle("show"); };
closeInfoBtn.onclick = () => { fileInfoPanel.classList.add("hidden"); overlay.classList.remove("show"); };
overlay.onclick = () => { fileInfoPanel.classList.add("hidden"); overlay.classList.remove("show"); };
window.addEventListener("keydown", (e) => { if (e.key === "Escape") { fileInfoPanel.classList.add("hidden"); overlay.classList.remove("show"); } });

// ===== Rename =====
filenameInput.addEventListener("dblclick", () => { filenameInput.removeAttribute("readonly"); filenameInput.focus(); });
filenameInput.addEventListener("blur", () => { filenameInput.setAttribute("readonly", true); });

// ===== Toast =====
function showToast(msg) {
  toast.textContent = msg;
  toast.style.display = "block";
  setTimeout(() => toast.style.display = "none", 2000);
}

// ===== Saving Popup =====
function showSavingPopup() { toast.textContent = "Saving..."; toast.style.display = "block"; }
function hideSavingPopup(msg) { toast.textContent = msg; setTimeout(() => toast.style.display = "none", 2000); }
