# Poverty Ward Admin Permissions Design

**Goal**

Tach quyen RBAC rieng cho cap nhat thong tin chung xa/phuong va quan ly khu vuc/ap, khong dung chung `poverty.household.*`.

**Scope**

- Backend permission constants va route-permission mapping cho:
  - `poverty.ward_overview`
  - `poverty.ward_area`
- Seed RBAC mac dinh de role `admin` workspace co du cac quyen moi.
- Frontend guard cho:
  - [`FE/src/components/poverty/PovertyAdminGeneralInfoPage.tsx`](/Users/sondt/Dev/Git/GIS%20ASXH/FE/src/components/poverty/PovertyAdminGeneralInfoPage.tsx)
  - [`FE/src/components/poverty/PovertyAreaManagementPage.tsx`](/Users/sondt/Dev/Git/GIS%20ASXH/FE/src/components/poverty/PovertyAreaManagementPage.tsx)

**Design**

- Giu nguyen endpoint va payload hien co de tranh regression API.
- Tach 2 resource RBAC moi:
  - `poverty.ward_overview.view|update|delete`
  - `poverty.ward_area.view|create|update|delete`
- Mapping route:
  - `GET /poverty/ward-overviews` -> `poverty.ward_overview.view`
  - `PUT /poverty/ward-overviews` -> `poverty.ward_overview.update`
  - `DELETE /poverty/ward-overviews/:id` -> `poverty.ward_overview.delete`
  - `GET /poverty/wards/:wardCode/areas` -> `poverty.ward_area.view`
  - `POST /poverty/wards/:wardCode/areas` -> `poverty.ward_area.create`
  - `PATCH /poverty/wards/:wardCode/areas/:areaId` -> `poverty.ward_area.update`
  - `DELETE /poverty/wards/:wardCode/areas/:areaId` -> `poverty.ward_area.delete`

**Frontend behavior**

- Man hinh thong tin chung:
  - Can `poverty.ward_overview.view` moi mo duoc modal danh sach thong tin nam.
  - Nut luu dung `poverty.ward_overview.update`.
  - Nut xoa dung `poverty.ward_overview.delete`.
  - Nut vao quan ly khu vuc/ap dung `poverty.ward_area.view`.
- Man hinh khu vuc/ap:
  - Load danh sach dung `poverty.ward_area.view`.
  - Tao moi dung `poverty.ward_area.create`.
  - Sua dung `poverty.ward_area.update`.
  - Xoa dung `poverty.ward_area.delete`.

**Testing**

- Them regression test backend cho permission constant va route map.
- Chay test backend lien quan.
- Chay type/lint test frontend toi thieu cho cac file da doi neu co kha nang.
