/* ICM Meteogram — widok „pogoda” (web-kit z dodatku Home Assistant „Meteogram (na podstawie ICM)”)
   Dane: © ICM UW, meteo.pl. Projekt nieoficjalny, niepowiązany z ICM UW. */
'use strict';
let RAW;
(function(){var s=document.getElementById('viewSel');if(!s)return;s.value='pogoda.html';s.addEventListener('change',function(){location.href=s.value;});})();
fetch((window.ICM_CONFIG||{}).dataUrl||'api/data',{cache:'no-store'}).then(r=>r.ok?r.json():r.json().then(b=>{throw new Error(b.error||('HTTP '+r.status));})).then(d=>{RAW=d;main();}).catch(e=>{document.getElementById('sideCond').textContent='Nie udało się pobrać danych: '+e.message;});
setTimeout(()=>location.reload(),((window.ICM_CONFIG||{}).refreshMinutes||30)*60*1000);
const KEYS=['time','temperature_2m','temp_min','temp_max','apparent_temperature','dew_point_2m','soil_temperature_min','ground_max','precipitation','precipitation_max','precip_type','precipitation_probability','storm','lightning','pressure_msl','wind_speed_10m','wind_gusts_10m','wind_direction_10m','cloud_cover','cloud_high','cloud_mid','cloud_low','cloud_very_low','cloud_base_1','cloud_top','fog','visibility','relative_humidity_2m','weather_code'];
function ensure(h){const n=h.time.length;KEYS.forEach(k=>{if(!Array.isArray(h[k]))h[k]=new Array(n).fill(null);});return h;}
function main(){
const NS='http://www.w3.org/2000/svg', $=id=>document.getElementById(id);
const NOW=new Date();
const DOW=['niedziela','poniedziałek','wtorek','środa','czwartek','piątek','sobota'], DS=['niedz.','pon.','wt.','śr.','czw.','pt.','sob.'], MON=['sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','lis','gru'];
const num=v=>(v==null||v!==v)?null:+v, pl=(v,d)=>v==null?'—':(+v).toFixed(d==null?1:d).replace('.',','), hh=h=>String(h).padStart(2,'0')+':00';
function sun(dt,lat,lon){const s=new Date(dt.getFullYear(),0,0),doy=Math.floor((dt-s)/864e5),g=2*Math.PI/365*(doy-1),r=Math.PI/180;
  const eq=229.18*(0.000075+0.001868*Math.cos(g)-0.032077*Math.sin(g)-0.014615*Math.cos(2*g)-0.040849*Math.sin(2*g));
  const de=0.006918-0.399912*Math.cos(g)+0.070257*Math.sin(g)-0.006758*Math.cos(2*g)+0.000907*Math.sin(2*g)-0.002697*Math.cos(3*g)+0.00148*Math.sin(3*g);
  let c=Math.cos(90.833*r)/(Math.cos(lat*r)*Math.cos(de))-Math.tan(lat*r)*Math.tan(de);c=Math.max(-1,Math.min(1,c));const ha=Math.acos(c)/r,off=-dt.getTimezoneOffset()/60;
  return [(720-4*(lon+ha)-eq)/60+off,(720-4*(lon-ha)-eq)/60+off];}
const fmtT=h=>{const m=Math.round(h*60);return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');};

let H,N,T,days,selDay,selHour,nowIdx;
function code(i){const p=num(H.precipitation[i])||0,t=num(H.precip_type[i])||0,c=num(H.cloud_cover[i])||0;
  if((num(H.storm[i])||0)>1||(num(H.lightning[i])||0)>0)return'storm';if((num(H.fog[i])||0)>=50)return'fog';
  if(p>=0.1)return t===2?'snow':t===3?'mix':p<0.5?'drizzle':'rain';return c<20?'clear':c<60?'part':c<85?'most':'cloud';}
const LABEL={clear:'Bezchmurnie',part:'Częściowe zachmurzenie',most:'Przewaga chmur',cloud:'Pochmurno',fog:'Mgła',drizzle:'Mżawka',rain:'Deszcz',snow:'Śnieg',mix:'Deszcz ze śniegiem',storm:'Burza'};
const SEV={clear:0,part:1,most:2,cloud:3,fog:4,drizzle:5,rain:6,mix:7,snow:7,storm:9};
let gid=0;
function icon(c,night){const id='g'+(gid++);  // ikony w stylu Google: miekkie gradienty
  const defs=`<defs><radialGradient id="${id}s" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#ffd86b"/><stop offset=".6" stop-color="#ffa41c"/><stop offset="1" stop-color="#ef7d00"/></radialGradient>
   <linearGradient id="${id}c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cfd6df"/></linearGradient>
   <linearGradient id="${id}d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9d0da"/><stop offset="1" stop-color="#8d97a5"/></linearGradient>
   <radialGradient id="${id}m" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fdfbe8"/><stop offset="1" stop-color="#c9cfdb"/></radialGradient></defs>`;
  const sunP=night?`<path d="M30 8a17 17 0 1 0 14 26 14 14 0 0 1-14-26z" fill="url(#${id}m)"/>`:`<circle cx="26" cy="24" r="15" fill="url(#${id}s)"/>`;
  const cloud=(f,dx,dy,s)=>`<g transform="translate(${dx||0},${dy||0}) scale(${s||1})"><path d="M18 52h28a11 11 0 0 0 1-22 15 15 0 0 0-28.5 4.5A9 9 0 0 0 18 52Z" fill="url(#${id}${f})"/></g>`;
  const drops=(col,n)=>[24,34,44].slice(0,n||3).map(x=>`<path d="M${x} 56 l-3 7" stroke="${col}" stroke-width="3.2" stroke-linecap="round"/>`).join('');
  const flakes=col=>[26,38].map(x=>`<circle cx="${x}" cy="59" r="2.6" fill="${col}"/>`).join('');
  let b='';
  if(c==='clear')b=night?`<path d="M36 8a22 22 0 1 0 18 34 18 18 0 0 1-18-34z" fill="url(#${id}m)"/>`:`<circle cx="32" cy="32" r="20" fill="url(#${id}s)"/>`;
  else if(c==='part')b=sunP+cloud('c',4,6,.95);
  else if(c==='most')b=sunP+cloud('c',2,2,1.05);
  else if(c==='cloud')b=cloud('d',-2,-2,1.1);
  else if(c==='fog')b=cloud('c',0,-6,1)+[50,57].map(y=>`<path d="M12 ${y}h40" stroke="#e8edf3" stroke-width="3.4" stroke-linecap="round"/>`).join('');
  else if(c==='drizzle')b=cloud('c',0,-8,1)+drops('#5aa0ff',2);
  else if(c==='rain')b=cloud('d',0,-8,1)+drops('#4b93ff');
  else if(c==='snow')b=cloud('c',0,-8,1)+flakes('#ffffff')+`<circle cx="32" cy="62" r="2.2" fill="#fff"/>`;
  else if(c==='mix')b=cloud('d',0,-8,1)+`<path d="M26 56 l-3 7" stroke="#4b93ff" stroke-width="3.2" stroke-linecap="round"/><circle cx="40" cy="59" r="2.6" fill="#fff"/>`;
  else if(c==='storm')b=cloud('d',0,-8,1)+`<path d="M34 46l-8 11h6l-3 9 11-13h-6l4-7z" fill="#ffc21a"/>`;
  return `<svg viewBox="0 0 64 68" aria-hidden="true">${defs}${b}</svg>`;}
// niebo (silnik scen v2 w skrocie)
function skyFor(i){const t=T[i],[sr,ss]=sun(t,RAW.lat,RAW.lon),h=t.getHours()+.5,c=code(i),cl=num(H.cloud_cover[i])||0;
  const tod=(h>=sr-.75&&h<sr+.75)?'dawn':(h>=ss-.75&&h<ss+.75)?'dusk':(h>sr&&h<ss)?'day':'night';
  const wet=SEV[c]>=4, over=cl>=70||wet;
  const S={day:c==='storm'?['#2a3442','#45505f','#66717f']:over?['#55708f','#7a8ea6','#9fb0c2']:['#2f6bb8','#5a8fd0','#a9c1de'],
    dawn:over?['#4b5670','#8f8798','#c9a99a']:['#2c4a8a','#b98aa6','#f4b183'],dusk:over?['#3e475d','#7d6f86','#b88f84']:['#1f3b73','#8a5a9e','#f08a5d'],
    night:over?['#141b27','#253043','#36435a']:['#081530','#16305e','#284c84']}[tod];
  return {tod,g:`linear-gradient(180deg,${S[0]} 0%,${S[1]} 45%,${S[2]} 100%)`};}
function land(night,frost,se){const far=x=>48+Math.sin(x/120)*8+Math.sin(x/47+1.1)*3,near=x=>66+Math.sin(x/160+.6)*5;
  const hill=fn=>{let d='M0 '+fn(0).toFixed(1);for(let x=10;x<=1000;x+=10)d+='L'+x+' '+fn(x).toFixed(1);return d+'L1000 86L0 86Z';};
  const snow=frost&&se==='winter',col=snow?['#dbe4ee','#f2f5f9','#5b4636']:se==='winter'?['#8f957f','#77806a','#4a3b2e']:se==='spring'?['#93bd83','#6aa65a','#5b4636']:se==='summer'?['#5e9149','#3e7b33','#4a3b2e']:['#b08a52','#857041','#5b4636'],crowns=se==='winter'?null:se==='spring'?['#7bb86a','#f4b6cf','#8cc47a']:se==='summer'?['#2f6b2e','#336f30','#2b6229']:['#d97706','#b45309','#ca8a04','#c2410c','#ea580c'];
  let s=`<g style="filter:${night?'brightness(.42) saturate(.7)':'none'}"><path d="${hill(far)}" fill="${col[0]}"/>`;
  [40,95,170,260,330,420,505,590,660,740,820,905,960].forEach((x,k)=>{const b=far(x)+2,sc=.8+(k%3)*.15;s+=`<path d="M${x} ${b+8}V${b-10*sc}" stroke="${col[2]}" stroke-width="${2.4*sc}" stroke-linecap="round"/>${crowns?`<ellipse cx="${x}" cy="${b-15*sc}" rx="${8*sc}" ry="${10*sc}" fill="${crowns[k%crowns.length]}"/>`:`<path d="M${x} ${b-4}l-7 -9M${x} ${b-8}l6 -10" stroke="${col[2]}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`}`;});
  return s+`<path d="${hill(near)}" fill="${col[1]}"/></g>`;}
function el(n,a,p){const e=document.createElementNS(NS,n);for(const k in a)e.setAttribute(k,a[k]);if(p)p.appendChild(e);return e;}
function tx(p,x,y,s,a){const t=el('text',Object.assign({x,y,'font-size':12,fill:'rgba(255,255,255,.82)','text-anchor':'middle'},a||{}),p);t.textContent=s;return t;}
function smooth(pts){if(pts.length<2)return'';let d=`M${pts[0][0]},${pts[0][1]}`;for(let i=0;i<pts.length-1;i++){const p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2;
  d+=`C${(p1[0]+(p2[0]-p0[0])/6).toFixed(1)},${(p1[1]+(p2[1]-p0[1])/6).toFixed(1)} ${(p2[0]-(p3[0]-p1[0])/6).toFixed(1)},${(p2[1]-(p3[1]-p1[1])/6).toFixed(1)} ${p2[0].toFixed(1)},${(+p2[1]).toFixed(1)}`;}return d;}

// ---- dane dnia ----
function build(){
  H=ensure(RAW.hourly);N=H.time.length;T=H.time.map(s=>new Date(s+':00'));
  nowIdx=Math.max(0,Math.min(N-1,Math.round((NOW-T[0])/36e5)));
  const map={};days=[];T.forEach((t,i)=>{const k=t.toDateString();if(!map[k]){map[k]={t,idx:[]};days.push(map[k]);}map[k].idx.push(i);});
  days.forEach(d=>{const I=d.idx,tv=I.map(i=>num(H.temperature_2m[i])).filter(v=>v!=null);d.max=Math.max(...tv);d.min=Math.min(...tv);
    let w=I[0];I.forEach(i=>{const h=T[i].getHours();if(h>=8&&h<=20&&SEV[code(i)]>SEV[code(w)])w=i;});d.code=code(w);
    d.prob=Math.max(...I.map(i=>num(H.precipitation_probability[i])||0));d.sum=I.reduce((a,i)=>a+(num(H.precipitation[i])||0),0);});
  if(selDay==null||selDay>=days.length)selDay=0;
  renderDays();selectDay(selDay,true);
}
function renderDays(){const box=$('days');box.innerHTML='';
  days.forEach((d,k)=>{const b=document.createElement('button');b.type='button';b.className='day';b.setAttribute('aria-pressed',String(k===selDay));
    b.innerHTML=`<span class="dn">${k===0?'Dziś':DS[d.t.getDay()]}</span><span class="dd">${d.t.getDate()} ${MON[d.t.getMonth()]}</span>${icon(d.code,false)}<span class="hl">${Math.round(d.max)}°<i>${Math.round(d.min)}°</i></span><span class="pp">${d.prob>=20?Math.round(d.prob)+'%':''}</span>`;
    b.onclick=()=>{box.querySelectorAll('.day').forEach((x,j)=>x.setAttribute('aria-pressed',String(j===k)));selectDay(k);};box.appendChild(b);});}
function selectDay(k,init){selDay=k;const I=days[k].idx;selHour=(init||k===0)&&I.includes(nowIdx)?nowIdx:(I.find(i=>T[i].getHours()===13)??I[Math.floor(I.length/2)]);renderCharts();setHour(selHour);}

// ---- wykresy dnia (szerokosc karty, bez przewijania) ----
const charts=[];
function frame(svg,h){const w=svg.parentNode.clientWidth-32;svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.setAttribute('height',h);svg.innerHTML='';return w;}
function xs(w,n){const pad=26;return i=>pad+(n<=1?0:i*(w-2*pad)/(n-1));}
function hook(svg,I,X,top,bot){const sel=el('rect',{x:0,y:top,width:0,height:bot-top,rx:8,fill:'rgba(255,255,255,.14)'},svg);svg.insertBefore(sel,svg.firstChild);
  const step=I.length>1?X(1)-X(0):20;charts.push({I,X,sel,step});
  const pick=e=>{const r=svg.getBoundingClientRect(),vb=svg.viewBox.baseVal,cx=(e.clientX-r.left)*vb.width/r.width;let best=0,bd=1e9;I.forEach((_,j)=>{const d=Math.abs(X(j)-cx);if(d<bd){bd=d;best=j;}});setHour(I[best]);};
  svg.onpointermove=pick;svg.onpointerdown=pick;svg.onpointerleave=e=>{if(e.pointerType==='mouse')setHour(selHourPinned);};svg.onclick=e=>{pick(e);selHourPinned=selHour;};}
let selHourPinned=null;
const EV=()=>window.innerWidth<560?6:3;
function hourAxis(svg,I,X,y){I.forEach((i,j)=>{if(T[i].getHours()%EV()===0)tx(svg,X(j),y,hh(T[i].getHours()),{'font-size':12,fill:'rgba(255,255,255,.66)'});});}
function renderCharts(){charts.length=0;const I=days[selDay].idx,n=I.length;
  // temperatura
  {const svg=$('cT'),w=frame(svg,190),X=xs(w,n),tv=I.map(i=>num(H.temperature_2m[i])),av=I.map(i=>num(H.apparent_temperature[i]));
   const all=tv.concat(av).filter(v=>v!=null),lo=Math.min(...all)-1.5,hi=Math.max(...all)+1.5,y0=56,y1=150,fy=v=>y1-(v-lo)/(hi-lo)*(y1-y0);
   const pts=tv.map((v,j)=>[X(j),fy(v)]);el('path',{d:smooth(pts)+`L${X(n-1)},${y1+8}L${X(0)},${y1+8}Z`,fill:'var(--temp-fill)'},svg);
   el('path',{d:smooth(av.map((v,j)=>[X(j),fy(v)])),fill:'none',stroke:'rgba(255,255,255,.55)','stroke-width':1.5,'stroke-dasharray':'4 4'},svg);
   el('path',{d:smooth(pts),fill:'none',stroke:'var(--temp)','stroke-width':2.6,'stroke-linecap':'round'},svg);
   I.forEach((i,j)=>{if(T[i].getHours()%EV())return;tx(svg,X(j),fy(tv[j])-10,Math.round(tv[j])+'°',{fill:'#fff','font-size':13.5,'font-weight':600});
     const g=el('g',{transform:`translate(${X(j)-13},4)`},svg);g.innerHTML=icon(code(i),skyFor(i).tod==='night').replace('<svg','<svg width="26" height="28"');});
   hourAxis(svg,I,X,178);hook(svg,I,X,2,184);
   $('tSum').textContent=`maks. ${Math.round(days[selDay].max)}° · min. ${Math.round(days[selDay].min)}°`;}
  // szansa opadu (schodki jak w Google) + mm pod spodem
  {const svg=$('cP'),w=frame(svg,170),X=xs(w,n),y0=34,y1=120,fy=v=>y1-v/100*(y1-y0),step=n>1?X(1)-X(0):20;
   let d='';I.forEach((i,j)=>{const v=num(H.precipitation_probability[i])||0,xa=X(j)-step/2,xb=X(j)+step/2;d+=(j?'L':'M')+xa.toFixed(1)+','+fy(v).toFixed(1)+'L'+xb.toFixed(1)+','+fy(v).toFixed(1);});
   el('path',{d:d+`L${(X(n-1)+step/2).toFixed(1)},${y1}L${(X(0)-step/2).toFixed(1)},${y1}Z`,fill:'var(--rain-fill)'},svg);el('path',{d,fill:'none',stroke:'var(--rain)','stroke-width':2.4},svg);
   I.forEach((i,j)=>{const mm=num(H.precipitation[i])||0,t=num(H.precip_type[i])||1;
     if(mm>0){const bh=Math.min(16,4+mm*3);el('rect',{x:X(j)-step*.32,y:y1-bh,width:step*.64,height:bh,rx:2,fill:t===2?'var(--snow)':t===3?'var(--mix)':'#ffffff',opacity:.9},svg);}
     if((num(H.lightning[i])||0)>0)el('path',{d:`M${X(j)+1} ${y1-34}l-5 7h4l-2 6 7-8h-4l2-5z`,fill:'#ffc21a'},svg);
     if(T[i].getHours()%EV())return;tx(svg,X(j),22,Math.round(num(H.precipitation_probability[i])||0)+'%',{fill:'var(--rain)','font-size':13.5,'font-weight':700});
     if(mm>=0.1)tx(svg,X(j),140,pl(mm)+' mm',{'font-size':11,fill:'rgba(255,255,255,.75)'});});
   hourAxis(svg,I,X,160);hook(svg,I,X,2,166);
   const s=days[selDay].sum;$('pSum').textContent=s>=0.1?`suma ${pl(s)} mm`:'bez opadu';}
  // wiatr: strzalki rosnace z predkoscia + liczby (jak Google), porywy
  {const svg=$('cW'),w=frame(svg,150),X=xs(w,n),S=I.map(i=>num(H.wind_speed_10m[i])||0),mx=Math.max(20,...I.map(i=>num(H.wind_gusts_10m[i])||0));
   const fy=v=>118-v/mx*44;el('path',{d:smooth(S.map((v,j)=>[X(j),fy(v)]))+`L${X(n-1)},118L${X(0)},118Z`,fill:'rgba(134,236,217,.18)'},svg);
   el('path',{d:smooth(S.map((v,j)=>[X(j),fy(v)])),fill:'none',stroke:'var(--wind)','stroke-width':2},svg);
   I.forEach((i,j)=>{if(T[i].getHours()%EV())return;const v=S[j],sc=.7+Math.min(1,v/40)*.7,dr=num(H.wind_direction_10m[i])||0;
     const g=el('g',{transform:`translate(${X(j)},34) rotate(${dr+180}) scale(${sc})`},svg);el('path',{d:'M0 -11 L7 7 L0 3 L-7 7 Z',fill:'#fff'},g);
     tx(svg,X(j),66,Math.round(v)+' km/h',{'font-size':12.5,'font-weight':600,fill:'#fff'});
     const gu=num(H.wind_gusts_10m[i]);if(gu!=null)tx(svg,X(j),82,'porywy '+Math.round(gu),{'font-size':10.5,fill:'rgba(255,255,255,.66)'});});
   hourAxis(svg,I,X,140);hook(svg,I,X,2,146);
   const gm=Math.max(...I.map(i=>num(H.wind_gusts_10m[i])||0));$('wSum').textContent=`porywy do ${Math.round(gm)} km/h`;}
  // chmury pietrami: cztery pasy + mgla
  {const svg=$('cC'),w=frame(svg,150),X=xs(w,n),step=n>1?X(1)-X(0):20,rows=[['cloud_high','wysokie'],['cloud_mid','średnie'],['cloud_low','niskie'],['cloud_very_low','b. niskie'],['fog','mgła']],rh=21;
   rows.forEach(([k,l],r)=>{const y=6+r*(rh+2);el('rect',{x:X(0)-step/2,y,width:X(n-1)-X(0)+step,height:rh,rx:6,fill:'rgba(255,255,255,.06)'},svg);
     I.forEach((i,j)=>{const v=num(H[k][i])||0;if(v>2)el('rect',{x:X(j)-step/2+.5,y,width:step-1,height:rh,rx:3,fill:k==='fog'?'var(--fog)':'#ffffff',opacity:(v/100*.8).toFixed(2)},svg);});
     tx(svg,X(0)-step/2+6,y+14.5,l,{'text-anchor':'start','font-size':11,fill:'rgba(255,255,255,.85)'});});
   hourAxis(svg,I,X,140);hook(svg,I,X,2,124);
   const cm=I.reduce((a,i)=>a+(num(H.cloud_cover[i])||0),0)/n;$('cSum').textContent=`średnio ${Math.round(cm)}%`;}
}
// ---- wybrana godzina: blok teraz, niebo, kafle ----
function setHour(i){if(i==null)return;selHour=i;const t=T[i],c=code(i),sk=skyFor(i);
  $('sky').style.background=sk.g;document.body.style.background=sk.g;
  $('when').textContent=i===nowIdx?'Teraz':`${DS[t.getDay()]} ${hh(t.getHours())}`;
  $('nowIco').innerHTML=icon(c,sk.tod==='night');
  $('nowT').innerHTML=Math.round(num(H.temperature_2m[i]))+'<sup>°C</sup>';
  $('nowStats').innerHTML=`<span>Szansa opadów: <b>${Math.round(num(H.precipitation_probability[i])||0)}%</b></span><span>Wilgotność: <b>${Math.round(num(H.relative_humidity_2m[i])||0)}%</b></span><span>Wiatr: <b>${Math.round(num(H.wind_speed_10m[i])||0)} km/h</b></span>`;
  $('sideDay').textContent=DOW[t.getDay()]+', '+hh(t.getHours());$('sideCond').textContent=LABEL[c];
  const d=days[selDay];$('sideRange').textContent=`Maks. ${Math.round(d.max)}°  Min. ${Math.round(d.min)}°`;
  const mo=t.getMonth(),se=mo>=2&&mo<=4?'spring':mo>=5&&mo<=7?'summer':mo>=8&&mo<=10?'autumn':'winter';
  $('land').innerHTML=land(sk.tod==='night',(num(H.soil_temperature_min[i])??5)<=0,se);
  charts.forEach(ch=>{const j=ch.I.indexOf(i);if(j<0){ch.sel.setAttribute('width',0);return;}ch.sel.setAttribute('x',ch.X(j)-ch.step/2);ch.sel.setAttribute('width',ch.step);});
  tiles(i);}
function spark(I,k,col){const w=200,h=34,vals=I.map(i=>num(H[k][i])).filter(v=>v!=null);if(vals.length<2)return'';const lo=Math.min(...vals),hi=Math.max(...vals)||1,X=j=>j*(w/(I.length-1)),Y=v=>h-3-((v-lo)/((hi-lo)||1))*(h-6);
  const p=I.map((i,j)=>[X(j),Y(num(H[k][i])??lo)]);const j0=I.indexOf(selHour);
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" height="${h}" aria-hidden="true"><path d="${smooth(p)}" fill="none" stroke="${col}" stroke-width="2" vector-effect="non-scaling-stroke"/>${j0>=0?`<circle cx="${X(j0)}" cy="${Y(num(H[k][selHour])??lo)}" r="3.5" fill="#fff"/>`:''}</svg>`;}
function tiles(i){const I=days[selDay].idx,t=T[i],q=k=>num(H[k][i]);
  const ap=q('apparent_temperature'),tt=q('temperature_2m'),hum=q('relative_humidity_2m'),dew=q('dew_point_2m'),vis=q('visibility'),p=q('pressure_msl'),p3=num(H.pressure_msl[Math.max(0,i-3)]),g=q('soil_temperature_min');
  const gmin=Math.min(...I.map(j=>num(H.soil_temperature_min[j])??99)),fogMax=Math.max(...I.map(j=>num(H.fog[j])||0)),fogAt=I.find(j=>(num(H.fog[j])||0)===fogMax);
  const fl=Math.max(...I.map(j=>num(H.lightning[j])||0)),flAt=I.find(j=>(num(H.lightning[j])||0)===fl);
  const [sr,ss]=sun(t,RAW.lat,RAW.lon),hrs=t.getHours()+.5,sf=Math.max(0,Math.min(1,(hrs-sr)/(ss-sr)));
  const pf=Math.max(0,Math.min(1,((p||1013)-985)/60)),ang=Math.PI*(1-pf),gx=60+46*Math.cos(ang),gy=58-46*Math.sin(ang),dp=p!=null&&p3!=null?p-p3:0;
  const vk=vis==null?null:vis/1000,base=q('cloud_base_1');
  const T_=[
   ['Odczuwalna',`${pl(ap,0)}°`,ap!=null&&tt!=null&&ap<tt-1.5?'Wiatr sprawia, że jest chłodniej.':'Podobnie do rzeczywistej.',spark(I,'apparent_temperature','var(--temp)')],
   ['Wilgotność',`${Math.round(hum||0)}<small>%</small>`,`Punkt rosy ${pl(dew,0)}°.`,spark(I,'relative_humidity_2m','var(--rain)')],
   ['Widzialność',vk==null?'—':`${vk<1?pl(vk,1):Math.round(vk)}<small>km</small>`,vk==null?'':vk<1?'Mgła — bardzo słaba widoczność.':vk<5?'Zamglenie.':vk<10?'Umiarkowana.':'Dobra widoczność.',spark(I,'visibility','var(--fog)')],
   ['Ciśnienie',`${pl(p,0)}<small>hPa</small>`,Math.abs(dp)<.5?'Stałe w ostatnich 3 h.':(dp>0?'Rośnie':'Spada')+` o ${pl(Math.abs(dp))} hPa w 3 h.`,
     `<svg viewBox="0 0 120 74" height="66" aria-hidden="true"><path d="M14 58 A46 46 0 0 1 106 58" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="7" stroke-linecap="round"/><path d="M14 58 A46 46 0 0 1 ${gx.toFixed(1)} ${gy.toFixed(1)}" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/><text x="14" y="73" font-size="9" fill="rgba(255,255,255,.6)" text-anchor="middle">985</text><text x="106" y="73" font-size="9" fill="rgba(255,255,255,.6)" text-anchor="middle">1045</text></svg>`],
   ['Przy gruncie',`${pl(g,1)}°`,gmin<=0?`Przymrozek przy gruncie (min. ${pl(gmin,1)}°).`:`Najniżej w dniu ${pl(gmin,1)}°, bez przymrozku.`,spark(I,'soil_temperature_min','var(--frost)')],
   ['Opady w dniu',`${pl(days[selDay].sum)}<small>mm</small>`,days[selDay].sum>=0.1?`Szansa do ${Math.round(days[selDay].prob)}%.`:'Sucho przez cały dzień.',spark(I,'precipitation','var(--rain)')],
   ['Mgła',`${Math.round(q('fog')||0)}<small>%</small>`,fogMax>=15?`Najgęstsza ok. ${hh(T[fogAt].getHours())} (${Math.round(fogMax)}%).`:'Bez mgły w tym dniu.',spark(I,'fog','var(--fog)')],
   ['Burze',fl>0?(fl>=30?'Silne':fl>=10?'Umiark.':'Słabe'):'Brak',fl>0?`Wyładowania ok. ${hh(T[flAt].getHours())}.`:'Model nie przewiduje wyładowań.',''],
   ['Słońce',hrs<ss?`${fmtT(ss)}<small>zachód</small>`:`${fmtT(sr)}<small>wschód</small>`,`Wschód ${fmtT(sr)} · zachód ${fmtT(ss)}`,
     `<svg viewBox="0 0 200 54" height="50" aria-hidden="true" preserveAspectRatio="none"><path d="M6 48 Q100 -12 194 48" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="2" stroke-dasharray="3 4"/><line x1="0" x2="200" y1="48" y2="48" stroke="rgba(255,255,255,.3)"/>${hrs>sr&&hrs<ss?`<circle cx="${(6+188*sf).toFixed(1)}" cy="${(48-60*sf*(1-sf)*2).toFixed(1)}" r="6" fill="#ffd166"/>`:''}</svg>`],
   ['Chmury',`${Math.round(q('cloud_cover')||0)}<small>%</small>`,base>0?`Podstawa ${pl(base/1000)} km.`:'Bez podstawy chmur.',spark(I,'cloud_cover','#ffffff')]];
  $('tiles').innerHTML=T_.map(([h,v,d,s])=>`<section class="tile glass"><h3>${h}</h3><div class="v">${v}</div>${s}<div class="d">${d}</div></section>`).join('');}
function modelSel(errId){const s=document.getElementById('mdlSel'),err=document.getElementById(errId);if(!s)return;const cfg=window.ICM_CONFIG||{};if(!cfg.modelSwitch){const sp=document.createElement('span');sp.className=s.className;sp.textContent='ICM '+(RAW.model||'');s.replaceWith(sp);return;}if(!Array.isArray(RAW.models)||!RAW.models.length){s.hidden=true;return;}s.innerHTML='';RAW.models.forEach(m=>{const o=document.createElement('option');o.value=m.id;o.textContent='ICM '+m.label+(m.ok?'':' (poza zasięgiem)');o.disabled=!m.ok;s.appendChild(o);});s.value=RAW.model_id;s.onchange=()=>{const v=s.value,old=err.innerHTML;s.disabled=true;err.textContent='Przełączam model i pobieram prognozę…';const fail=m=>{err.textContent='Nie udało się zmienić modelu: '+m;s.value=RAW.model_id;s.disabled=false;setTimeout(()=>{err.innerHTML=old;},9000);};fetch('api/setmodel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:v})}).then(r=>r.json().catch(()=>({ok:false,error:'HTTP '+r.status}))).then(b=>{if(b.ok){err.textContent='Model: '+b.label+' — wczytuję…';setTimeout(()=>location.reload(),600);}else fail(b.error||'nieznany błąd');}).catch(e=>fail(e&&e.message||e));};}
function note(){const fs=RAW.fstart?new Date(RAW.fstart):null;$('locName').textContent=RAW.name||'Meteogram';document.title='Pogoda — '+(RAW.name||'Meteogram');
  $('note').innerHTML=`Dane: © ICM UW, meteo.pl · bieg ${fs?fs.getUTCDate()+'.'+String(fs.getUTCMonth()+1).padStart(2,'0')+' '+String(fs.getUTCHours()).padStart(2,'0')+' UTC':'—'} · nieoficjalny dodatek, niepowiązany z ICM UW · <a href="https://github.com/o2eric/nowe_meteo/blob/main/DISCLAIMER.md" target="_blank" rel="noopener" style="color:inherit">zastrzeżenia</a>`;}
let rt;window.addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>{renderCharts();setHour(selHour);},200);});
note();modelSel('note');build();
}
