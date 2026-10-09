const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');

(async()=>{
 const browser=await chromium.launch({...(fs.existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:800},hasTouch:true,isMobile:true}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(process.env.NATIONLAB_URL||'http://127.0.0.1:3003');
  await page.getByRole('button',{name:'설정 없이 혼자 체험하기'}).click();
  await page.getByRole('button',{name:'새 차시 시작',exact:true}).click();
  const indices=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('nl3-session'));const e=JSON.parse(localStorage.getItem(`nl3-room:${s.serverId}:${s.code}`));return Object.fromEntries(Object.values(e.state.players).map((p,i)=>[p.nation,i]));});
  const index=indices.hualian;
  await page.getByRole('button',{name:'학생 체험',exact:true}).nth(index).click();
  await page.locator('canvas[data-renderer="webgl"]').waitFor();
  const first=await page.locator('canvas').evaluate(el=>JSON.parse(el.dataset.animals||'[]'));
  assert.equal(first.length,5);assert.ok(first.every(a=>a.kind==='sheep'&&a.name==='양'));
  await page.evaluate(animal=>{const s=JSON.parse(localStorage.getItem('nl3-session')),key=`nl3-room:${s.serverId}:${s.code}`,e=JSON.parse(localStorage.getItem(key));const p=Object.values(e.state.players).find(p=>p.nation==='hualian');e.positions[p.id]={island:p.nation,zone:'surface',x:animal.x,y:1,z:animal.z+4};localStorage.setItem(key,JSON.stringify(e));},first[0]);
  await page.reload();await page.getByRole('button',{name:'학생 체험',exact:true}).nth(index).click();await page.locator('canvas[data-renderer="webgl"]').waitFor();
  const before=await page.locator('canvas').evaluate(el=>JSON.parse(el.dataset.animals||'[]'));
  await page.waitForFunction(x=>{const a=JSON.parse(document.querySelector('canvas')?.dataset.animals||'[]')[0];return a&&Math.hypot(a.x-x.x,a.z-x.z)>.08;},before[0]);
  await page.screenshot({path:'/workspace/onboarding/nationlab-animals.png'});
  for(const [nation,kind] of[['hinomi','deer'],['sahar','camel'],['lumina','goat']]){
   await page.getByRole('button',{name:'게임 설정'}).click();
   await page.getByRole('button',{name:'교사 체험으로'}).click();
   await page.getByRole('button',{name:'학생 체험',exact:true}).nth(indices[nation]).click();
   await page.locator('canvas[data-renderer="webgl"]').waitFor();
   await page.waitForFunction(expected=>JSON.parse(document.querySelector('canvas')?.dataset.animals||'[]').some(a=>a.kind===expected),kind);
   const seen=await page.locator('canvas').evaluate(el=>JSON.parse(el.dataset.animals||'[]'));
   assert.equal(seen.length,4);assert.ok(seen.every(a=>a.kind===kind));
  }
  assert.deepEqual(errors,[]);
  console.log('PASS roaming sheep, deer, camels and goats in four classroom islands on tablet WebGL');
 }catch(e){await page.screenshot({path:'/workspace/onboarding/nationlab-animals-failure.png'});throw e;}
 finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
