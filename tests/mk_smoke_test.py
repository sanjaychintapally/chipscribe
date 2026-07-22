#!/usr/bin/env python3
# Startup smoke test: run the REAL editor_app.js under jsc with a stub DOM that
# includes two fake blocks and one generated connector. Catches load-time
# crashes (TDZ / undefined refs / bad init order) that static checks miss.
import pathlib
base = pathlib.Path(__file__).resolve().parent
appjs = (base.parent / "src" / "editor_app.js").read_text(encoding="utf-8")

stub = r"""
// ---------------- minimal DOM stub for jsc ----------------
var RECORD={renderedConn:null, errors:[]};
function mkEl(tag){
  var e={
    tag:tag||"div", children:[], dataset:{}, style:{}, attrs:{},
    classList:{toggle:function(){},add:function(){},remove:function(){}},
    textContent:"", value:"", placeholder:"", href:"",
    _innerHTML:"",
    addEventListener:function(){}, removeEventListener:function(){},
    appendChild:function(c){this.children.push(c);return c;},
    insertBefore:function(c,ref){this.children.push(c);return c;},
    remove:function(){},
    setAttribute:function(k,v){this.attrs[k]=String(v);
      if(k==="data-id")this.dataset.id=String(v);
      if(k==="class")this.className=String(v);},
    getAttribute:function(k){return this.attrs[k];},
    removeAttribute:function(k){delete this.attrs[k];},
    closest:function(){return null;},
    querySelector:function(){return null;},
    querySelectorAll:function(){return [];},
    getBBox:function(){return {x:this._bx||0,y:this._by||0,width:this._bw||10,height:this._bh||10};},
    getBoundingClientRect:function(){return {left:0,top:0,right:10,bottom:10};},
  };
  Object.defineProperty(e,"innerHTML",{
    get:function(){return this._innerHTML;},
    set:function(v){this._innerHTML=v;this.children=[];
      if(this.dataset&&this.dataset.id==="c1"&&v!=="")RECORD.renderedConn="cleared-then-set";}
  });
  return e;
}
function mkGroup(id,bx,by,bw,bh){
  var g=mkEl("g"); g.dataset.id=id; g.className="mv";
  g._bx=bx; g._by=by; g._bw=bw; g._bh=bh;
  g.appendChild=function(c){this.children.push(c);
    if(id==="c1")RECORD.renderedConn=(RECORD.renderedConn||"")+"+child:"+(c.tag||"?");
    return c;};
  return g;
}
var blockA=mkGroup("A",100,100,60,40);
var blockB=mkGroup("B",300,100,60,40);
var connG=mkGroup("c1",0,0,1,1);
connG.dataset.a="A"; connG.dataset.b="B"; connG.dataset.slash="2";
connG.dataset.arrow="1"; connG.dataset.ext="5";
var GROUPS=[blockA,blockB,connG];
var svgEl=mkEl("svg");
svgEl.querySelectorAll=function(sel){
  if(sel==="g.mv")return GROUPS.slice();
  if(sel==='g.mv[data-a]')return [connG];
  return [];
};
svgEl.querySelector=function(sel){
  var m=/data-id="([^"]+)"/.exec(sel);
  if(m){for(var i=0;i<GROUPS.length;i++)if(GROUPS[i].dataset.id===m[1])return GROUPS[i];}
  return null;
};
svgEl.insertBefore=function(c,ref){GROUPS.push(c);return c;};
svgEl.firstChild=null;
var ELS={d:svgEl};
var document={
  getElementById:function(id){if(!ELS[id])ELS[id]=mkEl(id);return ELS[id];},
  createElementNS:function(ns,tag){var e=mkEl(tag);
    if(tag==="g")e.className="";
    return e;},
  createElement:function(tag){return mkEl(tag);},
  addEventListener:function(){},
  querySelectorAll:function(){return [];},
  body:mkEl("body"),
};
// no localStorage / navigator on purpose: editor must survive their absence
// ---------------- end stub ----------------
"""

tail = r"""
// ---------------- assertions ----------------
if(RECORD.renderedConn===null){
  print("FAIL startup did not render the generated connector");
}else{
  print("PASS generated connector rendered at startup ("+RECORD.renderedConn+")");
}
print("RESULT: SMOKE " + (RECORD.renderedConn!==null ? "ALL PASS" : "FAILED"));
"""

harness = stub + "\ntry{\n" + appjs + "\n}catch(err){print('FAIL editor threw at load: '+err);print('RESULT: SMOKE FAILED');}\n" + tail
(base / "smoke_test.js").write_text(harness, encoding="utf-8")
print("smoke harness written:", len(harness), "bytes")
