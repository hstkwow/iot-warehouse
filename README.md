# 应急智慧仓储系统安装使用说明

此仓库是四个子项目的源码汇总快照。本地密钥、数据库数据、依赖目录和构建产物未上传；原有子项目的 Git 历史不包含在此快照中。

启动前将 `.env.example` 复制为 `.env` 并填写自己的配置。百度语音凭据已清空，使用语音服务前需在本地配置 `hardware/include/config.h`，不要提交真实凭据。

本项目是一套面向应急物资场景的物联网仓储系统，包含以下 4 个部分：

- 后端：Spring Boot 3 + MyBatis + MySQL，负责用户认证、设备管理、库存管理、告警处理、统计分析和 MQTT 消息接入。
- 前端：Vue 2 + Element UI，提供仓储管理后台。
- 硬件端：ESP32-S3 + 传感器 + RFID，用于环境监测、状态上报和出入库识别。
- 小程序：微信小程序端，用于移动访问部分业务接口。

## 1. 项目目录

```text
iot-warehouse/
├── backend/      # Spring Boot 后端
├── frontend/     # Vue 管理端
├── hardware/     # ESP32-S3 固件工程
├── miniapp/      # 微信小程序
├── init.sql      # 初始化数据库脚本
└── docker-compose.lite.yml
```

## 2. 功能概览

- 用户登录与权限控制
- 设备管理与设备配置下发
- 温湿度、烟雾、气压、光照等环境数据监测
- RFID 物资入库、出库、盘点
- 库存不足与库存积压告警
- 统计看板与历史数据查询

## 3. 环境要求

按使用方式准备环境：

- Docker 部署：Docker、Docker Compose
- 本地开发后端：JDK 17
- 本地开发前端：Node.js 18 及以上、npm
- 硬件编译烧录：PlatformIO、ESP32-S3 开发板
- 小程序调试：微信开发者工具

## 4. 快速开始

### 4.1 Docker 一体化部署

当前 [docker-compose.lite.yml](docker-compose.lite.yml) 不是直接源码构建，而是挂载已经生成好的后端 Jar 和前端静态资源，因此需要先执行一次构建。

#### 第一步：准备根目录环境变量

在项目根目录创建或修改 `.env`，至少包含以下配置：

```env
DB_URL=jdbc:mysql://mysql:3306/iot_warehouse?useSSL=false&serverTimezone=Asia/Shanghai&characterEncoding=UTF-8&allowPublicKeyRetrieval=true
DB_USERNAME=root
DB_PASSWORD=root
JWT_SECRET=change-this-secret
JWT_EXPIRATION_MS=86400000
OSS_ENDPOINT=https://oss-cn-beijing.aliyuncs.com
OSS_ACCESS_KEY_ID=
OSS_ACCESS_KEY_SECRET=
OSS_BUCKET_NAME=iot-warehouse
```

说明：

- `DB_URL` 在 Docker 内要使用主机名 `mysql`，不要写成 `localhost`。
- 如果暂时不使用阿里云 OSS，可先保留空值，但相关上传能力可能不可用。

#### 第二步：构建后端 Jar

```bash
cd backend
./mvnw clean package -DskipTests
cp target/iot_warehouse-0.0.1-SNAPSHOT.jar app.jar
```

#### 第三步：构建前端静态资源

```bash
cd frontend
npm install
npm run build
```

#### 第四步：启动服务

```bash
docker compose -f docker-compose.lite.yml up -d
```

启动完成后访问：

- 管理后台：http://localhost
- 后端接口：http://localhost:8080
- MySQL：localhost:3306

查看运行状态：

```bash
docker compose -f docker-compose.lite.yml ps
```

停止服务：

```bash
docker compose -f docker-compose.lite.yml down
```

如果希望同时删除数据库卷：

```bash
docker compose -f docker-compose.lite.yml down -v
```

### 4.2 本地开发启动

适合前后端分别调试。

#### 第一步：启动 MySQL

可以直接使用 Docker 只启动数据库：

```bash
docker compose -f docker-compose.lite.yml up -d mysql
```

首次启动时会自动执行 [init.sql](init.sql) 初始化库表。此版本不包含业务数据和用户记录。

#### 第二步：启动后端

后端默认读取 [backend/src/main/resources/application.yml](backend/src/main/resources/application.yml) 中的配置，并额外尝试加载根目录的 `local-secrets.properties`。

```bash
cd backend
./mvnw spring-boot:run
```

默认地址：

- 后端接口：http://localhost:8080

说明：

- 本地启动时，数据库地址默认是 `jdbc:mysql://localhost:3306/iot_warehouse...`。
- 如需覆盖数据库、JWT、OSS 等配置，可在启动前设置环境变量，或修改 `local-secrets.properties`。
- 后端默认连接公共 MQTT Broker `broker.emqx.io:1883`。

#### 第三步：启动前端

