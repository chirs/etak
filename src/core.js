// Pure geometry + scoring core for Etak. No DOM, no canvas — just math over
// {x,y} points. Consumed by app.js as the global `EtakCore`.
const EtakCore = (() => {
'use strict';

const HOUSE = 11.25;       // degrees per star-compass house (360 / 32)
const SWEET = 6;           // ideal etak count for a leg of this length

const lerp=(a,b,k)=>a+(b-a)*k;
function bearing(p,q){const d=Math.atan2(q.x-p.x,-(q.y-p.y))*180/Math.PI;return (d+360)%360;}
const houseOf=deg=>Math.floor(((deg+HOUSE/2)%360)/HOUSE);

// count the star-house crossings of bearing(canoe->ref) along the leg, return boundary t's
function boundariesFor(A,B,ref){
  const at=tt=>({x:lerp(A.x,B.x,tt),y:lerp(A.y,B.y,tt)});
  const out=[];let prev=houseOf(bearing(at(0),ref));
  const N=2000;
  for(let i=1;i<=N;i++){const tt=i/N;const h=houseOf(bearing(at(tt),ref));
    if(h!==prev){out.push(tt);prev=h;}}
  return out;
}

// score = count-fitness x evenness. Both 0..1, combined and scaled to 100.
function scoreFor(A,B,ref){
  const b=boundariesFor(A,B,ref);
  const segs=b.length+1;
  // count fitness: gaussian around SWEET, tolerant of +-3
  const cf=Math.exp(-Math.pow(segs-SWEET,2)/(2*3*3));
  // evenness: 1 - normalized stddev of segment lengths
  const edges=[0,...b,1];
  const lens=[];for(let i=1;i<edges.length;i++)lens.push(edges[i]-edges[i-1]);
  const mean=1/lens.length;
  const varr=lens.reduce((s,l)=>s+(l-mean)*(l-mean),0)/lens.length;
  const sd=Math.sqrt(varr);
  const ev=segs<2?0:Math.max(0,1-sd/mean); // cv-based; single segment scores 0
  const total=Math.round(100*(0.5*cf+0.5*ev));
  return {segs,count:cf,even:ev,total,boundaries:b};
}

function verdictText(s){
  if(s.segs<2) return 'Nearly in line with your course — its bearing barely moves. No usable etaks.';
  if(s.count<0.4 && s.segs>SWEET) return 'Close and abeam — the bearing races. Many tiny etaks, hard to feel.';
  if(s.count<0.4) return 'Distant and shallow — too few divisions to track progress.';
  if(s.even<0.5) return 'Segments run uneven — bunched at one end of the passage.';
  if(s.total>=80) return 'Sits well abeam. Its bearing sweeps steadily — clean, even etaks.';
  return 'Workable. The bearing opens at a usable rate across the leg.';
}

return {HOUSE,SWEET,lerp,bearing,houseOf,boundariesFor,scoreFor,verdictText};
})();
