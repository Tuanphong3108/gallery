let fileHandles = [];
let currentIndex = 0;
let zoom = 1;
let rotation = 0;

const img = document.getElementById("image");

// LaunchQueue cho File Handling API
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

async function showImage() {
  if (!fileHandles.length) return;
  const file = await fileHandles[currentIndex].getFile();
  img.src = URL.createObjectURL(file);
  img.style.transform = `scale(${zoom}) rotate(${rotation}deg)`;
}

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
