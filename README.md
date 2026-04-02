# LabMind 前端原型

这是一个简单的静态前端原型，用于与 LabMind 后端（AI Agent）交互。它仅提供 UI 和与后端的 API 约定，后端需要实现对应的 HTTP 接口来提供完整功能。

目录
- `index.html` - 单页界面
- `styles.css` - 样式
- `app.js` - 前端逻辑与 API 调用示例

本地启动（简单测试）
1. 进入 `frontend` 目录：
```powershell
cd d:\LabMind\frontend
```
2. 启动一个简单的静态文件服务器（Python 自带）：
```powershell
python -m http.server 8080
```
3. 在浏览器打开 `http://localhost:8080`。

后端 API 约定（原型）
- POST /api/agent/run
  - 请求体 (application/json): { prompt: string, params: { so, l0, test_type, speed_mm_s, max_displacement, max_force } }
  - 返回: { status: 'ok', run_id: string }

- GET /api/agent/status?run_id=...
  - 返回: { status: 'running'|'done'|'error', logs: string[], param_diff: string, results: object|null }

- GET /api/agent/history?query=...
  - 返回: [ { id, timestamp, test_type, tool_sequence, parameters }, ... ]

建议的后端实现方式（快速）
- 在本地实现一个小的 Flask 或 FastAPI 服务，暴露上述三个端点。该服务可以直接调用 `run_lab_mind.py` 的内部函数或者通过启动 agent 进程并通过 IPC/SSE 与之通信。

安全与注意事项
- 在真实硬件环境中，后端必须做严格的权限、认证与安全检查；前端不应直接暴露设备控制权限给任意用户。
