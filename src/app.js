(() => {
'use strict';

const {HOUSE,lerp,bearing,houseOf,scoreFor,verdictText} = EtakCore;

const canvas = document.getElementById('sea');
const ctx = canvas.getContext('2d');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- palette (single source of truth: the :root custom properties) ----------
const cssVars = getComputedStyle(document.documentElement);
const cv = n => cssVars.getPropertyValue(n).trim();
const hexA = (hex,a) => hex + Math.round(a*255).toString(16).padStart(2,'0');
const PAL = {
  night:cv('--night'), night2:cv('--night-2'),
  starlight:cv('--starlight'), amber:cv('--amber'), teal:cv('--teal'),
  faint:cv('--faint'), dim:cv('--dim'),
  course:cv('--course'), tick:cv('--tick'), roseRing:cv('--rose-ring'),
  roseMinor:cv('--rose-minor'), ghost:cv('--ghost'), island:cv('--island'), refFill:cv('--ref-fill'),
};

// ---------- viewport ----------
let W=0,H=0,DPR=1,scale=1;
function resize(){
  DPR=Math.min(devicePixelRatio||1,2);
  W=innerWidth;H=innerHeight;
  canvas.width=W*DPR;canvas.height=H*DPR;
  scale=Math.min(W/1150,H/1900);
}
addEventListener('resize',resize);resize();

// ---------- puzzle generation ----------
let seed=Date.now()%2147483647;
const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
const rng=(a,b)=>a+(b-a)*rnd();

function blob(rBase,n,jitter,s0){
  const save=seed;seed=s0;const pts=[];
  for(let i=0;i<n;i++){const a=i/n*2*Math.PI;const r=rBase*(1+(rnd()-0.5)*jitter);
    pts.push([Math.cos(a)*r,Math.sin(a)*r*0.72]);}
  seed=save;return pts;
}

let puzzle=null;   // {A,B,candidates:[{x,y,name,shape,score}], chosenIndex}
const NAMES=[' ELATO',' LAMOTREK',' SATAWAL',' PULUWAT',' PULAP',' FARAULEP',' WOLEAI',' IFALUK',' EAURIPIK',' PIKELOT'];

function makePuzzle(){
  // course roughly horizontal, jittered
  const A={x:-430,y:rng(-60,60),name:'HOME'};
  const B={x: 430,y:rng(-60,60),name:'DESTINATION'};
  const mid={x:(A.x+B.x)/2,y:(A.y+B.y)/2};

  const cands=[];
  // 1) one deliberately strong candidate: well abeam, far enough for ~6 etaks
  {
    const side=rnd()<0.5?-1:1;
    let best=null;
    for(let tries=0;tries<50;tries++){
      const off=rng(-120,120);
      const dist=rng(580,860);
      const c={x:mid.x+off,y:mid.y+side*dist};
      const s=scoreFor(A,B,c);
      if(!best||s.total>best.s.total)best={c,s};
    }
    cands.push(best.c);
  }
  // 2) a trap: nearly in line with the course (beyond an endpoint)
  {
    const beyond=rnd()<0.5?-1:1;
    const c={x:(beyond<0?A.x:B.x)+beyond*rng(150,320),y:mid.y+rng(-40,40)};
    cands.push(c);
  }
  // 3) a trap: too close and abeam -> confetti
  {
    const side=rnd()<0.5?-1:1;
    const c={x:mid.x+rng(-140,140),y:mid.y+side*rng(120,240)};
    cands.push(c);
  }
  // 4) a middling one: right region, off-center so evenness suffers
  {
    const side=rnd()<0.5?-1:1;
    const c={x:mid.x+rng(-360,360),y:mid.y+side*rng(420,760)};
    cands.push(c);
  }

  // shuffle so the strong one isn't always first
  for(let i=cands.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[cands[i],cands[j]]=[cands[j],cands[i]];}

  const candidates=cands.map((c,i)=>({
    x:c.x,y:c.y,name:NAMES[Math.floor(rnd()*NAMES.length)],
    shape:blob(rng(18,26),12,0.6,(i+2)*997+Math.floor(rnd()*500)),
    score:scoreFor(A,B,c)
  }));

  puzzle={A,B,candidates,chosenIndex:0};
  buildChooserUI();
  applyChoice(0,false);
}

// ---------- active leg + reference (drives sim + drawing) ----------
let A,B,C;                 // active home/dest/reference (C is a live {x,y,name})
let boundaries=[];
let live=null;             // current score object

function applyChoice(i,animate){
  puzzle.chosenIndex=i;
  const cand=puzzle.candidates[i];
  A=puzzle.A;B=puzzle.B;
  C={x:cand.x,y:cand.y,name:cand.name};
  recompute();
  [...chooserEl.querySelectorAll('button')].forEach((b,k)=>b.classList.toggle('chosen',k===i));
  t=0;scrub.value=0;setPlaying(false);
}

function recompute(){
  live=scoreFor(A,B,C);
  boundaries=live.boundaries;
  updateScorePanel();
}

// ---------- sandbox leg ----------
function makeSandbox(){
  A={x:-420,y:0,name:'HOME'};
  B={x:420,y:0,name:'DESTINATION'};
  C={x:40,y:-270,name:'REFERENCE'};
  C.shape=blob(22,12,0.65,37);
  recompute();
  t=0;scrub.value=0;setPlaying(false);
}

// ---------- sim state ----------
let t=0,playing=false,speedMul=1,f=0,fTarget=0;
let mode='puzzle';
const canoeAt=tt=>({x:lerp(A.x,B.x,tt),y:lerp(A.y,B.y,tt)});

// ---------- decorative stars ----------
let sSeed=7;const srnd=()=>(sSeed=(sSeed*16807)%2147483647)/2147483647;
const stars=Array.from({length:130},()=>({x:srnd(),y:srnd(),r:srnd()*1.1+0.3,p:srnd()*6.28,s:srnd()*0.7+0.3}));
const shapeA=blob(30,14,0.55,11), shapeB=blob(26,12,0.6,23);

// ---------- transform ----------
const ease=k=>k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
function worldTransform(){
  const fe=ease(f);const rot=fe*(-Math.PI/2);const P=canoeAt(t);
  const O={x:P.x*fe,y:P.y*fe};
  ctx.translate(W/2,H/2+(1-fe)*20);ctx.rotate(rot);ctx.scale(scale,scale);ctx.translate(-O.x,-O.y);
  return fe;
}

function drawIslandShape(x,y,shape,color,glow,fe,name,labelBelow,dim){
  ctx.save();ctx.translate(x,y);
  if(glow){const g=ctx.createRadialGradient(0,0,4,0,0,70);
    g.addColorStop(0,glow);g.addColorStop(1,'transparent');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,70,0,7);ctx.fill();}
  ctx.globalAlpha=dim?0.4:1;
  ctx.beginPath();shape.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();
  ctx.fillStyle=color;ctx.fill();ctx.globalAlpha=1;
  ctx.rotate(fe*Math.PI/2);
  ctx.fillStyle=dim?PAL.dim:PAL.faint;ctx.font='10px "IBM Plex Mono",monospace';ctx.textAlign='center';
  ctx.fillText(name,0,labelBelow?46:-38);
  ctx.restore();
}

function drawRose(P,fe,refDeg){
  const R=250;ctx.save();ctx.translate(P.x,P.y);ctx.globalAlpha=0.12+0.88*fe;
  ctx.strokeStyle=PAL.roseRing;ctx.lineWidth=1/scale*0.8+0.4;
  ctx.beginPath();ctx.arc(0,0,R,0,7);ctx.stroke();
  const cur=houseOf(refDeg);
  for(let i=0;i<32;i++){const deg=i*HOUSE;const a=(deg-90)*Math.PI/180;
    const major=i%8===0;const len=major?16:(i%4===0?10:6);
    ctx.strokeStyle=i===cur?PAL.amber:PAL.roseMinor;ctx.lineWidth=i===cur?2.2:1;
    ctx.beginPath();ctx.moveTo(Math.cos(a)*(R-len),Math.sin(a)*(R-len));
    ctx.lineTo(Math.cos(a)*R,Math.sin(a)*R);ctx.stroke();}
  const names=[[0,'POLARIS · N'],[90,'ALTAIR RISING · E'],[180,'CRUX · S'],[270,'ALTAIR SETTING · W']];
  ctx.fillStyle=PAL.faint;ctx.font='9.5px "IBM Plex Mono",monospace';ctx.textAlign='center';
  for(const [deg,nm] of names){const a=(deg-90)*Math.PI/180;
    ctx.save();ctx.translate(Math.cos(a)*(R+20),Math.sin(a)*(R+20));ctx.rotate(fe*Math.PI/2);
    ctx.fillText(nm,0,3);ctx.restore();}
  ctx.restore();
}

function draw(){
  ctx.setTransform(DPR,0,0,DPR,0,0);
  const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,PAL.night);g.addColorStop(1,PAL.night2);
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);

  const now=performance.now()/1000;
  for(const s of stars){const tw=reduceMotion?0.75:0.55+0.45*Math.sin(now*s.s+s.p);
    ctx.globalAlpha=0.35*tw;ctx.fillStyle=PAL.starlight;
    ctx.beginPath();ctx.arc(s.x*W,s.y*H,s.r,0,7);ctx.fill();}
  ctx.globalAlpha=1;

  ctx.save();
  const fe=worldTransform();
  const P=canoeAt(t);
  const refDeg=bearing(P,C);

  // course + etak ticks
  ctx.strokeStyle=PAL.course+'88';ctx.lineWidth=1.5;ctx.setLineDash([6,7]);
  ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.lineTo(B.x,B.y);ctx.stroke();ctx.setLineDash([]);
  for(const bt of boundaries){const q=canoeAt(bt);
    ctx.strokeStyle=bt<t?PAL.amber+'99':PAL.tick;ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(q.x,q.y-9);ctx.lineTo(q.x,q.y+9);ctx.stroke();}

  // drift trails in navigator frame
  if(fe>0.03){
    for(const I of [A,B,C]){const col=I===C?PAL.amber:PAL.teal;
      for(let k=1;k<=14;k++){const tp=t-k*0.02;if(tp<0)break;const Pp=canoeAt(tp);
        ctx.globalAlpha=fe*(1-k/15)*0.5;ctx.fillStyle=col;
        ctx.beginPath();ctx.arc(I.x+(P.x-Pp.x),I.y+(P.y-Pp.y),2,0,7);ctx.fill();}}
    ctx.globalAlpha=1;
  }
  // wake in chart frame
  if(fe<0.97&&t>0.005){ctx.save();ctx.globalAlpha=0.6*(1-fe);ctx.strokeStyle=PAL.teal;ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.lineTo(P.x,P.y);ctx.stroke();ctx.restore();}

  drawRose(P,fe,refDeg);

  // ghost candidates (puzzle mode, non-chosen) — dimmed, with faint bearing lines
  if(mode==='puzzle'&&puzzle){
    puzzle.candidates.forEach((cd,i)=>{
      if(i===puzzle.chosenIndex)return;
      ctx.strokeStyle=PAL.tick+'55';ctx.lineWidth=1;ctx.setLineDash([2,6]);
      ctx.beginPath();ctx.moveTo(P.x,P.y);ctx.lineTo(cd.x,cd.y);ctx.stroke();ctx.setLineDash([]);
      drawIslandShape(cd.x,cd.y,cd.shape,PAL.ghost,null,fe,cd.name,false,true);
    });
  }

  // chosen reference bearing
  ctx.strokeStyle=PAL.amber;ctx.lineWidth=1.6;ctx.setLineDash([2,5]);
  ctx.beginPath();ctx.moveTo(P.x,P.y);ctx.lineTo(C.x,C.y);ctx.stroke();ctx.setLineDash([]);

  drawIslandShape(A.x,A.y,shapeA,PAL.island,null,fe,A.name,true,false);
  drawIslandShape(B.x,B.y,shapeB,PAL.island,null,fe,B.name,true,false);
  const cShape=(mode==='sandbox')?C.shape:puzzle.candidates[puzzle.chosenIndex].shape;
  drawIslandShape(C.x,C.y,cShape,PAL.refFill,hexA(PAL.amber,0.18),fe,C.name,false,false);

  // canoe
  ctx.save();ctx.translate(P.x,P.y);ctx.fillStyle=PAL.starlight;
  ctx.beginPath();ctx.moveTo(14,0);ctx.lineTo(-10,-7);ctx.lineTo(-6,0);ctx.lineTo(-10,7);ctx.closePath();ctx.fill();
  ctx.restore();

  ctx.restore();
  updateReadout(refDeg);
}

