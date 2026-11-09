import {useEffect,useRef,useState} from 'react';
import {Engine,type LoopPoint} from './engine';
export function RespiratoryLoops({engine}:{engine:Engine}){
 const [device,setDevice]=useState(false);const [previous,setPrevious]=useState(true);
 return <section className="loops-section" aria-label="动态呼吸环"><div className="loops-heading"><div><h2>动态呼吸环</h2><p>当前呼吸实时描记，虚线保留上一呼吸；固定坐标。</p></div><div className="loop-options"><label>测量位置<select aria-label="呼吸环测量位置" value={device?'device':'lung'} onChange={e=>setDevice(e.target.value==='device')}><option value="lung">肺端流量与容量</option><option value="device">设备测量端</option></select></label><label><input type="checkbox" checked={previous} onChange={e=>setPrevious(e.target.checked)}/>上一呼吸</label></div></div><div className="loop-grid"><LoopCanvas engine={engine} type="pv" device={device} previous={previous}/><LoopCanvas engine={engine} type="fv" device={device} previous={previous}/></div>{engine.loopPrevious.length>0&&!engine.previousLoopComplete&&<p className="loop-note">上一呼吸因模式切换而截断，不视为完整呼吸环。</p>}<div className="loop-legend"><span>实线：当前呼吸</span><span>青色：吸气</span><span>金色：呼气</span><span>圆点：当前进度</span></div><p className="loop-note">{device?'设备端容量按本口气送入量减去回收量积分；漏气时可出现未闭合。':'肺端容量以本次吸气开始时为零；气体陷闭请结合呼气末流量及模型PEEPi判断，肺端环闭合不代表没有漏气。'} 曲线不强行封口，未回到起点时保留真实缺口。</p><details><summary>如何理解呼吸环</summary><p>P–V环横轴为气道压力，纵轴为容量；F–V环横轴为容量，纵轴为流量，吸气为正、呼气为负。箭头表示时间方向。当前是动态环，受阻力、流速、努力影响，不能直接当作静态顺应性或跨肺压测量。</p><p>本模型采用线性单室C/R，不生成缺乏模型依据的肺复张拐点、鸭嘴征或小气道动态塌陷的勺状环；环形态也不能单独确诊反向触发等不同步。</p></details></section>
}
function LoopCanvas({engine,type,device,previous}:{engine:Engine;type:'pv'|'fv';device:boolean;previous:boolean}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{let id=0;const canvas=ref.current!;const ctx=canvas.getContext('2d')!;
  function draw(){const rect=canvas.getBoundingClientRect(),dpr=devicePixelRatio||1,w=rect.width,h=rect.height;if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
   const l=46,r=20,t=42,b=40;const xr=type==='pv'?[-10,60]:[-100,500],yr=type==='pv'?[-100,500]:[-60,60];
   const x=(v:number)=>l+(v-xr[0])/(xr[1]-xr[0])*(w-l-r),y=(v:number)=>h-b-(v-yr[0])/(yr[1]-yr[0])*(h-t-b);
   const values=(p:LoopPoint)=>{const v=device?p.deviceV:p.v;return type==='pv'?[p.p,v]:[v,device?p.deviceQ:p.q];};
   ctx.fillStyle='#dbedf4';ctx.font='13px system-ui';ctx.fillText(type==='pv'?'压力–容量环 P–V':'流量–容量环 F–V',12,20);ctx.font='10px system-ui';ctx.fillStyle='#afc6d2';ctx.fillText(type==='pv'?'容量 mL':'流量 L/min',l,35);ctx.fillText(type==='pv'?'压力 cmH₂O':'容量 mL',w-104,h-9);
   for(const v of type==='pv'?[0,20,40,60]:[0,100,200,300,400,500]){ctx.strokeStyle=v===0?'#597387':'#2a4558';ctx.beginPath();ctx.moveTo(x(v),t);ctx.lineTo(x(v),h-b);ctx.stroke();ctx.fillStyle='#afc6d2';ctx.fillText(String(v),x(v)-8,h-b+16);}
   for(const v of type==='pv'?[0,100,200,300,400,500]:[-60,-30,0,30,60]){ctx.strokeStyle=v===0?'#597387':'#2a4558';ctx.beginPath();ctx.moveTo(l,y(v));ctx.lineTo(w-r,y(v));ctx.stroke();ctx.fillStyle='#afc6d2';ctx.fillText(String(v),8,y(v)+3);}
   let clipped=false;ctx.save();ctx.beginPath();ctx.rect(l,t,w-l-r,h-t-b);ctx.clip();
   function trace(points:LoopPoint[],old:boolean){if(points.length<2)return;ctx.lineWidth=old?1.5:2;ctx.setLineDash(old?[4,4]:[]);for(let i=1;i<points.length;i++){const a=values(points[i-1]),c=values(points[i]);if(c[0]<xr[0]||c[0]>xr[1]||c[1]<yr[0]||c[1]>yr[1])clipped=true;ctx.strokeStyle=old?'#8297a6':points[i].phase==='expiration'?'#eac46e':'#65ddc5';ctx.beginPath();ctx.moveTo(x(a[0]),y(a[1]));ctx.lineTo(x(c[0]),y(c[1]));ctx.stroke();}
    if(!old){for(const phase of ['inspiration','expiration']){const indices=points.map((p,i)=>p.phase===phase?i:-1).filter(i=>i>1);if(indices.length>4){const k=Math.floor(indices.length*.45),i=indices[k],j=indices[Math.max(0,k-Math.max(3,Math.floor(indices.length*.08)))],a=values(points[j]),c=values(points[i]);const dx=x(c[0])-x(a[0]),dy=y(c[1])-y(a[1]);if(Math.hypot(dx,dy)>1){const angle=Math.atan2(dy,dx);ctx.fillStyle=phase==='expiration'?'#eac46e':'#65ddc5';ctx.beginPath();ctx.moveTo(x(c[0]),y(c[1]));ctx.lineTo(x(c[0])-7*Math.cos(angle-.5),y(c[1])-7*Math.sin(angle-.5));ctx.lineTo(x(c[0])-7*Math.cos(angle+.5),y(c[1])-7*Math.sin(angle+.5));ctx.closePath();ctx.fill();}}}
     const end=values(points.at(-1)!);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x(end[0]),y(end[1]),3,0,Math.PI*2);ctx.fill();}
   }
   if(previous)trace(engine.loopPrevious,true);trace(engine.loopCurrent,false);ctx.restore();ctx.setLineDash([]);if(clipped){ctx.fillStyle='#f6c590';ctx.font='11px system-ui';ctx.fillText('超出固定坐标',w-95,35);}if(!engine.loopCurrent.length&&!engine.loopPrevious.length){ctx.fillStyle='#b5cbd6';ctx.font='12px system-ui';ctx.fillText('等待有效呼吸',l+15,h/2);}id=requestAnimationFrame(draw);
  }draw();return()=>cancelAnimationFrame(id);
 },[engine,type,device,previous]);
 return <canvas className="loop-canvas" ref={ref} role="img" aria-label={(type==='pv'?'动态压力容量环':'动态流量容量环')+(device?'，设备测量端':'，肺端')+'，吸气与呼气分色，箭头表示时间方向'}/>;
}
