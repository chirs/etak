(() => {
'use strict';

const {HOUSE,lerp,gcBearing,gcDistNm,gcInterp,houseOf,scoreFor,verdictText} = EtakCore;

const canvas = document.getElementById('sea');
const ctx = canvas.getContext('2d');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

// ---------- palette (single source of truth: the :root custom properties) ----------
const cssVars = getComputedStyle(document.documentElement);
const cv = n => cssVars.getPropertyValue(n).trim();
const hexA = (hex,a) => hex + Math.round(a*255).toString(16).padStart(2,'0');
const PAL = {
  night:cv('--night'), night2:cv('--night-2'),
  starlight:cv('--starlight'), amber:cv('--amber'), teal:cv('--teal'),
  faint:cv('--faint'), dim:cv('--dim'),
  course:cv('--course'), tick:cv('--tick'), roseRing:cv('--rose-ring'),
  roseMinor:cv('--rose-minor'), ghost:cv('--ghost'), island:cv('--island'),
  refFill:cv('--ref-fill'), land:cv('--land'), coast:cv('--coast'),
  range:cv('--range'),
};

// ---------- tuning constants ----------
const CFG={
  maxZoom:800,                  // screen px per world degree
  fitFrac:0.6,                  // fitLeg frames the leg into this fraction of the viewport
  roseR:200, roseLabelPad:18,   // rose radius + cardinal-label offset, screen px
  trailN:14, trailStep:0.02,    // navigator drift trails: dot count + t spacing per dot
  playRate:0.03,                // voyage fraction per second at speed 1
  refHitR:26,                   // sandbox reference drag hit radius, screen px
  birdsNm:16.2,                 // "etak of birds" ring radius, ~30 km (docs/sources.md §2)
  zoomStep:1.12,                // wheel zoom factor per notch
  fEase:2.6, fEaseReduced:8,    // frame-crossfade speed (reduced motion: near-instant)
};

// ---------- projection (rendering only; navigation math stays spherical) ----------
// Equirectangular. World units are degrees: x = lon in [0,360) space, y = -lat
// (north up). Stylized night chart — distortion is acceptable.
const lon360 = lon => (lon%360+360)%360;
const project   = p => ({ x:lon360(p.lon), y:-p.lat });
const unproject = w => ({ lat:-w.y, lon:lon360(w.x) });

// ---------- viewport + camera ----------
let W=0,H=0,DPR=1;
const B0=PACIFIC_MAP.bounds;
let MINZOOM=1;                             // screen px per world degree; max is CFG.maxZoom
const cam={cx:(B0.lonMin+B0.lonMax)/2, cy:-(B0.latMin+B0.latMax)/2, zoom:2};

function resize(){
  DPR=Math.min(devicePixelRatio||1,2);
  W=innerWidth;H=innerHeight;
  canvas.width=W*DPR;canvas.height=H*DPR;
  MINZOOM=0.95*Math.min(W/(B0.lonMax-B0.lonMin), H/(B0.latMax-B0.latMin));
  cam.zoom=clamp(cam.zoom,MINZOOM,CFG.maxZoom);
  if(A&&B) fitLeg();
}
addEventListener('resize',resize);

// frame current leg + its references into ~60% of the viewport
function fitLeg(){
  const pts=[project(A),project(B)];
  if(mode==='puzzle'&&puzzle) puzzle.candidates.forEach(c=>pts.push(project(c)));
  else if(C) pts.push(project(C));
  const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
  const minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);
  cam.cx=(minx+maxx)/2;cam.cy=(miny+maxy)/2;
  const wW=Math.max(maxx-minx,0.6),hW=Math.max(maxy-miny,0.6);
  cam.zoom=clamp(Math.min(W*CFG.fitFrac/wW, H*CFG.fitFrac/hW), MINZOOM, CFG.maxZoom);
}

// ---------- coastlines (built once in world coords) ----------
const landPath=new Path2D();
for(const poly of PACIFIC_MAP.polys){
  poly.forEach((pt,i)=>{const x=pt[0],y=-pt[1];i?landPath.lineTo(x,y):landPath.moveTo(x,y);});
  landPath.closePath();
}

// ---------- active leg + reference ----------
let A,B,C;                 // {lat,lon,name} — home / destination / reference
let boundaries=[];
let live=null;
let legNm=0;               // gcDistNm(A,B), constant per leg
let puzzle=null;           // {candidates:[{id,name,lat,lon,shape?,score}], chosenIndex}
let passageIndex=0;

const canoeAt=tt=>gcInterp(A,B,tt);

function recompute(){
  live=C?scoreFor(A,B,C):null;
  boundaries=live?live.boundaries:[];
  legNm=gcDistNm(A,B);
  updateScorePanel();
  buildEtakStrip();
}

// ---------- puzzle (real passages) ----------
function makePuzzle(){
  const pas=ETAK_PASSAGES[passageIndex];
  const from=ETAK_ISLANDS[pas.from], to=ETAK_ISLANDS[pas.to];
  A={...from};
  B={...to};
  const candidates=pas.candidates.map(id=>{
    const isl=ETAK_ISLANDS[id];
    return {id,name:isl.name,lat:isl.lat,lon:isl.lon,score:scoreFor(A,B,isl)};
  });
  puzzle={candidates,chosenIndex:-1};   // -1 = nothing picked yet, scores hidden
  C=null;
  recompute();
  subEl.textContent=`${pas.name} — ${pas.note}`;
  buildChooserUI();
  fitLeg();
  scorePanel.classList.add('hidden');
  t=0;scrub.value=0;setPlaying(false);
}

function applyChoice(i){
  const firstPick=puzzle.chosenIndex<0;
  puzzle.chosenIndex=i;
  const cand=puzzle.candidates[i];
  C={lat:cand.lat,lon:cand.lon,name:cand.name};
  recompute();
  if(firstPick)buildChooserUI();        // rebuild with all four scores revealed
  scorePanel.classList.remove('hidden');
  [...chooserEl.querySelectorAll('button')].forEach((b,k)=>b.classList.toggle('chosen',k===i));
  t=0;scrub.value=0;setPlaying(false);
}

// ---------- sandbox ----------
function makeSandbox(){
  const pas=ETAK_PASSAGES[0];
  const from=ETAK_ISLANDS[pas.from], to=ETAK_ISLANDS[pas.to];
  A={...from};
  B={...to};
  // a hypothetical reference placed abeam, north of the mid-leg point
  const mid=gcInterp(A,B,0.5);
  C={lat:mid.lat+1.1, lon:mid.lon+0.15, name:'REFERENCE'};
  recompute();
  fitLeg();
  t=0;scrub.value=0;setPlaying(false);
}

// ---------- sim state ----------
let t=0,playing=false,speedMul=1,f=0,fTarget=0;
let mode='puzzle';

// ---------- decorative stars ----------
let sSeed=7;const srnd=()=>(sSeed=(sSeed*16807)%2147483647)/2147483647;
const stars=Array.from({length:130},()=>({x:srnd(),y:srnd(),r:srnd()*1.1+0.3,p:srnd()*6.28,s:srnd()*0.7+0.3}));

// ---------- view transform (single source; screenToWorld/worldToScreen invert it) ----------
const ease=k=>k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
function viewParams(cn=canoeAt(t)){
  const fe=ease(f);const rot=fe*(-Math.PI/2);
  const P=project(cn);
  const O={x:lerp(cam.cx,P.x,fe), y:lerp(cam.cy,P.y,fe)};
  return {fe,rot,O,Z:cam.zoom,cx:W/2,cy:H/2+(1-fe)*20,P};
}
function applyTransform(v){
  ctx.translate(v.cx,v.cy);ctx.rotate(v.rot);ctx.scale(v.Z,v.Z);ctx.translate(-v.O.x,-v.O.y);
}
function worldToScreen(w,v=viewParams()){
  const dx=(w.x-v.O.x)*v.Z, dy=(w.y-v.O.y)*v.Z;
  const c=Math.cos(v.rot),s=Math.sin(v.rot);
  return {x:dx*c-dy*s+v.cx, y:dx*s+dy*c+v.cy};
}
function screenToWorld(sx,sy,v=viewParams()){
  let dx=sx-v.cx, dy=sy-v.cy;
  const c=Math.cos(v.rot),s=Math.sin(v.rot);         // inverse rotation
  let rx=(dx*c+dy*s)/v.Z, ry=(-dx*s+dy*c)/v.Z;
  return {x:rx+v.O.x, y:ry+v.O.y};
}

// ---------- drawing helpers ----------
function drawMarker(scr,color,glow,r){
  if(glow){const g=ctx.createRadialGradient(scr.x,scr.y,2,scr.x,scr.y,r*4.2);
    g.addColorStop(0,glow);g.addColorStop(1,'transparent');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(scr.x,scr.y,r*4.2,0,7);ctx.fill();}
  ctx.fillStyle=color;ctx.beginPath();ctx.arc(scr.x,scr.y,r,0,7);ctx.fill();
}
function drawLabel(scr,name,below,dim){
  ctx.fillStyle=dim?PAL.dim:PAL.faint;
  ctx.font='10px "IBM Plex Mono",monospace';ctx.textAlign='center';
  ctx.fillText(name,scr.x,scr.y+(below?18:-12));
}

function drawRose(Pw,v,cur){
  const R=CFG.roseR/v.Z;                    // screen px in world units
  ctx.save();ctx.translate(Pw.x,Pw.y);ctx.globalAlpha=0.12+0.88*v.fe;
  ctx.strokeStyle=PAL.roseRing;ctx.lineWidth=1/v.Z;
  ctx.beginPath();ctx.arc(0,0,R,0,7);ctx.stroke();
  for(let i=0;i<32;i++){const deg=i*HOUSE;const a=(deg-90)*Math.PI/180;
    const major=i%8===0;const lp=(major?16:(i%4===0?10:6))/v.Z;
    ctx.strokeStyle=i===cur?PAL.amber:PAL.roseMinor;ctx.lineWidth=(i===cur?2.2:1)/v.Z;
    ctx.beginPath();ctx.moveTo(Math.cos(a)*(R-lp),Math.sin(a)*(R-lp));
    ctx.lineTo(Math.cos(a)*R,Math.sin(a)*R);ctx.stroke();}
  ctx.restore();
}
const ROSE_LABELS=[[0,'POLARIS · N'],[90,'MAILAP RISING · E'],[180,'CRUX · S'],[270,'MAILAP SETTING · W']];
function drawRoseLabels(Pw,v){
  ctx.fillStyle=PAL.faint;ctx.font='9.5px "IBM Plex Mono",monospace';ctx.textAlign='center';
  const R=(CFG.roseR+CFG.roseLabelPad)/v.Z;
  for(const [deg,nm] of ROSE_LABELS){const a=(deg-90)*Math.PI/180;
    const w={x:Pw.x+Math.cos(a)*R, y:Pw.y+Math.sin(a)*R};
    const s=worldToScreen(w,v);ctx.fillText(nm,s.x,s.y+3);}
}

// ---------- layers (world-space ones draw under applyTransform(v)) ----------
function drawSky(){
  const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,PAL.night);g.addColorStop(1,PAL.night2);
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  const now=performance.now()/1000;
  for(const s of stars){const tw=reduceMotion?0.75:0.55+0.45*Math.sin(now*s.s+s.p);
    ctx.globalAlpha=0.35*tw;ctx.fillStyle=PAL.starlight;
    ctx.beginPath();ctx.arc(s.x*W,s.y*H,s.r,0,7);ctx.fill();}
  ctx.globalAlpha=1;
}

