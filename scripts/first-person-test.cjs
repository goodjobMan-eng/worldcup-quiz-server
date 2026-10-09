const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader'],headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:800}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const snapshot=()=>page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('nationlab-session'));return JSON.parse(localStorage.getItem('nationlab-room-'+(s.serverId?s.serverId+'--':'')+s.code));});
 try{
 await page.goto('http://127.0.0.1:3000');await page.getByRole('button',{name:'혼자 체험하기',exact:true}).click();
 await page.getByRole('button',{name:'1라운드 회의 시작',exact:true}).click();await page.getByRole('button',{name:'활동 시작',exact:true}).click();
 await page.getByLabel('체험 역할').selectOption('demo-hualian');
 const canvas=page.locator('canvas[data-view="first-person"]');await canvas.waitFor();
 await page.waitForFunction(()=>document.querySelector('canvas[data-view="first-person"]')?.dataset.renderer==='webgl');
 const box=await canvas.boundingBox();const size=await page.evaluate(()=>({w:innerWidth,h:innerHeight}));assert.ok(box.width>=size.w-1&&box.height>=size.h-1);
 assert.equal(await page.locator('.nl-header').isVisible(),false);
 await page.keyboard.down('w');
 await page.waitForFunction(()=>{const s=JSON.parse(localStorage.getItem('nationlab-session'));const e=JSON.parse(localStorage.getItem('nationlab-room-'+s.serverId+'--'+s.code));return e.positions['demo-hualian']?.y===4;});
 await page.keyboard.up('w');
 const before=await snapshot();assert.equal(before.positions['demo-hualian'].x,3);assert.equal(before.positions['demo-hualian'].y,4);
 // Facing north: look down toward the cotton block one tile ahead.
 let aimed=false;
 for(let i=0;i<7;i++){
  await page.mouse.move(size.w*.7,size.h*.4);await page.mouse.down();await page.mouse.move(size.w*.7,size.h*.4+22,{steps:4});await page.mouse.up();
  await page.waitForTimeout(150);
  if(await canvas.getAttribute('data-aim')==='3,3'){aimed=true;break;}
 }
 assert.ok(aimed,'crosshair picks the actual adjacent resource');
 await page.screenshot({path:'/workspace/onboarding/nationlab-first-person.png'});
 await page.getByRole('button',{name:'조준한 대상 사용',exact:true}).click();
 await page.waitForFunction(()=>{const s=JSON.parse(localStorage.getItem('nationlab-session'));const e=JSON.parse(localStorage.getItem('nationlab-room-'+s.serverId+'--'+s.code));return e.state.players['demo-hualian'].stamina===14;});
 const after=await snapshot();assert.equal(after.state.countries.hualian.stock.cotton.length,1);assert.equal(after.positions['demo-hualian'].y,4);
 await page.getByRole('button',{name:'창고',exact:true}).filter({visible:true}).click();
 await page.getByRole('heading',{name:'우리 나라 공동 창고',exact:true}).waitFor();
 await page.getByRole('button',{name:'닫고 게임으로 돌아가기 ×',exact:true}).click();
 // Joystick right has independent pointer capture from look and performs one or more legal moves.
 const stick=page.getByRole('group',{name:'이동 조이스틱',exact:true});const r=await stick.boundingBox();
 await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2,r.y+r.height*.83);
 await page.waitForFunction(()=>{const s=JSON.parse(localStorage.getItem('nationlab-session'));return JSON.parse(localStorage.getItem('nationlab-room-'+s.serverId+'--'+s.code)).positions['demo-hualian'].y>4;});await page.mouse.up();
 await page.getByRole('button',{name:'메뉴 · 지도',exact:true}).click();await page.getByRole('button',{name:'교사 화면',exact:true}).click();
 await page.getByRole('button',{name:'정산으로 넘어가기',exact:true}).click();await page.getByRole('button',{name:'우리 섬',exact:true}).click();
 await page.getByRole('button',{name:'1인칭 게임으로 들어가기',exact:true}).click();
 await page.getByRole('button',{name:'성찰',exact:true}).click();await page.getByRole('textbox',{name:'다른 나라와 교류할 수 없어서 어떤 점이 불편했나요?',exact:true}).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS: student first-person auto-entry, viewport filling, keyboard walking/collision, drag look, center-target mining/stamina/inventory, joystick walking, warehouse drawer, settlement reflection, teacher overview.');
 }catch(e){await page.screenshot({path:'/workspace/onboarding/nationlab-first-person-failure.png'});console.error((await page.locator('body').innerText()).slice(-2000));throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