// ---------- UI ----------
const readoutEl=document.getElementById('readout');
function updateReadout(refDeg){
  const seg=boundaries.filter(b=>b<t).length+1;
  const total=boundaries.length+1;
  const segName=total>1&&seg===total?' — etak of sighting':
                total>2&&seg===total-1?' — etak of birds':'';
  readoutEl.innerHTML=
    `etak <b class="etakN">${seg}</b> of <b>${total}</b>${segName}<br>`+
    `bearing to reference <b>${refDeg.toFixed(1).padStart(5,'0')}°</b> · house <b>${houseOf(refDeg)+1}</b>/32<br>`+
    `voyage <b>${Math.round(t*100)}%</b>`;
}

const scorePanel=document.getElementById('scorePanel');
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
  puzzle.candidates.forEach((cd,i)=>{
    const btn=document.createElement('button');
    btn.innerHTML=`<span>${cd.name.trim()}</span><span class="sc">${cd.score.total}</span>`;
    btn.addEventListener('click',()=>applyChoice(i,true));
    chooserEl.appendChild(btn);
  });
}

// ---------- controls ----------
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
  if(m==='puzzle'){subEl.textContent='Choose the reference island whose bearing best divides the voyage into etaks. Score updates live.';makePuzzle();}
  else{subEl.textContent='Free exploration. Drag the reference island; watch how its position reshapes the etaks.';makeSandbox();}
}
mPuzzle.addEventListener('click',()=>setMode('puzzle'));
mSandbox.addEventListener('click',()=>setMode('sandbox'));
newBtn.addEventListener('click',()=>makePuzzle());