function drawCoast(v){
  ctx.fillStyle=PAL.land;ctx.fill(landPath);
  ctx.strokeStyle=PAL.coast;ctx.lineWidth=0.6/v.Z;ctx.lineJoin='round';ctx.stroke(landPath);
}

// "etak of birds" range rings around home + destination (seabird feeding range)
function drawRangeRings(v){
  ctx.strokeStyle=PAL.range;ctx.lineWidth=1/v.Z;ctx.setLineDash([3/v.Z,4/v.Z]);
  for(const I of [A,B]){const w=project(I);
    const ry=CFG.birdsNm/60, rx=ry/Math.cos(I.lat*Math.PI/180);   // 1° lat = 60 nm
    ctx.beginPath();ctx.ellipse(w.x,w.y,rx,ry,0,0,7);ctx.stroke();}
  ctx.setLineDash([]);
}

// course line + etak ticks (perpendicular to the leg)
function drawCourse(v,Aw,Bw){
  ctx.strokeStyle=PAL.course+'aa';ctx.lineWidth=1.5/v.Z;ctx.setLineDash([6/v.Z,7/v.Z]);
  ctx.beginPath();ctx.moveTo(Aw.x,Aw.y);ctx.lineTo(Bw.x,Bw.y);ctx.stroke();ctx.setLineDash([]);
  let px=Bw.x-Aw.x,py=Bw.y-Aw.y;const pl=Math.hypot(px,py)||1;px/=pl;py/=pl;   // unit along leg
  const nx=-py,ny=px, tickL=9/v.Z;                                             // perpendicular
  for(const bt of boundaries){const q=project(canoeAt(bt));
    ctx.strokeStyle=bt<t?PAL.amber+'99':PAL.tick;ctx.lineWidth=1.5/v.Z;
    ctx.beginPath();ctx.moveTo(q.x-nx*tickL,q.y-ny*tickL);ctx.lineTo(q.x+nx*tickL,q.y+ny*tickL);ctx.stroke();}
}

