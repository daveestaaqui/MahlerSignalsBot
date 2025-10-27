export type Candle = { t:number; o:number; h:number; l:number; c:number; v:number };

export function sma(values:number[], period:number){
  if(values.length < period) return undefined;
  const slice = values.slice(-period);
  return slice.reduce((a,b)=>a+b,0) / period;
}

export function rvol(vols:number[], period=20){
  if(vols.length < period) return undefined;
  const slice = vols.slice(-period);
  const avg = slice.reduce((a,b)=>a+b,0) / period;
  const last = vols[vols.length-1];
  return avg === 0 ? undefined : last / avg;
}

export function gap(prev:Candle, cur:Candle){
  const pct = prev ? (cur.o - prev.c) / prev.c : 0;
  return {
    gapPct: pct,
    gapUp: pct > 0.02,
    gapDown: pct < -0.02,
  };
}
