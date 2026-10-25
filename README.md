# Todo Flow

一个本地学习用的待办应用。React 负责页面，Go 提供接口，SQLite 保存数据。注册和登录使用 JWT，每个用户只能看到自己的待办。

## 环境

- Go 1.26 或与 `server/go.mod` 一致的版本
- [Bun](https://bun.sh)

## 启动

开两个终端。

后端要在 `server/` 里启动，数据库路径是相对这个目录的：

```bash
cd server
go run .
```

服务监听 `http://localhost:8080`。第一次启动会创建 `server/database/todo.db`，并按模型建好 `users` 和 `todos` 表。

前端：

```bash
cd web
bun install
bun run dev
```

Vite 默认是 `http://localhost:5173`。页面里的 `/api` 请求会代理到 `8080`，所以前端不要把接口写成另一个端口。

## 页面

| 路径 | 作用 |
| --- | --- |
| `/register` | 注册。填写用户名、密码和确认密码 |
| `/login` | 登录 |
| `/` | 待办列表。没有 token 时会跳到登录页 |

注册和登录成功后，token 保存在浏览器本地存储里。之后的请求会带上 `Authorization: Bearer <token>`。

## 接口

公开接口：

| 方法 | 路径 | 请求体 |
| --- | --- | --- |
| `GET` | `/api/health` | 无 |
| `POST` | `/api/auth/register` | `{ "username", "password" }` |
| `POST` | `/api/auth/login` | `{ "username", "password" }` |

注册返回 `201`，登录返回 `200`。成功时的响应是 `{ "token", "user" }`。`user` 里没有密码。用户名重复返回 `409`，用户名或密码错误返回 `401`。

需要登录的接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/me` | 当前用户 |
| `GET` | `/api/todos` | 当前用户的待办，没有数据时是 `[]` |
| `POST` | `/api/todos` | `{ "title" }`，标题会去掉首尾空格 |
| `PATCH` | `/api/todos/:id` | 可只传 `title` 或 `completed` |
| `DELETE` | `/api/todos/:id` | 成功返回 `204` |

待办按 token 里的用户隔离。访问别人的待办会得到 `404`。没有 token 或 token 无效会得到 `401`。

密码在后端用 bcrypt 存成 `password_hash`，不会把原文写进数据库，也不会在响应里返回。

JWT 签名密钥来自环境变量 `JWT_SECRET`。没有设置时使用本机默认值 `todo-flow-dev`。token 有效期是 7 天。

## 目录

```text
todo-flow/
├── web/                 # React 前端
│   └── src/
│       ├── api.ts       # 带 token 的请求
│       └── pages/       # 登录、注册、待办
└── server/              # Go 后端
    ├── main.go          # 启动入口和数据库连接
    ├── models/          # User、Todo
    ├── auth/            # 注册、登录、JWT 校验
    ├── todo/            # 待办增删改查
    ├── routes/          # 路由注册
    └── database/        # SQLite 文件，不提交
```

`server/config`、`server/handlers`、`server/middleware` 是预留的空目录，当前没有代码，不影响运行。

## 测试

```bash
cd server
go test ./...
```