// island drift trails (navigator frame) + canoe wake (chart frame)
function drawTrails(v,Pw,Aw){
  if(v.fe>0.03){
    for(const I of (C?[A,B,C]:[A,B])){const Iw=project(I);const col=I===C?PAL.amber:PAL.teal;
      for(let k=1;k<=CFG.trailN;k++){const tp=t-k*CFG.trailStep;if(tp<0)break;const Ppw=project(canoeAt(tp));
        ctx.globalAlpha=v.fe*(1-k/(CFG.trailN+1))*0.5;ctx.fillStyle=col;
        ctx.beginPath();ctx.arc(Iw.x+(Pw.x-Ppw.x),Iw.y+(Pw.y-Ppw.y),2/v.Z,0,7);ctx.fill();}}
    ctx.globalAlpha=1;
  }
  if(v.fe<0.97&&t>0.005){ctx.save();ctx.globalAlpha=0.6*(1-v.fe);ctx.strokeStyle=PAL.teal;ctx.lineWidth=2/v.Z;
    ctx.beginPath();ctx.moveTo(Aw.x,Aw.y);ctx.lineTo(Pw.x,Pw.y);ctx.stroke();ctx.restore();}
}

// bearing lines: ghost candidates (dim) + chosen reference
function drawBearings(v,Pw){
  if(mode==='puzzle'&&puzzle){
    puzzle.candidates.forEach((cd,i)=>{
      if(i===puzzle.chosenIndex)return;const cw=project(cd);
      ctx.strokeStyle=PAL.tick+'55';ctx.lineWidth=1/v.Z;ctx.setLineDash([2/v.Z,6/v.Z]);
      ctx.beginPath();ctx.moveTo(Pw.x,Pw.y);ctx.lineTo(cw.x,cw.y);ctx.stroke();ctx.setLineDash([]);
    });
  }
  if(!C)return;
  const Cw=project(C);
  ctx.strokeStyle=PAL.amber;ctx.lineWidth=1.6/v.Z;ctx.setLineDash([2/v.Z,5/v.Z]);
  ctx.beginPath();ctx.moveTo(Pw.x,Pw.y);ctx.lineTo(Cw.x,Cw.y);ctx.stroke();ctx.setLineDash([]);
}

