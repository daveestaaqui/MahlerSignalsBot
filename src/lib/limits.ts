export class TokenBucket {
  private tokens: number; private last: number;
  constructor(private capacity:number, private refillPerSec:number){ this.tokens=capacity; this.last=Date.now(); }
  async take(cost=1){
    for(;;){
      const now=Date.now(); const dt=(now-this.last)/1000; this.last=now;
      this.tokens=Math.min(this.capacity, this.tokens+dt*this.refillPerSec);
      if(this.tokens>=cost){ this.tokens-=cost; return; }
      const ms=Math.ceil((cost-this.tokens)/this.refillPerSec*1000);
      await new Promise(r=>setTimeout(r, ms));
    }
  }
}
export async function withRetry<T>(fn:()=>Promise<T>, tries=4, base=300){
  let lastErr:any;
  for(let i=0;i<tries;i++){
    try{ return await fn(); }catch(e){ lastErr=e; await new Promise(r=>setTimeout(r, base*Math.pow(2,i))); }
  }
  throw lastErr;
}
