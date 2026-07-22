/* ChipScribe editor runtime.
   Features: drag/multi-select/marquee, undo-redo, copy-paste, duplicate, delete,
   draw line/arrow/box/text, IEEE circuit stamps, rotate, resize handles, align/
   distribute, z-order, snap grid, grid overlay, zoom, dashed/gray/text-size,
   save status, SVG/PNG/JSON export, JSON import. */
(function(){
const NS="http://www.w3.org/2000/svg";
const svg=document.getElementById("d");
const fig=document.getElementById("figbox");
const svEl=document.getElementById("sv");
let edit=false, tool="sel", stamp="amp", off={}, add=[], chipOn=true;
let dashOn=false, grayOn=false, snapOn=true, gridOn=false, zoom=1, tsz=10.5;
let selSet=new Set(), clip=null;
let undoStk=[], redoStk=[];
let storageOK=true;
try{localStorage.setItem("__t","1");localStorage.removeItem("__t");}catch(e){storageOK=false;}
try{const st=JSON.parse(localStorage.getItem("chipscribe_public_v1")||"{}");off=st.off||{};add=st.add||[];chipOn=st.chip!==false;}catch(e){off={};add=[];}
if(!storageOK){svEl.textContent="⚠ no browser storage — Copy layout JSON before leaving";svEl.className="warn";}
let svT=null;
function applyChip(){
  const cb=svg.querySelector("#chipbound");
  if(cb)cb.style.display=chipOn?"":"none";
}
function save(){
  if(!storageOK)return;
  try{localStorage.setItem("chipscribe_public_v1",JSON.stringify({off:off,add:add,chip:chipOn}));}catch(e){}
  svEl.className=""; svEl.textContent="saved ✓";
  clearTimeout(svT); svT=setTimeout(()=>{svEl.textContent="";},1600);
}
function el(tag,attrs,text){
  const e=document.createElementNS(NS,tag);
  for(const k in attrs)e.setAttribute(k,attrs[k]);
  if(text!==undefined)e.textContent=text;
  return e;
}
/* ---------- grid + handles layers ---------- */
const defs=el("defs",{});
const gpat=el("pattern",{id:"gpat",width:10,height:10,patternUnits:"userSpaceOnUse"});
gpat.appendChild(el("path",{d:"M 10 0 H 0 V 10",fill:"none",stroke:"#dbe6f2","stroke-width":"0.6"}));
defs.appendChild(gpat);
svg.insertBefore(defs,svg.firstChild);
const gridlay=el("g",{id:"gridlay",style:"display:none"});
gridlay.appendChild(el("rect",{x:0,y:0,width:1100,height:640,fill:"url(#gpat)"}));
svg.insertBefore(gridlay,defs.nextSibling);
const hlay=el("g",{id:"hlay"});
svg.appendChild(hlay);
/* ---------- shapes ---------- */
function arrowHead(p1,p2){
  const dx=p2[0]-p1[0],dy=p2[1]-p1[1],L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L;
  const bx=p2[0]-8*ux,by=p2[1]-8*uy;
  return el("polygon",{points:`${p2[0]},${p2[1]} ${bx-3.5*uy},${by+3.5*ux} ${bx+3.5*uy},${by-3.5*ux}`,fill:"#000"});
}
function mkSine(x,y,w,ry){
  const r=w/4;
  return el("path",{d:`M ${x} ${y} q ${r} ${-2*ry} ${2*r} 0 q ${r} ${2*ry} ${2*r} 0`,
    fill:"none",stroke:"#000","stroke-width":"1.8"});
}
function lineEl(a){return el("line",Object.assign({stroke:"#000","stroke-width":"1.8"},a));}
function shapeFor(it){
  const f=document.createDocumentFragment();
  const dash=it.dash?{"stroke-dasharray":"5 3.5"}:{};
  const x=it.x,y=it.y;
  if(it.type==="line"||it.type==="arrow"){
    f.appendChild(el("polyline",Object.assign({points:(it.type==="arrow"?headBase(it.pts):it.pts).map(p=>p.join(",")).join(" "),
      fill:"none",stroke:"#000","stroke-width":"2"},dash)));
    if(it.type==="arrow")f.appendChild(arrowHead(it.pts[it.pts.length-2],it.pts[it.pts.length-1]));
  }else if(it.type==="box"){
    f.appendChild(el("rect",Object.assign({x:it.x,y:it.y,width:it.w,height:it.h,
      fill:"none",stroke:"#000","stroke-width":"2"},dash)));
  }else if(it.type==="text"){
    f.appendChild(el("text",{x:x,y:y,"font-size":Math.round((it.fs||10.5)*1.3*10)/10,
      "font-family":"Helvetica,Arial,sans-serif",fill:it.gray?"#777":"#111",
      "font-style":it.gray?"italic":"normal"},it.t));
  }else if(it.type==="amp"){
    f.appendChild(el("polygon",{points:`${x-15},${y-16} ${x-15},${y+16} ${x+15},${y}`,
      fill:"#fff",stroke:"#000","stroke-width":"2.1"}));
  }else if(it.type==="vga"){
    f.appendChild(el("polygon",{points:`${x-15},${y-16} ${x-15},${y+16} ${x+15},${y}`,
      fill:"#fff",stroke:"#000","stroke-width":"2.1"}));
    const vp=[[x-12,y+19],[x+14,y-21]];
    f.appendChild(el("polyline",{points:headBase(vp).map(p=>p.join(",")).join(" "),
      fill:"none",stroke:"#000","stroke-width":"1.8"}));
    f.appendChild(arrowHead(vp[0],vp[1]));
  }else if(it.type==="camp"){
    const n=it.n||2, W=34+16*(n-1), x0=x-W/2;
    for(let i=0;i<n;i++)
      f.appendChild(el("polygon",{points:`${x0+16*i},${y-19} ${x0+16*i},${y+19} ${x0+16*i+34},${y}`,
        fill:"#fff",stroke:"#000","stroke-width":"2.1"}));
  }else if(it.type==="mixer"){
    f.appendChild(el("circle",{cx:x,cy:y,r:20,fill:"#fff",stroke:"#000","stroke-width":"2.1"}));
    f.appendChild(lineEl({x1:x-14,y1:y-14,x2:x+14,y2:y+14}));
    f.appendChild(lineEl({x1:x-14,y1:y+14,x2:x+14,y2:y-14}));
  }else if(it.type==="sum"){
    f.appendChild(el("circle",{cx:x,cy:y,r:12,fill:"#fff",stroke:"#000","stroke-width":"2.1"}));
    f.appendChild(lineEl({x1:x-7,y1:y,x2:x+7,y2:y}));
    f.appendChild(lineEl({x1:x,y1:y-7,x2:x,y2:y+7}));
  }else if(it.type==="slpf"){
    f.appendChild(el("rect",{x:x-30,y:y-18,width:60,height:36,fill:"#fff",stroke:"#000","stroke-width":"2.1"}));
    f.appendChild(mkSine(x-12,y-9,24,3.5));
    f.appendChild(lineEl({x1:x-3,y1:y-5.5,x2:x+3,y2:y-12.5,"stroke-width":"1.7"}));
    f.appendChild(mkSine(x-12,y,24,3.5));
    f.appendChild(lineEl({x1:x-3,y1:y+3.5,x2:x+3,y2:y-3.5,"stroke-width":"1.7"}));
    f.appendChild(mkSine(x-12,y+9,24,3.5));
  }else if(it.type==="sdac"){
    f.appendChild(el("polygon",{points:`${x-30},${y-17} ${x+14},${y-17} ${x+30},${y} ${x+14},${y+17} ${x-30},${y+17}`,
      fill:"#fff",stroke:"#000","stroke-width":"2.1"}));
    f.appendChild(el("text",{x:x-6,y:y+4,"font-size":"13","font-family":"Helvetica,Arial,sans-serif",
      "text-anchor":"middle",fill:"#111"},"DAC"));
  }else if(it.type==="sadc"){
    f.appendChild(el("polygon",{points:`${x-30},${y} ${x-14},${y-17} ${x+30},${y-17} ${x+30},${y+17} ${x-14},${y+17}`,
      fill:"#fff",stroke:"#000","stroke-width":"2.1"}));
    f.appendChild(el("text",{x:x+6,y:y+4,"font-size":"13","font-family":"Helvetica,Arial,sans-serif",
      "text-anchor":"middle",fill:"#111"},"ADC"));
  }else if(it.type==="div2"){
    f.appendChild(el("rect",{x:x-22,y:y-14,width:44,height:28,fill:"#fff",stroke:"#000","stroke-width":"2.1"}));
    f.appendChild(el("text",{x:x,y:y+4,"font-size":"14.3","font-family":"Helvetica,Arial,sans-serif",
      "text-anchor":"middle",fill:"#111"},"÷2"));
  }else if(it.type==="ind"){
    const r=20/3;
    f.appendChild(lineEl({x1:x-26,y1:y,x2:x-20,y2:y,"stroke-width":"2"}));
    f.appendChild(el("path",{d:`M ${x-20} ${y} a ${r} ${r} 0 0 1 ${2*r} 0 a ${r} ${r} 0 0 1 ${2*r} 0 a ${r} ${r} 0 0 1 ${2*r} 0`,
      fill:"none",stroke:"#000","stroke-width":"2"}));
    f.appendChild(lineEl({x1:x+20,y1:y,x2:x+26,y2:y,"stroke-width":"2"}));
  }else if(it.type==="cap"){
    f.appendChild(lineEl({x1:x-14,y1:y,x2:x-3,y2:y,"stroke-width":"2"}));
    f.appendChild(lineEl({x1:x-3,y1:y-9,x2:x-3,y2:y+9,"stroke-width":"2"}));
    f.appendChild(lineEl({x1:x+3,y1:y-9,x2:x+3,y2:y+9,"stroke-width":"2"}));
    f.appendChild(lineEl({x1:x+3,y1:y,x2:x+14,y2:y,"stroke-width":"2"}));
  }else if(it.type==="res"){
    f.appendChild(el("polyline",{points:`${x-20},${y} ${x-15},${y} ${x-12},${y-7} ${x-6},${y+7} ${x},${y-7} ${x+6},${y+7} ${x+12},${y-7} ${x+15},${y} ${x+20},${y}`,
      fill:"none",stroke:"#000","stroke-width":"2"}));
  }else if(it.type==="ant"){
    f.appendChild(el("polygon",{points:`${x-9},${y-14} ${x+9},${y-14} ${x},${y-4}`,
      fill:"#fff",stroke:"#000","stroke-width":"2"}));
    f.appendChild(lineEl({x1:x,y1:y-4,x2:x,y2:y+12,"stroke-width":"2"}));
  }else if(it.type==="osc"){
    f.appendChild(el("circle",{cx:x,cy:y,r:14,fill:"#fff",stroke:"#000","stroke-width":"2.1"}));
    f.appendChild(mkSine(x-8,y,16,4));
  }else if(it.type==="padp"){
    f.appendChild(el("rect",{x:x-8,y:y-8,width:16,height:16,fill:"#fff",stroke:"#000","stroke-width":"2.2"}));
    f.appendChild(lineEl({x1:x-8,y1:y-8,x2:x+8,y2:y+8,"stroke-width":"1.5"}));
  }else if(it.type==="gnd"){
    [[9,0],[6,4],[3,8]].forEach(b=>f.appendChild(lineEl({x1:x-b[0],y1:y+b[1],x2:x+b[0],y2:y+b[1]})));
  }else if(it.type==="dot"){
    f.appendChild(el("circle",{cx:x,cy:y,r:3,fill:"#000"}));
  }else if(it.type==="slash"){
    f.appendChild(lineEl({x1:x-4,y1:y+5,x2:x+4,y2:y-5,"stroke-width":"1.7"}));
  }else if(it.type==="raw"){
    const t=document.createElementNS(NS,"g");
    t.innerHTML=it.svg;
    while(t.firstChild)f.appendChild(t.firstChild);
  }
  if(it.rot){
    const ax=it.type==="box"?it.x+it.w/2:(it.x!==undefined?it.x:0);
    const ay=it.type==="box"?it.y+it.h/2:(it.y!==undefined?it.y:0);
    const g=el("g",{transform:`rotate(${it.rot} ${ax} ${ay})`});
    g.appendChild(f);
    const f2=document.createDocumentFragment(); f2.appendChild(g);
    return f2;
  }
  return f;
}
function apply(g){
  const o=off[g.dataset.id];
  if(o==="del"){g.style.display="none";return;}
  g.style.display="";
  if(o&&(o[0]||o[1]))g.setAttribute("transform",`translate(${o[0]},${o[1]})`);
  else g.removeAttribute("transform");
}
function anchorRoute(ga,gb,dir){
  const A=bbOf(ga), B=bbOf(gb);
  const ac=[A.x+A.w/2,A.y+A.h/2], bc=[B.x+B.w/2,B.y+B.h/2];
  const dx=bc[0]-ac[0], dy=bc[1]-ac[1];
  if(dir==="vh"){
    const sy=dy>=0?A.y+A.h:A.y;
    const ex=ac[0]<bc[0]?B.x:B.x+B.w;
    return [[ac[0],sy],[ac[0],bc[1]],[ex,bc[1]]];
  }
  if(dir==="hv"){
    const sx=dx>=0?A.x+A.w:A.x;
    const ey=ac[1]<bc[1]?B.y:B.y+B.h;
    return [[sx,ac[1]],[bc[0],ac[1]],[bc[0],ey]];
  }
  const horiz=dir==="h"||(dir!=="v"&&dir!=="vz"&&Math.abs(dx)>=Math.abs(dy));
  if(horiz){
    const sx=dx>=0?A.x+A.w:A.x, ex=dx>=0?B.x:B.x+B.w;
    if(Math.abs(ac[1]-bc[1])<6)return [[sx,ac[1]],[ex,ac[1]]];
    if(ac[1]>=B.y+2&&ac[1]<=B.y+B.h-2)return [[sx,ac[1]],[ex,ac[1]]];
    if(bc[1]>=A.y+2&&bc[1]<=A.y+A.h-2)return [[sx,bc[1]],[ex,bc[1]]];
    const mx=(sx+ex)/2;
    return [[sx,ac[1]],[mx,ac[1]],[mx,bc[1]],[ex,bc[1]]];
  }
  const sy=dy>=0?A.y+A.h:A.y, ey=dy>=0?B.y:B.y+B.h;
  if(Math.abs(ac[0]-bc[0])<6)return [[ac[0],sy],[ac[0],ey]];
  if(dir!=="vz"){
    if(ac[0]>=B.x+2&&ac[0]<=B.x+B.w-2)return [[ac[0],sy],[ac[0],ey]];
    if(bc[0]>=A.x+2&&bc[0]<=A.x+A.w-2)return [[bc[0],sy],[bc[0],ey]];
  }
  const my=(sy+ey)/2;
  return [[ac[0],sy],[ac[0],my],[bc[0],my],[bc[0],ey]];
}
function headBase(pts){
  const n=pts.length,[x1,y1]=pts[n-2],[x2,y2]=pts[n-1];
  const dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1;
  if(L<=8)return pts;
  const c=pts.slice(0,-1);
  c.push([x2-6.5*dx/L,y2-6.5*dy/L]);
  return c;
}
function renderConn(it){
  const ga=nodeOf(it.a), gb=nodeOf(it.b);
  let g=nodeOf(it.id);
  if(!ga||!gb||ga.style.display==="none"||gb.style.display==="none"){if(g)g.remove();return;}
  if(it.dir){
    it.pts=anchorRoute(ga,gb,it.dir);
  }else{
    const P=nearestPair(termsOf(ga),termsOf(gb));
    it.pts=routeTerm(P.a,P.b);
  }
  if(it.ext){
    const n=it.pts.length,[x1,y1]=it.pts[n-2],[x2,y2]=it.pts[n-1];
    const dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1;
    it.pts=it.pts.slice(0,-1);
    it.pts.push([x2+it.ext*dx/L,y2+it.ext*dy/L]);
  }
  if(!g){g=el("g",{"class":"mv","data-id":it.id});svg.insertBefore(g,hlay);}
  g.innerHTML="";
  const dash=it.dash?{"stroke-dasharray":"5 3.5"}:{};
  g.appendChild(el("polyline",Object.assign({points:(it.arrow?headBase(it.pts):it.pts).map(p=>p.join(",")).join(" "),
    fill:"none",stroke:"#000","stroke-width":"2"},dash)));
  if(it.arrow)g.appendChild(arrowHead(it.pts[it.pts.length-2],it.pts[it.pts.length-1]));
  if(it.slash){
    const pts=it.pts;
    const a=pts.length===4?pts[1]:pts[0], b=pts.length===4?pts[2]:pts[1]||pts[pts.length-1];
    const mx=(a[0]+b[0])/2, my=(a[1]+b[1])/2;
    g.appendChild(el("line",{x1:mx-4,y1:my+5,x2:mx+4,y2:my-5,stroke:"#000","stroke-width":"1.7"}));
    g.appendChild(el("text",{x:mx+9,y:my-7,"font-size":"11.7",
      "font-family":"Helvetica,Arial,sans-serif","text-anchor":"middle",fill:"#111"},it.slash));
  }
}
const genConns=[...svg.querySelectorAll("g.mv[data-a]")].map(g=>({
  id:g.dataset.id,type:"conn",a:g.dataset.a,b:g.dataset.b,
  arrow:g.dataset.arrow==="1",dash:g.dataset.dash==="1",
  slash:g.dataset.slash||null,dir:g.dataset.dir||null,
  ext:parseFloat(g.dataset.ext)||0}));
function allConns(){return add.filter(a=>a.type==="conn").concat(genConns);}
function updateConns(id){
  allConns().forEach(a=>{if(a.a===id||a.b===id)renderConn(a);});
}
function mkNode(it){
  if(it.type==="conn"){renderConn(it);return nodeOf(it.id);}
  const g=el("g",{"class":"mv","data-id":it.id});
  g.appendChild(shapeFor(it));
  svg.insertBefore(g,hlay);
  apply(g);
  return g;
}
[...svg.querySelectorAll("g.mv")].forEach(apply);
add.forEach(mkNode);
genConns.forEach(renderConn);
applyChip();
fitZoom();
const uid=()=>{let m=0;add.forEach(a=>{const n=parseInt((a.id||"").slice(1),10)||0;if(n>m)m=n;});return "u"+(m+1);};
const snap=v=>snapOn?Math.round(v/5)*5:Math.round(v*2)/2;
const pos=e=>{const pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;
  const p=pt.matrixTransform(svg.getScreenCTM().inverse());
  return [snap(p.x),snap(p.y)];};
/* ---------- undo / redo ---------- */
function snapshot(){
  undoStk.push(JSON.stringify({off:off,add:add,chip:chipOn}));
  if(undoStk.length>100)undoStk.shift();
  redoStk=[];
}
function restore(js){
  const st=JSON.parse(js);
  add.forEach(a=>{const g=nodeOf(a.id);if(g)g.remove();});
  off=st.off; add=st.add;
  chipOn=st.chip!==false; applyChip();
  const cbb=document.getElementById("chipb"); if(cbb)cbb.classList.toggle("on",chipOn);
  add.forEach(mkNode);
  [...svg.querySelectorAll("g.mv")].forEach(apply);
  genConns.forEach(renderConn);
  add.filter(a=>a.type==="conn").forEach(renderConn);
  clearSel(); save(); refreshHandles();
}
function undo(){if(!undoStk.length)return;
  redoStk.push(JSON.stringify({off:off,add:add,chip:chipOn}));
  restore(undoStk.pop());}
function redo(){if(!redoStk.length)return;
  undoStk.push(JSON.stringify({off:off,add:add,chip:chipOn}));
  restore(redoStk.pop());}
/* ---------- selection ---------- */
function nodeOf(id){return svg.querySelector(`g.mv[data-id="${id}"]`);}
function itemOf(g){return add.find(a=>a.id===g.dataset.id)||genConns.find(a=>a.id===g.dataset.id);}
function stampTerms(it){
  const t=it.type, x=it.x, y=it.y, H="h", V="v";
  let L=null;
  if(t==="amp"||t==="vga")L=[[-15,0,H],[15,0,H]];
  else if(t==="camp"){const W=34+16*((it.n||2)-1);L=[[-W/2,0,H],[W/2,0,H]];}
  else if(t==="mixer")L=[[-20,0,H],[20,0,H],[0,-20,V],[0,20,V]];
  else if(t==="sum")L=[[-12,0,H],[12,0,H],[0,-12,V],[0,12,V]];
  else if(t==="slpf"||t==="sdac"||t==="sadc")L=[[-30,0,H],[30,0,H]];
  else if(t==="div2")L=[[-22,0,H],[22,0,H],[0,-14,V],[0,14,V]];
  else if(t==="ind")L=[[-26,0,H],[26,0,H]];
  else if(t==="cap")L=[[-14,0,H],[14,0,H]];
  else if(t==="res")L=[[-20,0,H],[20,0,H]];
  else if(t==="osc")L=[[-14,0,H],[14,0,H]];
  else if(t==="ant")L=[[0,12,V]];
  else if(t==="gnd")L=[[0,0,V]];
  else if(t==="dot")L=[[0,0,null]];
  else if(t==="padp")L=[[-8,0,H],[8,0,H],[0,-8,V],[0,8,V]];
  else return null;
  const r=(((it.rot||0)%360)+360)%360;
  return L.map(p=>{
    let px=p[0],py=p[1],d=p[2];
    for(let i=0;i<r/90;i++){const nx=-py,ny=px;px=nx;py=ny;d=d==="h"?"v":(d==="v"?"h":d);}
    return [x+px,y+py,d];
  });
}
function termsOf(g){
  const it=itemOf(g);
  if(it){
    const ts=stampTerms(it);
    if(ts){
      const o=(off[g.dataset.id]!=="del"&&off[g.dataset.id])||[0,0];
      return ts.map(t=>[t[0]+o[0],t[1]+o[1],t[2]]);
    }
  }
  const b=bbOf(g);
  return [[b.x,b.y+b.h/2,"h"],[b.x+b.w,b.y+b.h/2,"h"],
          [b.x+b.w/2,b.y,"v"],[b.x+b.w/2,b.y+b.h,"v"]];
}
function nearestPair(ta,tb){
  let best=null;
  ta.forEach(a=>tb.forEach(b=>{
    const d=Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]);
    if(!best||d<best.d)best={d:d,a:a,b:b};
  }));
  return best;
}
function routeTerm(a,b){
  if(a[0]===b[0]||a[1]===b[1])return [[a[0],a[1]],[b[0],b[1]]];
  const da=a[2]||b[2]||"h", db=b[2]||a[2]||"h";
  if(da==="h"&&db==="h"){const mx=(a[0]+b[0])/2;
    return [[a[0],a[1]],[mx,a[1]],[mx,b[1]],[b[0],b[1]]];}
  if(da==="v"&&db==="v"){const my=(a[1]+b[1])/2;
    return [[a[0],a[1]],[a[0],my],[b[0],my],[b[0],b[1]]];}
  if(da==="h")return [[a[0],a[1]],[b[0],a[1]],[b[0],b[1]]];
  return [[a[0],a[1]],[a[0],b[1]],[b[0],b[1]]];
}
function showTerms(g,color){
  termsOf(g).forEach(t=>hlay.appendChild(el("circle",{cx:t[0],cy:t[1],r:3.5,
    fill:color||"#1a73e8",stroke:"#fff","stroke-width":"1","pointer-events":"none"})));
}
function clearSel(){selSet.forEach(g=>g.style.filter="");selSet.clear();refreshHandles();}
function addSel(g){selSet.add(g);g.style.filter="drop-shadow(0 0 3px #1a73e8)";refreshHandles();}
function setSel(g){clearSel();if(g)addSel(g);}
const single=()=>selSet.size===1?[...selSet][0]:null;
/* itemOf is defined as a hoisted function above (needed during startup render) */
/* ---------- resize / endpoint handles ---------- */
let hdrag=null;
function refreshHandles(){
  hlay.innerHTML="";
  const g=single(); if(!g||!edit)return;
  const it=itemOf(g); if(!it)return;
  const o=(off[it.id]!=="del"&&off[it.id])||[0,0];
  const mk=(hx,hy,tag)=>{
    const h=el("rect",{x:hx+o[0]-3.5,y:hy+o[1]-3.5,width:7,height:7,fill:"#1a73e8",
      stroke:"#fff","stroke-width":"1","data-h":tag,style:"cursor:nwse-resize"});
    h.addEventListener("pointerdown",e=>{
      e.stopPropagation();e.preventDefault();
      snapshot();
      hdrag={it:it,tag:tag};
      svg.setPointerCapture(e.pointerId);
    });
    hlay.appendChild(h);
  };
  if((it.type==="line"||it.type==="arrow")&&!it.rot){
    it.pts.forEach((p,i)=>mk(p[0],p[1],"p"+i));
  }else if(it.type==="box"&&!it.rot){
    mk(it.x+it.w,it.y+it.h,"se");
  }
}
function rebuild(it){
  const g=nodeOf(it.id); const wasSel=g&&selSet.has(g);
  if(g)g.remove();
  const n=mkNode(it);
  if(wasSel){selSet.delete(g);addSel(n);}
}
/* ---------- pointer interactions ---------- */
const STAMPS=["amp","vga","mixer","sum","slpf","sdac","div2","ind","cap","res","ant","osc","padp","gnd","dot","slash"];
let drag=null, draw=null, tmp=null, marq=null, cdraw=null, arwOn=false;
function endPt(e,p){
  if(draw&&e.shiftKey&&draw.t!=="box")
    return Math.abs(p[0]-draw.x0)>=Math.abs(p[1]-draw.y0)?[p[0],draw.y0]:[draw.x0,p[1]];
  return p;
}
svg.addEventListener("pointerdown",e=>{
  if(!edit)return;
  const p=pos(e);
  if(tool==="sel"){
    const g=e.target.closest("g.mv");
    if(g){
      if(e.shiftKey){if(selSet.has(g)){selSet.delete(g);g.style.filter="";refreshHandles();}else addSel(g);}
      else if(!selSet.has(g))setSel(g);
      const gi=itemOf(g);
      if(gi&&gi.type==="conn"){e.preventDefault();return;}
      snapshot();
      drag={sx:p[0],sy:p[1],starts:[...selSet].map(s=>{
        const o=(off[s.dataset.id]!=="del"&&off[s.dataset.id])||[0,0];
        return {g:s,ox:o[0],oy:o[1]};})};
      svg.setPointerCapture(e.pointerId);e.preventDefault();
    }else{
      marq={x0:e.clientX,y0:e.clientY,box:document.createElement("div")};
      marq.box.style.cssText="position:fixed;border:1px dashed #1a73e8;background:rgba(26,115,232,.06);z-index:9;pointer-events:none";
      document.body.appendChild(marq.box);
      if(!e.shiftKey)clearSel();
      e.preventDefault();
    }
  }else if(tool==="line"||tool==="arrow"||tool==="box"){
    draw={t:tool,x0:p[0],y0:p[1]};
    svg.setPointerCapture(e.pointerId);e.preventDefault();
  }else if(tool==="conn"){
    const g=e.target.closest("g.mv"); if(!g)return;
    const gi=itemOf(g);
    if(gi&&gi.type==="conn")return;
    cdraw={a:g.dataset.id};
    svg.setPointerCapture(e.pointerId); e.preventDefault();
  }else if(tool==="text"){
    textAt(e,p);e.preventDefault();
  }else if(tool==="stamp"){
    snapshot();
    const it=stamp.slice(0,4)==="camp"
      ?{id:uid(),type:"camp",n:parseInt(stamp.slice(4),10)||2,x:p[0],y:p[1]}
      :{id:uid(),type:stamp,x:p[0],y:p[1]};
    add.push(it);setSel(mkNode(it));save();
    e.preventDefault();
  }
});
svg.addEventListener("pointermove",e=>{
  if(hdrag){
    const p=pos(e), it=hdrag.it;
    const o=(off[it.id]!=="del"&&off[it.id])||[0,0];
    if(hdrag.tag==="se"){
      it.w=Math.max(5,p[0]-o[0]-it.x); it.h=Math.max(5,p[1]-o[1]-it.y);
    }else{
      const i=parseInt(hdrag.tag.slice(1),10);
      it.pts[i]=[p[0]-o[0],p[1]-o[1]];
    }
    rebuild(it);refreshHandles();
    return;
  }
  if(drag){
    const p=pos(e);
    drag.starts.forEach(s=>{
      off[s.g.dataset.id]=[snap(s.ox+p[0]-drag.sx),snap(s.oy+p[1]-drag.sy)];
      apply(s.g);
      updateConns(s.g.dataset.id);});
    refreshHandles();
  }else if(cdraw){
    const ga=nodeOf(cdraw.a); if(!ga)return;
    const p=pos(e);
    if(tmp)tmp.remove();
    hlay.innerHTML="";
    showTerms(ga);
    const elu=document.elementFromPoint(e.clientX,e.clientY);
    const gb=elu&&elu.closest?elu.closest("g.mv"):null;
    let pv;
    if(gb&&gb!==ga&&gb.dataset.id!==cdraw.a&&(itemOf(gb)||{}).type!=="conn"){
      showTerms(gb,"#2a7");
      const P=nearestPair(termsOf(ga),termsOf(gb));
      pv=routeTerm(P.a,P.b);
    }else{
      const P=nearestPair(termsOf(ga),[[p[0],p[1],null]]);
      pv=[[P.a[0],P.a[1]],[p[0],p[1]]];
    }
    tmp=el("g",{opacity:"0.55","pointer-events":"none"});
    tmp.appendChild(el("polyline",{points:pv.map(q=>q.join(",")).join(" "),
      fill:"none",stroke:"#1a73e8","stroke-width":"2","stroke-dasharray":"4 3"}));
    svg.insertBefore(tmp,hlay);
  }else if(draw){
    const p=endPt(e,pos(e));
    if(tmp)tmp.remove();
    const it=draw.t==="box"
      ?{type:"box",x:Math.min(draw.x0,p[0]),y:Math.min(draw.y0,p[1]),
        w:Math.abs(p[0]-draw.x0),h:Math.abs(p[1]-draw.y0),dash:dashOn}
      :{type:draw.t,pts:[[draw.x0,draw.y0],[p[0],p[1]]],dash:dashOn};
    tmp=el("g",{opacity:"0.6"});tmp.appendChild(shapeFor(it));svg.insertBefore(tmp,hlay);
  }else if(marq){
    const x=Math.min(marq.x0,e.clientX),y=Math.min(marq.y0,e.clientY);
    marq.box.style.left=x+"px";marq.box.style.top=y+"px";
    marq.box.style.width=Math.abs(e.clientX-marq.x0)+"px";
    marq.box.style.height=Math.abs(e.clientY-marq.y0)+"px";
  }
});
svg.addEventListener("pointerup",e=>{
  if(hdrag){save();hdrag=null;return;}
  if(drag){save();drag=null;return;}
  if(cdraw){
    if(tmp){tmp.remove();tmp=null;}
    const elu=document.elementFromPoint(e.clientX,e.clientY);
    const gb=elu&&elu.closest?elu.closest("g.mv"):null;
    if(gb&&gb.dataset.id!==cdraw.a){
      const gi=itemOf(gb);
      if(!(gi&&gi.type==="conn")){
        snapshot();
        const it={id:uid(),type:"conn",a:cdraw.a,b:gb.dataset.id,arrow:arwOn,dash:dashOn};
        add.push(it); renderConn(it); setSel(nodeOf(it.id)); save();
      }
    }
    cdraw=null; hlay.innerHTML=""; refreshHandles(); return;
  }
  if(draw){
    const p=endPt(e,pos(e));
    if(tmp){tmp.remove();tmp=null;}
    if(Math.abs(p[0]-draw.x0)>3||Math.abs(p[1]-draw.y0)>3){
      snapshot();
      const it=draw.t==="box"
        ?{id:uid(),type:"box",x:Math.min(draw.x0,p[0]),y:Math.min(draw.y0,p[1]),
          w:Math.abs(p[0]-draw.x0),h:Math.abs(p[1]-draw.y0),dash:dashOn}
        :{id:uid(),type:draw.t,pts:[[draw.x0,draw.y0],[p[0],p[1]]],dash:dashOn};
      add.push(it);setSel(mkNode(it));save();
    }
    draw=null;return;
  }
  if(marq){
    const r={l:Math.min(marq.x0,e.clientX),t:Math.min(marq.y0,e.clientY),
             r:Math.max(marq.x0,e.clientX),b:Math.max(marq.y0,e.clientY)};
    marq.box.remove();marq=null;
    if(r.r-r.l>4&&r.b-r.t>4){
      [...svg.querySelectorAll("g.mv")].forEach(g=>{
        if(g.style.display==="none")return;
        const bb=g.getBoundingClientRect();
        if(bb.left<r.r&&bb.right>r.l&&bb.top<r.b&&bb.bottom>r.t)addSel(g);
      });
    }
  }
});
svg.addEventListener("dblclick",e=>{
  if(!edit||tool!=="sel")return;
  const g=e.target.closest("g.mv");if(!g)return;
  const it=itemOf(g);
  if(it&&it.type==="text"){snapshot();textAt(e,[it.x,it.y],it);}
});
function textAt(e,p,existing){
  const fr=fig.getBoundingClientRect();
  const inp=document.createElement("input");
  inp.value=existing?existing.t:"";
  inp.style.cssText="position:absolute;left:"+(e.clientX-fr.left)+"px;top:"+(e.clientY-fr.top)+
    "px;font:12px Helvetica,Arial,sans-serif;z-index:5;border:1px solid #1a73e8;padding:1px 4px;width:170px";
  fig.appendChild(inp);inp.focus();
  let done=false;
  const fin=commit=>{
    if(done)return;done=true;
    const v=inp.value.trim();inp.remove();
    if(!commit)return;
    if(existing){
      if(v){existing.t=v;rebuild(existing);}save();
    }else if(v){
      snapshot();
      const it={id:uid(),type:"text",x:p[0],y:p[1],t:v,gray:grayOn,fs:tsz};
      add.push(it);setSel(mkNode(it));save();
    }
  };
  inp.addEventListener("keydown",ev=>{ev.stopPropagation();
    if(ev.key==="Enter")fin(true);if(ev.key==="Escape")fin(false);});
  inp.addEventListener("blur",()=>fin(true));
}
/* ---------- ops on selection ---------- */
function delSel(){
  if(!selSet.size)return;
  snapshot();
  const dead=[...selSet].map(g=>g.dataset.id);
  selSet.forEach(g=>{
    const id=g.dataset.id;
    if(id[0]==="u"&&add.some(a=>a.id===id)){
      add=add.filter(a=>a.id!==id);delete off[id];g.remove();
    }else{off[id]="del";apply(g);}
  });
  const drop=add.filter(a=>a.type==="conn"&&(dead.includes(a.a)||dead.includes(a.b)));
  drop.forEach(a=>{const g=nodeOf(a.id);if(g)g.remove();delete off[a.id];});
  add=add.filter(a=>!drop.includes(a));
  genConns.forEach(gc=>{
    if(dead.includes(gc.a)||dead.includes(gc.b)){
      off[gc.id]="del";const g=nodeOf(gc.id);if(g)apply(g);
    }});
  selSet.clear();save();refreshHandles();
}
function dupSel(){
  if(!selSet.size)return;
  snapshot();
  const created=[];
  selSet.forEach(g=>{
    const id=g.dataset.id;
    const src=add.find(a=>a.id===id);
    if(src&&src.type==="conn")return;
    const it=src?JSON.parse(JSON.stringify(src)):{type:"raw",svg:g.innerHTML};
    it.id=uid();add.push(it);
    const n=mkNode(it);
    const o=(off[id]&&off[id]!=="del")?off[id]:[0,0];
    off[it.id]=[o[0]+12,o[1]+12];apply(n);created.push(n);
  });
  clearSel();created.forEach(addSel);save();
}
function copySel(){
  if(!selSet.size)return;
  clip=[...selSet].map(g=>{
    const src=add.find(a=>a.id===g.dataset.id);
    const o=(off[g.dataset.id]&&off[g.dataset.id]!=="del")?off[g.dataset.id]:[0,0];
    return {it:src?JSON.parse(JSON.stringify(src)):{type:"raw",svg:g.innerHTML},o:[o[0],o[1]]};
  }).filter(c=>!(c.it&&c.it.type==="conn"));
}
function pasteClip(){
  if(!clip||!clip.length)return;
  snapshot();
  const created=[];
  clip.forEach(c=>{
    const it=JSON.parse(JSON.stringify(c.it));it.id=uid();add.push(it);
    const n=mkNode(it);off[it.id]=[c.o[0]+12,c.o[1]+12];apply(n);created.push(n);
  });
  clearSel();created.forEach(addSel);save();
}
function rotSel(){
  const g=single();if(!g)return;
  const it=itemOf(g);if(!it||it.type==="line"||it.type==="arrow")return;
  snapshot();
  it.rot=((it.rot||0)+90)%360;
  rebuild(it);save();refreshHandles();
}
function bbOf(g){
  const o=(off[g.dataset.id]!=="del"&&off[g.dataset.id])||[0,0];
  if(g.dataset&&g.dataset.abox){
    const p=g.dataset.abox.split(",").map(Number);
    return {g:g,x:p[0]+o[0],y:p[1]+o[1],w:p[2],h:p[3],o:o};
  }
  const b=g.getBBox();
  return {g:g,x:b.x+o[0],y:b.y+o[1],w:b.width,h:b.height,o:o};
}
function alignSel(mode){
  if(selSet.size<2)return;
  snapshot();
  const bs=[...selSet].filter(g=>!((itemOf(g)||{}).type==="conn")).map(bbOf);
  if(bs.length<2)return;
  const mv=(b,dx,dy)=>{off[b.g.dataset.id]=[b.o[0]+dx,b.o[1]+dy];apply(b.g);};
  if(mode==="left"){const t=Math.min(...bs.map(b=>b.x));bs.forEach(b=>mv(b,t-b.x,0));}
  if(mode==="right"){const t=Math.max(...bs.map(b=>b.x+b.w));bs.forEach(b=>mv(b,t-(b.x+b.w),0));}
  if(mode==="hcent"){const t=bs.reduce((s,b)=>s+b.x+b.w/2,0)/bs.length;bs.forEach(b=>mv(b,t-(b.x+b.w/2),0));}
  if(mode==="top"){const t=Math.min(...bs.map(b=>b.y));bs.forEach(b=>mv(b,0,t-b.y));}
  if(mode==="bot"){const t=Math.max(...bs.map(b=>b.y+b.h));bs.forEach(b=>mv(b,0,t-(b.y+b.h)));}
  if(mode==="vcent"){const t=bs.reduce((s,b)=>s+b.y+b.h/2,0)/bs.length;bs.forEach(b=>mv(b,0,t-(b.y+b.h/2)));}
  if(mode==="disth"&&bs.length>2){
    bs.sort((a,b)=>(a.x+a.w/2)-(b.x+b.w/2));
    const c0=bs[0].x+bs[0].w/2,c1=bs[bs.length-1].x+bs[bs.length-1].w/2;
    bs.forEach((b,i)=>{const t=c0+(c1-c0)*i/(bs.length-1);mv(b,t-(b.x+b.w/2),0);});
  }
  if(mode==="distv"&&bs.length>2){
    bs.sort((a,b)=>(a.y+a.h/2)-(b.y+b.h/2));
    const c0=bs[0].y+bs[0].h/2,c1=bs[bs.length-1].y+bs[bs.length-1].h/2;
    bs.forEach((b,i)=>{const t=c0+(c1-c0)*i/(bs.length-1);mv(b,0,t-(b.y+b.h/2));});
  }
  bs.forEach(b=>updateConns(b.g.dataset.id));
  save();refreshHandles();
}
function zOrder(front){
  if(!selSet.size)return;
  snapshot();
  selSet.forEach(g=>{
    if(front)svg.insertBefore(g,hlay);
    else svg.insertBefore(g,gridlay.nextSibling);
    const id=g.dataset.id, i=add.findIndex(a=>a.id===id);
    if(i>=0){const [a]=add.splice(i,1);front?add.push(a):add.unshift(a);}
  });
  save();
}
function styleSel(kind){
  const targets=[...selSet].map(g=>itemOf(g)).filter(Boolean);
  const applicable=targets.filter(it=>
    kind==="dash"?["line","arrow","box"].includes(it.type):it.type==="text");
  if(applicable.length){
    snapshot();
    applicable.forEach(it=>{if(kind==="dash")it.dash=!it.dash;else it.gray=!it.gray;rebuild(it);});
    save();return true;
  }
  return false;
}
/* ---------- keyboard ---------- */
document.addEventListener("keydown",e=>{
  if(!edit)return;
  const mod=e.metaKey||e.ctrlKey;
  if(mod&&e.key.toLowerCase()==="z"){e.preventDefault();e.shiftKey?redo():undo();return;}
  if(mod&&e.key.toLowerCase()==="y"){e.preventDefault();redo();return;}
  if(mod&&e.key.toLowerCase()==="d"){e.preventDefault();dupSel();return;}
  if(mod&&e.key.toLowerCase()==="c"){e.preventDefault();copySel();return;}
  if(mod&&e.key.toLowerCase()==="v"){e.preventDefault();pasteClip();return;}
  if(mod&&e.key.toLowerCase()==="a"){e.preventDefault();
    clearSel();[...svg.querySelectorAll("g.mv")].forEach(g=>{if(g.style.display!=="none")addSel(g);});return;}
  if(e.key==="Escape"){
    if(cdraw){if(tmp){tmp.remove();tmp=null;}cdraw=null;}
    clearSel();return;}
  if(e.key.toLowerCase()==="r"&&!mod){rotSel();return;}
  if(!selSet.size)return;
  if(e.key==="Delete"||e.key==="Backspace"){e.preventDefault();delSel();return;}
  const st=e.shiftKey?10:1;
  const map={ArrowLeft:[-st,0],ArrowRight:[st,0],ArrowUp:[0,-st],ArrowDown:[0,st]};
  const d=map[e.key];if(!d)return;
  e.preventDefault();snapshot();
  selSet.forEach(g=>{
    if((itemOf(g)||{}).type==="conn")return;
    const id=g.dataset.id,o=(off[id]==="del"?[0,0]:off[id])||[0,0];
    off[id]=[o[0]+d[0],o[1]+d[1]];apply(g);
    updateConns(id);});
  save();refreshHandles();
});
/* ---------- toolbar wiring ---------- */
const $=id=>document.getElementById(id);
function setTool(t){
  tool=t;
  document.querySelectorAll(".tl").forEach(b=>b.classList.toggle("on",b.dataset.tool===t));
  fig.className="fig"+(edit?" editing tool-"+t:"");
  refreshHandles();
}
document.querySelectorAll(".tl").forEach(b=>b.addEventListener("click",()=>setTool(b.dataset.tool)));
$("stampsel").addEventListener("change",function(){stamp=this.value;setTool("stamp");});
$("ed").addEventListener("click",function(){
  edit=!edit;
  this.classList.toggle("on",edit);
  this.textContent=edit?"Editing…":"Edit layout";
  $("tools").style.display=edit?"flex":"none";
  $("hint").style.display=edit?"block":"none";
  if(!edit)clearSel();
  setTool(edit?tool:"sel");
});
$("svbtn").addEventListener("click",()=>{
  if(storageOK)save();
  else{copyOr(JSON.stringify({off:off,add:add}));
    svEl.className="warn";svEl.textContent="storage blocked — JSON copied; keep it safe";}
});
$("undo").addEventListener("click",undo);
$("redo").addEventListener("click",redo);
$("dup").addEventListener("click",dupSel);
$("zf").addEventListener("click",()=>zOrder(true));
$("zb").addEventListener("click",()=>zOrder(false));
$("rot").addEventListener("click",rotSel);
$("alignsel").addEventListener("change",function(){
  if(this.value){alignSel(this.value);this.value="";}});