// canoe (points along +x world = the leg's forward-ish direction)
function drawCanoe(v,Pw,Aw,Bw){
  ctx.save();ctx.translate(Pw.x,Pw.y);ctx.rotate(Math.atan2(Bw.y-Aw.y,Bw.x-Aw.x));
  ctx.scale(1/v.Z,1/v.Z);ctx.fillStyle=PAL.starlight;
  ctx.beginPath();ctx.moveTo(14,0);ctx.lineTo(-10,-7);ctx.lineTo(-6,0);ctx.lineTo(-10,7);ctx.closePath();ctx.fill();
  ctx.restore();
}

// screen-space pass: markers + labels (crisp, upright at any zoom)
function drawMarkersAndLabels(v,Pw,Aw,Bw){
  if(mode==='puzzle'&&puzzle){
    puzzle.candidates.forEach((cd,i)=>{
      if(i===puzzle.chosenIndex)return;const s=worldToScreen(project(cd),v);
      drawMarker(s,PAL.ghost,null,4.5);drawLabel(s,cd.name,false,true);
    });
  }
  const sA=worldToScreen(Aw,v),sB=worldToScreen(Bw,v);
  drawMarker(sA,PAL.island,null,5);drawLabel(sA,A.name,true,false);
  drawMarker(sB,PAL.island,null,5);drawLabel(sB,B.name,true,false);
  if(C){const sC=worldToScreen(project(C),v);
    drawMarker(sC,PAL.refFill,hexA(PAL.amber,0.5),5.5);drawLabel(sC,C.name,false,false);}
  drawRoseLabels(Pw,v);
}

