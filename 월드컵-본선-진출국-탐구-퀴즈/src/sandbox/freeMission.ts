import type {SandboxWorld,Voxel} from './types';

/** Only the largest face-connected work counts. Terrain steps of one block may join. */
export function connectedWork(voxels:Record<string,Voxel>):Record<string,Voxel>{
 const all=Object.values(voxels),byCell=new Map(all.map(v=>[`${v.x}_${v.y}_${v.z}`,v])),seen=new Set<string>();let best:Voxel[]=[];
 for(const start of all){const key=`${start.x}_${start.y}_${start.z}`;if(seen.has(key))continue;const queue=[start],group:Voxel[]=[];seen.add(key);
  for(let i=0;i<queue.length;i++){const v=queue[i];group.push(v);const around=[] as string[];for(const dy of[-1,1])around.push(`${v.x}_${v.y+dy}_${v.z}`);for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])for(const dy of[-1,0,1])around.push(`${v.x+dx}_${v.y+dy}_${v.z+dz}`);for(const next of around){const found=byCell.get(next);if(found&&!seen.has(next)){seen.add(next);queue.push(found);}}}
  if(group.length>best.length)best=group;
 }
 if(!best.length)return {};
 const minX=Math.min(...best.map(v=>v.x)),minY=Math.min(...best.map(v=>v.y)),minZ=Math.min(...best.map(v=>v.z));
 return Object.fromEntries(best.map(v=>{const cell={...v,x:v.x-minX,y:v.y-minY,z:v.z-minZ};return [`${cell.x}_${cell.y}_${cell.z}`,cell];}));
}
export type FreeValue={total:number;blocks:number;variety:number;processed:number;processSteps:number;specialties:number;requiredSpecialties:number;completeSpecialties:boolean;parts:{blocks:number;variety:number;processing:number;specialties:number;allSpecialties:number}};
/** Uses the recorded raw origins, including ingredients inside processed goods. */
export function freeValue(w:SandboxWorld,voxels:Record<string,Voxel>):FreeValue{
 const units=Object.values(voxels).map(v=>v.unit),rules=w.config.freeMission||{},weights=rules.weights||{},cap=Math.max(1,Number(rules.blockCap)||80);
 const variety=new Set(units.map(u=>u.good)).size,processed=units.filter(u=>!w.config.goods[u.good]?.raw).length;
 const processSteps=units.reduce((sum,u)=>sum+Math.max(u.processes?.length||0,w.config.goods[u.good]?.raw?0:1),0);
 const required=Object.keys(w.nations).flatMap(id=>Object.keys(w.config.templates.find((n:any)=>n.id===id)?.specialties||{}).map(good=>`${id}:${good}`));
 const found=new Set(units.flatMap(u=>Object.entries(u.sources||{}).flatMap(([id,goods])=>Object.entries(goods).filter(([,amount])=>Number(amount)>0).map(([good])=>`${id}:${good}`))));
 const specialties=required.filter(pair=>found.has(pair)).length,completeSpecialties=required.length>0&&specialties===required.length;
 const parts={blocks:Math.min(units.length,cap)*Number(weights.block??2),variety:variety*Number(weights.variety??24),processing:Math.min(processSteps,cap*3)*Number(weights.process??8),specialties:specialties*Number(weights.specialty??55),allSpecialties:completeSpecialties?Number(weights.allSpecialties??240):0};
 return {total:Object.values(parts).reduce((a,b)=>a+b,0),blocks:units.length,variety,processed,processSteps,specialties,requiredSpecialties:required.length,completeSpecialties,parts};
}
