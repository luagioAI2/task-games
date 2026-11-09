import * as THREE from 'three';
import { bounds } from './drawing.js';

export function makeHorse(strokes) {
  const root=new THREE.Group(),rig=new THREE.Group();root.add(rig);
  const b=bounds(strokes),limbs=[];
  if(!b)return {root,animate(){},dispose(){}};
  const scale=4.3/Math.max(b.w,b.h*1.25),height=b.h*scale;
  const convert=([x,y],z=0)=>new THREE.Vector3((x-(b.x0+b.x1)/2)*scale,(b.y1-y)*scale+.12,z);
  const materials=new Map();
  const material=color=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.6}));return materials.get(color);};
  const mesh=(geo,mat,parent)=>{const m=new THREE.Mesh(geo,mat);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
  for(const [i,s] of strokes.entries()) {
    const points=s.points.filter((p,j)=>j===0||Math.hypot(p[0]-s.points[j-1][0],p[1]-s.points[j-1][1])>.5);
    if(!points.length)continue;
    const sb=bounds([{points}]);
    const isLimb=sb.y0>b.y0+b.h*.52&&sb.h>b.h*.12&&sb.w<b.w*.33;
    const parent=new THREE.Group();rig.add(parent);
    // Every stroke remains a single open or closed line; enclosed areas stay empty.
    const vectors=points.map(p=>convert(p,0));
    if(vectors.length===1){const m=mesh(new THREE.SphereGeometry(.06,8,6),material(s.color),parent);m.position.copy(vectors[0]);}
    else {
      const path=new THREE.CurvePath();for(let j=1;j<vectors.length;j++)path.add(new THREE.LineCurve3(vectors[j-1],vectors[j]));
      mesh(new THREE.TubeGeometry(path,Math.min(180,Math.max(8,vectors.length*2)),.055,6,false),material(s.color),parent);
    }
    if(isLimb){
      const pivot=convert(points[0]);parent.children.forEach(c=>c.position.sub(pivot));parent.position.copy(pivot);
      parent.position.z+=(i%2?.18:-.18);limbs.push({parent,phase:i%2?Math.PI:0});
    }
  }
  root.userData.height=height;
  return {
    root,
    animate(time,speed=0,jump=0,stumble=0){
      const phase=time*(speed>0?10:2);
      rig.position.y=jump+(speed>0?Math.abs(Math.sin(phase))*.11:Math.sin(phase)*.018);
      rig.rotation.z=stumble>0?Math.sin(stumble*25)*.15:Math.sin(phase)*Math.min(speed*.004,.035);
      rig.scale.y=1+Math.sin(phase)*Math.min(speed*.003,.022);
      limbs.forEach(({parent,phase:offset})=>{parent.rotation.z=Math.sin(phase+offset)*Math.min(speed*.07,.45);});
    },
    dispose(){const geos=new Set();root.traverse(o=>{if(o.geometry)geos.add(o.geometry);});geos.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.removeFromParent();}
  };
}
