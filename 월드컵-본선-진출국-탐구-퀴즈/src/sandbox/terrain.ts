import type {SandboxWorld,Pos,Target,Zone} from './types';
export const plotOrigin = (size:number) => ({x:Math.floor(size*.64), z:Math.floor(size*.44)});
export function land(size:number,x:number,z:number) {const edge=2;return x>=edge&&z>=edge&&x<size-edge&&z<size-edge&&Math.hypot(Math.max(0,Math.abs(x-size/2)-(size/2-8)),Math.max(0,Math.abs(z-size/2)-(size/2-8)))<7;}
export function heightAt(size:number,x:number,z:number) {
 if(!land(size,x,z))return -1;
 const p=plotOrigin(size); if(x>=p.x-2&&x<p.x+18&&z>=p.z-2&&z<p.z+18)return 1;
 if(Math.abs(x-size/2)<3 || z>size*.68)return 1;
 const hill=Math.max(0,1-Math.hypot(x-size*.24,z-size*.29)/(size*.22));return 1+Math.floor(hill*3);
}
export function facilities(size:number) {return {warehouse:{x:Math.floor(size*.48),z:Math.floor(size*.68)},workbench:{x:Math.floor(size*.55),z:Math.floor(size*.65)},blueprint:{x:plotOrigin(size).x-2,z:plotOrigin(size).z+2}};}
export function bridgeStation(w:SandboxWorld,nation:string,bridgeId:string) {const b=w.bridges[bridgeId],size=w.config.size;return {x:b.a===nation?size-5:4,z:Math.floor(size/2)};}
export function spawn(w:SandboxWorld,uid:string):Pos {const p=w.players[uid];const size=w.config.size;if(p?.zone!=='mine'&&p?.arrival==='mine'){const t=mineEntrance(size);return {island:p.location,...t,z:t.z+2,y:heightAt(size,t.x,t.z+2),zone:'surface'};}if(p?.zone==='mine'){const e=mineExit(w);return {...e,z:e.z-2,island:p.location,zone:'mine',y:mineFloor(w)};}if(p?.location&&p.location!==p.nation){const bridge=Object.values(w.bridges).find(b=>(b.a===p.nation&&b.b===p.location)||(b.b===p.nation&&b.a===p.location));if(bridge){const t=bridgeStation(w,p.location,bridge.id);return {island:p.location,x:t.x,y:heightAt(size,t.x,t.z+1),z:t.z+1};}}const index=Object.keys(w.players).indexOf(uid);const x=Math.floor(size/2)+(index%3),z=Math.floor(size*.76)+Math.floor(index/3)%3;return {island:p?.location||p?.nation||Object.keys(w.nations)[0],x,y:heightAt(size,x,z),z};}
export function reachable(pos:Pos,t:Pick<Target,'island'|'x'|'z'|'zone'>,distance=2.5) {return (pos.zone||'surface')===(t.zone||'surface')&&pos.island===t.island&&Math.hypot(pos.x-t.x,pos.z-t.z)<=distance;}
export function walkable(w:SandboxWorld,island:string,x:number,z:number,now=Date.now(),zone:Zone='surface') {if(zone==='mine')return !!w.nations[island]&&mineLand(w,x,z)&&!minePillar(w,x,z)&&!Object.values(w.nations[island].nodes).some(n=>n.zone==='mine'&&n.x===x&&n.z===z&&n.readyAt<=now);return !!w.nations[island]&&land(w.config.size,x,z)&&!Object.values(w.nations[island].nodes).some(n=>(n.zone||'surface')==='surface'&&n.x===x&&n.z===z&&n.readyAt<=now)&&!Object.values(facilities(w.config.size)).some(n=>n.x===x&&n.z===z);}
/** Feet stand on the highest supported cube, never inside a landmark. */
export function surfaceHeight(w:SandboxWorld,island:string,x:number,z:number,zone:Zone='surface'){if(zone==='mine')return mineFloor(w);const origin=plotOrigin(w.config.size);return heightAt(w.config.size,x,z)+Math.max(0,...Object.values(w.nations[island]?.voxels||{}).filter(v=>v.x===x-origin.x&&v.z===z-origin.z).map(v=>v.y+1));}

export const mineEntrance=(size:number)=>({x:Math.floor(size*.22),z:Math.floor(size*.24)});
export const mineFloor=(w:SandboxWorld)=>w.config.mine?.floor??-8;
export const mineExit=(w:SandboxWorld)=>({x:Math.floor(w.config.size/2),z:w.config.size-(w.config.mine?.margin??8)-1});
export function mineLand(w:SandboxWorld,x:number,z:number){const m=w.config.mine?.margin??8;return x>m&&z>m&&x<w.config.size-m&&z<w.config.size-m;}
export function minePillar(w:SandboxWorld,x:number,z:number){return Math.abs(x-w.config.size/2)>2&&x%12===8&&z%12===8;}
export function portalCrossing(w:SandboxWorld,p:Pos){const t=p.zone==='mine'?mineExit(w):mineEntrance(w.config.size);return p.x===t.x&&p.z===t.z;}
