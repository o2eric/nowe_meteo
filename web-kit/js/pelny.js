/* ICM Meteogram — widok „pelny” (web-kit z dodatku Home Assistant „Meteogram (na podstawie ICM)”)
   Dane: © ICM UW, meteo.pl. Projekt nieoficjalny, niepowiązany z ICM UW. */
'use strict';
let RAW;
(function(){var s=document.getElementById('viewSel');if(!s)return;s.value='pelny.html';s.addEventListener('change',function(){location.href=s.value;});})();
fetch((window.ICM_CONFIG||{}).dataUrl||'api/data',{cache:'no-store'}).then(r=>r.ok?r.json():r.json().then(b=>{throw new Error(b.error||('HTTP '+r.status));})).then(d=>{RAW=d;main();}).catch(e=>{document.getElementById('sub').textContent='Nie udało się pobrać danych: '+e.message+' — sprawdź log dodatku.';});
setTimeout(()=>location.reload(),((window.ICM_CONFIG||{}).refreshMinutes||30)*60*1000);
const KEYS=['time','temperature_2m','temp_min','temp_max','apparent_temperature','dew_point_2m','soil_temperature_min','ground_max','precipitation','precipitation_max','precip_type','precipitation_probability','storm','lightning','pressure_msl','wind_speed_10m','wind_gusts_10m','wind_direction_10m','cloud_cover','cloud_high','cloud_mid','cloud_low','cloud_very_low','cloud_base_1','cloud_top','fog','visibility','relative_humidity_2m','weather_code'];
function ensure(h){const n=h.time.length;KEYS.forEach(k=>{if(!Array.isArray(h[k]))h[k]=new Array(n).fill(null);});return h;}
function main(){
const NS='http://www.w3.org/2000/svg';
const axis=document.getElementById('axis'), plot=document.getElementById('plot'), scroller=document.getElementById('scroller');
const store={get(k,d){try{const v=localStorage.getItem('fp_'+k);return v==null?d:JSON.parse(v);}catch(e){return d;}},set(k,v){try{localStorage.setItem('fp_'+k,JSON.stringify(v));}catch(e){}}};
const NOW=new Date();
const DOW=['niedz.','pon.','wt.','śr.','czw.','pt.','sob.'], MON=['sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','lis','gru'];
const num=v=>(v==null||v!==v)?null:+v;
const pl=(v,d)=>v==null?'—':(+v).toFixed(d==null?1:d).replace('.',',');

// ---- pora dnia: wschod/zachod slonca (NOAA) ----
function sun(dt,lat,lon){const s=new Date(dt.getFullYear(),0,0),doy=Math.floor((dt-s)/864e5),g=2*Math.PI/365*(doy-1),r=Math.PI/180;
  const eq=229.18*(0.000075+0.001868*Math.cos(g)-0.032077*Math.sin(g)-0.014615*Math.cos(2*g)-0.040849*Math.sin(2*g));
  const de=0.006918-0.399912*Math.cos(g)+0.070257*Math.sin(g)-0.006758*Math.cos(2*g)+0.000907*Math.sin(2*g)-0.002697*Math.cos(3*g)+0.00148*Math.sin(3*g);
  let c=Math.cos(90.833*r)/(Math.cos(lat*r)*Math.cos(de))-Math.tan(lat*r)*Math.tan(de);c=Math.max(-1,Math.min(1,c));
  const ha=Math.acos(c)/r,off=-dt.getTimezoneOffset()/60;return [(720-4*(lon+ha)-eq)/60+off,(720-4*(lon-ha)-eq)/60+off];}

let H, N, T, nowIdx, COL, hover=null;
const ALL=[['sky','Pogoda'],['temp','Temperatura'],['ground','Przy gruncie'],['prec','Opad'],['prob','Szansa i burze'],['wind','Wiatr'],['pres','Ciśnienie'],['cloud','Przekrój chmur'],['vis','Widzialność'],['hum','Wilgotność']];
let shown=store.get('shown',ALL.map(a=>a[0])), dens=store.get('dens',1);

function el(n,a,parent){const e=document.createElementNS(NS,n);for(const k in a)e.setAttribute(k,a[k]);if(parent)parent.appendChild(e);return e;}
function txt(parent,x,y,s,a){const t=el('text',Object.assign({x,y,'font-size':11,fill:'var(--muted)'},a||{}),parent);t.textContent=s;return t;}
const X=i=>i*COL+COL/2;
function smooth(pts){if(pts.length<2)return'';let d=`M${pts[0][0]},${pts[0][1]}`;for(let i=0;i<pts.length-1;i++){const p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2;
  d+=`C${(p1[0]+(p2[0]-p0[0])/6).toFixed(1)},${(p1[1]+(p2[1]-p0[1])/6).toFixed(1)} ${(p2[0]-(p3[0]-p1[0])/6).toFixed(1)},${(p2[1]-(p3[1]-p1[1])/6).toFixed(1)} ${p2[0]},${(+p2[1]).toFixed(1)}`;}return d;}
function runs(arr,fy){const out=[];let cur=[];arr.forEach((v,i)=>{const n=num(v);if(n==null){if(cur.length)out.push(cur);cur=[];}else cur.push([X(i),fy(n)]);});if(cur.length)out.push(cur);return out;}
function line(g,arr,fy,st){runs(arr,fy).forEach(r=>{if(r.length>1)el('path',Object.assign({d:smooth(r),fill:'none','stroke-linejoin':'round','stroke-linecap':'round'},st),g);});}
function band(g,up,lo,fy,fill){let top=[],bot=[];const flush=()=>{if(top.length>1)el('path',{d:'M'+top.join('L')+'L'+bot.reverse().join('L')+'Z',fill},g);top=[];bot=[];};
  for(let i=0;i<N;i++){const a=num(up[i]),b=num(lo[i]);if(a==null||b==null){flush();continue;}top.push([X(i),fy(a).toFixed(1)]);bot.push([X(i),fy(b).toFixed(1)]);}flush();}
function nice(lo,hi,n){const raw=(hi-lo)/n,m=Math.pow(10,Math.floor(Math.log10(raw||1))),r=raw/m;return (r<1.5?1:r<3?2:r<7?5:10)*m;}
function ticks(ax,P,vals,fy,fmt){vals.forEach(v=>{const y=fy(v);el('line',{x1:0,x2:N*COL,y1:y,y2:y,stroke:'var(--grid)'},P.g);txt(ax,LEFT-8,y+3.5,fmt(v),{'text-anchor':'end','font-size':10.5,class:'mono'});});}
const dirName=d=>['N','NE','E','SE','S','SW','W','NW'][Math.round(d/45)%8];
function code(i){const p=num(H.precipitation[i])||0,t=num(H.precip_type[i])||0,c=num(H.cloud_cover[i])||0;
  if((num(H.storm[i])||0)>1||(num(H.lightning[i])||0)>0)return'storm';if((num(H.fog[i])||0)>=50)return'fog';
  if(p>=0.1)return t===2?'snow':t===3?'mix':'rain';return c<20?'clear':c<60?'part':'cloud';}
const LABEL={clear:'Bezchmurnie',part:'Częściowe zachm.',cloud:'Pochmurno',fog:'Mgła',rain:'Deszcz',snow:'Śnieg',mix:'Deszcz ze śniegiem',storm:'Burza'};
function icon(g,x,y,c,night){const k=el('g',{transform:`translate(${x-11},${y-11})`},g);
  const cl=(f)=>el('path',{d:'M6 17h10a4 4 0 0 0 .3-8A5.8 5.8 0 0 0 5.2 10.6 3.6 3.6 0 0 0 6 17Z',fill:f},k);
  const body=()=>night?el('path',{d:'M14 3a8 8 0 1 0 6 12 6.5 6.5 0 0 1-6-12z',fill:'#cbd5e1'},k):el('circle',{cx:11,cy:11,r:5,fill:'#f2a922'},k);
  if(c==='clear'){body();return;} if(c==='part'){const b=body();b.setAttribute('transform','translate(-3,-3) scale(.85)');cl('#a3b1c2');return;}
  cl(c==='storm'?'#6b7788':'#97a6b8');
  if(c==='rain')[7,11,15].forEach(xx=>el('line',{x1:xx,y1:19,x2:xx-2,y2:23,stroke:'var(--rain)','stroke-width':1.8,'stroke-linecap':'round'},k));
  if(c==='snow')[7,11,15].forEach(xx=>el('circle',{cx:xx,cy:21,r:1.4,fill:'var(--snow)'},k));
  if(c==='mix'){el('line',{x1:8,y1:19,x2:6,y2:23,stroke:'var(--rain)','stroke-width':1.8,'stroke-linecap':'round'},k);el('circle',{cx:14,cy:21,r:1.4,fill:'var(--snow)'},k);}
  if(c==='fog')[18,21].forEach(yy=>el('line',{x1:4,y1:yy,x2:18,y2:yy,stroke:'var(--fog)','stroke-width':1.6,'stroke-linecap':'round'},k));
  if(c==='storm')el('path',{d:'M12 15l-3 4h2.5l-1.5 4 5-5.5h-2.5l1.5-2.5z',fill:'#f2a922'},k);}

let LEFT=150, NARROW=false;
// ---- pasy: wysokosc, rysowanie, odczyt ----
const PAN={
 sky:{h:46,draw(P){for(let i=0;i<N;i++){if(T[i].getHours()%3)continue;icon(P.g,X(i),P.y+P.h/2,code(i),T[i].night);}},
   read:i=>[LABEL[code(i)],(T[i].night?'noc':'dzień')]},
 temp:{h:150,unit:'°C',draw(P,ax){const k=['temperature_2m','temp_min','temp_max','apparent_temperature','dew_point_2m'],all=[];k.forEach(a=>H[a].forEach(v=>{if(num(v)!=null)all.push(+v);}));
   let lo=Math.floor(Math.min(...all))-1,hi=Math.ceil(Math.max(...all))+1;const fy=v=>P.y+P.h-(v-lo)/(hi-lo)*P.h,st=nice(lo,hi,4),tk=[];for(let v=Math.ceil(lo/st)*st;v<=hi;v+=st)tk.push(v);
   ticks(ax,P,tk,fy,v=>v+'°');if(lo<0&&hi>0)el('line',{x1:0,x2:N*COL,y1:fy(0),y2:fy(0),stroke:'var(--frost)','stroke-dasharray':'4 3'},P.g);
   band(P.g,H.temp_max,H.temp_min,fy,'var(--temp-soft)');
   line(P.g,H.dew_point_2m,fy,{stroke:'var(--rain)','stroke-width':1.5,'stroke-dasharray':'1 3.5'});
   line(P.g,H.apparent_temperature,fy,{stroke:'var(--temp)','stroke-width':1.5,'stroke-dasharray':'5 4',opacity:.8});
   line(P.g,H.temperature_2m,fy,{stroke:'var(--temp)','stroke-width':2.4});
   for(let i=0;i<N;i++)if(T[i].getHours()%6===0){const v=num(H.temperature_2m[i]);if(v!=null)txt(P.g,X(i),fy(v)-8,Math.round(v)+'°',{'text-anchor':'middle',fill:'var(--ink)','font-weight':600});}
   P.dot=i=>{const v=num(H.temperature_2m[i]);return v==null?null:[X(i),fy(v),'var(--temp)'];};},
   read:i=>[pl(H.temperature_2m[i])+'°',`odcz. ${pl(H.apparent_temperature[i])}° · rosa ${pl(H.dew_point_2m[i])}°`],
   key:[['var(--temp)','temp.',''],['var(--temp)','odczuwalna','5 4'],['var(--rain)','punkt rosy','1 3.5']]},
 ground:{h:30,draw(P){for(let i=0;i<N;i++){const v=num(H.soil_temperature_min[i]);if(v==null)continue;const fr=v<=0;
     el('rect',{x:i*COL+1,y:P.y+4,width:COL-2,height:P.h-8,rx:3,fill:fr?'var(--frost)':'var(--grid)',opacity:fr?Math.min(1,.45+(-v)/4):1},P.g);}
   for(let i=0;i<N;i++)if(T[i].getHours()%6===3){const v=num(H.soil_temperature_min[i]);if(v!=null)txt(P.g,X(i),P.y+P.h/2+4,pl(v,0)+'°',{'text-anchor':'middle','font-size':10.5,fill:v<=0?'#fff':'var(--ink2)'});}},
   read:i=>{const v=num(H.soil_temperature_min[i]);return [pl(v)+'°', v!=null&&v<=0?'przymrozek przy gruncie':`maks. ${pl(H.ground_max[i])}°`];}},
 prec:{h:96,unit:'mm/h',empty:()=>H.precipitation.every(v=>!(num(v)>0))&&H.precipitation_max.every(v=>!(num(v)>0)),
   draw(P,ax){const mx=Math.max(...H.precipitation.map(v=>num(v)||0),...H.precipitation_max.map(v=>num(v)||0));let top=[1,2,5,10,20].find(t=>mx<=t)||Math.ceil(mx/10)*10;
   const fy=v=>P.y+P.h-Math.min(v,top)/top*P.h;ticks(ax,P,[0,top/2,top],fy,v=>pl(v,top<=2?1:0));
   for(let i=0;i<N;i++){const a=num(H.precipitation[i])||0,m=num(H.precipitation_max[i])||0,t=num(H.precip_type[i])||1,c=t===2?'var(--snow)':t===3?'var(--mix)':'var(--rain)';
     if(m>a)el('rect',{x:i*COL+4,y:fy(m),width:COL-8,height:fy(a)-fy(m),rx:3,fill:'none',stroke:c,'stroke-width':1.2,'stroke-dasharray':'2 2'},P.g);
     if(a>0)el('rect',{x:i*COL+4,y:fy(a),width:COL-8,height:Math.max(2,P.y+P.h-fy(a)),rx:3,fill:c},P.g);}},
   read:i=>{const t=num(H.precip_type[i])||0,a=num(H.precipitation[i])||0;return [pl(a)+' mm',a>0?(t===2?'śnieg':t===3?'deszcz ze śniegiem':'deszcz')+` · maks. ${pl(H.precipitation_max[i])}`:'bez opadu'];},
   key:[['var(--rain)','deszcz',''],['var(--snow)','śnieg',''],['var(--mix)','z śniegiem','']]},
 prob:{h:64,unit:'%',empty:()=>H.precipitation_probability.every(v=>!(num(v)>=5))&&H.storm.every(v=>!(num(v)>1))&&H.lightning.every(v=>!(num(v)>0)),
   draw(P,ax){const fy=v=>P.y+P.h-v/100*(P.h-14);ticks(ax,P,[0,50,100],fy,v=>v);
   const pts=H.precipitation_probability.map((v,i)=>[X(i),fy(num(v)||0)]);el('path',{d:smooth(pts)+`L${X(N-1)},${P.y+P.h}L${X(0)},${P.y+P.h}Z`,fill:'var(--rain-soft)'},P.g);
   el('path',{d:smooth(pts),fill:'none',stroke:'var(--rain)','stroke-width':1.8},P.g);
   for(let i=0;i<N;i++){const f=num(H.lightning[i])||0,s=num(H.storm[i])||0;if(f>0||s>1){const k=el('g',{transform:`translate(${X(i)-6},${P.y-1})`},P.g);
     el('path',{d:'M7 0L1 8h4l-2 6 7-8H6l2-6z',fill:f>=30?'#c81e1e':f>=10?'#e8590c':'#f2a922',stroke:'var(--panel)','stroke-width':1},k);}}},
   read:i=>{const f=num(H.lightning[i])||0;return [Math.round(num(H.precipitation_probability[i])||0)+'%',f>0?`burza · wyładowania ${f>=30?'silne':f>=10?'umiark.':'słabe'}`:(num(H.storm[i])||0)>1?'możliwa burza':'bez burzy'];}},
 wind:{h:112,unit:'km/h',draw(P,ax){const S=H.wind_speed_10m,G=H.wind_gusts_10m,mx=Math.max(20,...S.map(v=>num(v)||0),...G.map(v=>num(v)||0)),top=Math.ceil(mx/10)*10;
   const y0=P.y+16,hh=P.h-16,fy=v=>y0+hh-Math.min(v,top)/top*hh;ticks(ax,P,[0,Math.round(top/2),top],fy,v=>v);
   [[35,'silny'],[55,'b. silne porywy']].forEach(([v,l])=>{if(v<top){el('line',{x1:0,x2:N*COL,y1:fy(v),y2:fy(v),stroke:'var(--muted)','stroke-dasharray':'3 4',opacity:.6},P.g);for(let i=0;i<N;i+=24)txt(P.g,i*COL+4,fy(v)-3,l,{'font-size':10});}});
   const pts=S.map((v,i)=>[X(i),fy(num(v)||0)]);el('path',{d:smooth(pts)+`L${X(N-1)},${y0+hh}L${X(0)},${y0+hh}Z`,fill:'var(--wind-soft)'},P.g);
   for(let i=0;i<N;i++){const g=num(G[i]);if(g!=null)el('line',{x1:i*COL+6,x2:i*COL+COL-6,y1:fy(g),y2:fy(g),stroke:'var(--wind)','stroke-width':2,'stroke-linecap':'round',opacity:.6},P.g);}
   el('path',{d:smooth(pts),fill:'none',stroke:'var(--wind)','stroke-width':2.2},P.g);
   for(let i=0;i<N;i+=2){const d=num(H.wind_direction_10m[i]);if(d==null)continue;const k=el('g',{transform:`translate(${X(i)},${P.y+7}) rotate(${d+180})`},P.g);
     el('path',{d:'M0 -6 L4 4 L0 1.6 L-4 4 Z',fill:'var(--ink2)'},k);}
   P.dot=i=>{const v=num(S[i]);return v==null?null:[X(i),fy(v),'var(--wind)'];};},
   read:i=>[Math.round(num(H.wind_speed_10m[i])||0)+' km/h',`porywy ${Math.round(num(H.wind_gusts_10m[i])||0)} · z ${dirName(num(H.wind_direction_10m[i])||0)}`],
   key:[['var(--wind)','średni',''],['var(--wind)','porywy','6 3']]},
 pres:{h:70,unit:'hPa',draw(P,ax){const v=H.pressure_msl.map(num).filter(x=>x!=null);let lo=Math.min(...v),hi=Math.max(...v);if(hi-lo<10){const c=(hi+lo)/2;lo=c-5;hi=c+5;}lo=Math.floor(lo);hi=Math.ceil(hi);
   const fy=x=>P.y+P.h-(x-lo)/(hi-lo)*P.h,st=nice(lo,hi,2),tk=[];for(let t=Math.ceil(lo/st)*st;t<=hi;t+=st)tk.push(t);ticks(ax,P,tk,fy,t=>t);
   line(P.g,H.pressure_msl,fy,{stroke:'var(--ink2)','stroke-width':2});P.dot=i=>{const x=num(H.pressure_msl[i]);return x==null?null:[X(i),fy(x),'var(--ink2)'];};},
   read:i=>{const a=num(H.pressure_msl[i]),b=num(H.pressure_msl[Math.max(0,i-3)]);const d=a!=null&&b!=null?a-b:0;return [pl(a,0)+' hPa',Math.abs(d)<0.5?'stałe (3 h)':(d>0?'rośnie ':'spada ')+pl(Math.abs(d))+' w 3 h'];}},
 cloud:{h:132,unit:'km',draw(P,ax){const KM=[0,0.5,2,6,12],fy=km=>{let q=0;while(q<KM.length-2&&km>KM[q+1])q++;const f=Math.min(1,Math.max(0,(km-KM[q])/(KM[q+1]-KM[q])));return P.y+P.h-((q+f)/(KM.length-1))*P.h;};
   KM.forEach(k=>{const y=fy(k);el('line',{x1:0,x2:N*COL,y1:y,y2:y,stroke:'var(--grid)'},P.g);txt(ax,LEFT-8,y+3.5,pl(k,k<1&&k>0?1:0),{'text-anchor':'end','font-size':10.5,class:'mono'});});
   const L=[['cloud_very_low',0,0.5],['cloud_low',0.5,2],['cloud_mid',2,6],['cloud_high',6,12]];
   for(let i=0;i<N;i++){L.forEach(([k,a,b])=>{const v=num(H[k][i])||0;if(v>2)el('rect',{x:i*COL,y:fy(b)+1,width:COL,height:fy(a)-fy(b)-2,fill:'var(--cloud)',opacity:(v/100*.85).toFixed(2)},P.g);});
     const fg=num(H.fog[i])||0;if(fg>5)el('rect',{x:i*COL,y:P.y+P.h-9,width:COL,height:9,fill:'var(--fog)',opacity:(fg/100).toFixed(2)},P.g);
     const b=num(H.cloud_base_1[i]);if(b>0)el('line',{x1:i*COL+5,x2:i*COL+COL-5,y1:fy(b/1000),y2:fy(b/1000),stroke:'var(--ink)','stroke-width':2.2,'stroke-linecap':'round'},P.g);
     const t=num(H.cloud_top[i]);if(t>0)el('line',{x1:i*COL+8,x2:i*COL+COL-8,y1:fy(t/1000),y2:fy(t/1000),stroke:'var(--ink2)','stroke-width':1.2,'stroke-dasharray':'2 2',opacity:.7},P.g);}
   [['b. niskie',0,0.5],['niskie',0.5,2],['średnie',2,6],['wysokie',6,12]].forEach(([l,a,b])=>{for(let i=0;i<N;i+=24)txt(P.g,i*COL+4,(fy(a)+fy(b))/2+3.5,l,{'font-size':10,fill:'var(--ink2)'});});},
   read:i=>{const b=num(H.cloud_base_1[i]);return [Math.round(num(H.cloud_cover[i])||0)+'%',b>0?`podstawa ${pl(b/1000)} km`:'bez podstawy'];},
   key:[['var(--cloud)','piętra',''],['var(--ink)','podstawa',''],['var(--ink2)','wierzchołek','2 2'],['var(--fog)','mgła','']]},
 vis:{h:30,draw(P){for(let i=0;i<N;i++){const v=num(H.visibility[i]);if(v==null)continue;const km=v/1000,c=km<10?'var(--fog)':'var(--grid)',o=km<1?1:km<5?.55:km<10?.25:1;
     el('rect',{x:i*COL+1,y:P.y+4,width:COL-2,height:P.h-8,rx:3,fill:c,opacity:o},P.g);}
   for(let i=0;i<N;i++)if(T[i].getHours()%6===3){const v=num(H.visibility[i]);if(v!=null)txt(P.g,X(i),P.y+P.h/2+4,v<1000?pl(v/1000,1):Math.round(v/1000),{'text-anchor':'middle','font-size':10.5,fill:v<1000?'#fff':'var(--ink2)'});}},
   read:i=>{const v=num(H.visibility[i]);return [v==null?'—':(v<1000?pl(v/1000,1):Math.round(v/1000))+' km',v==null?'':v<1000?'mgła':v<5000?'zamglenie':v<10000?'umiarkowana':'dobra'];}},
 hum:{h:60,unit:'%',draw(P,ax){const fy=v=>P.y+P.h-v/100*P.h;ticks(ax,P,[50,100],fy,v=>v);line(P.g,H.relative_humidity_2m,fy,{stroke:'var(--rain)','stroke-width':1.8});
   P.dot=i=>{const v=num(H.relative_humidity_2m[i]);return v==null?null:[X(i),fy(v),'var(--rain)'];};},
   read:i=>[Math.round(num(H.relative_humidity_2m[i])||0)+'%','wilgotność względna']}
};
const NAMES=Object.fromEntries(ALL);
const SHORT={sky:'Pogoda',temp:'Temp.',ground:'Grunt',prec:'Opad',prob:'Szansa',wind:'Wiatr',pres:'Ciśn.',cloud:'Chmury',vis:'Widz.',hum:'Wilg.'};

let layout=[];
function build(){
  H=ensure(RAW.hourly); N=H.time.length;
  NARROW=window.innerWidth<640; LEFT=NARROW?112:150; COL=NARROW?24:30;
  T=H.time.map(s=>new Date(s+':00'));
  const days={};T.forEach(t=>{const k=t.toDateString();if(!days[k])days[k]=sun(t,RAW.lat,RAW.lon);const [sr,ss]=days[k],hh=t.getHours()+.5;t.night=hh<sr||hh>ss;});
  nowIdx=Math.max(0,Math.min(N-1,Math.round((NOW-T[0])/36e5)));
  axis.innerHTML='';plot.innerHTML='';
  const W=N*COL, HEAD=38, GAP=Math.round(30*dens);
  let y=HEAD+8; layout=[];
  ALL.forEach(([id])=>{if(!shown.includes(id))return;const p=PAN[id];const empty=p.empty&&p.empty();const h=empty?22:Math.round(p.h*(id==='sky'||id==='ground'||id==='vis'?1:dens));
    layout.push({id,p,y:y+GAP-8,h,empty});y+=GAP+h;});
  const TOT=y+14;
  axis.setAttribute('width',LEFT);axis.setAttribute('height',TOT);plot.setAttribute('width',W);plot.setAttribute('height',TOT);plot.setAttribute('viewBox',`0 0 ${W} ${TOT}`);axis.setAttribute('viewBox',`0 0 ${LEFT} ${TOT}`);
  // tlo: noc + dni
  const bg=el('g',{},plot);
  for(let i=0;i<N;i++){if(T[i].night)el('rect',{x:i*COL,y:HEAD,width:COL,height:TOT-HEAD,fill:'var(--night)'},bg);
    if(T[i].getHours()===0)el('line',{x1:i*COL,x2:i*COL,y1:0,y2:TOT,stroke:'var(--line)'},bg);
    if(T[i].getHours()%3===0)txt(bg,X(i),HEAD-6,String(T[i].getHours()).padStart(2,'0'),{'text-anchor':'middle','font-size':10.5,class:'mono'});}
  const seen={};T.forEach((t,i)=>{const k=t.toDateString();if(seen[k])return;seen[k]=1;const last=T.findLastIndex?T.findLastIndex(x=>x.toDateString()===k):i+23;
    const cx=Math.max(i*COL+6,0);txt(bg,cx,15,`${DOW[t.getDay()]} ${t.getDate()} ${MON[t.getMonth()]}`,{'font-size':12,'font-weight':600,fill:'var(--ink)'});});
  txt(axis,12,15,'Godzina',{'font-size':11,'font-weight':600,fill:'var(--ink2)'});
  // pasy
  layout.forEach(L=>{const P={y:L.y,h:L.h,g:el('g',{},plot)};L.P=P;
    txt(axis,12,L.y-10,NARROW?SHORT[L.id]:NAMES[L.id]+(L.p.unit&&!L.empty?` (${L.p.unit})`:''),{'font-size':11.5,'font-weight':600,fill:'var(--ink)'});
    if(L.empty){txt(P.g,8,L.y+L.h/2+4,L.id==='prec'?'Bez opadu w całej prognozie':'Bez opadów i burz w całej prognozie',{'font-size':12,fill:'var(--ink2)'});
      el('line',{x1:0,x2:W,y1:L.y+L.h,y2:L.y+L.h,stroke:'var(--grid)'},P.g);L.r1=txt(axis,12,L.y+L.h/2+4,'—',{'font-size':12,fill:'var(--muted)'});return;}
    L.p.draw(P,axis);
    if(NARROW){L.r1=L.id==='sky'?{}:txt(axis,LEFT-8,L.y-10,'',{'font-size':11.5,'font-weight':600,fill:'var(--ink)','text-anchor':'end'});L.r2=null;}
    else{L.r1=txt(axis,12,L.y+16,'',{'font-size':L.h>40?17:13,'font-weight':600,fill:'var(--ink)'});
    L.r2=L.h>40?txt(axis,12,L.y+32,'',{'font-size':10.5,fill:'var(--ink2)'}):null;}
    if(L.p.key&&L.h>=90&&LEFT>120){L.p.key.forEach(([c,l,da],k)=>{const yy=L.y+L.h-8-(L.p.key.length-1-k)*14;el('line',{x1:12,x2:28,y1:yy-3.5,y2:yy-3.5,stroke:c,'stroke-width':2.2,'stroke-dasharray':da||'none','stroke-linecap':'round'},axis);txt(axis,34,yy,l,{'font-size':10.5});});}
  });
  // teraz + kursor
  el('line',{x1:X(nowIdx),x2:X(nowIdx),y1:HEAD-2,y2:TOT,stroke:'var(--now)','stroke-width':1.4,'stroke-dasharray':'3 3'},plot);
  txt(plot,X(nowIdx)+4,HEAD-18,'teraz',{'font-size':10.5,'font-weight':700,fill:'var(--now)'});
  const cur=el('g',{opacity:0},plot);el('rect',{x:-COL/2,y:HEAD,width:COL,height:TOT-HEAD,fill:'var(--ink)',opacity:.06},cur);
  const dots=layout.filter(L=>L.P&&L.P.dot).map(L=>({L,c:el('circle',{r:4.5,fill:'var(--panel)','stroke-width':2.2},cur)}));
  const timeLab=txt(axis,12,30,'',{'font-size':NARROW?10:11,class:'mono'});
  function readout(i,isHover){cur.setAttribute('opacity',isHover?1:0);cur.setAttribute('transform',`translate(${X(i)},0)`);
    dots.forEach(({L,c})=>{const d=L.P.dot(i);if(!d){c.setAttribute('opacity',0);return;}c.setAttribute('opacity',1);c.setAttribute('cx',0);c.setAttribute('cy',d[1]);c.setAttribute('stroke',d[2]);});
    timeLab.textContent=(isHover||NARROW?'':'teraz · ')+DOW[T[i].getDay()]+' '+String(T[i].getHours()).padStart(2,'0')+':00';
    layout.forEach(L=>{if(L.empty)return;const r=L.p.read(i);if(L.r1.setAttribute)L.r1.textContent=r[0];if(L.r2)L.r2.textContent=r[1];});}
  readout(nowIdx,false);
  const idx=e=>{const r=plot.getBoundingClientRect(),cx=(e.touches?e.touches[0].clientX:e.clientX)-r.left;return Math.max(0,Math.min(N-1,Math.floor(cx/COL)));};
  scroller.onmousemove=e=>readout(idx(e),true);scroller.onmouseleave=()=>readout(nowIdx,false);
  scroller.ontouchstart=scroller.ontouchmove=e=>readout(idx(e),true);
  scroller.scrollLeft=Math.max(0,X(nowIdx)-scroller.clientWidth*.25);
  const fs=RAW.fstart?new Date(RAW.fstart):null;
  document.getElementById('ttl').textContent=(RAW.name||'Meteogram');
  document.getElementById('sub').textContent=`Na podstawie modelu ICM ${RAW.model||''} · wszystkie wartości na jednej osi czasu — najedź na godzinę, odczyt stoi po lewej.`;
  document.getElementById('sample').innerHTML=`Dane: © ICM UW, meteo.pl · bieg ${fs?fs.getUTCDate()+'.'+String(fs.getUTCMonth()+1).padStart(2,'0')+' '+String(fs.getUTCHours()).padStart(2,'0')+' UTC':'—'} · ${N} h · nieoficjalny dodatek, niepowiązany z ICM UW · <a href="https://github.com/o2eric/nowe_meteo/blob/main/DISCLAIMER.md" target="_blank" rel="noopener">zastrzeżenia</a>`;
}
// ---- sterowanie ----
const chips=document.getElementById('chips');
ALL.forEach(([id,l])=>{const b=document.createElement('button');b.type='button';b.className='chip';b.textContent=l;b.setAttribute('aria-pressed',shown.includes(id));
  b.onclick=()=>{shown=shown.includes(id)?shown.filter(x=>x!==id):ALL.map(a=>a[0]).filter(x=>x===id||shown.includes(x));if(!shown.length)shown=[id];
    chips.querySelectorAll('.chip').forEach((c,k)=>c.setAttribute('aria-pressed',shown.includes(ALL[k][0])));store.set('shown',shown);build();};chips.appendChild(b);});
function seg(id,cb,init){const g=document.getElementById(id);g.querySelectorAll('button').forEach(b=>{if(init!=null)b.setAttribute('aria-pressed',String(b.dataset.v==String(init)));
  b.onclick=()=>{g.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));cb(b.dataset.v);build();};});}
