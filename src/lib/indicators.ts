export type Candle = { t:number; o:number; h:number; l:number; c:number; v:number };

export function sma(vals:number[], len:number){
  if(vals.length < len) return undefined;
  const slice = vals.slice(-len);
  const total = slice.reduce((a,b)=>a+b,0);
  return total / len;
}

export function rvol(vols:number[], len=20){
  if(vols.length < len) return undefined;
  const slice = vols.slice(-len);
  const avg = slice.reduce((a,b)=>a+b,0) / len;
  const last = vols[vols.length-1];
  return avg === 0 ? undefined : last / avg;
}

export function gapFlags(prev:Candle, cur:Candle){
  const gapPct = prev ? (cur.o - prev.c) / prev.c : 0;
  return {
    gapUp: gapPct > 0.02,
    gapDown: gapPct < -0.02,
    gapPct
  };
}
