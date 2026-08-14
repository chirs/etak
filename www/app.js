(() => {
'use strict';

const {HOUSE,lerp,gcBearing,gcDistNm,gcInterp,houseOf,etakAt,driftTrack,trackAt,
       boundariesForTrack,altAz,riseAz,gmst,scoreFor,
       verdictText,PLANETS,sunPos,moonPos,planetPos} = EtakCore;

const canvas = document.getElementById('sea');
const ctx = canvas.getContext('2d');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

// ---------- helm mode ----------
// The stripped-down first view: boot straight into the boat with the story skipped
// and the chrome suppressed, leaving only play and speed. Nothing is removed —
// puzzle, sandbox, settlement, the chart and navigator frames, the blind passage and
// every panel below all still exist and still work; `enterHelm` only hides them (see
// `body.helm` in styles.css) and starts in the boat instead of on the chart. Set this
// to false to get the full interface back, unchanged.
const HELM = true;

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
  range:cv('--range'), wave:cv('--wave'), day:cv('--day'), dawn:cv('--dawn'),
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
  helmHorizonUp:300,            // helm: higher horizon — no readout to clear, and the canoe in the
                                // foreground needs sea to sit on (the float rides ~19° below the eye)
  // ---- the canoe: a Carolinian single-outrigger proa (docs/canoe.md) ----
  // Metres from the eye, which sits on the lee platform amidships. x forward along
  // the heading, y to starboard, z up. Projected through the same azimuth/altitude
  // frame as the sky, so the rig holds its place as the gaze swings.
  hullLen:7.5,                  // hull length, m — outer-island voyaging canoe (canoe.md §2)
  eyeFromBow:7.0,               // eye to the bow endpiece, m. The platform sits aft rather than
                                // amidships so the whole rig is forward of the eye: this view is
                                // cylindrical in azimuth and cannot draw geometry that wraps
                                // behind the viewer, and amidships puts half the sail astern.
  hullBeam:0.95,                // hull beam, m
  gunwale:-0.55,                // gunwale relative to the eye, m (eye ~1.2 m over the water)
  endRise:1.3,                  // upswept endpiece above the gunwale, m — the profile cue (§2)
  akaOut:3.2,                   // outrigger float offset to windward, m (§3)
  floatLen:5.0,                 // outrigger float length, m
  floatZ:-1.15,                 // float relative to the eye, m — it rides on the water
  yardTop:3.2,                  // crab-claw yard tip above the eye, m (§4)
  windDeg:60,                   // prevailing NE trades: sets the windward side (§4, no wind model yet)
  sailCloth:0.07,               // sail cloth alpha — low, so the real sky reads through the matting
  sailSpar:0.45,                // spar + leech alpha — higher, so the claw stays legible
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
  waveGap:44,                   // ocean surface: screen px between swell lines
  waveSeg:26,                   // ocean surface: sampling step along a line, px
  waveAmp:2.2,                  // ocean surface: max vertex displacement, px
  waveAlpha:0.05,               // ocean surface: line alpha
  waveSpeed:0.5,                // ocean surface: base phase drift, rad/s
  starHitR:16,                  // boat view: compass-star click hit radius, screen px
  swellN:10,                    // boat view: rolling swell lines below the horizon
  swellSpeed:0.35,              // boat view: swell roll rate, lines per second
  swellAmp:7,                   // boat view: swell undulation at the bow, px (fades aft of the horizon)
  swellAlpha:0.16,              // boat view: swell line alpha at the bow
  blindQs:2,                    // blind passage: navigator questions per voyage
  sightNm:10,                   // boat view: land rises over the horizon within this range
  isleWNm:1.5,                  // boat view: island silhouette half-width, nm
  isleH:9,                      // boat view: island silhouette max height above the horizon, px
  driftMax:0.12,                // blind passage: max current, fraction of boat speed (C3: forgiving)
  dayWash:0.5,                  // boat view: max daytime sky-wash alpha
  miniR:78,                     // helm minimap: disc radius, screen px
  miniPad:24,                   // helm minimap: inset from the top-right corner, screen px
  miniFit:0.66,                 // helm minimap: leg framed into this fraction of the diameter
  miniMaxFrac:0.2,              // helm minimap: largest fraction of the viewport the disc may take
  miniFovReach:0.85,            // helm minimap: field-of-view wedge reach, fraction of the radius
  helmSkyRate:0.75,             // helm: sky hours per real second at speed 1 — leg-length independent,
                                // so Puluwat->Chuuk still runs ~33s and a migration leg takes longer
  portHitR:16,                  // helm picker: island click hit radius, screen px
  portZoom:22,                  // helm picker: zoom (px/deg) above which the Caroline cluster labels
  portFit:0.55,                 // helm picker: the Carolines framed into this fraction on open
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
  else if(HELM&&helmPhase==='select') camTarget=fitPorts();
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
const passageSub=()=>{const pas=ETAK_PASSAGES[passageIndex];subEl.textContent=`${pas.name} — ${pas.note}`;};
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
  setArming(false);
  lastWake=null;
  recompute();
  passageSub();
  buildChooserUI();
  fitLeg();
  t=0;afterHours=0;scrub.value=0;setPlaying(false);
}

function applyChoice(i){
  const firstPick=puzzle.chosenIndex<0;
  puzzle.chosenIndex=i;
  const cand=puzzle.candidates[i];
  C={lat:cand.lat,lon:cand.lon,name:cand.name};
  recompute();
  if(firstPick)buildChooserUI();        // rebuild with all four scores revealed
  [...chooserEl.querySelectorAll('button:not(#sailBtn)')].forEach((b,k)=>b.classList.toggle('chosen',k===i));
  updateScorePanel();                   // re-seat the detail under the (possibly rebuilt) button
  t=0;afterHours=0;scrub.value=0;setPlaying(false);
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
  t=0;afterHours=0;scrub.value=0;setPlaying(false);
}

// ---------- sim state ----------
let t=0,playing=false,speedMul=1,f=0,fTarget=0;
let b=0,bTarget=0;         // boat-view fade (0 = chart/navigator, 1 = horizon view)
let look=0;                // boat-view gaze, degrees off the course heading (0 = dead ahead)
let pitch=0;               // boat-view gaze tilt, degrees above dead-ahead (0 = horizon level)
let starHits=[];           // boat view: compass stars' screen spots, refreshed each frame
let starPick=null;         // boat view: the compass star whose card is open
let DEPART_MS=Date.parse(CFG.depart);             // adjustable via the departure picker (boat view)
let afterHours=0;          // sailing hours logged after landfall — helm mode keeps the sky turning
const voyageMs=()=>DEPART_MS+(t*legHours+afterHours)*3600e3;   // real clock time at voyage fraction t
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
// 'Altair rising' -> 'Altair': the physical star behind a compass point
const starBaseName=st=>st.replace(/ (rising|setting|upright)$/,'').replace(/ at 45°.*$/,'');
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

// ocean surface: sparse screen-space swell lines, each vertex displaced by a slow
// sum-of-sines field. Phase coordinates are anchored to the world origin so the
// texture pans with the chart; drawn before the world pass, so land covers it.
function drawOcean(v){
  const o=worldToScreen({x:0,y:0},v);
  const ph=reduceMotion?0:performance.now()/1000*CFG.waveSpeed;
  ctx.strokeStyle=hexA(PAL.wave,CFG.waveAlpha);ctx.lineWidth=1;
  for(let y=CFG.waveGap/2;y<H;y+=CFG.waveGap){
    ctx.beginPath();
    for(let x=0;x<=W+CFG.waveSeg;x+=CFG.waveSeg){
      const px=x-o.x, py=y-o.y;
      const dy=CFG.waveAmp*(Math.sin(px*0.013+py*0.005+ph)
                           +0.6*Math.sin(px*0.031-py*0.021+ph*1.7)
                           +0.4*Math.sin(py*0.043+px*0.008-ph*1.24));
      x?ctx.lineTo(x,y+dy):ctx.moveTo(x,y+dy);
    }
    ctx.stroke();
  }
}

function drawCoast(v){
  ctx.fillStyle=PAL.land;ctx.fill(landPath);
  ctx.strokeStyle=PAL.coast;ctx.lineWidth=0.6/v.Z;ctx.lineJoin='round';ctx.stroke(landPath);
}

// ---------- helm minimap ----------
// Helm mode has no chart frame to switch to, so this disc is the only "where am I"
// there is: the same coastlines the chart draws (landPath, world coords), the leg,
// and the canoe on it. East-up like every other view here, so north reads to the
// left and the horizon you are facing is the wedge off the canoe.
// Bearings are measured from north clockwise; east-up puts north at screen (-1,0)
// and east at (0,-1), so a bearing θ points along screen angle θ+π.
const miniAngle=deg=>deg*Math.PI/180+Math.PI;
// disc geometry in one place, so the hit test and the drawing cannot drift apart
const miniDisc=()=>{
  const R=Math.min(CFG.miniR,W*CFG.miniMaxFrac,H*CFG.miniMaxFrac);   // never dominate a small viewport
  return {R,mx:W-CFG.miniPad-R,my:CFG.miniPad+R};
};
const overMiniMap=(x,y)=>{const d=miniDisc();return Math.hypot(x-d.mx,y-d.my)<=d.R;};
function drawMiniMap(cn){
  if(!A||!B)return;
  const {R,mx,my}=miniDisc();
  const pts=[project(A),project(B),project(cn)];
  if(C)pts.push(project(C));
  const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
  const minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);
  const span=Math.max(maxx-minx,maxy-miny,0.6);
  // a viewParams-shaped object, so worldToScreen/applyTransform work unchanged
  const v={fe:1,rot:-Math.PI/2,Z:2*R*CFG.miniFit/span,cx:mx,cy:my,
           O:{x:(minx+maxx)/2,y:(miny+maxy)/2},P:project(cn)};

  ctx.save();
  ctx.beginPath();ctx.arc(mx,my,R,0,7);
  ctx.fillStyle=hexA(PAL.night2,0.86);ctx.fill();
  ctx.save();ctx.clip();

  ctx.save();applyTransform(v);
  // brighter than the chart's --land: at this scale it sits on a starfield, not a
  // full viewport of ocean, and the chart tone is nearly the disc's own colour
  ctx.fillStyle=PAL.island;ctx.fill(landPath);
  ctx.strokeStyle=PAL.coast;ctx.lineWidth=0.9/v.Z;ctx.lineJoin='round';ctx.stroke(landPath);
  ctx.restore();

  // the atolls are a pixel or two across here, so the gazetteer carries them —
  // without this the Carolines read as empty ocean between home and destination
  for(const k in ETAK_ISLANDS){
    const I=ETAK_ISLANDS[k];
    if(I.name===A.name||I.name===B.name)continue;
    const s=worldToScreen(project(I),v);
    if(Math.hypot(s.x-mx,s.y-my)>R-3)continue;
    drawMarker(s,hexA(PAL.faint,0.75),null,1.6);
  }

  const sA=worldToScreen(project(A),v),sB=worldToScreen(project(B),v),sP=worldToScreen(project(cn),v);
  ctx.strokeStyle=hexA(PAL.course,0.7);ctx.lineWidth=1;ctx.setLineDash([4,5]);
  ctx.beginPath();ctx.moveTo(sA.x,sA.y);ctx.lineTo(sB.x,sB.y);ctx.stroke();ctx.setLineDash([]);
  // sailed portion, solid over the dashes
  ctx.strokeStyle=hexA(PAL.amber,0.75);ctx.lineWidth=1.4;
  ctx.beginPath();ctx.moveTo(sA.x,sA.y);ctx.lineTo(sP.x,sP.y);ctx.stroke();

  // the field of view, swung by the gaze — what the horizon in front of you covers
  const gaze=gcBearing(cn,B)+look;
  const g0=miniAngle(gaze-CFG.fov/2),g1=miniAngle(gaze+CFG.fov/2);
  const reach=R*CFG.miniFovReach;
  const gr=ctx.createRadialGradient(sP.x,sP.y,0,sP.x,sP.y,reach);
  gr.addColorStop(0,hexA(PAL.starlight,0.12));gr.addColorStop(1,hexA(PAL.starlight,0));
  ctx.fillStyle=gr;
  ctx.beginPath();ctx.moveTo(sP.x,sP.y);ctx.arc(sP.x,sP.y,reach,g0,g1);ctx.closePath();ctx.fill();

  ctx.restore();   // unclip

  drawMarker(sA,PAL.dim,null,2.2);
  drawMarker(sB,PAL.teal,hexA(PAL.teal,0.5),2.8);
  drawMarker(sP,PAL.starlight,hexA(PAL.amber,0.55),3);

  ctx.font='8.5px "IBM Plex Mono",monospace';ctx.textAlign='center';
  ctx.fillStyle=PAL.faint;ctx.fillText(B.name.toUpperCase(),sB.x,sB.y-8);
  ctx.fillStyle=PAL.dim;ctx.fillText(A.name.toUpperCase(),sA.x,sA.y+15);

  ctx.beginPath();ctx.arc(mx,my,R,0,7);
  ctx.strokeStyle=hexA(PAL.roseRing,0.85);ctx.lineWidth=1;ctx.stroke();
  // N at the rim, so east-up does not read as a mistake
  ctx.fillStyle=PAL.dim;ctx.font='9px "IBM Plex Mono",monospace';
  ctx.fillText('N',mx-R+9,my+3);
  ctx.restore();
}

