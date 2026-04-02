# LabMind 前端原型

这是一个简单的静态前端原型，用于与 LabMind 后端（AI Agent）交互。它仅提供 UI 和与后端的 API 约定，后端需要实现对应的 HTTP 接口来提供完整功能。

## 目录结构

```
frontend/
├── index.html      # 单页界面（三列布局 + 两个弹窗）
├── styles.css      # 样式（浅色主题 + 响应式布局）
├── app.js          # 前端逻辑与 API 调用
└── README.md       # 本说明文档
```

## 页面布局

- **左侧栏**：参数对比/注入摘要 + 执行日志（可滚动）
- **中间栏**：实验指令卡片（居中显示，700px 宽）
- **右侧栏**：参数面板（表单输入）
- **弹窗**：
  - 右侧滑出式结果面板（实验完成时自动打开）
  - 底部滑出式历史推荐抽屉（点击"相似工作流"打开）
- **互斥逻辑**：同一时刻最多只有一个弹窗处于打开状态

## 本地启动（简单测试）

1. 进入 `frontend` 目录：
```powershell
cd c:\Users\kym\Desktop\rare\intelligent lab\frontend
```

2. 启动一个简单的静态文件服务器（Python 自带）：
```powershell
python -m http.server 8080
```

3. 在浏览器打开 `http://localhost:8080`。

## 后端 API 约定（原型）

### 1. 运行实验
- **端点**: `POST /api/agent/run`
- **请求体** (`application/json`):
```json
{
  "prompt": "用默认参数做一次拉伸测试",
  "params": {
    "so": 50,
    "l0": 50,
    "test_type": "tensile",
    "speed_mm_s": 2,
    "max_displacement": 100,
    "max_force": 5000
  }
}
```
- **返回**:
```json
{
  "status": "ok",
  "run_id": "abc123"
}
```

### 2. 查询状态
- **端点**: `GET /api/agent/status?run_id=abc123`
- **返回**:
```json
{
  "status": "running",
  "logs": ["日志行 1", "日志行 2"],
  "param_diff": "参数对比文本",
  "results": {
    "Fm (kN)": 12.5,
    "Rm (MPa)": 450,
    "image_file": "curve.png"
  },
  "awaiting_confirm": "请确认已上样"
}
```
- **状态说明**:
  - `running`: 任务执行中
  - `done`: 任务完成
  - `error`: 任务出错

### 3. 查询历史
- **端点**: `GET /api/agent/history?query=拉伸测试`
- **返回**:
```json
[
  {
    "id": "hist_001",
    "timestamp": "2024-01-01 10:00",
    "test_type": "tensile",
    "tool_sequence": ["tool1", "tool2"],
    "parameters": {"so": 50, "l0": 50}
  }
]
```

### 4. 确认交互（可选）
- **端点**: `POST /api/agent/confirm`
- **请求体**:
```json
{
  "run_id": "abc123",
  "user_input": "已上样，继续"
}
```

## 建议的后端实现方式（快速）

在本地实现一个小的 Flask 或 FastAPI 服务，暴露上述四个端点。该服务可以直接调用 `run_lab_mind.py` 的内部函数或者通过启动 agent 进程并通过 IPC/SSE 与之通信。

### 后端启动示例（FastAPI）
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# 允许前端跨域访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/agent/run")
async def run_agent(request: dict):
    # TODO: 实现实验运行逻辑
    return {"status": "ok", "run_id": "test_001"}

@app.get("/api/agent/status")
async def get_status(run_id: str):
    # TODO: 实现状态查询逻辑
    return {"status": "done", "logs": [], "results": None}

@app.get("/api/agent/history")
async def get_history(query: str):
    # TODO: 实现历史查询逻辑
    return []

@app.post("/api/agent/confirm")
async def confirm_action(request: dict):
    # TODO: 实现确认逻辑
    return {"status": "ok"}
```

## 安全与注意事项

- ⚠️ **在真实硬件环境中，后端必须做严格的权限、认证与安全检查**；前端不应直接暴露设备控制权限给任意用户。
- ⚠️ **开发时注意跨域问题**：后端需要配置 CORS 允许前端访问（见上方示例）。
- ⚠️ **API 地址配置**：前端默认连接 `http://127.0.0.1:8001`，如需修改请在 `app.js` 中调整 `API_BASE` 常量。

## 维护说明

### 修改 API 地址
编辑 `app.js` 第 9 行：
```javascript
const API_BASE = 'http://127.0.0.1:8001';  // 修改为实际后端地址
```

### 调整布局样式
- 三列宽度：编辑 `styles.css` 第 11 行 `.layout` 的 `grid-template-columns`
- 卡片尺寸：编辑 `styles.css` 第 19-21 行 `.center .card` 和 `.expanded-card`
- 弹窗样式：编辑 `styles.css` 第 80-100 行

### 添加新参数
1. 在 `index.html` 的参数面板中添加新的 `<label>` 和 `<input>`
2. 在 `app.js` 的 `runBtn` 事件监听器中收集新参数值
3. 在后端 API 中处理新参数

### 调试技巧
- 打开浏览器开发者工具（F12）
- 查看 Console 中的日志输出
- 在 Network 标签查看 API 请求和响应
- 在 Elements 标签检查 DOM 结构和样式

## 常见问题

**Q: 点击按钮无反应？**  
A: 检查浏览器 Console 是否有错误，确认后端服务已启动且 API 地址正确。

**Q: 弹窗无法关闭？**  
A: 检查遮罩层事件绑定，确认关闭按钮的点击事件正常触发。

**Q: 样式显示异常？**  
A: 清除浏览器缓存（Ctrl+F5 强制刷新），检查 CSS 文件是否正确加载。
