const key = process.env.ALPHAVANTAGE_KEY;
export async function getStockDailyAV(symbol:string){
  if(!key) throw new Error('ALPHAVANTAGE_KEY missing');
  return { note: 'stub-daily' };
}