// ---------- helm voyage picker ----------
// The screen before the boat: a chart you pick a leg on. Opens framed on the
// Carolines and zooms out to the settlement landfalls, so the same map carries both
// scales — a half-day inter-island run and a three-week migration crossing.
// The two gazetteers overlap on four names (Puluwat, Lamotrek, Chuuk, Saipan);
// ETAK_ISLANDS wins those, its coordinates being the navigation ones.
const HELM_PORTS=(()=>{
  const out=[],seen=new Set();
  for(const k in ETAK_ISLANDS){const i=ETAK_ISLANDS[k];
    seen.add(i.name);out.push({name:i.name,lat:i.lat,lon:i.lon,near:true});}
  for(const k in ETAK_PLACES){const p=ETAK_PLACES[k];
    if(!seen.has(p.name))out.push({name:p.name,lat:p.lat,lon:p.lon,near:false});}
  return out;
})();
let helmPhase='select';    // 'select' = the picker chart, 'sail' = the boat
let pickFrom=null;         // first island clicked, awaiting a destination
let pickHover=null;        // port under the pointer, for the preview leg

function hitPort(sx,sy){
  const v=viewParams();let best=null,bd=CFG.portHitR;
  for(const p of HELM_PORTS){
    const s=worldToScreen(project(p),v);
    const d=Math.hypot(s.x-sx,s.y-sy);
    if(d<bd){bd=d;best=p;}
  }
  return best;
}