$("snap").addEventListener("click",function(){snapOn=!snapOn;this.classList.toggle("on",snapOn);});
$("carw").addEventListener("click",function(){
  arwOn=!arwOn; this.classList.toggle("on",arwOn);});
$("dsh").addEventListener("click",function(){
  if(!styleSel("dash")){dashOn=!dashOn;this.classList.toggle("on",dashOn);}});
$("gry").addEventListener("click",function(){
  if(!styleSel("gray")){grayOn=!grayOn;this.classList.toggle("on",grayOn);}});
$("grid").addEventListener("click",function(){
  gridOn=!gridOn;this.classList.toggle("on",gridOn);
  gridlay.style.display=gridOn?"":"none";});
$("chipb").addEventListener("click",function(){
  snapshot();
  chipOn=!chipOn;this.classList.toggle("on",chipOn);
  applyChip();save();});
$("chipb").classList.toggle("on",chipOn);
$("tsz").addEventListener("change",function(){
  tsz=parseFloat(this.value);
  const texts=[...selSet].map(g=>itemOf(g)).filter(it=>it&&it.type==="text");
  if(texts.length){snapshot();texts.forEach(it=>{it.fs=tsz;rebuild(it);});save();}
});
function vbDims(){
  const vb=svg.viewBox&&svg.viewBox.baseVal;
  return {w:(vb&&vb.width)||1100,h:(vb&&vb.height)||650};
}
function setZoom(z){
  zoom=Math.min(3,Math.max(0.25,z));
  svg.style.width=(vbDims().w*zoom)+"px";
  svg.style.minWidth="0";
  const zr=$("zr");if(zr)zr.textContent=Math.round(zoom*100)+"%";
}
let userZoom=false;
function fitZoom(){
  // size the canvas so the whole figure fits the viewport with no inner scrollbars
  try{
    if(!fig||!fig.clientWidth||!fig.getBoundingClientRect)return;
    const d=vbDims();
    const availW=fig.clientWidth-22;
    if(availW<=0)return;
    const availH=Math.max(280,(window.innerHeight||800)-fig.getBoundingClientRect().top-36);
    const w=Math.max(320,Math.min(availW,availH*d.w/d.h));
    setZoom(w/d.w);
  }catch(e){}
}
$("zi").addEventListener("click",()=>{userZoom=true;setZoom(zoom*1.25);});
$("zo").addEventListener("click",()=>{userZoom=true;setZoom(zoom/1.25);});
$("zr").addEventListener("click",()=>{userZoom=true;setZoom(1);});
if(typeof window!=="undefined"&&window.addEventListener)
  window.addEventListener("resize",()=>{if(!userZoom)fitZoom();});
