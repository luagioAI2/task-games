// A missing platform bridge must not prevent clearly-labelled local practice.
export function playerBridge(){
 if(window.gp)return window.gp;
 const offline=async()=>({ok:false,error:'offline'});
 const bridge={offline:true,player:{user:null,ready:Promise.resolve({user:null}),requestLogin(){},saves:{latestSync:null,lastError:'offline',putLatest:async()=>false}},room:{available:false,current:null,on:()=>()=>{},create:async()=>({error:'offline'})},ai:{chat:offline}};
 window.gp=bridge;return bridge;
}