function drawPickerPrompt(){
  ctx.textAlign='center';
  const mid=W/2;
  ctx.font='15px Marcellus,serif';ctx.fillStyle=PAL.starlight;
  ctx.fillText(pickFrom?`SAILING FROM ${pickFrom.name}`:'CHOOSE A VOYAGE',mid,54);
  ctx.font='11px "IBM Plex Mono",monospace';ctx.fillStyle=PAL.faint;
  ctx.fillText(pickFrom?'now click where you are sailing to':'click the island you are sailing from',mid,76);
  // a live leg summary while a destination is under the pointer
  if(pickFrom&&pickHover&&pickHover!==pickFrom){
    const nm=gcDistNm(pickFrom,pickHover), hrs=nm/CFG.canoeKn;
    const dur=hrs<48?`${Math.round(hrs)} h`:`${(hrs/24).toFixed(1)} days`;
    ctx.font='12px "IBM Plex Mono",monospace';ctx.fillStyle=PAL.amber;
    ctx.fillText(`${pickFrom.name} → ${pickHover.name} · ${Math.round(nm)} nm · ${dur}`,mid,102);
  }
  ctx.font='10px "IBM Plex Mono",monospace';ctx.fillStyle=PAL.dim;
  ctx.fillText('scroll to zoom out for the wider ocean',mid,H-26);
}

function drawHelmPicker(v){
  const showNear=v.Z>=CFG.portZoom;     // the Carolines collide at whole-ocean zoom
  ctx.textAlign='left';
  for(const p of HELM_PORTS){
    if(p===pickFrom)continue;                       // drawn hot below, above the leg line
    const s=worldToScreen(project(p),v);
    if(s.x<-60||s.x>W+60||s.y<-60||s.y>H+60)continue;
    const hov=p===pickHover;
    const r=p.near?(showNear?3.5:2):4;
    drawMarker(s,hov?PAL.amber:PAL.island,hov?hexA(PAL.amber,0.5):null,hov?r+1.5:r);
    if(showNear||!p.near){
      ctx.font='10px "IBM Plex Mono",monospace';
      ctx.fillStyle=hov?PAL.starlight:hexA(PAL.dim,0.85);
      ctx.fillText(p.name,s.x+8,s.y+3);
    }
  }
  if(pickFrom){
    const sF=worldToScreen(project(pickFrom),v);
    if(pickHover&&pickHover!==pickFrom){
      const sH=worldToScreen(project(pickHover),v);
      ctx.strokeStyle=hexA(PAL.amber,0.5);ctx.lineWidth=1.5;ctx.setLineDash([5,6]);
      ctx.beginPath();ctx.moveTo(sF.x,sF.y);ctx.lineTo(sH.x,sH.y);ctx.stroke();ctx.setLineDash([]);
    }
    drawMarker(sF,PAL.amber,hexA(PAL.amber,0.55),5);
    ctx.font='10px "IBM Plex Mono",monospace';ctx.textAlign='left';
    ctx.fillStyle=PAL.starlight;ctx.fillText(pickFrom.name,sF.x+9,sF.y+3);
  }
  drawPickerPrompt();
}

// Opening frame: bounding-box zoom so every Caroline island is on screen, but
// centred on the centroid rather than the box. Saipan sits 8° north of the rest of
// the chain, and centring the box lets that one outlier shove the dense cluster —
// the islands you actually pick between — into a corner.
function fitPorts(){
  const pts=HELM_PORTS.filter(p=>p.near).map(project);
  const {zoom}=fitPoints(pts,CFG.portFit);
  return {zoom,
    cx:pts.reduce((s,p)=>s+p.x,0)/pts.length,
    cy:pts.reduce((s,p)=>s+p.y,0)/pts.length};
}

// open the picker: no voyage running, the chart up, framed on the Carolines
function enterHelmPicker(){
  helmPhase='select';pickFrom=null;pickHover=null;
  document.body.classList.add('picking');
  setPlaying(false);hideStarCard();
  fTarget=0;bTarget=0;
  camTarget=fitPorts();
}

