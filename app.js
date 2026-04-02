// ============================================================================
// LabMind 前端原型 - 主逻辑文件
// ============================================================================
// 功能说明：
// 1. 提供三列布局界面（左侧日志、中间指令、右侧参数）
// 2. 两个弹窗：右侧结果面板、底部历史抽屉（互斥显示）
// 3. 与后端 API 交互：运行实验、轮询状态、查询历史、确认交互
//
// 后端 API 约定：
// POST /api/agent/run     - 运行实验
// GET  /api/agent/status  - 查询状态（轮询）
// GET  /api/agent/history - 查询历史
// POST /api/agent/confirm - 确认交互
// ============================================================================

document.addEventListener('DOMContentLoaded', ()=>{
  // ==========================================================================
  // 配置与 DOM 元素获取
  // ==========================================================================
  
  /** @type {string} 后端 API 基地址（开发时固定为本机 8001） */
  const API_BASE = 'http://127.0.0.1:8001';
  
  // 主要功能元素
  const runBtn = document.getElementById('runBtn');           // 运行按钮
  const stopBtn = document.getElementById('stopBtn');         // 停止按钮
  const log = document.getElementById('log');                 // 日志容器
  const results = document.getElementById('results');         // 结果容器
  const historyList = document.getElementById('historyList'); // 历史列表容器
  const paramDiff = document.getElementById('paramDiff');     // 参数对比容器
  
  // 结果面板元素
  const resultsToggle = document.getElementById('resultsToggle');     // 结果按钮
  const resultsPanel = document.getElementById('resultsPanel');       // 结果面板
  const overlay = document.getElementById('overlay');                 // 遮罩层
  const closePanel = document.getElementById('closePanel');           // 关闭按钮
  
  // 历史抽屉元素
  const historyDrawerBtn = document.getElementById('historyDrawerBtn');       // 历史按钮
  const historyDrawer = document.getElementById('historyDrawer');             // 历史抽屉
  const closeHistoryDrawer = document.getElementById('closeHistoryDrawer');   // 关闭按钮

  // ==========================================================================
  // 工具函数
  // ==========================================================================

  /**
   * 向日志区域追加一行日志
   * @param {string} line - 日志内容
   */
  function appendLog(line){
    const el = document.createElement('div'); 
    el.textContent = line; 
    log.appendChild(el); 
    log.scrollTop = log.scrollHeight;  // 滚动到底部
  }

  /**
   * 格式化结果展示（力学指标 + 曲线图）
   * @param {Object} results - 结果数据
   * @param {string} runId - 运行 ID
   * @returns {string} HTML 字符串
   */
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

    // 图像显示（力 - 位移曲线）
    let imageHtml = '';
    if (results.image_file) {
        const imageUrl = `${API_BASE}/api/agent/result_image?run_id=${encodeURIComponent(runId)}&_ts=${Date.now()}`;
        imageHtml = `<div class="results-image"><img src="${imageUrl}" alt="力 - 位移曲线" /></div>`;
    }

    // 组合展示
    if (imageHtml || metricsHtml) {
        return `<div class="results-container">${imageHtml}${metricsHtml}</div>`;
    } else {
        // 无结构化数据，回退到 JSON 显示
        return `<pre>${JSON.stringify(results, null, 2)}</pre>`;
    }
  }

  // ==========================================================================
  // 弹窗控制函数（互斥逻辑）
  // ==========================================================================

  /**
   * 关闭所有弹窗（结果面板 + 历史抽屉 + 遮罩层）
   */
  function closeAllDrawers(){
    resultsPanel.classList.remove('open');
    historyDrawer.classList.remove('open');
    overlay.classList.remove('show');
  }

  /**
   * 打开结果面板（自动先关闭其他弹窗）
   */
  function openResultsPanel(){
    closeAllDrawers();  // 互斥：先关闭其他弹窗
    resultsPanel.classList.add('open');
    overlay.classList.add('show');
  }

  /**
   * 关闭结果面板（检查是否还有其他弹窗打开）
   */
  function closeResultsPanel(){
    resultsPanel.classList.remove('open');
    // 只有当历史抽屉也关闭时，才隐藏遮罩层
    if(!historyDrawer.classList.contains('open')){
      overlay.classList.remove('show');
    }
  }

  /**
   * 打开历史抽屉（自动先关闭其他弹窗，并加载历史数据）
   */
  function openHistoryDrawer(){
    closeAllDrawers();  // 互斥：先关闭其他弹窗
    historyDrawer.classList.add('open');
    overlay.classList.add('show');
    fetchHistory();  // 加载历史数据
  }

  /**
   * 关闭历史抽屉（检查是否还有其他弹窗打开）
   */
  function closeHistoryDrawerFunc(){
    historyDrawer.classList.remove('open');
    // 只有当结果面板也关闭时，才隐藏遮罩层
    if(!resultsPanel.classList.contains('open')){
      overlay.classList.remove('show');
    }
  }

  // ==========================================================================
  // 事件监听器
  // ==========================================================================

  // 结果面板事件
  resultsToggle.addEventListener('click', openResultsPanel);
  closePanel.addEventListener('click', closeResultsPanel);
  // 遮罩层点击：关闭当前打开的弹窗
  overlay.addEventListener('click', () => {
    if(resultsPanel.classList.contains('open')){
      closeResultsPanel();
    } else if(historyDrawer.classList.contains('open')){
      closeHistoryDrawerFunc();
    }
  });
  
  // 历史抽屉事件
  historyDrawerBtn.addEventListener('click', openHistoryDrawer);
  closeHistoryDrawer.addEventListener('click', closeHistoryDrawerFunc);

  // ==========================================================================
  // API 调用函数
  // ==========================================================================

  /**
   * 查询历史推荐（相似工作流）
   */
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

  /**
   * 运行实验按钮点击事件
   */
  runBtn.addEventListener('click', async ()=>{
    appendLog('▶ 准备运行智能体...');
    
    // 构建请求参数
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
      const res = await fetch(API_BASE + '/api/agent/run', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload)
      });
      if(!res.ok) throw new Error('后端返回错误');
      const data = await res.json();
      appendLog('✔ run_id: '+data.run_id);
      pollStatus(data.run_id);  // 开始轮询状态
    }catch(err){ 
      appendLog('✖ 请求失败：'+err.message); 
      results.innerHTML='出错'; 
    }
  });

  /**
   * 紧急停止按钮点击事件（占位符）
   */
  stopBtn.addEventListener('click', ()=>{ 
    appendLog('⚠️ 已发送紧急停止请求（需要后端支持）'); 
    /* TODO: 实现紧急停止逻辑 */
  });

  /**
   * 轮询实验状态（核心逻辑）
   * @param {string} run_id - 运行 ID
   */
  async function pollStatus(run_id){
    appendLog('⏳ 开始轮询状态...');
    try{
      // 跟踪每个运行的日志索引，避免重复追加
      if(!window._lastLogIndex) window._lastLogIndex = {};
      if(typeof window._lastLogIndex[run_id] === 'undefined') window._lastLogIndex[run_id] = 0;
      
      while(true){
        const res = await fetch(API_BASE + '/api/agent/status?run_id='+encodeURIComponent(run_id));
        if(!res.ok) throw new Error('status error');
        const s = await res.json();
        
        // 追加新日志（避免重复）
        if(s.logs && Array.isArray(s.logs)){
          const start = window._lastLogIndex[run_id] || 0;
          for(let i = start; i < s.logs.length; i++) appendLog(s.logs[i]);
          window._lastLogIndex[run_id] = s.logs.length;
        }
        
        // 更新参数对比
        if(s.param_diff) paramDiff.textContent = s.param_diff;
        
        // 处理等待前端确认的交互
        if(s.awaiting_confirm){
          appendLog('🔔 需要人工确认：'+s.awaiting_confirm);
          if(!window._confirmHandled) window._confirmHandled = {};
          if(!window._confirmHandled[run_id]){
            // 使用 prompt 获取用户输入并发送确认
            const userInput = window.prompt('请确认操作：\n'+s.awaiting_confirm, '已上样，继续');
            try{
              await fetch(API_BASE + '/api/agent/confirm', {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({run_id, user_input: userInput||'确认'})
              });
              appendLog('✔ 已发送确认');
            }catch(e){ 
              appendLog('✖ 发送确认失败：'+e.message); 
            }
            window._confirmHandled[run_id] = true;
          }
        }
        
        // 任务完成或出错
        if(s.status==='done' || s.status==='error'){
            appendLog('✅ 任务完成：'+s.status);
            if(s.results){
                const formatted = formatResultsDisplay(s.results, run_id);
                results.innerHTML = formatted;
                // 自动打开结果面板（遵守互斥逻辑）
                openResultsPanel();
                appendLog('📊 结果已生成，包含力学性能指标和力 - 位移曲线。');
            } else {
              results.innerHTML = '无';
            }
            break;
          }
        
        // 等待 1.5 秒后继续轮询
        await new Promise(r=>setTimeout(r,1500));
      }
    }catch(e){ 
      appendLog('轮询失败：'+e.message); 
    }
  }

  // ==========================================================================
  // 初始化
  // ==========================================================================
  fetchHistory();  // 页面加载时查询历史
});
