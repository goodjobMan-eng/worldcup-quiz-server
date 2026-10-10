import type {SandboxWorld} from './types';
import {mineLand,minePillar,mineExit,mineFloor} from './terrain';
import {farmCells,farmKey} from './farming';
/** Upgrade saved prototype rooms once, retaining inventories, receipts and resource cooldowns. */
export function upgradeFeatures(w:SandboxWorld){
 if((w.featuresVersion||0)<2){
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
 if((w.featuresVersion||0)<3){
  const current=(globalThis as any).NATIONLAB_CONFIG?.sandbox;
  if(current){
   for(const [good,spec] of Object.entries(current.goods))w.config.goods[good]||=structuredClone(spec);
   for(const [good,recipe] of Object.entries(current.recipes))w.config.recipes[good]||=structuredClone(recipe);
   w.config.farm||=structuredClone(current.farm);
   w.config.hotbar||=structuredClone(current.hotbar);
   w.config.animalRespawnSeconds||=current.animalRespawnSeconds;
   w.config.animals||={};for(const [nation,spec] of Object.entries(current.animals)){w.config.animals[nation]||=structuredClone(spec);w.config.animals[nation].loot||=structuredClone((spec as any).loot);}
  }
  for(const n of Object.values(w.nations)){
   n.wildlife||={};
   if(!n.crops){n.crops={};const cells=farmCells(w),count=Math.min(cells.length,w.config.farm?.starterCrops||4);
    for(let i=0;i<count;i++){const {x,z}=cells[i];n.crops[farmKey(x,z)]={good:i%2?'wheat':'rice',plantedAt:0,by:'starter'};}
   }
  }
  w.featuresVersion=3;
 }
 if((w.featuresVersion||0)<4){
  const current=(globalThis as any).NATIONLAB_CONFIG?.sandbox;
  w.config.treeLayers||=current?.treeLayers||3;
  w.config.hitCounts||=structuredClone(current?.hitCounts||{wood:3,stone:3,iron:4,copper:4,animal:2,default:2});
  for(const n of Object.values(w.nations))n.wildlifeHits||={};
  w.featuresVersion=4;
 }
 if((w.featuresVersion||0)<5){
  const current=(globalThis as any).NATIONLAB_CONFIG?.sandbox;
  if(current){
   for(const [good,spec]of Object.entries(current.goods))w.config.goods[good]||=structuredClone(spec);
   for(const [good,recipe]of Object.entries(current.recipes))w.config.recipes[good]||=structuredClone(recipe);
   for(const [tech,name]of Object.entries(current.technologies))w.config.technologies[tech]||=name;
   for(const spec of w.config.templates){const added=current.templates.find((t:any)=>t.id===spec.id);spec.technologies||=[];for(const tech of added?.technologies||[])if(!spec.technologies.includes(tech))spec.technologies.push(tech);}
  }
  w.config.mine.coal??=current?.mine?.coal??12;
  w.config.terrainDigDepth??=current?.terrainDigDepth??2;
  w.config.freeBuildLimit??=current?.freeBuildLimit??600;
  w.config.freeBuildHeight??=current?.freeBuildHeight??8;
  w.config.fuelSubstitutes??=structuredClone(current?.fuelSubstitutes||['coal','charcoal']);
  for(const n of Object.values(w.nations)){
   n.freeVoxels||={};n.dug||={};
   const used=new Set(Object.values(n.nodes).filter(node=>node.zone==='mine').map(node=>`${node.x}_${node.z}`));
   const exit=mineExit(w),spots:{x:number;z:number}[]=[];
   for(let z=w.config.mine.margin+3;z<w.config.size-w.config.mine.margin-3;z+=3)for(let x=w.config.mine.margin+3;x<w.config.size-w.config.mine.margin-3;x+=3)if(mineLand(w,x,z)&&!minePillar(w,x,z)&&Math.abs(x-exit.x)>2&&!used.has(`${x}_${z}`))spots.push({x,z});
   spots.sort((a,b)=>((Math.imul(a.x,73856093)^Math.imul(a.z,19349663))>>>0)-((Math.imul(b.x,73856093)^Math.imul(b.z,19349663))>>>0));
   for(let i=0;i<w.config.mine.coal;i++){const spot=spots[i];if(!spot)break;const id=`coal-${i}`;n.nodes[id]||={id,good:'coalOre',zone:'mine',x:spot.x,z:spot.z,y:mineFloor(w),readyAt:0};}
  }
  w.featuresVersion=5;
 }
}
