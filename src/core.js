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

// ---------- wanderers: Sun, Moon, planets (P. Schlyter's low-precision method) ----------
// Geocentric, equinox of date; ~1-2 arcmin for planets, a few arcmin for the Moon
// (topocentric parallax, up to ~1° for the Moon, is ignored) — all far below the
// 11.25° house resolution. d = days from J2000 epoch 1999-Dec-31.0.

const sind=x=>Math.sin(rad(x)), cosd=x=>Math.cos(rad(x));
const norm360=x=>((x%360)+360)%360;

// Keplerian elements: value + rate per day (a in AU; Moon's in Earth radii)
const PLANET_EL={
  mercury:{N:[48.3313,3.24587e-5], i:[7.0047,5.0e-8],    w:[29.1241,1.01444e-5], a:0.387098, e:[0.205635,5.59e-10],  M:[168.6562,4.0923344368]},
  venus:  {N:[76.6799,2.46590e-5], i:[3.3946,2.75e-8],   w:[54.8910,1.38374e-5], a:0.723330, e:[0.006773,-1.302e-9], M:[48.0052,1.6021302244]},
  mars:   {N:[49.5574,2.11081e-5], i:[1.8497,-1.78e-8],  w:[286.5016,2.92961e-5],a:1.523688, e:[0.093405,2.516e-9],  M:[18.6021,0.5240207766]},
  jupiter:{N:[100.4542,2.76854e-5],i:[1.3030,-1.557e-7], w:[273.8777,1.64505e-5],a:5.20256,  e:[0.048498,4.469e-9],  M:[19.8950,0.0830853001]},
  saturn: {N:[113.6634,2.38980e-5],i:[2.4886,-1.081e-7], w:[339.3939,2.97661e-5],a:9.55475,  e:[0.055546,-9.499e-9], M:[316.9670,0.0334442282]},
};
const PLANETS=Object.keys(PLANET_EL);

// eccentric anomaly from mean anomaly (degrees) + eccentricity, radians out
function kepler(Mdeg,e){
  const M=rad(norm360(Mdeg));
  let E=M+e*Math.sin(M)*(1+e*Math.cos(M));
  for(let k=0;k<10;k++){
    const dE=(E-e*Math.sin(E)-M)/(1-e*Math.cos(E));E-=dE;
    if(Math.abs(dE)<1e-9)break;
  }
  return E;
}

// ecliptic rectangular (of date) -> equatorial {ra,dec}, degrees
function eclToEq(x,y,z,d){
  const ε=rad(23.4393-3.563e-7*d);
  const ye=y*Math.cos(ε)-z*Math.sin(ε), ze=y*Math.sin(ε)+z*Math.cos(ε);
  return {ra:(deg(Math.atan2(ye,x))+360)%360, dec:deg(Math.atan2(ze,Math.hypot(x,ye)))};
}

// Sun: geocentric {ra,dec}, ecliptic longitude (deg) and distance (AU)
function sunPos(jd){
  const d=jd-2451543.5;
  const w=282.9404+4.70935e-5*d, e=0.016709-1.151e-9*d;
  const E=kepler(356.0470+0.9856002585*d,e);
  const xv=Math.cos(E)-e, yv=Math.sqrt(1-e*e)*Math.sin(E);
  const lon=norm360(deg(Math.atan2(yv,xv))+w), r=Math.hypot(xv,yv);
  return {lon,r,...eclToEq(r*cosd(lon),r*sind(lon),0,d)};
}

// Moon: geocentric {ra,dec}, illuminated fraction `phase` (0 new .. 1 full)
function moonPos(jd){
  const d=jd-2451543.5;
  const N=125.1228-0.0529538083*d, i=5.1454, w=318.0634+0.1643573223*d;
  const e=0.054900, M=115.3654+13.0649929509*d;
  const E=kepler(M,e);
  const xv=60.2666*(Math.cos(E)-e), yv=60.2666*Math.sqrt(1-e*e)*Math.sin(E);
  const v=deg(Math.atan2(yv,xv));let r=Math.hypot(xv,yv);
  const xh=r*(cosd(N)*cosd(v+w)-sind(N)*sind(v+w)*cosd(i));
  const yh=r*(sind(N)*cosd(v+w)+cosd(N)*sind(v+w)*cosd(i));
  const zh=r*sind(v+w)*sind(i);
  let lon=deg(Math.atan2(yh,xh)), lat=deg(Math.atan2(zh,Math.hypot(xh,yh)));
  // main perturbations (evection, variation, yearly equation, ...), degrees
  const Ms=356.0470+0.9856002585*d, ws=282.9404+4.70935e-5*d;
  const Lm=M+w+N, D=Lm-(Ms+ws), F=Lm-N;
  lon+=-1.274*sind(M-2*D)+0.658*sind(2*D)-0.186*sind(Ms)-0.059*sind(2*M-2*D)
       -0.057*sind(M-2*D+Ms)+0.053*sind(M+2*D)+0.046*sind(2*D-Ms)+0.041*sind(M-Ms)
       -0.035*sind(D)-0.031*sind(M+Ms)-0.015*sind(2*F-2*D)+0.011*sind(M-4*D);
  lat+=-0.173*sind(F-2*D)-0.055*sind(M-F-2*D)-0.046*sind(M+F-2*D)
       +0.033*sind(F+2*D)+0.017*sind(2*M+F);
  r+=-0.58*cosd(M-2*D)-0.46*cosd(2*D);
  const s=sunPos(jd);
  const elong=deg(Math.acos(cosd(lat)*cosd(lon-s.lon)));
  return {phase:(1-cosd(elong))/2,
          ...eclToEq(r*cosd(lon)*cosd(lat),r*sind(lon)*cosd(lat),r*sind(lat),d)};
}

