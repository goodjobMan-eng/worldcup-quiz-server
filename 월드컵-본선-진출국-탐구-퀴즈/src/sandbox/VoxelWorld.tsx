import {mineFloor,mineLand,mineEntrance,mineExit} from './terrain';
import {animalPose,animalRoutes} from './animals';
import {farmCells,farmKey,cropMature} from './farming';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { facilities, heightAt, plotOrigin, spawn } from './terrain';
import type { Target, Voxel } from './types';
import { blockGeometry, createVoxelRenderer, voxelBlocks, type WorldView } from './voxelRenderer';

export type VoxelWorldProps=WorldView&{onLook:(dx:number,dy:number)=>void;onAim:(target:Target|null)=>void;onInteract?:(target:Target)=>void};
export default function VoxelWorld(props:VoxelWorldProps){
 const canvas=useRef<HTMLCanvasElement>(null),current=useRef(props);current.current=props;
 const drag=useRef<{id:number;x:number;y:number;startX:number;startY:number}|null>(null),fallbackAim=useRef<Target|null>(null),rendererRef=useRef<ReturnType<typeof createVoxelRenderer>|null>(null);
 const[fallback,setFallback]=useState(false);
 const position=props.positions[props.uid]||spawn(props.world,props.uid),island=position.island,zone=position.zone||'surface';
 useEffect(()=>{
  const el=canvas.current!;let frame=0,last=-Infinity,lastAim=-Infinity,aimKey='',visible=true;
  let renderer:ReturnType<typeof createVoxelRenderer>|null=null;
  if(!fallback){try{renderer=createVoxelRenderer(el,current.current);rendererRef.current=renderer;}catch{setFallback(true);return;}}
  const ctx=fallback?el.getContext('2d'):null;
  const fallbackAnimals=zone==='surface'?animalRoutes(current.current.world,island):[];
  const observer=typeof IntersectionObserver!=='undefined'?new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;}):null;observer?.observe(el);
  const lost=(e:Event)=>{e.preventDefault();setFallback(true);};el.addEventListener('webglcontextlost',lost);
  function drawFallback(){
   if(!ctx)return null;const p=current.current,w=p.world,size=w.config.size,n=w.nations[island];if(!n)return null;
   const width=Math.max(1,el.clientWidth),height=Math.max(1,el.clientHeight);if(el.width!==width||el.height!==height){el.width=width;el.height=height;}
   const scale=Math.min(width,height)/size,ox=(width-size*scale)/2,oy=(height-size*scale)/2;
   ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#bfdee3';ctx.fillRect(0,0,width,height);ctx.setTransform(scale,0,0,scale,ox,oy);
   for(let z=0;z<size;z++)for(let x=0;x<size;x++){const h=zone==='mine'?(mineLand(w,x,z)?1:-1):heightAt(size,x,z);if(h<0)continue;ctx.fillStyle=zone==='mine'?'#53636a':h>1?'#94b689':'#b6ca9e';ctx.fillRect(x,z,1,1);}
   const targets:Target[]=[];
   for(const resource of Object.values(n.nodes)){if((resource.zone||'surface')!==zone||resource.readyAt>Date.now())continue;ctx.fillStyle=w.config.goods[resource.good]?.color||'#899998';ctx.fillRect(resource.x+.08,resource.z+.08,.84,.84);targets.push({kind:'resource',island,zone,id:resource.id,x:resource.x,y:resource.y,z:resource.z});}
   if(zone==='surface')for(const{x,z}of farmCells(w)){const crop=n.crops?.[farmKey(x,z)];ctx.fillStyle=crop?(cropMature(w,crop,p.timeNow?.()??Date.now())?'#d9bb67':'#83a967'):'#795c40';ctx.fillRect(x+.08,z+.08,.84,.84);targets.push({kind:'farm',island,x,y:heightAt(size,x,z),z});}
   if(zone==='surface')for(const[kind,f]of Object.entries(facilities(size))){ctx.fillStyle='#b08b65';ctx.fillRect(f.x-.1,f.z-.1,1.2,1.2);targets.push({kind:kind as Target['kind'],island,x:f.x,y:heightAt(size,f.x,f.z),z:f.z});}
   const portal=zone==='mine'?mineExit(w):mineEntrance(size);ctx.fillStyle='#e6c57f';ctx.fillRect(portal.x,portal.z,1,1);targets.push({...portal,y:zone==='mine'?mineFloor(w):heightAt(size,portal.x,portal.z),island,zone,kind:zone==='mine'?'mineExit':'mineEntrance'});
   const plot=plotOrigin(size),ps=w.stage>=3?(w.config.freePlot?.size||16):(w.config.plot?.size||5);ctx.strokeStyle='#fff5d4';ctx.lineWidth=.1;ctx.strokeRect(plot.x,plot.z,ps,ps);
   for(const v of Object.values(n.voxels)){ctx.fillStyle=w.config.goods[v.unit.good]?.color||'#c6bda1';ctx.fillRect(plot.x+v.x+.03,plot.z+v.z+.03,.94,.94);}
   const animalPositions=fallbackAnimals.flatMap(route=>{if((n.wildlife?.[route.id]||0)>(p.timeNow?.()??Date.now()))return [];const pose=animalPose(w,route,p.timeNow?.()??Date.now());ctx.fillStyle=route.kind==='frog'?'#79a95d':route.kind==='camel'?'#caa16a':route.kind==='deer'?'#a87a50':'#e7dfcb';ctx.beginPath();ctx.arc(pose.x+.5,pose.z+.5,.42,0,Math.PI*2);ctx.fill();ctx.fillStyle='#31443c';ctx.font='1.1px sans-serif';ctx.textAlign='center';ctx.fillText(route.name,pose.x+.5,pose.z-.15);targets.push({kind:'animal',island,id:route.id,x:Math.floor(pose.x),y:pose.y,z:Math.floor(pose.z)});return[{id:route.id,name:route.name,kind:route.kind,x:Number(pose.x.toFixed(2)),z:Number(pose.z.toFixed(2))}];});
   const own=p.positions[p.uid]||spawn(w,p.uid);ctx.fillStyle='#3768a0';ctx.beginPath();ctx.arc(own.x+.5,own.z+.5,.42,0,Math.PI*2);ctx.fill();
   const aim=fallbackAim.current;if(aim){ctx.strokeStyle='#fff';ctx.lineWidth=.17;ctx.strokeRect(aim.x,aim.z,1,1);}
   el.dataset.zone=zone;el.dataset.renderer='2d';el.dataset.view='top';el.dataset.aim=JSON.stringify(aim);el.dataset.animals=JSON.stringify(animalPositions);el.dataset.targets=JSON.stringify(targets.map(t=>({target:t,screen:[(ox+(t.x+.5)*scale)/width,(oy+(t.z+.5)*scale)/height]})));return aim;
  }
  function draw(time:number){frame=requestAnimationFrame(draw);if(!visible||document.hidden||time-last<32)return;last=time;const target=renderer?renderer.draw(current.current,time):drawFallback();if(time-lastAim>75){lastAim=time;const next=JSON.stringify(target);if(next!==aimKey){aimKey=next;current.current.onAim(target);}}}
  frame=requestAnimationFrame(draw);
  return()=>{cancelAnimationFrame(frame);observer?.disconnect();el.removeEventListener('webglcontextlost',lost);renderer?.dispose();rendererRef.current=null;};
 },[island,zone,props.world.config.size,props.world.stage,props.quality,fallback]);
 return <div style={{position:'relative',width:'100%',height:'100%',minHeight:240,background:'#c3e2ec'}}>
  <canvas key={fallback?'flat-'+zone:`voxel-${island}-${zone}-${props.quality||'normal'}-${props.world.stage}-${props.world.config.size}`} ref={canvas} className="voxel-world-canvas" role="img" aria-label={`${props.world.config.templates.find((t:any)=>t.id===island)?.name||island} ${fallback?'2D 지도':'1인칭 블록 세계'}`} style={{display:'block',width:'100%',height:'100%',touchAction:'none',cursor:'grab'}}
   onPointerDown={e=>{
    if(drag.current||e.button!==0||props.view&&props.view!=='first')return;drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);
   }}
   onPointerMove={e=>{const d=drag.current;if(!d||d.id!==e.pointerId)return;if(!fallback)current.current.onLook(e.clientX-d.x,e.clientY-d.y);drag.current={...d,x:e.clientX,y:e.clientY};}}
   onPointerUp={e=>{const d=drag.current;if(!d||d.id!==e.pointerId)return;drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(Math.hypot(e.clientX-d.startX,e.clientY-d.startY)>12)return;let target:Target|null=null;if(fallback){const r=e.currentTarget.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height,targets=JSON.parse(e.currentTarget.dataset.targets||'[]') as {target:Target;screen:number[]}[];const match=targets.sort((a,b)=>Math.hypot(a.screen[0]-x,a.screen[1]-y)-Math.hypot(b.screen[0]-x,b.screen[1]-y))[0];target=match&&Math.hypot(match.screen[0]-x,match.screen[1]-y)<.065?match.target:null;fallbackAim.current=target;}else target=rendererRef.current?.targetAt(e.clientX,e.clientY)||null;current.current.onAim(target);if(target)current.current.onInteract?.(target);}}
   onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}
  />
  {fallback&&<div role="status" style={{position:'absolute',top:8,left:8,right:8,padding:10,borderRadius:10,background:'#fffae6ee',color:'#496852',fontSize:12,pointerEvents:'none'}}>3D를 사용할 수 없어 2D 지도로 표시합니다. 가까운 자원을 눌러 선택할 수 있어요.</div>}
 </div>;
}

