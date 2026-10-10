import {mineEntrance,mineExit,mineFloor,mineLand,minePillar} from './terrain';
import {animalPose,animalRoutes,type AnimalKind} from './animals';
import {farmSites,farmKey,cropMature} from './farming';
import * as THREE from 'three';
import { bridgeStation, facilities, heightAt, land, plotOrigin, spawn, groundHeight } from './terrain';
import type { Pos, SandboxWorld, Target, Voxel } from './types';

export type WorldView = {world:SandboxWorld;positions:Record<string,Pos>;uid:string;yaw:number;pitch:number;timeNow?:()=>number;mining?:boolean;eating?:boolean;heldGood?:string;impact?:{seq:number;at:number;target:Target};jump?:number;quality?:'low'|'normal';view?:'first'|'top'|'front'|'side';origin?:boolean};
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
 const vertices:number[]=[],normals:number[]=[],colors:number[]=[],uvs:number[]=[],indices:number[]=[],targets:(Target|undefined)[]=[];
 for(const b of blocks)faces.forEach((f,fi)=>{
  if(occupied(b.x+f.n[0],b.y+f.n[1],b.z+f.n[2]))return;
  const start=vertices.length/3,color=new THREE.Color(b.colors?.[fi%b.colors.length]||b.color).multiplyScalar(f.shade);
  f.c.forEach(c=>{vertices.push(b.x+c[0],b.y+c[1],b.z+c[2]);normals.push(...f.n);colors.push(color.r,color.g,color.b);uvs.push(f.n[1]?c[0]:f.n[0]?c[2]:c[0],f.n[1]?c[2]:c[1]);});
  indices.push(start,start+1,start+2,start,start+2,start+3);targets.push(b.target);
 });
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeBoundingSphere();g.userData.targets=targets;return g;
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
 const initialPos=initial.positions[initial.uid]||spawn(initial.world,initial.uid),island=initialPos.island,zone=initialPos.zone||'surface',underground=zone==='mine';
 const spec=initial.world.config.templates.find((t:any)=>t.id===island)||{name:island,color:'#9abd91'};
 const desert=island==='sahar',forest=island==='hinomi',pale=island==='lumina';
 const renderer=new THREE.WebGLRenderer({canvas,antialias:!low,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,low?1:1.5));renderer.setClearColor(underground?'#182329':'#c3e2ec');renderer.outputColorSpace=THREE.SRGBColorSpace;
 const scene=new THREE.Scene();scene.background=new THREE.Color(underground?'#182329':'#c3e2ec');scene.fog=new THREE.Fog(underground?'#182329':'#c3e2ec',underground?14:low?55:90,underground?48:low?140:230);
 const camera=new THREE.PerspectiveCamera(73,1,.045,400),orthographic=new THREE.OrthographicCamera(-40,40,40,-40,.1,500);scene.add(camera);
 scene.add(new THREE.HemisphereLight('#fff8e9','#819b9c',underground?.75:1.65));const sun=new THREE.DirectionalLight('#fff5df',underground?.7:2);sun.position.set(-25,55,28);scene.add(sun);
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
 const geo=<T extends THREE.BufferGeometry>(g:T)=>{geometries.add(g);return g;};const cube=geo(new THREE.BoxGeometry(1,1,1));
 const palette=new Map<string,THREE.MeshLambertMaterial>();
 function material(color:string){if(!palette.has(color)){const m=new THREE.MeshLambertMaterial({color,flatShading:true});palette.set(color,m);materials.add(m);}return palette.get(color)!;}
 // minecraft-threejs uses nearest-neighbor block textures. Generate our own
 // 16-pixel pattern here: no Minecraft or third-party texture files are shipped.
 const pixelCanvas=document.createElement('canvas');pixelCanvas.width=16;pixelCanvas.height=16;
 const pixelContext=pixelCanvas.getContext('2d')!;
 for(let py=0;py<16;py++)for(let px=0;px<16;px++){
  const n=noise(px,py),light=Math.round(225+n*30);pixelContext.fillStyle=`rgb(${light},${light},${light})`;pixelContext.fillRect(px,py,1,1);
 }
 const pixelTexture=new THREE.CanvasTexture(pixelCanvas);pixelTexture.magFilter=THREE.NearestFilter;pixelTexture.minFilter=THREE.NearestFilter;pixelTexture.colorSpace=THREE.SRGBColorSpace;textures.add(pixelTexture);
 const vertexMaterial=new THREE.MeshLambertMaterial({vertexColors:true,flatShading:true,map:pixelTexture});materials.add(vertexMaterial);
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
 function rebuildTerrain(w:SandboxWorld){clear(chunks);for(let z=0;z<size;z++)for(let x=0;x<size;x++)heights[z][x]=groundHeight(w,island,x,z);
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
 }}
 if(underground){
  const w=initial.world,m=w.config.mine.margin,floor=mineFloor(w),ceiling=w.config.mine.ceiling,blocks:Block[]=[];const lamp=new THREE.PointLight('#ffe2b8',6,16,1.4);camera.add(lamp);
  const solid=(x:number,y:number,z:number)=>x>=m&&z>=m&&x<=size-m&&z<=size-m&&(y===floor-1||y===ceiling||((x===m||z===m||x===size-m||z===size-m||minePillar(w,x,z))&&y>=floor&&y<ceiling));
  for(let z=m;z<=size-m;z++)for(let x=m;x<=size-m;x++)for(let y=floor-1;y<=ceiling;y++)if(solid(x,y,z))blocks.push({x,y,z,color:y===floor-1?'#657374':y===ceiling?'#35454c':((x+z+y)%3?'#50616a':'#667778')});
  chunks.add(new THREE.Mesh(geo(blockGeometry(blocks,solid)),vertexMaterial));
  for(let z=m+5;z<size-m;z+=12)for(let x=m+5;x<size-m;x+=12){box(chunks,'#e7b95f',x,floor+4,z,.32,.3,.32);}
 }
 const waterMaterial=new THREE.MeshBasicMaterial({color:'#91c8d5'});materials.add(waterMaterial);const ocean=new THREE.Mesh(cube,waterMaterial);ocean.position.set(size/2,-.62,size/2);ocean.scale.set(size*9,.08,size*9);scene.add(ocean);ocean.visible=!underground;
 const foam=new THREE.Group();scene.add(foam);foam.visible=!underground;for(let i=0;i<40;i++){const x=noise(i,21)*(size+25)-12,z=noise(i,43)*(size+25)-12;if(!land(size,Math.floor(x),Math.floor(z)))box(foam,'#d6eeec',x,-.56,z,.7+noise(i,12)*1.5,.025,.14);}
 const clouds=new THREE.Group();scene.add(clouds);for(let i=0;i<(low?8:18);i++){const x=noise(i,51)*size*5-size*2,z=noise(i,69)*size*5-size*2;box(clouds,'#f5f5e7',x,18+noise(i,67)*7,z,7+noise(i,61)*12,1.3,4+noise(i,85)*6);}
 // Adjacent nations use coarse land silhouettes; only the active island has detailed terrain.
 const neighboring=Object.values(initial.world.bridges).filter(b=>b.a===island||b.b===island);
 if(!underground)neighboring.forEach(b=>{
  const right=b.a===island,other=right?b.b:b.a,otherSpec=initial.world.config.templates.find((t:any)=>t.id===other),offset=right?size+25:-(size+25);
  const g=new THREE.Group();g.position.x=offset;scene.add(g);
  box(g,'#a58f71',size/2,-.8,size/2,size-8,3.4,size-8);box(g,other==='sahar'?'#dac28b':other==='hinomi'?'#8db18a':'#acc88d',size/2,1.05,size/2,size-8,.3,size-8);
  for(let i=0;i<12;i++){const x=9+noise(i,other.length)* (size-18),z=9+noise(i,9)*(size-18);box(g,'#76997e',x,3,z,2.2,3.5,2.2);}
  textLabel(g,otherSpec?.name||other,size/2,10,size/2,'#4b7269',3);batch(g);
 });
 const decorative=new THREE.Group();scene.add(decorative);
 if(!underground){
 const entrance=mineEntrance(size),caveX=entrance.x+.5,caveZ=entrance.z+.5,caveY=heightAt(size,entrance.x,entrance.z);
 decorative.userData.target={kind:'mineEntrance',island,...entrance,y:caveY,zone:'surface'};
 box(decorative,'#7f8e8d',caveX-1.1,caveY+1.1,caveZ,1,2.2,1.5);box(decorative,'#899792',caveX+1.1,caveY+1.1,caveZ,1,2.2,1.5);box(decorative,'#9ca69b',caveX,caveY+2.4,caveZ,3.2,.8,1.6);box(decorative,'#1b2934',caveX,caveY+.95,caveZ-.56,1.5,1.9,.12);textLabel(decorative,'광산 입구 · 걸어서 내려가기',caveX,caveY+3.1,caveZ,'#58716c',.55);
 }else{
 const e=mineExit(initial.world),y=mineFloor(initial.world);decorative.userData.target={kind:'mineExit',island,...e,y,zone:'mine'};
 for(const dx of[-1.1,1.1])box(decorative,'#bb945c',e.x+.5+dx,y+1.5,e.z+.5,.35,3,.5);
 box(decorative,'#c7a778',e.x+.5,y+3,e.z+.5,2.55,.3,.5);box(decorative,'#d7e6c8',e.x+.5,y+1.3,e.z+1,1.8,2.6,.15);
 textLabel(decorative,'지상 출구 · 빛을 향해 걸어가기',e.x+.5,y+3.5,e.z+.5,'#486342',.65);
 for(let i=0;i<3;i++)box(decorative,'#8d9995',e.x+.5,y+i*.3,e.z+.5+i*.35,1.5,.3,.35);
 }
 // Static meshes share a palette and become instanced draw calls.
 function batch(group:THREE.Group){const groups=new Map<string,THREE.Mesh[]>();for(const o of group.children){if(o instanceof THREE.Mesh&&o.geometry===cube){const k=(o.material as THREE.Material).uuid,list=groups.get(k)||[];list.push(o);groups.set(k,list);}}for(const list of groups.values()){if(list.length<2)continue;const m=new THREE.InstancedMesh(cube,list[0].material,list.length);list.forEach((o,i)=>{o.updateMatrix();m.setMatrixAt(i,o.matrix);group.remove(o);});group.add(m);}}
 batch(foam);batch(clouds);batch(decorative);
 const animalGroup=new THREE.Group();scene.add(animalGroup);
 const creatureRoutes=underground?[]:animalRoutes(initial.world,island),creatures=new Map<string,THREE.Group>();
 function animalModel(kind:AnimalKind){
  const g=new THREE.Group(),part=(color:string,x:number,y:number,z:number,sx:number,sy:number,sz:number)=>box(g,color,x,y,z,sx,sy,sz);
  const legs=(color:string,wide:number,long:number,h:number)=>{for(const x of[-wide,wide])for(const z of[-long,long])part(color,x,h/2,z,.18,h,.18);};
  if(kind==='sheep'){
   legs('#524d49',.35,.42,.57);part('#e9e8d9',0,.96,0,1.18,.91,1.35);part('#f7f4e8',0,1.24,0,1.3,.48,1.15);
   part('#77716d',0,1.04,.78,.55,.56,.56);part('#554f4e',0,1.13,1.075,.32,.26,.07);
   for(const x of[-.19,.19])part('#202a30',x,1.22,1.075,.075,.075,.04);
  }else if(kind==='camel'){
   legs('#a67b4b',.38,.53,1.06);part('#caa16a',0,1.36,0,1.22,.7,1.55);part('#b78b56',0,1.88,-.25,.68,.62,.56);
   part('#caa16a',0,1.82,.68,.42,1.08,.43);part('#caa16a',0,2.29,.94,.55,.38,.68);
   for(const x of[-.18,.18]){part('#836143',x,2.47,.8,.09,.22,.1);part('#27313b',x,2.36,1.29,.07,.07,.035);}
  }else if(kind==='deer'){
   legs('#8d6848',.28,.43,.88);part('#a87a50',0,1.07,0,.9,.58,1.27);part('#c8ae87',0,.9,.68,.5,.32,.43);
   part('#a87a50',0,1.49,.49,.4,.73,.42);part('#a87a50',0,1.75,.72,.52,.42,.6);
   for(const x of[-.19,.19]){part('#342e28',x,1.8,1.035,.065,.065,.04);part('#c7b18e',x,2.18,.55,.1,.63,.1);part('#c7b18e',x*1.65,2.4,.55,.36,.09,.09);}
  }else if(kind==='goat'){
   legs('#777d79',.31,.41,.69);part('#e1d8bf',0,.99,0,1.05,.7,1.26);part('#e8e0cc',0,1.2,.7,.56,.59,.57);
   part('#9a9588',0,.85,1.01,.25,.36,.19);for(const x of[-.2,.2]){part('#c2baa5',x,1.66,.58,.12,.44,.13);part('#242c32',x,1.27,1.01,.07,.07,.035);}
  }else if(kind==='rabbit'){
   part('#a28768',0,.32,0,.65,.49,.9);part('#b59b79',0,.51,.48,.54,.43,.5);part('#eee4d4',0,.34,-.5,.31,.32,.29);
   for(const x of[-.16,.16]){part('#a28768',x,.94,.38,.17,.67,.18);part('#d4a59d',x,.98,.48,.08,.42,.03);part('#28313a',x,.57,.76,.06,.06,.035);}
  }else{
   for(const x of[-.32,.32])for(const z of[-.26,.26])part('#729e58',x,.22,z,.23,.31,.24);
   part('#7fac65',0,.35,0,.91,.43,.77);part('#89b875',0,.58,.34,.76,.29,.53);
   for(const x of[-.23,.23]){part('#e9ead4',x,.78,.58,.22,.24,.21);part('#263637',x,.8,.71,.09,.11,.04);}
  }
  batch(g);return g;
 }
 for(const route of creatureRoutes){const g=animalModel(route.kind);g.userData.animal=route.name;g.userData.target={kind:'animal',island,id:route.id,x:route.cx,y:1,z:route.cz};animalGroup.add(g);creatures.set(route.id,g);textLabel(g,route.name,0,route.kind==='camel'?2.9:route.kind==='deer'?2.7:route.kind==='rabbit'||route.kind==='frog'?1.45:2.05,0,'#405a4b',.34);}
 function batchResources(group:THREE.Group){
  group.updateMatrixWorld(true);const groups=new Map<string,{mesh:THREE.Mesh;target:Target}[]>();
  group.children.forEach(root=>root.traverse(o=>{if(o instanceof THREE.Mesh){const k=(o.material as THREE.Material).uuid,list=groups.get(k)||[];list.push({mesh:o,target:root.userData.target});groups.set(k,list);}}));
  group.clear();for(const list of groups.values()){const m=new THREE.InstancedMesh(cube,list[0].mesh.material,list.length);m.userData.instanceTargets=list.map(o=>o.target);list.forEach((o,i)=>m.setMatrixAt(i,o.mesh.matrixWorld));group.add(m);}
 }
 const stations=new THREE.Group(),resources=new THREE.Group(),damage=new THREE.Group(),farms=new THREE.Group(),structure=new THREE.Group(),freeStructure=new THREE.Group(),avatars=new THREE.Group(),bridgeModels=new THREE.Group();scene.add(stations,resources,damage,farms,structure,freeStructure,avatars,bridgeModels);
 const pickables:THREE.Object3D[]=[stations,resources,farms,animalGroup,avatars,structure,freeStructure,bridgeModels,decorative];
 const targetGroup=(parent:THREE.Group,target:Target)=>{const g=new THREE.Group();g.userData.target=target;g.position.set(target.x+.5,target.y,target.z+.5);parent.add(g);return g;};
 const stationPositions=facilities(size);
 if(!underground)for(const [kind,p]of Object.entries(stationPositions)){
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
 const plot=plotOrigin(size),plotSize=initial.world.config.plot?.size||5;
 const pad=box(stations,'#d6d9bd',plot.x+plotSize/2,1.005,plot.z+plotSize/2,plotSize,.018,plotSize);pad.userData.plot=true;pad.visible=!underground;
 const lines=new THREE.Group();scene.add(lines);lines.visible=!underground;for(let i=0;i<=plotSize;i++){box(lines,'#faf5da',plot.x+i,1.022,plot.z+plotSize/2,.032,.016,plotSize);box(lines,'#faf5da',plot.x+plotSize/2,1.024,plot.z+i,plotSize,.016,.032);}batch(lines);
 textLabel(lines,'앞  FRONT',plot.x+plotSize/2,1.1,plot.z+plotSize+.8,'#756b4d',.5);
 const held=new THREE.Group();camera.add(held);held.position.set(.37,-.35,-.65);held.rotation.z=-.22;
 box(held,'#ebc8a5',0,-.12,.03,.14,.27,.16);
 const heldHandle=box(held,'#99704c',0,.12,0,.06,.52,.06),heldHead=box(held,'#b7cbd0',0,.4,0,.4,.09,.09),heldTip=box(held,'#8da5a7',-.17,.35,0,.065,.15,.09),heldItem=box(held,'#d5a665',.02,.2,-.03,.28,.28,.28);
 held.traverse(o=>{if(o instanceof THREE.Mesh){const m=new THREE.MeshBasicMaterial({color:(o.material as THREE.MeshLambertMaterial).color,depthTest:false,depthWrite:false});materials.add(m);o.material=m;o.renderOrder=20;}});
 const selection=new THREE.Box3Helper(new THREE.Box3(new THREE.Vector3(),new THREE.Vector3(1,1,1)),new THREE.Color('#fff4a7'));scene.add(selection);materials.add(selection.material as THREE.Material);geometries.add(selection.geometry);
 const debrisMaterial=new THREE.MeshBasicMaterial({color:'#ffffff',vertexColors:true,depthWrite:false});materials.add(debrisMaterial);
 const debris=new THREE.InstancedMesh(cube,debrisMaterial,12),debrisObject=new THREE.Object3D();debris.visible=false;debris.frustumCulled=false;scene.add(debris);
 let nodeSignature='',damageSignature='',farmSignature='',voxelSignature='',freeSignature='',terrainSignature='',playersSignature='',bridgeSignature='',lastWidth=0,lastHeight=0,lastTime=0,disposed=false;
 const avatarGroups=new Map<string,THREE.Group>(),nodeGroups=new Map<string,THREE.Group>();
 const eye=new THREE.Vector3(initialPos.x+.5,initialPos.y+1.55,initialPos.z+.5);let latest=initial,activeCamera:THREE.Camera=camera;
 function node(n:any){
  const g=targetGroup(resources,{kind:'resource',island,zone,id:n.id,x:n.x,y:n.y,z:n.z});nodeGroups.set(n.id,g);const color=initial.world.config.goods[n.good]?.color||'#b8b6a2';
  if(n.good==='wood'){
   const remaining=Math.max(1,Math.min(6,n.remaining??initial.world.config.treeLayers??3));
   g.userData.target.y=n.y+remaining-1;
   for(let layer=0;layer<remaining;layer++)box(g,layer%2?'#a48058':'#97724e',0,layer+.5,0,.76,.98,.76);
   box(g,forest?'#58896d':'#71996b',0,remaining+.38,0,1.75,.8,1.65);
   box(g,'#92b57b',-.05,remaining+.92,0,1.15,.48,1.1);
  }else if(n.good==='riceSeed'||n.good==='wheatSeed'){
   const rice=n.good==='riceSeed';box(g,'#739453',0,.38,0,.13,.76,.13);for(const dx of[-.22,0,.22]){box(g,'#6e9e55',dx,.48,0,.12,.67,.13);box(g,rice?'#e5d993':'#d9ac55',dx,.85,.04,.19,.26,.18);}
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
 function pick(nx=0,ny=0){
  raycaster.far=latest.view&&latest.view!=='first'?250:5.5;raycaster.setFromCamera(new THREE.Vector2(nx,ny),activeCamera);
  // Terrain participates as an occluder, so rocks or construction cannot be selected through a hill.
  const hits=raycaster.intersectObjects([...pickables,chunks],true);
  for(const hit of hits){
   if(hit.object.parent===chunks){if(underground)return null;const n=hit.face?.normal||new THREE.Vector3(0,1,0),x=Math.floor(hit.point.x-n.x*.01),z=Math.floor(hit.point.z-n.z*.01);if(x<0||z<0||x>=size||z>=size)return null;return{kind:'ground',island,x,y:groundHeight(latest.world,island,x,z)-1,z};}
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
   const now=view.timeNow?.()??Date.now(),activeNodes=Object.values(nation.nodes).filter(n=>(n.zone||'surface')===zone&&n.readyAt<=now),ns=JSON.stringify(activeNodes.map(n=>[n.id,n.readyAt,n.remaining]));
   if(!underground){const ts=JSON.stringify(nation.dug||{});if(ts!==terrainSignature){rebuildTerrain(w);terrainSignature=ts;}}
   const hitAge=view.impact?time-view.impact.at:Infinity;
   const animalPositions=creatureRoutes.flatMap(route=>{const g=creatures.get(route.id)!;g.visible=(nation.wildlife?.[route.id]||0)<=now;if(!g.visible)return [];const pose=animalPose(w,route,now);g.position.set(pose.x+.5,pose.y+pose.bob,pose.z+.5);g.rotation.y=pose.heading;g.rotation.z=view.impact?.target.kind==='animal'&&view.impact.target.id===route.id&&hitAge<350?Math.sin(hitAge*.045)*.14*(1-hitAge/350):0;Object.assign(g.userData.target,{x:Math.floor(pose.x),y:pose.y,z:Math.floor(pose.z)});return [{id:route.id,name:route.name,kind:route.kind,x:Number(pose.x.toFixed(2)),z:Number(pose.z.toFixed(2))}];});
   if(!underground){const cells=farmSites(w,island),stage=Object.fromEntries(Object.entries(nation.crops||{}).map(([key,crop])=>[key,[crop.good,cropMature(w,crop,now)]])),fs=JSON.stringify([stage,nation.dug]);if(fs!==farmSignature){clear(farms);for(const {x,z} of cells){const crop=nation.crops?.[farmKey(x,z)],y=groundHeight(w,island,x,z),g=targetGroup(farms,{kind:'farm',island,x,y,z});box(g,'#795c40',0,.035,0,.94,.07,.94);if(crop){const grown=cropMature(w,crop,now),h=grown?.68:.32;box(g,'#679347',0,.12+h/2,0,.15,h,.15);for(const dx of[-.22,.22])box(g,crop.good==='rice'?'#e9db92':'#d5ad54',dx,.16+h,0,.28,grown?.25:.13,.25);} }batchResources(farms);farmSignature=fs;}}
   if(ns!==nodeSignature){clear(resources);nodeGroups.clear();activeNodes.forEach(node);batchResources(resources);nodeSignature=ns;}
   const ds=JSON.stringify(activeNodes.filter(n=>n.hits).map(n=>[n.id,n.hits,n.remaining]));if(ds!==damageSignature){clear(damage);for(const n of activeNodes.filter(n=>n.hits)){const y=n.y+(n.good==='wood'?(n.remaining??w.config.treeLayers??3)-1:0),g=targetGroup(damage,{kind:'resource',island,zone,id:n.id,x:n.x,y,z:n.z});box(g,'#3f302b',-.19,.53,.405,.055,.53,.022);if((n.hits||0)>1)box(g,'#3f302b',.08,.42,.41,.45,.05,.022);if((n.hits||0)>2)box(g,'#3f302b',.24,.67,.412,.05,.42,.022);}batch(damage);damageSignature=ds;}
   const vs=JSON.stringify(nation.voxels)+view.origin;
   if(!underground&&vs!==voxelSignature){clear(structure);const blocks=voxelBlocks(nation.voxels,w.config,view.origin,{x:plot.x,y:1,z:plot.z},island),set=new Set(blocks.map(b=>key(b.x,b.y,b.z)));if(blocks.length)structure.add(new THREE.Mesh(geo(blockGeometry(blocks,(x,y,z)=>set.has(key(x,y,z)))),vertexMaterial));voxelSignature=vs;}
   if(!underground){const fs=JSON.stringify(nation.freeVoxels||{});if(fs!==freeSignature){clear(freeStructure);const blocks=voxelBlocks(nation.freeVoxels||{},w.config,view.origin,{x:0,y:0,z:0},island).map(b=>({...b,target:{...b.target!,kind:'freeVoxel' as const}})),set=new Set(blocks.map(b=>key(b.x,b.y,b.z)));if(blocks.length)freeStructure.add(new THREE.Mesh(geo(blockGeometry(blocks,(x,y,z)=>set.has(key(x,y,z)))),vertexMaterial));freeSignature=fs;}}
   const bs=JSON.stringify(w.bridges);if(!underground&&bs!==bridgeSignature){rebuildBridges(w);bridgeSignature=bs;}
   const players=Object.values(w.players).filter(p=>(p.location||p.nation)===island&&(p.zone||'surface')===zone&&p.id!==view.uid),ps=JSON.stringify(players.map(p=>[p.id,p.nickname,p.nation]));
   if(ps!==playersSignature){clear(avatars);avatarGroups.clear();for(const p of players){const g=new THREE.Group();g.userData.target={kind:'player',island,zone,id:p.id,x:0,y:0,z:0};avatars.add(g);avatarGroups.set(p.id,g);const color=w.config.templates.find((t:any)=>t.id===p.nation)?.color||'#7cab9c';box(g,'#526970',-.16,.3,0,.23,.6,.29);box(g,'#526970',.16,.3,0,.23,.6,.29);box(g,color,0,.94,0,.63,.69,.37);box(g,'#ebc9a7',0,1.49,0,.48,.43,.45);box(g,'#6d6658',0,1.74,-.02,.53,.12,.48);textLabel(g,p.nickname,0,2.13,0,'#46675e',.4);}playersSignature=ps;}
   for(const[id,g]of avatarGroups){const reported=view.positions[id],p=reported?.island===island&&(reported.zone||'surface')===zone?reported:spawn(w,id),t=new THREE.Vector3(p.x+.5,p.y,p.z+.5);if(!g.userData.placed){g.position.copy(t);g.userData.placed=true;}else g.position.lerp(t,1-Math.exp(-dt*12));const victim=w.players[id];g.rotation.z=victim?.lastHitAt&&now-victim.lastHitAt<300?Math.sin((now-victim.lastHitAt)*.05)*.15:0;}
   const p=view.positions[view.uid]||spawn(w,view.uid),desired=new THREE.Vector3(p.x+.5,p.y+1.55+(view.jump||0),p.z+.5);eye.lerp(desired,1-Math.exp(-dt*18));camera.position.copy(eye);if(hitAge<180){const shake=(1-hitAge/180)*.045;camera.position.x+=Math.sin(hitAge*.24)*shake;camera.position.y+=Math.cos(hitAge*.31)*shake;}camera.rotation.set(THREE.MathUtils.clamp(view.pitch,-1.4,1.4),view.yaw,0,'YXZ');camera.updateMatrixWorld();
   const mode=view.view||'first',overview=mode!=='first';activeCamera=overview?orthographic:camera;held.visible=!overview;clouds.visible=!overview&&!underground;
   if(overview){const full=mode==='top'&&!w.players[view.uid],aspect=lastWidth/lastHeight,half=(full?size*.57:Math.max(4,plotSize*.85))/Math.min(1,aspect);orthographic.left=-half*aspect;orthographic.right=half*aspect;orthographic.top=half;orthographic.bottom=-half;const c=full?new THREE.Vector3(size/2,0,size/2):new THREE.Vector3(plot.x+plotSize/2,2,plot.z+plotSize/2);orthographic.position.copy(c).add(mode==='top'?new THREE.Vector3(0,90,.001):mode==='front'?new THREE.Vector3(0,0,35):new THREE.Vector3(-35,0,0));orthographic.lookAt(c);orthographic.updateProjectionMatrix();orthographic.updateMatrixWorld();scene.fog=null;}else scene.fog=new THREE.Fog(underground?'#182329':'#c3e2ec',underground?14:low?55:90,underground?48:low?140:230);
   const tools=w.players[view.uid]?.tools||{},hitNode=view.impact?.target.kind==='resource'?nation.nodes[view.impact.target.id!]:aim?.kind==='resource'?nation.nodes[aim.id!]:undefined,good=hitNode?.good,tool=good==='wood'&&tools.axe?'axe':['stone','iron','copper','coalOre'].includes(good)&&tools.pickaxe?'pickaxe':'hand';const selected=view.heldGood,carried=selected&&w.players[view.uid]?.bag[selected]?.length&&!(view.mining||hitAge<250);heldItem.visible=!!carried;if(carried)heldItem.material.color.set(w.config.goods[selected!]?.color||'#d5a665');heldHandle.visible=tool!=='hand'&&!carried;heldHead.visible=tool!=='hand'&&!carried;heldTip.visible=tool==='pickaxe'&&!carried;heldHead.scale.set(tool==='axe'?.23:.4,tool==='axe'?.24:.09,.09);heldHead.position.x=tool==='axe'?-.07:0;canvas.dataset.tool=tool;
   held.rotation.x=view.eating?-.2+Math.sin(time*.025)*.3:view.mining||hitAge<250?-.45+Math.sin(time*.023)*.65:-.1;held.rotation.z=view.mining||hitAge<250?-.22+Math.sin(time*.023)*.17:-.22;held.position.y=-.35+Math.sin(time*.003)*.006;
   if(view.impact&&hitAge>=0&&hitAge<430){const target=view.impact.target,progress=hitAge/430,base=new THREE.Vector3(target.x+.5,target.y+(target.kind==='animal'?.95:.55),target.z+.5),color=new THREE.Color(target.kind==='animal'?'#eea387':target.kind==='resource'&&nation.nodes[target.id!]?.good==='wood'?'#bd8a56':'#c7bda8');debris.visible=true;for(let i=0;i<12;i++){const angle=i*2.399+view.impact.seq*.41,speed=.5+(i%4)*.22;debrisObject.position.set(base.x+Math.cos(angle)*progress*speed,base.y+Math.sin(angle*2)*progress*.45+progress*.5-progress*progress*.8,base.z+Math.sin(angle)*progress*speed);debrisObject.scale.setScalar(Math.max(.01,.13*(1-progress)));debrisObject.updateMatrix();debris.setMatrixAt(i,debrisObject.matrix);debris.setColorAt(i,color);}debris.instanceMatrix.needsUpdate=true;if(debris.instanceColor)debris.instanceColor.needsUpdate=true;}else debris.visible=false;
   renderer.render(scene,activeCamera);aim=pick();selection.visible=!!aim&&!overview;
   if(aim){const h=1;selection.box.min.set(aim.x-.015,aim.y-.015,aim.z-.015);selection.box.max.set(aim.x+1.015,aim.y+h+.015,aim.z+1.015);(selection.material as THREE.LineBasicMaterial).color.set(hitAge<180?'#ff8f49':'#fff4a7');selection.updateMatrixWorld();}
   canvas.dataset.zone=zone;canvas.dataset.renderer='webgl';canvas.dataset.view=mode;canvas.dataset.aim=JSON.stringify(aim);canvas.dataset.animals=JSON.stringify(animalPositions);canvas.dataset.drawCalls=String(renderer.info.render.calls);canvas.dataset.triangles=String(renderer.info.render.triangles);return aim;
  },
  targetAt(clientX:number,clientY:number){const rect=canvas.getBoundingClientRect();return pick((clientX-rect.left)/rect.width*2-1,1-(clientY-rect.top)/rect.height*2);},
  dispose(){disposed=true;scene.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();if(!canvas.isConnected)renderer.forceContextLoss();}
 };
}
