let fileHandles = [];
let currentIndex = 0;
let zoom = 1;
let rotation = 0;
let drawingMode = "none"; // none | brush | text | crop | view
let ctx, canvas, tempImage;
let saveHandle = null;

const img = document.getElementById("image");
const placeholder = document.getElementById("placeholder");
const filenameInput = document.getElementById("filename");
const toolbar = document.getElementById("controls");
const toast = document.createElement("div");
toast.className = "toast";
document.body.appendChild(toast);

// LaunchQueue cho File Handling API
if ("launchQueue" in window) {
  launchQueue.setConsumer(async (launchParams) => {
    if (!launchParams.files.length) return;
    fileHandles = launchParams.files;
    currentIndex = 0;
    saveHandle = fileHandles[0];
    showImage();
  });
}

// ==================== Hiển thị ảnh ====================
async function showImage() {
  if (!fileHandles.length) {
    showError("No image loaded");
    return;
  }

  try {
    const file = await fileHandles[currentIndex].getFile();
    if (!file || file.size === 0) {
      showError("This file is empty");
      return;
    }
    if (file.type === "image/gif") {
      showError("GIF files are not supported right now");
      return;
    }
    if (!file.type.startsWith("image/")) {
      showError("Unsupported file type");
      return;
    }

    const url = URL.createObjectURL(file);
    zoom = 1; rotation = 0;

    img.src = url;
    img.style.display = "block";
    img.style.transform = `translate(-50%, -50%) scale(${zoom}) rotate(${rotation}deg)`;

    placeholder.style.display = "none";
    filenameInput.value = file.name;

  } catch (err) {
    console.error(err);
    showError("Failed to load file");
  }
}

// ==================== Hiển thị lỗi ====================
function showError(message) {
  img.style.display = "none";
  placeholder.style.display = "flex";
  placeholder.innerHTML = `
    <div style="text-align:center">
      <div style="font-size:48px; margin-bottom:12px">🚫</div>
      <p>${message}</p>
      <button onclick="window.close()">Close app</button>
    </div>
  `;
}

// ==================== Zoom / Rotate ====================
document.getElementById("zoom-in").onclick = () => {
  zoom += 0.2;
  applyTransform();
};
document.getElementById("zoom-out").onclick = () => {
  zoom = Math.max(0.2, zoom - 0.2);
  applyTransform();
};
document.getElementById("rotate").onclick = () => {
  rotation = (rotation + 90) % 360;
  applyTransform();
};

function applyTransform() {
  img.style.transform = `translate(-50%, -50%) scale(${zoom}) rotate(${rotation}deg)`;
}

// ==================== Upload file ====================
document.getElementById("uploadBtn").onclick = () => {
  document.getElementById("fileInput").click();
};
document.getElementById("fileInput").onchange = async (e) => {
  if (e.target.files.length) {
    const file = e.target.files[0];
    fileHandles = [await getFileHandleFromFile(file)];
    saveHandle = null;
    currentIndex = 0;
    showImage();
  }
};
async function getFileHandleFromFile(file) {
  return {
    getFile: async () => file,
    createWritable: async () => ({
      write: async (data) => console.log("Writing fake:", data),
      close: async () => console.log("Closed fake handle"),
    }),
  };
}

// ==================== View mode ====================
document.getElementById("view").onclick = () => {
  drawingMode = "view";
  document.body.classList.add("view-mode");
  showToast("View mode enabled");
};
document.getElementById("edit").onclick = () => {
  drawingMode = "none";
  document.body.classList.remove("view-mode");
  showToast("Edit mode enabled");
};

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

// ==================== Brush ====================
document.getElementById("brush").onclick = () => {
  setupCanvas();
  drawingMode = "brush";
  showToast("Brush mode");
};

function setupCanvas() {
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.className = "edit-canvas";
    document.getElementById("stage").appendChild(canvas);
    ctx = canvas.getContext("2d");
  }
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  ctx.drawImage(img, 0, 0);
}

canvas?.addEventListener("mousedown", (e) => {
  if (drawingMode === "brush") {
    isDrawing = true;
    ctx.strokeStyle = document.getElementById("color").value;
    ctx.lineWidth = document.getElementById("brushSize").value;
    ctx.beginPath();
    ctx.moveTo(e.offsetX, e.offsetY);
  }
});
canvas?.addEventListener("mousemove", (e) => {
  if (isDrawing && drawingMode === "brush") {
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();
  }
});
canvas?.addEventListener("mouseup", () => isDrawing = false);

// ==================== Text ====================
document.getElementById("text").onclick = () => {
  setupCanvas();
  drawingMode = "text";
  showToast("Text mode: click to add");
};
canvas?.addEventListener("click", (e) => {
  if (drawingMode === "text") {
    const text = prompt("Enter text:");
    if (text) {
      ctx.fillStyle = document.getElementById("color").value;
      ctx.font = `${document.getElementById("textSize").value}px sans-serif`;
      ctx.fillText(text, e.offsetX, e.offsetY);
    }
  }
});

// ==================== Crop ====================
document.getElementById("crop").onclick = () => {
  setupCanvas();
  drawingMode = "crop";
  showToast("Crop mode: drag to select");
};
let cropStartX, cropStartY, cropW, cropH;
canvas?.addEventListener("mousedown", (e) => {
  if (drawingMode === "crop") {
    cropStartX = e.offsetX;
    cropStartY = e.offsetY;
    isDrawing = true;
  }
});
canvas?.addEventListener("mouseup", (e) => {
  if (drawingMode === "crop") {
    cropW = e.offsetX - cropStartX;
    cropH = e.offsetY - cropStartY;
    const imgData = ctx.getImageData(cropStartX, cropStartY, cropW, cropH);
    canvas.width = cropW;
    canvas.height = cropH;
    ctx.putImageData(imgData, 0, 0);
    isDrawing = false;
    showToast("Cropped");
  }
});

// ==================== Save ====================
document.getElementById("save").onclick = async () => {
  if (!canvas) { showToast("Nothing to save"); return; }
  showSavingPopup();
  try {
    if (saveHandle && saveHandle.createWritable) {
      const writable = await saveHandle.createWritable();
      await writable.write(await new Promise(r => canvas.toBlob(r)));
      await writable.close();
      hideSavingPopup("Saved successfully ✅");
    } else {
      downloadCanvas(filenameInput.value);
      hideSavingPopup("Downloaded ✅");
    }
  } catch (e) {
    hideSavingPopup("Save failed ❌");
  }
};
document.getElementById("saveAs").onclick = () => {
  if (!canvas) { showToast("Nothing to save"); return; }
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

// ==================== Helpers ====================
function showToast(msg) {
  toast.textContent = msg;
  toast.style.display = "block";
  setTimeout(() => toast.style.display = "none", 2000);
}
function showSavingPopup() {
  toast.textContent = "Saving...";
  toast.style.display = "block";
}
function hideSavingPopup(msg) {
  toast.textContent = msg;
  setTimeout(() => toast.style.display = "none", 2000);
}
