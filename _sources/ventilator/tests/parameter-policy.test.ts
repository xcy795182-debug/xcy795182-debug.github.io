import {describe,it,expect} from 'vitest';
import {Engine} from '../src/engine';
import {DEFAULT,MODES,PARAMS,editableKeys,lockedParams,type Mode,type Key} from '../src/config';
describe('模式参数权限',()=>{
 for(const mode of Object.keys(MODES) as Mode[]){
  it(mode+'拒绝所有不适用参数且不修改设置',()=>{
   const e=new Engine();e.mode=mode;const allowed=editableKeys(mode,e.settings);
   for(const key of Object.keys(PARAMS) as Key[]){if(allowed.includes(key))continue;const before={...e.settings};expect(e.change({[key]:PARAMS[key].min})).toContain('锁定');expect(e.settings).toEqual(before);}
  });
  it(mode+'锁定展示与编辑权限一致',()=>{const allowed=editableKeys(mode,DEFAULT);for(const p of lockedParams(mode,DEFAULT))expect(allowed).not.toContain(p.key);});
 }
 it('PC锁定容量、VC锁定压力和独立Ti、PSV锁定指令频率',()=>{expect(editableKeys('PC',DEFAULT)).not.toContain('vt');expect(editableKeys('VC',DEFAULT)).not.toContain('dp');expect(editableKeys('VC',DEFAULT)).not.toContain('ti');expect(editableKeys('PSV',DEFAULT)).not.toContain('rr');});
 it.each(['VG','PRVC','VSV'] as Mode[])('%s自动压力不能手动覆盖',mode=>{const e=new Engine();e.mode=mode;expect(e.change({dp:15})).toContain('锁定');if(mode==='VSV')expect(e.change({ps:15})).toContain('锁定');});
 it('SIMV的VG开关联动容量和手动压力权限',()=>{const e=new Engine();e.mode='SIMV-PC';expect(e.change({vt:120})).toContain('锁定');expect(e.change({vgOn:1,vt:120})).toBeNull();expect(e.change({dp:15})).toContain('锁定');expect(e.change({vgOn:0})).toBeNull();expect(e.change({dp:15})).toBeNull();});
 it('VC-SIMV关闭PSV后锁定PS、ETS和支持上升时间',()=>{const e=new Engine();e.mode='SIMV-VC';expect(e.change({rise:.1})).toBeNull();expect(e.change({psOn:0})).toBeNull();for(const key of ['ps','ets','maxTi','rise'] as Key[])expect(e.change({[key]:DEFAULT[key]})).toContain('锁定');expect(e.change({psOn:1,ps:10})).toBeNull();});
 it('夹带锁定字段的批量修改整体拒绝',()=>{const e=new Engine();const before={...e.settings};expect(e.change({peep:6,vt:120})).toContain('锁定');expect(e.settings).toEqual(before);});
 it('待切换模式也执行新模式权限',()=>{const e=new Engine();e.switchMode('PSV');expect(e.change({rr:20})).toContain('锁定');expect(e.change({ps:10})).toBeNull();});
});
