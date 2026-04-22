import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";

// ── Theme colours (matching CodeForge dark palette) ───────────────────────────
const C = {
  bg:     "#0a0f1e",
  card:   "#111827",
  border: "#1e293b",
  t1:     "#f1f5f9",
  t2:     "#94a3b8",
  t3:     "#475569",
  blue:   "#3b82f6",
  cyan:   "#06b6d4",
  green:  "#22c55e",
  purple: "#a855f7",
};

// ── Step definitions ──────────────────────────────────────────────────────────
const STEPS = [
  { id: "reading",     label: "Reading PDF",           icon: "📄" },
  { id: "structuring", label: "Structuring content",   icon: "🧠" },
  { id: "generating",  label: "Building diagram",      icon: "✨" },
];

// ── Main component ─────────────────────────────────────────────────────────────
export default function ConvertPanel() {
  const [phase, setPhase]         = useState("idle");   // idle|working|done|error
  const [activeStep, setActiveStep] = useState(null);
  const [doneSteps, setDoneSteps]   = useState([]);
  const [fileName, setFileName]     = useState("");
  const [data, setData]             = useState(null);
  const [htmlOut, setHtmlOut]       = useState("");
  const [errMsg, setErrMsg]         = useState("");
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const prevUrlRef = useRef(null);

  // Revoke old blob URL on update
  useEffect(() => {
    if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    prevUrlRef.current = previewUrl;
  }, [previewUrl]);

  // ── Pick & convert ───────────────────────────────────────────────────────────
  const handleConvert = async () => {
    const selected = await open({
      filters: [{ name: "PDF / Document", extensions: ["pdf"] }],
      multiple: false,
    });
    if (!selected) return;

    setFileName(selected.split(/[\\/]/).pop());
    setPhase("working");
    setDoneSteps([]);
    setErrMsg("");
    setShowPreview(false);

    try {
      // Step 1: reading (instant — just UI feedback)
      setActiveStep("reading");
      await new Promise(r => setTimeout(r, 400));
      setDoneSteps(["reading"]);

      // Step 2: structuring (LLM call)
      setActiveStep("structuring");
      const structured = await invoke("pdf_to_structured_content", { path: selected });
      setData(structured);
      setDoneSteps(d => [...d, "structuring"]);

      // Step 3: generate HTML (pure JS, instant)
      setActiveStep("generating");
      await new Promise(r => setTimeout(r, 300));
      const html = generateDiagramHTML(structured);
      setHtmlOut(html);
      const blob = new Blob([html], { type: "text/html" });
      setPreviewUrl(URL.createObjectURL(blob));
      setDoneSteps(d => [...d, "generating"]);

      setPhase("done");
      setActiveStep(null);
    } catch (e) {
      setErrMsg(String(e));
      setPhase("error");
      setActiveStep(null);
    }
  };

  // ── Download ──────────────────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!htmlOut) return;
    const savePath = await save({
      filters: [{ name: "HTML Website", extensions: ["html"] }],
      defaultPath: ((data?.title || "document").replace(/[^a-z0-9]/gi, "_").slice(0, 60)) + ".html",
    });
    if (!savePath) return;
    await writeTextFile(savePath, htmlOut);
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      background: C.bg, color: C.t1, fontFamily: "'DM Sans',-apple-system,sans-serif",
      overflow: "hidden",
    }}>

      {/* ── Header ── */}
      <div style={{ padding: "20px 28px 16px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `linear-gradient(135deg, ${C.blue}, ${C.cyan})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16,
          }}>✨</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>PDF → Mind Map Diagram</div>
            <div style={{ fontSize: 11, color: C.t3 }}>Transform any PDF into a clickable, interactive knowledge diagram</div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, overflow: "auto", padding: "24px 28px" }}>

        {/* Drop zone / upload */}
        {phase === "idle" && (
          <DropZone onConvert={handleConvert} />
        )}

        {/* Working */}
        {phase === "working" && (
          <div style={{ maxWidth: 480 }}>
            <div style={{
              fontSize: 13, color: C.t2, marginBottom: 20,
              background: `rgba(59,130,246,0.07)`,
              border: `1px solid rgba(59,130,246,0.2)`,
              borderRadius: 10, padding: "10px 14px",
            }}>
              📄 {fileName}
            </div>
            {STEPS.map(s => {
              const done   = doneSteps.includes(s.id);
              const active = activeStep === s.id;
              return (
                <div key={s.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 0", borderBottom: `1px solid ${C.border}`,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: done ? "rgba(34,197,94,0.15)" : active ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${done ? "rgba(34,197,94,0.4)" : active ? "rgba(59,130,246,0.4)" : C.border}`,
                    fontSize: 13,
                    animation: active ? "spin 1s linear infinite" : "none",
                  }}>
                    {done ? "✅" : active ? "⏳" : s.icon}
                  </div>
                  <div>
                    <div style={{
                      fontSize: 13, fontWeight: 500,
                      color: done ? C.green : active ? C.blue : C.t3,
                    }}>{s.label}</div>
                    {active && s.id === "structuring" && (
                      <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>
                        AI is reading the paper — this takes ~20–40 seconds…
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Error */}
        {phase === "error" && (
          <div style={{ maxWidth: 480 }}>
            <div style={{
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: 10, padding: 16, marginBottom: 16,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#fca5a5", marginBottom: 6 }}>⚠️ Conversion failed</div>
              <div style={{ fontSize: 12, color: "#f87171" }}>{errMsg}</div>
              {errMsg.includes("LLM") && (
                <div style={{ fontSize: 11, color: C.t3, marginTop: 8 }}>
                  Make sure the CodeForge app is open and a model is loaded.
                </div>
              )}
            </div>
            <button onClick={() => setPhase("idle")} style={btnStyle(C.blue)}>
              ← Try again
            </button>
          </div>
        )}

        {/* Done — preview + download */}
        {phase === "done" && (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Action bar */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
              <div style={{
                flex: 1, fontSize: 12, color: C.t2,
                background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)",
                borderRadius: 8, padding: "8px 12px",
              }}>
                ✅ <strong style={{ color: C.green }}>{data?.title || fileName}</strong> — ready
              </div>
              <button
                onClick={() => setShowPreview(p => !p)}
                style={btnStyle(C.t3, "rgba(255,255,255,0.06)", C.border)}
              >
                {showPreview ? "Hide Preview" : "👁 Preview"}
              </button>
              <button onClick={handleDownload} style={btnStyle(C.blue)}>
                ⬇ Download .html
              </button>
              <button onClick={() => { setPhase("idle"); setData(null); }} style={btnStyle(C.t3, "transparent", C.border)}>
                Convert another
              </button>
            </div>

            {/* Stats chips */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flexShrink: 0 }}>
              {[
                ["📑", `${data?.sections?.length || 0} sections`],
                ["✦", `${data?.key_findings?.length || 0} key findings`],
                ["🏷", `${data?.keywords?.length || 0} keywords`],
                ["👤", (data?.authors || []).slice(0, 2).join(", ") || "Unknown"],
              ].map(([icon, label]) => (
                <div key={label} style={{
                  display: "flex", alignItems: "center", gap: 5,
                  background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`,
                  borderRadius: 6, padding: "4px 10px", fontSize: 11, color: C.t2,
                }}>
                  <span>{icon}</span><span>{label}</span>
                </div>
              ))}
            </div>

            {/* Live preview iframe */}
            {showPreview && previewUrl && (
              <div style={{
                flex: 1, borderRadius: 10, overflow: "hidden",
                border: `1px solid ${C.border}`, minHeight: 400,
              }}>
                <iframe
                  src={previewUrl}
                  title="Website preview"
                  style={{ width: "100%", height: "100%", border: "none", background: "#0a0f1e" }}
                  sandbox="allow-scripts"
                />
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Drop Zone ─────────────────────────────────────────────────────────────────
function DropZone({ onConvert }) {
  const [hover, setHover] = useState(false);
  return (
    <div style={{ maxWidth: 520 }}>
      <button
        onClick={onConvert}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          width: "100%", padding: "40px 24px", borderRadius: 14, cursor: "pointer",
          border: `2px dashed ${hover ? "#3b82f6" : "#1e293b"}`,
          background: hover ? "rgba(59,130,246,0.06)" : "rgba(255,255,255,0.02)",
          color: "#94a3b8", textAlign: "center", transition: "all 0.2s",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        }}
      >
        <div style={{ fontSize: 40 }}>📄</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9" }}>
          Click to choose a PDF
        </div>
        <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
          Research papers, reports, manuals — any PDF<br />
          Converted into a beautiful, searchable web page
        </div>
      </button>

      {/* Feature pills */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
        {["🗺 Radial mind map","🖱 Click to explore","🔎 Pan & zoom",
          "🎨 Dark theme","📥 Export HTML","⚡ Instant preview"].map(f => (
          <div key={f} style={{
            fontSize: 11, padding: "4px 10px", borderRadius: 20,
            background: "rgba(255,255,255,0.04)", border: "1px solid #1e293b",
            color: "#64748b",
          }}>{f}</div>
        ))}
      </div>
    </div>
  );
}

// ── Button style helper ───────────────────────────────────────────────────────
function btnStyle(color, bg, border) {
  return {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "8px 16px", borderRadius: 8, cursor: "pointer",
    background: bg || color, color: bg ? color : "#fff",
    border: border ? `1px solid ${border}` : "none",
    fontSize: 12, fontWeight: 600, transition: "opacity 0.15s", whiteSpace: "nowrap",
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
//  DIAGRAM GENERATOR — takes structured JSON, returns self-contained HTML
//  Renders an interactive radial mind-map (SVG, pan/zoom, click-to-explore)
// ═══════════════════════════════════════════════════════════════════════════════
function generateDiagramHTML(data) {
  const safeJson = JSON.stringify(data || {}).replace(/<\/script>/gi, "<\\/script>");
  const docTitle = String(data?.title || "Document")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${docTitle}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden;background:#07101f;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif}
body{display:flex;flex-direction:column}
#bar{display:flex;align-items:center;justify-content:space-between;padding:9px 16px;background:#0d1829;border-bottom:1px solid #192440;flex-shrink:0;gap:12px}
#bt{font-size:13px;font-weight:600;color:#e2e8f0;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#bm{font-size:11px;color:#475569;flex-shrink:0}
#main{flex:1;display:flex;overflow:hidden}
#cw{flex:1;position:relative;overflow:hidden;cursor:grab;background:radial-gradient(ellipse at 50% 46%,#0c1c38 0%,#07101f 68%)}
#cw.drag{cursor:grabbing}
#panel{width:280px;flex-shrink:0;background:#0d1829;border-left:1px solid #192440;display:flex;flex-direction:column}
#ph{padding:13px 15px;background:#101e38;border-bottom:1px solid #192440;flex-shrink:0}
#ph-tag{font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;margin-bottom:3px}
#ph-name{font-size:13px;font-weight:600;color:#f1f5f9;line-height:1.35}
#pb{flex:1;overflow-y:auto;padding:13px 15px}
#pb p{font-size:12px;line-height:1.85;color:#94a3b8;white-space:pre-wrap;word-break:break-word}
#pb .hint{font-style:italic;color:#2d3f5c}
.zc{position:absolute;bottom:14px;right:14px;display:flex;flex-direction:column;gap:4px;z-index:5}
.zb{width:30px;height:30px;background:#0d1829cc;border:1px solid #192440;color:#64748b;border-radius:7px;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;transition:.15s;padding:0;line-height:1}
.zb:hover{background:#192440;color:#e2e8f0}
#hint{position:absolute;bottom:14px;left:14px;font-size:10px;color:#1a2d4a;pointer-events:none}
#legend{position:absolute;top:12px;left:12px;display:flex;flex-direction:column;gap:5px;background:#0d1829cc;border:1px solid #192440;border-radius:9px;padding:10px 12px}
.le{display:flex;align-items:center;gap:7px;font-size:10px;color:#64748b}
.ld{width:9px;height:9px;border-radius:3px;flex-shrink:0}
</style>
</head><body>
<div id="bar">
  <div id="bt">${docTitle}</div>
  <div id="bm"></div>
</div>
<div id="main">
  <div id="cw">
    <svg id="svg" style="width:100%;height:100%;overflow:visible"><g id="g"></g></svg>
    <div class="zc">
      <button class="zb" id="zin">+</button>
      <button class="zb" id="zout">&#8722;</button>
      <button class="zb" id="zfit">&#8962;</button>
    </div>
    <div id="hint">Drag to pan &middot; Scroll to zoom &middot; Click nodes to explore</div>
    <div id="legend">
      <div class="le"><div class="ld" style="background:#f59e0b"></div>Document</div>
      <div class="le"><div class="ld" style="background:#3b82f6"></div>Sections</div>
      <div class="le"><div class="ld" style="background:#22c55e"></div>Findings</div>
      <div class="le"><div class="ld" style="background:#ec4899"></div>Keywords</div>
      <div class="le"><div class="ld" style="background:#06b6d4"></div>Meta</div>
    </div>
  </div>
  <div id="panel">
    <div id="ph">
      <div id="ph-tag" style="color:#475569">Document</div>
      <div id="ph-name">${docTitle}</div>
    </div>
    <div id="pb"><p class="hint">Click any node in the diagram to read its content here.</p></div>
  </div>
</div>
<script>
(function(){
var NS="http://www.w3.org/2000/svg";
var D=${safeJson};

var COL={root:"#f59e0b",abstract:"#8b5cf6",meta:"#06b6d4",section:"#3b82f6",finding:"#22c55e",keyword:"#ec4899",method:"#f97316",conclusion:"#ef4444"};
var NW={root:168,abstract:128,meta:116,section:134,finding:122,keyword:94,method:128,conclusion:128};
var NH={root:48,abstract:36,meta:30,section:36,finding:34,keyword:26,method:36,conclusion:36};
var NFS={root:13,abstract:11,meta:10,section:11,finding:11,keyword:10,method:11,conclusion:11};

function clip(s,n){s=String(s||"");return s.length>n?s.slice(0,n-1)+"\u2026":s;}

function buildGraph(d){
  var nodes=[],edges=[];
  function nd(id,type,label,title,body){nodes.push({id:id,type:type,label:label,title:title,body:body||""});}
  function eg(a,b){edges.push({f:a,t:b});}

  nd("root","root",clip(d.title||"Document",22),d.title||"Document",d.abstract||"");
  if(d.abstract){nd("abs","abstract","Abstract","Abstract",d.abstract);eg("root","abs");}
  if(d.authors&&d.authors.length){nd("aut","meta","Authors","Authors",(d.authors||[]).join(", "));eg("root","aut");}
  if(d.year){nd("yr","meta","Year: "+d.year,"Publication Year",String(d.year));eg("root","yr");}

  if(d.sections&&d.sections.length){
    nd("secs","section","Sections ("+d.sections.length+")","Sections",
      d.sections.map(function(s){return s.heading||"";}).join(", "));
    eg("root","secs");
    d.sections.forEach(function(s,i){
      var id="sc"+i;
      nd(id,"section",clip(s.heading||"Section "+(i+1),22),s.heading||"Section "+(i+1),s.content||"");
      eg("secs",id);
    });
  }

  if(d.key_findings&&d.key_findings.length){
    nd("kfs","finding","Findings ("+d.key_findings.length+")","Key Findings",
      d.key_findings.map(function(f,i){return (i+1)+". "+(typeof f==="string"?f:JSON.stringify(f));}).join("\n\n"));
    eg("root","kfs");
    d.key_findings.forEach(function(f,i){
      var id="kf"+i;
      var txt=typeof f==="string"?f:JSON.stringify(f);
      nd(id,"finding","Finding "+(i+1),"Finding "+(i+1),txt);
      eg("kfs",id);
    });
  }

  if(d.keywords&&d.keywords.length){
    nd("kws","keyword","Keywords","Keywords",(d.keywords||[]).join(", "));
    eg("root","kws");
    d.keywords.slice(0,10).forEach(function(k,i){
      nd("kw"+i,"keyword",clip(k,16),k,"");
      eg("kws","kw"+i);
    });
  }

  if(d.methodology){nd("meth","method","Methodology","Methodology",d.methodology);eg("root","meth");}
  if(d.conclusion){nd("conc","conclusion","Conclusion","Conclusion",d.conclusion);eg("root","conc");}
  return {nodes:nodes,edges:edges};
}

function doLayout(nodes,edges){
  var byId={};
  nodes.forEach(function(n){byId[n.id]=n;});
  var ch={};
  edges.forEach(function(e){if(!ch[e.f])ch[e.f]=[];ch[e.f].push(e.t);});
  var cw=document.getElementById("cw");
  var CX=cw.clientWidth/2, CY=cw.clientHeight/2;
  byId["root"].x=CX; byId["root"].y=CY;
  var L1=ch["root"]||[];
  var R1=195+Math.max(0,(L1.length-6)*18);
  L1.forEach(function(id,i){
    var a=(i/L1.length)*Math.PI*2-Math.PI/2;
    var n=byId[id]; if(!n) return;
    n.x=CX+Math.cos(a)*R1; n.y=CY+Math.sin(a)*R1; n.pa=a;
    var L2=ch[id]||[];
    if(L2.length){
      var R2=158+Math.max(0,(L2.length-5)*14);
      var sp=Math.min(1.65,L2.length*0.28+0.25);
      L2.forEach(function(cid,j){
        var c=byId[cid]; if(!c) return;
        var ca=L2.length===1?a:(a-sp/2+(j/(L2.length-1))*sp);
        c.x=n.x+Math.cos(ca)*R2; c.y=n.y+Math.sin(ca)*R2;
      });
    }
  });
  return byId;
}

function se(tag,attrs){
  var e=document.createElementNS(NS,tag);
  Object.keys(attrs).forEach(function(k){e.setAttribute(k,String(attrs[k]));});
  return e;
}

var selBg=null;
function selectNode(node,bgEl,color){
  if(selBg) selBg.setAttribute("opacity","0.14");
  if(bgEl){bgEl.setAttribute("opacity","0.65");selBg=bgEl;}
  document.getElementById("ph-tag").textContent=node.type.charAt(0).toUpperCase()+node.type.slice(1);
  document.getElementById("ph-tag").style.color=color;
  document.getElementById("ph-name").textContent=node.title||node.label||"";
  var pb=document.getElementById("pb");
  if(node.body&&node.body.trim()){
    var safe=node.body.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    pb.innerHTML="<p>"+safe+"</p>";
  } else {
    pb.innerHTML="<p class='hint'>No additional content for this node.</p>";
  }
}

function render(){
  var G=buildGraph(D);
  var byId=doLayout(G.nodes,G.edges);
  var g=document.getElementById("g"); g.innerHTML="";

  var meta=[];
  if(D.authors&&D.authors.length) meta.push((D.authors||[]).slice(0,2).join(", "));
  if(D.year) meta.push(String(D.year));
  document.getElementById("bm").textContent=meta.join(" \u00b7 ");

  var eG=se("g",{}); g.appendChild(eG);
  G.edges.forEach(function(edge){
    var fn=byId[edge.f],tn=byId[edge.t];
    if(!fn||!tn||fn.x===undefined||tn.x===undefined) return;
    var mx=(fn.x+tn.x)/2;
    var color=COL[tn.type]||"#334155";
    var d="M"+fn.x+","+fn.y+" C"+mx+","+fn.y+" "+mx+","+tn.y+" "+tn.x+","+tn.y;
    eG.appendChild(se("path",{d:d,stroke:color,"stroke-width":"1.5",fill:"none","stroke-opacity":"0.35"}));
  });

  var nG=se("g",{}); g.appendChild(nG);
  G.nodes.forEach(function(node){
    var n=byId[node.id]; if(!n||n.x===undefined) return;
    var color=COL[node.type]||"#475569";
    var w=NW[node.type]||118, h=NH[node.type]||34, fs=NFS[node.type]||11;
    var grp=se("g",{transform:"translate("+(n.x-w/2)+","+(n.y-h/2)+")"});
    grp.style.cursor="pointer";
    var sh=se("rect",{x:1,y:2,width:w,height:h,rx:9,fill:"#000",opacity:"0.4"});
    var bg=se("rect",{x:0,y:0,width:w,height:h,rx:9,fill:color,opacity:"0.14",stroke:color,"stroke-width":"1.5"});
    var tx=se("text",{x:w/2,y:h/2,"text-anchor":"middle","dominant-baseline":"central",fill:color,
      "font-size":fs,"font-weight":node.type==="root"?"700":"500",
      "font-family":"-apple-system,BlinkMacSystemFont,sans-serif","pointer-events":"none"});
    tx.textContent=node.label||"";
    grp.appendChild(sh); grp.appendChild(bg); grp.appendChild(tx);
    (function(nd2,bgR,col){
      bgR.addEventListener("mouseover",function(){if(bgR!==selBg)bgR.setAttribute("opacity","0.32");});
      bgR.addEventListener("mouseout",function(){if(bgR!==selBg)bgR.setAttribute("opacity","0.14");});
      grp.addEventListener("click",function(ev){ev.stopPropagation();selectNode(nd2,bgR,col);});
    })(node,bg,color);
    nG.appendChild(grp);
  });

  // Auto-select root
  var rootNode=G.nodes.find(function(x){return x.id==="root";});
  if(rootNode){
    var firstBg=nG.querySelector("g rect:nth-child(2)");
    selectNode(rootNode,firstBg,COL["root"]||"#f59e0b");
  }
}

var tx=0,ty=0,sc=1,drag=false,ox=0,oy=0;
var cw=document.getElementById("cw");
var gEl=document.getElementById("g");
function applyT(){gEl.setAttribute("transform","translate("+tx+","+ty+") scale("+sc+")");}
cw.addEventListener("mousedown",function(e){if(e.target.closest(".zb"))return;drag=true;ox=e.clientX-tx;oy=e.clientY-ty;cw.classList.add("drag");});
window.addEventListener("mouseup",function(){drag=false;cw.classList.remove("drag");});
window.addEventListener("mousemove",function(e){if(!drag)return;tx=e.clientX-ox;ty=e.clientY-oy;applyT();});
cw.addEventListener("wheel",function(e){e.preventDefault();var f=e.deltaY<0?1.1:0.91;sc=Math.min(4,Math.max(0.2,sc*f));applyT();},{passive:false});
document.getElementById("zin").addEventListener("click",function(){sc=Math.min(4,sc*1.2);applyT();});
document.getElementById("zout").addEventListener("click",function(){sc=Math.max(0.2,sc*0.83);applyT();});
document.getElementById("zfit").addEventListener("click",function(){tx=0;ty=0;sc=1;applyT();});

render();
})();
</script>
</body></html>`;
}

