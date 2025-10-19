type Raw = { chain:'SOL'|'ETH', symbol:string, price:number, vol:number, whales:number, momentum:number };
export type Signal = { id:string, ts:number, chain:Raw['chain'], symbol:string, score:number, summary:string, tier:'PRO'|'ELITE' };

export async function fetchUniverse(): Promise<Raw[]> {
  // TODO: replace with real sources (Jupiter, CoW Swap, etc.)
  return [
    { chain:'SOL', symbol:'AAA', price:1.2, vol:100000, whales:2, momentum:0.8 },
    { chain:'ETH', symbol:'BBB', price:0.03, vol:80000, whales:1, momentum:0.6 },
    { chain:'SOL', symbol:'CCC', price:2.1, vol:120000, whales:4, momentum:0.9 },
  ];
}

export function score(r: Raw): number {
  // Simple composite: normalize each factor (very rough stub)
  const sVol = Math.tanh(r.vol/120000);
  const sWh  = Math.tanh(r.whales/4);
  const sMo  = r.momentum;
  return Number((0.4*sVol + 0.3*sWh + 0.3*sMo).toFixed(4));
}

export async function selectTop(nPro=3, nElite=3): Promise<{pro:Signal[], elite:Signal[]}> {
  const now = Date.now();
  const uni = await fetchUniverse();
  const ranked = uni.map(u=>{
    const sc = score(u);
    const sum = `Score ${sc} | ${u.chain}:${u.symbol} vol≈${u.vol}, whales=${u.whales}, mo=${u.momentum}`;
    return { id:`${u.chain}-${u.symbol}-${now}`, ts:now, chain:u.chain, symbol:u.symbol, score:sc, summary:sum };
  }).sort((a,b)=> b.score - a.score);
  return {
    pro:   ranked.slice(0, nPro).map(x=>({...x, tier:'PRO'})),
    elite: ranked.slice(0, nElite).map(x=>({...x, tier:'ELITE'})),
  };
}