```bash
cd frontend
npm install
npm run serve
```

默认访问地址：

- 前端开发服务：http://localhost:7010

前端开发环境默认直连 `http://localhost:8080`，生产构建默认走 `/api` 反向代理，详见 [frontend/src/config.js](frontend/src/config.js) 和 [frontend/nginx.lite.conf](frontend/nginx.lite.conf)。

## 5. 首次使用账号

此版本的初始化脚本仅包含表结构，不包含演示账号。首次使用前请自行初始化管理员账号，并填入自己的测试数据。

## 6. 初始化后建议的使用流程

推荐按以下顺序体验系统：

1. 使用管理员账号登录管理后台。
2. 在物资分类、物资档案、库位管理页面确认基础数据。
3. 在设备管理页面检查默认设备是否在线。
4. 在设备配置页面为设备设置温湿度、烟雾等阈值。
5. 通过硬件设备上报传感器数据，确认首页看板和历史记录可见。
6. 使用 RFID 标签进行入库、出库或盘点，观察库存变化和流水记录。
7. 在告警页面查看设备告警和库存告警处理结果。

## 7. 硬件端接入说明

硬件工程位于 [hardware](hardware)，使用 PlatformIO 构建。

编译烧录示例：

```bash
cd hardware
pio run
pio run -t upload
pio device monitor
```

接入前请重点检查：

- 开发板型号与串口配置是否匹配 [hardware/platformio.ini](hardware/platformio.ini)。
- Wi-Fi、MQTT、第三方语音服务等参数是否符合当前环境。
- 设备上报主题与后端订阅主题保持一致。

当前后端订阅主题为 `device/+/data`，并向 `device/{deviceId}/cmd` 下发控制或配置指令。

说明：设备端存在写死在源码中的环境相关配置，部署到新环境前应先检查 [hardware/include/config.h](hardware/include/config.h)，将其中的网络和第三方服务参数替换为你自己的配置。

## 8. 微信小程序说明

小程序工程位于 [miniapp](miniapp)，建议使用微信开发者工具导入 [miniapp/project.config.json](miniapp/project.config.json)。

注意事项：

- 在 `miniapp/miniprogram` 中执行 `npm install`，然后在微信开发者工具中执行“构建 npm”。
- 小程序接口基地址写在 [miniapp/miniprogram/util/config.js](miniapp/miniprogram/util/config.js)。
- 当前默认地址为一个固定公网 HTTP 地址，迁移部署后必须改成你自己的服务地址。
- 真机调试或正式发布通常要求 HTTPS 域名，并在微信公众平台后台配置合法域名。

## 9. 常见问题

### 9.1 Docker 启动后后端容器报找不到 Jar

原因：Compose 挂载的是 `backend/app.jar`，而不是 `target` 目录下的打包结果。

处理：重新执行后端打包并复制 Jar。

```bash
cd backend
./mvnw clean package -DskipTests
cp target/iot_warehouse-0.0.1-SNAPSHOT.jar app.jar
```

### 9.2 前端页面能打开，但接口全部 404 或 502

优先检查：

- 后端是否正常运行在 8080 端口。
- Docker 部署时前端是否通过 `/api` 转发到 `backend:8080`。
- 本地开发时前端是否仍指向错误的接口地址。

### 9.3 修改 init.sql 后数据没有变化

原因：MySQL 容器首次初始化后会保留数据卷，后续不会再次执行初始化脚本。

处理：

```bash
docker compose -f docker-compose.lite.yml down -v
docker compose -f docker-compose.lite.yml up -d
```

### 9.4 小程序请求失败

优先检查：

- [miniapp/miniprogram/util/config.js](miniapp/miniprogram/util/config.js) 中的接口地址是否正确。
- 微信开发者工具是否关闭了域名校验。
- 真机环境是否已配置合法 HTTPS 域名。

### 9.5 设备在线但没有数据

优先检查：

- 设备是否成功连接到 MQTT Broker。
- 上报主题是否为 `device/{deviceId}/data` 形式。
- 设备 ID 是否与系统中的设备编号一致。
- 后端日志中是否存在 MQTT 消息接收或解析异常。

## 10. 生产部署建议

- 将默认账号密码改为强密码。
- 将 JWT 密钥改为高强度随机值。
- 不要继续使用演示环境里的硬编码第三方服务参数。
- 将公共 MQTT Broker 替换为自建或受控 Broker。
- 为 MySQL 做独立备份和持久化。
- 为前后端配置反向代理、域名和 HTTPS。

## 11. 相关入口

- 后端说明：[backend/README.md](backend/README.md)
- 后端配置：[backend/src/main/resources/application.yml](backend/src/main/resources/application.yml)
- 前端配置：[frontend/src/config.js](frontend/src/config.js)
- Docker 编排：[docker-compose.lite.yml](docker-compose.lite.yml)
- 数据初始化脚本：[init.sql](init.sql)
