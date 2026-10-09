import type {Blueprint,Voxel} from './types';
export function projections(heights:number[][],maxHeight=4){const depth=heights.length,width=heights[0]?.length||0;return {top:heights.map(r=>r.map(n=>n>0?1:0)),front:Array.from({length:maxHeight},(_,y)=>Array.from({length:width},(_,x)=>heights.some(r=>r[x]>y)?1:0)),side:Array.from({length:maxHeight},(_,y)=>Array.from({length:depth},(_,z)=>heights[z].some(n=>n>y)?1:0))};}
export function blockBounds(top:number[][],front:number[][],side:number[][]){
 const rows=top.map((_,z)=>side.reduce((n,r,y)=>r[z]?y+1:n,0)),cols=(top[0]||[]).map((_,x)=>front.reduce((n,r,y)=>r[x]?y+1:n,0));let base=0,max=0,saved=0;
 for(let z=0;z<top.length;z++)for(let x=0;x<cols.length;x++)if(top[z][x]){base++;max+=Math.min(rows[z],cols[x]);if(!rows[z]||!cols[x])throw Error('불가능한 설계도입니다.');}
 for(let z=0;z<rows.length;z++)if(rows[z]&&!top[z].some((v,x)=>v&&cols[x]>=rows[z]))throw Error('앞·옆 모양이 맞지 않습니다.');
 for(let x=0;x<cols.length;x++)if(cols[x]&&!top.some((r,z)=>r[x]&&rows[z]>=cols[x]))throw Error('앞·옆 모양이 맞지 않습니다.');
 const extra=rows.reduce((n,v)=>n+Math.max(0,v-1),0)+cols.reduce((n,v)=>n+Math.max(0,v-1),0);
 for(let h=2;h<=Math.max(0,...rows,...cols);h++){const match=new Map<number,number>();function visit(z:number,seen:Set<number>):boolean{for(let x=0;x<cols.length;x++){if(!top[z][x]||cols[x]!==h||seen.has(x))continue;seen.add(x);if(!match.has(x)||visit(match.get(x)!,seen)){match.set(x,z);return true;}}return false;}for(let z=0;z<rows.length;z++)if(rows[z]===h)visit(z,new Set());saved+=match.size*(h-1);}
 return {min:base+extra-saved,max};
}
export function makeBlueprint(id:string,name:string,heights:number[][]):Blueprint {const p=projections(heights);return {id,name,heights,...p,...blockBounds(p.top,p.front,p.side)};}
export function heightsOf(voxels:Record<string,Voxel>,size=5){const h=Array.from({length:size},()=>Array(size).fill(0));for(const v of Object.values(voxels))if(v.z<size&&v.x<size)h[v.z][v.x]=Math.max(h[v.z][v.x],v.y+1);return h;}
export function compare(heights:number[][],bp:Blueprint){const actual=projections(heights,bp.front.length),differences={top:[] as string[],front:[] as string[],side:[] as string[]};for(const v of ['top','front','side'] as const)bp[v].forEach((r,y)=>r.forEach((n,x)=>{if(n!==actual[v][y]?.[x])differences[v].push(`${x},${y}`);}));return {actual,differences,match:Object.values(differences).every(d=>!d.length)};}
