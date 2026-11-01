import {DEFAULT,PATIENT,PARAMS,editableKeys,hasVG,isSimv,validate,type Settings,type Patient,type Mode,type Key} from './config';
export type BreathKind='指令'|'支持'|'自主'|'后备'|'容量补充';
export interface Sample {t:number;p:number;q:number;v:number;effort:number;kind:string;trigger:string}
export interface Breath {start:number;end:number;kind:BreathKind;trigger:string;vti:number;vte:number;lungIn:number;pip:number;plat:number|null;ti:number;dp:number;limited:boolean}
export interface Event {t:number;label:string;type:'effort'|'success'|'missed'|'auto'|'mode'}
export interface Snapshot {t:number;phase:string;kind:string;backup:boolean;pip:number;vti:number;vte:number;mv:number|null;rate:number|null;effortRate:number|null;spo2:number;co2:number;ph:number;autoDp:number;plat:number|null;totalPeep:number;alarms:string[];limited:boolean;domain:boolean;pending:boolean;peakFlow:number}
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
export class Engine {
 mode:Mode='PC'; settings:Settings={...DEFAULT}; patient:Patient={...PATIENT};
 t=0; volume=.06; phase:'inspiration'|'pause'|'expiration'='expiration'; samples:Sample[]=[]; breaths:Breath[]=[]; events:Event[]=[];
 backup=false; autoDp=12; co2=40; spo2=96; ph=7.4; pending:Partial<Settings>|null=null; pendingMode:Mode|null=null;
 private active:Settings={...DEFAULT}; private start=0; private expStart=-1; private nextMandatory=0; private lastEffective=0; private current:Breath|null=null;
 private peak=0; private supplemental=false; private nextEffort=0; private effortStart=-100; private effortHandled=true; private lastSignal=0; private lastAuto=-100; private sampleAt=0; private rawP=5; private rawQ=0; private endPeep=5;
 get C(){return .004+this.patient.compliance/100*.016}
 get R(){return 10+this.patient.resistance/100*90}
 get leakG(){return this.patient.leak/100*.006}
 get simv(){return isSimv(this.mode,this.settings)}
 get supportOnly(){return this.mode==='PSV'||this.mode==='VSV'}
 get cycle(){return 60/(this.backup?this.settings.backupRr:this.settings.rr)}
 change(patch:Partial<Settings>):string|null {
  // 按变更后的权限检查，支持开启组合并配置参数，阻止关闭组合时夹带无效设置。
  const effectiveMode=this.pendingMode??this.mode;
  const candidate={...this.settings,...patch};
  const after=new Set(editableKeys(effectiveMode,candidate));
  for(const key of Object.keys(patch) as Key[]){
   if(!after.has(key))return `${PARAMS[key]?.label??key}在当前模式下已锁定，不能直接调节。`;
  }
  const next={...candidate,...(patch.vgOn===0&&this.settings.vgOn===1?{dp:this.autoDp}:{})};const error=validate(next,effectiveMode);if(error)return error;
  this.settings=next;this.pending={...this.pending,...patch};return null;
 }
 setPatient(patch:Partial<Patient>){this.patient={...this.patient,...patch};if(patch.spontaneous===1)this.nextEffort=this.t+.1;}
 switchMode(mode:Mode,s?:Settings){this.pendingMode=mode;if(s)this.settings={...s};}
 returnPSV(){this.backup=false;this.lastEffective=this.t;this.nextMandatory=this.t;this.log('手动返回自主支持','mode');}
 reset(mode:Mode=this.mode){Object.assign(this,new Engine());this.mode=mode;}
 private log(label:string,type:Event['type']){this.events.push({t:this.t,label,type});if(this.events.length>500)this.events.shift();}
 private finish(){
  const b=this.current;if(!b)return;
  b.end=this.t;this.breaths.push({...b});if(this.breaths.length>160)this.breaths.shift();
  if(!this.backup&&((hasVG(this.mode,this.active)&&b.kind==='指令')||this.mode==='PRVC'||this.mode==='VSV')){
   const feedback=this.mode==='PRVC'?b.vti:b.vte;
   const error=this.active.vt-feedback;
   if(Math.abs(error)>this.active.vt*.05)this.autoDp=clamp(this.autoDp+clamp(.5*error/1000/this.C,-2,2),2,Math.max(2,this.active.limit-this.active.peep));
  }
  this.current=null;
 }
 private applyMode(){
  if(!this.pendingMode)return;
  this.finish();this.mode=this.pendingMode;this.pendingMode=null;this.backup=false;this.autoDp=clamp(this.autoDp,2,this.settings.limit-this.settings.peep);this.nextMandatory=this.t;this.lastEffective=this.t;this.log('模式已切换','mode');
 }
 private begin(kind:BreathKind,trigger:string){
  this.endPeep=this.volume/this.C;this.finish();this.applyMode();this.active={...this.settings};this.pending=null;
  this.autoDp=clamp(this.autoDp,2,Math.max(2,this.active.limit-this.active.peep));
  this.phase='inspiration';this.start=this.t;this.peak=0;this.supplemental=false;
  this.current={start:this.t,end:this.t,kind,trigger,vti:0,vte:0,lungIn:0,pip:this.active.peep,plat:null,ti:0,dp:this.autoDp,limited:false};
  if(kind==='指令'||kind==='后备')this.nextMandatory=this.t+this.cycle;
 }
 private expire(){if(this.current)this.current.ti=this.t-this.start;this.phase='expiration';this.expStart=this.t;}
 private pressureFlow(paw:number,mus:number,dt:number){
  const eq=this.C*(paw+mus);const next=eq+(this.volume-eq)*Math.exp(-dt/(this.R*this.C));const q=(next-this.volume)/dt;this.volume=next;return q;
 }
 step(dt=.005){
  this.t+=dt;
  if(this.pendingMode&&this.phase==='expiration'&&this.t-this.expStart>.12)this.applyMode();
  if(this.patient.spontaneous&&this.t>=this.nextEffort){
   if(!this.effortHandled&&this.effortStart>-1)this.log('无效吸气努力','missed');
   this.effortStart=this.t;this.effortHandled=false;this.nextEffort=this.t+60/this.patient.rate;this.log('患儿吸气努力','effort');
  }
  const ea=this.t-this.effortStart;
  const mus=this.patient.spontaneous&&ea>=0&&ea<.75?this.patient.effort*Math.sin(Math.PI*ea/.75):0;
  if(!this.effortHandled&&ea>=.75){this.log('无效吸气努力','missed');this.effortHandled=true;}
  const s=this.settings;
  if(this.supportOnly&&!this.backup&&this.t-this.lastEffective>=s.apnea){this.backup=true;this.nextMandatory=this.t;this.log('窒息：进入后备 PC-A/C','mode');}
  const expReady=this.phase==='expiration'&&this.t-this.expStart>.12;
  if(expReady){
   const passiveQ=(s.peep+mus-this.volume/this.C)/this.R;
   // 未充分补偿的偏流漏气测量：扰动来自压力相关分流而非患儿努力。
   const leakSignal=s.peep*this.leakG*(.65+.35*Math.sin(this.t*2*Math.PI*1.3));
   const signal=Math.max(0,passiveQ)*60+leakSignal*60;
   const effective=mus>0&&!this.effortHandled&&signal>=s.trigger;
   const auto=mus===0&&signal>=s.trigger&&this.lastSignal<s.trigger&&this.t-this.lastAuto>.8;
   if(effective||auto){
    let kind:BreathKind;
    if(this.backup)kind='后备';
    else if(this.simv)kind=this.t>=this.nextMandatory-this.cycle*.2?'指令':(s.psOn?'支持':'自主');
    else kind=this.supportOnly?'支持':'指令';
    if(effective){this.lastEffective=this.t;this.effortHandled=true;this.log('有效患者触发','success');}
    else{this.lastAuto=this.t;this.log('漏气扰动误触发','auto');}
    this.begin(kind,effective?'患者触发':'误触发');
   }
   this.lastSignal=signal;
   if(this.phase==='expiration'&&(!this.supportOnly||this.backup)&&this.t>=this.nextMandatory)this.begin(this.backup?'后备':'指令','时间触发');
  }
  const a=this.active;const b=this.current;let paw=s.peep;let q=0;let deviceIn=0, recovered=0;
  if(this.phase==='inspiration'&&b){
   const age=this.t-this.start;const supported=b.kind==='支持'||b.kind==='自主';
   const vc=!this.backup&&!supported&&(this.mode==='VC'||this.mode==='SIMV-VC');
   const automated=!this.backup&&(this.mode==='PRVC'||this.mode==='VSV'||(hasVG(this.mode,a)&&!supported));
   const isVaps=this.mode==='VAPS'&&!this.backup;
   const limit=a.limit;
   if(vc||this.supplemental){
    const dur=vc?a.delivery:a.maxTi;
    const shape=a.pattern===0?1: (1-.75*clamp(age/a.delivery,0,1))/.625;
    const prescribed=vc?a.vt/1000/a.delivery*shape:a.supplement/60;
    const wanted=Math.min(prescribed,Math.max(0,a.vt-b.vti)/1000/dt);
    paw=(wanted+this.volume/(this.C*this.R)-mus/this.R)/(1/this.R+this.leakG);
    if(paw>limit){paw=limit;b.limited=true;q=this.pressureFlow(paw,mus,dt);deviceIn=Math.max(0,q)+paw*this.leakG;}
    else{const leak=Math.max(0,paw)*this.leakG;q=wanted-leak;this.volume+=q*dt;deviceIn=wanted;}
    if((vc&&age>=dur)||(!vc&&b.vti>=a.vt)){
     if(vc&&a.pause>0){this.phase='pause';b.ti=age;}
     else this.expire();
    }
   }else{
    const dp=this.backup?a.backupDp:automated?this.autoDp:b.kind==='自主'?0:(supported||isVaps)?a.ps:a.dp;
    paw=a.peep+dp*clamp(age/Math.max(.02,a.rise),0,1);
    if(paw>limit){paw=limit;b.limited=true;}
    q=this.pressureFlow(paw,mus,dt);deviceIn=Math.max(0,q)+Math.max(0,paw)*this.leakG;
    this.peak=Math.max(this.peak,Math.max(0,q));
    const flowCycled=(supported||isVaps)&&age>Math.max(.12,a.rise)&&q<=this.peak*a.ets/100;
    if(isVaps&&flowCycled&&b.vti<a.vt){this.supplemental=true;this.log('同一口气转入容量补充','mode');}
    else if((supported||isVaps)?flowCycled||age>=a.maxTi:age>=(this.backup?a.backupTi:a.ti))this.expire();
   }
   b.vti+=Math.max(0,deviceIn)*dt*1000;b.lungIn+=Math.max(0,q)*dt*1000;b.pip=Math.max(b.pip,paw);
   if(this.supplemental&&this.t-this.start>=a.maxTi)this.expire();
  }else if(this.phase==='pause'&&b){
   paw=this.volume/this.C-mus;q=0;
   if(this.leakG>0){q=-Math.max(0,paw)*this.leakG;this.volume+=q*dt;}
   if(!this.patient.spontaneous&&this.patient.leak===0)b.plat=paw;
   if(this.t-this.start>=a.delivery+a.pause)this.expire();
  }else{
   paw=s.peep;q=this.pressureFlow(paw,mus,dt);
   recovered=Math.max(0,-q-Math.max(0,paw)*this.leakG);
   if(b)b.vte+=recovered*dt*1000;
   // 自主但未被机器支持的气流仍真实存在，不通过触发事件伪造。
  }
  this.rawP=paw;this.rawQ=this.phase==='expiration'?-recovered:deviceIn;
  if(this.phase==='expiration'&&mus>0)this.rawQ=q;
  const recent=this.breaths.filter(x=>x.end>this.t-10);
  const va=recent.reduce((n,x)=>n+Math.max(0,x.vte-30),0)/1000*6;
  const target=va>.015?.863*90/va:180;
  this.co2+=(target-this.co2)*(1-Math.exp(-dt/30));
  this.ph=6.1+Math.log10(24/(.03*this.co2));
  const alveolar=s.fio2/100*(760-47)-this.co2/.8;
  const sat=(po:number)=>100*Math.pow(Math.max(0,po),2.7)/(Math.pow(Math.max(0,po),2.7)+Math.pow(26.8,2.7));
  const oxygen=.9*sat(alveolar)+.1*75;
  this.spo2+=(oxygen-this.spo2)*(1-Math.exp(-dt/15));
  if(this.t>=this.sampleAt){this.sampleAt=this.t+.02;this.samples.push({t:this.t,p:paw,q:this.rawQ*60,v:(this.volume-.06)*1000,effort:mus,kind:b?.kind??'',trigger:b?.trigger??''});if(this.samples.length>650)this.samples.shift();}
 }
 advance(seconds:number){const n=Math.round(seconds/.005);for(let i=0;i<n;i++)this.step(.005);}
 snapshot():Snapshot{
  const b=this.breaths.at(-1);const live=this.current;
  const window=this.breaths.filter(x=>x.end>this.t-60);
  const mv=this.t>=60?window.reduce((n,x)=>n+x.vte,0)/1000:null;
  const alarms:string[]=[];
  if(this.rawP>this.settings.highP)alarms.push('高气道压力');
  if(b&&b.vte<this.settings.lowVt)alarms.push('低呼出潮气量');
  if(mv!==null&&mv<this.settings.lowMv)alarms.push('低分钟通气量');
  if(this.spo2<this.settings.lowSpo2)alarms.push('低 SpO₂');
  if(this.backup)alarms.push('窒息后备通气 · 请手动返回');
  if((live?.limited||b?.limited)||((hasVG(this.mode,this.settings)||this.mode==='PRVC'||this.mode==='VSV')&&this.autoDp>=this.settings.limit-this.settings.peep-.1&&b&&b.vte<this.settings.vt*.9))alarms.push('压力受限 · 容量可能未达标');
  return {t:this.t,phase:this.phase,kind:live?.kind??'等待',backup:this.backup,pip:live?.pip??b?.pip??this.settings.peep,vti:b?.vti??0,vte:b?.vte??0,mv,rate:this.t>=60?window.length:null,effortRate:this.t>=60?this.events.filter(e=>e.type==='effort'&&e.t>this.t-60).length:null,spo2:this.spo2,co2:this.co2,ph:this.ph,autoDp:this.autoDp,plat:b?.plat??null,totalPeep:this.endPeep,alarms,limited:!!live?.limited,domain:this.co2<15||this.co2>120||this.ph<6.8||this.ph>7.8,pending:!!this.pending||!!this.pendingMode,peakFlow:this.peak*60};
 }
}
