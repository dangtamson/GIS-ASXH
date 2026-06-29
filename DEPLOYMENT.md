# Docker + GitLab CI/CD (Deploy VM)

## 1) Files added

- `FE/Dockerfile`: build and run Next.js frontend (Node 22)
- `FE/.dockerignore`: reduce build context
- `docker-compose.vm.yml`: run `frontend`, `backend`, `postgres` on VM
- `deploy/.env.backend.example`: mẫu biến môi trường cho backend
- `.gitlab-ci.yml`: build image, push GitLab Registry, SSH deploy lên VM

## 2) Tag convention (deploy theo tag)

- `staging-vX.Y.Z` => build + deploy môi trường `staging`
- `vX.Y.Z` => build + deploy môi trường `production`

Regex đang dùng trong CI:

- staging: `^staging-v\\d+\\.\\d+\\.\\d+([-.][0-9A-Za-z]+)*$`
- production: `^v\\d+\\.\\d+\\.\\d+([-.][0-9A-Za-z]+)*$`

Ví dụ:

- `staging-v1.4.0`
- `v1.4.0`

## 3) GitLab CI/CD variables cần cấu hình

Biến dùng chung (bắt buộc):

- `SSH_PRIVATE_KEY`: private key để SSH vào VM

Biến dùng chung (nên cấu hình):

- `CI_REGISTRY_USER`
- `CI_REGISTRY_PASSWORD`

Biến cho `staging` (bắt buộc):

- `DEPLOY_HOST_STAGING`
- `DEPLOY_USER_STAGING`
- `NEXT_PUBLIC_API_BASE_URL_STAGING`
- `BACKEND_ENV_FILE_STAGING` (multi-line nội dung `.env` backend)

Biến cho `production` (bắt buộc):

- `DEPLOY_HOST_PRODUCTION`
- `DEPLOY_USER_PRODUCTION`
- `NEXT_PUBLIC_API_BASE_URL_PRODUCTION`
- `BACKEND_ENV_FILE_PRODUCTION` (multi-line nội dung `.env` backend)

Biến tùy chọn cho từng môi trường:

- `DEPLOY_PORT_STAGING`, `DEPLOY_PORT_PRODUCTION` (default `22`)
- `DEPLOY_PATH_STAGING` (default `/opt/quanlytheodoinhiemvu-staging`)
- `DEPLOY_PATH_PRODUCTION` (default `/opt/quanlytheodoinhiemvu`)
- `BACKEND_PORT_STAGING`, `BACKEND_PORT_PRODUCTION` (default `4000`)
- `FRONTEND_PORT_STAGING`, `FRONTEND_PORT_PRODUCTION` (default `3000`)
- `POSTGRES_HOST_STAGING`, `POSTGRES_HOST_PRODUCTION` (default `postgres`)
- `POSTGRES_PORT_STAGING`, `POSTGRES_PORT_PRODUCTION` (default `5432`)
- `POSTGRES_USER_STAGING`, `POSTGRES_USER_PRODUCTION` (default `postgres`)
- `POSTGRES_PASSWORD_STAGING`, `POSTGRES_PASSWORD_PRODUCTION` (default `postgres`)
- `POSTGRES_DB_STAGING`, `POSTGRES_DB_PRODUCTION` (default `postgres`)

## 3.1) Runner requirement

- Runner cần có tag `kaniko` (pipeline đang dùng `tags: [kaniko]`)

## 4) VM prerequisites

- Cài Docker + Docker Compose plugin
- User deploy có quyền chạy Docker (`docker ps` chạy được không cần sudo)
- VM truy cập được GitLab Container Registry

## 5) Luồng auto deploy

Khi tạo tag hợp lệ:

1. Build image `backend` với tag `$CI_COMMIT_TAG`
2. Build image `frontend` theo đúng env (`NEXT_PUBLIC_API_BASE_URL_STAGING` hoặc `NEXT_PUBLIC_API_BASE_URL_PRODUCTION`)
3. Push image lên GitLab Registry
4. SSH vào VM, copy `docker-compose.yml`, `.env`, `.env.backend`
5. Chạy:
   - `docker compose pull`
   - `docker compose up -d --remove-orphans`

## 6) Cách tạo tag để deploy

Staging:

```bash
git tag staging-v1.0.0
git push origin staging-v1.0.0
```

Production:

```bash
git tag v1.0.0
git push origin v1.0.0
```
