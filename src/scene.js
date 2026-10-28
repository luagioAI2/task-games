import * as THREE from 'three';
import { makeHorse } from './horse.js';
import { preset } from './drawing.js';
import { buildCountryside, makeAwards } from './environment.js';

const LANE=[5.1,1.7,-1.7,-5.1];
export class World {
  constructor(container) {
    this.container=container;this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.setClearColor('#bcd4c3');container.append(this.renderer.domElement);
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#bcd4c3');this.scene.fog=new THREE.Fog('#bcd4c3',55,145);
    this.camera=new THREE.PerspectiveCamera(38,1,.1,260);this.look=new THREE.Vector3();this.eye=new THREE.Vector3();this.mode='studio';this.view=0;this.time=0;
    this.scene.add(new THREE.HemisphereLight('#fff9ed','#719976',2.1));
    this.sun=new THREE.DirectionalLight('#fff5e5',2.5);this.sun.position.set(-12,30,18);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(1024,1024);Object.assign(this.sun.shadow.camera,{left:-28,right:28,top:26,bottom:-26,near:1,far:100});this.sun.shadow.normalBias=.035;this.scene.add(this.sun,this.sun.target);
    this.materials=new Map();
    this.track=new THREE.Group();this.scene.add(this.track);this.props=new THREE.Group();this.scene.add(this.props);
    this.podium=new THREE.Group();this.scene.add(this.podium);
    this.cylinder(this.podium,4.6,.4,'#f3e8cf',0,-.22,0,64);
    this.cylinder(this.podium,4.85,.16,'#32765a',0,-.5,0,64);
    this.buildTrack();this.awards=makeAwards(this);this.racers=[];this.obstacleGroup=new THREE.Group();this.scene.add(this.obstacleGroup);
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);this.resize();
  }
  /**
   * 卸载。
   *
   * ★ 三样必须显式收：`ResizeObserver`（不摘会继续拿已卸载的容器量尺寸）、
   *   `fx`（`@makeplay/fx` 自己挂了 rAF 与 GL 资源）、以及 **WebGL context**
   *   （`forceContextLoss()` —— 只 `dispose()` 的话上下文留在 GPU 里，
   *   来回切几次游戏就撞浏览器「最多 16 个上下文」的上限，症状是画面全黑零报错）。
   */
  dispose(){
    try{this.resizeObserver?.disconnect();}catch{}
    try{this.fx?.dispose();}catch{}
    this.fx=null;
    try{this.previewHorse?.dispose();}catch{}
    try{this.racers?.forEach(h=>h.dispose());}catch{}
    try{this.renderer?.dispose();}catch{}
    try{this.renderer?.forceContextLoss?.();}catch{}
    try{this.renderer?.domElement?.remove();}catch{}
  }
  async initFx(){const {createThreeFx}=await import('@makeplay/fx');this.fx=await createThreeFx({THREE,renderer:this.renderer,world:this.scene,camera:this.camera,viewport:()=>({width:this.w,height:this.h}),referenceSpan:3});this.fx.post.configure({glow:false,vignette:false,grading:'neutral'});}
  tickFx(realDt){
    if(!this.fx)return 1;
    const scale=this.fx.update(realDt);
    if(this.mode==='result'){
      this.celebrationDelay-=realDt;
      if(this.celebrationDelay<=0){
        const phase=this.celebrationEmissions++;
        const pos=this.awards.group.position.clone().add(new THREE.Vector3(((phase*5)%7-3)*1.6,8,(phase%3-1)*2));
        this.fx.play('confetti-burst',{pos,dir:{x:0,y:-1,z:0},scale:.7,power:.3});
        this.celebrationDelay=.42;
      }
    }
    return scale;
  }
  mat(color){if(!this.materials.has(color))this.materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.85}));return this.materials.get(color);}
  add(parent,geo,color,x,y,z){const m=new THREE.Mesh(geo,this.mat(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  box(p,w,h,d,c,x,y,z){return this.add(p,new THREE.BoxGeometry(w,h,d),c,x,y,z);}
  cylinder(p,r,h,c,x,y,z,n=10){return this.add(p,new THREE.CylinderGeometry(r,r,h,n),c,x,y,z);}
  label(text,w,h,bg='#faf5e7',fg='#253f31',fontSize=55) {
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
    const ctx=canvas.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,512,128);ctx.fillStyle=fg;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`bold ${fontSize}px sans-serif`;ctx.fillText(text,256,67);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));m.userData.ownedTexture=texture;m.userData.labelStyle={bg,fg,fontSize};return m;
  }
  setWinnerLabel(text){
      const mesh=this.awards.title;
      const {bg,fg,fontSize}=mesh.userData.labelStyle,canvas=mesh.material.map.image,ctx=canvas.getContext('2d');
      ctx.fillStyle=bg;ctx.fillRect(0,0,512,128);ctx.fillStyle=fg;ctx.font=`bold ${fontSize}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,67,480);mesh.material.map.needsUpdate=true;
  }
  buildTrack(){
    this.box(this.track,270,.5,72,'#8fac76',103,-.6,0);
    this.box(this.track,234,.28,15,'#cd9270',105,-.23,0);
    for(let i=0;i<4;i++)this.box(this.track,233,.016,3.25,i%2?'#d99e79':'#dea784',105,-.079,LANE[i]);
    for(const z of [-6.8,-3.4,0,3.4,6.8])this.box(this.track,234,.023,.075,'#f9e7c4',105,-.055,z);
    for(const z of [-8.3,8.3]){
      for(let x=-10;x<222;x+=6)this.box(this.track,.16,1.18,.18,'#f7f0d8',x,.53,z);
      this.box(this.track,235,.13,.14,'#f7f0d8',105,.82,z);
    }
    for(let x=0;x<=200;x+=20){
      const sign=this.label(`${x} m`,2.2,.55);sign.position.set(x,.55,9);this.track.add(sign);
    }
    this.finishGate=new THREE.Group();this.track.add(this.finishGate);
    for(const z of [-7.3,7.3])this.box(this.finishGate,.4,6,.45,'#f6edcf',0,2.9,z);
    this.box(this.finishGate,.5,1.15,15.1,'#e6c752',0,6,0);
    const label=this.label('FINISH',5.6,1,'#e6c752');label.rotation.y=-Math.PI/2;label.position.set(-.27,6,0);this.finishGate.add(label);
    for(let i=0;i<16;i++)for(let j=0;j<2;j++)this.box(this.finishGate,.5,.03,.85,(i+j)%2?'#fff9e4':'#385c48',j*.5,.0,-6.375+i*.85);
    buildCountryside(this);
    this.track.visible=false;this.props.visible=false;
  }
  preview(strokes){if(this.previewHorse)this.previewHorse.dispose();this.previewHorse=makeHorse(strokes);this.podium.add(this.previewHorse.root);}
  setMode(mode,race,strokes){
    this.fx?.clear();this.celebrationDelay=0;this.celebrationEmissions=0;
    this.mode=mode;this.track.visible=mode!=='studio';this.props.visible=mode!=='studio';this.podium.visible=mode==='studio';
    this.awards.group.visible=mode!=='studio';
    this.awards.trophy.visible=mode==='result'&&race?.finished===true;
    this.scene.background.set(mode==='studio'?'#bcd4c3':'#c9ded6');this.scene.fog.color.copy(this.scene.background);
    this.obstacleGroup.visible=mode!=='studio';
    if(mode==='race'){
      this.racers.forEach(h=>h.dispose());this.racers=[makeHorse(strokes),...Array.from({length:3},(_,i)=>makeHorse(race.replays?.[i]?race.ghosts[i].strokes:preset(i+1).strokes))];
      this.racers.forEach((h,i)=>{h.root.position.z=LANE[i];this.scene.add(h.root);});
      this.finishGate.position.x=race.length;
      this.awards.group.position.set(race.length-6,0,-14);
      this.obstacleGroup.traverse(o=>o.geometry?.dispose());this.obstacleGroup.clear();
      for(const x of race.obstacles)for(let i=0;i<4;i++){
        this.box(this.obstacleGroup,.16,.65,2.8,'#f9df86',x,.38,LANE[i]);
        this.box(this.obstacleGroup,.18,.16,2.8,'#dd6a46',x,.75,LANE[i]);
        for(const z of [LANE[i]-1.4,LANE[i]+1.4])this.box(this.obstacleGroup,.25,1.05,.25,'#faf0cf',x,.48,z);
      }
    }
    this.racers.forEach(h=>h.root.visible=mode!=='studio');
    if(mode==='result'){
      this.resultCardVisible=true;
      race.ranking.forEach((r,index)=>{const h=this.racers[r.id];if(index<3){h.root.position.copy(this.awards.positions[index+1]).add(this.awards.group.position);h.root.scale.setScalar(.78);}else h.root.visible=false;});
    }
    this.cameraSnap=true;
  }
  resize(){const r=this.container.getBoundingClientRect();this.w=Math.max(1,r.width);this.h=Math.max(1,r.height);this.renderer.setSize(this.w,this.h);this.camera.fov=this.w/this.h>2.1?32:38;this.camera.aspect=this.w/this.h;this.camera.updateProjectionMatrix();this.cameraSnap=true;}
  render(dt,race){
    this.time+=dt;const portrait=this.w/this.h<1;
    if(this.mode==='studio'){
      this.eye.set(6.4,4.3,10);this.look.set(0,1.35,0);
      if(this.previewHorse){this.previewHorse.root.rotation.y=-.3+Math.sin(this.time*.35)*.32;this.previewHorse.animate(this.time,2);}
      this.sun.position.set(-12,30,18);this.sun.target.position.set(0,0,0);
    }else if(race){
      const x=race.player.x;
      this.racers.forEach((h,i)=>{const r=race.horses[i];if(this.mode==='race')h.root.position.set(r.x,0,LANE[i]);h.animate(this.mode==='result'?this.time:race.time,this.mode==='result'?1:r.finish===null?r.speed:1,this.mode==='result'?0:r.jump,this.mode==='result'?0:r.stumble);});
      if(this.view===0){this.eye.set(x-(portrait?3:10),portrait?21:14,portrait?33:24);this.look.set(x+(portrait?1:3),.8,0);}
      else{this.eye.set(x-20,13,15);this.look.set(x+7,1.3,0);}
      if(!portrait&&this.h<480)this.look.set(x+1,.6,3.5);
      this.sun.position.set(x-12,30,18);this.sun.target.position.set(x,0,0);
      if(this.mode==='result'){
        const p=this.awards.group.position;
        this.eye.set(p.x+2,portrait?15:9,p.z+(portrait?48:23));this.look.set(p.x+(portrait||!this.resultCardVisible?0:4),portrait?2.3:2,p.z);
        this.sun.position.set(p.x-12,30,p.z+18);this.sun.target.position.copy(p);
      }
      this.balloons.forEach((g,i)=>{g.position.y=14+i*2+Math.sin(this.time*.35+i)*.4;});
    }
    this.camera.position.lerp(this.eye,this.cameraSnap?1:1-Math.exp(-dt*5));this.camera.lookAt(this.look);this.cameraSnap=false;
    if(this.fx)this.fx.render();else this.renderer.render(this.scene,this.camera);
  }
  diagnostics(){return {celebrationActive:this.mode==='result',celebrationEmissions:this.celebrationEmissions||0,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,width:this.renderer.domElement.width,height:this.renderer.domElement.height};}
}
