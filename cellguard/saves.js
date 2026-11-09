const LEGACY_KEY = 'imhero.save.v1';
export function parsePayload(raw, migrate, now) {
  if (raw == null) return { meta:null, battle:null, invalid:false };
  try {
    let data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if(data && LEGACY_KEY in data) data=typeof data[LEGACY_KEY]==='string'?JSON.parse(data[LEGACY_KEY]):data[LEGACY_KEY];
    if (data?.schema && data.schema !== 2) return {meta:null,battle:null,invalid:true};
    const old=data?.schema===2?data.meta:data;
    if(!old || !Number.isFinite(old.gold) || !Number.isFinite(old.gems) || !old.weapons || !old.heroes || !Array.isArray(old.loadout)) return {meta:null,battle:null,invalid:true};
    const meta=migrate(old,now);
    if(!meta) return {meta:null,battle:null,invalid:true};
    return {meta,battle:data?.schema===2?data.battle??null:null,invalid:false};
  } catch {return {meta:null,battle:null,invalid:true};}
}
export function createAutosave(api, migrate, fresh, notify=()=>{}) {
  const loaded=parsePayload(api?.latestSync,migrate,Date.now());
  let status=loaded.invalid?'invalid':'idle', last=null, changed=false, sequence=0;
  const update=s=>{status=s;notify(s);};
  return {
    meta:loaded.meta??fresh(Date.now()), battle:loaded.battle,
    get status(){return status;},
    async write(meta,battle=null) {
      if(loaded.invalid) return false;
      changed=true;
      const {settings,...progress}=meta;
      last=JSON.parse(JSON.stringify({schema:2,meta:progress,battle}));
      const token=++sequence;
      if(!api?.putLatest){update('error');return false;}
      update('saving');
      const ok=await api.putLatest(last,'kv');
      if(token===sequence) update(ok?'accepted':'error');
      return !!ok;
    },
    async retry(){
      if(!last || loaded.invalid)return false;
      update('saving');const token=++sequence;
      const ok=await api?.putLatest(last,'kv');
      if(token===sequence)update(ok?'accepted':'error');return !!ok;
    },
    async reset(){
      sequence++;
      const ok=await api?.clearLatest();
      if(ok){last=null;changed=false;loaded.invalid=false;update('idle');}
      else update('error');
      return !!ok;
    },
    get changed(){return changed;}
  };
}

// Graph encoding keeps projectile weapon/target references and Set/Map state intact.
function encodeGraph(root) {
  const nodes=[], ids=new Map();
  function encode(value) {
    if(value===null||typeof value!=='object')return value;
    if(ids.has(value))return {$ref:ids.get(value)};
    const id=nodes.length;ids.set(value,id);nodes.push(null);
    const kind=value instanceof Set?'set':value instanceof Map?'map':Array.isArray(value)?'array':'object';
    const data=kind==='set'?[...value].map(encode):kind==='map'?[...value].map(([k,v])=>[encode(k),encode(v)]):kind==='array'?value.map(encode):Object.fromEntries(Object.entries(value).map(([k,v])=>[k,encode(v)]));
    nodes[id]={kind,data};return {$ref:id};
  }
  return {root:encode(root),nodes};
}
function decodeGraph(graph) {
  if(!graph || !Array.isArray(graph.nodes) || graph.nodes.length>30000)throw new Error('Invalid battle snapshot');
  const nodes=graph.nodes.map(n=>n.kind==='set'?new Set():n.kind==='map'?new Map():n.kind==='array'?[]:{});
  function decode(v){if(v&&typeof v==='object'&&'$ref'in v){if(!nodes[v.$ref])throw new Error('Bad save reference');return nodes[v.$ref];}return v;}
  graph.nodes.forEach((n,i)=>{
    const out=nodes[i];
    if(n.kind==='set')n.data.forEach(v=>out.add(decode(v)));
    else if(n.kind==='map')n.data.forEach(([k,v])=>out.set(decode(k),decode(v)));
    else if(n.kind==='array')n.data.forEach(v=>out.push(decode(v)));
    else for(const [k,v] of Object.entries(n.data)){if(['__proto__','constructor','prototype'].includes(k))throw new Error('Bad save key');out[k]=decode(v);}
  });
  return decode(graph.root);
}
export function snapshotBattle(battle,overlay,speed) {
  if(!battle || overlay?.t==='result')return null;
  const omit=new Set(['layout','rng','fx','sfx','tmp','setup','stats']);
  const state=Object.fromEntries(Object.entries(battle).filter(([key])=>!omit.has(key)));
  const data=encodeGraph({state,overlay,speed});
  return {version:1,setup:battle.setup,rng:battle.rng.s,data};
}
export function restoreBattle(saved, Battle) {
  if(!saved || saved.version!==1 || !saved.setup || !['line','ring'].includes(saved.setup.mode))throw new Error('Invalid battle checkpoint');
  const restored=decodeGraph(saved.data);
  if(!Array.isArray(restored.state?.segs)||!Array.isArray(restored.state?.weapons))throw new Error('Incomplete battle checkpoint');
  const battle=new Battle(saved.setup);
  Object.assign(battle,restored.state);
  battle.rng.s=saved.rng;
  battle.fx=[];battle.sfx=[];battle.placeSegs();
  return {battle,overlay:restored.overlay??{t:'none'},speed:restored.speed===2?2:1};
}
