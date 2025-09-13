let fileHandles = [];
let currentIndex = 0;
let zoom = 1;
let rotation = 0;
let drawingMode = "none";
let isDrawing = false;
let ctx, canvas;
let saveHandle = null;

const img = document.getElementById("image");
const stage = document.getElementById("stage");
const placeholder = document.getElementById("placeholder");
const filenameInput = document.getElementById("filename");
const toast = document.createElement("div");
toast.className = "toast";
document.body.appendChild(toast);

const fileInfoPanel = document.getElementById("fileInfo");
const infoBtn = document.getElementById("info");
const infoName = document.getElementById("info-name");
const infoType = document.getElementById("info-type");
const infoSize = document.getElementById("info-size");
const infoMod = document.getElementById("info-mod");

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
    if (file.type === "image/gif") return showError("GIF files are not supported right now");
    if (!file.type.startsWith("image/")) return showError("Unsupported file type");

    const url = URL.createObjectURL(file);
    zoom = 1; rotation = 0;
    img.src = url;
    img.style.display = "block";
    img.style.transform = `translate(-50%, -50%) scale(${zoom}) rotate(${rotation}deg)`;
    placeholder.style.display = "none";
    filenameInput.value = file.name;

    // 🆕 Update file info
    infoName.textContent = file.name;
    infoType.textContent = file.type || "Unknown";
    infoSize.textContent = (file.size / 1024).toFixed(1) + " KB";
    infoMod.textContent = file.lastModified ? new Date(file.lastModified).toLocaleString() : "-";

  } catch (err) {
    console.error(err);
    showError("Failed to load file");
  }
}

// ===== Error =====
function showError(message) {
  img.style.display = "none";
  if (canvas) canvas.style.display = "none";
  placeholder.style.display = "flex";
  placeholder.innerHTML = `
    <div style="text-align:center">
      <div style="font-size:48px; margin-bottom:12px">🚫</div>
      <p>${message}</p>
      <button onclick="window.close()">Close app</button>
    </div>
  `;
}

// ===== Controls =====
document.getElementById("zoom-in").onclick = () => { zoom += 0.2; applyTransform(); };
document.getElementById("zoom-out").onclick = () => { zoom = Math.max(0.2, zoom - 0.2); applyTransform(); };
document.getElementById("rotate").onclick = () => { rotation = (rotation + 90) % 360; applyTransform(); };

function applyTransform() {
  const transform = `translate(-50%, -50%) scale(${zoom}) rotate(${rotation}deg)`;
  img.style.transform = transform;
  if (canvas && canvas.classList.contains("show")) {
    canvas.style.transform = transform;
  }
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
  return {
    getFile: async () => file,
    createWritable: async () => ({
      write: async (d) => console.log("Fake write:", d),
      close: async () => console.log("Fake close")
    })
  };
}

// ===== View/Edit mode =====
document.getElementById("view").onclick = () => {
  drawingMode = "view";
  document.body.classList.add("view-mode");
  if (canvas) canvas.classList.remove("show");
  img.style.display = "block";
  showToast("View mode enabled");
};
document.getElementById("edit").onclick = () => {
  drawingMode = "none";
  document.body.classList.remove("view-mode");
  setupCanvas();
  canvas.classList.add("show");
  img.style.display = "none"; // hide img when editing
  showToast("Edit mode enabled");
};

// ===== Panning (View mode) =====
let isPanning = false, startPanX, startPanY, offsetX = 0, offsetY = 0;
img.addEventListener("mousedown", (e) => {
  if (drawingMode === "view") {
    isPanning = true;
    startPanX = e.clientX - offsetX;
    startPanY = e.clientY - offsetY;
  }
});
window.addEventListener("mousemove", (e) => {
  if (isPanning) {
    offsetX = e.clientX - startPanX;
    offsetY = e.clientY - startPanY;
    img.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px)) scale(${zoom}) rotate(${rotation}deg)`;
  }
});
window.addEventListener("mouseup", () => isPanning = false);

// ===== Canvas setup =====
function setupCanvas() {
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.className = "edit-canvas";
    stage.appendChild(canvas);
    ctx = canvas.getContext("2d");
    bindCanvasEvents();
  }
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  ctx.drawImage(img, 0, 0);
  canvas.style.display = "block";
}

// ===== Brush =====
document.getElementById("brush").onclick = () => { setupCanvas(); drawingMode = "brush"; showToast("Brush mode"); };

// ===== Text =====
document.getElementById("text").onclick = () => { setupCanvas(); drawingMode = "text"; showToast("Text mode"); };

// ===== Crop =====
document.getElementById("crop").onclick = () => { setupCanvas(); drawingMode = "crop"; showToast("Crop mode"); };

// ===== Canvas events =====
function bindCanvasEvents() {
  canvas.addEventListener("mousedown", (e) => {
    if (drawingMode === "brush") {
      isDrawing = true;
      ctx.strokeStyle = document.getElementById("color").value;
      ctx.lineWidth = document.getElementById("brushSize").value;
      ctx.beginPath();
      ctx.moveTo(e.offsetX, e.offsetY);
    } else if (drawingMode === "crop") {
      isDrawing = true;
      this.cropStartX = e.offsetX;
      this.cropStartY = e.offsetY;
    }
  });
  canvas.addEventListener("mousemove", (e) => {
    if (isDrawing && drawingMode === "brush") {
      ctx.lineTo(e.offsetX, e.offsetY);
      ctx.stroke();
    }
  });
  canvas.addEventListener("mouseup", (e) => {
    if (drawingMode === "brush") isDrawing = false;
    else if (drawingMode === "crop") {
      const cropW = e.offsetX - this.cropStartX;
      const cropH = e.offsetY - this.cropStartY;
      const imgData = ctx.getImageData(this.cropStartX, this.cropStartY, cropW, cropH);
      canvas.width = cropW; canvas.height = cropH;
      ctx.putImageData(imgData, 0, 0);
      isDrawing = false;
      showToast("Cropped");
    }
  });
  canvas.addEventListener("click", (e) => {
    if (drawingMode === "text") {
      const text = prompt("Enter text:");
      if (text) {
        ctx.fillStyle = document.getElementById("color").value;
        ctx.font = `${document.getElementById("textSize").value}px sans-serif`;
        ctx.fillText(text, e.offsetX, e.offsetY);
      }
    }
  });
}

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
  } catch { hideSavingPopup("Save failed ❌"); }
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

// ===== Toast =====
function showToast(msg) {
  toast.textContent = msg;
  toast.style.display = "block";
  setTimeout(() => toast.style.display = "none", 2000);
}
function showSavingPopup() { toast.textContent = "Saving..."; toast.style.display = "block"; }
function hideSavingPopup(msg) {
  toast.textContent = msg;
  setTimeout(() => toast.style.display = "none", 2000);
}

// ===== File Info toggle =====
infoBtn.onclick = () => fileInfoPanel.classList.toggle("show");
