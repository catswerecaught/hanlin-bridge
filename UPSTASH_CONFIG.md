# Upstash Redis 配置说明

## 环境变量配置

为了使社交媒体功能正常工作，需要配置以下环境变量：

### 方式一：使用 KV_REST_API 变量
```bash
export KV_REST_API_URL="https://your-database-url.upstash.io"
export KV_REST_API_TOKEN="your-access-token"
```

### 方式二：使用 UPSTASH_REDIS 变量
```bash
export UPSTASH_REDIS_REST_URL="https://your-database-url.upstash.io"
export UPSTASH_REDIS_REST_TOKEN="your-access-token"
```

## 获取 Upstash 凭据

1. 访问 [Upstash Console](https://console.upstash.com/)
2. 创建新的 Redis 数据库或选择现有数据库
3. 在数据库详情页面找到：
   - **Endpoint**: 用作 `*_REST_URL`
   - **Token**: 用作 `*_REST_TOKEN`

## 本地开发

在项目根目录创建 `.env` 文件：
```env
KV_REST_API_URL=https://your-database-url.upstash.io
KV_REST_API_TOKEN=your-access-token
```

然后使用 `node server.js` 启动服务器。

## 部署说明

在部署平台（如 Vercel、Netlify 等）中设置相同的环境变量。

## 数据结构

- **社交帖子**: 存储在键 `social-posts` 下
- **初始化**: 首次访问时会自动创建示例数据
- **持久化**: 所有点赞、转发、评论数据都会保存到 Upstash

## 故障排除

如果遇到问题：
1. 检查环境变量是否正确设置
2. 确认 Upstash 数据库状态正常
3. 查看服务器控制台日志获取详细错误信息
