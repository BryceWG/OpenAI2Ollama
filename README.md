# OpenAI2Ollama

将 OpenAI API 格式转换为 Ollama 格式的代理服务器，让你能够通过 Ollama 兼容的接口调用 OpenAI API。

## 功能特性

- 🔄 OpenAI 格式转 Ollama 格式
- 🚀 支持 Windows 服务自启动
- 🌐 完整的 HTTP API 代理
- ⚙️ 简单配置

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填入你的配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：
```
PORT=17924
OPENAI_API_URL=https://your-openai-api-endpoint/v1
OPENAI_API_KEY=your_api_key_here
DEFAULT_MODEL=gpt-3.5-turbo
```

### 3. 运行服务

```bash
npm start
```

服务将在 `http://localhost:17924` 启动。

### 4. 安装为 Windows 服务（可选）

以管理员权限运行：

```bash
npm run install-service
```

卸载服务：

```bash
npm run uninstall-service
```

## 在其他软件中使用

只需要将 Ollama API 地址设置为：`http://localhost:17924/api`

## 配置说明

- `PORT`: 服务监听端口（默认: 17924）
- `OPENAI_API_URL`: OpenAI API 地址
- `OPENAI_API_KEY`: OpenAI API 密钥
- `DEFAULT_MODEL`: 默认模型名称

## 许可证

MIT