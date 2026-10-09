import {apply,makeWorld,normalize} from './engine';
import {spawn,walkable,heightAt,surfaceHeight} from './terrain';
import type {Session,Envelope,Command,Pos,SandboxWorld} from './types';
export type Connection={apiKey:string;authDomain:string;databaseURL:string;projectId:string;appId:string};
const settingsKey='nl3-connection',sessionKey='nl3-session';
const notifications=new Set<()=>void>();const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('nationlab-sandbox'):null;
const notify=()=>{channel?.postMessage('changed');notifications.forEach(f=>f());};channel?.addEventListener('message',()=>notifications.forEach(f=>f()));window.addEventListener('storage',()=>notifications.forEach(f=>f()));
export const storageKey=(s:Pick<Session,'serverId'|'code'>)=>`nl3-room:${s.serverId}:${s.code}`;
const path=(s:Pick<Session,'serverId'|'code'>)=>`sandboxes/${s.serverId}/${s.code}`;
export function readConnection():Connection|null {try{return JSON.parse(localStorage.getItem(settingsKey)||'null')||(globalThis as any).NATIONLAB_CONFIG.firebase?.apiKey&&(globalThis as any).NATIONLAB_CONFIG.firebase||null;}catch{return null;}}
export function saveConnection(c:Connection){if(!c.apiKey||!c.authDomain||!c.projectId||!c.appId||!/^https:\/\/[a-z0-9.-]+\.(firebaseio\.com|firebasedatabase\.app)\/?$/i.test(c.databaseURL))throw Error('Firebase 웹 설정의 다섯 항목을 확인해 주세요.');clientPromise=undefined;localStorage.setItem(settingsKey,JSON.stringify(c));localStorage.removeItem(sessionKey);}
export function importConnection(){const h=new URLSearchParams(location.hash.slice(1));if(!h.has('firebase'))return;try{const c=JSON.parse(decodeURIComponent(escape(atob(h.get('firebase')!))));if(JSON.stringify(readConnection())!==JSON.stringify(c))saveConnection(c);}catch{throw Error('접속 링크의 Firebase 설정이 올바르지 않아요. 선생님께 새 QR을 받아 주세요.');}}
export function invite(s:Session,w:SandboxWorld){const url=new URL(location.href);url.search='';url.searchParams.set('room',s.code);url.searchParams.set('server',s.serverId);url.searchParams.set('mode',s.mode);url.searchParams.set('region',w.regionId);url.searchParams.set('district',w.district);url.hash=s.mode==='firebase'?'firebase='+encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(readConnection()))))):'';return url.href;}
export function restore():Session|null{try{return JSON.parse(localStorage.getItem(sessionKey)||'null');}catch{return null;}}
function remember(s:Session){localStorage.setItem(sessionKey,JSON.stringify(s));}
export function leave(){localStorage.removeItem(sessionKey);}
let offset=0;export const now=()=>Date.now()+offset;
let clientPromise:Promise<any>|undefined;
async function client(){if(!clientPromise)clientPromise=(async()=>{
 const c=readConnection();if(!c)throw Error('선생님 화면에서 Firebase 서버 설정을 먼저 저장해 주세요.');if(location.protocol==='file:')throw Error('실시간 수업은 HTTPS 배포 주소에서 열어 주세요.');
 const [apps,auths,dbs,fs]=await Promise.all([import('firebase/app'),import('firebase/auth'),import('firebase/database'),import('firebase/firestore')]);
 const app=apps.getApps().find(a=>a.name==='sandbox-'+c.projectId)||apps.initializeApp(c,'sandbox-'+c.projectId),auth=auths.getAuth(app),db=dbs.getDatabase(app),firestore=fs.getFirestore(app);const emulator=(globalThis as any).NATIONLAB_CONFIG.emulator;
 if(emulator?.enabled){if(!auth.emulatorConfig)auths.connectAuthEmulator(auth,`http://${emulator.host}:${emulator.authPort}`,{disableWarnings:true});dbs.connectDatabaseEmulator(db,emulator.host,emulator.databasePort);fs.connectFirestoreEmulator(firestore,emulator.host,emulator.firestorePort||8080);}
 await auths.setPersistence(auth,auths.browserLocalPersistence);await auth.authStateReady();if(!auth.currentUser)await auths.signInAnonymously(auth);dbs.onValue(dbs.ref(db,'.info/serverTimeOffset'),s=>{offset=Number(s.val()||0);});return {...dbs,...auths,fs,firestore,auth,db};
})().catch(e=>{clientPromise=undefined;throw e;});return clientPromise;}
export async function googleLogin(){const f=await client();if(f.auth.currentUser.providerData.some((p:any)=>p.providerId==='google.com'))return;await f.signInWithPopup(f.auth,new f.GoogleAuthProvider());}
function localUid(){let id=localStorage.getItem('nl3-uid');if(!id){id='local-'+crypto.randomUUID();localStorage.setItem('nl3-uid',id);}return id;}
function localRead(s:Session):Envelope|null{const raw=localStorage.getItem(storageKey(s));return raw?JSON.parse(raw):null;}
function localWrite(s:Session,e:Envelope){localStorage.setItem(storageKey(s),JSON.stringify(e));notify();}
async function locked<T>(s:Session,fn:()=>T){if(!navigator.locks)throw Error('최신 크롬이나 삼성 인터넷에서 열어 주세요.');return navigator.locks.request(storageKey(s),fn);}
export async function create(mode:Session['mode'],info:{school:string;className:string;serverId:string;regionId:string;district:string;nations:string[]},demo=false){
 if(!info.school.trim()||info.school.length>40||!info.className.trim()||info.className.length>24)throw Error('학교와 반 이름을 적어 주세요.');const f=mode==='firebase'?await client():null;if(f&&!f.auth.currentUser.providerData.some((p:any)=>p.providerId==='google.com'))throw Error('선생님은 Google 로그인 후 방을 만들 수 있어요.');
 const uid=f?.auth.currentUser.uid||localUid();for(let attempt=0;attempt<10;attempt++){
 const code=String(1000+crypto.getRandomValues(new Uint32Array(1))[0]%9000),s:Session={mode,uid,code,serverId:info.serverId,schoolKey:encodeURIComponent(info.school).replace(/%/g,'_'),...(demo?{demo:true}:{})};let w=makeWorld(code,uid,info.school,info.className,info.serverId,info.regionId,info.district,info.nations,now());
 if(demo){for(const [i,id]of Object.keys(w.nations).entries())w=apply(w,'demo-'+id,{type:'join',nickname:['별이','바다','모래','달빛','새봄','나무'][i]}, {},now());w=apply(w,uid,{type:'autoAssign'}, {},now());}
 const e:Envelope={state:w,positions:{},members:{[uid]:{nickname:'교사'}}};if(demo)for(const p of Object.values(w.players)){e.members[p.id]={nickname:p.nickname};e.positions[p.id]=spawn(w,p.id);}
 if(f){try{const r=await f.runTransaction(f.ref(f.db,path(s)),(old:any)=>old===null?e:undefined,{applyLocally:false});if(!r.committed)continue;}catch(error:any){if(String(error.code).includes('PERMISSION'))continue;throw error;}}
 else {const ok=await locked(s,()=>{if(localRead(s))return false;localWrite(s,e);return true;});if(!ok)continue;}
 remember(s);return s;
 }throw Error('방을 만들지 못했어요. Firebase 보안 규칙을 확인해 주세요.');
}
export async function join(mode:Session['mode'],serverId:string,code:string,nickname:string){if(!/^\d{4}$/.test(code)||!nickname.trim()||nickname.trim().length>16)throw Error('방 코드와 별명(16자 이내)을 확인해 주세요.');const f=mode==='firebase'?await client():null;const s:Session={mode,serverId,code,uid:f?.auth.currentUser.uid||localUid(),schoolKey:''};
 if(f){const member=f.ref(f.db,path(s)+'/members/'+s.uid);let existed=false;try{existed=(await f.get(member)).exists();if(!existed)await f.set(member,{nickname:nickname.trim()});const state=(await f.get(f.ref(f.db,path(s)+'/state'))).val();s.schoolKey=encodeURIComponent(state.school).replace(/%/g,'_');if(!state.players?.[s.uid])await send(s,{type:'join',nickname});}catch(e:any){if(!existed&&!e.pending)await f.remove(member).catch(()=>{});throw Error('입장하지 못했어요. 서버·코드와 선생님 화면 연결을 확인해 주세요. '+e.message);}}
 else await locked(s,()=>{const e=localRead(s);if(!e)throw Error('이 서버에 해당 방이 없어요. 연습은 같은 브라우저에서만 공유돼요.');e.state=apply(e.state,s.uid,{type:'join',nickname});e.members[s.uid]={nickname:nickname.trim()};s.schoolKey=encodeURIComponent(e.state.school).replace(/%/g,'_');localWrite(s,e);});remember(s);return s;
}
const positions:Record<string,Record<string,Pos>>={};const teachers:Record<string,string>={};
export function subscribe(s:Session,receive:(e:Envelope|null)=>void,error:(e:Error)=>void){let disposed=false,stopState=()=>{},stopPositions=()=>{},timer:any,latest:Envelope|null=null,running=false,lastIsland='',lastPublished='',publishTimer:any;let positionMap:Record<string,Pos>={};
 const emit=()=>{if(latest){latest.positions=positionMap;positions[storageKey(s)]=positionMap;teachers[storageKey(s)]=latest.state.teacher;}receive(latest?{...latest,positions:positionMap}:null);};
 async function publish(f:any,w:SandboxWorld){if(w.teacher!==s.uid)return;const signature=JSON.stringify([Object.keys(w.players),Object.values(w.nations).map(n=>n.registration?.status==='approved'?n.registration:null)]);if(signature===lastPublished)return;clearTimeout(publishTimer);publishTimer=setTimeout(async()=>{if(disposed)return;try{const payload={teacher:s.uid,school:w.school,className:w.className,members:Object.fromEntries([s.uid,...Object.keys(w.players)].map(id=>[id,true])),landmarks:Object.fromEntries(Object.values(w.nations).filter(n=>n.registration?.status==='approved').map(n=>[n.id,{name:n.registration!.name,description:n.registration!.description,count:n.registration!.count,packed:JSON.stringify(Object.values(n.registration!.voxels).map(v=>[v.x,v.y,v.z,v.unit.good,v.unit.sources,v.unit.processor||'',v.unit.processes||[]]))}]))};await f.fs.setDoc(f.fs.doc(f.firestore,'classroomLandmarks',s.uid,'rooms',s.serverId+'--'+s.code),payload);lastPublished=signature;}catch(e){error(Error('갤러리 저장 연결을 확인해 주세요: '+(e as Error).message));}},600);}
 async function drain(f:any){if(disposed||running||!latest||latest.state.teacher!==s.uid)return;const requests=Object.entries(latest.inbox||{}).flatMap(([uid,list])=>Object.entries(list).map(([id,command])=>({uid,id,command}))).slice(0,80);if(!requests.length)return;running=true;try{const result=await f.runTransaction(f.ref(f.db,path(s)+'/state'),(raw:any)=>{if(!raw)return;let w=normalize(raw);for(const r of requests){if(w.receipts[r.id])continue;try{if(!latest?.members[r.uid])throw Error('참가자가 아니에요.');w=apply(w,r.uid,{...r.command,id:r.id},positions[storageKey(s)]||{},now());}catch(e){w.receipts[r.id]={ok:false,message:(e as Error).message,at:now()};}}return w;},{applyLocally:false});if(result.committed){const remove=Object.fromEntries(requests.map(r=>[`inbox/${r.uid}/${r.id}`,null]));await f.update(f.ref(f.db,path(s)),remove);}}catch(e){error(e as Error);}finally{running=false;if(!disposed)timer=setTimeout(()=>{timer=undefined;drain(f);},70);}}
 if(s.mode==='local'){const update=()=>{try{const e=localRead(s);receive(e?{...e,state:normalize(e.state)}:null);}catch(e){error(e as Error);}};notifications.add(update);update();stopState=()=>{notifications.delete(update);};}
 else client().then(f=>{
  if(disposed)return;
  const stops:Array<()=>void>=[];let members:Envelope['members']={},inbox:Envelope['inbox']={};let hostSubscribed=false;
  const schedule=()=>{if(latest?.state.teacher===s.uid&&!timer&&!running)timer=setTimeout(()=>{timer=undefined;drain(f);},35);};
  stops.push(f.onValue(f.ref(f.db,path(s)+'/members'),(v:any)=>{members=v.val()||{};if(latest)latest.members=members;emit();schedule();},error));
  stops.push(f.onValue(f.ref(f.db,path(s)+'/state'),(snap:any)=>{
   const raw=snap.val();latest=raw?{state:normalize(raw),members,positions:positionMap,inbox}:null;
   const island=latest?.state.teacher===s.uid?'*':latest?.state.players[s.uid]?.location||'';
   if(island!==lastIsland||!lastIsland){stopPositions();lastIsland=island;const r=f.ref(f.db,path(s)+'/positions');const q=island==='*'?r:f.query(r,f.orderByChild('island'),f.equalTo(island));stopPositions=f.onValue(q,(v:any)=>{positionMap=v.val()||{};emit();},error);}
   if(latest?.state.teacher===s.uid){if(!hostSubscribed){hostSubscribed=true;stops.push(f.onValue(f.ref(f.db,path(s)+'/inbox'),(v:any)=>{inbox=v.val()||{};if(latest)latest.inbox=inbox;schedule();},error));}publish(f,latest.state);schedule();}emit();
  },error));stopState=()=>stops.forEach(stop=>stop());
 }).catch(error);
 return()=>{disposed=true;clearTimeout(timer);clearTimeout(publishTimer);stopState();stopPositions();};
}
export async function send(s:Session,c:Command,actor=s.uid){if(s.mode==='firebase'&&actor!==s.uid)throw Error('다른 학생의 행동을 대신할 수 없어요.');const cmd={...c,id:crypto.randomUUID()};if(s.mode==='local'){await locked(s,()=>{const e=localRead(s);if(!e)throw Error('삭제된 방이에요.');e.state=apply(e.state,actor,cmd,e.positions,now());localWrite(s,e);});return;}
 const f=await client(),r=f.ref(f.db,path(s)+'/state'),teacher=teachers[storageKey(s)]||(await f.get(f.ref(f.db,path(s)+'/state/teacher'))).val();if(teacher===s.uid){let failure:Error|undefined;const result=await f.runTransaction(r,(raw:any)=>{if(!raw)return;try{failure=undefined;return apply(raw,actor,cmd,positions[storageKey(s)]||{},now());}catch(e){failure=e as Error;return;}},{applyLocally:false});if(!result.committed)throw failure||Error('다시 시도해 주세요.');return;}
 await f.set(f.ref(f.db,path(s)+`/inbox/${s.uid}/${cmd.id}`),cmd);return new Promise<void>((resolve,reject)=>{let stop=()=>{};const timeout=setTimeout(()=>{stop();reject(Object.assign(Error('선생님 화면 연결을 기다리고 있어요. 다시 누르기 전에 결과를 확인해 주세요.'),{pending:true}));},25000);stop=f.onValue(f.ref(f.db,path(s)+'/state/receipts/'+cmd.id),(snap:any)=>{const receipt=snap.val();if(!receipt)return;clearTimeout(timeout);queueMicrotask(()=>stop());receipt.ok?resolve():reject(Error(receipt.message));},(e:Error)=>{clearTimeout(timeout);queueMicrotask(()=>stop());reject(e);});});
}
export async function move(s:Session,w:SandboxWorld,p:Pos,actor=s.uid){if(s.mode==='firebase'&&actor!==s.uid)return;const player=w.players[actor];if(!player||player.location!==p.island||(p.zone||'surface')!==(player.zone||'surface')||!walkable(w,p.island,p.x,p.z,now(),p.zone)||w.phase!=='playing'||now()>=w.endsAt)return;const next={...p,y:surfaceHeight(w,p.island,p.x,p.z,p.zone),at:now()};if(s.mode==='local')await locked(s,()=>{const e=localRead(s);if(!e||e.state.phase!=='playing')return;e.positions[actor]=next;localWrite(s,e);});else{const f=await client();await f.set(f.ref(f.db,path(s)+'/positions/'+s.uid),next);}}
export async function removeRoom(s:Session){if(s.mode==='local'){await locked(s,()=>{if(localRead(s)?.state.teacher!==s.uid)throw Error('선생님만 삭제할 수 있어요.');localStorage.removeItem(storageKey(s));notify();});}else{const f=await client();await f.fs.deleteDoc(f.fs.doc(f.firestore,'classroomLandmarks',s.uid,'rooms',s.serverId+'--'+s.code));await f.remove(f.ref(f.db,path(s)));}leave();}
