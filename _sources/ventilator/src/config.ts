export type Mode = 'PC'|'VC'|'SIMV-PC'|'SIMV-VC'|'VG'|'PSV'|'PRVC'|'VSV'|'VAPS';
export type View = Mode|'VTV';
export type Key = keyof Settings;
export interface Settings { dp:number; ti:number; rr:number; peep:number; fio2:number; rise:number; trigger:number; vt:number; delivery:number; pause:number; pattern:number; ps:number; ets:number; maxTi:number; limit:number; apnea:number; backupDp:number; backupRr:number; backupTi:number; psOn:number; vgOn:number; vgBase:number; supplement:number; highP:number; lowVt:number; lowMv:number; lowSpo2:number }
export interface Patient { spontaneous:number; rate:number; effort:number; compliance:number; resistance:number; leak:number }
export interface Param { label:string; unit:string; min:number; max:number; step:number; help:string }
const p=(label:string,unit:string,min:number,max:number,step:number,help:string):Param=>({label,unit,min,max,step,help});
export const PARAMS:Record<Key,Param>={
 dp:p('吸气压力差 ΔPinsp','cmH₂O',2,30,1,'高于 PEEP 的压力差；潮气量还取决于吸气时间、阻力及顺应性。'),
 ti:p('指令吸气时间 Ti','s',.2,1.5,.05,'改变指令呼吸持续时间；频率不变时也会改变可用呼气时间。'),
 rr:p('指令呼吸频率','次/min',5,50,1,'调节定时指令呼吸；实际送气频率还受患儿触发影响。'),
 peep:p('呼气末正压 PEEP','cmH₂O',0,20,1,'改变呼气基线。本模型不模拟肺复张、过度扩张及循环效应。'),
 fio2:p('吸入氧浓度 FiO₂','%',21,100,1,'主要影响氧合模型，不直接改变压力、流量、容量波形。'),
 rise:p('压力上升时间','s',.02,.4,.02,'决定达到目标压力的速度，观察吸气早期流量及压力曲线。'),
 trigger:p('流量触发阈值','L/min',.2,5,.1,'阈值越高越难触发；太低时漏气扰动可能引发误触发。'),
 vt:p('目标潮气量 Vt','mL',30,180,5,'固定 15 kg；同时观察 mL/kg、实际 Vte 及压力限制。'),
 delivery:p('送气时间','s',.2,1.2,.05,'同一目标容量下改变送气时间，流量由系统重新计算。'),
 pause:p('吸气末暂停','s',0,.5,.05,'送气后停止气流；适当静态条件下可观察平台压。'),
 pattern:p('流量波形','',0,1,1,'方波与递减流量保持相同目标 Vt 和送气时间，流量分布不同。'),
 ps:p('自主呼吸压力支持 PS','cmH₂O',0,25,1,'高于 PEEP 的支持压力；SIMV 中只作用于自主支持呼吸。'),
 ets:p('呼气切换阈值 ETS','%峰流量',5,70,5,'流量降到峰值的该比例后结束支持吸气；数值提高通常更早切换。'),
 maxTi:p('支持呼吸最大 Ti','s',.3,2, .1,'当流量切换未发生时，限制支持吸气持续时间。'),
 limit:p('最大吸气压力','cmH₂O',15,50,1,'绝对气道压力上限；容量目标可能因压力受限而无法达标。'),
 apnea:p('窒息判定时间','s',3,20,1,'无有效触发达到该时间后进入后备 PC-A/C，需手动切回。'),
 backupDp:p('后备吸气压力差','cmH₂O',2,30,1,'后备 PC-A/C 使用的高于 PEEP 的压力差。'),
 backupRr:p('后备频率','次/min',5,50,1,'后备通气的定时频率；恢复努力后仍保持后备状态。'),
 backupTi:p('后备吸气时间','s',.2,1.5,.05,'后备指令呼吸的吸气时间。'),
 psOn:p('PSV 支持','',0,1,1,'开启后对 SIMV 指令间的自主呼吸给予独立 PS。'),
 vgOn:p('VG 容量保障','',0,1,1,'仅对压力指令分支启用容量反馈，不调节间期 PS。'),
 vgBase:p('基础呼吸序列','',0,1,1,'选择 A/C 或 SIMV；VG 只调节指令呼吸的压力。'),
 supplement:p('容量补充流量','L/min',2,30,1,'VAPS 中容量不足时转入同一口气内的流量补充阶段。'),
 highP:p('高气道压报警','cmH₂O',10,50,1,'报警阈值与最大吸气压力限制分别设置。'),
 lowVt:p('低 Vte 报警','mL',10,150,5,'针对完整机械呼吸的呼出容量，观察漏气、支持不足或力学变化。'),
 lowMv:p('低分钟通气报警','L/min',.1,5,.1,'按完整 60 秒窗口统计，计算中不使用未成熟窗口触发此报警。'),
 lowSpo2:p('低 SpO₂ 报警','%',75,97,1,'按教学情境自定阈值，不代表所有儿童通用氧合目标。')
};
export const DEFAULT:Settings={dp:12,ti:.7,rr:25,peep:5,fio2:30,rise:.08,trigger:1,vt:105,delivery:.65,pause:.1,pattern:0,ps:8,ets:25,maxTi:1.2,limit:35,apnea:8,backupDp:12,backupRr:25,backupTi:.7,psOn:1,vgOn:0,vgBase:0,supplement:10,highP:30,lowVt:50,lowMv:1,lowSpo2:90};
export const PATIENT:Patient={spontaneous:0,rate:25,effort:5,compliance:50,resistance:25,leak:0};
export const MODES:Record<Mode,{name:string;intro:string;detail:string}>={
 PC:{name:'PC-A/C',intro:'定时或患儿触发 · 压力控制 · 时间切换',detail:'机器按设定压力差和吸气时间供气。压力是控制目标，实际潮气量由肺部力学、残余容量和患儿努力共同决定。有效患者触发也得到完整指令呼吸。'},
 VC:{name:'VC-A/C',intro:'定时或患儿触发 · 容量控制 · 设定送气与暂停',detail:'机器按归一化流量曲线送入目标容量，再进入可调暂停。未达到压力限制时容量相对稳定；气道压力随阻力、顺应性及努力变化。'},
 'SIMV-PC':{name:'SIMV · 压力控制',intro:'同步指令呼吸 ＋ 指令间自主呼吸',detail:'同步窗内的有效触发获得指令呼吸；指令间自主呼吸可启用独立PS。VG只作用于压力指令分支。同步窗口采用公开的教学调度，不模拟某品牌全部内部时序。'},
 'SIMV-VC':{name:'SIMV · 容量控制',intro:'容量指令呼吸 ＋ 独立自主支持',detail:'指令呼吸使用目标容量与送气时序；间期呼吸由患儿驱动，可加独立PS。ETS用于支持呼吸，而非容量指令呼吸。'},
 VG:{name:'VGV / VG',intro:'基础压力呼吸 ＋ 容量反馈保障',detail:'目标是稳定平均潮气量，呼吸间自动调整压力；压力上限、漏气和强自主努力可能导致容量偏离目标。此页把新生儿VG的反馈概念用于15kg教学模型，不代表该设备或新生儿临床设置。'},
 PSV:{name:'PSV',intro:'患儿触发 · 压力支持 · 流量切换',detail:'呼吸由患儿启动，机器维持支持压力，流量下降至切换阈值或达到最大吸气时间时转为呼气。无有效触发时进入后备通气，恢复后由学员手动切回。'},
 PRVC:{name:'PRVC',intro:'容量为目标 · 压力方式送气 · 逐口反馈',detail:'以压力控制方式供气，依据上一口完整呼吸的测量容量调整下一口压力。当前实现为公开说明的教学反馈控制器，不声称复刻厂商专有算法。'},
 VSV:{name:'VSV',intro:'自主支持呼吸 ＋ 容量目标',detail:'患儿触发并按流量切换，系统依据容量结果调整下一口支持压力。无有效触发时采用与本实验室PSV相同的后备状态；这是教学约定。'},
 VAPS:{name:'VAPS',intro:'一口气内的压力支持与容量补充',detail:'先按压力支持供气；达到流量切换条件而容量不足时，在同一口气内以补充流量继续供气，直至达到目标或最大吸气时间。简化原理参考教材第182—183页。'}
};
export const isSimv=(m:Mode,s:Settings)=>m.startsWith('SIMV')||(m==='VG'&&s.vgBase===1);
export const hasVG=(m:Mode,s:Settings)=>m==='VG'||(m==='SIMV-PC'&&s.vgOn===1);
export function keysFor(m:Mode,s:Settings):Key[]{
 const common:Key[]=['peep','fio2','trigger'];
 let keys:Key[]=[];
 if(m==='VC'||m==='SIMV-VC') keys=['vt','delivery','pause','pattern','rr','limit'];
 else if(m==='PSV') keys=['ps','rise','ets','maxTi','limit'];
 else if(m==='VSV') keys=['vt','limit','rise','ets','maxTi'];
 else if(m==='VAPS') keys=['vt','ps','supplement','rr','rise','ets','maxTi','limit'];
 else keys=[...(m==='VG'?['vgBase' as Key]:[]),...(hasVG(m,s)||m==='PRVC'?['vt','limit'] as Key[]:['dp','limit'] as Key[]),'ti','rr','rise'];
 if(m==='SIMV-PC') keys.push('vgOn');
 if(isSimv(m,s)){keys.push('psOn');if(s.psOn) keys.push('ps','ets','maxTi','rise');}
 if(m==='PSV'||m==='VSV') keys.push('apnea','backupDp','backupRr','backupTi');
 return [...new Set([...keys,...common])];
}
export const ALARM_KEYS:Key[]=['highP','lowVt','lowMv','lowSpo2'];
export function editableKeys(m:Mode,s:Settings):Key[]{return [...keysFor(m,s),...ALARM_KEYS];}
export interface LockedParam {key:Key;label:string;reason:string;kind:'automatic'|'derived'|'unavailable'}
export function lockedParams(m:Mode,s:Settings):LockedParam[]{
 const enabled=new Set(keysFor(m,s));const auto=hasVG(m,s)||m==='PRVC'||m==='VSV';
 const reasons:LockedParam[]=[
  {key:'dp',label:'吸气压力差 ΔPinsp',kind:auto?'automatic':m==='PSV'||m==='VAPS'?'unavailable':'derived',reason:auto?'由容量反馈自动调节，不能同时手动指定压力。':m==='PSV'||m==='VAPS'?'当前使用PS设置支持压力，没有独立的指令吸气压力旋钮。':'压力由容量输送、流量和患儿力学产生，不是本模式的独立设置。'},
  {key:'vt',label:'潮气量（监测）',kind:'derived',reason:'当前采用压力控制或支持，潮气量是实际结果，不能另设容量目标。'},
  {key:'rr',label:'呼吸频率（监测）',kind:'derived',reason:'自主支持模式不设指令频率；由有效触发决定。后备频率在后备设置中单独调节。'},
  {key:'ti',label:'总吸气时间 Ti',kind:'derived',reason:m==='VC'||m==='SIMV-VC'?'由送气时间与吸气末暂停相加得到，不能再独立指定。':'由流量切换与最大吸气时间共同决定，实际时间是结果。'},
  {key:'ps',label:'自主呼吸压力支持 PS',kind:m==='VSV'?'automatic':'unavailable',reason:m==='VSV'?'支持压力由容量反馈自动调节，不能同时手动指定PS。':isSimv(m,s)?'尚未开启PSV；开启后才可调节自主支持。':'本模式没有独立的自主压力支持分支。'},
  {key:'ets',label:'呼气切换阈值 ETS',kind:'unavailable',reason:isSimv(m,s)?'仅对开启PSV后的支持呼吸生效，不控制指令呼吸。':'本模式按设定时间切换，不能用ETS改变指令呼吸。'},
  {key:'maxTi',label:'支持呼吸最大 Ti',kind:'unavailable',reason:'本模式未启用流量切换的支持呼吸；指令吸气时间由指令设置控制。'},
  {key:'rise',label:'压力上升时间',kind:'derived',reason:'当前容量送气按所选流量轮廓控制，压力建立过程不是独立旋钮；启用PSV可调节支持分支。'},
  {key:'delivery',label:'容量送气时间',kind:'unavailable',reason:'当前不是预置流量的容量送气方式；请使用本模式的吸气或切换设置。'},
  {key:'pause',label:'吸气末暂停',kind:'unavailable',reason:'本教学模式不包含独立的吸气末暂停阶段。'},
  {key:'pattern',label:'预置流量波形',kind:'derived',reason:'流量由压力目标、呼吸努力和力学决定，不能独立选择容量送气轮廓。'}
 ];
 return reasons.filter(p=>!enabled.has(p.key));
}
export function validate(s:Settings,mode:Mode='PC'):string|null{
 for(const k of Object.keys(PARAMS) as Key[]){const d=PARAMS[k];if(!Number.isFinite(s[k])||s[k]<d.min||s[k]>d.max)return d.label+'超出教学探索范围。';}
 if(s.peep+2>=s.limit)return '最大吸气压力需高于 PEEP 至少 2 cmH₂O。';
 const inspiratory=mode==='VC'||mode==='SIMV-VC'?s.delivery+s.pause:mode==='VAPS'?s.maxTi:s.ti;
 if(mode!=='PSV'&&mode!=='VSV'&&inspiratory>=60/s.rr-.15)return '呼吸周期不足：请减少吸气时间或降低指令频率，保留至少 0.15 s 呼气时间。';
 if(s.backupTi>=60/s.backupRr-.15)return '后备通气必须保留呼气时间。';
 return null;
}