seg('dens',v=>{dens=+v;store.set('dens',dens);},dens);
let rt;window.addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(build,200);});
modelSel('sub');
build();
}
function modelSel(errId){const s=document.getElementById('mdlSel'),err=document.getElementById(errId);if(!s)return;const cfg=window.ICM_CONFIG||{};if(!cfg.modelSwitch){const sp=document.createElement('span');sp.className=s.className;sp.textContent='ICM '+(RAW.model||'');s.replaceWith(sp);return;}if(!Array.isArray(RAW.models)||!RAW.models.length){s.hidden=true;return;}s.innerHTML='';RAW.models.forEach(m=>{const o=document.createElement('option');o.value=m.id;o.textContent='ICM '+m.label+(m.ok?'':' (poza zasięgiem)');o.disabled=!m.ok;s.appendChild(o);});s.value=RAW.model_id;s.onchange=()=>{const v=s.value,old=err.innerHTML;s.disabled=true;err.textContent='Przełączam model i pobieram prognozę…';const fail=m=>{err.textContent='Nie udało się zmienić modelu: '+m;s.value=RAW.model_id;s.disabled=false;setTimeout(()=>{err.innerHTML=old;},9000);};fetch('api/setmodel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:v})}).then(r=>r.json().catch(()=>({ok:false,error:'HTTP '+r.status}))).then(b=>{if(b.ok){err.textContent='Model: '+b.label+' — wczytuję…';setTimeout(()=>location.reload(),600);}else fail(b.error||'nieznany błąd');}).catch(e=>fail(e&&e.message||e));};}
