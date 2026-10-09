import { useEffect, useRef, useState } from 'react';
export function requestGameFullscreen() {
  if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
    void document.documentElement.requestFullscreen().catch(() => {});
  }
}
export default function FirstPersonControls({nickname,country,stamina,progress,phase,time,active,mining,aimLabel,canUse,onMove,onUse,onPanel,onOverview,onFullscreen,drawer,closeDrawer,notice}: {
  nickname:string; country:string; stamina:number; progress:number; phase:string; time:number; active:boolean; mining:boolean; aimLabel:string; canUse:boolean;
  onMove:(forward:number,right:number)=>void; onUse:()=>void; onPanel:(panel:string)=>void; onOverview:()=>void; onFullscreen:()=>void; drawer:boolean; closeDrawer:()=>void; notice?:string;
}) {
  const callbacks=useRef({onMove,onUse});callbacks.current={onMove,onUse};
  const vector=useRef({forward:0,right:0});
  const keys=useRef(new Set<string>());
  const [stick,setStick]=useState({x:0,y:0});
  useEffect(()=>{
    const reset=()=>{keys.current.clear();vector.current={forward:0,right:0};setStick({x:0,y:0});};
    const down=(e:KeyboardEvent)=>{
      if(!active||drawer||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLSelectElement)return;
      if(['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();keys.current.add(e.key);}
      if((e.code==='Space'||e.key.toLowerCase()==='e')&&!e.repeat){e.preventDefault();callbacks.current.onUse();}
    };
    const up=(e:KeyboardEvent)=>keys.current.delete(e.key);
    const tick=setInterval(()=>{
      if(!active||drawer)return;
      const has=(...k:string[])=>k.some(x=>keys.current.has(x));
      const forward=vector.current.forward+(has('w','ArrowUp')?1:0)-(has('s','ArrowDown')?1:0);
      const right=vector.current.right+(has('d','ArrowRight')?1:0)-(has('a','ArrowLeft')?1:0);
      if(Math.abs(forward)+Math.abs(right)>.18)callbacks.current.onMove(forward,right);
    },180);
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',reset);document.addEventListener('visibilitychange',reset);
    return()=>{clearInterval(tick);window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',reset);reset();};
  },[active,drawer]);
  function stickMove(e:React.PointerEvent<HTMLDivElement>){
    const r=e.currentTarget.getBoundingClientRect();const x=(e.clientX-r.left-r.width/2),y=(e.clientY-r.top-r.height/2);const scale=36/Math.max(36,Math.hypot(x,y));
    setStick({x:x*scale,y:y*scale});vector.current={forward:-y*scale/36,right:x*scale/36};
  }
  function stopStick(){vector.current={forward:0,right:0};setStick({x:0,y:0});}
  return <div className="fp-hud" aria-label="학생 게임 화면">
    <div className="fp-top"><div className="fp-identity"><strong>{nickname} · {country}</strong><span>♥ 체력 {stamina} · 함께 지은 건물 {Math.round(progress*100)}%</span></div><div className="fp-phase">{phase} <b>{Math.floor(time/60)}:{String(time%60).padStart(2,'0')}</b></div><button onClick={onFullscreen} aria-label="브라우저 전체화면">⛶ 전체화면</button><button onClick={onOverview}>메뉴 · 지도</button></div>
    {!drawer&&<><div className="fp-crosshair" aria-hidden="true">＋</div><div className="fp-target" role="status">{mining?'캐고 있어요…':aimLabel||'오른쪽 화면을 밀어 둘러보세요'}</div>{!active&&<div className="fp-paused">{phase} 시간이에요. 잠시 멈추고 친구들과 이야기해요.</div>}
      <div className="fp-stick" role="group" aria-label="이동 조이스틱" onPointerDown={e=>{if(!active)return;e.currentTarget.setPointerCapture(e.pointerId);stickMove(e);}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))stickMove(e);}} onPointerUp={stopStick} onPointerCancel={stopStick} onLostPointerCapture={stopStick}><span style={{transform:`translate(${stick.x}px,${stick.y}px)`}}>✥</span><small>이동 · WASD</small></div>
      <button className="fp-use" disabled={!active||!canUse||mining} onClick={onUse} aria-label="조준한 대상 사용">{mining?'채집 중…':'캐기 / 사용'}<small>PC: E 또는 Space</small></button>
      <div className="fp-hotbar">{[['warehouse','▣','창고'],['craft','⚒','가공'],['trade','⚓','교역'],['build','▤','건축'],['reflect','✎','성찰']].map(([id,icon,name])=><button key={id} onClick={()=>onPanel(id)}><b>{icon}</b><span>{name}</span></button>)}</div>
    </>}
    {notice&&<div className="fp-notice" role="alert">{notice}</div>}
    {drawer&&<button className="fp-close-drawer" onClick={closeDrawer}>닫고 게임으로 돌아가기 ×</button>}
  </div>;
}
