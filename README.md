# 统一收银系统（一期骨架）

当前仓库包含三部分：

- `server/`：NestJS 后端（MongoDB + Redis）
- `admin/`：Vue3 + Vite 管理后台（JWT 管理接口）
- `cashier/`：Vue3 + Vite 收银台 H5（`/pay/:orderId?t=...`）

## 1) 环境准备

建议：

- Node.js 20+
- MongoDB（默认 `mongodb://localhost:27017/cashier`）
- Redis（默认 `localhost:6379`）

复制配置文件：

- 后端：`cp server/.env.example server/.env`
- 管理后台：`cp admin/.env.example admin/.env`
- 收银台：`cp cashier/.env.example cashier/.env`

## 2) 启动方式

分别安装依赖并启动：

```bash
npm -C server i
npm -C admin i
npm -C cashier i

npm -C server run start:dev
npm -C admin run dev
npm -C cashier run dev
```

或在根目录使用脚本（需要先 `npm i` 安装 `concurrently`）：

```bash
npm i
npm run dev:all
```

默认端口：

- 后端：`http://localhost:3000`
- 管理后台：`http://localhost:5173`
- 收银台：`http://localhost:8080`

## 3) 推荐联调路径（最短闭环）

1. 打开管理后台：`/login`
   - 使用 `server/.env` 中的 `ADMIN_USERNAME / ADMIN_PASSWORD`
2. 在「商户管理」创建商户，并记录返回的 `appKey / appSecret`
3. 用签名方式调用后端创建订单：
   - `POST /api/v1/orders`
4. 从创建订单响应中拿到：
   - `qrcodeUrl`（已包含 `?t=...`）
5. 打开该 `qrcodeUrl`：
   - 将进入 `cashier/` 的 `/pay/:orderId` 页面

## 4) 关键实现位置（便于继续开发）

- 订单签发收银 token：`server/src/modules/order/order.service.ts:100`
- 统一二维码包含 token：`server/src/modules/payment/payment.service.ts:43`
- 收银台匿名接口：`server/src/modules/cashier/cashier.controller.ts:7`
- 管理后台商户页：`admin/src/views/MerchantListView.vue:1`
- 收银台支付页：`cashier/src/views/PayView.vue:1`