// commit the leg and dissolve into the boat — b eases rather than cutting, so the
// chart you just picked on fades into the horizon you picked it for
function startHelmVoyage(from,to){
  A={...from};B={...to};C=null;
  lastWake=null;
  recompute();
  t=0;afterHours=0;scrub.value=0;
  helmPhase='sail';pickFrom=null;pickHover=null;
  document.body.classList.remove('picking');
  bTarget=1;look=0;pitch=0;
  camTarget=null;fitLeg();
  canvas.style.cursor='';
  setPlaying(!reduceMotion);
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

// the last blind run's true track, ghosted beside the planned course
function drawWake(v){
  if(!lastWake)return;
  ctx.save();ctx.strokeStyle=PAL.teal;ctx.globalAlpha=0.5;ctx.lineWidth=1.2/v.Z;
  ctx.setLineDash([2/v.Z,4/v.Z]);
  ctx.beginPath();
  lastWake.forEach((p,k)=>{const w=project(p);k?ctx.lineTo(w.x,w.y):ctx.moveTo(w.x,w.y);});
  ctx.stroke();ctx.setLineDash([]);ctx.restore();
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
// While `story` is set, draw() swaps the voyage layers for migration arcs and
// loop() eases the camera toward `camTarget`. The arc layers are shared with
// settlement mode, so they take (beat,tBeat) rather than reading story state.
let story=null;            // {beat,tBeat} while the walkthrough is playing
let camTarget=null;        // {cx,cy,zoom} the camera eases toward

function arcProgress(bi,ai,beat,tBeat){
  if(bi<beat||reduceMotion)return 1;
  return Math.max(0,Math.min(1,(tBeat-ai*CFG.storyStagger)/CFG.storyArcSec));
}

// one migration arc at progress p: great-circle polyline + head dot
// (head while growing, landfall once there); finished arcs stay as amber shadows
function drawArcPath(v,from,to,p,on){
  ctx.strokeStyle=hexA(PAL.amber,on?0.75:0.42);
  ctx.lineWidth=(on?1.6:1)/v.Z;
  const N=48;
  ctx.beginPath();
  for(let i=0;i<=N;i++){
    const w=project(gcInterp(from,to,p*i/N));
    i?ctx.lineTo(w.x,w.y):ctx.moveTo(w.x,w.y);
  }
  ctx.stroke();
  const hw=project(gcInterp(from,to,p));
  ctx.fillStyle=on?PAL.amber:hexA(PAL.amber,0.65);
  ctx.beginPath();ctx.arc(hw.x,hw.y,(p<1?3:2.2)/v.Z,0,7);ctx.fill();
}

function drawArcs(v,beat,tBeat){
  for(let bi=0;bi<=beat;bi++)
    ETAK_STORY[bi].arcs.forEach((arc,ai)=>{
      const p=arcProgress(bi,ai,beat,tBeat);
      if(p>0)drawArcPath(v,arc.from,arc.to,p,bi===beat);
    });
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
// Every migration arc on one chart, driven by a year timeline (the bottom bar
// becomes a time slider, first departure to last landfall). Each arc grows
// toward its landfall year, starting no earlier than its origin's own
// settlement, so voyages unfold chronologically. Landfalls are clickable.
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

// world-space layer: every arc at its progress for the current year
function drawTimeline(v){
  for(const e of TL.arcs){
    if(e.coda&&settle.beat!==ETAK_STORY.length-1)continue;
    const p=e.coda?1:clamp((settle.year-e.start)/(e.end-e.start||1),0,1);
    if(p>0)drawArcPath(v,e.arc.from,e.arc.to,p,e.coda||p<1);
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
// Pure screen space: CFG.fov degrees of azimuth across the width, centered on
// the course heading plus the gaze (`look` yaw, `pitch` tilt — capped so the
// zenith just reaches the top edge). look=0, pitch=0 faces the destination.
const maxPitch=()=>Math.max(0,90-(Math.max(H*0.5,H-CFG.horizonUp)-14)*CFG.fov/W);
const clampPitch=()=>{pitch=Math.min(Math.max(pitch,0),maxPitch());};
function drawBoatView(cn,refDeg,cur){
  // aboard blind the helm holds the planned course, unaware of displacement;
  // otherwise the view homes on the destination
  const hdg=blind?gcBearing(canoeAt(Math.min(t,0.999)),B):gcBearing(cn,B);
  const relAz=az=>((az-hdg-look+540)%360)-180;      // degrees off the gaze center
  const inView=rel=>Math.abs(rel)<CFG.fov/2+8;
  const pxDeg=W/CFG.fov;                            // px per degree, both axes
  const azX=az=>W/2+relAz(az)*pxDeg;
  const hy=Math.max(H*0.5,H-(HELM?CFG.helmHorizonUp:CFG.horizonUp))+pitch*pxDeg;
  ctx.lineWidth=1;

  // ---- the sun: day, twilight, and star visibility derive from its altitude ----
  const jd=voyageMs()/86400000+2440587.5;
  const lst=(gmst(jd)+cn.lon)%360;
  const su=sunPos(jd), ps=altAz(su.ra,su.dec,cn.lat,lst);
  const dayF=clamp((ps.alt+6)/12,0,1);          // 0 below civil twilight, 1 by mid-morning
  const dayA=dayF*CFG.dayWash;
  const starVis=clamp((-ps.alt-1)/7,0,1);       // stars full below alt -8, gone by -1
  const duskA=Math.exp(-Math.pow((ps.alt+1.5)/7,2));   // warm band just under the horizon

  // day wash over the sky (half strength over the sea), then the twilight glow
  // anchored at the sun's true azimuth — dawn breaks in the east
  if(dayA>0.002){
    ctx.fillStyle=hexA(PAL.day,dayA);ctx.fillRect(0,0,W,hy);
    ctx.fillStyle=hexA(PAL.day,dayA*0.4);ctx.fillRect(0,hy,W,H-hy);
  }
  if(duskA>0.01&&inView(relAz(ps.az))){
    const sx=azX(ps.az);
    const g=ctx.createRadialGradient(sx,hy,0,sx,hy,W*0.45);
    g.addColorStop(0,hexA(PAL.dawn,0.5*duskA));g.addColorStop(1,hexA(PAL.dawn,0));
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  }

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

  // swell: horizon-parallel lines rolling toward the viewer with perspective,
  // undulating over azimuth (so turning the gaze pans the pattern with the sky).
  // A line's cycle ends exactly at the screen bottom, so the wrap is invisible.
  const ph=reduceMotion?0:performance.now()/1000;
  for(let k=0;k<CFG.swellN;k++){
    const u=((k+ph*CFG.swellSpeed)%CFG.swellN)/CFG.swellN;
    const d=u*u;                                 // perspective: crowd near the horizon
    const y0=hy+2+d*(H-hy-2);
    ctx.strokeStyle=hexA(PAL.wave,CFG.swellAlpha*(0.2+0.8*u));
    ctx.beginPath();
    for(let x=0;x<=W+CFG.waveSeg;x+=CFG.waveSeg){
      const az=(x-W/2)/pxDeg+hdg+look;
      const dy=(0.15+0.85*d)*CFG.swellAmp*
        (Math.sin(az*0.5+u*7+ph*0.7)+0.6*Math.sin(az*1.3+u*3-ph*1.1))/1.6;
      x?ctx.lineTo(x,y0+dy):ctx.moveTo(x,y0+dy);
    }
    ctx.stroke();
  }

  // horizon: soft glow under a crisp line
  ctx.strokeStyle=hexA(PAL.teal,0.22);ctx.lineWidth=3.5;
  ctx.beginPath();ctx.moveTo(0,hy);ctx.lineTo(W,hy);ctx.stroke();
  ctx.strokeStyle=hexA(PAL.teal,0.85);ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(0,hy);ctx.lineTo(W,hy);ctx.stroke();

  // the real sky, turning with sailing time. Atmospheric extinction dims stars
  // toward the sea line by airmass; k=0.075 mag/airmass is gentler than the
  // physical ~0.25 so the low sky stays alive.
  const dimAt=alt=>Math.pow(10,-0.03*(1/Math.sin(Math.max(alt,1.5)*Math.PI/180)-1));

  // milky way: a soft glow along the galactic equator under a scatter of dust,
  // clipped to the sky so the band can run right down to the sea line
  if(starVis>0.02){
  ctx.save();ctx.beginPath();ctx.rect(0,14,W,hy-14);ctx.clip();
  for(const [ra,dec,ints] of MILKY.glow){
    const p=altAz(ra,dec,cn.lat,lst);
    if(p.alt<-6||Math.abs(relAz(p.az))>CFG.fov/2+16)continue;
    const x=azX(p.az), y=hy-p.alt*pxDeg, r=13*pxDeg;
    const a=0.07*ints*dimAt(Math.max(p.alt,3))*starVis;
    const g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,hexA(PAL.starlight,a));g.addColorStop(1,hexA(PAL.starlight,0));
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill();
  }
  for(const [ra,dec,r0,a0] of MILKY.dust){
    const p=altAz(ra,dec,cn.lat,lst);
    if(p.alt<-0.5||!inView(relAz(p.az)))continue;
    const a=a0*dimAt(p.alt)*starVis;if(a<0.015)continue;
    ctx.fillStyle=hexA(PAL.starlight,a);
    ctx.beginPath();ctx.arc(azX(p.az),hy-p.alt*pxDeg,r0,0,7);ctx.fill();
  }
  ctx.restore();
  }

  const curBase=cur>=0?starBaseName(ETAK_COMPASS[cur].star):null;
  if(starVis>0.02)for(const [ra,dec,mag] of STAR_MAP.field){
    const p=altAz(ra,dec,cn.lat,lst);
    if(p.alt<-0.5||!inView(relAz(p.az)))continue;
    const y=hy-p.alt*pxDeg;if(y<14)continue;
    const dim=dimAt(p.alt), a=Math.max(0.2,0.85-0.1*mag)*dim*starVis;
    if(a<0.03)continue;
    ctx.fillStyle=hexA(PAL.starlight,a);
    ctx.beginPath();ctx.arc(azX(p.az),y,Math.max(0.55,2.7-0.33*mag)*(0.5+0.5*dim),0,7);ctx.fill();
  }
  ctx.font='9px "IBM Plex Mono",monospace';ctx.textAlign='left';
  starHits.length=0;
  if(starVis>0.05){                    // by day there is no star to steer by, or to click
  ctx.save();ctx.globalAlpha=starVis;
  for(const s of STAR_MAP.compass){
    const p=altAz(s.ra,s.dec,cn.lat,lst);
    if(p.alt<-0.5||!inView(relAz(p.az)))continue;
    const y=hy-p.alt*pxDeg;if(y<14)continue;
    const x=azX(p.az), hot=s.group===curBase;
    starHits.push({x,y,s,alt:p.alt,az:p.az});
    drawMarker({x,y},hot?PAL.amber:hexA(PAL.starlight,Math.max(0.25,0.9*dimAt(p.alt))),
               hot?hexA(PAL.amber,0.4):null,hot?2.6:Math.max(1.4,2.6-0.5*s.mag));
    if(s===starPick){ctx.strokeStyle=PAL.teal;ctx.lineWidth=1;
      ctx.beginPath();ctx.arc(x,y,6,0,7);ctx.stroke();}
    if(s.lbl){ctx.fillStyle=hot?PAL.amber:hexA(PAL.dim,0.6);ctx.fillText(s.car||s.name,x+7,y+3);}
  }
  ctx.restore();
  }

  // wanderers: the five naked-eye planets as bright labeled dots, then the Moon
  // with its true phase (bright limb facing the sun's sky position)
  if(starVis>0.02)for(const name of PLANETS){
    const pl=planetPos(name,jd), p=altAz(pl.ra,pl.dec,cn.lat,lst);
    if(p.alt<-0.5||!inView(relAz(p.az)))continue;
    const y=hy-p.alt*pxDeg;if(y<14)continue;
    const dim=dimAt(p.alt), a=Math.min(1,0.85-0.1*pl.mag)*dim*starVis;
    if(a<0.04)continue;
    const x=azX(p.az);
    ctx.fillStyle=hexA(PAL.starlight,a);
    ctx.beginPath();ctx.arc(x,y,Math.max(0.8,2.7-0.33*pl.mag)*(0.5+0.5*dim),0,7);ctx.fill();
    ctx.fillStyle=hexA(PAL.dim,(0.15+0.5*dim)*starVis);ctx.fillText(name,x+7,y+3);
  }
  const mo=moonPos(jd), pm=altAz(mo.ra,mo.dec,cn.lat,lst);
  if(pm.alt>-0.5&&inView(relAz(pm.az))){
    const x=azX(pm.az), y=hy-pm.alt*pxDeg;
    if(y>=14){
      const Rm=Math.max(4,0.3*pxDeg);                 // true disc is ~0.26° — a touch of looming
      const th=Math.atan2((hy-ps.alt*pxDeg)-y,azX(ps.az)-x);
      const dim=(0.35+0.65*dimAt(pm.alt))*(1-0.5*dayF);   // the moon survives, paler by day
      ctx.fillStyle=hexA(PAL.starlight,0.08*dim*(1-dayF));// earthshine drowns in daylight
      ctx.beginPath();ctx.arc(x,y,Rm,0,7);ctx.fill();
      const k=2*mo.phase-1;                           // -1 new .. +1 full
      ctx.fillStyle=hexA(PAL.starlight,0.85*dim);
      ctx.beginPath();
      ctx.arc(x,y,Rm,th-Math.PI/2,th+Math.PI/2);      // sunward semicircle of the limb
      ctx.ellipse(x,y,Rm*Math.abs(k),Rm,th,Math.PI/2,3*Math.PI/2,k<0);  // terminator
      ctx.fill();
    }
  }

  // the sun itself: a bright disc once it clears the sea line
  if(ps.alt>-1&&inView(relAz(ps.az))){
    const x=azX(ps.az), y=hy-ps.alt*pxDeg;
    if(y>=14){
      const Rs=Math.max(4,0.3*pxDeg);
      const g=ctx.createRadialGradient(x,y,Rs*0.5,x,y,Rs*5);
      g.addColorStop(0,hexA(PAL.starlight,0.9));g.addColorStop(1,hexA(PAL.starlight,0));
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,Rs*5,0,7);ctx.fill();
      ctx.fillStyle=PAL.starlight;ctx.beginPath();ctx.arc(x,y,Rs,0,7);ctx.fill();
    }
  }

  // land: any real island inside sighting range rises as a dark silhouette at
  // its true azimuth — palm tops over the curve, occluding the stars. True
  // angular width from the distance; fades in over the outer edge of range.
  for(const isl of Object.values(ETAK_ISLANDS)){
    const d=gcDistNm(cn,isl);
    if(d>CFG.sightNm||d<0.3)continue;              // beyond sight, or standing on it
    const az=gcBearing(cn,isl);
    if(!inView(relAz(az)))continue;
    const x=azX(az), near=1-d/CFG.sightNm;
    const hw=Math.min(Math.atan2(CFG.isleWNm,d)*180/Math.PI*pxDeg, 14*pxDeg);
    const h=2+CFG.isleH*near;
    ctx.save();ctx.globalAlpha=Math.min(1,near*4);
    ctx.beginPath();
    ctx.moveTo(x-hw,hy+1);
    ctx.quadraticCurveTo(x-hw*0.5,hy-h,x-hw*0.15,hy-h);
    ctx.lineTo(x+hw*0.15,hy-h);
    ctx.quadraticCurveTo(x+hw*0.5,hy-h,x+hw,hy+1);
    ctx.fillStyle=PAL.land;ctx.fill();             // fill auto-closes along the sea line
    ctx.strokeStyle=hexA(PAL.coast,0.9);ctx.lineWidth=1;
    ctx.stroke();                                  // open path: strokes the top edge only
    ctx.restore();
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
  // Helm picks its own leg, so the passage's candidate references are stale there —
  // without this guard the Caroline atolls caret onto the horizon while you sail
  // somewhere else entirely, having never been chosen or even shown.
  if(!HELM&&mode==='puzzle'&&puzzle){
    puzzle.candidates.forEach((cd,i)=>{
      if(i===(blind?blind.idx:puzzle.chosenIndex))return;
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

  // ---- the canoe (docs/canoe.md) ----
  // A Carolinian proa, not a yacht: double-ended hull with upswept endpieces, one
  // outrigger float carried to windward, and an Oceanic-lateen crab-claw sail.
  // Every part is a point in metres from the eye, turned into this view's own
  // azimuth/altitude frame — so the whole vessel holds still relative to the boat
  // and slides correctly through the frame as the gaze swings.
  const R2D=180/Math.PI;
  const rig=(x,y,z)=>({
    x:azX(hdg+Math.atan2(y,x)*R2D),
    y:hy-Math.atan2(z,Math.hypot(x,y))*R2D*pxDeg,
    rel:relAz(hdg+Math.atan2(y,x)*R2D),
  });
  // The float rides to windward. There is no wind model yet, so the prevailing NE
  // trades stand in — the side is then correct, and the code is wind-ready.
  const ws=(((CFG.windDeg-hdg+540)%360)-180)>=0?1:-1;   // +1 = float to starboard
  const lee=-ws;                                        // sail sets to leeward
  const yc=-lee*0.15;                   // hull centreline: the eye sits just lee of it
  const fwd=CFG.eyeFromBow, hb=CFG.hullBeam/2, g=CFG.gunwale;

  // outrigger: forward and off to windward, filling the frame as the gaze swings
  const fy=yc+ws*CFG.akaOut, fc=fwd*0.46, fl=CFG.floatLen/2;
  const fA=rig(fc+fl,fy,CFG.floatZ), fB=rig(fc-fl,fy,CFG.floatZ);
  if(Math.abs(fA.rel)<CFG.fov||Math.abs(fB.rel)<CFG.fov){
    ctx.save();
    ctx.strokeStyle=hexA(PAL.starlight,0.3);ctx.lineWidth=1.2;
    for(const bx of [fwd*0.3,fwd*0.62]){                // two booms, arching out and down
      const gun=rig(bx,yc+ws*hb,g), end=rig(bx,fy,CFG.floatZ+0.3);
      const mid=rig(bx,(yc+ws*hb+fy)/2,g+0.15);         // the arch
      ctx.beginPath();ctx.moveTo(gun.x,gun.y);
      ctx.quadraticCurveTo(mid.x,mid.y,end.x,end.y);ctx.stroke();
      // stanchion struts: the boom meets the log through a little cluster (§3)
      for(const d of [-0.4,0,0.4]){
        const s0=rig(bx+d*0.5,fy,CFG.floatZ+0.3), s1=rig(bx+d,fy,CFG.floatZ);
        ctx.beginPath();ctx.moveTo(s0.x,s0.y);ctx.lineTo(s1.x,s1.y);ctx.stroke();
      }
    }
    const fT=rig(fc+fl*0.5,fy,CFG.floatZ+0.2), fU=rig(fc-fl*0.5,fy,CFG.floatZ+0.2);
    const flt=new Path2D();                             // a log, pointed at both ends
    flt.moveTo(fA.x,fA.y);
    flt.quadraticCurveTo(fT.x,fT.y,(fA.x+fB.x)/2,(fT.y+fU.y)/2);
    flt.quadraticCurveTo(fU.x,fU.y,fB.x,fB.y);
    flt.quadraticCurveTo((fA.x+fB.x)/2,(fA.y+fB.y)/2+5,fA.x,fA.y);
    ctx.fillStyle=PAL.night;ctx.fill(flt);
    ctx.strokeStyle=hexA(PAL.starlight,0.4);ctx.lineWidth=1.4;ctx.stroke(flt);
    ctx.restore();
  }

  if(inView(relAz(hdg))){
    // crab-claw sail: two spars splaying from a low tack at the bow, the leech
    // curving between their tips. Cloth kept sheer so the sky reads through it;
    // spars and leech carry the shape (canoe.md §4, and the decision in §5).
    const T=rig(fwd*0.92,yc,g+0.25);                    // tack, footed at the bow end
    const Y=rig(fwd*0.55,yc+lee*0.55,CFG.yardTop);      // yard tip: high and aft
    const Bm=rig(fwd*0.34,yc+lee*1.35,g+1.2);           // boom tip: aft and outboard
    const mx=(Y.x+Bm.x)/2, my=(Y.y+Bm.y)/2;
    const lx=mx+(mx-T.x)*0.2, ly=my+(my-T.y)*0.2;       // leech bows away from the tack
    const sail=new Path2D();
    sail.moveTo(T.x,T.y);sail.lineTo(Y.x,Y.y);
    sail.quadraticCurveTo(lx,ly,Bm.x,Bm.y);sail.closePath();
    ctx.fillStyle=hexA(PAL.starlight,CFG.sailCloth);ctx.fill(sail);
    ctx.strokeStyle=hexA(PAL.starlight,CFG.sailSpar);ctx.lineWidth=1.6;
    ctx.beginPath();ctx.moveTo(T.x,T.y);ctx.lineTo(Y.x,Y.y);ctx.stroke();   // yard
    ctx.beginPath();ctx.moveTo(T.x,T.y);ctx.lineTo(Bm.x,Bm.y);ctx.stroke(); // boom
    ctx.lineWidth=1.3;ctx.strokeStyle=hexA(PAL.starlight,CFG.sailSpar*0.75);
    ctx.beginPath();ctx.moveTo(Y.x,Y.y);ctx.quadraticCurveTo(lx,ly,Bm.x,Bm.y);ctx.stroke();

    // hull: the deck we are sitting in, running forward to the bow. Opaque, so no
    // water shows through it, and it closes off the bottom of the frame.
    const by=H+pitch*pxDeg;
    const pL=rig(1.25,yc-hb,g), pR=rig(1.25,yc+hb,g);
    const mL=rig(fwd*0.55,yc-hb*0.85,g), mR=rig(fwd*0.55,yc+hb*0.85,g);
    const bow=rig(fwd,yc,g);
    const hull=new Path2D();
    hull.moveTo(pL.x,by);hull.lineTo(pL.x,pL.y);
    hull.quadraticCurveTo(mL.x,mL.y,bow.x,bow.y);
    hull.quadraticCurveTo(mR.x,mR.y,pR.x,pR.y);
    hull.lineTo(pR.x,by);hull.closePath();
    ctx.fillStyle=PAL.night;ctx.fill(hull);
    ctx.strokeStyle=hexA(PAL.starlight,0.45);ctx.lineWidth=1.5;ctx.stroke(hull);

    // the upswept endpiece — the single most recognisable cue in profile (§2).
    // It rises from the bow and hooks back over the hull; not a smooth bump.
    const eb=0.2, et=0.012, tipX=fwd-1.0;
    const bL=rig(fwd,yc-eb,g), bR=rig(fwd,yc+eb,g);
    const tL=rig(tipX,yc-et,g+CFG.endRise), tR=rig(tipX,yc+et,g+CFG.endRise);
    const kL=rig(fwd+0.05,yc-eb*0.55,g+CFG.endRise*0.5);  // leading edge bellies forward
    const kR=rig(fwd+0.05,yc+eb*0.55,g+CFG.endRise*0.5);
    const end=new Path2D();
    end.moveTo(bL.x,bL.y);
    end.quadraticCurveTo(kL.x,kL.y,tL.x,tL.y);
    end.lineTo(tR.x,tR.y);
    end.quadraticCurveTo(kR.x,kR.y,bR.x,bR.y);
    end.closePath();
    ctx.fillStyle=PAL.night;ctx.fill(end);
    ctx.strokeStyle=hexA(PAL.starlight,0.45);ctx.lineWidth=1.4;ctx.stroke(end);
  }
}

function draw(){
  ctx.setTransform(DPR,0,0,DPR,0,0);
  drawSky();

  // blind: the lived, drifted position; everywhere else the planned schedule
  const cn=blind&&blind.track?trackAt(blind.track,t):canoeAt(t);
  const refDeg=C?gcBearing(cn,C):null;
  const cur=refDeg==null?-1:houseOf(refDeg);
  const be=ease(b);

  if(be<0.55){   // chart/navigator passes, fully covered past the fade midpoint
    const v=viewParams(cn);
    const Pw=v.P;
    const Aw=project(A),Bw=project(B);

    drawOcean(v);

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
    }else if(HELM&&helmPhase==='select'){   // the picker: bare coastlines and the ports
      ctx.restore();
      drawHelmPicker(v);
    }else{
      drawRangeRings(v);
      drawCourse(v,Aw,Bw);
      drawWake(v);
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
    if(ba>0){ctx.save();ctx.globalAlpha=ba;drawBoatView(cn,refDeg,cur);
      if(HELM)drawMiniMap(cn);   // helm only: the other frames have a real chart
      ctx.restore();}
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
  const seg=etakAt(boundaries,t);
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
  const btn=chooserEl.querySelectorAll('button:not(#sailBtn)')[puzzle.chosenIndex];
  if(btn)btn.after(scoreDetail);
}

const chooserEl=document.getElementById('chooser');
const sailBtn=document.getElementById('sailBtn');
function buildChooserUI(){
  chooserEl.querySelectorAll('button:not(#sailBtn)').forEach(b=>b.remove());
  hoverIdx=-1;
  const revealed=puzzle.chosenIndex>=0;
  puzzle.candidates.forEach((cd,i)=>{
    const btn=document.createElement('button');
    btn.innerHTML=`<span>${cd.name.trim()}</span>`+(revealed?`<span class="sc">${cd.score.total}</span>`:'');
    btn.addEventListener('click',()=>arming?startBlind(i):applyChoice(i));
    btn.addEventListener('mouseenter',()=>{hoverIdx=i;});
    btn.addEventListener('mouseleave',()=>{hoverIdx=-1;});
    chooserEl.insertBefore(btn,sailBtn);
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
  if(!playing&&t>=1){t=0;afterHours=0;}setPlaying(!playing);
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
function goAshore(ft){   // leave the boat for chart (ft=0) or navigator (ft=1)
  fTarget=ft;bTarget=0;hideStarCard();departWrap.classList.add('hidden');
  frameHint.textContent='same voyage, three frames';
}
document.getElementById('fChart').addEventListener('click',e=>{goAshore(0);frameActive(e.target);});
document.getElementById('fEtak').addEventListener('click',e=>{goAshore(1);frameActive(e.target);});
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

// Boot into the boat with the chrome hidden (see HELM at the top). It sets exactly the
// state the BOAT button sets, so the frame machinery is untouched — plus b=1 to land
// there outright rather than crossfading up from a chart nobody sees, and play, since
// the sun and stars only turn while the voyage runs.
function enterHelm(){
  document.body.classList.add('helm');
  document.title='Etak';
  frameActive(document.getElementById('fBoat'));
  frameHint.textContent='drag the sea to look around';
  enterHelmPicker();     // the picker first; sailing starts when a leg is chosen
}

const mPuzzle=document.getElementById('mPuzzle'),mSandbox=document.getElementById('mSandbox');
const mSettle=document.getElementById('mSettle');
const newBtn=document.getElementById('newBtn'),subEl=document.getElementById('sub');
const framesEl=document.querySelector('.frames');
function setMode(m){
  if(blind)endBlind();
  lastWake=null;
  mode=m;
  hideStarCard();
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
    setPlaying(false);goAshore(0);
    frameActive(document.getElementById('fChart'));
    subEl.textContent='How the Pacific was settled. Press play or drag the years; click a landfall for its story.';
    setEra(0);                       // always open on the whole ocean
  }
  else if(m==='puzzle'){makePuzzle();}
  else{subEl.textContent='Drag the reference island and watch it reshape the etaks. Scroll to zoom, drag the sea to pan.';makeSandbox();}
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
  setPlaying(false);fTarget=0;bTarget=0;t=0;afterHours=0;scrub.value=0;hideStarCard();
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

// ---------- boat-view star card ----------
const starCard=document.getElementById('starCard');
const starEra=document.getElementById('starEra'),starTitle=document.getElementById('starTitle');
const starText=document.getElementById('starText');
function hideStarCard(){starPick=null;starCard.classList.add('hidden');}
document.getElementById('starClose').addEventListener('click',hideStarCard);
function showStarCard(h){
  const s=h.s;starPick=s;
  const houses=ETAK_COMPASS.map((c,i)=>i).filter(i=>starBaseName(ETAK_COMPASS[i].star)===s.group);
  const r=riseAz(s.dec,canoeAt(t).lat);
  const road=isFinite(r)
    ?`It rises at ${Math.round(r)}° true and sets at ${Math.round(360-r)}° — the compass rounds it to its even point.`
    :'It never rises or sets at this latitude — the steady anchor of the north.';
  starEra.textContent=(s.group===s.name?'':s.group+' · ')+`${s.name} · mag ${s.mag.toFixed(1)}`;
  starTitle.textContent=s.car||s.name;
  starText.textContent=
    `Now ${Math.round(h.alt)}° above the horizon, bearing ${String(Math.round(h.az)).padStart(3,'0')}°. `+road+
    (houses.length?` House${houses.length>1?'s':''}: ${houses.map(i=>roseName(i)).join(', ')}.`:'');
  starCard.classList.remove('hidden');
}

// ---------- blind passage (the core loop, v1 — see docs/design.md) ----------
// SAIL commits to a reference island and sails the leg boat-view only: no
// chart, no scrubber, no readout. The navigator's question pauses the voyage
// at CFG.blindQs random moments; errors are revealed only at landfall, in
// etaks rather than points (design.md R1). ESC abandons.
let blind=null;    // {idx,qs,qi,marks,call,drift,track,bounds,tBirds,done} while sailing
let arming=false;  // SAIL pressed, waiting for the island pick (scores stay hidden)
let lastWake=null; // the drifted track of the last blind run, ghosted on the chart
const blindCard=document.getElementById('blindCard');
const blindEra=document.getElementById('blindEra'),blindTitle=document.getElementById('blindTitle');
const blindText=document.getElementById('blindText'),blindAnswers=document.getElementById('blindAnswers');
const blindChrome=[framesEl,document.querySelector('.bar'),document.querySelector('.modeswitch'),
                   readoutEl,chooserEl,newBtn,document.getElementById('storyBtn')];
const birdsBtn=document.getElementById('birdsBtn');
birdsBtn.addEventListener('click',()=>{
  if(!blind||blind.call)return;
  blind.call={t};
  birdsBtn.classList.add('called');
  birdsBtn.textContent=`called · etak ${etakAt(blind.bounds,t)}`;
});

function setArming(on){
  arming=on;
  sailBtn.classList.toggle('chosen',on);
  if(on)subEl.textContent='Choose your etak island — you sail on it, sight unseen. No chart until landfall.';
}
function blindButtons(labels,onPick){
  blindAnswers.innerHTML='';
  labels.forEach((lb,k)=>{
    const b=document.createElement('button');
    b.textContent=lb;
    b.addEventListener('click',()=>onPick(k));
    blindAnswers.appendChild(b);
  });
}
function startBlind(i){
  setArming(false);
  lastWake=null;
  const cd=puzzle.candidates[i];
  C={lat:cd.lat,lon:cd.lon,name:cd.name};
  recompute();
  // roll this passage's current and integrate the lived track; the ring entry
  // and the etak boundaries the player will experience come from that track
  const dir=Math.random()*360, rate=Math.random()*CFG.driftMax;
  const track=driftTrack(A,B,dir,rate);
  let tBirds=null;
  for(let k=0;k<track.length;k++)
    if(gcDistNm(track[k],B)<=CFG.birdsNm){tBirds=k/(track.length-1);break;}
  const span=0.75/CFG.blindQs;   // questions jitter-spread over t in [0.15, 0.9]
  blind={idx:i,qi:0,marks:[],call:null,
         drift:{dir,rate},track,bounds:boundariesForTrack(track,C),tBirds,
         qs:Array.from({length:CFG.blindQs},(_,k)=>0.15+span*(k+0.5+(Math.random()-0.5)*0.6))};
  birdsBtn.classList.remove('hidden','called');
  birdsBtn.textContent='CALL · ETAK OF BIRDS';
  blindCard.classList.add('hidden');
  hideStarCard();
  blindChrome.forEach(el=>el.classList.add('hidden'));
  departWrap.classList.add('hidden');
  subEl.textContent='Watch the reference sweep the horizon — the navigator will ask where you are. ESC abandons.';
  t=0;afterHours=0;scrub.value=0;bTarget=1;look=0;pitch=0;
  setPlaying(true);
}
function askBlind(){
  setPlaying(false);
  blindEra.textContent='the navigator asks';
  blindTitle.textContent='Which etak are we in?';
  blindText.textContent='';
  const total=blind.bounds.length+1;
  blindButtons(Array.from({length:total},(_,k)=>k+1),k=>{
    blind.marks.push({guess:k+1,truth:etakAt(blind.bounds,t)});
    blind.qi++;
    blindCard.classList.add('hidden');
    setPlaying(true);
  });
  blindCard.classList.remove('hidden');
}
function blindLandfall(){
  birdsBtn.classList.add('hidden');
  blindEra.textContent='landfall';
  blindTitle.textContent=B.name;
  const bounds=blind.bounds;
  const asks=blind.marks.map(m=>{
    const off=Math.abs(m.guess-m.truth);
    return `Asked in etak ${m.truth}, you said ${m.guess} — `+
           (off===0?'dead on.':off===1?'off by one etak.':`off by ${off} etaks.`);
  });
  // the call, judged against the lived ring entry (null = the current carried you wide)
  let call;
  if(blind.tBirds==null){
    call=blind.call
      ?`You called the birds in etak ${etakAt(bounds,blind.call.t)} — but the birds never came.`
      :'You never called the birds — and the birds never came.';
  }else if(!blind.call){
    call='The birds came unannounced — you never called them.';
  }else{
    const eb=etakAt(bounds,blind.tBirds), ec=etakAt(bounds,blind.call.t), d=eb-ec;
    call=d===0?`You called the birds in etak ${ec} — dead on.`:
         d>0?`You called the birds in etak ${ec}; they begin in etak ${eb} — ${d} etak${d>1?'s':''} early.`:
              `You called the birds in etak ${ec}; they had been with you since etak ${eb} — ${-d} etak${d<-1?'s':''} late.`;
  }
  // arrival, from the true end of the track
  const end=blind.track[blind.track.length-1];
  const dB=gcDistNm(end,B);
  let arrive;
  if(dB<=CFG.sightNm)arrive=`${B.name} rose off the bow.`;
  else if(dB<=CFG.birdsNm)arrive='The birds are here, but no island yet — the search would begin.';
  else{
    const off=((gcBearing(end,B)-gcBearing(canoeAt(0.999),B)+540)%360)-180;
    const n=Math.max(1,Math.round(Math.abs(off)/HOUSE));
    arrive=`No birds, no island — ${B.name} lay ${n===1?'a house':n+' houses'} to `+
           `${off<0?'port':'starboard'}. The search would begin.`;
  }
  // the current, disclosed only now, named by its star house
  const c=ETAK_COMPASS[houseOf(blind.drift.dir)];
  const disc=blind.drift.rate<0.03?'The sea ran true this passage.':
    `All passage the current set you toward ${c.car?(c.pre?c.pre+' ':'')+c.car:c.star}.`;
  blindText.textContent=[...asks,call,arrive,disc,verdictText(live)].join(' ');
  blindButtons(['RETURN TO THE CHART ⟶'],endBlind);
  blindCard.classList.remove('hidden');
}
function endBlind(){
  const idx=blind.idx;
  lastWake=blind.track;         // the verify payoff: the wake stays on the chart
  blind=null;
  birdsBtn.classList.add('hidden');
  blindCard.classList.add('hidden');
  blindChrome.forEach(el=>el.classList.remove('hidden'));
  goAshore(0);frameActive(document.getElementById('fChart'));
  applyChoice(idx);            // the verify step: back to the chooser, scores revealed
  passageSub();
}
sailBtn.addEventListener('click',()=>{
  if(puzzle.chosenIndex>=0){startBlind(puzzle.chosenIndex);return;}
  setArming(!arming);
  if(!arming)passageSub();
});
addEventListener('keydown',e=>{if(blind&&e.key==='Escape')endBlind();});

// ---------- camera + sandbox drag (chart frame) ----------
let dragMode=null,lastX=0,lastY=0;   // 'ref' | 'pan' | 'gaze' | null
let downX=0,downY=0;                 // pointerdown position (settlement click-vs-drag)
canvas.addEventListener('pointerdown',e=>{
  if(story)return;                     // camera belongs to the story flights
  if(bTarget===1){                     // aboard: drag turns your gaze
    dragMode='gaze';downX=lastX=e.clientX;downY=lastY=e.clientY;canvas.setPointerCapture(e.pointerId);return;
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
  if(HELM&&helmPhase==='select'&&!dragMode){        // picker: highlight the port under the pointer
    pickHover=hitPort(e.clientX,e.clientY);
    canvas.style.cursor=pickHover?'pointer':'';
  }
});
canvas.addEventListener('pointerup',e=>{
  // aboard: a still click (not a gaze drag) picks the nearest compass star → its card
  if(dragMode==='gaze'&&Math.hypot(e.clientX-downX,e.clientY-downY)<4){
    // the minimap is the chart in miniature, so clicking it opens the full one —
    // the way back to the picker without putting another button on screen
    if(HELM&&helmPhase==='sail'&&overMiniMap(e.clientX,e.clientY)){
      enterHelmPicker();dragMode=null;return;
    }
    let best=null,bd=CFG.starHitR;
    for(const h of starHits){const d=Math.hypot(h.x-e.clientX,h.y-e.clientY);if(d<bd){bd=d;best=h;}}
    best?showStarCard(best):hideStarCard();
  }
  // picker: a still click on an island sets home, then destination and sails
  if(HELM&&helmPhase==='select'&&dragMode==='pan'&&Math.hypot(e.clientX-downX,e.clientY-downY)<4){
    const hit=hitPort(e.clientX,e.clientY);
    if(!hit)pickFrom=null;                       // empty sea clears the pick
    else if(!pickFrom)pickFrom=hit;
    else if(hit!==pickFrom)startHelmVoyage(pickFrom,hit);
  }
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
  if(playing){
    // Helm runs on sky time, not voyage fraction: the sun and stars turn at a fixed
    // rate and a longer leg simply takes longer, instead of whipping the sky round
    // faster to finish in the same 33 seconds. Elsewhere the leg is the clock.
    if(HELM&&legHours)t+=dt*CFG.helmSkyRate*speedMul/legHours;
    else t+=dt*CFG.playRate*speedMul;
    if(t>=1){
      const over=t-1;   // the slice of this frame that falls past landfall
      t=1;
      // Landfall stops the canoe but not the clock: in helm mode the sky rolls on at
      // the same rate, so the sun and stars keep their pace instead of freezing.
      if(HELM)afterHours+=over*legHours;
      else setPlaying(false);
    }
    scrub.value=t;
  }
  if(blind){
    if(playing&&blind.qi<blind.qs.length&&t>=blind.qs[blind.qi])askBlind();
    else if(t>=1&&!blind.done){blind.done=true;blindLandfall();}
  }
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
if(HELM)enterHelm();
else if(!storySeen())startStory();
requestAnimationFrame(loop);
})();
