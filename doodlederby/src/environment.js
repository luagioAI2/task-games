import * as THREE from 'three';

// Repeated landscape objects share geometry and material through instancing.
function instances(world,geometry,color,items,shadow=true){
  const mesh=new THREE.InstancedMesh(geometry,world.mat(color),items.length),dummy=new THREE.Object3D();
  items.forEach((v,i)=>{dummy.position.set(...v.p);dummy.scale.set(...(v.s||[1,1,1]));dummy.rotation.set(0,v.r||0,0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
  mesh.castShadow=shadow;mesh.receiveShadow=true;world.props.add(mesh);return mesh;
}

export function buildCountryside(world){
  const {props}=world;
  world.box(props,650,.3,350,'#99b783',110,-.96,0);
  // Broad fields break up the old empty plane without adding texture downloads.
  for(let i=0;i<8;i++)world.box(props,36,.025,34,i%2?'#a6bd7d':'#b0c287',i*38-28,-.78,36);
  const trunks=[],crowns=[[],[],[]],shrubs=[],flowers=[[],[]],hills=[],clouds=[];
  for(let i=0;i<65;i++){
    const x=-23+i*4.2+Math.sin(i*8.1)*3,z=i%2?-24-(i*13%12):21+(i*7%13),scale=.8+(i%5)*.11;
    trunks.push({p:[x,.8,z],s:[1,1.5*scale,1]});
    crowns[i%3].push({p:[x,2.5*scale,z],s:[1.2*scale,1.6*scale,1.15*scale],r:i});
    if(i%3===0)crowns[i%3].push({p:[x+.9,1.95*scale,z+.4],s:[scale,1.1*scale,scale]});
  }
  instances(world,new THREE.CylinderGeometry(.16,.24,1.4,6),'#88714f',trunks);
  crowns.forEach((items,i)=>instances(world,new THREE.IcosahedronGeometry(1.1,1),['#5e875d','#699768','#7a9e62'][i],items));
  for(let i=0;i<115;i++){
    const x=-10+i*2.05,z=i%2?10.7:-(18+(i%4));
    shrubs.push({p:[x,-.1,z],s:[.55+(i%3)*.15,.42,.55],r:i});
    if(i%2===0)flowers[i%4===0?0:1].push({p:[x+.2,.32,z+.25],s:[.08,.08,.08]});
  }
  instances(world,new THREE.IcosahedronGeometry(1,0),'#789963',shrubs);
  flowers.forEach((items,i)=>instances(world,new THREE.IcosahedronGeometry(1,0),i?'#f3d370':'#fff2ce',items,false));
  for(let i=0;i<15;i++)hills.push({p:[i*24-55,-2,-58-(i%3)*10],s:[18+(i%3)*4,8+(i%4)*3,13],r:i*.7});
  instances(world,new THREE.IcosahedronGeometry(1,2),'#88a685',hills,false);
  for(let i=0;i<11;i++)for(let j=0;j<3;j++)clouds.push({p:[i*29-30+j*2.8,20+(i%3)*3,-41-(i%4)*7],s:[4.5,1.5+j*.25,2.5]});
  const cloud=instances(world,new THREE.SphereGeometry(1,10,6),'#eef0de',clouds,false);cloud.receiveShadow=false;

  const heads=[],bodies=[[],[],[]];
  for(let i=0;i<5;i++){
    if(i===2)continue; // The 100 m awards area occupies this section of the far bank.
    const x=10+i*40;
    world.box(props,13,.45,4.8,'#ddd2ad',x,-.1,-14.2);
    for(let row=0;row<3;row++){
      world.box(props,12,.36,1.15,'#e9dfbd',x,.2+row*.4,-12.9-row*1.2);
      for(let j=0;j<9;j++){
        const px=x-5.2+j*1.3,py=.7+row*.4,pz=-12.9-row*1.2;
        bodies[(j+row+i)%3].push({p:[px,py,pz]});heads.push({p:[px,py+.43,pz]});
      }
    }
    for(const dx of [-6.2,6.2])world.box(props,.15,4.7,.15,'#f4ebd2',x+dx,1.9,-16.2);
    const roof=world.add(props,new THREE.ConeGeometry(8.1,1.25,4),'#d98666',x,4.3,-14.2);roof.rotation.y=Math.PI/4;roof.scale.z=.5;
  }
  instances(world,new THREE.SphereGeometry(.19,7,5),'#f0cfaa',heads);
  bodies.forEach((items,i)=>instances(world,new THREE.CylinderGeometry(.16,.23,.48,6),['#b97f5d','#668782','#d3b860'][i],items));

  world.balloons=[];
  for(let i=0;i<3;i++){
    const g=new THREE.Group();props.add(g);g.position.set(32+i*76,14+i*2,-39);world.balloons.push(g);
    world.add(g,new THREE.SphereGeometry(2,14,10),['#d88a6e','#dfc17b','#8cae9b'][i],0,0,0).scale.y=1.2;
    world.box(g,.7,.5,.7,'#9a7954',0,-3.5,0);
    for(const x of [-.29,.29])world.cylinder(g,.02,1.5,'#ddd8b7',x,-2.55,0,4);
  }
}

export function makeAwards(world){
  const group=new THREE.Group();world.scene.add(group);
  world.box(group,15,.24,8,'#d7cfac',0,-.05,0);
  world.box(group,14.2,.08,7.2,'#ede4c8',0,.11,0);
  const places=[{rank:2,x:-4.25,h:1.05,color:'#afc2b6'},{rank:1,x:0,h:1.8,color:'#e6c66c'},{rank:3,x:4.25,h:.65,color:'#c99471'}];
  const positions={};
  for(const {rank,x,h,color} of places){
    world.box(group,4.05,h,3.1,color,x,.15+h/2,.5);
    world.box(group,4.15,.11,3.2,'#f7eed5',x,.15+h+.055,.5);
    const number=world.label(String(rank),3.5,Math.min(h*.85,1.2),color,'#344f3d',100);number.position.set(x,.15+h/2,2.06);group.add(number);
    positions[rank]=new THREE.Vector3(x,.26+h,.5);
  }
  for(const x of [-7,7])world.cylinder(group,.07,6,'#ece5c8',x,3,-2.7,8);
  const title=world.label('WINNERS CLUB',10,1.1,'#315f48','#fff4cb');title.position.set(0,5.7,-2.7);group.add(title);
  const gold=world.mat('#d6a73e');gold.metalness=.45;gold.roughness=.3;
  const trophy=new THREE.Group();group.add(trophy);trophy.visible=false;
  world.add(trophy,new THREE.CylinderGeometry(.55,.22,.65,12),'#d6a73e',0,4.35,-2.6);
  world.cylinder(trophy,.1,.55,'#d6a73e',0,3.8,-2.6);world.box(trophy,.75,.15,.55,'#d6a73e',0,3.47,-2.6);
  for(const sign of [-1,1])world.add(trophy,new THREE.TorusGeometry(.3,.06,6,14),'#d6a73e',sign*.49,4.3,-2.6);
  for(let i=0;i<15;i++){
    const flag=world.add(group,new THREE.ConeGeometry(.27,.7,3),i%2?'#e2865e':'#edcc79',-6.5+i*.93,4.9-Math.sin(i/14*Math.PI)*.35,-2.6);flag.rotation.z=Math.PI;
  }
  group.visible=false;return {group,positions,trophy,title};
}
