import {describe,it,expect} from 'vitest';
import {Engine} from '../src/engine';
import {DEFAULT,validate,keysFor} from '../src/config';
function stable(mode:Engine['mode']='PC',patch={}){const e=new Engine();e.mode=mode;e.change(patch);e.advance(30);return e;}
describe('力学与基础模式',()=>{
 it('被动恒压充盈符合解析解',()=>{const e=new Engine();e.settings.rise=.02;e.advance(.02);const start=e.volume;const c=e.C,r=e.R;e.advance(.3);const predicted=c*17+(start-c*17)*Math.exp(-.3/(r*c));expect(e.volume).toBeCloseTo(predicted,3);});
 it('VC在密闭未限压时送入目标容量',()=>{const e=stable('VC');const b=e.breaths.at(-1)!;expect(b.vti).toBeCloseTo(105,0);expect(b.lungIn).toBeCloseTo(b.vti,4);expect(b.vte).toBeCloseTo(b.vti,0);});
 it('VC不同流量轮廓保持相同容量',()=>{const a=stable('VC',{pattern:0});const b=stable('VC',{pattern:1});expect(a.breaths.at(-1)!.vti).toBeCloseTo(b.breaths.at(-1)!.vti,0);});
 it('PC中顺应性下降使潮气量下降',()=>{const a=stable();const b=new Engine();b.patient.compliance=10;b.advance(30);expect(b.breaths.at(-1)!.vte).toBeLessThan(a.breaths.at(-1)!.vte);});
 it('VC中顺应性下降提高峰压',()=>{const a=stable('VC');const b=new Engine();b.mode='VC';b.patient.compliance=10;b.advance(30);expect(b.breaths.at(-1)!.pip).toBeGreaterThan(a.breaths.at(-1)!.pip);});
 it('限压不能强行保证容量',()=>{const e=new Engine();e.mode='VC';e.patient.compliance=0;e.change({limit:18,vt:180});e.advance(20);expect(e.breaths.at(-1)!.vti).toBeLessThan(180);expect(e.breaths.at(-1)!.limited).toBe(true);});
 it('平台压只在有效暂停条件下输出',()=>{const e=stable('VC');expect(e.breaths.at(-1)!.plat).not.toBeNull();const b=new Engine();b.mode='VC';b.patient.leak=20;b.advance(20);expect(b.breaths.at(-1)!.plat).toBeNull();});
 it('非法时序不修改设置',()=>{const e=new Engine();expect(e.change({rr:50,ti:1.5})).toBeTruthy();expect(e.settings.rr).toBe(25);expect(validate(DEFAULT)).toBeNull();});
 it('调参不重写历史或肺容量',()=>{const e=stable();const sample={...e.samples[0]};const v=e.volume;e.change({dp:20});expect(e.volume).toBe(v);expect(e.samples[0]).toEqual(sample);});
});
describe('触发、SIMV与后备',()=>{
 it('无自主呼吸的PSV窒息后备，恢复后不自动返回',()=>{const e=new Engine();e.mode='PSV';e.advance(10);expect(e.backup).toBe(true);e.setPatient({spontaneous:1,effort:8});e.advance(8);expect(e.backup).toBe(true);expect(e.breaths.some(b=>b.kind==='后备')).toBe(true);e.returnPSV();e.advance(.1);expect(e.backup).toBe(false);});
 it('有效自主呼吸触发PSV',()=>{const e=new Engine();e.mode='PSV';e.setPatient({spontaneous:1,effort:8});e.advance(15);expect(e.backup).toBe(false);expect(e.events.some(x=>x.type==='success')).toBe(true);expect(e.breaths.every(b=>b.kind==='支持')).toBe(true);});
 it('弱努力与高阈值产生无效触发',()=>{const e=new Engine();e.mode='PSV';e.setPatient({spontaneous:1,effort:.2});e.change({trigger:5});e.advance(5);expect(e.events.some(x=>x.type==='missed')).toBe(true);});
 it('未补偿漏气可在没有努力时产生误触发',()=>{const e=new Engine();e.patient.leak=70;e.change({trigger:.5});e.advance(20);expect(e.events.some(x=>x.type==='auto')).toBe(true);expect(e.events.some(x=>x.type==='effort')).toBe(false);});
 it('SIMV在指令之间允许独立支持呼吸',()=>{const e=new Engine();e.mode='SIMV-PC';e.change({rr:10});e.setPatient({spontaneous:1,rate:30,effort:8});e.advance(25);expect(e.breaths.some(b=>b.kind==='指令')).toBe(true);expect(e.breaths.some(b=>b.kind==='支持')).toBe(true);});
 it('SIMV关闭PS时自主呼吸不使用指令压力',()=>{const e=new Engine();e.mode='SIMV-PC';e.change({rr:10,psOn:0});e.setPatient({spontaneous:1,rate:30,effort:8});e.advance(20);const spontaneous=e.breaths.filter(b=>b.kind==='自主');expect(spontaneous.length).toBeGreaterThan(0);expect(spontaneous.every(b=>b.pip<=e.settings.peep+.01)).toBe(true);});
 it('VC-SIMV不提供错误VG开关',()=>expect(keysFor('SIMV-VC',DEFAULT)).not.toContain('vgOn'));
});
describe('容量反馈与气体交换',()=>{
 it.each(['VG','PRVC','VSV'] as const)('%s反馈可收敛且不超限',m=>{const e=new Engine();e.mode=m;if(m==='VSV')e.setPatient({spontaneous:1,effort:3});e.advance(65);const b=e.breaths.at(-1)!;expect(b.vte).toBeGreaterThan(60);expect(b.vte).toBeLessThan(160);expect(e.autoDp+e.settings.peep).toBeLessThanOrEqual(e.settings.limit);});
 it('SIMV-VG只使用指令反馈，不响应独立PS呼吸的目标',()=>{const e=new Engine();e.mode='SIMV-PC';e.change({rr:5,vgOn:1});e.setPatient({spontaneous:1,rate:30,effort:6});e.advance(10);const before=e.autoDp;e.change({ps:20});e.advance(.1);expect(e.autoDp).toBe(before);});
 it('FiO₂不改变力学轨迹',()=>{const a=stable('PC',{fio2:21});const b=stable('PC',{fio2:80});expect(a.volume).toBeCloseTo(b.volume,12);expect(b.spo2).toBeGreaterThan(a.spo2);});
 it('酸碱公式与固定HCO3条件一致',()=>{const e=stable();expect(e.ph).toBeCloseTo(6.1+Math.log10(24/(.03*e.co2)),10);});
 it('不成熟统计窗口不伪报每分钟指标',()=>{const e=stable();expect(e.snapshot().mv).toBeNull();e.advance(31);expect(e.snapshot().mv).not.toBeNull();expect(e.snapshot().rate).toBeGreaterThan(0);});
 it('缓冲有界且重置恢复初始',()=>{const e=stable();e.advance(90);expect(e.samples.length).toBeLessThanOrEqual(650);expect(e.events.length).toBeLessThanOrEqual(500);e.reset();expect(e.t).toBe(0);expect(e.samples).toHaveLength(0);expect(e.volume).toBe(.06);});
 it.each(['PC','VC','SIMV-PC','SIMV-VC','VG','PSV','PRVC','VSV','VAPS'] as const)('%s运行无NaN',m=>{const e=new Engine();e.mode=m;e.setPatient({spontaneous:1,effort:8,leak:20});e.advance(30);expect(Number.isFinite(e.volume)).toBe(true);expect(e.samples.every(s=>[s.p,s.q,s.v].every(Number.isFinite))).toBe(true);});
 it('VAPS在同一次吸气内发生容量补充',()=>{const e=new Engine();e.mode='VAPS';e.change({rr:15,ps:2,vt:150,maxTi:2,supplement:15});e.setPatient({spontaneous:1,effort:2});e.advance(25);expect(e.breaths.some(b=>b.vti>120)).toBe(true);expect(e.events.some(x=>x.label==='同一口气转入容量补充')).toBe(true);});
 it('调高ETS缩短支持吸气时间',()=>{const run=(ets:number)=>{const e=new Engine();e.mode='PSV';e.change({ets});e.setPatient({spontaneous:1,effort:4});e.advance(30);return e.breaths.slice(-5).reduce((n,b)=>n+b.ti,0)/5;};expect(run(60)).toBeLessThan(run(10));});
 it('关闭VG时可恢复手动压力控制',()=>{const e=new Engine();e.mode='SIMV-PC';e.change({vgOn:1});e.advance(30);e.change({vgOn:0});e.change({dp:8});e.advance(8);expect(e.breaths.at(-1)!.pip).toBeCloseTo(13,1);});
 it('切换模式保留肺内连续容量与患儿状态',()=>{const e=stable();e.setPatient({compliance:22,resistance:70,leak:10});const v=e.volume;e.switchMode('VC',{...DEFAULT});expect(e.volume).toBe(v);e.advance(3);expect(e.mode).toBe('VC');expect(e.patient.compliance).toBe(22);expect(e.samples.every(x=>Number.isFinite(x.v))).toBe(true);});
 it('30分钟积分缓冲有界并保持有限值',()=>{const e=new Engine();e.advance(1800);expect(e.samples.length).toBe(650);expect(e.breaths.length).toBeLessThanOrEqual(160);expect(e.volume).toBeGreaterThan(0);expect(e.volume).toBeLessThan(.3);expect(e.snapshot().mv).toBeGreaterThan(1);});
 it('漏气时设备送气与肺端容量分别统计',()=>{const e=new Engine();e.patient.leak=30;e.advance(25);const b=e.breaths.at(-1)!;expect(b.vti).toBeGreaterThan(b.lungIn);expect(b.vte).toBeLessThan(b.lungIn);});
 it('不适用的VC时序不阻止PC有效设置',()=>{const e=new Engine();e.settings.delivery=1.2;e.settings.pause=.5;expect(e.change({rr:40,ti:.6})).toBeNull();});
 it('拒绝NaN并保留有效设置',()=>{const e=new Engine();expect(e.change({dp:NaN})).toBeTruthy();expect(e.settings.dp).toBe(12);});
 it('极端力学与漏气组合在所有模式中保持有限值',()=>{for(const m of ['PC','VC','SIMV-PC','SIMV-VC','VG','PSV','PRVC','VSV','VAPS'] as const){for(const c of [0,100])for(const r of [0,100]){const e=new Engine();e.mode=m;e.setPatient({spontaneous:1,rate:40,effort:15,compliance:c,resistance:r,leak:70});e.advance(20);expect(Number.isFinite(e.volume)).toBe(true);expect(e.volume).toBeGreaterThanOrEqual(0);expect(e.samples.every(s=>[s.p,s.q,s.v].every(Number.isFinite))).toBe(true);}}});
});
