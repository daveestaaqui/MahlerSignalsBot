export type Bar = { t:number,o:number,h:number,l:number,c:number,v:number };
export function sma(values:number[], n:number){ if(values.length<n) return undefined; return values.slice(-n).reduce((a,b)=>a+b,0)/n; }
export function rvol(vols:number[], n=20){ if(vols.length<n) return undefined; const avg = sma(vols, n)!; return vols[vols.length-1] / avg; }
export function gapDown(prev:Bar, cur:Bar){ return cur.o < prev.l; }
export function gapUp(prev:Bar, cur:Bar){ return cur.o > prev.h; }
