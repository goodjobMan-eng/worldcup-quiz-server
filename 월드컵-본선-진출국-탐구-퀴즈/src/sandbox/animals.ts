import {bridgeStation,facilities,heightAt,land,mineEntrance,plotOrigin} from './terrain';
import type {SandboxWorld} from './types';

export type AnimalKind='sheep'|'deer'|'camel'|'goat'|'rabbit'|'frog';
export type AnimalRoute={id:string;kind:AnimalKind;name:string;cx:number;cz:number;radius:number;phase:number;speed:number};
const kinds=new Set<AnimalKind>(['sheep','deer','camel','goat','rabbit','frog']);
const hash=(value:string)=>{let n=2166136261;for(const c of value)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};

/** Every device derives the same harmless animals. Only players and building edits use Firebase. */
export function animalRoutes(w:SandboxWorld,island:string):AnimalRoute[]{
 const raw=w.config.animals?.[island]||(globalThis as any).NATIONLAB_CONFIG?.sandbox?.animals?.[island];
 if(!raw||!kinds.has(raw.kind)||!w.nations[island])return [];
 const size=w.config.size,count=Math.min(7,Math.max(0,Math.floor(Number(raw.count)||0))),routes:AnimalRoute[]=[];
 const places=[{x:size*.49-6,z:size*.76-6},{x:size*.25,z:size*.49},{x:size*.78,z:size*.26},{x:size*.34,z:size*.33},{x:size*.62,z:size*.7},{x:size*.42,z:size*.18},{x:size*.75,z:size*.75}];
 const plot=plotOrigin(size),plotSize=w.config.freePlot?.size||16,stations=Object.values(facilities(size)),entrance=mineEntrance(size);
 const bridgeSites=Object.values(w.bridges).filter(b=>b.a===island||b.b===island).map(b=>bridgeStation(w,island,b.id));
 const nodes=Object.values(w.nations[island].nodes).filter(n=>(n.zone||'surface')==='surface');
 const blocked=(x:number,z:number)=>!land(size,x,z)||nodes.some(n=>n.x===x&&n.z===z)||stations.some(s=>Math.hypot(x-s.x,z-s.z)<2.5)||bridgeSites.some(s=>Math.hypot(x-s.x,z-s.z)<3)||Math.hypot(x-entrance.x,z-entrance.z)<4||(x>=plot.x-3&&x<plot.x+plotSize+3&&z>=plot.z-3&&z<plot.z+plotSize+3);
 const safe=(x:number,z:number,radius:number)=>{
  const center=heightAt(size,x,z);if(center<1)return false;
  for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++)if(blocked(x+dx,z+dz)||Math.abs(heightAt(size,x+dx,z+dz)-center)>1)return false;
  return true;
 };
 for(let i=0;i<count;i++){
  const wanted=places[i],seed=hash(`${w.code}:${island}:${i}`),candidates:{x:number;z:number;score:number}[]=[];
  for(let z=8;z<size-8;z+=2)for(let x=8;x<size-8;x+=2){
   const jitter=hash(`${seed}:${x}:${z}`)/2**32;
   candidates.push({x,z,score:Math.hypot(x-wanted.x,z-wanted.z)+jitter*2});
  }
  candidates.sort((a,b)=>a.score-b.score);
  let found:{x:number;z:number;radius:number}|undefined;
  for(const radius of[3,2,1]){
   const candidate=candidates.find(c=>routes.every(a=>Math.hypot(a.cx-c.x,a.cz-c.z)>=8)&&safe(c.x,c.z,radius));
   if(candidate){found={...candidate,radius};break;}
  }
  if(!found)continue;
  routes.push({id:`${island}-${raw.kind}-${i}`,kind:raw.kind,name:String(raw.name||raw.kind),cx:found.x,cz:found.z,radius:Math.min(2.25,found.radius-.45),phase:(seed%628)/100,speed:.22+(seed%7)*.025});
 }
 return routes;
}

export function animalPose(w:SandboxWorld,route:AnimalRoute,at:number){
 const t=at/1000*route.speed+route.phase;
 const x=route.cx+Math.sin(t)*route.radius,z=route.cz+Math.sin(t*.73+route.phase)*route.radius;
 const dx=Math.cos(t),dz=.73*Math.cos(t*.73+route.phase);
 return{x,z,y:heightAt(w.config.size,x,z),heading:Math.atan2(dx,dz),bob:Math.sin(at*.011+route.phase)*.045};
}
