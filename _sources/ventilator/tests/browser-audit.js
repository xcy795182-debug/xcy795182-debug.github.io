// 通过 agent-browser eval --stdin 在已打开的页面执行；仅操作和读取可见界面。
(async()=>{
 const results=[];
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const click=label=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===label);if(!b)throw Error('按钮缺失: '+label);b.click();};
 const canvas=document.querySelector('canvas');const before=canvas.toDataURL();await wait(350);results.push({test:'波形持续变化',pass:before!==canvas.toDataURL()});
 for(const label of ['VC-A/C','SIMV · 压力控制','SIMV · 容量控制','VGV / VG','PSV','VTV · 对照','PRVC']){click(label);await wait(300);results.push({test:label,pass:!!document.querySelector('.mode-intro strong')?.textContent&&document.querySelectorAll('.param').length>0});}
 click('PSV');await wait(9000);results.push({test:'PSV窒息后备按钮',pass:!![...document.querySelectorAll('button')].find(b=>b.textContent.includes('手动返回 PSV'))});
 click('VTV · 对照');await wait(200);for(const label of ['VSV','VAPS']){const bar=document.querySelector('.compare-bar');[...bar.querySelectorAll('button')].find(b=>b.textContent===label).click();await wait(200);results.push({test:'VTV-'+label,pass:document.querySelector('.mode-tag').textContent===label});}
 results.push({test:'页面无横向溢出',pass:document.documentElement.scrollWidth<=innerWidth});
 results.push({test:'模型说明可展开',pass:!!document.querySelector('.model-notes summary')});
 return JSON.stringify(results);
})()
