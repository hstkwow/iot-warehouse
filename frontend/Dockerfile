# ===== Stage 1: Build Vue =====
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# 注入生产环境后端地址（构建时通过 ARG 传入）
# 容器内通过 Nginx 代理后端，前端默认走 /api
ARG VUE_APP_API_BASE_URL=/api
ENV VUE_APP_API_BASE_URL=$VUE_APP_API_BASE_URL

RUN npm run build

# ===== Stage 2: Nginx serving =====
FROM nginx:alpine

# 删除默认配置
RUN rm /etc/nginx/conf.d/default.conf

# 复制自定义 nginx 配置
COPY nginx.docker.conf /etc/nginx/nginx.conf

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