// planet: geocentric {ra,dec} + apparent visual magnitude
function planetPos(name,jd){
  const d=jd-2451543.5, el=PLANET_EL[name];
  const N=el.N[0]+el.N[1]*d, i=el.i[0]+el.i[1]*d, w=el.w[0]+el.w[1]*d;
  const e=el.e[0]+el.e[1]*d;
  const E=kepler(el.M[0]+el.M[1]*d,e);
  const xv=el.a*(Math.cos(E)-e), yv=el.a*Math.sqrt(1-e*e)*Math.sin(E);
  const v=deg(Math.atan2(yv,xv)), rh=Math.hypot(xv,yv);
  const xp=rh*(cosd(N)*cosd(v+w)-sind(N)*sind(v+w)*cosd(i));
  const yp=rh*(sind(N)*cosd(v+w)+cosd(N)*sind(v+w)*cosd(i));
  const zp=rh*sind(v+w)*sind(i);
  let lonh=deg(Math.atan2(yp,xp)), lath=deg(Math.atan2(zp,Math.hypot(xp,yp)));
  // Jupiter<->Saturn mutual perturbations (the great inequality et al.), degrees
  const Mj=PLANET_EL.jupiter.M[0]+PLANET_EL.jupiter.M[1]*d;
  const Mt=PLANET_EL.saturn.M[0]+PLANET_EL.saturn.M[1]*d;
  if(name==='jupiter')
    lonh+=-0.332*sind(2*Mj-5*Mt-67.6)-0.056*sind(2*Mj-2*Mt+21)+0.042*sind(3*Mj-5*Mt+21)
          -0.036*sind(Mj-2*Mt)+0.022*cosd(Mj-Mt)+0.023*sind(2*Mj-3*Mt+52)-0.016*sind(Mj-5*Mt-69);
  if(name==='saturn'){
    lonh+=0.812*sind(2*Mj-5*Mt-67.6)-0.229*cosd(2*Mj-4*Mt-2)+0.119*sind(Mj-2*Mt-3)
          +0.046*sind(2*Mj-6*Mt-69)+0.014*sind(Mj-3*Mt+32);
    lath+=-0.020*cosd(2*Mj-4*Mt-2)+0.018*sind(2*Mj-6*Mt-49);
  }
  const s=sunPos(jd);
  const xg=rh*cosd(lonh)*cosd(lath)+s.r*cosd(s.lon);
  const yg=rh*sind(lonh)*cosd(lath)+s.r*sind(s.lon);
  const zg=rh*sind(lath);
  const R=Math.sqrt(xg*xg+yg*yg+zg*zg);
  const FV=deg(Math.acos((rh*rh+R*R-s.r*s.r)/(2*rh*R)));   // phase angle at the planet
  let mag;
  if(name==='mercury')mag=-0.36+5*Math.log10(rh*R)+0.027*FV+2.2e-13*FV**6;
  else if(name==='venus')mag=-4.34+5*Math.log10(rh*R)+0.013*FV+4.2e-7*FV**3;
  else if(name==='mars')mag=-1.51+5*Math.log10(rh*R)+0.016*FV;
  else if(name==='jupiter')mag=-9.25+5*Math.log10(rh*R)+0.014*FV;
  else{ // saturn: ring tilt B brightens the disc
    const longe=deg(Math.atan2(yg,xg)), latge=deg(Math.atan2(zg,Math.hypot(xg,yg)));
    const Nr=169.51+3.82e-5*d;
    const B=deg(Math.asin(sind(latge)*cosd(28.06)-cosd(latge)*sind(28.06)*sind(longe-Nr)));
    mag=-9.0+5*Math.log10(rh*R)+0.044*FV-2.6*sind(Math.abs(B))+1.2*sind(B)**2;
  }
  return {mag,...eclToEq(xg,yg,zg,d)};
}

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

return {HOUSE,SWEET,R_NM,lerp,gcBearing,gcDistNm,gcInterp,houseOf,altAz,riseAz,gmst,
        PLANETS,sunPos,moonPos,planetPos,boundariesFor,scoreFor,verdictText};
})();

// Node/test interop: expose as a module export when running under CommonJS/ESM
// bridges. Harmless in the browser (no `module` global there).
if (typeof module !== 'undefined' && module.exports) module.exports = EtakCore;