export type VoxelPreviewProps={voxels:Record<string,Voxel>;origin?:boolean;config:any;view?:'3d'|'top'|'front'|'side'};
/** Gallery only: callers decide when to reveal this after the learner has made a guess. */
export function VoxelPreview({voxels,origin=false,config,view='3d'}:VoxelPreviewProps){
 const canvas=useRef<HTMLCanvasElement>(null);const[failed,setFailed]=useState(false);
 const[selectedId,setSelectedId]=useState<string|null>(null),selectedVoxel=selectedId?voxels[selectedId]:undefined;
 const countryName=(id:string)=>config.templates?.find((t:any)=>t.id===id)?.name||id;
 useEffect(()=>{
  if(failed)return;const el=canvas.current!;let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({canvas:el,antialias:true,powerPreference:'low-power'});}catch{setFailed(true);return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setClearColor('#eaf0e2');
  const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#fff9e9','#94a5a1',1.8));const light=new THREE.DirectionalLight('#fff4db',2);light.position.set(-6,12,8);scene.add(light);
  const blocks=voxelBlocks(voxels,config,origin),size=Math.max(config.plot?.size||5,...blocks.map(b=>Math.max(b.x,b.z)+1)),occupied=new Set(blocks.map(b=>`${b.x},${b.y},${b.z}`));
  const geometry=blockGeometry(blocks,(x,y,z)=>occupied.has(`${x},${y},${z}`)),material=new THREE.MeshLambertMaterial({vertexColors:true,flatShading:true}),voxelMesh=new THREE.Mesh(geometry,material);scene.add(voxelMesh);
  const groundGeometry=new THREE.BoxGeometry(size+.2,.09,size+.2),groundMaterial=new THREE.MeshLambertMaterial({color:'#d4dcc6'}),ground=new THREE.Mesh(groundGeometry,groundMaterial);ground.position.set(size/2,-.06,size/2);scene.add(ground);
  const grid=new THREE.GridHelper(size,size,'#a2b195','#c2cbb6');grid.position.set(size/2,.002,size/2);scene.add(grid);
  const max=Math.max(1,...blocks.map(b=>b.y+1)),center=new THREE.Vector3(size/2,max/2,size/2),camera=new THREE.OrthographicCamera(-4,4,4,-4,.1,100);
  const offset=view==='top'?new THREE.Vector3(0,20,.001):view==='front'?new THREE.Vector3(0,0,20):view==='side'?new THREE.Vector3(-20,0,0):new THREE.Vector3(10,10,14);camera.position.copy(center).add(offset);camera.lookAt(center);
  const controls=new OrbitControls(camera,el);controls.target.copy(center);controls.enablePan=false;controls.enableZoom=false;controls.enableRotate=view==='3d';controls.enableDamping=true;controls.minPolarAngle=.15;controls.maxPolarAngle=Math.PI/2.05;controls.update();
  const raycaster=new THREE.Raycaster();let pointer:{id:number;x:number;y:number;dragged:boolean}|null=null;
  const pointerDown=(e:PointerEvent)=>{if(e.button!==0||pointer){pointer=null;return;}pointer={id:e.pointerId,x:e.clientX,y:e.clientY,dragged:false};};
  const pointerMove=(e:PointerEvent)=>{if(pointer&&pointer.id===e.pointerId&&Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>7)pointer.dragged=true;};
  const pointerUp=(e:PointerEvent)=>{
   const start=pointer;pointer=null;if(!start||start.id!==e.pointerId||start.dragged||Math.hypot(e.clientX-start.x,e.clientY-start.y)>7)return;
   const r=el.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);
   const hit=raycaster.intersectObject(voxelMesh,false)[0],target=hit&&hit.faceIndex!==undefined?geometry.userData.targets[Math.floor(hit.faceIndex/2)] as Target|undefined:undefined;
   setSelectedId(target?.id||null);
  };
  const pointerCancel=()=>{pointer=null;};
  el.addEventListener('pointerdown',pointerDown);el.addEventListener('pointermove',pointerMove);el.addEventListener('pointerup',pointerUp);el.addEventListener('pointercancel',pointerCancel);
  let frame=0,last=0,w=0,h=0,visible=true;const observer=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;});observer.observe(el);
  const draw=(time:number)=>{frame=requestAnimationFrame(draw);if(!visible||document.hidden||time-last<45)return;last=time;const nw=Math.max(1,el.clientWidth),nh=Math.max(1,el.clientHeight);if(nw!==w||nh!==h){w=nw;h=nh;renderer.setSize(w,h,false);const half=Math.max(size,max)*.77/Math.min(1,w/h);camera.left=-half*w/h;camera.right=half*w/h;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();}if(view==='3d')controls.update();renderer.render(scene,camera);el.dataset.renderer='webgl';el.dataset.view=view;};frame=requestAnimationFrame(draw);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();el.removeEventListener('pointerdown',pointerDown);el.removeEventListener('pointermove',pointerMove);el.removeEventListener('pointerup',pointerUp);el.removeEventListener('pointercancel',pointerCancel);controls.dispose();geometry.dispose();material.dispose();groundGeometry.dispose();groundMaterial.dispose();grid.geometry.dispose();if(Array.isArray(grid.material))grid.material.forEach(m=>m.dispose());else grid.material.dispose();renderer.dispose();if(!el.isConnected)renderer.forceContextLoss();};
 },[voxels,origin,config,view,failed]);
 return <div className="voxel-preview" data-selected-voxel={selectedId||''}>
  {failed?<div role="img" aria-label={`건축물 블록 ${Object.keys(voxels).length}개`} style={{padding:24,color:'#52705d',background:'#eaf0e2'}}>이 기기에서는 입체 미리보기를 표시할 수 없어요. 블록 {Object.keys(voxels).length}개</div>:<canvas ref={canvas} className="voxel-preview-canvas" role="img" aria-label={`건축물 ${view==='3d'?'입체':view==='top'?'위':view==='front'?'앞':'옆'} 모습 · 블록 ${Object.keys(voxels).length}개 · 블록을 눌러 원산지 확인`} style={{display:'block',width:'100%',height:300,borderRadius:14,touchAction:view==='3d'?'none':'auto'}}/>}
  <div className="voxel-origin-detail" aria-live="polite" style={{padding:'10px 12px',background:'#f0f4e8',color:'#42614f',borderRadius:10,fontSize:13,marginTop:8}}>
   {selectedVoxel?<><strong>{config.goods?.[selectedVoxel.unit.good]?.name||selectedVoxel.unit.good} · ({selectedVoxel.x+1}, {selectedVoxel.y+1}, {selectedVoxel.z+1})칸</strong>
    <div style={{marginTop:5}}>원산지: {Object.entries(selectedVoxel.unit.sources||{}).map(([id,goods])=>`${countryName(id)} (${Object.entries(goods).map(([good,count])=>`${config.goods?.[good]?.name||good} ${Number(count.toFixed(2))}`).join(', ')})`).join(' · ')||'기록 없음'}</div>
    <div style={{marginTop:3}}>가공 나라: {selectedVoxel.unit.processor?countryName(selectedVoxel.unit.processor):config.goods?.[selectedVoxel.unit.good]?.raw?'가공하지 않은 원료':'기록 없음'}</div>{selectedVoxel.unit.processes?.length>0&&<div>가공 이력: {selectedVoxel.unit.processes.map(v=>`${countryName(v.nation)} · ${config.goods[v.good]?.name||v.good}`).join(' → ')}</div>}</>:<span>블록을 누르면 원산지와 가공한 나라를 볼 수 있어요. {view==='3d'?'드래그하면 건축물이 돌아가요.':''}</span>}
  </div>
  <details style={{fontSize:12,marginTop:6}}><summary style={{cursor:'pointer',minHeight:36}}>블록 목록으로 확인</summary><select aria-label="원산지를 확인할 블록" value={selectedId||''} onChange={e=>setSelectedId(e.target.value||null)} style={{width:'100%',minHeight:44,padding:8,border:'1px solid #c5d2bd',borderRadius:8}}><option value="">블록 선택</option>{Object.entries(voxels).map(([id,v])=><option key={id} value={id}>{config.goods?.[v.unit.good]?.name||v.unit.good} · ({v.x+1}, {v.y+1}, {v.z+1})칸</option>)}</select></details>
 </div>;
}
