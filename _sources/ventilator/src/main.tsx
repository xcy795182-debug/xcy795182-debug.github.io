import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Engine,type Snapshot} from './engine';
import {DEFAULT,PATIENT,PARAMS,MODES,keysFor,ALARM_KEYS,lockedParams,type Mode,type View,type Key,type Patient,type Settings} from './config';
import './style.css';

function Icon({name}:{name:'wave'|'reset'|'lock'}){return <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{name==='wave'?<path d="M2 12h4l3-8 5 16 3-8h5"/>:name==='reset'?<><path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/></>:<><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></>}</svg>}
function NumberField({id,label,value,min,max,step,error,onCommit}:{id:string;label:string;value:number;min:number;max:number;step:number;error:boolean;onCommit:(n:number)=>void}){
 const [draft,setDraft]=useState(String(value));
 useEffect(()=>setDraft(String(value)),[value]);
 function commit(){if(draft!==String(value))onCommit(draft.trim()===''?NaN:Number(draft));}
 return <input id={id} aria-label={label} type="number" min={min} max={max} step={step} value={draft} aria-invalid={error||undefined} aria-describedby={error?'error-'+id:undefined} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/>;
}
const COLORS=['#65ddc5','#eac46e','#91baff'];
function Waveforms({engine}:{engine:Engine}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{let raf=0;const canvas=ref.current!;const ctx=canvas.getContext('2d')!;
  function draw(){const rect=canvas.getBoundingClientRect();const dpr=devicePixelRatio||1;if(canvas.width!==Math.round(rect.width*dpr)||canvas.height!==Math.round(rect.height*dpr)){canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);const w=rect.width,h=rect.height;ctx.clearRect(0,0,w,h);
   const left=w<500?47:68,right=16,top=27,row=(h-20)/3;
   const ranges=[[-10,60],[-60,60],[-100,500]];const labels=['气道压力','流量','容量变化'];const units=['cmH₂O','L/min','mL · 相对初始基线'];
   const end=Math.max(12,engine.t),start=end-12;
   const x=(t:number)=>left+(t-start)/12*(w-left-right);
   for(let i=0;i<3;i++){const base=i*row;const [min,max]=ranges[i];const y=(v:number)=>base+top+row-49-(v-min)/(max-min)*(row-49);ctx.font='12px system-ui';ctx.fillStyle=COLORS[i];ctx.fillText(labels[i],8,base+13);ctx.fillStyle='#8199aa';ctx.font='10px system-ui';ctx.fillText(units[i],w<500?80:92,base+13);
    for(let t=Math.ceil(start);t<=end;t++){ctx.strokeStyle='#263e50';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(x(t),base+top);ctx.lineTo(x(t),base+row-22);ctx.stroke();if(i===2&&t%2===0){ctx.fillStyle='#90a6b8';ctx.fillText(t+'s',x(t)-5,base+row-5);}}
    const ticks=i===0?[0,20,40,60]:i===1?[-60,0,60]:[-100,0,200,400];
    for(const v of ticks){ctx.strokeStyle=v===0?'#526b7e':'#263e50';ctx.beginPath();ctx.moveTo(left,y(v));ctx.lineTo(w-right,y(v));ctx.stroke();ctx.fillStyle='#8ca1b4';ctx.fillText(String(v),left-29,y(v)+3);}
    ctx.save();ctx.beginPath();ctx.rect(left,base+top,w-left-right,row-49);ctx.clip();ctx.strokeStyle=COLORS[i];ctx.lineWidth=1.8;ctx.beginPath();let first=true;for(const sample of engine.samples){if(sample.t<start)continue;const value=[sample.p,sample.q,sample.v][i];if(first){ctx.moveTo(x(sample.t),y(value));first=false;}else ctx.lineTo(x(sample.t),y(value));}ctx.stroke();
    if(i===0){for(const e of engine.events){if(e.t<start||e.t>end)continue;ctx.fillStyle=e.type==='missed'?'#f2b87c':e.type==='auto'?'#fa8a9c':'#85a1b6';if(e.type==='effort'){ctx.fillText('↑',x(e.t)-3,base+row-26);}if(e.type==='missed'||e.type==='auto'){ctx.fillText(e.type==='missed'?'×':'!',x(e.t)-3,base+top+10);}}
     if(engine.simv){ctx.font='8px system-ui';for(const b of engine.breaths){if(b.start<start||b.start>end)continue;ctx.fillStyle=b.kind==='指令'?'#65ddc5':'#a9bbd4';ctx.fillText(b.kind==='指令'?(b.trigger==='时间触发'?'指·时':'指·患'):b.kind==='支持'?'支持':'自主',x(b.start)+2,base+top+10);}}
    }
    ctx.restore();const values=engine.samples.map(s=>[s.p,s.q,s.v][i]);if(values.some(v=>v>max||v<min)){ctx.fillStyle='#f2b87c';ctx.fillText('↕ 超出固定坐标',w-112,base+13);}
   }
   if(engine.samples.length){ctx.strokeStyle='#c3e1ed';ctx.setLineDash([2,4]);ctx.beginPath();ctx.moveTo(x(engine.t),26);ctx.lineTo(x(engine.t),h-23);ctx.stroke();ctx.setLineDash([]);}
   raf=requestAnimationFrame(draw);
  }draw();return()=>cancelAnimationFrame(raf);
 },[engine]);
 return <canvas ref={ref} className="wave-canvas" role="img" aria-label="同步动态压力、流量和容量波形，固定坐标和12秒时间窗"/>;
}
const form=(n:number|null,d=0)=>n===null?'—':n.toFixed(d);
function App(){
 const engine=useRef(new Engine()).current;
 const [view,setView]=useState<View>('PC');const [mode,setMode]=useState<Mode>('PC');const [settings,setSettings]=useState<Settings>({...DEFAULT});const [patient,setPatient]=useState<Patient>({...PATIENT});
 const [snap,setSnap]=useState<Snapshot>(engine.snapshot());const [note,setNote]=useState('直接调节左侧参数，观察同一时间轴上的压力、流量和容量变化。');const [error,setError]=useState('');const [errorKey,setErrorKey]=useState<Key|null>(null);const [panel,setPanel]=useState(false);const [tab,setTab]=useState('通气设置');
 const [formRevision,setFormRevision]=useState(0);const memory=useRef<Partial<Record<Mode,Settings>>>({});const [life,setLife]=useState('');
 useEffect(()=>{let raf=0,last=performance.now(),acc=0,lastUi=0;
  function tick(now:number){const elapsed=Math.min((now-last)/1000,.1);last=now;if(!document.hidden){acc+=elapsed;while(acc>=.005){engine.step(.005);acc-=.005;}if(now-lastUi>120){setSnap(engine.snapshot());lastUi=now;}}raf=requestAnimationFrame(tick);}
  function visibility(){last=performance.now();acc=0;if(!document.hidden){setLife('已恢复模拟时钟，后台期间未补算呼吸。');setTimeout(()=>setLife(''),4500);}}
  document.addEventListener('visibilitychange',visibility);raf=requestAnimationFrame(tick);return()=>{cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',visibility);};
 },[engine]);
 function change(k:Key,value:number){setErrorKey(k);const def=PARAMS[k];if(!Number.isFinite(value)||value<def.min||value>def.max){setError('请输入显示范围内的有效数值。');return;}
  const previous=engine.settings[k];const message=engine.change({[k]:value});if(message){setError(message);return;}setError('');setErrorKey(null);setSettings({...engine.settings});
  setNote(`${def.label}由 ${previous} 调至 ${value}${def.unit}。${def.help}`);
 }
 function choose(m:Mode,v:View=m){setFormRevision(n=>n+1);memory.current[mode]={...engine.settings};const saved=memory.current[m];const next={...DEFAULT,...saved,peep:settings.peep,fio2:settings.fio2,trigger:settings.trigger,...(v==='VTV'?{vt:settings.vt}:{})};
  engine.switchMode(m,next);setSettings(next);setMode(m);setView(v);setError('');setNote('患儿状态保留。'+(saved?'恢复该模式上次设置。':'本模式使用教学初始设置。')+'模式将在呼气阶段切换，不保证切换前后支持等效。');
 }
 function updatePatient(k:keyof Patient,value:number){const next={...patient,[k]:value};engine.setPatient({[k]:value});setPatient(next);setNote(k==='compliance'?'肺扩张难易程度已改变。观察相同设置下的实际容量或压力；其他条件也会影响结果。':k==='resistance'?'气流通过难易程度已改变。关注流量衰减、呼气是否充分，以及实际潮气量和压力。':k==='leak'?'回路漏气已改变。本模型展示未充分补偿的漏气扰动，关注 Vti/Vte 差异与误触发标记。':'自主吸气努力已改变。↑ 标记每次努力；× 表示无效触发，! 表示无努力的误触发。');}
 function reset(){setFormRevision(n=>n+1);engine.reset(mode);setSettings({...DEFAULT});setPatient({...PATIENT});setNote('当前模式与患儿状态已恢复初始值，历史波形已清空。');setError('');setSnap(engine.snapshot());}
 const automatic=mode==='PRVC'||mode==='VG'||mode==='VSV'||(mode==='SIMV-PC'&&settings.vgOn===1);
 const keys=tab==='视觉报警'?ALARM_KEYS:keysFor(mode,settings);
 const paramGroups=[{name:'主要设置',keys:keys.filter(k=>['dp','vt','ps','rr','ti','peep','fio2'].includes(k))},{name:'送气与触发',keys:keys.filter(k=>['delivery','pause','pattern','rise','trigger','ets','maxTi','limit','supplement'].includes(k))},{name:'模式组合',keys:keys.filter(k=>['psOn','vgOn','vgBase'].includes(k))},{name:'窒息与后备',keys:keys.filter(k=>['apnea','backupDp','backupRr','backupTi'].includes(k))},{name:'视觉报警阈值',keys:keys.filter(k=>ALARM_KEYS.includes(k))}].filter(g=>g.keys.length);
 const selectLabels:Partial<Record<Key,string[]>>={pattern:['恒定流量 · 方波','递减流量'],psOn:['关闭 PSV','开启 PSV'],vgOn:['关闭 VG','开启 VG'],vgBase:['PC-A/C','PC-SIMV']};
 const lastBreath=engine.breaths.at(-1);const actualTe=lastBreath?Math.max(0,lastBreath.end-lastBreath.start-lastBreath.ti):null;
 const locked=lockedParams(mode,settings);
 function lockedValue(k:Key,kind:string):string{
  if(kind==='unavailable')return '不适用';
  if(k==='dp'||k==='ps')return kind==='automatic'?form(snap.autoDp,1)+' cmH₂O':'随送气过程变化';
  if(k==='vt')return snap.vte?form(snap.vte)+' mL（Vte）':'等待完整呼吸';
  if(k==='rr')return snap.rate===null?'统计中':form(snap.rate)+' 次/min';
  if(k==='ti')return mode==='VC'||mode==='SIMV-VC'?form(settings.delivery+settings.pause,2)+' s':form(lastBreath?.ti??null,2)+' s';
  return k==='rise'?'由流量轮廓决定':'随压力与力学变化';
 }
 const lastEvents=engine.events.filter(e=>e.type!=='effort').slice(-3).reverse();
 return <div className="app-shell"><a className="skip-link" href="#monitor">跳到动态波形与监测</a>
  <header><a className="brand" href="#"><span className="brand-mark"><Icon name="wave"/></span><span>呼吸机<span className="brand-sub">原理实验室</span></span></a><div className="header-right"><span className="patient-chip"><i/>儿童 · 15 kg</span><span className="preview-chip">教学开发预览</span><button className="reset" aria-label="恢复初始设置" onClick={reset}><Icon name="reset"/> <span>恢复初始</span></button></div></header>
  <main><div className="page-heading"><div><div className="eyebrow">PEDIATRIC VENTILATION LAB</div><h1>看见每一次呼吸的原理</h1><p>调节参数，观察波形，理解机器与患儿如何共同完成呼吸。</p></div><span className="time"><i/> 模拟运行 <b>{Math.floor(snap.t/60).toString().padStart(2,'0')}:{Math.floor(snap.t%60).toString().padStart(2,'0')}</b></span></div>
   <nav className="mode-nav" aria-label="通气模式">{(['PC','VC','SIMV-PC','SIMV-VC','VG','PSV','VTV','PRVC'] as View[]).map(m=><button key={m} className={view===m?'active':''} aria-pressed={view===m} onClick={()=>m==='VTV'?choose('VG','VTV'):choose(m)}>{m==='VTV'?'VTV · 对照':MODES[m].name}</button>)}</nav>
   {view==='VTV'&&<div className="compare-bar"><strong>容量目标策略对照</strong><span>保留患儿状态与目标容量，切换控制方式</span><div>{(['VG','PRVC','VSV','VAPS'] as Mode[]).map(m=><button key={m} className={mode===m?'selected':''} aria-pressed={mode===m} onClick={()=>{const target=settings.vt;choose(m,'VTV');engine.change({vt:target});setSettings({...engine.settings});}}>{MODES[m].name}</button>)}</div></div>}
   <section className="mode-intro"><div><span className="mode-tag">{MODES[mode].name}</span><strong>{MODES[mode].intro}</strong></div><details><summary>模式原理</summary><p>{MODES[mode].detail}</p><p>机器设置与实际结果分别显示。所有参数范围为教学探索配置，不代表患儿处方。</p></details></section>
   <div className="workspace">
    <aside className={'controls '+(panel?'expanded':'')}><button className="mobile-toggle" onClick={()=>{setPanel(!panel);if(!panel)setTimeout(()=>document.querySelector('.wave-panel')?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}),80);}} aria-expanded={panel}>{panel?'收起调节面板 ⌄':'展开参数与患儿设置 ⌃'}</button><div className="control-body">
     <div className="control-title"><h2>调节与探索</h2><span>按模式开放 · 自动项锁定</span></div>
     <p className="input-hint">滑块实时生效，数字输入后按回车或移开焦点。</p><div className="control-tabs">{['通气设置','患儿状态','视觉报警'].map(t=><button key={t} className={tab===t?'on':''} aria-pressed={tab===t} onClick={()=>setTab(t)}>{t}</button>)}</div>
     {error&&<div className="input-error" role="alert">{error}</div>}
     {tab==='患儿状态'?<div className="patient-controls"><div className="patient-summary"><span>固定教学病例</span><strong>15 <small>kg</small></strong><p>探索力学与呼吸努力，观察同一设置的不同结果。</p></div>
      <label className="switch-row">自主呼吸<input type="checkbox" aria-label="自主呼吸" checked={!!patient.spontaneous} onChange={e=>updatePatient('spontaneous',+e.target.checked)}/></label>
      {([['rate','自主呼吸频率','次/min',5,50,1],['effort','吸气努力','cmH₂O',0,15,.5],['compliance','肺顺应性','',0,100,1],['resistance','气道阻力','',0,100,1],['leak','漏气程度','%',0,70,5]] as const).map(([k,label,unit,min,max,step])=><div className="param" key={k}><div className="param-top"><label htmlFor={'p-'+k}>{label}</label><span>{k==='compliance'?patient[k]<35?'较难扩张':patient[k]>65?'较易扩张':'中等':k==='resistance'?patient[k]<35?'较易通过':patient[k]>65?'较难通过':'中等':patient[k]+' '+unit}</span></div><input id={'p-'+k} aria-label={label} type="range" min={min} max={max} step={step} value={patient[k]} onChange={e=>updatePatient(k,+e.target.value)}/><div className="range-ends"><span>{k==='compliance'?'较难扩张':k==='resistance'?'较易通过':min}</span><span>{k==='compliance'?'较易扩张':k==='resistance'?'较难通过':max}</span></div></div>)}
     </div>:<>{paramGroups.map(group=><fieldset className="param-group" key={group.name}><legend>{group.name}</legend>{group.keys.map(k=>{const d=PARAMS[k];return <div className={'param '+(['dp','vt','ps'].includes(k)?'primary':'')} key={k}><div className="param-top"><label htmlFor={'s-'+k}>{d.label}</label>{!selectLabels[k]&&<div className="number-box"><NumberField key={mode+'-'+formRevision+'-'+k} id={'s-'+k} label={d.label} value={settings[k]} min={d.min} max={d.max} step={d.step} error={!!error&&errorKey===k} onCommit={n=>change(k,n)}/><span>{d.unit}</span></div>}</div>{selectLabels[k]?<select id={'s-'+k} aria-label={d.label} value={settings[k]} onChange={e=>change(k,+e.target.value)}>{selectLabels[k]!.map((label,i)=><option key={i} value={i}>{label}</option>)}</select>:<><input aria-label={d.label+'滑块'} type="range" min={d.min} max={d.max} step={d.step} value={settings[k]} onChange={e=>change(k,+e.target.value)}/><div className="range-ends"><span>{d.min}</span><span>{d.max}</span></div></>}{error&&errorKey===k&&<p className="field-error" id={'error-s-'+k}>{error}</p>}{k==='vt'&&<small className="kg-value">{(settings.vt/15).toFixed(1)} mL/kg · 固定 15 kg</small>}</div>})}</fieldset>)}{tab==='通气设置'&&<details className="locked-params"><summary><Icon name="lock"/>本模式锁定参数 <span>{locked.length} 项 · 查看原因</span></summary>{locked.map(p=><div className="locked-param" key={p.key}><div><label htmlFor={'locked-'+p.key}><Icon name="lock"/> {p.label}</label><span>{p.kind==='automatic'?'自动调节':p.kind==='derived'?'计算结果':'不适用'}</span></div><input id={'locked-'+p.key} aria-label={p.label+'（已锁定）'} disabled value={lockedValue(p.key,p.kind)}/><small>{p.reason}</small></div>)}</details>}</>}
     <p className="control-foot">探索范围用于教学，初始值不是临床推荐设置。</p>
    </div></aside>
    <section className="monitor-area" id="monitor" tabIndex={-1}>
     <div className={'alarm-bar '+(snap.alarms.length?'warning':'normal')} role="status"><span aria-hidden="true">{snap.alarms.length?'△':'✓'}</span><strong>{snap.alarms.length?snap.alarms.join(' / '):'当前未触发视觉报警'}</strong>{snap.backup&&<button onClick={()=>{engine.returnPSV();setNote('已手动返回自主支持模式。请观察有效触发及呼出潮气量。');}}>手动返回 {MODES[mode].name}</button>}</div>
     <div className="wave-panel"><div className="wave-header"><div><i className="live-dot"/><strong>{snap.backup?'后备 PC-A/C':MODES[mode].name}</strong><span>{snap.phase==='inspiration'?'吸气':snap.phase==='pause'?'吸气末暂停':'呼气'} · {snap.kind}</span></div><small>固定坐标 · 12 s</small></div><Waveforms engine={engine}/><div className="wave-legend"><span>↑ 患儿吸气努力</span><span>× 无效触发</span><span>! 误触发</span><span>容量以初始基线为参考</span></div></div>
     <div className="metrics primary-metrics"><Metric label="呼出潮气量 Vte" value={snap.vte?form(snap.vte):'—'} unit="mL" sub={snap.vte?form(snap.vte/15,1)+' mL/kg':'等待完整呼吸'} highlight={snap.vte>0&&snap.vte<settings.lowVt}/><Metric label="吸气峰压 PIP" value={form(snap.pip,1)} unit="cmH₂O" sub={'PEEP '+settings.peep+' cmH₂O'} highlight={snap.pip>settings.highP}/><Metric label="模拟 SpO₂" value={form(snap.spo2)} unit="%" sub="模型估计 · 持续更新" highlight={snap.spo2<settings.lowSpo2}/><Metric label="实际送气频率" value={form(snap.rate)} unit="次/min" sub={snap.rate===null?'完整60秒窗口计算中':'努力频率 '+form(snap.effortRate)+' 次/min'}/></div>
     <div className="explanation" aria-live="polite"><span className="explain-icon" aria-hidden="true">i</span><div><strong>{snap.pending?'设置待生效':'观察与理解'}</strong><p>{snap.alarms.includes('压力受限 · 容量可能未达标')?'已达到压力边界，实际容量可能仍低于目标。关注目标与实际Vt差异，并结合患儿力学和漏气判断。':note}</p></div></div>
     <details className="more-metrics"><summary>更多监测与模拟血气 <span>连续计算</span></summary><div className="metrics secondary-metrics"><Metric label="呼出分钟通气量" value={form(snap.mv,2)} unit="L/min" sub={snap.mv===null?'完整60秒窗口计算中':'按60秒滚动统计'}/><Metric label="模拟 PaCO₂" value={snap.domain?'域外':form(snap.co2,1)} unit="mmHg" sub="固定代谢假设"/><Metric label="模拟 pH" value={snap.domain?'域外':form(snap.ph,2)} unit="" sub="固定 HCO₃⁻ 24 mmol/L"/><Metric label="吸入潮气量 Vti" value={snap.vti?form(snap.vti):'—'} unit="mL" sub="设备测量端"/><Metric label={automatic?'自动吸气压力差':mode==='PSV'||mode==='VAPS'?'实际吸气时间':'总指令吸气时间'} value={automatic?form(snap.autoDp,1):mode==='PSV'||mode==='VAPS'?form(lastBreath?.ti??null,2):form(mode==='VC'||mode==='SIMV-VC'?settings.delivery+settings.pause:settings.ti,2)} unit={automatic?'cmH₂O':'s'} sub={automatic?'高于PEEP的部分':'支持呼吸以实际切换为准'}/><Metric label="平台压 Pplat" value={form(snap.plat,1)} unit="cmH₂O" sub={snap.plat===null?'当前不可可靠测量':'被动、密闭暂停条件'}/><Metric label="实际吸气时间" value={form(lastBreath?.ti??null,2)} unit="s" sub="上一完整呼吸"/><Metric label="实际呼气时间" value={form(actualTe,2)} unit="s" sub={actualTe!==null&&lastBreath?'I:E = 1:'+form(actualTe/Math.max(.01,lastBreath.ti),2):'等待完整呼吸'}/><Metric label="模型呼气末肺泡压" value={form(snap.totalPeep,1)} unit="cmH₂O" sub="模型状态估计，非阻断实测"/></div></details>
     <div className="event-log"><span>呼吸事件</span>{lastEvents.length?lastEvents.map((e,i)=><small key={i}><b>{e.t.toFixed(1)} s</b> {e.label}</small>):<small>等待触发或模式变化</small>}</div>
     {life&&<p className="lifecycle">{life}</p>}
    </section>
   </div>
   <details className="model-notes"><summary>模型假设与参考资料 <span>了解模拟边界</span></summary><div><p>这是固定15 kg儿童的通用原理教学模型。参数范围及初始值用于探索，不是临床处方。正式出版前需完成医学审阅。</p><p>采用单室线性力学；顺应性和阻力可调，保留肺内残余气量。不模拟PEEP引起的肺复张、过度扩张或循环变化。容量曲线为相对初始基线变化，不是绝对肺容量。</p><p>PaCO₂ / pH / SpO₂ 为持续更新的教学估计值：固定代谢、死腔30 mL、HCO₃⁻24 mmol/L及简化分流；不代表实际血气检测，不模拟代谢性酸碱改变。气体交换响应有延迟。</p><p>VG / PRVC 是有界容量反馈教学控制器，SIMV采用明示的同步窗口。漏气模型表示未充分补偿的回路；不复刻厂商专有算法。</p><ul><li>用户资料：《儿童机械通气》第7—10章及《呼吸机模式》。</li><li><a href="https://www.hamilton-medical.com/en_DK/Products/Compare/Compare-ventilation-modes.html" target="_blank" rel="noreferrer">Hamilton 官方模式原理说明</a></li><li><a href="https://www.draeger.com/Content/Documents/Content/volume-guarantee-fibel-bk-9097501-en.pdf" target="_blank" rel="noreferrer">Dräger VG 原理资料（新生儿机制参考）</a></li><li><a href="https://pmc.ncbi.nlm.nih.gov/articles/9848214/" target="_blank" rel="noreferrer">PALICC-2：儿科监测与肺保护原则</a></li></ul></div></details>
   <footer><span>儿童呼吸机 · 原理实验室</span><span>理解原理，从每一次调节开始。</span></footer>
  </main>
 </div>;
}
function Metric({label,value,unit,sub,highlight=false}:{label:string;value:string;unit:string;sub:string;highlight?:boolean}){return <div className={'metric '+(highlight?'metric-alert':'')}><span>{label}</span><strong>{value}<small>{unit}</small></strong><p>{sub}</p></div>}
createRoot(document.getElementById('root')!).render(<App/>);
