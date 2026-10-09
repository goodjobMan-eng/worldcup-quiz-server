import type {SandboxWorld,Crop} from './types';

/** A small field near the village. Cells are shared by every member of a nation. */
export function farmCells(w:SandboxWorld){
 const size=Math.max(2,Math.min(6,Number(w.config.farm?.size)||4));
 const x=Math.floor(w.config.size*.31),z=Math.floor(w.config.size*.73);
 return Array.from({length:size*size},(_,i)=>({x:x+i%size,z:z+Math.floor(i/size)}));
}
export const farmKey=(x:number,z:number)=>`${x}_${z}`;
export function cropMature(w:SandboxWorld,crop:Crop,now:number){return now-crop.plantedAt>=Math.max(1,Number(w.config.farm?.growSeconds)||90)*1000;}
