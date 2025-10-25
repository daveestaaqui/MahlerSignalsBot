import { daily } from '../adapters/alphaVantage.js';
import { sma, rvol, gapDown, gapUp, Bar } from './indicators.js';
import db from '../../lib/db.js';
import { scoreStock } from '../../signals/rules.js';
import { TIERS } from '../../config/tiers.js';

function parseDaily(json:any): Bar[]{
  const ts = json['Time Series (Daily)']||{};
  const entries = Object.entries(ts).map(([d,v]:any)=>({ t: Date.parse(d)/1000,
    o:+v['1. open'], h:+v['2. high'], l:+v['3. low'], c:+v['4. close'], v:+v['6. volume'] }));
  return entries.sort((a,b)=>a.t-b.t);
}

export async function runStocksAlpha(symbols:string[]){
  const now = Math.floor(Date.now()/1000);
  for(const symbol of symbols){
    try{
      const j = await daily(symbol);
      const bars = parseDaily(j); if(bars.length<30) continue;
      const closes = bars.map(b=>b.c); const vols = bars.map(b=>b.v);
      const last = bars[bars.length-1]; const prev = bars[bars.length-2];
      const s20 = sma(closes,20)!; const s200 = sma(closes,200);
      const p20 = ((last.c - s20)/s20) * 100;
      const p200 = s200 ? ((last.c - s200)/s200) * 100 : undefined;
      const rv = rvol(vols,20) || 1.0;

      const features = {
        symbol, pct_from_20d:+p20.toFixed(2), pct_from_200d:+(p200?.toFixed(2) ?? 0),
        rvol:+rv.toFixed(2), gapDown: gapDown(prev,last), gapUp: gapUp(prev,last)
      };
      const {score, reason} = scoreStock(features as any);
      if(score < 1.2) continue;

      const uniq = `stock:${symbol}:${new Date().toISOString().slice(0,10)}`;
      const embargo = now + TIERS.free.delaySeconds;

      db.prepare(`INSERT OR IGNORE INTO signals(symbol,asset_type,tier_min,score,reason,features,created_at,embargo_until,uniq_key)
        VALUES (@symbol,'stock','free',@score,@reason,@features,@created_at,@embargo,@uniq)`)
        .run({symbol, score, reason, features: JSON.stringify(features), created_at: now, embargo, uniq});

      const row = db.prepare('SELECT id FROM signals WHERE uniq_key=?').get(uniq) as any;
      if(row){
        const q = db.prepare('INSERT INTO publish_queue(signal_id,target,ready_at) VALUES (?,?,?)');
        q.run(row.id,'pro',now);
        q.run(row.id,'elite',now);
        q.run(row.id,'free',embargo);
      }
    }catch(e){ /* soft-fail per symbol */ }
  }
}
