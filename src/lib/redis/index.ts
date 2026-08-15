import Redis from "ioredis"; let client:Redis|undefined;
export function redis(){if(!client)client=new Redis(process.env.REDIS_URL!,{lazyConnect:true,maxRetriesPerRequest:1,enableOfflineQueue:false});return client}
export async function loginLimit(ip:string,username:string){try{const r=redis();if(r.status==="wait")await r.connect();const key=`login:${ip}:${username}`;const count=await r.incr(key);if(count===1)await r.expire(key,900);return {allowed:count<=8,delayMs:count>3?Math.min((count-3)*750,5000):0}}catch{return {allowed:true,delayMs:0}}}