function draw(){
  ctx.setTransform(DPR,0,0,DPR,0,0);
  drawSky();

  const cn=canoeAt(t);
  const refDeg=C?gcBearing(cn,C):null;
  const v=viewParams(cn);
  const Pw=v.P;
  const Aw=project(A),Bw=project(B);

  // ---- world-space pass ----
  ctx.save();applyTransform(v);
  drawCoast(v);
  drawRangeRings(v);
  drawCourse(v,Aw,Bw);
  drawTrails(v,Pw,Aw);
  drawRose(Pw,v,refDeg==null?-1:houseOf(refDeg));
  drawBearings(v,Pw);
  drawCanoe(v,Pw,Aw,Bw);
  ctx.restore();

  // ---- screen-space pass ----
  drawMarkersAndLabels(v,Pw,Aw,Bw);
  updateReadout(refDeg);
}

// ---------- UI ----------
const readoutEl=document.getElementById('readout');
let lastReadout='';
function updateReadout(refDeg){
  if(refDeg==null){
    const html=`<b>choose a reference island</b> — watch the ghost bearings sweep<br>`+
      `leg <b>${Math.round(legNm)} nm</b> · voyage <b>${Math.round(t*100)}%</b>`;
    if(html!==lastReadout){lastReadout=html;readoutEl.innerHTML=html;}
    return;
  }
  const seg=boundaries.filter(b=>b<t).length+1;
  if(seg!==lastSeg){lastSeg=seg;
    [...etakStrip.children].forEach((el,i)=>el.classList.toggle('past',boundaries[i]<t));}
  const total=boundaries.length+1;
  const segName=total>1&&seg===total?' — etak of sighting':
                total>2&&seg===total-1?' — etak of birds':'';
  const html=
    `etak <b class="etakN">${seg}</b> of <b>${total}</b>${segName}<br>`+
    `bearing to reference <b>${refDeg.toFixed(1).padStart(5,'0')}°</b> · house <b>${houseOf(refDeg)+1}</b>/32<br>`+
    `leg <b>${Math.round(legNm)} nm</b> · voyage <b>${Math.round(t*100)}%</b>`;
  if(html!==lastReadout){lastReadout=html;readoutEl.innerHTML=html;}
}

// etak boundary ticks on the scrubber; rebuilt only when the boundaries change
const etakStrip=document.getElementById('etakStrip');
let stripKey='',lastSeg=-1;
function buildEtakStrip(){
  const key=boundaries.map(b=>b.toFixed(4)).join();
  if(key===stripKey)return;
  stripKey=key;lastSeg=-1;
  etakStrip.innerHTML=boundaries.map(b=>`<i style="left:${(b*100).toFixed(2)}%"></i>`).join('');
}

const scoreBig=document.getElementById('scoreBig');
const cntFill=document.getElementById('cntFill'),evnFill=document.getElementById('evnFill');
const cntVal=document.getElementById('cntVal'),evnVal=document.getElementById('evnVal');
const verdictEl=document.getElementById('verdict');
function gradeColor(v){return v>=0.75?'var(--good)':v>=0.45?'var(--teal)':'var(--bad)';}
function updateScorePanel(){
  if(!live)return;
  scoreBig.innerHTML=`${live.total}<span>/100</span>`;
  cntFill.style.width=(live.count*100)+'%';cntFill.style.background=gradeColor(live.count);
  evnFill.style.width=(live.even*100)+'%';evnFill.style.background=gradeColor(live.even);
  cntVal.textContent=live.segs+' etaks';
  evnVal.textContent=Math.round(live.even*100)+'%';
  verdictEl.textContent=verdictText(live);
}

const chooserEl=document.getElementById('chooser');
function buildChooserUI(){
  chooserEl.querySelectorAll('button').forEach(b=>b.remove());
  const revealed=puzzle.chosenIndex>=0;
  puzzle.candidates.forEach((cd,i)=>{
    const btn=document.createElement('button');
    btn.innerHTML=`<span>${cd.name.trim()}</span>`+(revealed?`<span class="sc">${cd.score.total}</span>`:'');
    btn.addEventListener('click',()=>applyChoice(i));
    chooserEl.appendChild(btn);
  });
}

