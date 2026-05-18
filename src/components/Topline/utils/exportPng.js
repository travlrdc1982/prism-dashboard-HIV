// ROI PNG/SVG export — ported verbatim from dashboard_template.html
// exportROIPng / exportROISvg. Pure DOM operations; the React port keeps
// the imperative behavior because canvas + Blob + anchor.click() is what
// it is — refactoring into React state would be a regression.

export function exportROIPng(targetWidth, label) {
  const container = document.getElementById("roi-svg-container");
  if (!container) return;
  const svgEl = container.querySelector("svg");
  if (!svgEl) return;

  const vb = svgEl.getAttribute("viewBox").split(/\s+/).map(Number);
  const vbW = vb[2];
  const vbH = vb[3];
  const targetHeight = Math.round((targetWidth * vbH) / vbW);

  const clone = svgEl.cloneNode(true);
  clone.setAttribute("width", vbW);
  clone.setAttribute("height", vbH);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(clone);
  const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = function () {
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    canvas.toBlob(function (blob) {
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = `PRISM_ROI_${label}_${targetWidth}px.png`;
      a.click();
      URL.revokeObjectURL(dlUrl);
      URL.revokeObjectURL(svgUrl);
    }, "image/png");
  };
  img.onerror = function () {
    alert("Export failed. The SVG may use externally-loaded fonts that need a moment to load. Try again.");
    URL.revokeObjectURL(svgUrl);
  };
  img.src = svgUrl;
}

export function exportROISvg() {
  const container = document.getElementById("roi-svg-container");
  if (!container) return;
  const svgEl = container.querySelector("svg");
  if (!svgEl) return;
  const clone = svgEl.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(clone);
  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "PRISM_ROI.svg";
  a.click();
  URL.revokeObjectURL(url);
}
