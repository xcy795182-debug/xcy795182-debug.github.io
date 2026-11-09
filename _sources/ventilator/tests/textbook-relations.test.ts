import {describe,it,expect} from 'vitest';
import {Engine} from '../src/engine';
function vc(vt:number,delivery=.6,pattern=0){const e=new Engine();e.mode='VC';expect(e.change({vt,delivery,pattern,pause:.1})).toBeNull();e.advance(25);return e;}
const peak=(e:Engine)=>Math.max(...e.samples.map(s=>s.q));
describe('教材关系与曲线一致性',()=>{
 it.each([0,1])('VC轮廓%s在同送气时间下Vt翻倍使流量翻倍',pattern=>{const a=vc(60,.6,pattern),b=vc(120,.6,pattern);expect(peak(b)/peak(a)).toBeCloseTo(2,5);expect(b.breaths.at(-1)!.vti).toBeCloseTo(120,1);});
 it('VC方波符合Q=Vt/Tflow',()=>{expect(peak(vc(120))).toBeCloseTo(12,6);});
 it.each([0,1])('VC轮廓%s同Vt延长送气时间降低流量',pattern=>{expect(peak(vc(120,.8,pattern))).toBeLessThan(peak(vc(120,.4,pattern)));});
 it('VC增加暂停不改变送气流量但延长总Ti',()=>{const a=vc(120);const b=new Engine();b.mode='VC';b.change({vt:120,delivery:.6,pause:.3});b.advance(25);expect(peak(b)).toBeCloseTo(peak(a),6);expect(b.breaths.at(-1)!.ti-a.breaths.at(-1)!.ti).toBeCloseTo(.2,2);});
 it('VC递减与方波面积相同而峰值不同',()=>{const a=vc(120),b=vc(120,.6,1);expect(b.breaths.at(-1)!.vti).toBeCloseTo(a.breaths.at(-1)!.vti,1);expect(peak(b)).toBeGreaterThan(peak(a));});
 it.each(['PC','VC','PSV','VAPS'] as const)('%s各阶段显示流量与肺容量增量一致（含漏气）',mode=>{const e=new Engine();e.mode=mode;e.setPatient({leak:25,spontaneous:1,effort:4});let checked=0;for(let i=0;i<3000;i++){const previous=e.volume;e.step();const q=(e as unknown as {rawQ:number}).rawQ;expect(q*.005).toBeCloseTo(e.volume-previous,10);checked++;}expect(checked).toBe(3000);});
 it('VC低顺应性升高压力但未限压时流量不变',()=>{const a=vc(120);const b=new Engine();b.mode='VC';b.setPatient({compliance:20});b.change({vt:120,delivery:.6,pause:.1});b.advance(25);expect(peak(b)).toBeCloseTo(peak(a),6);expect(b.breaths.at(-1)!.pip).toBeGreaterThan(a.breaths.at(-1)!.pip);});
 it('VC阻力增加升高PIP但未限压时不改变给定流量',()=>{const a=vc(120);const b=new Engine();b.mode='VC';b.setPatient({resistance:60});b.change({vt:120,delivery:.6,pause:.1});b.advance(25);expect(peak(b)).toBeCloseTo(peak(a),6);expect(b.breaths.at(-1)!.pip).toBeGreaterThan(a.breaths.at(-1)!.pip);});
 it('VAPS不接受PSV的ETS参数',()=>{const e=new Engine();e.mode='VAPS';expect(e.change({ets:50})).toContain('锁定');});
 it('VAPS低流量补充不会由ETS触发',()=>{const e=new Engine();e.mode='VAPS';e.change({ps:2,vt:180,supplement:2,maxTi:2,rr:15});e.advance(20);expect(e.events.some(x=>x.label==='同一口气转入容量补充')).toBe(true);});
 it('高频率缩短呼气可增加模型PEEPi',()=>{function run(rr:number){const e=new Engine();e.mode='VC';e.setPatient({resistance:100,compliance:100});e.change({vt:120,delivery:.4,pause:0,rr});e.advance(40);return e.snapshot().totalPeep-e.settings.peep;}expect(run(45)).toBeGreaterThan(run(10));});
});

it('容量反馈目标提高后逐口增加压力与流量而非直接设定流量',()=>{function run(vt:number){const e=new Engine();e.mode='PRVC';e.change({vt,ti:.7});e.advance(45);return e;}const a=run(60),b=run(120);expect(b.snapshot().autoDp).toBeGreaterThan(a.snapshot().autoDp);expect(peak(b)).toBeGreaterThan(peak(a));});
it('PC降低顺应性在相同压力与时间下减小Vt',()=>{const a=new Engine();a.advance(25);const b=new Engine();b.setPatient({compliance:10});b.advance(25);expect(b.breaths.at(-1)!.vte).toBeLessThan(a.breaths.at(-1)!.vte);});
it('VAPS增大预设补充流量使转换提前',()=>{function start(flow:number){const e=new Engine();e.mode='VAPS';e.change({vt:180,ps:2,supplement:flow,maxTi:2,rr:15});e.advance(4);return e.events.find(x=>x.label==='同一口气转入容量补充')!.t;}expect(start(10)).toBeLessThan(start(2));});
