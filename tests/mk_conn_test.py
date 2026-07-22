#!/usr/bin/env python3
# Extract the verbatim anchorRoute from editor_app.js and emit a jsc test harness.
import pathlib, re
base = pathlib.Path(__file__).resolve().parent
js = (base.parent / "src" / "editor_app.js").read_text(encoding="utf-8")
m = re.search(r"function anchorRoute\(ga,gb,dir\)\{[\s\S]*?\n\}", js)
assert m, "anchorRoute not found"
m2 = re.search(r"function headBase\(pts\)\{[\s\S]*?\n\}", js)
assert m2, "headBase not found"
m3 = re.search(r"function stampTerms\(it\)\{[\s\S]*?\n\}", js)
assert m3, "stampTerms not found"
m4 = re.search(r"function nearestPair\(ta,tb\)\{[\s\S]*?\n\}", js)
assert m4, "nearestPair not found"
m5 = re.search(r"function routeTerm\(a,b\)\{[\s\S]*?\n\}", js)
assert m5, "routeTerm not found"
fn = "\n".join([m.group(0), m2.group(0), m3.group(0), m4.group(0), m5.group(0)])

harness = """// ChipFig connector-routing test harness (runs under jsc)
let BOXES={};
function bbOf(g){return BOXES[g];}
""" + fn + """
let fails=0, runs=0;
function eq(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function t(name,A,B,exp,dir){
  runs++; BOXES={A:A,B:B};
  const r=anchorRoute("A","B",dir);
  if(!eq(r,exp)){fails++;print("FAIL "+name+" got "+JSON.stringify(r)+" want "+JSON.stringify(exp));}
  else print("PASS "+name);
}
const box=(x,y,w,h)=>({x:x,y:y,w:w,h:h});
// 1. horizontal, centers aligned -> straight 2-pt wire between facing edges
t("h-aligned", box(0,0,40,20), box(100,0,40,20), [[40,10],[100,10]]);
// 2. horizontal, vertical offset -> 4-pt Z at midpoint
t("h-offset", box(0,0,40,20), box(100,60,40,20), [[40,10],[70,10],[70,70],[100,70]]);
// 3. leftward
t("h-left", box(0,0,40,20), box(-100,0,40,20), [[0,10],[-60,10]]);
// 4. vertical, centers aligned
t("v-aligned", box(0,0,40,20), box(0,100,40,20), [[20,20],[20,100]]);
// 5. vertical, horizontal offset (upward)
t("v-up-offset", box(0,0,40,20), box(80,-100,40,20), [[20,0],[20,-40],[100,-40],[100,-80]]);
// 6. tie |dx|==|dy| -> horizontal branch wins
t("tie", box(0,0,40,20), box(50,50,40,20), [[40,10],[45,10],[45,60],[50,60]]);
// 6b. within-extent rules: straight drop when source center is inside target span
t("v-within-src", box(0,0,40,20), box(-10,100,200,20), [[20,20],[20,100]]);
t("v-within-tgt", box(0,0,200,20), box(150,100,20,20), [[160,20],[160,100]]);
t("h-within-src", box(0,0,40,20), box(100,-30,40,100), [[40,10],[100,10]]);
// 6c. forced orientation
t("dir-v-forced", box(0,0,40,20), box(200,30,40,20), [[20,20],[20,25],[220,25],[220,30]], "v");
// 6d. L-shape modes: vertical-then-horizontal and horizontal-then-vertical
t("dir-vh", box(0,0,40,20), box(100,100,40,20), [[20,20],[20,110],[100,110]], "vh");
t("dir-vh-up-left", box(200,200,40,20), box(0,0,40,20), [[220,200],[220,10],[40,10]], "vh");
t("dir-hv", box(0,0,40,20), box(100,100,40,20), [[40,10],[120,10],[120,100]], "hv");
// 6e. arrowhead line-shortening: line stops 6.5 short of tip; short segs untouched
runs++;
{const r=headBase([[0,0],[10,0]]);
 if(eq(r,[[0,0],[3.5,0]]))print("PASS headBase shortens toward tip");
 else{fails++;print("FAIL headBase got "+JSON.stringify(r));}}
runs++;
{const r=headBase([[0,0],[5,0]]);
 if(eq(r,[[0,0],[5,0]]))print("PASS headBase leaves short segments");
 else{fails++;print("FAIL headBase short-seg got "+JSON.stringify(r));}}
runs++;
{const r=headBase([[0,0],[0,100],[100,100]]);
 if(eq(r,[[0,0],[0,100],[93.5,100]]))print("PASS headBase multi-segment");
 else{fails++;print("FAIL headBase multi got "+JSON.stringify(r));}}
// 6f. terminal model: stamp terminals, nearest-pair snap, terminal routing
runs++;
{const r=stampTerms({type:"ind",x:100,y:200});
 if(eq(r,[[74,200,"h"],[126,200,"h"]]))print("PASS ind terminals at lead tips");
 else{fails++;print("FAIL ind terminals got "+JSON.stringify(r));}}
runs++;
{const r=stampTerms({type:"ind",x:100,y:200,rot:90});
 if(eq(r,[[100,174,"v"],[100,226,"v"]]))print("PASS rotated ind terminals swap to vertical");
 else{fails++;print("FAIL rotated ind terminals got "+JSON.stringify(r));}}
runs++;
{const r=stampTerms({type:"cap",x:0,y:0});
 if(eq(r,[[-14,0,"h"],[14,0,"h"]]))print("PASS cap terminals at plate leads");
 else{fails++;print("FAIL cap terminals got "+JSON.stringify(r));}}
runs++;
{const P=nearestPair([[0,0,"h"],[30,0,"h"]],[[100,0,"h"],[200,0,"h"]]);
 if(eq([P.a,P.b],[[30,0,"h"],[100,0,"h"]]))print("PASS nearestPair picks facing terminals");
 else{fails++;print("FAIL nearestPair got "+JSON.stringify([P.a,P.b]));}}
runs++;
{const r=routeTerm([30,0,"h"],[100,0,"h"]);
 if(eq(r,[[30,0],[100,0]]))print("PASS routeTerm aligned straight");
 else{fails++;print("FAIL routeTerm straight got "+JSON.stringify(r));}}
runs++;
{const r=routeTerm([30,0,"h"],[100,50,"h"]);
 if(eq(r,[[30,0],[65,0],[65,50],[100,50]]))print("PASS routeTerm h-h Z");
 else{fails++;print("FAIL routeTerm h-h got "+JSON.stringify(r));}}
runs++;
{const r=routeTerm([30,0,"h"],[100,50,"v"]);
 if(eq(r,[[30,0],[100,0],[100,50]]))print("PASS routeTerm h-v L");
 else{fails++;print("FAIL routeTerm h-v got "+JSON.stringify(r));}}
runs++;
{const r=routeTerm([30,0,"v"],[100,50,"h"]);
 if(eq(r,[[30,0],[30,50],[100,50]]))print("PASS routeTerm v-h L");
 else{fails++;print("FAIL routeTerm v-h got "+JSON.stringify(r));}}
runs++;
{const r=routeTerm([0,0,"v"],[100,50,"v"]);
 if(eq(r,[[0,0],[0,25],[100,25],[100,50]]))print("PASS routeTerm v-v Z");
 else{fails++;print("FAIL routeTerm v-v got "+JSON.stringify(r));}}
// 7. drag glue: move B, endpoints must follow
BOXES={A:box(0,0,40,20),B:box(100,0,40,20)};
let r1=anchorRoute("A","B");
BOXES.B=box(100,80,40,20);
let r2=anchorRoute("A","B");
runs++;
if(r2[r2.length-1][1]!==90||r2[0][0]!==40){fails++;print("FAIL drag-glue got "+JSON.stringify(r2));}
else print("PASS drag-glue endpoints follow moved box");
// 8-onward: 250 fuzz cases -- invariants: 2 or 4 pts, all segments orthogonal,
// start on A boundary, end on B boundary, no NaN
let seed=12345;
function rnd(){seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;}
let fuzzFails=0;
for(let i=0;i<250;i++){
  const A=box(Math.round(rnd()*900),Math.round(rnd()*500),10+Math.round(rnd()*120),10+Math.round(rnd()*80));
  const B=box(Math.round(rnd()*900),Math.round(rnd()*500),10+Math.round(rnd()*120),10+Math.round(rnd()*80));
  BOXES={A:A,B:B};
  const r=anchorRoute("A","B");
  runs++;
  let ok=(r.length===2||r.length===4);
  for(const p of r) if(!isFinite(p[0])||!isFinite(p[1])) ok=false;
  for(let s=0;s+1<r.length&&ok;s++)
    if(r[s][0]!==r[s+1][0]&&r[s][1]!==r[s+1][1]) ok=false;   // orthogonality
  const st=r[0], en=r[r.length-1];
  const onA=(st[0]===A.x||st[0]===A.x+A.w||st[1]===A.y||st[1]===A.y+A.h);
  const onB=(en[0]===B.x||en[0]===B.x+B.w||en[1]===B.y||en[1]===B.y+B.h);
  if(!(ok&&onA&&onB)){fuzzFails++;fails++;
    if(fuzzFails<4)print("FAIL fuzz#"+i+" A="+JSON.stringify(A)+" B="+JSON.stringify(B)+" r="+JSON.stringify(r));}
}
print((fuzzFails===0?"PASS":"FAIL")+" fuzz 250 cases ("+fuzzFails+" bad)");
// fuzz L-modes: 3 orthogonal pts, start on A top/bottom (vh) or left/right (hv), end on B
let lFails=0;
for(let i=0;i<100;i++){
  const A=box(Math.round(rnd()*900),Math.round(rnd()*500),10+Math.round(rnd()*120),10+Math.round(rnd()*80));
  const B=box(Math.round(rnd()*900),Math.round(rnd()*500),10+Math.round(rnd()*120),10+Math.round(rnd()*80));
  BOXES={A:A,B:B};
  for(const d of ["vh","hv"]){
    const r=anchorRoute("A","B",d);
    runs++;
    let ok=r.length===3;
    for(let s=0;s+1<r.length&&ok;s++)
      if(r[s][0]!==r[s+1][0]&&r[s][1]!==r[s+1][1]) ok=false;
    const st=r[0], en=r[r.length-1];
    const stOk=d==="vh"?(st[1]===A.y||st[1]===A.y+A.h):(st[0]===A.x||st[0]===A.x+A.w);
    const enOk=d==="vh"?(en[0]===B.x||en[0]===B.x+B.w):(en[1]===B.y||en[1]===B.y+B.h);
    if(!(ok&&stOk&&enOk)){lFails++;fails++;}
  }
}
print((lFails===0?"PASS":"FAIL")+" fuzz L-modes 200 cases ("+lFails+" bad)");
print("RESULT: "+(fails===0?"ALL PASS":"FAILURES="+fails)+" ("+runs+" runs)");
"""
(base / "conn_test.js").write_text(harness, encoding="utf-8")
print("harness written, anchorRoute bytes:", len(fn))
