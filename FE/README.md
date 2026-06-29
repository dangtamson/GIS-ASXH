# THEODOINHIEMVU Frontend (Next.js)

Ung dung duoc xay dung tren Next.js App Router, ket hop giao dien tham khao tu `dangtamson/theodoinhiemvu` va ket noi truc tiep voi cac API trong `postman-collection.json`.

## Yeu cau

- Node.js 20+
- NPM
- Backend API dang chay

## Cai dat

```bash
npm install
cp .env.example .env.local
```

Cap nhat `NEXT_PUBLIC_API_BASE_URL` trong `.env.local` theo dia chi backend cua ban.

## Chay du an

```bash
npm run dev
```

Build production:

```bash
npm run build
npm start
```

## Chuc nang da tich hop

- Dang nhap: `POST /login`
- Dang ky: `POST /signup`
- Dashboard tong quan: doc du lieu tu tasks, task-assignments, documents
- Cac module nghiep vu:
	- `/nhiem-vu-da-giao` -> `/admin/tasks`
	- `/nhiem-vu-duoc-giao` -> `/admin/task-assignments`
	- `/van-ban` -> `/admin/documents`
	- `/danh-gia` -> `/admin/task-progress`
	- `/nhom-to-chuc` -> `/admin/workspaces`
- Bao cao dong: `/bao-cao/[slug]`
- Danh muc dong: `/danh-muc/[slug]`
- Quan tri dong: `/quan-tri/[slug]`

Tat ca cac trang module su dung giao dien CRUD dong (list/create/update/delete) va goi truc tiep API theo endpoint map.

## Cau truc quan trong

- `src/lib/api.ts`: wrapper request, auth header, xu ly loi
- `src/lib/auth.ts`: quan ly token + account trong localStorage
- `src/lib/endpoints.ts`: map endpoint theo Postman collection
- `src/components/app/ResourceCrudPage.tsx`: component CRUD dung chung
- `src/components/app/DashboardOverview.tsx`: dashboard tong quan

