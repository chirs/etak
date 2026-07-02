(() => {
'use strict';

const {HOUSE,lerp,gcBearing,gcDistNm,gcInterp,houseOf,altAz,gmst,scoreFor,verdictText,
       PLANETS,sunPos,moonPos,planetPos} = EtakCore;

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
  roseNames:50,                 // zoom (px/deg) above which all 32 house names label the rose
  zoomStep:1.12,                // wheel zoom factor per notch
  fEase:2.6, fEaseReduced:8,    // frame-crossfade speed (reduced motion: near-instant)
  canoeKn:5.3,                  // Gladwin's measured proa speed (docs/sources.md §3)
  depart:'1969-07-10T09:00:00Z',// dusk (19:00 local) at Puluwat, Hipour's revival year —
                                // chosen so Altair sits just-risen at t=0 on Puluwat→Chuuk
  fov:110,                      // boat view: horizontal field of view, degrees
  horizonUp:170,                // boat view: horizon height, px above the viewport bottom (clears the readout)
  bowW:0.16, bowH:0.14,         // boat view: bow half-width / height, fractions of W and H
  seaVanish:1.15,               // boat view: sea-grid vanishing point depth, fraction of H
  milkyN:4500,                  // boat view: milky-way dust points, scattered once at load
  lookStep:10,                  // boat view: gaze swing per arrow-key press, degrees
  storyEase:2.0,                // story mode: camera-flight ease rate (per second)
  storyArcSec:1.6,              // story mode: seconds for one migration arc to grow
  storyStagger:0.9,             // story mode: seconds between successive arc starts
  storyFitFrac:0.78,            // story mode: beats frame into this fraction of the viewport
  placeHitR:14,                 // settlement mode: place click hit radius, screen px
  arcYears:150,                 // settlement timeline: max years a voyage arc takes to cross
  yearRate:100,                 // settlement timeline: years per second at speed 1
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
  // east-up rotation maps world lon-extent to screen height, lat-extent to width;
  // cover (max), not contain: zoom-out stops once the chart fills the viewport
  MINZOOM=Math.max(H/(B0.lonMax-B0.lonMin), W/(B0.latMax-B0.latMin));
  cam.zoom=clamp(cam.zoom,MINZOOM,CFG.maxZoom);
  if(story) camTarget=fitPoints(ETAK_STORY[story.beat].fit.map(project),CFG.storyFitFrac);
  else if(mode==='settlement') camTarget=fitPoints(ETAK_STORY[settle.beat].fit.map(project),CFG.storyFitFrac);
  else if(A&&B) fitLeg();
}
addEventListener('resize',resize);

// camera frame for a set of projected points (east-up: lon→height, lat→width)
function fitPoints(pts,frac=CFG.fitFrac){
  const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
  const minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);
  const wW=Math.max(maxx-minx,0.6),hW=Math.max(maxy-miny,0.6);
  return {cx:(minx+maxx)/2, cy:(miny+maxy)/2,
          zoom:clamp(Math.min(H*frac/wW, W*frac/hW), MINZOOM, CFG.maxZoom)};
}

