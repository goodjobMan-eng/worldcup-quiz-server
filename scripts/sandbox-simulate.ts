import '../월드컵-본선-진출국-탐구-퀴즈/public/config.js';
import {makeWorld,apply,blueprint,landmarkCheck,template,stamina} from '../월드컵-본선-진출국-탐구-퀴즈/src/sandbox/engine';
import {facilities,bridgeStation,missionPlotOrigin} from '../월드컵-본선-진출국-탐구-퀴즈/src/sandbox/terrain';
import type {Pos,Command} from '../월드컵-본선-진출국-탐구-퀴즈/src/sandbox/types';
import assert from 'node:assert/strict';
export function simulateSandbox(trade:boolean){
 let now=1700000000000,serial=0,w=makeWorld('5678','teacher','시뮬레이션 학교','6-1','seoul-sim','seoul','중부',undefined,now);const positions:Record<string,Pos>={},ids=Object.keys(w.nations);
 function act(uid:string,c:Command){if(w.phase==='playing'&&now>=w.endsAt)w=apply(w,'teacher',{type:'start',minutes:40},positions,now);w=apply(w,uid,{...c,id:`sim-${serial++}`},positions,++now);}
 const at=(uid:string,t:{x:number;z:number})=>positions[uid]={...t,island:w.players[uid].location,y:1};
 for(const id of ids){act(id,{type:'join',nickname:id});act('teacher',{type:'assign',player:id,nation:id});}act('teacher',{type:'start',minutes:40});
 function mine(id:string,good:string,count:number){for(let i=0;i<count;i++){while(stamina(w,w.players[id],now)<(good==='wood'&&w.players[id].tools.axe||['stone','iron','copper','coalOre'].includes(good)&&w.players[id].tools.pickaxe?1:2))now+=60000;let n=Object.values(w.nations[id].nodes).filter(n=>n.good===good&&(n.zone||'surface')==='surface').sort((a,b)=>a.readyAt-b.readyAt)[0];assert.ok(n,`${id} ${good} resource`);now=Math.max(now,n.readyAt);at(id,n);act(id,{type:'mine',node:n.id});}}
 function craft(id:string,good:string,times:number){at(id,facilities(w.config.size).workbench);for(let i=0;i<times;i++)act(id,{type:'craft',good});}
 for(const id of ids){mine(id,'wood',4);mine(id,'stone',5);act(id,{type:'tool',tool:'axe'});act(id,{type:'tool',tool:'pickaxe'});mine(id,'wood',32);mine(id,'stone',28);craft(id,'plank',12);craft(id,'masonry',12);}
 for(const b of Object.values(w.bridges))for(const id of [b.a,b.b]){at(id,bridgeStation(w,id,b.id));act(id,{type:'bridge',bridge:b.id,good:'plank',quantity:12});act(id,{type:'bridge',bridge:b.id,good:'masonry',quantity:6});}
 mine('hualian','cotton',20);mine('hinomi','clay',20);mine('sahar','sand',20);mine('sahar','oil',20);for(const id of ids)craft(id,'plank',4);
 function exchange(a:string,b:string,good:string,q:number){const bridge=Object.values(w.bridges).find(t=>(t.a===a&&t.b===b)||(t.a===b&&t.b===a))!;at(a,bridgeStation(w,a,bridge.id));at(b,bridgeStation(w,b,bridge.id));const id=`trade-${serial}`;act(a,{type:'tradeRequest',id,other:b,give:{[good]:q},receive:{wood:1}});const t=Object.values(w.trades).at(-1)!;act(a,{type:'tradeConfirm',trade:t.id,revision:0});act(b,{type:'tradeConfirm',trade:t.id,revision:0});}
 if(trade){const sources={cotton:'hualian',clay:'hinomi',sand:'sahar',oil:'sahar'};for(const [good,source]of Object.entries(sources))for(const target of ids){if(target===source)continue;let i=ids.indexOf(source);while(ids[i]!==target){const next=(i+1)%ids.length;exchange(ids[i],ids[next],good,3);i=next;}}
 // Imported processed blocks make processing interdependence visible as well.
 for(let i=0;i<ids.length;i++)exchange(ids[i],ids[(i+1)%ids.length],'plank',3);
 for(const id of ids){at(id,facilities(w.config.size).warehouse);const quantity=w.players[id].bag.plank.length-3;if(quantity>0)act(id,{type:'warehouse',direction:'deposit',good:'plank',quantity});}
 act('teacher',{type:'stage',stage:2});act('teacher',{type:'resume'});
 }else { // Isolate material feasibility without bypassing it in the actual game: stage stays locked.
  w.stage=2;
 }
 const result:Array<{nation:string;blocks:number;importedKinds:number;complete:boolean}>=[];for(const id of ids){const origin=missionPlotOrigin(w.config.size,0),h=blueprint(w,id).heights;at(id,{x:origin.x+2,z:origin.z+2});const usable=['cotton','clay','sand','oil','plank','wood','stone'].filter(g=>w.players[id].bag[g].length);let i=0;h.forEach((r,z)=>r.forEach((height,x)=>{for(let y=0;y<height;y++){const good=usable[i++%usable.length];act(id,{type:'place',x,y,z,good});}}));const check=landmarkCheck(w,id);result.push({nation:template(w,id).name,blocks:check.count,importedKinds:check.imported,complete:check.ready});if(check.ready)act(id,{type:'register',name:'교역 정원',description:'서로 가진 것을 바꾸어 함께 만든 작품이에요.'});}assert.ok(w.lesson<=w.config.totalLessons);return {world:w,trade,lessons:w.lesson,minutes:Math.ceil((now-1700000000000)/60000),result};
}
if(process.argv[1]?.includes('sandbox-simulate')){for(const trade of [false,true]){const out=simulateSandbox(trade);assert.ok(out.result.every(n=>n.complete===trade));console.log(trade?'교역 있음':'교역 없음 (건축 단계 잠금을 가정 해제하여 재료 조건만 비교)');console.table(out.result);console.log(`자원 재생·체력 회복 대기 포함 ${out.minutes}분, ${out.lessons}차시. 이동·협상·수업 설명 시간은 별도.`);}}
