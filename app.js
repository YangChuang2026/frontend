// Simple frontend logic for LabMind prototype
// Expects backend endpoints (placeholders):
// POST /api/agent/run  -> { status: 'ok', run_id }
// GET  /api/agent/status?run_id=... -> { status:'running'|'done'|'error', logs:[], param_diff, results }
// GET  /api/agent/history?query=... -> [ { id, timestamp, test_type, tool_sequence, parameters } ... ]

document.addEventListener('DOMContentLoaded', ()=>{
  // 后端 API 基地址（开发时固定为本机 8001）
  const API_BASE = 'http://127.0.0.1:8001';
  const runBtn = document.getElementById('runBtn');
  const refreshHistory = document.getElementById('refreshHistory');
  const stopBtn = document.getElementById('stopBtn');
  const log = document.getElementById('log');
  const results = document.getElementById('results');
  const historyList = document.getElementById('historyList');
  const paramDiff = document.getElementById('paramDiff');

  function appendLog(line){
    const el = document.createElement('div'); el.textContent = line; log.appendChild(el); log.scrollTop = log.scrollHeight;
  }

  function formatResultsDisplay(results, runId) {
    // 检查是否有力学指标
    const hasMetrics = results && (
        results['Fm (kN)'] !== undefined ||
        results['Rm (MPa)'] !== undefined ||
        results['E (MPa)'] !== undefined
    );

    let metricsHtml = '';
    if (hasMetrics) {
        metricsHtml = `
            <table class="results-table">
                <thead>
                        <tr><th>指标</th><th>数值</th></tr>
                </thead>
                <tbody>
                    ${results['Fm (kN)'] !== undefined ? `<tr><td>最大力 Fm</td><td>${results['Fm (kN)']} kN</td></tr>` : ''}
                    ${results['Rm (MPa)'] !== undefined ? `<tr><td>抗拉强度 Rm</td><td>${results['Rm (MPa)']} MPa</td></tr>` : ''}
                    ${results['E (MPa)'] !== undefined ? `<tr><td>弹性模量 E</td><td>${results['E (MPa)']} MPa</td></tr>` : ''}
                    ${results['Rp0.2 (MPa)'] !== undefined ? `<tr><td>屈服强度 Rp0.2</td><td>${results['Rp0.2 (MPa)']} MPa</td></tr>` : ''}
                    ${results['A (%)'] !== undefined ? `<tr><td>断后伸长率 A</td><td>${results['A (%)']} %</td></tr>` : ''}
                    ${results['n'] !== undefined ? `<tr><td>应变硬化指数 n</td><td>${results['n']}</td></tr>` : ''}
                    ${results['Energy (J)'] !== undefined ? `<tr><td>断裂能量</td><td>${results['Energy (J)']} J</td></tr>` : ''}
                </tbody>
            </table>
        `;
    }

    // 图像显示
    let imageHtml = '';
    if (results.image_file) {
        const imageUrl = `${API_BASE}/api/agent/result_image?run_id=${encodeURIComponent(runId)}&_ts=${Date.now()}`;
        imageHtml = `<div class="results-image"><img src="${imageUrl}" alt="力-位移曲线" /></div>`;
    }

    // 组合
    if (imageHtml || metricsHtml) {
        return `<div class="results-container">${imageHtml}${metricsHtml}</div>`;
    } else {
        // 无结构化数据，回退到 JSON 显示
        return `<pre>${JSON.stringify(results, null, 2)}</pre>`;
    }
  }

  async function fetchHistory(){
    historyList.innerHTML = '正在查询...';
    try{
      const q = encodeURIComponent(document.getElementById('prompt').value||'');
      const res = await fetch(API_BASE + '/api/agent/history?query='+q);
      if(!res.ok) throw new Error('history fetch failed');
      const arr = await res.json();
      if(!arr.length) historyList.innerHTML = '<i>无相似历史。</i>';
      else{
        historyList.innerHTML = '';
        arr.forEach(r=>{
          const d = document.createElement('div'); d.className='histItem';
          d.innerHTML = `<b>${r.timestamp}</b> (${r.test_type})<br/><small>${JSON.stringify(r.parameters)}</small>`;
          historyList.appendChild(d);
        });
      }
    }catch(e){ historyList.innerHTML = '<i>历史查询失败（未实现后端）</i>'; }
  }

  refreshHistory.addEventListener('click', fetchHistory);

  runBtn.addEventListener('click', async ()=>{
    appendLog('▶ 准备运行智能体...');
    const payload = {
      prompt: document.getElementById('prompt').value,
      params: {
        so: Number(document.getElementById('so').value)||null,
        l0: Number(document.getElementById('l0').value)||null,
        test_type: document.getElementById('test_type').value,
        speed_mm_s: Number(document.getElementById('speed_mm_s').value)||null,
        max_displacement: Number(document.getElementById('max_displacement').value)||null,
        max_force: Number(document.getElementById('max_force').value)||null,
      }
    };

    appendLog('→ 发送请求到后端 /api/agent/run（原型）');
    try{
      const res = await fetch(API_BASE + '/api/agent/run', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      if(!res.ok) throw new Error('后端返回错误');
      const data = await res.json();
      appendLog('✔ run_id: '+data.run_id);
      pollStatus(data.run_id);
    }catch(err){ appendLog('✖ 请求失败：'+err.message); results.innerHTML='出错'; }
  });

  stopBtn.addEventListener('click', ()=>{ appendLog('⚠️ 已发送紧急停止请求（需要后端支持）'); /* placeholder */ });

  async function pollStatus(run_id){
    appendLog('⏳ 开始轮询状态...');
    try{
      // track last appended log index per run to avoid duplicates
      if(!window._lastLogIndex) window._lastLogIndex = {};
      if(typeof window._lastLogIndex[run_id] === 'undefined') window._lastLogIndex[run_id] = 0;
      while(true){
        const res = await fetch(API_BASE + '/api/agent/status?run_id='+encodeURIComponent(run_id));
        if(!res.ok) throw new Error('status error');
        const s = await res.json();
        if(s.logs && Array.isArray(s.logs)){
          // only append logs that we haven't appended yet
          const start = window._lastLogIndex[run_id] || 0;
          for(let i = start; i < s.logs.length; i++) appendLog(s.logs[i]);
          window._lastLogIndex[run_id] = s.logs.length;
        }
        if(s.param_diff) paramDiff.textContent = s.param_diff;
        // 处理等待前端确认的交互
        if(s.awaiting_confirm){
          appendLog('🔔 需要人工确认: '+s.awaiting_confirm);
          if(!window._confirmHandled) window._confirmHandled = {};
          if(!window._confirmHandled[run_id]){
            // 简单使用 prompt 获取用户输入并发送确认
            const userInput = window.prompt('请确认操作：\n'+s.awaiting_confirm, '已上样，继续');
            try{
              await fetch(API_BASE + '/api/agent/confirm', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({run_id, user_input: userInput||'确认'})});
              appendLog('✔ 已发送确认');
            }catch(e){ appendLog('✖ 发送确认失败：'+e.message); }
            window._confirmHandled[run_id] = true;
          }
        }
        if(s.status==='done' || s.status==='error'){
            appendLog('✅ 任务完成: '+s.status);
            if(s.results){
                const formatted = formatResultsDisplay(s.results, run_id);
                results.innerHTML = formatted;
                // 可选：在日志中追加完成提示
                appendLog('📊 结果已生成，包含力学性能指标和力-位移曲线。');
            } else {
              results.innerHTML = '无';
            }
            break;
          }
        await new Promise(r=>setTimeout(r,1500));
      }
    }catch(e){ appendLog('轮询失败：'+e.message); }
  }

  // initial
  fetchHistory();
});
