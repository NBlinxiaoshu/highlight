# 历史记录服务

这是“小黄笔 Highlight”的最小自建后端，负责转写任务、账号与跨设备资料库。它不包含第三方依赖，使用 Node.js 内置 SQLite、scrypt 密码哈希和随机会话令牌。

## 本地运行

```bash
cd server
npm start
```

默认监听 `127.0.0.1:8787`，数据保存在 `server/data/xyd.sqlite`。部署到云端时必须：

- 使用 HTTPS；
- 把 `XYD_DATABASE_PATH` 指向持久磁盘；
- 配置备份与磁盘加密；
- 使用反向代理做限流；
- 部署域名确认后，再在扩展中启用登录和上传。

## API

- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `GET /v1/library`
- `GET /v1/library/:episodeId`
- `PUT /v1/library/:episodeId`
- `DELETE /v1/library/:episodeId`

当前扩展只展示本机历史。云端登录控件默认隐藏，防止在未确认部署地址前误传邮箱、密码、完整逐字稿或私人笔记。
