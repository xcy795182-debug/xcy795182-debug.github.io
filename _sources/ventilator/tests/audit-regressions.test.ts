import {describe,it,expect} from 'vitest';
import {Engine} from '../src/engine';
describe('底层逻辑审计回归',()=>{
 it('关闭VG并指定手动压力时必须采用用户指定值',()=>{const e=new Engine();e.mode='SIMV-PC';e.change({vgOn:1});e.advance(25);expect(e.change({vgOn:0,dp:8})).toBeNull();expect(e.settings.dp).toBe(8);});
 it('截断容量反馈呼吸不能更新自动压力',()=>{const e=new Engine();e.mode='VG';e.advance(.9);const dp=e.autoDp;e.switchMode('PC');e.advance(.2);expect(e.autoDp).toBe(dp);});
 it('后备容量不能在手动回VSV时参与自主容量反馈',()=>{const e=new Engine();e.mode='VSV';e.advance(11);expect(e.backup).toBe(true);const old=e.autoDp;e.returnPSV();e.advance(.005);expect(e.autoDp).toBe(old);});
 it('人工PEEP调整后不能用新设置重算旧呼气末PEEPi',()=>{const e=new Engine();e.mode='VC';e.advance(20);const old=e.mechanics().intrinsic;e.change({peep:10});expect(e.mechanics().intrinsic).toBeCloseTo(old,8);});
 it('分钟通气逐步计入实际呼出流量，不等待下一口',()=>{const e=new Engine();e.mode='VC';const bins:{t:number;v:number}[]=[];for(let i=0;i<15000;i++){e.step();const p=e.loopCurrent.at(-1);if(p&&p.t===e.t&&p.deviceQ<0)bins.push({t:e.t,v:-p.deviceQ/60*.005});if(i%97===0&&e.t>=60){const expected=bins.filter(p=>p.t>e.t-60).reduce((sum,p)=>sum+p.v,0);expect(e.snapshot().mv).toBeCloseTo(expected,8);}}});
 it('实际送气频率按启动时点计数，不按延后的结算时点',()=>{const e=new Engine();const starts:number[]=[];for(let i=0;i<15000;i++){e.step();if(e.loopCurrent.length===2)starts.push(e.t);if(i%89===0&&e.t>=60)expect(e.snapshot().rate).toBe(starts.filter(t=>t>e.t-60).length);}});
 it('返回PSV时截断后备呼吸，不在一口中混用两套压力',()=>{const e=new Engine();e.mode='PSV';e.advance(10);expect(e.backup).toBe(true);e.returnPSV();expect(e.phase).toBe('expiration');expect(e.breaths.at(-1)?.complete).toBe(false);expect(e.previousLoopComplete).toBe(false);});
 it('截断呼吸不覆盖上一完整Vte',()=>{const e=new Engine();e.mode='VC';e.advance(12);const vte=e.snapshot().vte;e.switchMode('PC');for(let i=0;i<200&&String(e.mode)!=='PC';i++)e.step();expect(e.snapshot().vte).toBe(vte);});

});

function run(mode:Engine['mode'],patch:Parameters<Engine['change']>[0],patient:Parameters<Engine['setPatient']>[0]={}){const e=new Engine();e.mode=mode;e.setPatient(patient);expect(e.change(patch)).toBeNull();e.advance(35);return e;}
const qmax=(e:Engine)=>Math.max(...e.samples.map(p=>p.q));
describe('参数变更的因果关系审计',()=>{
 it('PC增大压力差使Vt与流量增加',()=>{const a=run('PC',{dp:6}),b=run('PC',{dp:16});expect(b.snapshot().vte).toBeGreaterThan(a.snapshot().vte);expect(qmax(b)).toBeGreaterThan(qmax(a));});
 it('PC延长Ti使充盈增加并改变环容量',()=>{const a=run('PC',{ti:.3}),b=run('PC',{ti:1.1});expect(b.snapshot().vte).toBeGreaterThan(a.snapshot().vte);expect(Math.max(...b.loopPrevious.map(p=>p.v))).toBeGreaterThan(Math.max(...a.loopPrevious.map(p=>p.v)));});
 it('VC提高Vt同步提高流量和压力',()=>{const a=run('VC',{vt:60,delivery:.6}),b=run('VC',{vt:120,delivery:.6});expect(qmax(b)).toBeCloseTo(qmax(a)*2,6);expect(b.snapshot().pip).toBeGreaterThan(a.snapshot().pip);});
 it('VC延长送气时间降低流量而不改变Vt',()=>{const a=run('VC',{vt:90,delivery:.3}),b=run('VC',{vt:90,delivery:.9});expect(qmax(a)/qmax(b)).toBeCloseTo(3,5);expect(b.snapshot().vti).toBeCloseTo(a.snapshot().vti,1);});
 it('VC低顺应性使压力增加，容量和流量不变',()=>{const a=run('VC',{vt:90,delivery:.6},{compliance:60}),b=run('VC',{vt:90,delivery:.6},{compliance:10});expect(b.breaths.at(-1)!.pip).toBeGreaterThan(a.breaths.at(-1)!.pip);expect(qmax(b)).toBeCloseTo(qmax(a),6);expect(b.snapshot().vti).toBeCloseTo(a.snapshot().vti,1);});
 it('PC升高阻力使峰流量和容量下降',()=>{const a=run('PC',{dp:12},{resistance:10}),b=run('PC',{dp:12},{resistance:90});expect(qmax(b)).toBeLessThan(qmax(a));expect(b.snapshot().vte).toBeLessThan(a.snapshot().vte);});
 it('PSV提高PS使支持容量增加',()=>{const a=run('PSV',{ps:4},{spontaneous:1,effort:4}),b=run('PSV',{ps:14},{spontaneous:1,effort:4});expect(b.snapshot().vte).toBeGreaterThan(a.snapshot().vte);expect(qmax(b)).toBeGreaterThan(qmax(a));});
 it('PSV提高ETS缩短吸气及容量',()=>{const a=run('PSV',{ets:10},{spontaneous:1,effort:4}),b=run('PSV',{ets:65},{spontaneous:1,effort:4});expect(b.breaths.at(-1)!.ti).toBeLessThan(a.breaths.at(-1)!.ti);expect(b.snapshot().vte).toBeLessThan(a.snapshot().vte);});
 it('降低压力上升速度改变早期流量曲线',()=>{const a=run('PC',{rise:.02}),b=run('PC',{rise:.4});expect(qmax(a)).toBeGreaterThan(qmax(b));});
 it.each(['VG','PRVC','VSV'] as const)('%s提高容量目标后压力及流量随反馈增大',mode=>{const patient=mode==='VSV'?{spontaneous:1,effort:3}:{};const a=run(mode,{vt:60},patient),b=run(mode,{vt:120},patient);expect(b.autoDp).toBeGreaterThan(a.autoDp);expect(qmax(b)).toBeGreaterThan(qmax(a));});
 it('VC压力限制使实际容量不足并产生限压标记',()=>{const e=run('VC',{vt:180,limit:16},{compliance:0});expect(e.snapshot().vti).toBeLessThan(180);expect(e.snapshot().limited).toBe(true);});
 it('FiO2只改变气体交换，不伪造机械波形改变',()=>{const a=run('PC',{fio2:21}),b=run('PC',{fio2:80});expect(b.samples.map(p=>[p.p,p.q,p.v])).toEqual(a.samples.map(p=>[p.p,p.q,p.v]));expect(b.spo2).toBeGreaterThan(a.spo2);});
});
