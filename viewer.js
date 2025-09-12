let fileHandles = [];
let currentIndex = 0;
let zoom = 1;
let rotation = 0;
let scale = 1;
let isDrawing = false;
let drawingMode = "none"; // none, brush, text, crop
let brushColor = "#ff0000";
let brushSize = 5;
let textColor = "#000000";
let textSize = 24;
let previewDataUrl = "";
let pendingFilename = "";

const img = document.getElementById("image");
const filenameInput = document.getElementById("filename");
const savingStatus = document.getElementById("savingStatus");

// LaunchQueue cho File Handling API
if ("launchQueue" in window) {
  launchQueue.setConsumer(async (launchParams) => {
    if (!launchParams.files.length) return;
    fileHandles = launchParams.files;
    currentIndex = 0;
    showImage();
  });
}

async function showImage() {
  const file = await fileHandles[currentIndex].getFile();
  filenameInput.value = file.name;
  img.src = URL.createObjectURL(file);
  img.style.transform = `translate(-50%, -50%) scale(${zoom}) rotate(${rotation}deg)`;
  document.getElementById("placeholder").style.display = "none";
}

// Upload fallback
const fileInput = document.getElementById("file-input");
const uploadBtn = document.getElementById("upload");
const uploadBtn2 = document.getElementById("uploadBtn");

[uploadBtn, uploadBtn2].forEach(btn => btn.onclick = () => fileInput.click());
fileInput.onchange = async (e) => {
  if (!e.target.files.length) return;
  fileHandles = Array.from(e.target.files).map(f => ({getFile: async ()=>f}));
  currentIndex = 0;
  showImage();
};

// Controls
document.getElementById("zoom-in").onclick = () => { zoom += 0.2; showImage(); };
document.getElementById("zoom-out").onclick = () => { zoom = Math.max(0.2, zoom - 0.2); showImage(); };
document.getElementById("rotate").onclick = () => { rotation = (rotation + 90) % 360; showImage(); };

// Brush
document.getElementById("brush").onclick = () => { drawingMode = "brush"; };
document.getElementById("brush-color").oninput = e => brushColor = e.target.value;
document.getElementById("brush-size").oninput = e => brushSize = e.target.value;

// Text
document.getElementById("text").onclick = () => { drawingMode = "text"; };
document.getElementById("text-color").oninput = e => textColor = e.target.value;
document.getElementById("text-size").oninput = e => textSize = e.target.value;

// Crop
document.getElementById("crop").onclick = () => { drawingMode = "crop"; };

// Save
document.getElementById("save").onclick = () => {
  if (!fileHandles.length) return alert("No file!");
  pendingFilename = filenameInput.value || "image.png";
  showPreview(true);
};

document.getElementById("save-as").onclick = () => {
  if (!fileHandles.length) return alert("No file!");
  pendingFilename = filenameInput.value || "edited.png";
  showPreview(false);
};

function showPreview(overwrite) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  ctx.drawImage(img, 0, 0);
  previewDataUrl = canvas.toDataURL("image/png");

  document.getElementById("previewImg").src = previewDataUrl;
  document.getElementById("previewNote").textContent = overwrite ?
    "This will overwrite the current file." :
    "This will download as a new file.";
  document.getElementById("previewPopup").style.display = "flex";
}

async function confirmSave() {
  const overwrite = document.getElementById("previewNote").textContent.includes("overwrite");

  if (overwrite && fileHandles.length && fileHandles[currentIndex].createWritable) {
    try {
      savingStatus.style.display = "block"; // hiện Saving...
      const h = fileHandles[currentIndex];
      const w = await h.createWritable();
      await w.write(await (await fetch(previewDataUrl)).blob());
      await w.close();
      savingStatus.style.display = "none";
      alert("File overwritten successfully!");
    } catch (e) {
      console.error(e);
      savingStatus.style.display = "none";
      alert("Save failed, try Save As.");
    }
  } else {
    // Save As
    const link = document.createElement("a");
    link.download = pendingFilename;
    link.href = previewDataUrl;
    link.click();
  }
  cancelSave();
}

function cancelSave() {
  document.getElementById("previewPopup").style.display = "none";
}

// View/Edit mode toggle
document.getElementById("view").onclick = () => {
  document.body.classList.add("view-mode");
};
document.getElementById("edit").onclick = () => {
  document.body.classList.remove("view-mode");
};