$("rs").addEventListener("click",()=>{
  snapshot();
  off={};add.forEach(a=>{const g=nodeOf(a.id);if(g)g.remove();});
  add=[];chipOn=true;applyChip();
  $("chipb").classList.toggle("on",true);
  save();
  [...svg.querySelectorAll("g.mv")].forEach(apply);
  genConns.forEach(renderConn);
  clearSel();
});
/* ---------- export / import ---------- */
const flash=m=>{const c=$("copied");c.textContent=m||"copied ✓";
  c.style.display="inline";setTimeout(()=>c.style.display="none",2500);};
function copyOr(text){
  const show=()=>{const pn=$("srcp");pn.style.display="block";$("japply").style.display="none";
    const t=$("srct");t.readOnly=true;t.value=text;t.focus();t.select();};
  if(navigator.clipboard&&navigator.clipboard.writeText)
    navigator.clipboard.writeText(text).then(()=>flash()).catch(show);
  else show();
}
function liveSVG(){
  const c=svg.cloneNode(true);
  c.removeAttribute("id");c.removeAttribute("style");
  const gl=c.querySelector("#gridlay");if(gl)gl.remove();
  const hl=c.querySelector("#hlay");if(hl)hl.remove();
  c.querySelectorAll("[style]").forEach(n=>{n.style.filter="";if(!n.getAttribute("style"))n.removeAttribute("style");});
  return '<?xml version="1.0" encoding="UTF-8"?>\n'+c.outerHTML;
}
$("cp").addEventListener("click",()=>copyOr(liveSVG()));
$("cj").addEventListener("click",()=>copyOr(JSON.stringify({off:off,add:add,chip:chipOn})));
$("lj").addEventListener("click",()=>{
  const pn=$("srcp");pn.style.display="block";
  const t=$("srct");t.readOnly=false;t.value="";
  t.placeholder='paste layout JSON {"off":{...},"add":[...]} then press Apply';
  $("japply").style.display="inline-block";t.focus();
});
$("japply").addEventListener("click",()=>{
  try{
    const st=JSON.parse($("srct").value);
    snapshot();
    restore(JSON.stringify({off:st.off||{},add:st.add||[]}));
    $("srcp").style.display="none";flash("layout loaded ✓");
  }catch(e){flash("invalid JSON");}
});
$("dl").addEventListener("click",function(){
  this.href="data:image/svg+xml;base64,"+btoa(unescape(encodeURIComponent(liveSVG())));
});
$("png").addEventListener("click",()=>{
  const img=new Image();
  img.onload=()=>{
    const c=document.createElement("canvas");
    c.width=4400;c.height=2560;   /* ~615 dpi at IEEE double-column width (7.16 in) */
    const g=c.getContext("2d");
    g.fillStyle="#fff";g.fillRect(0,0,c.width,c.height);
    g.drawImage(img,0,0,c.width,c.height);
    let url;try{url=c.toDataURL("image/png");}catch(e){return;}
    const pn=$("pngp");
    pn.style.display="block";
    pn.innerHTML='PNG (4400×2560, ≈615 dpi at IEEE double-column width). The viewer sandbox blocks automatic downloads — '+
      '<b>right-click the image → “Save Image As…”</b>, or ';
    const cb=document.createElement("button");
    cb.textContent="Copy PNG to clipboard";
    cb.style.cssText="font:12px Helvetica;padding:2px 8px";
    cb.addEventListener("click",()=>{
      c.toBlob(b=>{
        if(navigator.clipboard&&window.ClipboardItem)
          navigator.clipboard.write([new ClipboardItem({"image/png":b})])
            .then(()=>flash("PNG copied ✓")).catch(()=>flash("clipboard blocked"));
        else flash("clipboard unsupported");
      });
    });
    pn.appendChild(cb);
    const im=document.createElement("img");im.src=url;pn.appendChild(im);
    const a=document.createElement("a");
    a.href=url;a.download="chipscribe.png";
    document.body.appendChild(a);a.click();a.remove();
  };
  img.src="data:image/svg+xml;base64,"+btoa(unescape(encodeURIComponent(liveSVG())));
});
})();