// frame current leg + its references into ~60% of the viewport
function fitLeg(){
  const pts=[project(A),project(B)];
  if(mode==='puzzle'&&puzzle) puzzle.candidates.forEach(c=>pts.push(project(c)));
  else if(C) pts.push(project(C));
  Object.assign(cam,fitPoints(pts));
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
let legHours=0;            // sailing time at CFG.canoeKn — drives the boat-view sky
let puzzle=null;           // {candidates:[{id,name,lat,lon,shape?,score}], chosenIndex}
let passageIndex=0;
let hoverIdx=-1;           // chooser button under the pointer (-1 = none): previews that candidate

const canoeAt=tt=>gcInterp(A,B,tt);

function recompute(){
  live=C?scoreFor(A,B,C):null;
  boundaries=live?live.boundaries:[];
  legNm=gcDistNm(A,B);
  legHours=legNm/CFG.canoeKn;
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
  t=0;scrub.value=0;setPlaying(false);
}

function applyChoice(i){
  const firstPick=puzzle.chosenIndex<0;
  puzzle.chosenIndex=i;
  const cand=puzzle.candidates[i];
  C={lat:cand.lat,lon:cand.lon,name:cand.name};
  recompute();
  if(firstPick)buildChooserUI();        // rebuild with all four scores revealed
  [...chooserEl.querySelectorAll('button')].forEach((b,k)=>b.classList.toggle('chosen',k===i));
  updateScorePanel();                   // re-seat the detail under the (possibly rebuilt) button
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
let b=0,bTarget=0;         // boat-view fade (0 = chart/navigator, 1 = horizon view)
let look=0;                // boat-view gaze, degrees off the course heading (0 = dead ahead)
let pitch=0;               // boat-view gaze tilt, degrees above dead-ahead (0 = horizon level)
let DEPART_MS=Date.parse(CFG.depart);             // adjustable via the departure picker (boat view)
const voyageMs=()=>DEPART_MS+t*legHours*3600e3;   // real clock time at voyage fraction t
let mode='puzzle';

// ---------- view transform (single source; screenToWorld/worldToScreen invert it) ----------
const ease=k=>k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
function viewParams(cn=canoeAt(t)){
  // East-up always — the traditional Carolinian alignment (compass anchored on
  // Altair, east at top). The f crossfade blends centering only.
  const fe=ease(f);const rot=-Math.PI/2;
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
    ctx.lineTo(Math.cos(a)*R,Math.sin(a)*R);ctx.stroke();
    // house boundary: a small tick straddling the ring, half a house past the point
    const b=(deg+HOUSE/2-90)*Math.PI/180, bl=3/v.Z;
    ctx.strokeStyle=hexA(PAL.roseMinor,0.45);ctx.lineWidth=1/v.Z;
    ctx.beginPath();ctx.moveTo(Math.cos(b)*(R-bl),Math.sin(b)*(R-bl));
    ctx.lineTo(Math.cos(b)*(R+bl),Math.sin(b)*(R+bl));ctx.stroke();}
  ctx.restore();
}
const CARDINAL={0:'N',8:'E',16:'S',24:'W'};
function roseName(i){
  const c=ETAK_COMPASS[i];
  let s=(c.car?(c.pre?c.pre+' ':'')+c.car:c.star).toUpperCase();
  if(CARDINAL[i]!==undefined)s+=' · '+CARDINAL[i];
  return s;
}
// house names around the ring: cardinals + current house always, all 32 when zoomed in
function drawRoseLabels(Pw,v,cur){
  ctx.font='9.5px "IBM Plex Mono",monospace';
  const R=(CFG.roseR+CFG.roseLabelPad)/v.Z;
  const showAll=v.Z>=CFG.roseNames;
  for(let i=0;i<32;i++){
    const cardinal=i%8===0;
    if(!showAll&&i!==cur&&!cardinal)continue;
    const a=(i*HOUSE-90)*Math.PI/180;
    const w={x:Pw.x+Math.cos(a)*R, y:Pw.y+Math.sin(a)*R};
    const s=worldToScreen(w,v);
    ctx.fillStyle=i===cur?PAL.amber:hexA(PAL.dim,cardinal?0.5:0.28);
    if(showAll){   // radial, reading outward (flipped on the west side to stay upright)
      const sa=a+v.rot;const flip=Math.cos(sa)<0;
      ctx.save();ctx.translate(s.x,s.y);ctx.rotate(flip?sa+Math.PI:sa);
      ctx.textAlign=flip?'right':'left';ctx.fillText(roseName(i),0,3);ctx.restore();
    }else{
      ctx.textAlign='center';ctx.fillText(roseName(i),s.x,s.y+3);
    }
  }
}

// ---------- layers (world-space ones draw under applyTransform(v)) ----------
function drawSky(){
  const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,PAL.night);g.addColorStop(1,PAL.night2);
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
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
  // hover preview: the chooser button under the pointer, ghosted in
  if(mode==='puzzle'&&puzzle&&hoverIdx>=0&&hoverIdx!==puzzle.chosenIndex){
    const cw=project(puzzle.candidates[hoverIdx]);
    ctx.save();ctx.globalAlpha=0.4;
    ctx.strokeStyle=PAL.amber;ctx.lineWidth=1.6/v.Z;ctx.setLineDash([2/v.Z,5/v.Z]);
    ctx.beginPath();ctx.moveTo(Pw.x,Pw.y);ctx.lineTo(cw.x,cw.y);ctx.stroke();ctx.setLineDash([]);
    ctx.restore();
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

// every gazetteer island as a small fixed-size dot + dim label, so islands
// stay findable at any zoom (the coastline data has no rings for these atolls)
function drawGazetteer(v){
  const drawn=new Set([A.name,B.name]);
  if(C)drawn.add(C.name);
  if(mode==='puzzle'&&puzzle)puzzle.candidates.forEach(cd=>drawn.add(cd.name));
  for(const isl of Object.values(ETAK_ISLANDS)){
    if(drawn.has(isl.name))continue;
    const s=worldToScreen(project(isl),v);
    ctx.save();ctx.globalAlpha=0.75;
    drawMarker(s,PAL.ghost,null,2.5);drawLabel(s,isl.name,false,true);
    ctx.restore();
  }
}

// screen-space pass: markers + labels (crisp, upright at any zoom)
function drawMarkersAndLabels(v,Pw,Aw,Bw,cur){
  if(mode==='puzzle'&&puzzle){
    puzzle.candidates.forEach((cd,i)=>{
      if(i===puzzle.chosenIndex)return;const s=worldToScreen(project(cd),v);
      drawMarker(s,PAL.ghost,null,4.5);drawLabel(s,cd.name,false,true);
    });
    if(hoverIdx>=0&&hoverIdx!==puzzle.chosenIndex){   // hover preview, ghosted
      const cd=puzzle.candidates[hoverIdx],s=worldToScreen(project(cd),v);
      ctx.save();ctx.globalAlpha=0.55;
      drawMarker(s,PAL.refFill,hexA(PAL.amber,0.4),5.5);ctx.restore();
      drawLabel(s,cd.name,false,false);
    }
  }
  const sA=worldToScreen(Aw,v),sB=worldToScreen(Bw,v);
  drawMarker(sA,PAL.island,null,5);drawLabel(sA,A.name,true,false);
  drawMarker(sB,PAL.island,null,5);drawLabel(sB,B.name,true,false);
  if(C){const sC=worldToScreen(project(C),v);
    drawMarker(sC,PAL.refFill,hexA(PAL.amber,0.5),5.5);drawLabel(sC,C.name,false,false);}
  drawRoseLabels(Pw,v,cur);
}

// ---------- story mode (the settlement of the Pacific) ----------
// While `story` is set, draw() swaps the voyage layers for migration arcs over
// the coastlines and loop() eases the camera toward `camTarget` (beat flights).
// The arc layers are shared with settlement mode, so they take (beat,tBeat)
// rather than reading the story state.
let story=null;            // {beat,tBeat} while the walkthrough is playing
let camTarget=null;        // {cx,cy,zoom} the camera eases toward

function arcProgress(bi,ai,beat,tBeat){
  if(bi<beat||reduceMotion)return 1;
  return Math.max(0,Math.min(1,(tBeat-ai*CFG.storyStagger)/CFG.storyArcSec));
}

function drawArcs(v,beat,tBeat){
  for(let bi=0;bi<=beat;bi++){
    const on=bi===beat;
    ctx.strokeStyle=hexA(PAL.amber,on?0.75:0.42);       // past beats stay as amber shadows
    ctx.lineWidth=(on?1.6:1)/v.Z;
    ETAK_STORY[bi].arcs.forEach((arc,ai)=>{
      const p=arcProgress(bi,ai,beat,tBeat);
      if(p<=0)return;
      const N=48;
      ctx.beginPath();
      for(let i=0;i<=N;i++){
        const w=project(gcInterp(arc.from,arc.to,p*i/N));
        i?ctx.lineTo(w.x,w.y):ctx.moveTo(w.x,w.y);
      }
      ctx.stroke();
      const hw=project(gcInterp(arc.from,arc.to,p));    // head while growing, landfall once there
      ctx.fillStyle=on?PAL.amber:hexA(PAL.amber,0.65);
      ctx.beginPath();ctx.arc(hw.x,hw.y,(p<1?3:2.2)/v.Z,0,7);ctx.fill();
    });
  }
}

function drawArcLabels(v,beat,tBeat){
  ctx.font='10px "IBM Plex Mono",monospace';ctx.textAlign='left';
  for(let bi=0;bi<=beat;bi++){
    const col=bi===beat?hexA(PAL.amber,0.9):hexA(PAL.dim,0.6);
    ETAK_STORY[bi].arcs.forEach((arc,ai)=>{
      ctx.fillStyle=col;
      if(arc.fromName){
        const s=worldToScreen(project(arc.from),v);
        ctx.fillText(arc.fromName,s.x+7,s.y+3);
      }
      if(arcProgress(bi,ai,beat,tBeat)>=1){
        const s=worldToScreen(project(arc.to),v);
        ctx.fillText(arc.name+(arc.date?` · ${arc.date}`:''),s.x+7,s.y+3);
      }
    });
  }
}

// ---------- settlement mode (the explorable settlement map) ----------
// A persistent mode: every migration arc on one chart, driven by a year
// timeline — the bottom bar becomes a time slider from the first departure
// (~2350 BCE) to the last landfall (1250 CE). Each arc grows toward its
// landfall year and can start no earlier than its origin's own settlement,
// so voyages unfold in true chronological order. Landfalls are clickable.
const TL=(()=>{
  const last=ETAK_STORY.length-1;
  const arcs=[], eras=ETAK_STORY.map(()=>({start:Infinity,end:-Infinity}));
  ETAK_STORY.forEach((bt,bi)=>bt.arcs.forEach(arc=>{
    if(bi===last){arcs.push({arc,coda:true});return;}   // Hipour 1969: a coda, not settlement
    const end=arc.to.year, start=Math.max(arc.from.year,end-CFG.arcYears);
    arcs.push({arc,start,end});
    eras[bi].start=Math.min(eras[bi].start,start);
    eras[bi].end=Math.max(eras[bi].end,end);
  }));
  const spans=arcs.filter(a=>!a.coda);
  const min=Math.min(...spans.map(a=>a.start)), max=Math.max(...spans.map(a=>a.end));
  eras[0]={start:min,end:min};      // the empty ocean
  eras[last]={start:max,end:max};   // everything drawn, plus the coda arc
  return {arcs,eras,min,max};
})();
const settle={beat:0,year:TL.min,playing:false,until:TL.max};
let settlePlace=null;      // the clicked ETAK_PLACES entry, or null (era card shown)
const yearText=y=>{const r=Math.round(y/10)*10;return r<0?`${-r} BCE`:`${r} CE`;};

// world-space layer: every arc at its progress for the current year —
// growing arcs amber, completed ones ghosted
function drawTimeline(v){
  const N=48;
  for(const e of TL.arcs){
    if(e.coda&&settle.beat!==ETAK_STORY.length-1)continue;
    const p=e.coda?1:clamp((settle.year-e.start)/(e.end-e.start||1),0,1);
    if(p<=0)continue;
    const on=e.coda||p<1;
    ctx.strokeStyle=hexA(PAL.amber,on?0.75:0.42);       // completed voyages stay as amber shadows
    ctx.lineWidth=(on?1.6:1)/v.Z;
    ctx.beginPath();
    for(let i=0;i<=N;i++){
      const w=project(gcInterp(e.arc.from,e.arc.to,p*i/N));
      i?ctx.lineTo(w.x,w.y):ctx.moveTo(w.x,w.y);
    }
    ctx.stroke();
    const hw=project(gcInterp(e.arc.from,e.arc.to,p));  // head while growing, landfall once there
    ctx.fillStyle=on?PAL.amber:hexA(PAL.amber,0.65);
    ctx.beginPath();ctx.arc(hw.x,hw.y,(p<1?3:2.2)/v.Z,0,7);ctx.fill();
  }
}

// screen-space layer: a dot + name/date label per place reached by the
// current year (so every landfall is labeled once and clickable)
function drawPlaces(v){
  ctx.font='10px "IBM Plex Mono",monospace';ctx.textAlign='left';
  for(const p of Object.values(ETAK_PLACES)){
    if(p.year>settle.year)continue;
    const hot=p===settlePlace;
    const s=worldToScreen(project(p),v);
    drawMarker(s,hot?PAL.refFill:PAL.island,hot?hexA(PAL.amber,0.5):null,hot?5.5:3.5);
    ctx.fillStyle=hot?PAL.amber:hexA(PAL.dim,0.8);
    ctx.fillText(p.name+(p.date?` · ${p.date}`:''),s.x+8,s.y+3);
  }
}

// ---------- milky way (built once): dust scattered about the galactic equator ----------
// Galactic -> equatorial via the J2000 NGP (RA 192.859°, Dec 27.128°, l_NCP 122.932°).
// Density peaks toward the galactic core, spreads gaussian in latitude (wider at the
// bulge), and the Great Rift (the Cygnus->Sagittarius dark lane) is thinned out.
const MILKY=(()=>{
  const R=Math.PI/180, aG=192.85948, dG=27.12825, lN=122.93192;
  const galEq=(l,b)=>{
    const sb=Math.sin(b*R), cb=Math.cos(b*R), dl=(lN-l)*R;
    const dec=Math.asin(Math.sin(dG*R)*sb+Math.cos(dG*R)*cb*Math.cos(dl))/R;
    const ra=((aG+Math.atan2(cb*Math.sin(dl),sb*Math.cos(dG*R)-cb*Math.sin(dG*R)*Math.cos(dl))/R)%360+360)%360;
    return [ra,dec];
  };
  const gauss=()=>Math.sqrt(-2*Math.log(1-Math.random()))*Math.cos(2*Math.PI*Math.random());
  const inRift=(l,b)=>(l<85||l>350)&&b>-0.5&&b<3.5;
  const dust=[];
  while(dust.length<CFG.milkyN){
    const l=Math.random()*360, core=0.55+0.45*Math.cos(l*R);
    if(Math.random()>core)continue;
    const b=gauss()*(4.5+2.5*Math.cos(l*R));
    if(inRift(l,b)&&Math.random()<0.65)continue;
    dust.push([...galEq(l,b), 0.4+0.6*Math.random(), (0.04+0.09*Math.random())*(0.5+0.5*core)]);
  }
  const glow=[];
  for(let l=0;l<360;l+=6)
    glow.push([...galEq(l,0), (0.55+0.45*Math.cos(l*R))*(inRift(l,1)?0.55:1)]);
  return {dust,glow};
})();

// ---------- boat view (third frame): the horizon from the canoe ----------
// Pure screen space. A first-person window: CFG.fov degrees of azimuth across
// the width, centered on the course heading plus the gaze offset `look`
// (drag / ←→ to turn; drag vertically / ↑↓ to tilt the gaze by `pitch`, which
// slides the horizon down and brings the high sky in — capped so the zenith
// just reaches the top edge). Dead ahead = look 0, pitch 0 = destination centered.
const maxPitch=()=>Math.max(0,90-(Math.max(H*0.5,H-CFG.horizonUp)-14)*CFG.fov/W);
const clampPitch=()=>{pitch=Math.min(Math.max(pitch,0),maxPitch());};
function drawBoatView(cn,refDeg,cur){
  const hdg=gcBearing(cn,B);
  const relAz=az=>((az-hdg-look+540)%360)-180;      // degrees off the gaze center
  const inView=rel=>Math.abs(rel)<CFG.fov/2+8;
  const pxDeg=W/CFG.fov;                            // px per degree, both axes
  const azX=az=>W/2+relAz(az)*pxDeg;
  const hy=Math.max(H*0.5,H-CFG.horizonUp)+pitch*pxDeg;
  ctx.lineWidth=1;

  // polar sea grid: a line from each house's horizon point, converging on a
  // vanishing point at bottom center (just off-screen, so they never quite meet)
  const seaG=ctx.createLinearGradient(0,hy,0,H);
  seaG.addColorStop(0,hexA(PAL.course,0.5));seaG.addColorStop(1,hexA(PAL.course,0.06));
  ctx.strokeStyle=seaG;
  const vpx=W/2, vpy=H*CFG.seaVanish+pitch*pxDeg;
  for(let i=0;i<32;i++){
    if(!inView(relAz(i*HOUSE)))continue;
    const x=azX(i*HOUSE);
    ctx.beginPath();ctx.moveTo(x,hy);ctx.lineTo(vpx,vpy);ctx.stroke();
  }

  // horizon: soft glow under a crisp line
  ctx.strokeStyle=hexA(PAL.teal,0.22);ctx.lineWidth=3.5;
  ctx.beginPath();ctx.moveTo(0,hy);ctx.lineTo(W,hy);ctx.stroke();
  ctx.strokeStyle=hexA(PAL.teal,0.85);ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(0,hy);ctx.lineTo(W,hy);ctx.stroke();

  // the actual sky: field stars + named compass stars, turning with sailing time.
  // Atmospheric extinction: airmass (≈1/sin alt, capped at the true horizon value
  // ~38) dims stars toward the sea line by 10^(-0.4·k·(X−1)). k here is well under
  // the physical ~0.25 mag/airmass — gentler than nature so the low sky stays alive.
  const lst=(gmst(voyageMs()/86400000+2440587.5)+cn.lon)%360;
  const dimAt=alt=>Math.pow(10,-0.03*(1/Math.sin(Math.max(alt,1.5)*Math.PI/180)-1));

  // milky way: a soft glow along the galactic equator under a scatter of dust,
  // clipped to the sky so the band can run right down to the sea line
  ctx.save();ctx.beginPath();ctx.rect(0,14,W,hy-14);ctx.clip();
  for(const [ra,dec,ints] of MILKY.glow){
    const p=altAz(ra,dec,cn.lat,lst);
    if(p.alt<-6||Math.abs(relAz(p.az))>CFG.fov/2+16)continue;
    const x=azX(p.az), y=hy-p.alt*pxDeg, r=13*pxDeg;
    const a=0.07*ints*dimAt(Math.max(p.alt,3));
    const g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,hexA(PAL.starlight,a));g.addColorStop(1,hexA(PAL.starlight,0));
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill();
  }
  for(const [ra,dec,r0,a0] of MILKY.dust){
    const p=altAz(ra,dec,cn.lat,lst);
    if(p.alt<-0.5||!inView(relAz(p.az)))continue;
    const a=a0*dimAt(p.alt);if(a<0.015)continue;
    ctx.fillStyle=hexA(PAL.starlight,a);
    ctx.beginPath();ctx.arc(azX(p.az),hy-p.alt*pxDeg,r0,0,7);ctx.fill();
  }
  ctx.restore();

  const curBase=cur>=0?ETAK_COMPASS[cur].star
    .replace(/ (rising|setting|upright)$/,'').replace(/ at 45°.*$/,''):null;
  for(const [ra,dec,mag] of STAR_MAP.field){
    const p=altAz(ra,dec,cn.lat,lst);
    if(p.alt<-0.5||!inView(relAz(p.az)))continue;
    const y=hy-p.alt*pxDeg;if(y<14)continue;
    const dim=dimAt(p.alt), a=Math.max(0.2,0.85-0.1*mag)*dim;
    if(a<0.03)continue;
    ctx.fillStyle=hexA(PAL.starlight,a);
    ctx.beginPath();ctx.arc(azX(p.az),y,Math.max(0.55,2.7-0.33*mag)*(0.5+0.5*dim),0,7);ctx.fill();
  }
  ctx.font='9px "IBM Plex Mono",monospace';ctx.textAlign='left';
  for(const s of STAR_MAP.compass){
    const p=altAz(s.ra,s.dec,cn.lat,lst);
    if(p.alt<-0.5||!inView(relAz(p.az)))continue;
    const y=hy-p.alt*pxDeg;if(y<14)continue;
    const x=azX(p.az), hot=s.group===curBase;
    drawMarker({x,y},hot?PAL.amber:hexA(PAL.starlight,Math.max(0.25,0.9*dimAt(p.alt))),
               hot?hexA(PAL.amber,0.4):null,hot?2.6:Math.max(1.4,2.6-0.5*s.mag));
    if(s.lbl){ctx.fillStyle=hot?PAL.amber:hexA(PAL.dim,0.6);ctx.fillText(s.car||s.name,x+7,y+3);}
  }

  // wanderers: the five naked-eye planets as bright labeled dots, then the Moon
  // with its true phase (bright limb facing the sun's sky position)
  const jd=voyageMs()/86400000+2440587.5;
  for(const name of PLANETS){
    const pl=planetPos(name,jd), p=altAz(pl.ra,pl.dec,cn.lat,lst);
    if(p.alt<-0.5||!inView(relAz(p.az)))continue;
    const y=hy-p.alt*pxDeg;if(y<14)continue;
    const dim=dimAt(p.alt), a=Math.min(1,0.85-0.1*pl.mag)*dim;
    if(a<0.04)continue;
    const x=azX(p.az);
    ctx.fillStyle=hexA(PAL.starlight,a);
    ctx.beginPath();ctx.arc(x,y,Math.max(0.8,2.7-0.33*pl.mag)*(0.5+0.5*dim),0,7);ctx.fill();
    ctx.fillStyle=hexA(PAL.dim,0.15+0.5*dim);ctx.fillText(name,x+7,y+3);
  }
  const mo=moonPos(jd), pm=altAz(mo.ra,mo.dec,cn.lat,lst);
  if(pm.alt>-0.5&&inView(relAz(pm.az))){
    const x=azX(pm.az), y=hy-pm.alt*pxDeg;
    if(y>=14){
      const Rm=Math.max(4,0.3*pxDeg);                 // true disc is ~0.26° — a touch of looming
      const su=sunPos(jd), ps=altAz(su.ra,su.dec,cn.lat,lst);
      const th=Math.atan2((hy-ps.alt*pxDeg)-y,azX(ps.az)-x);
      const dim=0.35+0.65*dimAt(pm.alt);              // the moon survives low altitude
      ctx.fillStyle=hexA(PAL.starlight,0.08*dim);     // earthshine night side
      ctx.beginPath();ctx.arc(x,y,Rm,0,7);ctx.fill();
      const k=2*mo.phase-1;                           // -1 new .. +1 full
      ctx.fillStyle=hexA(PAL.starlight,0.85*dim);
      ctx.beginPath();
      ctx.arc(x,y,Rm,th-Math.PI/2,th+Math.PI/2);      // sunward semicircle of the limb
      ctx.ellipse(x,y,Rm*Math.abs(k),Rm,th,Math.PI/2,3*Math.PI/2,k<0);  // terminator
      ctx.fill();
    }
  }

  // house ticks + boundary separators + names (same semantics as the rose)
  ctx.font='9.5px "IBM Plex Mono",monospace';
  for(let i=0;i<32;i++){
    if(!inView(relAz(i*HOUSE)))continue;
    const x=azX(i*HOUSE);
    const major=i%8===0, tick=major?14:(i%4===0?10:6);
    ctx.strokeStyle=i===cur?PAL.amber:PAL.roseMinor;ctx.lineWidth=i===cur?2:1;
    ctx.beginPath();ctx.moveTo(x,hy);ctx.lineTo(x,hy-tick);ctx.stroke();
    const xs=azX(i*HOUSE+HOUSE/2);
    ctx.strokeStyle=hexA(PAL.roseMinor,0.45);ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(xs,hy-3);ctx.lineTo(xs,hy+3);ctx.stroke();
    ctx.fillStyle=i===cur?PAL.amber:hexA(PAL.dim,major?0.5:0.28);
    ctx.save();ctx.translate(x,hy-20);ctx.rotate(-Math.PI/2);
    ctx.textAlign='left';ctx.fillText(roseName(i),0,3);ctx.restore();
  }

  // island markers: up-carets just below the horizon ("it lies that way")
  const caret=(x,color)=>{ctx.fillStyle=color;ctx.beginPath();
    ctx.moveTo(x,hy+3);ctx.lineTo(x-5,hy+11);ctx.lineTo(x+5,hy+11);ctx.closePath();ctx.fill();};
  const name=(x,y,txt,color)=>{ctx.fillStyle=color;ctx.textAlign='center';ctx.fillText(txt,x,y);};
  ctx.font='10px "IBM Plex Mono",monospace';
  if(mode==='puzzle'&&puzzle){
    puzzle.candidates.forEach((cd,i)=>{
      if(i===puzzle.chosenIndex)return;
      const az=gcBearing(cn,cd);if(!inView(relAz(az)))return;
      const x=azX(az), hot=i===hoverIdx;
      caret(x,hot?hexA(PAL.amber,0.6):hexA(PAL.dim,0.7));
      name(x,hy+24,cd.name,hot?hexA(PAL.amber,0.8):PAL.dim);
    });
  }
  const azA=gcBearing(cn,A);
  if(inView(relAz(hdg))){const x=azX(hdg);caret(x,PAL.teal);name(x,hy+38,B.name,PAL.faint);}
  if(inView(relAz(azA))){const x=azX(azA);caret(x,hexA(PAL.teal,0.5));name(x,hy+38,A.name,PAL.dim);}
  if(C&&refDeg!=null&&inView(relAz(refDeg))){
    const x=azX(refDeg);
    ctx.strokeStyle=hexA(PAL.amber,0.18);ctx.lineWidth=3;      // sky beam at the ref bearing
    ctx.beginPath();ctx.moveTo(x,hy);ctx.lineTo(x,hy-64);ctx.stroke();
    caret(x,PAL.amber);name(x,hy+24,C.name,PAL.amber);
  }

  // bow: two mirrored wireframe curves anchored at the heading azimuth — it's
  // part of the boat, so it slides out of frame when you look abeam
  if(inView(relAz(hdg))){
    const bx=azX(hdg), bw=W*CFG.bowW, bh=H*CFG.bowH, by=H+pitch*pxDeg;
    ctx.strokeStyle=hexA(PAL.starlight,0.35);ctx.lineWidth=1.5;
    for(const s of [1,-1]){
      ctx.beginPath();ctx.moveTo(bx+s*bw,by+2);
      ctx.quadraticCurveTo(bx+s*bw*0.35,by-bh*0.55,bx,by-bh);ctx.stroke();
    }
  }
}

function draw(){
  ctx.setTransform(DPR,0,0,DPR,0,0);
  drawSky();

  const cn=canoeAt(t);
  const refDeg=C?gcBearing(cn,C):null;
  const cur=refDeg==null?-1:houseOf(refDeg);
  const be=ease(b);

  if(be<0.55){   // chart/navigator passes, fully covered past the fade midpoint
    const v=viewParams(cn);
    const Pw=v.P;
    const Aw=project(A),Bw=project(B);

    // ---- world-space pass ----
    ctx.save();applyTransform(v);
    drawCoast(v);
    if(story){                     // story mode: migration arcs over bare coastlines
      drawArcs(v,story.beat,story.tBeat);
      ctx.restore();
      drawArcLabels(v,story.beat,story.tBeat);
    }else if(mode==='settlement'){ // settlement mode: the year timeline, plus clickable places
      drawTimeline(v);
      ctx.restore();
      drawPlaces(v);
    }else{
      drawRangeRings(v);
      drawCourse(v,Aw,Bw);
      drawTrails(v,Pw,Aw);
      drawRose(Pw,v,cur);
      drawBearings(v,Pw);
      drawCanoe(v,Pw,Aw,Bw);
      ctx.restore();

      // ---- screen-space pass ----
      drawGazetteer(v);
      drawMarkersAndLabels(v,Pw,Aw,Bw,cur);
    }
  }

  // boat view fades through night: first half darkens, second half draws lines
  if(be>0.002){
    ctx.fillStyle=hexA(PAL.night,Math.min(1,be*2));
    ctx.fillRect(0,0,W,H);
    const ba=Math.max(0,be*2-1);
    if(ba>0){ctx.save();ctx.globalAlpha=ba;drawBoatView(cn,refDeg,cur);ctx.restore();}
  }
  updateReadout(refDeg);
}

// ---------- UI ----------
const readoutEl=document.getElementById('readout');
let lastReadout='';
function updateReadout(refDeg){
  let sail='';
  if(bTarget===1){
    const cnR=canoeAt(t);
    const zone=Math.round(((cnR.lon%360)+360)%360/15);            // nautical time zone
    const d=new Date(voyageMs()+zone*3600e3);
    const MO=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const hhmm=`${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;
    sail=` · <b>${MO[d.getUTCMonth()]} ${d.getUTCDate()} ${d.getUTCFullYear()}</b> · <b>${hhmm}</b>`+
      ` · facing <b>${String(Math.round((gcBearing(cnR,B)+look+720)%360)).padStart(3,'0')}°</b>`;
  }
  if(refDeg==null){
    const html=`<b>choose a reference island</b> — watch the ghost bearings sweep<br>`+
      `leg <b>${Math.round(legNm)} nm</b> · voyage <b>${Math.round(t*100)}%</b>${sail}`;
    if(html!==lastReadout){lastReadout=html;readoutEl.innerHTML=html;}
    return;
  }
  const seg=boundaries.filter(b=>b<t).length+1;
  if(seg!==lastSeg){lastSeg=seg;
    [...etakStrip.children].forEach((el,i)=>el.classList.toggle('past',boundaries[i]<t));}
  const total=boundaries.length+1;
  const segName=total>1&&seg===total?' — etak of sighting':
                total>2&&seg===total-1?' — etak of birds':'';
  const h=houseOf(refDeg), c=ETAK_COMPASS[h];
  const houseName=c.car?`${c.pre?c.pre+' ':''}<b>${c.car}</b> · ${c.star}`:`<b>${c.star}</b>`;
  const html=
    `etak <b class="etakN">${seg}</b> of <b>${total}</b>${segName}<br>`+
    `bearing to reference <b>${refDeg.toFixed(1).padStart(5,'0')}°</b> · house <b>${h+1}</b>/32 — ${houseName}<br>`+
    `leg <b>${Math.round(legNm)} nm</b> · voyage <b>${Math.round(t*100)}%</b>${sail}`;
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

// compact score line tucked under the chosen candidate's button
const scoreDetail=document.createElement('div');
scoreDetail.className='detail';
function updateScorePanel(){
  if(!live||mode!=='puzzle'||!puzzle||puzzle.chosenIndex<0){scoreDetail.remove();return;}
  scoreDetail.innerHTML=
    `<b>${live.total}</b>/100 · ${live.segs} etak${live.segs===1?'':'s'} · evenness ${Math.round(live.even*100)}%<br>`+
    verdictText(live);
  const btn=chooserEl.querySelectorAll('button')[puzzle.chosenIndex];
  if(btn)btn.after(scoreDetail);
}

const chooserEl=document.getElementById('chooser');
function buildChooserUI(){
  chooserEl.querySelectorAll('button').forEach(b=>b.remove());
  hoverIdx=-1;
  const revealed=puzzle.chosenIndex>=0;
  puzzle.candidates.forEach((cd,i)=>{
    const btn=document.createElement('button');
    btn.innerHTML=`<span>${cd.name.trim()}</span>`+(revealed?`<span class="sc">${cd.score.total}</span>`:'');
    btn.addEventListener('click',()=>applyChoice(i));
    btn.addEventListener('mouseenter',()=>{hoverIdx=i;});
    btn.addEventListener('mouseleave',()=>{hoverIdx=-1;});
    chooserEl.appendChild(btn);
  });
}

// ---------- controls ----------
const playBtn=document.getElementById('play'),scrub=document.getElementById('scrub'),speedEl=document.getElementById('speed');
function setPlaying(p){playing=p;playBtn.textContent=p?'❚❚':'▶';}
playBtn.addEventListener('click',()=>{
  if(mode==='settlement'){
    if(!settle.playing&&settle.year>=TL.max)setYear(TL.min);
    settle.until=TL.max;
    setTlPlaying(!settle.playing);
    return;
  }
  if(!playing&&t>=1)t=0;setPlaying(!playing);
});
scrub.addEventListener('input',()=>{
  if(mode==='settlement'){setYear(TL.min+ +scrub.value*(TL.max-TL.min));setTlPlaying(false);return;}
  t=+scrub.value;setPlaying(false);
});
speedEl.addEventListener('input',()=>{speedMul=+speedEl.value;});

const frameHint=document.querySelector('.frames .hint');
const departWrap=document.getElementById('departWrap'),departEl=document.getElementById('depart');
departEl.value=CFG.depart.slice(0,16);
departEl.addEventListener('change',()=>{
  const ms=Date.parse(departEl.value+':00Z');     // picker value is UTC by convention
  if(!isNaN(ms))DEPART_MS=ms;
});
document.getElementById('fChart').addEventListener('click',e=>{fTarget=0;bTarget=0;departWrap.classList.add('hidden');frameHint.textContent='same voyage, three frames';frameActive(e.target);});
document.getElementById('fEtak').addEventListener('click',e=>{fTarget=1;bTarget=0;departWrap.classList.add('hidden');frameHint.textContent='same voyage, three frames';frameActive(e.target);});
document.getElementById('fBoat').addEventListener('click',e=>{bTarget=1;look=0;pitch=0;departWrap.classList.remove('hidden');frameHint.textContent='drag the sea to look around';frameActive(e.target);});

// arrow keys while aboard: ←/→ swing the gaze, ↑/↓ tilt it
addEventListener('keydown',e=>{
  if(bTarget!==1||e.target.tagName==='INPUT')return;
  if(e.key==='ArrowLeft'){look-=CFG.lookStep;e.preventDefault();}
  else if(e.key==='ArrowRight'){look+=CFG.lookStep;e.preventDefault();}
  else if(e.key==='ArrowUp'){pitch+=CFG.lookStep;clampPitch();e.preventDefault();}
  else if(e.key==='ArrowDown'){pitch-=CFG.lookStep;clampPitch();e.preventDefault();}
});
function frameActive(btn){document.querySelectorAll('.frames button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}

const mPuzzle=document.getElementById('mPuzzle'),mSandbox=document.getElementById('mSandbox');
const mSettle=document.getElementById('mSettle');
const newBtn=document.getElementById('newBtn'),subEl=document.getElementById('sub');
const framesEl=document.querySelector('.frames');
function setMode(m){
  mode=m;
  mPuzzle.classList.toggle('active',m==='puzzle');
  mSandbox.classList.toggle('active',m==='sandbox');
  mSettle.classList.toggle('active',m==='settlement');
  chooserEl.classList.toggle('hidden',m!=='puzzle');
  newBtn.classList.toggle('hidden',m!=='puzzle');
  eraList.classList.toggle('hidden',m!=='settlement');
  settleCard.classList.toggle('hidden',m!=='settlement');
  framesEl.classList.toggle('hidden',m==='settlement');
  readoutEl.classList.toggle('hidden',m==='settlement');
  document.getElementById('storyBtn').classList.toggle('hidden',m==='settlement');   // the tab IS the story
  yearLabel.classList.toggle('hidden',m!=='settlement');    // the bar stays: it becomes the time slider
  etakStrip.classList.toggle('hidden',m==='settlement');
  if(m==='settlement'){
    setPlaying(false);fTarget=0;bTarget=0;departWrap.classList.add('hidden');
    frameActive(document.getElementById('fChart'));
    subEl.textContent='How the Pacific was settled. Press play or drag the years; click a landfall for its story.';
    setEra(0);                       // always open on the whole ocean
  }
  else if(m==='puzzle'){makePuzzle();}
  else{subEl.textContent='Free exploration. Drag the reference island; watch how its position reshapes the etaks. Scroll to zoom, drag the sea to pan.';makeSandbox();}
}
mPuzzle.addEventListener('click',()=>setMode('puzzle'));
mSandbox.addEventListener('click',()=>setMode('sandbox'));
mSettle.addEventListener('click',()=>setMode('settlement'));
newBtn.addEventListener('click',()=>{passageIndex=(passageIndex+1)%ETAK_PASSAGES.length;makePuzzle();});

// ---------- settlement mode control ----------
const eraList=document.getElementById('eraList');
const settleCard=document.getElementById('settleCard');
const settleEra=document.getElementById('settleEra'),settleTitle=document.getElementById('settleTitle');
const settleText=document.getElementById('settleText');
const yearLabel=document.getElementById('yearLabel');
function showEraCard(){
  settlePlace=null;
  const bt=ETAK_STORY[settle.beat];
  settleEra.textContent=bt.era;settleTitle.textContent=bt.title;settleText.textContent=bt.text;
}
function showPlaceCard(p){
  settlePlace=p;
  settleEra.textContent=p.date;settleTitle.textContent=p.name;settleText.textContent=p.blurb;
}
function setYear(y){
  settle.year=y;
  scrub.value=(y-TL.min)/(TL.max-TL.min);
  yearLabel.textContent=yearText(y);
}
function setTlPlaying(p){settle.playing=p;playBtn.textContent=p?'❚❚':'▶';}
// an era click flies the camera, shows the card, and plays that era's years
function setEra(i){
  settle.beat=i;
  [...eraList.querySelectorAll('button')].forEach((b,k)=>b.classList.toggle('chosen',k===i));
  camTarget=fitPoints(ETAK_STORY[i].fit.map(project),CFG.storyFitFrac);
  const er=TL.eras[i];
  if(er.start<er.end&&!reduceMotion){setYear(er.start);settle.until=er.end;setTlPlaying(true);}
  else{setYear(er.end);setTlPlaying(false);}
  showEraCard();
}
ETAK_STORY.forEach((bt,i)=>{
  const btn=document.createElement('button');
  btn.innerHTML=`<span>${bt.title}</span>`;
  btn.addEventListener('click',()=>setEra(i));
  eraList.appendChild(btn);
});
document.getElementById('settleClose').addEventListener('click',showEraCard);

// ---------- story mode control ----------
const storyCard=document.getElementById('storyCard');
const storyEra=document.getElementById('storyEra'),storyTitle=document.getElementById('storyTitle');
const storyText=document.getElementById('storyText'),storyNext=document.getElementById('storyNext');
const storyChrome=[document.querySelector('.bar'),document.querySelector('.modeswitch'),
                   document.querySelector('.frames'),readoutEl,document.getElementById('storyBtn')];
const storySeen=()=>{try{return localStorage.getItem('etakStorySeen');}catch(_){return '1';}};

function storyShowBeat(){
  const bt=ETAK_STORY[story.beat];
  story.tBeat=0;
  camTarget=fitPoints(bt.fit.map(project),CFG.storyFitFrac);
  storyEra.textContent=bt.era;storyTitle.textContent=bt.title;storyText.textContent=bt.text;
  storyNext.textContent=story.beat===ETAK_STORY.length-1?'SAIL ⟶':'NEXT ⟶';
}
function startStory(){
  setPlaying(false);fTarget=0;bTarget=0;t=0;scrub.value=0;
  story={beat:0,tBeat:0};
  storyChrome.forEach(el=>el.classList.add('hidden'));
  chooserEl.classList.add('hidden');newBtn.classList.add('hidden');departWrap.classList.add('hidden');
  storyCard.classList.remove('hidden');
  storyShowBeat();
}
function endStory(){
  story=null;camTarget=null;
  try{localStorage.setItem('etakStorySeen','1');}catch(_){}
  storyCard.classList.add('hidden');
  storyChrome.forEach(el=>el.classList.remove('hidden'));
  chooserEl.classList.toggle('hidden',mode!=='puzzle');
  newBtn.classList.toggle('hidden',mode!=='puzzle');
  fitLeg();
}
function storyStep(dir){
  if(dir>0){story.beat<ETAK_STORY.length-1?(story.beat++,storyShowBeat()):endStory();}
  else if(story.beat>0){story.beat--;storyShowBeat();}
}
storyNext.addEventListener('click',()=>storyStep(1));
document.getElementById('storySkip').addEventListener('click',endStory);
document.getElementById('storyBtn').addEventListener('click',()=>{if(!story)startStory();});
addEventListener('keydown',e=>{
  if(!story)return;
  if(e.key==='Escape')endStory();
  else if(e.key==='ArrowRight'){storyStep(1);e.preventDefault();}
  else if(e.key==='ArrowLeft'){storyStep(-1);e.preventDefault();}
});

// ---------- camera + sandbox drag (chart frame) ----------
let dragMode=null,lastX=0,lastY=0;   // 'ref' | 'pan' | 'gaze' | null
let downX=0,downY=0;                 // pointerdown position (settlement click-vs-drag)
canvas.addEventListener('pointerdown',e=>{
  if(story)return;                     // camera belongs to the story flights
  if(bTarget===1){                     // aboard: drag turns your gaze
    dragMode='gaze';lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);return;
  }
  if(mode==='sandbox'){
    const cs=worldToScreen(project(C));
    if(Math.hypot(cs.x-e.clientX,cs.y-e.clientY)<CFG.refHitR){dragMode='ref';canvas.setPointerCapture(e.pointerId);return;}
  }
  if(ease(f)<0.5){dragMode='pan';downX=lastX=e.clientX;downY=lastY=e.clientY;canvas.setPointerCapture(e.pointerId);}
});
canvas.addEventListener('pointermove',e=>{
  if(dragMode==='gaze'){
    look=(look-(e.clientX-lastX)*(CFG.fov/W))%360;
    pitch+=(e.clientY-lastY)*(CFG.fov/W);clampPitch();
    lastX=e.clientX;lastY=e.clientY;
  }
  else if(dragMode==='ref'){const w=screenToWorld(e.clientX,e.clientY);const p=unproject(w);C.lat=p.lat;C.lon=p.lon;recompute();}
  else if(dragMode==='pan'){
    const a=screenToWorld(lastX,lastY),b=screenToWorld(e.clientX,e.clientY);
    cam.cx+=a.x-b.x;cam.cy+=a.y-b.y;lastX=e.clientX;lastY=e.clientY;
    camTarget=null;                    // the hand interrupts any camera flight
  }
});
canvas.addEventListener('pointerup',e=>{
  // settlement: a still click (not a pan) hits a reached place → its card; empty sea → era card
  if(mode==='settlement'&&dragMode==='pan'&&Math.hypot(e.clientX-downX,e.clientY-downY)<4){
    const v=viewParams();
    const hit=Object.values(ETAK_PLACES).find(p=>{
      if(p.year>settle.year)return false;
      const s=worldToScreen(project(p),v);
      return Math.hypot(s.x-e.clientX,s.y-e.clientY)<CFG.placeHitR;
    });
    hit?showPlaceCard(hit):showEraCard();
  }
  dragMode=null;
});
canvas.addEventListener('wheel',e=>{
  e.preventDefault();
  if(story||bTarget===1)return;        // no zoom during the story or from the boat
  camTarget=null;                      // the hand interrupts any camera flight
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
  b+=(bTarget-b)*Math.min(1,dt*fSpeed);if(Math.abs(bTarget-b)<0.001)b=bTarget;
  if(story)story.tBeat+=dt;
  else if(mode==='settlement'&&settle.playing){   // timeline playback
    const y=Math.min(settle.until,settle.year+dt*CFG.yearRate*speedMul);
    setYear(y);
    if(y>=settle.until)setTlPlaying(false);
  }
  if(camTarget){                       // story camera flight (zoom eased in log space)
    const k=Math.min(1,dt*(reduceMotion?CFG.fEaseReduced:CFG.storyEase));
    cam.cx+=(camTarget.cx-cam.cx)*k;cam.cy+=(camTarget.cy-cam.cy)*k;
    cam.zoom*=Math.pow(camTarget.zoom/cam.zoom,k);
    if(Math.abs(camTarget.cx-cam.cx)<0.005&&Math.abs(camTarget.cy-cam.cy)<0.005&&
       Math.abs(Math.log(camTarget.zoom/cam.zoom))<0.001){Object.assign(cam,camTarget);camTarget=null;}
  }
  draw();
  requestAnimationFrame(loop);
}
resize();
setMode('puzzle');
if(!storySeen())startStory();
requestAnimationFrame(loop);
})();
