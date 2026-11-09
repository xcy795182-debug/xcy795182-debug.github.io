import {describe,it,expect} from 'vitest';
import {Engine} from '../src/engine';
function stable(leak=0){const e=new Engine();e.mode='VC';e.setPatient({leak});e.change({vt:90,delivery:.6,pause:.2,rr:20});e.advance(30);return e;}
describe('呼吸环及力学监测',()=>{
 it('P-V与F-V使用同一条真实呼吸轨迹，不是另造轮廓',()=>{const e=stable();expect(e.loopPrevious.length).toBeGreaterThan(100);expect(e.loopPrevious.some(p=>p.q>0)).toBe(true);expect(e.loopPrevious.some(p=>p.q<0)).toBe(true);expect(e.loopPrevious.every(p=>[p.p,p.q,p.v,p.deviceQ,p.deviceV].every(Number.isFinite))).toBe(true);});
 it.each([0,30])('漏气%s时肺端环容量与流量积分一致',leak=>{const e=stable(leak);const a=e.loopPrevious;for(let i=1;i<a.length;i++){const dt=a[i].t-a[i-1].t;expect(a[i].v-a[i-1].v).toBeCloseTo(a[i].q/60*1000*dt,7);}});
 it.each([0,30])('漏气%s时设备环容量与设备流量积分一致',leak=>{const a=stable(leak).loopPrevious;for(let i=1;i<a.length;i++)expect(a[i].deviceV-a[i-1].deviceV).toBeCloseTo(a[i].deviceQ/60*1000*(a[i].t-a[i-1].t),7);});
 it('设备端漏气缺口由积分产生，不强行封口',()=>{const a=stable(30).loopPrevious;expect(a.at(-1)!.deviceV-a[0].deviceV).toBeGreaterThan(10);expect(a.at(-1)!.t).toBeGreaterThan(a[0].t);});
 it('密闭被动环接近原容量基线',()=>{const a=stable().loopPrevious;expect(Math.abs(a.at(-1)!.v-a[0].v)).toBeLessThan(1);});
 it('控制通气P-V按真实时间逆时针描记',()=>{const a=stable().loopPrevious;let area=0;for(let i=1;i<a.length;i++)area+=a[i-1].p*a[i].v-a[i].p*a[i-1].v;expect(area).toBeGreaterThan(0);});
 it('新一口开始只重置局部容量基线，不改变肺内气量',()=>{const e=stable();expect(e.loopCurrent[0].v).toBe(0);const v=e.volume;const history=JSON.stringify(e.loopPrevious);e.change({vt:120});expect(e.volume).toBe(v);expect(JSON.stringify(e.loopPrevious)).toBe(history);});
 it('静态C与R从有效被动密闭方波VC计算',()=>{const e=stable();const m=e.mechanics();expect(m.measuredC).toBeCloseTo(m.C,1);expect(m.measuredR).not.toBeNull();expect(Math.abs(m.measuredR!-m.R)).toBeLessThan(1);expect(m.driving).toBeGreaterThan(0);});
 it.each(['effort','leak','pattern','pause','pressure-limit'] as const)('%s条件不满足时不报告静态力学结果',condition=>{const e=new Engine();e.mode='VC';if(condition==='effort')e.setPatient({spontaneous:1,effort:4});if(condition==='leak')e.setPatient({leak:30});e.change(condition==='pattern'?{pattern:1}:condition==='pause'?{pause:0}:condition==='pressure-limit'?{vt:180,limit:15}:{vt:90});if(condition==='pressure-limit')e.setPatient({compliance:0});e.advance(30);expect(e.mechanics().measuredC).toBeNull();expect(e.mechanics().measuredR).toBeNull();});
 it('只提高R提高PIP与计算R而非静态C',()=>{const a=stable();const b=new Engine();b.mode='VC';b.setPatient({resistance:60});b.change({vt:90,delivery:.6,pause:.2,rr:20});b.advance(30);expect(b.mechanics().measuredR!).toBeGreaterThan(a.mechanics().measuredR!);expect(b.mechanics().measuredC).toBeCloseTo(a.mechanics().measuredC!,1);});
 it('时间常数统一使用L/cmH2O计算',()=>{const e=stable();expect(e.mechanics().tau).toBeCloseTo(e.mechanics().R*e.mechanics().C/1000,10);});
 it('切换模式后保留的上一呼吸环不被改写',()=>{const e=stable();const old=JSON.stringify(e.loopPrevious);e.switchMode('PC');expect(JSON.stringify(e.loopPrevious)).toBe(old);e.advance(5);expect(e.loopCurrent.every(p=>Number.isFinite(p.v))).toBe(true);});
 it('长时间运行呼吸环缓存有界且重置清空',()=>{const e=stable();e.advance(120);expect(e.loopCurrent.length).toBeLessThanOrEqual(12000);expect(e.loopPrevious.length).toBeLessThanOrEqual(12000);e.reset();expect(e.loopCurrent).toHaveLength(0);expect(e.loopPrevious).toHaveLength(0);expect(e.mechanics().measuredC).toBeNull();});
});

it('交互计数区分真实努力、无效努力和无努力误触发',()=>{const e=new Engine();e.mode='PSV';e.setPatient({spontaneous:1,effort:.1});e.change({trigger:5});e.advance(5);expect(e.interaction().efforts).toBeGreaterThan(0);expect(e.interaction().missed).toBeGreaterThan(0);expect(e.interaction().automatic).toBe(0);});
it('有效触发延迟来源于努力时间而非随机赋值',()=>{const e=new Engine();e.mode='PSV';e.setPatient({spontaneous:1,effort:8});e.advance(5);expect(e.interaction().delayMs).not.toBeNull();expect(e.interaction().delayMs!).toBeGreaterThanOrEqual(0);expect(e.interaction().delayMs!).toBeLessThan(750);});

it('模式切换截断的上一环明确标为不完整',()=>{const e=stable();expect(e.previousLoopComplete).toBe(true);e.switchMode('PC');for(let i=0;i<1000&&e.mode!=='PC';i++)e.step();expect(e.previousLoopComplete).toBe(false);});
