import type {SandboxWorld} from './types';
import {mineLand,minePillar,mineExit,mineFloor} from './terrain';
/** Upgrade saved prototype rooms once, retaining inventories, receipts and resource cooldowns. */
export function upgradeFeatures(w:SandboxWorld){
 if((w.featuresVersion||0)>=2)return;
 const c=w.config;
 c.mine||={floor:-8,ceiling:-2,margin:8,stone:24};
 c.goods.oil.name='원유';
 c.goods.fuel||={name:'정제 연료',color:'#e2ac44'};
 c.technologies.refining||='원유 정제';
 c.recipes.fuel||={inputs:{oil:2},output:2,technology:'refining'};
 for(const good of ['plate','glass'])if(c.recipes[good]?.inputs.oil){c.recipes[good].inputs.fuel=c.recipes[good].inputs.oil;delete c.recipes[good].inputs.oil;}
 const refinery=c.templates.find((t:any)=>t.id==='lumina');if(refinery){refinery.technologies||=[];if(!refinery.technologies.includes('refining'))refinery.technologies.push('refining');}
 for(const n of Object.values(w.nations)){
  for(let i=0;i<c.mine.stone;i++){const id=`mine-stone-${i}`;n.nodes[id]||={id,good:'stone',x:0,y:mineFloor(w),z:0,readyAt:0};}
  const available:{x:number;z:number}[]=[],exit=mineExit(w);
  for(let z=c.mine.margin+3;z<c.size-c.mine.margin-3;z+=3)for(let x=c.mine.margin+3;x<c.size-c.mine.margin-3;x+=3){if(mineLand(w,x,z)&&!minePillar(w,x,z)&&Math.abs(x-exit.x)>2)available.push({x,z});}
  const hash=(p:{x:number;z:number})=>(Math.imul(p.x,73856093)^Math.imul(p.z,19349663))>>>0;available.sort((a,b)=>hash(a)-hash(b));
  let i=0;for(const node of Object.values(n.nodes))if(node.good==='iron'||node.good==='copper'||node.id.startsWith('mine-stone-')){
   const point=available[i++];if(!point)throw Error('지하 자원 수가 광산 크기보다 많아요. 설정을 줄여 주세요.');
   Object.assign(node,point,{zone:'mine',y:mineFloor(w)});
  }
 }
 w.featuresVersion=2;
}
