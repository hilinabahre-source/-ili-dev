export function bez(p0,c1,c2,p3,t){
  const mt=1-t;
  return {
    x: mt*mt*mt*p0.x + 3*mt*mt*t*c1.x + 3*mt*t*t*c2.x + t*t*t*p3.x,
    y: mt*mt*mt*p0.y + 3*mt*mt*t*c1.y + 3*mt*t*t*c2.y + t*t*t*p3.y
  };
}
export function bezTangent(p0,c1,c2,p3,t){
  const mt=1-t;
  return {
    x: 3*mt*mt*(c1.x-p0.x) + 6*mt*t*(c2.x-c1.x) + 3*t*t*(p3.x-c2.x),
    y: 3*mt*mt*(c1.y-p0.y) + 6*mt*t*(c2.y-c1.y) + 3*t*t*(p3.y-c2.y)
  };
}
// Samples the side-seam curve (a chain of cubic beziers) into points,
// plus an offset copy (the seam allowance line) pushed outward (away
// from the fold, i.e. toward +x) by `sa` inches.
export function sampleSideCurve(curves, sa, stepsPerCurve){
  const seam = [], allowance = [];
  curves.forEach(seg => {
    for(let i=0;i<=stepsPerCurve;i++){
      const t = i/stepsPerCurve;
      const pt = bez(seg.p0,seg.c1,seg.c2,seg.p3,t);
      const tan = bezTangent(seg.p0,seg.c1,seg.c2,seg.p3,t);
      const len = Math.hypot(tan.x,tan.y) || 1;
      // two perpendiculars; pick the one pointing away from the fold (+x)
      let nx = -tan.y/len, ny = tan.x/len;
      if(nx < 0){ nx=-nx; ny=-ny; }
      seam.push(pt);
      allowance.push({x:pt.x+nx*sa, y:pt.y+ny*sa});
    }
  });
  return {seam, allowance};
}
export function pointsToPath(points){
  return points.map((p,i)=> (i===0?'M':'L') + p.x.toFixed(3) + ',' + p.y.toFixed(3)).join(' ');
}
export function mirrorPoints(points){
  return points.map(p => ({x:-p.x, y:p.y}));
}

// The pattern's drafted length (e.g. a 28cm mini skirt) was drafted
// against a specific reference crotch height (waist-to-floor along the
// leg). Scaling that same ratio onto the customer's own crotch height
// gives an equivalent hem placement on their body, instead of naively
// comparing the finished garment length to their raw leg measurement.
export function scaledLength(p, customerCrotchHeight){
  if (customerCrotchHeight == null || !p.base.crotchHeight) return null;
  const ratio = p.base.length / p.base.crotchHeight;
  return ratio * customerCrotchHeight;
}
