// Pure geometry + scoring core for Etak. No DOM, no canvas, no projection —
// just spherical math over {lat,lon} points (degrees). Consumed by app.js as
// the global `EtakCore`.
const EtakCore = (() => {
'use strict';

const HOUSE = 11.25;       // degrees per star-compass house (360 / 32)
const SWEET = 6;           // ideal etak count for a leg of this length
const R_NM  = 3440.065;    // Earth radius in nautical miles

const lerp=(a,b,k)=>a+(b-a)*k;
const rad=d=>d*Math.PI/180, deg=r=>r*180/Math.PI;

// initial great-circle bearing p->q, degrees clockwise from true north (0..360)
function gcBearing(p,q){
  const φ1=rad(p.lat),φ2=rad(q.lat),Δλ=rad(q.lon-p.lon);
  const y=Math.sin(Δλ)*Math.cos(φ2);
  const x=Math.cos(φ1)*Math.sin(φ2)-Math.sin(φ1)*Math.cos(φ2)*Math.cos(Δλ);
  return (deg(Math.atan2(y,x))+360)%360;
}

// great-circle distance p->q in nautical miles
function gcDistNm(p,q){
  const φ1=rad(p.lat),φ2=rad(q.lat),Δφ=rad(q.lat-p.lat),Δλ=rad(q.lon-p.lon);
  const a=Math.sin(Δφ/2)**2+Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R_NM*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

// point at fraction k along the great circle p->q (spherical interpolation)
function gcInterp(p,q,k){
  const φ1=rad(p.lat),λ1=rad(p.lon),φ2=rad(q.lat),λ2=rad(q.lon);
  const Δφ=φ2-φ1,Δλ=λ2-λ1;
  const a=Math.sin(Δφ/2)**2+Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  const δ=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  if(δ<1e-9) return {lat:p.lat,lon:p.lon};       // coincident points
  const A=Math.sin((1-k)*δ)/Math.sin(δ), B=Math.sin(k*δ)/Math.sin(δ);
  const x=A*Math.cos(φ1)*Math.cos(λ1)+B*Math.cos(φ2)*Math.cos(λ2);
  const y=A*Math.cos(φ1)*Math.sin(λ1)+B*Math.cos(φ2)*Math.sin(λ2);
  const z=A*Math.sin(φ1)+B*Math.sin(φ2);
  return {lat:deg(Math.atan2(z,Math.hypot(x,y))),lon:deg(Math.atan2(y,x))};
}

const houseOf=deg=>Math.floor(((deg+HOUSE/2)%360)/HOUSE);

// star (ra,dec) as seen from latitude at local sidereal time -> {alt,az},
// az clockwise from true north, degrees. HA = LST - RA.
function altAz(raDeg,decDeg,latDeg,lstDeg){
  const H=rad(lstDeg-raDeg),φ=rad(latDeg),δ=rad(decDeg);
  const alt=Math.asin(Math.sin(φ)*Math.sin(δ)+Math.cos(φ)*Math.cos(δ)*Math.cos(H));
  const az=Math.atan2(-Math.cos(δ)*Math.sin(H),
                      Math.sin(δ)*Math.cos(φ)-Math.cos(δ)*Math.sin(φ)*Math.cos(H));
  return {alt:deg(alt), az:(deg(az)+360)%360};
}

// rising azimuth of a star of declination dec at latitude lat (setting = 360 - this)
const riseAz=(decDeg,latDeg)=>deg(Math.acos(Math.sin(rad(decDeg))/Math.cos(rad(latDeg))));

// Greenwich mean sidereal time (degrees) from a Julian date; LST = gmst + east lon
const gmst=jd=>((280.46061837+360.98564736629*(jd-2451545.0))%360+360)%360;

// count the star-house crossings of bearing(canoe->ref) along the leg, return boundary t's
function boundariesFor(A,B,ref){
  const at=tt=>gcInterp(A,B,tt);
  const out=[];let prev=houseOf(gcBearing(at(0),ref));
  const N=2000;
  for(let i=1;i<=N;i++){const tt=i/N;const h=houseOf(gcBearing(at(tt),ref));
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

return {HOUSE,SWEET,R_NM,lerp,gcBearing,gcDistNm,gcInterp,houseOf,altAz,riseAz,gmst,boundariesFor,scoreFor,verdictText};
})();

// Node/test interop: expose as a module export when running under CommonJS/ESM
// bridges. Harmless in the browser (no `module` global there).
if (typeof module !== 'undefined' && module.exports) module.exports = EtakCore;
