import * as THREE from 'three';
import { bridgeStation, facilities, heightAt, land, plotOrigin, spawn } from './terrain';
import type { Pos, SandboxWorld, Target, Voxel } from './types';

export type WorldView = {world:SandboxWorld;positions:Record<string,Pos>;uid:string;yaw:number;pitch:number;mining?:boolean;jump?:number;quality?:'low'|'normal';view?:'first'|'top'|'front'|'side';origin?:boolean};
export type Block = {x:number;y:number;z:number;color:string;target?:Target;colors?:string[]};
const faces = [
 {n:[1,0,0],c:[[1,0,1],[1,0,0],[1,1,0],[1,1,1]],shade:.78},
 {n:[-1,0,0],c:[[0,0,0],[0,0,1],[0,1,1],[0,1,0]],shade:.86},
 {n:[0,1,0],c:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]],shade:1},
 {n:[0,-1,0],c:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]],shade:.5},
 {n:[0,0,1],c:[[0,0,1],[1,0,1],[1,1,1],[0,1,1]],shade:.9},
 {n:[0,0,-1],c:[[1,0,0],[0,0,0],[0,1,0],[1,1,0]],shade:.72},
];
const key=(x:number,y:number,z:number)=>`${x},${y},${z}`;
const noise=(x:number,z:number)=>Math.abs(Math.sin(x*127.1+z*311.7)*43758.5453)%1;
/** One indexed mesh per chunk, with faces between solid cells omitted. Colors replace an asset download. */
export function blockGeometry(blocks:Block[], occupied:(x:number,y:number,z:number)=>boolean) {
 const vertices:number[]=[],normals:number[]=[],colors:number[]=[],indices:number[]=[],targets:(Target|undefined)[]=[];
 for(const b of blocks)faces.forEach((f,fi)=>{
  if(occupied(b.x+f.n[0],b.y+f.n[1],b.z+f.n[2]))return;
  const start=vertices.length/3,color=new THREE.Color(b.colors?.[fi%b.colors.length]||b.color).multiplyScalar(f.shade);
  f.c.forEach(c=>{vertices.push(b.x+c[0],b.y+c[1],b.z+c[2]);normals.push(...f.n);colors.push(color.r,color.g,color.b);});
  indices.push(start,start+1,start+2,start,start+2,start+3);targets.push(b.target);
 });
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeBoundingSphere();g.userData.targets=targets;return g;
}
export function voxelBlocks(voxels:Record<string,Voxel>,config:any,origin=false,offset={x:0,y:0,z:0},island=''):Block[]{
 return Object.entries(voxels).map(([id,v])=>{
  const sources=Object.keys(v.unit.sources||{}),colors=origin?sources.map(s=>config.templates?.find((t:any)=>t.id===s)?.color||'#f0eee1'):undefined;
  return {x:offset.x+v.x,y:offset.y+v.y,z:offset.z+v.z,color:config.goods?.[v.unit.good]?.color||'#c6bda1',colors,
   target:{kind:'voxel',island,id,x:offset.x+v.x,y:offset.y+v.y,z:offset.z+v.z,gridX:v.x,gridY:v.y,gridZ:v.z}};
 });
}
export function createVoxelRenderer(canvas:HTMLCanvasElement,initial:WorldView){
 const low=initial.quality==='low',size=initial.world.config.size;
 const initialPos=initial.positions[initial.uid]||spawn(initial.world,initial.uid),island=initialPos.island;
 const spec=initial.world.config.templates.find((t:any)=>t.id===island)||{name:island,color:'#9abd91'};
 const desert=island==='sahar',forest=island==='hinomi',pale=island==='lumina';
 const renderer=new THREE.WebGLRenderer({canvas,antialias:!low,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,low?1:1.5));renderer.setClearColor('#c3e2ec');renderer.outputColorSpace=THREE.SRGBColorSpace;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#c3e2ec');scene.fog=new THREE.Fog('#c3e2ec',low?55:90,low?140:230);
 const camera=new THREE.PerspectiveCamera(73,1,.045,400),orthographic=new THREE.OrthographicCamera(-40,40,40,-40,.1,500);scene.add(camera);
 scene.add(new THREE.HemisphereLight('#fff8e9','#819b9c',1.65));const sun=new THREE.DirectionalLight('#fff5df',2);sun.position.set(-25,55,28);scene.add(sun);
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
 const geo=<T extends THREE.BufferGeometry>(g:T)=>{geometries.add(g);return g;};const cube=geo(new THREE.BoxGeometry(1,1,1));
 const palette=new Map<string,THREE.MeshLambertMaterial>();
 function material(color:string){if(!palette.has(color)){const m=new THREE.MeshLambertMaterial({color,flatShading:true});palette.set(color,m);materials.add(m);}return palette.get(color)!;}
 const vertexMaterial=new THREE.MeshLambertMaterial({vertexColors:true,flatShading:true});materials.add(vertexMaterial);
 function box(parent:THREE.Object3D,color:string,x:number,y:number,z:number,sx:number,sy:number,sz:number){const m=new THREE.Mesh(cube,material(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;}
 function textLabel(parent:THREE.Object3D,text:string,x:number,y:number,z:number,color='#3d624e',height=.45){
  const c=document.createElement('canvas'),ctx=c.getContext('2d')!;ctx.font='600 26px sans-serif';c.width=Math.ceil(ctx.measureText(text).width+32);c.height=48;
  ctx.fillStyle='rgba(255,255,243,.94)';ctx.beginPath();ctx.roundRect(0,0,c.width,48,10);ctx.fill();ctx.font='600 26px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,c.width/2,25);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;textures.add(texture);const m=new THREE.SpriteMaterial({map:texture,depthTest:true});materials.add(m);const sprite=new THREE.Sprite(m);sprite.scale.set(height*c.width/48,height,1);sprite.position.set(x,y,z);parent.add(sprite);
 }
 function clear(group:THREE.Group){group.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();if(o instanceof THREE.Mesh&&o.geometry!==cube){o.geometry.dispose();geometries.delete(o.geometry);}if(o instanceof THREE.Sprite){if(o.material.map){o.material.map.dispose();textures.delete(o.material.map);}o.material.dispose();materials.delete(o.material);}});group.clear();}
 // Terrain stores just a height field. Interior stone and neighboring chunk faces never reach the GPU.
 const heights=Array.from({length:size},(_,z)=>Array.from({length:size},(_,x)=>heightAt(size,x,z)));
 const occupied=(x:number,y:number,z:number)=>x>=0&&z>=0&&x<size&&z<size&&y>=-3&&y<heights[z][x];
 const chunks=new THREE.Group();scene.add(chunks);
 for(let cz=0;cz<size;cz+=16)for(let cx=0;cx<size;cx+=16){
  const blocks:Block[]=[];
  for(let z=cz;z<Math.min(size,cz+16);z++)for(let x=cx;x<Math.min(size,cx+16);x++){
   const h=heights[z][x];if(h<0)continue;
   const edge=!land(size,x-2,z)||!land(size,x+2,z)||!land(size,x,z-2)||!land(size,x,z+2);
   for(let y=-3;y<h;y++){
    const top=y===h-1;
    const base=top?(edge?'#dcc995':desert?'#dac28b':forest?'#8db18a':pale?'#adcbb3':'#acc88d'):y>=h-3?'#aa9270':'#8a9b99';
    const color=new THREE.Color(base).offsetHSL(0,0,(noise(x,z)-.5)*.045).getStyle();blocks.push({x,y,z,color});
   }
  }
  const g=geo(blockGeometry(blocks,occupied)),mesh=new THREE.Mesh(g,vertexMaterial);chunks.add(mesh);
 }
 const waterMaterial=new THREE.MeshBasicMaterial({color:'#91c8d5'});materials.add(waterMaterial);const ocean=new THREE.Mesh(cube,waterMaterial);ocean.position.set(size/2,-.62,size/2);ocean.scale.set(size*9,.08,size*9);scene.add(ocean);
 const foam=new THREE.Group();scene.add(foam);for(let i=0;i<40;i++){const x=noise(i,21)*(size+25)-12,z=noise(i,43)*(size+25)-12;if(!land(size,Math.floor(x),Math.floor(z)))box(foam,'#d6eeec',x,-.56,z,.7+noise(i,12)*1.5,.025,.14);}
 const clouds=new THREE.Group();scene.add(clouds);for(let i=0;i<(low?8:18);i++){const x=noise(i,51)*size*5-size*2,z=noise(i,69)*size*5-size*2;box(clouds,'#f5f5e7',x,18+noise(i,67)*7,z,7+noise(i,61)*12,1.3,4+noise(i,85)*6);}
 // The two adjacent nations use coarse land silhouettes; active terrain is the only detailed 64x64 mesh.
 const neighboring=Object.values(initial.world.bridges).filter(b=>b.a===island||b.b===island);
 neighboring.forEach(b=>{
  const right=b.a===island,other=right?b.b:b.a,otherSpec=initial.world.config.templates.find((t:any)=>t.id===other),offset=right?size+25:-(size+25);
  const g=new THREE.Group();g.position.x=offset;scene.add(g);
  box(g,'#a58f71',size/2,-.8,size/2,size-8,3.4,size-8);box(g,other==='sahar'?'#dac28b':other==='hinomi'?'#8db18a':'#acc88d',size/2,1.05,size/2,size-8,.3,size-8);
  for(let i=0;i<12;i++){const x=9+noise(i,other.length)* (size-18),z=9+noise(i,9)*(size-18);box(g,'#76997e',x,3,z,2.2,3.5,2.2);}
  textLabel(g,otherSpec?.name||other,size/2,10,size/2,'#4b7269',3);batch(g);
 });
 const decorative=new THREE.Group();scene.add(decorative);
 // A block arch marks the mine entrance on the hill; collision heights remain authoritative terrain data.
 const caveX=Math.floor(size*.22),caveZ=Math.floor(size*.24),caveY=heightAt(size,caveX,caveZ);
 box(decorative,'#7f8e8d',caveX-1.1,caveY+1.1,caveZ,1,2.2,1.5);box(decorative,'#899792',caveX+1.1,caveY+1.1,caveZ,1,2.2,1.5);box(decorative,'#9ca69b',caveX,caveY+2.4,caveZ,3.2,.8,1.6);box(decorative,'#3e5658',caveX,caveY+.95,caveZ-.56,1.5,1.9,.12);textLabel(decorative,'광산 입구',caveX,caveY+3.1,caveZ,'#58716c',.55);
 // Static meshes share a palette and become instanced draw calls.
 function batch(group:THREE.Group){const groups=new Map<string,THREE.Mesh[]>();for(const o of group.children){if(o instanceof THREE.Mesh&&o.geometry===cube){const k=(o.material as THREE.Material).uuid,list=groups.get(k)||[];list.push(o);groups.set(k,list);}}for(const list of groups.values()){if(list.length<2)continue;const m=new THREE.InstancedMesh(cube,list[0].material,list.length);list.forEach((o,i)=>{o.updateMatrix();m.setMatrixAt(i,o.matrix);group.remove(o);});group.add(m);}}
 batch(foam);batch(clouds);batch(decorative);
 function batchResources(group:THREE.Group){
  group.updateMatrixWorld(true);const groups=new Map<string,{mesh:THREE.Mesh;target:Target}[]>();
  group.children.forEach(root=>root.traverse(o=>{if(o instanceof THREE.Mesh){const k=(o.material as THREE.Material).uuid,list=groups.get(k)||[];list.push({mesh:o,target:root.userData.target});groups.set(k,list);}}));
  group.clear();for(const list of groups.values()){const m=new THREE.InstancedMesh(cube,list[0].mesh.material,list.length);m.userData.instanceTargets=list.map(o=>o.target);list.forEach((o,i)=>m.setMatrixAt(i,o.mesh.matrixWorld));group.add(m);}
 }
 const stations=new THREE.Group(),resources=new THREE.Group(),structure=new THREE.Group(),avatars=new THREE.Group(),bridgeModels=new THREE.Group();scene.add(stations,resources,structure,avatars,bridgeModels);
 const pickables:THREE.Object3D[]=[stations,resources,structure,bridgeModels];
 const targetGroup=(parent:THREE.Group,target:Target)=>{const g=new THREE.Group();g.userData.target=target;g.position.set(target.x+.5,target.y,target.z+.5);parent.add(g);return g;};
 const stationPositions=facilities(size);
 for(const [kind,p]of Object.entries(stationPositions)){
  const y=heightAt(size,p.x,p.z),g=targetGroup(stations,{kind:kind as Target['kind'],island,x:p.x,y,z:p.z});
  if(kind==='warehouse'){
   box(g,'#a77d51',0,.55,0,1.65,1.1,1.35);box(g,'#e0b67f',0,1.14,0,1.8,.15,1.5);box(g,'#6d827b',0,.56,.688,.11,1.03,.035);box(g,'#d0a06b',0,.2,.71,1.57,.16,.05);box(g,'#f2e1b2',.33,.69,.727,.24,.24,.04);
  }else if(kind==='workbench'){
   for(const x of[-.62,.62])for(const z of[-.38,.38])box(g,'#84684c',x,.43,z,.14,.86,.14);
   box(g,'#caa577',0,.9,0,1.55,.19,1.1);box(g,'#859a9d',.2,1.08,0,.65,.22,.39);box(g,'#d8bd8a',-.4,1.12,.13,.13,.3,.32);
  }else{
   for(const x of[-.5,.5])box(g,'#aa916f',x,.85,0,.12,1.7,.12);
   box(g,'#e0ebd5',0,1.44,0,1.3,1.0,.13);for(let i=0;i<3;i++)box(g,'#8ca4a0',-.33+i*.33,1.44,.08,.025,.8,.018);for(let i=0;i<3;i++)box(g,'#8ca4a0',0,1.13+i*.28,.08,1.1,.025,.018);
  }
  textLabel(g,kind==='warehouse'?'공동 창고':kind==='workbench'?'가공 작업대':'랜드마크 설계판',0,kind==='blueprint'?2.3:1.65,0,'#456756',.48);
 }
 const plot=plotOrigin(size),plotSize=initial.world.stage>=3?(initial.world.config.freePlot?.size||16):(initial.world.config.plot?.size||5);
 const pad=box(stations,'#d6d9bd',plot.x+plotSize/2,1.005,plot.z+plotSize/2,plotSize,.018,plotSize);pad.userData.plot=true;
 const lines=new THREE.Group();scene.add(lines);for(let i=0;i<=plotSize;i++){box(lines,'#faf5da',plot.x+i,1.022,plot.z+plotSize/2,.032,.016,plotSize);box(lines,'#faf5da',plot.x+plotSize/2,1.024,plot.z+i,plotSize,.016,.032);}batch(lines);
 textLabel(lines,'앞  FRONT',plot.x+plotSize/2,1.1,plot.z+plotSize+.8,'#756b4d',.5);
 const held=new THREE.Group();camera.add(held);held.position.set(.37,-.35,-.65);held.rotation.z=-.22;
 box(held,'#ebc8a5',0,-.12,.03,.14,.27,.16);
 const heldHandle=box(held,'#99704c',0,.12,0,.06,.52,.06),heldHead=box(held,'#b7cbd0',0,.4,0,.4,.09,.09),heldTip=box(held,'#8da5a7',-.17,.35,0,.065,.15,.09);
 held.traverse(o=>{if(o instanceof THREE.Mesh){const m=new THREE.MeshBasicMaterial({color:(o.material as THREE.MeshLambertMaterial).color,depthTest:false,depthWrite:false});materials.add(m);o.material=m;o.renderOrder=20;}});
 const selection=new THREE.Box3Helper(new THREE.Box3(new THREE.Vector3(),new THREE.Vector3(1,1,1)),new THREE.Color('#fff4a7'));scene.add(selection);materials.add(selection.material as THREE.Material);geometries.add(selection.geometry);
 let nodeSignature='',voxelSignature='',playersSignature='',bridgeSignature='',lastWidth=0,lastHeight=0,lastTime=0,disposed=false;
 const avatarGroups=new Map<string,THREE.Group>(),nodeGroups=new Map<string,THREE.Group>();
 const eye=new THREE.Vector3(initialPos.x+.5,initialPos.y+1.55,initialPos.z+.5);let latest=initial,activeCamera:THREE.Camera=camera;
 function node(n:any){
  const g=targetGroup(resources,{kind:'resource',island,id:n.id,x:n.x,y:n.y,z:n.z});nodeGroups.set(n.id,g);const color=initial.world.config.goods[n.good]?.color||'#b8b6a2';
  if(n.good==='wood'){
   box(g,'#97724e',0,.85,0,.4,1.7,.4);box(g,forest?'#58896d':'#71996b',0,1.78,0,1.6,1.1,1.5);box(g,'#92b57b',-.05,2.43,0,1.12,.55,1.05);
  }else if(n.good==='cotton'){
   box(g,'#839655',0,.3,0,.12,.6,.12);box(g,'#e9ecdc',-.22,.63,.06,.42,.42,.42);box(g,'#fff8e9',.19,.77,-.1,.43,.44,.44);box(g,'#c4cf9c',.05,.3,.17,.48,.13,.32);
  }else if(n.good==='oil'){
   box(g,'#364a56',0,.43,0,.65,.86,.62);box(g,'#b6a579',0,.5,.324,.67,.14,.035);box(g,'#677e84',0,.9,0,.7,.07,.66);box(g,'#263e48',.1,.96,.12,.17,.07,.16);
  }else if(n.good==='sand'){
   box(g,'#e7d198',0,.15,0,.93,.3,.86);box(g,'#f2e1b1',-.08,.38,0,.55,.19,.6);
  }else{
   box(g,color,-.12,.36,0,.71,.72,.68);box(g,new THREE.Color(color).offsetHSL(0,-.03,.13).getStyle(),.29,.22,.17,.4,.44,.48);
   if(n.good==='iron'||n.good==='copper'){box(g,'#c69b78',-.15,.55,.351,.22,.15,.023);box(g,'#e4b18a',.13,.735,-.12,.2,.025,.18);}
   else if(n.good!=='stone'){box(g,'#f8ebc5',-.13,.73,.07,.23,.1,.23);}
  }
 }
 function rebuildBridges(w:SandboxWorld){
  clear(bridgeModels);for(const b of Object.values(w.bridges).filter(b=>b.a===island||b.b===island)){
   const p=bridgeStation(w,island,b.id),right=b.a===island,g=targetGroup(bridgeModels,{kind:'bridge',island,bridgeId:b.id,id:b.id,x:p.x,y:1,z:p.z});
   box(g,'#caa574',0,.13,0,1.7,.25,2);box(g,'#927556',0,1,-.78,.13,2,.13);box(g,spec.color,.44,1.72,-.78,.8,.48,.06);textLabel(g,'이웃 섬으로 · 다리',0,2.38,0,'#486d65',.55);
   const halves=b.halves||{},needs=w.config.bridge?.needs||w.config.bridge||w.config.bridgeNeeds||{plank:6,stone:4};
   const ratio=(id:string)=>{const half=halves[id]||{};const have=Object.values(half).reduce((n,a)=>n+(Array.isArray(a)?a.length:0),0);const need=Object.values(needs).reduce<number>((n,a)=>n+Number(a),0)||10;return Math.min(1,have/need);};
   const own=ratio(island),other=ratio(right?b.b:b.a),length=25+10;
   for(let i=0;i<length;i++){
    const fromOwn=i<length/2,built=fromOwn?i<Math.ceil(own*length/2):(length-1-i)<Math.ceil(other*length/2),x=(right?1:-1)*(2+i);
    if(built){box(g,fromOwn?'#c7a172':'#b8c2aa',x,.02,0,.98,.22,2);if(i%4===0)for(const z of[-.85,.85])box(g,'#8f8169',x,-.85,z,.2,1.6,.2);}
    else if(i%3===0)box(g,'#bad6cc',x,-.12,0,.16,.035,1.6);
   }
   if(own===1&&other===1){const x=(right?1:-1)*length/2;box(g,'#e6c596',x,.75,0,1.7,1.4,1.65);box(g,'#7a9d8b',x,1.6,0,2.1,.2,2);textLabel(g,'교역소',x,2.15,0);}
  }
 }
 function resize(){const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);if(w===lastWidth&&h===lastHeight)return;lastWidth=w;lastHeight=h;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
 const raycaster=new THREE.Raycaster();let aim:Target|null=null;
 function pick(){
  raycaster.far=latest.view&&latest.view!=='first'?250:6;raycaster.setFromCamera(new THREE.Vector2(0,0),activeCamera);
  // Terrain participates as an occluder, so rocks or construction cannot be selected through a hill.
  const hits=raycaster.intersectObjects([...pickables,chunks],true);
  for(const hit of hits){
   if(hit.object.parent===chunks)return null;
   if(hit.instanceId!==undefined&&hit.object.userData.instanceTargets)return hit.object.userData.instanceTargets[hit.instanceId] as Target;
   const geometry=(hit.object as THREE.Mesh).geometry;
   if(geometry?.userData.targets&&hit.faceIndex!==undefined){const target=geometry.userData.targets[Math.floor(hit.faceIndex/2)] as Target|undefined;if(target)return target;}
   if(hit.object.userData.plot){const gx=Math.floor(hit.point.x-plot.x),gz=Math.floor(hit.point.z-plot.z);if(gx>=0&&gz>=0&&gx<plotSize&&gz<plotSize)return{kind:'plot',island,x:plot.x+gx,y:1,z:plot.z+gz,gridX:gx,gridY:0,gridZ:gz};}
   let o:THREE.Object3D|null=hit.object;while(o){if(o.userData.target)return o.userData.target;o=o.parent;}
  }return null;
 }
 return {
  draw(view:WorldView,time:number){
   if(disposed)return null;latest=view;resize();const w=view.world,nation=w.nations[island];if(!nation)return null;const dt=Math.min(.1,(time-lastTime)/1000||.033);lastTime=time;
   const now=Date.now(),activeNodes=Object.values(nation.nodes).filter(n=>n.readyAt<=now),ns=JSON.stringify(activeNodes);
   if(ns!==nodeSignature){clear(resources);nodeGroups.clear();activeNodes.forEach(node);batchResources(resources);nodeSignature=ns;}
   const vs=JSON.stringify(nation.voxels)+view.origin;
   if(vs!==voxelSignature){clear(structure);const blocks=voxelBlocks(nation.voxels,w.config,view.origin,{x:plot.x,y:1,z:plot.z},island),set=new Set(blocks.map(b=>key(b.x,b.y,b.z)));if(blocks.length)structure.add(new THREE.Mesh(geo(blockGeometry(blocks,(x,y,z)=>set.has(key(x,y,z)))),vertexMaterial));voxelSignature=vs;}
   const bs=JSON.stringify(w.bridges);if(bs!==bridgeSignature){rebuildBridges(w);bridgeSignature=bs;}
   const players=Object.values(w.players).filter(p=>(p.location||p.nation)===island&&p.id!==view.uid),ps=JSON.stringify(players.map(p=>[p.id,p.nickname,p.nation]));
   if(ps!==playersSignature){clear(avatars);avatarGroups.clear();for(const p of players){const g=new THREE.Group();avatars.add(g);avatarGroups.set(p.id,g);const color=w.config.templates.find((t:any)=>t.id===p.nation)?.color||'#7cab9c';box(g,'#526970',-.16,.3,0,.23,.6,.29);box(g,'#526970',.16,.3,0,.23,.6,.29);box(g,color,0,.94,0,.63,.69,.37);box(g,'#ebc9a7',0,1.49,0,.48,.43,.45);box(g,'#6d6658',0,1.74,-.02,.53,.12,.48);textLabel(g,p.nickname,0,2.13,0,'#46675e',.4);}playersSignature=ps;}
   for(const[id,g]of avatarGroups){const reported=view.positions[id],p=reported?.island===island?reported:spawn(w,id),t=new THREE.Vector3(p.x+.5,p.y,p.z+.5);if(!g.userData.placed){g.position.copy(t);g.userData.placed=true;}else g.position.lerp(t,1-Math.exp(-dt*12));}
   const p=view.positions[view.uid]||spawn(w,view.uid),desired=new THREE.Vector3(p.x+.5,p.y+1.55+(view.jump||0),p.z+.5);eye.lerp(desired,1-Math.exp(-dt*18));camera.position.copy(eye);camera.rotation.set(THREE.MathUtils.clamp(view.pitch,-1.4,1.4),view.yaw,0,'YXZ');camera.updateMatrixWorld();
   const mode=view.view||'first',overview=mode!=='first';activeCamera=overview?orthographic:camera;held.visible=!overview;clouds.visible=!overview;
   if(overview){const full=mode==='top'&&!w.players[view.uid],aspect=lastWidth/lastHeight,half=(full?size*.57:Math.max(4,plotSize*.85))/Math.min(1,aspect);orthographic.left=-half*aspect;orthographic.right=half*aspect;orthographic.top=half;orthographic.bottom=-half;const c=full?new THREE.Vector3(size/2,0,size/2):new THREE.Vector3(plot.x+plotSize/2,2,plot.z+plotSize/2);orthographic.position.copy(c).add(mode==='top'?new THREE.Vector3(0,90,.001):mode==='front'?new THREE.Vector3(0,0,35):new THREE.Vector3(-35,0,0));orthographic.lookAt(c);orthographic.updateProjectionMatrix();orthographic.updateMatrixWorld();scene.fog=null;}else scene.fog=new THREE.Fog('#c3e2ec',low?55:90,low?140:230);
   const tools=w.players[view.uid]?.tools||{},tool=tools.pickaxe?'pickaxe':tools.axe?'axe':'hand';heldHandle.visible=tool!=='hand';heldHead.visible=tool!=='hand';heldTip.visible=tool==='pickaxe';heldHead.scale.set(tool==='axe'?.23:.4,tool==='axe'?.24:.09,.09);heldHead.position.x=tool==='axe'?-.07:0;canvas.dataset.tool=tool;
   held.rotation.x=view.mining?-.45+Math.sin(time*.023)*.65:-.1;held.rotation.z=view.mining?-.22+Math.sin(time*.023)*.17:-.22;held.position.y=-.35+Math.sin(time*.003)*.006;
   renderer.render(scene,activeCamera);aim=pick();selection.visible=!!aim&&!overview;
   if(aim){const h=aim.kind==='resource'?1:1;selection.box.min.set(aim.x-.015,aim.y-.015,aim.z-.015);selection.box.max.set(aim.x+1.015,aim.y+h+.015,aim.z+1.015);selection.updateMatrixWorld();}
   canvas.dataset.renderer='webgl';canvas.dataset.view=mode;canvas.dataset.aim=JSON.stringify(aim);canvas.dataset.drawCalls=String(renderer.info.render.calls);canvas.dataset.triangles=String(renderer.info.render.triangles);return aim;
  },
  dispose(){disposed=true;scene.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();if(!canvas.isConnected)renderer.forceContextLoss();}
 };
}
