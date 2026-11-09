// Identity comes from the server, never from a displayed horse or account name.
export function uniqueBoardRows(rows){
 if(!Array.isArray(rows))throw Error('Invalid rankings');
 const sorted=rows.filter(row=>row&&typeof row.name==='string'&&Number.isFinite(row.score)).slice().sort((a,b)=>b.score-a.score);
 const seen=new Set();
 return sorted.filter(row=>{if(typeof row.id!=='string'||!row.id)return true;if(seen.has(row.id))return false;seen.add(row.id);return true;}).slice(0,20);
}