// ---------- controls ----------
const scorePanel=document.getElementById('scorePanel');
const playBtn=document.getElementById('play'),scrub=document.getElementById('scrub'),speedEl=document.getElementById('speed');
function setPlaying(p){playing=p;playBtn.textContent=p?'❚❚':'▶';}
playBtn.addEventListener('click',()=>{if(!playing&&t>=1)t=0;setPlaying(!playing);});
scrub.addEventListener('input',()=>{t=+scrub.value;setPlaying(false);});
speedEl.addEventListener('input',()=>{speedMul=+speedEl.value;});

document.getElementById('fChart').addEventListener('click',e=>{fTarget=0;frameActive(e.target);});
document.getElementById('fEtak').addEventListener('click',e=>{fTarget=1;frameActive(e.target);});
function frameActive(btn){document.querySelectorAll('.frames button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}

const mPuzzle=document.getElementById('mPuzzle'),mSandbox=document.getElementById('mSandbox');
const newBtn=document.getElementById('newBtn'),subEl=document.getElementById('sub');
function setMode(m){
  mode=m;
  mPuzzle.classList.toggle('active',m==='puzzle');
  mSandbox.classList.toggle('active',m==='sandbox');
  scorePanel.classList.toggle('hidden',m!=='puzzle');
  chooserEl.classList.toggle('hidden',m!=='puzzle');
  newBtn.classList.toggle('hidden',m!=='puzzle');
  if(m==='puzzle'){makePuzzle();}
  else{subEl.textContent='Free exploration. Drag the reference island; watch how its position reshapes the etaks. Scroll to zoom, drag the sea to pan.';makeSandbox();}
}
mPuzzle.addEventListener('click',()=>setMode('puzzle'));
mSandbox.addEventListener('click',()=>setMode('sandbox'));
newBtn.addEventListener('click',()=>{passageIndex=(passageIndex+1)%ETAK_PASSAGES.length;makePuzzle();});

// ---------- camera + sandbox drag (chart frame) ----------
let dragMode=null,lastX=0,lastY=0;   // 'ref' | 'pan' | null
canvas.addEventListener('pointerdown',e=>{
  if(mode==='sandbox'){
    const cs=worldToScreen(project(C));
    if(Math.hypot(cs.x-e.clientX,cs.y-e.clientY)<CFG.refHitR){dragMode='ref';canvas.setPointerCapture(e.pointerId);return;}
  }
  if(ease(f)<0.5){dragMode='pan';lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);}
});
canvas.addEventListener('pointermove',e=>{
  if(dragMode==='ref'){const w=screenToWorld(e.clientX,e.clientY);const p=unproject(w);C.lat=p.lat;C.lon=p.lon;recompute();}
  else if(dragMode==='pan'){
    const a=screenToWorld(lastX,lastY),b=screenToWorld(e.clientX,e.clientY);
    cam.cx+=a.x-b.x;cam.cy+=a.y-b.y;lastX=e.clientX;lastY=e.clientY;
  }
});
canvas.addEventListener('pointerup',()=>{dragMode=null;});
canvas.addEventListener('wheel',e=>{
  e.preventDefault();
  const before=screenToWorld(e.clientX,e.clientY);
  cam.zoom=clamp(cam.zoom*(e.deltaY<0?CFG.zoomStep:1/CFG.zoomStep),MINZOOM,CFG.maxZoom);
  const after=screenToWorld(e.clientX,e.clientY);
  cam.cx+=before.x-after.x;cam.cy+=before.y-after.y;
},{passive:false});

// ---------- loop ----------
let last=performance.now();
function loop(now){
  const dt=Math.min((now-last)/1000,0.05);last=now;
  if(playing){t+=dt*CFG.playRate*speedMul;if(t>=1){t=1;setPlaying(false);}scrub.value=t;}
  const fSpeed=reduceMotion?CFG.fEaseReduced:CFG.fEase;
  f+=(fTarget-f)*Math.min(1,dt*fSpeed);if(Math.abs(fTarget-f)<0.001)f=fTarget;
  draw();
  requestAnimationFrame(loop);
}
resize();
setMode('puzzle');
requestAnimationFrame(loop);
})();
