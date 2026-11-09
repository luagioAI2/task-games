// Pure battle rules. Every mutation pushes an event (with a state snapshot) so the
// renderer can replay the sequence with timing while the state is already final.
import {
  CARD_MAP, ENEMIES, C, ENERGY_PER_TURN, HAND_SIZE, HAND_MAX, BOSS_PHASE2_STR,
} from "./data.js";
                                        

                                                                                                              
                                                     
                                                                               
                                                                                                      

                         
                
               
             
            
                   
                   
                      
                      
                 
                     
                 
                  
                              
                    
                  
                              
 

                       
                                                                                                           
                                                                                           
 

                                   
                                                                                                 
                                  
                                               
                                        
                                                                               
                                                  
                                
                            
                    
                   
                                          
                      
                                     
                             
                   
                   
                       
                                  
  

                                                                                    

function shuffle   (a     )      {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function snap(b        )       {
  const { p, e } = b;
  return {
    p: { hp: p.hp, maxHp: p.maxHp, block: p.block, burn: p.burn, weak: p.weak, str: p.str, energy: p.energy },
    e: { hp: e.hp, maxHp: e.maxHp, block: e.block, burn: e.burn, weak: e.weak, str: e.str },
  };
}

function push(b        , out      , ev        ) {
  out.push({ ...(ev          ), snap: snap(b) }      );
}

export function enemyPattern(b        )           {
  const def = ENEMIES[b.stage - 1];
  return b.e.phase === 2 && def.pattern2 ? def.pattern2 : def.pattern;
}
export function currentIntent(b        )         {
  const pat = enemyPattern(b);
  return pat[b.e.patIdx % pat.length];
}
/** Damage per hit as the player would actually take it (before block). */
export function intentDamage(b        , it        )         {
  if (!it.atk) return 0;
  let d = it.atk + b.e.str;
  if (b.e.weak > 0) d = Math.floor(d * 0.75);
  return Math.max(0, d);
}

export function newBattle(stage        , deckIds          , hp        , maxHp        )                           {
  const def = ENEMIES[stage - 1];
  let uid = 1;
  const draw = shuffle(deckIds.map((id) => ({ uid: uid++, id })));
  const b         = {
    stage, turn: 0,
    p: { hp, maxHp, block: 0, burn: 0, weak: 0, str: 0, energy: ENERGY_PER_TURN, keepBlock: false },
    e: { id: def.id, hp: def.hp, maxHp: def.hp, block: 0, burn: 0, weak: 0, str: 0, patIdx: 0, phase: 1, charged: false },
    draw, hand: [], discard: [], exhaust: [],
    played: 0, swordBonus: 0, mirror: 0, nextUid: uid, over: null,
    deckIds: [...deckIds], burnSrc: "ember", dmg: {},
  };
  const evs       = [];
  startPlayerTurn(b, evs);
  return { b, evs };
}

function drawCards(b        , n        , out      ) {
  let got = 0;
  for (let i = 0; i < n; i++) {
    if (b.hand.length >= HAND_MAX) break;
    if (b.draw.length === 0) {
      if (b.discard.length === 0) break;
      b.draw = shuffle(b.discard);
      b.discard = [];
      push(b, out, { t: "shuffle" });
    }
    b.hand.push(b.draw.pop() );
    got++;
  }
  if (got) push(b, out, { t: "draw", n: got });
}

function startPlayerTurn(b        , out      ) {
  b.turn++;
  if (!b.p.keepBlock) b.p.block = 0;
  b.p.keepBlock = false;
  b.p.energy = ENERGY_PER_TURN;
  b.played = 0;
  b.swordBonus = 0;
  if (b.p.burn > 0) {
    const d = Math.min(b.p.hp, b.p.burn);
    b.p.hp -= d;
    b.p.burn--;
    push(b, out, { t: "burnTick", who: "p", amt: d });
    if (b.p.hp <= 0) {
      b.over = "lose";
      push(b, out, { t: "death", who: "p" });
      return;
    }
  }
  push(b, out, { t: "playerTurn" });
  drawCards(b, HAND_SIZE, out);
}

function hitEnemy(b        , base        , hits        , card        , out      , strMul = 1) {
  const def = CARD_MAP[card];
  let total = 0;
  for (let i = 0; i < hits; i++) {
    if (b.e.hp <= 0) break;
    let amt = base + b.p.str * strMul + (def?.tag === "sword" ? b.swordBonus : 0);
    if (b.p.weak > 0) amt = Math.floor(amt * 0.75);
    amt = Math.max(0, amt);
    const blocked = Math.min(b.e.block, amt);
    b.e.block -= blocked;
    const dmg = Math.min(b.e.hp, amt - blocked);
    b.e.hp -= dmg;
    total += dmg;
    b.dmg[card] = (b.dmg[card] ?? 0) + dmg;
    push(b, out, { t: "hit", to: "e", dmg, blocked, i, n: hits, card });
  }
  if (hits > 1) push(b, out, { t: "total", amount: total });
  return total;
}

function gainBlock(b        , amt        , out      ) {
  b.p.block += amt;
  push(b, out, { t: "block", who: "p", amt });
}
function heal(b        , amt        , out      ) {
  const a = Math.min(amt, b.p.maxHp - b.p.hp);
  b.p.hp += a;
  push(b, out, { t: "heal", who: "p", amt: a });
}
function burnEnemy(b        , amt        , card        , out      ) {
  b.e.burn += amt;
  b.burnSrc = card;
  push(b, out, { t: "status", who: "e", kind: "burn", amt });
}
function addEnergy(b        , amt        , out      ) {
  b.p.energy += amt;
  push(b, out, { t: "energy", amt });
}

function resolve(b        , id        , out      ) {
  switch (id) {
    case "slash": hitEnemy(b, C.slash, 1, id, out); break;
    case "guard": gainBlock(b, C.guard, out); break;
    case "ember": burnEnemy(b, C.ember, id, out); break;
    case "herb": heal(b, C.herb, out); break;
    case "double": hitEnemy(b, C.double, 2, id, out); break;
    case "zap": hitEnemy(b, C.zap, 1, id, out); break;
    case "ironwall": gainBlock(b, C.ironwall, out); break;
    case "bigswing": hitEnemy(b, C.bigswing, 1, id, out); break;
    case "frost":
      hitEnemy(b, C.frostDmg, 1, id, out);
      b.e.weak += C.frostWeak;
      push(b, out, { t: "status", who: "e", kind: "weak", amt: C.frostWeak });
      break;
    case "cheer": drawCards(b, C.cheerDraw, out); break;
    case "fireball": hitEnemy(b, C.fireballDmg, 1, id, out); burnEnemy(b, C.fireballBurn, id, out); break;
    case "chain": hitEnemy(b, C.chainPer, Math.max(1, b.played), id, out); break;
    case "bash": hitEnemy(b, b.p.block, 1, id, out); break;
    case "warcry":
      b.p.str += C.warcryStr;
      push(b, out, { t: "status", who: "p", kind: "str", amt: C.warcryStr });
      break;
    case "matsuri": addEnergy(b, 1, out); drawCards(b, 1, out); break;
    case "holylight": heal(b, C.holyHeal, out); gainBlock(b, C.holyBlock, out); break;
    case "flurry": hitEnemy(b, C.flurry, C.flurryHits, id, out); break;
    case "inferno":
      if (b.e.burn > 0) {
        const add = b.e.burn;
        b.e.burn += add;
        b.burnSrc = id;
        push(b, out, { t: "status", who: "e", kind: "burn", amt: add });
      }
      break;
    case "icearmor": gainBlock(b, C.iceArmor, out); b.p.keepBlock = true; break;
    case "vamp": {
      const d = hitEnemy(b, C.vamp, 1, id, out);
      heal(b, Math.floor(d / 2), out);
      break;
    }
    case "meteor": hitEnemy(b, C.meteor, 1, id, out); break;
    case "sworddance":
      b.swordBonus += C.swordDance;
      push(b, out, { t: "status", who: "p", kind: "str", amt: 0 });
      break;
    case "thundergod": {
      const n = b.deckIds.filter((x) => CARD_MAP[x]?.tag === "thunder").length;
      hitEnemy(b, C.thunderGodPer, Math.max(1, n), id, out);
      break;
    }
    case "phoenix": burnEnemy(b, C.phoenixBurn, id, out); break;
    case "rampart": gainBlock(b, C.rampart, out); break;
    case "hourglass": addEnergy(b, C.hourglassEnergy, out); break;
    case "berserk": {
      const loss = Math.min(C.berserkHp, b.p.hp - 1);
      b.p.hp -= loss;
      push(b, out, { t: "hpLoss", who: "p", amt: loss });
      b.p.str += C.berserkStr;
      push(b, out, { t: "status", who: "p", kind: "str", amt: C.berserkStr });
      break;
    }
    case "mirror": break;
    case "dragonslayer": hitEnemy(b, C.slayer, 1, id, out, C.slayerStrMul); break;
    case "fireworks": {
      const kinds = new Set(b.deckIds).size;
      hitEnemy(b, C.fireworksPer, Math.max(1, kinds), id, out);
      break;
    }
    case "goddess": heal(b, C.goddessHeal, out); gainBlock(b, C.goddessBlock, out); break;
    case "grimoire": {
      const n = b.hand.length;
      b.discard.push(...b.hand);
      b.hand = [];
      drawCards(b, n + 1, out);
      addEnergy(b, C.grimoireEnergy, out);
      break;
    }
  }
}

export function canPlay(b        , idx        )          {
  const c = b.hand[idx];
  if (!c || b.over) return false;
  const def = CARD_MAP[c.id];
  return !def.unplayable && def.cost <= b.p.energy;
}

export function playCard(b        , idx        )              {
  if (!canPlay(b, idx)) return null;
  const out       = [];
  const inst = b.hand.splice(idx, 1)[0];
  const def = CARD_MAP[inst.id];
  b.p.energy -= def.cost;
  b.played++;
  push(b, out, { t: "energy", amt: -def.cost });
  let times = 1;
  if (def.id === "mirror") {
    b.mirror++;
    push(b, out, { t: "mirror" });
  } else if (b.mirror > 0) {
    b.mirror = 0;
    times = 2;
  }
  const wasP1 = b.e.phase === 1;
  for (let k = 0; k < times && b.e.hp > 0; k++) resolve(b, def.id, out);
  (def.exhaust ? b.exhaust : b.discard).push(inst);
  if (b.e.hp <= 0) {
    b.over = "win";
    push(b, out, { t: "death", who: "e" });
  } else checkPhase2(b, out, wasP1);
  return out;
}

function checkPhase2(b        , out      , wasP1         ) {
  const def = ENEMIES[b.stage - 1];
  if (wasP1 && def.pattern2 && b.e.phase === 1 && b.e.hp <= b.e.maxHp / 2) {
    b.e.phase = 2;
    b.e.patIdx = 0;
    b.e.str += BOSS_PHASE2_STR;
    push(b, out, { t: "phase2" });
  }
}

function hitPlayer(b        , it        , out      ) {
  const hits = it.hits ?? 1;
  const per = intentDamage(b, it);
  for (let i = 0; i < hits; i++) {
    const blocked = Math.min(b.p.block, per);
    b.p.block -= blocked;
    const dmg = Math.min(b.p.hp, per - blocked);
    b.p.hp -= dmg;
    push(b, out, { t: "hit", to: "p", dmg, blocked, i, n: hits, card: "" });
    if (b.p.hp <= 0) return;
  }
}

export function endTurn(b        )       {
  const out       = [];
  if (b.over) return out;
  b.discard.push(...b.hand);
  b.hand = [];
  b.p.weak = Math.max(0, b.p.weak - 1);
  // enemy turn
  b.e.block = 0;
  push(b, out, { t: "enemyTurn" });
  if (b.e.burn > 0) {
    const d = Math.min(b.e.hp, b.e.burn);
    b.e.hp -= d;
    b.e.burn--;
    b.dmg[b.burnSrc] = (b.dmg[b.burnSrc] ?? 0) + d;
    push(b, out, { t: "burnTick", who: "e", amt: d });
    if (b.e.hp <= 0) {
      b.over = "win";
      push(b, out, { t: "death", who: "e" });
      return out;
    }
    const wasP1 = b.e.phase === 1;
    checkPhase2(b, out, wasP1);
  }
  const it = currentIntent(b);
  push(b, out, { t: "enemyAct", intent: it });
  b.e.charged = false;
  if (it.charge) { b.e.charged = true; push(b, out, { t: "charge" }); }
  if (it.block) { b.e.block += it.block; push(b, out, { t: "block", who: "e", amt: it.block }); }
  if (it.str) { b.e.str += it.str; push(b, out, { t: "status", who: "e", kind: "str", amt: it.str }); }
  if (it.curse) {
    for (let i = 0; i < it.curse; i++) {
      const pos = Math.floor(Math.random() * (b.draw.length + 1));
      b.draw.splice(pos, 0, { uid: b.nextUid++, id: "curse" });
    }
    push(b, out, { t: "curse", n: it.curse });
  }
  if (it.atk) hitPlayer(b, it, out);
  if (b.p.hp > 0 && it.weak) { b.p.weak += it.weak; push(b, out, { t: "status", who: "p", kind: "weak", amt: it.weak }); }
  if (b.p.hp > 0 && it.burn) { b.p.burn += it.burn; push(b, out, { t: "status", who: "p", kind: "burn", amt: it.burn }); }
  b.e.patIdx = (b.e.patIdx + 1) % enemyPattern(b).length;
  b.e.weak = Math.max(0, b.e.weak - 1);
  if (b.p.hp <= 0) {
    b.over = "lose";
    push(b, out, { t: "death", who: "p" });
    return out;
  }
  startPlayerTurn(b, out);
  return out;
}
