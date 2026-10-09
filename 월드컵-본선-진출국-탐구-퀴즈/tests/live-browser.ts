import { chromium } from 'playwright';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import '../public/config.js';
import { serverId } from '../src/nationlab/servers';
const projectId='demo-nationlab-live';
const env=await initializeTestEnvironment({projectId,database:{host:'127.0.0.1',port:9000,rules:readFileSync('database.rules.json','utf8')}});
await env.clearDatabase();
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors:string[]=[];
const cfgScript=readFileSync('월드컵-본선-진출국-탐구-퀴즈/public/config.js','utf8')+`\nglobalThis.NATIONLAB_CONFIG.firebase={apiKey:'fake-emulator-key',authDomain:'${projectId}.firebaseapp.com',databaseURL:'https://${projectId}.firebaseio.com',projectId:'${projectId}',appId:'1:123:web:demo'};globalThis.NATIONLAB_CONFIG.emulator.enabled=true;`;
async function page(){const context=await browser.newContext({viewport:{width:1280,height:900}});await context.route('**/config.js*',r=>r.fulfill({contentType:'application/javascript',body:cfgScript}));const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:3000');return p;}
try {
  const teacher=await page();
  await teacher.getByLabel('학교 이름',{exact:true}).fill('연동검증초');
  await teacher.getByLabel('학급',{exact:true}).fill('6학년 1반');
  await teacher.getByRole('button',{name:'우리 교실 방 만들기',exact:true}).click();
  await teacher.getByRole('button',{name:'교사 화면',exact:true}).click();
  const code=await teacher.locator('.big-code').innerText();
  const district=serverId('seoul','동부'), path=`servers/${district}/rooms/${code}`;
  const read=async()=>{let result:any;await env.withSecurityRulesDisabled(async c=>{result=(await c.database().ref(path).get()).val();});return result;};
  const students=[];
  for(const name of ['하늘','바다','나무']){
    const p=await page();await p.getByRole('button',{name:'학생',exact:true}).click();
    await p.getByLabel('방 코드',{exact:true}).fill(code);await p.getByLabel('나의 별명',{exact:true}).fill(name);
    await p.getByRole('button',{name:'함께 시작하기',exact:true}).click();
    await p.getByRole('button',{name:'서버 바꾸기',exact:true}).waitFor();
    students.push(p);
  }
  await teacher.getByRole('button',{name:'자동 배정',exact:true}).click();
  await teacher.getByRole('button',{name:'1라운드 회의 시작',exact:true}).click();
  await teacher.getByRole('button',{name:'활동 시작',exact:true}).click();
  const latest=await read();
  assert.equal(Object.keys(latest.state.players).length,3);
  const a=students[0], player:any=Object.values(latest.state.players).find((p:any)=>p.nickname==='하늘');
  const node:any=Object.values(latest.state.countries[player.country].nodes)[0];
  await a.waitForFunction(()=>document.querySelector('.island-canvas')?.getAttribute('data-renderer')==='webgl');
  const canvas=a.locator('.island-canvas').first();await canvas.scrollIntoViewIfNeeded();
  const centers=JSON.parse(await canvas.getAttribute('data-tile-centers')||'{}');const b=(await canvas.boundingBox())!;const point=centers[`${node.x},${node.y}`];
  await a.mouse.click(b.x+b.width*point[0],b.y+b.height*point[1]);
  const start=Date.now();let mined=false;
  while(Date.now()-start<20000){const e=await read();if(!e.state.countries[player.country].nodes[node.id]){assert.equal(e.state.players[player.id].stamina,14);assert.equal(e.state.countries[player.country].stock[node.good].length,1);mined=true;break;}await new Promise(r=>setTimeout(r,200));}
  assert.ok(mined,'student request committed by teacher');
  await teacher.getByText('+1 ',{exact:false}).first().waitFor();
  await students[1].getByText('+1 ',{exact:false}).first().waitFor();
  let campuses:any;await env.withSecurityRulesDisabled(async c=>{campuses=(await c.database().ref(`campuses/${district}/${code}`).get()).val();});
  assert.equal(campuses.school,'연동검증초');
  await a.reload();await a.getByRole('button',{name:'서버 바꾸기',exact:true}).waitFor();
  const recovered=await read();assert.equal(recovered.state.players[player.id].stamina,14);
  assert.deepEqual(errors,[]);
  console.log('PASS: Firebase Auth + RTDB emulators; teacher and 3 independent student browsers, server-scoped join, teacher request transaction, shared mining/stock/stamina, building publication, refresh identity.');
}catch(e){console.error(e);throw e;}finally{await browser.close();await env.cleanup();}
