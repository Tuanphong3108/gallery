let fileHandles = [];
let newH = Math.abs(canvas.width * Math.sin(angleRad)) + Math.abs(canvas.height * Math.cos(angleRad));
tempCanvas.width = newW;
tempCanvas.height = newH;
const tempCtx = tempCanvas.getContext("2d");
tempCtx.translate(newW/2,newH/2);
tempCtx.rotate(angleRad);
tempCtx.drawImage(canvas,-canvas.width/2,-canvas.height/2);
return tempCanvas.toDataURL();
}


// ===== Preview Save =====
function saveFile(){ if(!fileHandles.length)return alert("No file!"); pendingFilename=filenameInput.value||"image.png"; showPreview(true);}
function saveFileAs(){ if(!fileHandles.length)return alert("No file!"); pendingFilename=filenameInput.value||"edited.png"; showPreview(false);}
function showPreview(overwrite){
previewDataUrl=getFinalDataUrl();
document.getElementById("previewImg").src=previewDataUrl;
document.getElementById("previewNote").textContent=(overwrite&&fileHandles[currentIndex].createWritable)?"This will overwrite the original file.":"This will download a new file.";
document.getElementById("previewPopup").style.display="flex";
}
async function confirmSave(){
if(fileHandles.length&&fileHandles[currentIndex].createWritable){
try{const h=fileHandles[currentIndex];const w=await h.createWritable();await w.write(await (await fetch(previewDataUrl)).blob());await w.close();alert("File overwritten successfully!");}
catch(e){console.error(e);alert("Save failed, try Save As.");}
} else {
const link=document.createElement("a");link.download=pendingFilename;link.href=previewDataUrl;link.click();
}
cancelSave();
}
function cancelSave(){document.getElementById("previewPopup").style.display="none";pendingFilename=null;previewDataUrl=null;}


// ===== Mouse events =====
img.addEventListener("mousedown", e=>{
if(mode==="pen"){drawing=true;ctx.beginPath();ctx.moveTo(e.offsetX,e.offsetY);}
else if(mode==="crop"){cropping=true;cropStart={x:e.offsetX,y:e.offsetY};cropBox.style.left=`${e.offsetX}px`;cropBox.style.top=`${e.offsetY}px`;cropBox.style.width="0px";cropBox.style.height="0px";cropBox.style.display="block";}
else if(mode==="view"){isPanning=true;panStart={x:e.clientX,y:e.clientY};}
else if(mode==="text"){const text=prompt("Enter text:");if(text){ctx.fillStyle=textColor;ctx.font=`${textSize}px Arial`;ctx.fillText(text,e.offsetX,e.offsetY);img.src=canvas.toDataURL();saveHistory();}}
});
img.addEventListener("mousemove", e=>{
if(mode==="pen"&&drawing){ctx.lineTo(e.offsetX,e.offsetY);ctx.strokeStyle=brushColor;ctx.lineWidth=brushSize;ctx.lineCap="round";ctx.stroke();img.src=canvas.toDataURL();}
else if(mode==="crop"&&cropping&&cropStart){const w=e.offsetX-cropStart.x,h=e.offsetY-cropStart.y;cropBox.style.left=`${Math.min(e.offsetX,cropStart.x)}px`;cropBox.style.top=`${Math.min(e.offsetY,cropStart.y)}px`;cropBox.style.width=`${Math.abs(w)}px`;cropBox.style.height=`${Math.abs(h)}px`;}
else if(mode==="view"&&isPanning){let dx=e.clientX-panStart.x,dy=e.clientY-panStart.y;panOffset.x+=dx;panOffset.y+=dy;applyTransform();panStart={x:e.clientX,y:e.clientY};}
});
img.addEventListener("mouseup", e=>{
if(mode==="pen"&&drawing){drawing=false;saveHistory();}
else if(mode==="crop"&&cropping&&cropStart){const x=parseInt(cropBox.style.left),y=parseInt(cropBox.style.top),w=parseInt(cropBox.style.width),h=parseInt(cropBox.style.height);const cropped=ctx.getImageData(x,y,w,h);canvas.width=w;canvas.height=h;ctx.putImageData(cropped,0,0);img.src=canvas.toDataURL();saveHistory();cropBox.style.display="none";cropping=false;}
else if(mode==="view"&&isPanning){isPanning=false;}
});


// ===== Controls =====
document.getElementById("zoom-in").onclick=()=>{zoom+=0.2;applyTransform();};
document.getElementById("zoom-out").onclick=()=>{zoom=Math.max(0.2,zoom-0.2);applyTransform();};
document.getElementById("rotate").onclick=()=>{rotation=(rotation+90)%360;applyTransform();};


document.getElementById("undo").onclick=undo;
document.getElementById("redo").onclick=redo;
document.getElementById("save").onclick=saveFile;
document.getElementById("save-as").onclick=saveFileAs;


document.getElementById("brush-color").oninput=e=>{brushColor=e.target.value;mode="pen";};
document.getElementById("brush-size").oninput=e=>{brushSize=e.target.value;mode="pen";};


document.getElementById("text-color").oninput=e=>{textColor=e.target.value;mode="text";};
document.getElementById("text-size").oninput=e=>{textSize=parseInt(e.target.value);mode="text";};


document.getElementById("crop").onclick=()=>{mode="crop";};
document.getElementById("text").onclick=()=>{mode="text";};


document.getElementById("view").onclick=()=>{mode="view";document.body.classList.add("view-mode");document.getElementById("edit").style.display="inline-block";};
document.getElementById("edit").onclick=()=>{mode="none";document.body.classList.remove("view-mode");document.getElementById("edit").style.display="none";};


// ===== Upload =====
document.getElementById("upload").onclick=()=>fileInput.click();
fileInput.onchange=()=>{const files=Array.from(fileInput.files);if(!files.length)return;fileHandles=files.map(f=>({getFile:async()=>f}));currentIndex=0;showImage(files[0]);};


// ===== File Handling API =====
if("launchQueue" in window){launchQueue.setConsumer(async p=>{if(!p.files.length)return;fileHandles=p.files;currentIndex=0;const file=await fileHandles[0].getFile();showImage(file);});}
