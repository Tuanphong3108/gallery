let fileHandles = [];
let currentIndex = 0;
let zoom = 1;
let rotation = 0;

const img = document.getElementById("image");
const filenameEl = document.getElementById("filename");
const placeholder = document.getElementById("placeholder");
const fileInput = document.getElementById("fileInput");

// Hiển thị ảnh
async function showImage() {
  if (!fileHandles.length) {
    img.style.display = "none";
    placeholder.style.display = "block";
    filenameEl.textContent = "Chưa có ảnh";
    return;
  }

  const file = await fileHandles[currentIndex].getFile();
  img.src = URL.createObjectURL(file);
  img.style.display = "block";
  placeholder.style.display = "none";
  filenameEl.textContent = file.name;
  img.style.transform = `scale(${zoom}) rotate(${rotation}deg)`;
}

// File Handling API (ChromeOS)
if ("launchQueue" in window) {
  launchQueue.setConsumer(async (launchParams) => {
    if (!launchParams.files.length) return;
    fileHandles = launchParams.files;
    currentIndex = 0;
    zoom = 1;
    rotation = 0;
    showImage();
  });
}

// Fallback upload input
fileInput.addEventListener("change", async (e) => {
  const files = Array.from(e.target.files);
  fileHandles = files.map(f => ({
    getFile: async () => f
  }));
  currentIndex = 0;
  zoom = 1;
  rotation = 0;
  showImage();
});

// Controls
document.getElementById("prev").onclick = () => {
  if (currentIndex > 0) {
    currentIndex--;
    zoom = 1;
    rotation = 0;
    showImage();
  }
};

document.getElementById("next").onclick = () => {
  if (currentIndex < fileHandles.length - 1) {
    currentIndex++;
    zoom = 1;
    rotation = 0;
    showImage();
  }
};

document.getElementById("zoom-in").onclick = () => {
  zoom += 0.2;
  showImage();
};

document.getElementById("zoom-out").onclick = () => {
  zoom = Math.max(0.2, zoom - 0.2);
  showImage();
};

document.getElementById("rotate").onclick = () => {
  rotation = (rotation + 90) % 360;
  showImage();
};

// Khởi động
showImage();