// ---------- sandbox drag ----------
function screenToWorld(sx,sy){
  const fe=ease(f);const rot=fe*(-Math.PI/2);const P=canoeAt(t);
  let x=sx-W/2,y=sy-(H/2+(1-fe)*20);
  const c=Math.cos(-rot),s=Math.sin(-rot);[x,y]=[x*c-y*s,x*s+y*c];x/=scale;y/=scale;
  return {x:x+P.x*fe,y:y+P.y*fe};
}
let dragging=false;
canvas.addEventListener('pointerdown',e=>{
  if(mode!=='sandbox')return;
  const w=screenToWorld(e.clientX,e.clientY);
  if(Math.hypot(w.x-C.x,w.y-C.y)<60){dragging=true;canvas.setPointerCapture(e.pointerId);}
});
canvas.addEventListener('pointermove',e=>{
  if(!dragging)return;const w=screenToWorld(e.clientX,e.clientY);
  C.x=w.x;C.y=w.y;recompute();
});
canvas.addEventListener('pointerup',()=>{dragging=false;});

// ---------- loop ----------
let last=performance.now();
function loop(now){
  const dt=Math.min((now-last)/1000,0.05);last=now;
  if(playing){t+=dt*0.03*speedMul;if(t>=1){t=1;setPlaying(false);}scrub.value=t;}
  const fSpeed=reduceMotion?8:2.6;
  f+=(fTarget-f)*Math.min(1,dt*fSpeed);if(Math.abs(fTarget-f)<0.001)f=fTarget;
  draw();
  requestAnimationFrame(loop);
}
setMode('puzzle');
requestAnimationFrame(loop);
})();
