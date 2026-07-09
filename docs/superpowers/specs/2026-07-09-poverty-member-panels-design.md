# Poverty Member Panels Design

## Goal

Bổ sung các panel thống kê nhân khẩu cho ba trang `ho-ngheo/dashboard`, `ho-ngheo/dashboard-dieu-hanh`, và `ho-ngheo/ban-do`, gồm:

- Tổng số nhân khẩu của hộ nghèo và hộ cận nghèo
- Tổng số nhân khẩu của hộ nghèo
- Tổng số nhân khẩu của hộ cận nghèo

Các chỉ số phải bám theo bộ lọc đang áp dụng trên từng trang.

## Scope

Trong phạm vi thay đổi này:

- Mở rộng dữ liệu trả về từ dashboard backend để có tổng nhân khẩu theo nhóm hộ
- Hiển thị thêm panel mới trên hai dashboard quản trị
- Hiển thị thêm panel mới trên trang bản đồ quản trị
- Bổ sung test cho logic cộng `memberCount`

Ngoài phạm vi:

- Không tạo endpoint mới
- Không thay đổi cách tính `memberCount`
- Không thay đổi giao diện công khai

## Data Definition

Nguồn dữ liệu được chốt là cộng trường `memberCount` của từng hộ, với quy tắc fallback rõ ràng khi snapshot chưa có dữ liệu.

### Dashboard API

`GET /poverty/dashboard` sẽ trả thêm:

```ts
memberTotals?: {
  total?: number;
  poor?: number;
  nearPoor?: number;
};
```

Ý nghĩa:

- `total`: tổng `memberCount` của toàn bộ hộ đang thuộc `POOR` hoặc `NEAR_POOR`
- `poor`: tổng `memberCount` của các hộ `POOR`
- `nearPoor`: tổng `memberCount` của các hộ `NEAR_POOR`

Quy tắc lấy số nhân khẩu cho từng hộ:

- ưu tiên `poorHouseholds.memberCount`
- nếu `poorHouseholds.memberCount` là `null`, fallback sang đếm thực từ `householdMembers`
- nếu cả hai đều không có dữ liệu, tính là `0`

Các số này dùng cùng bộ lọc hiện có của dashboard:

- `year`
- `provinceCode`
- `wardCode`
- `areaId`
- các điều kiện phạm vi theo `scope`

Phân loại hộ tiếp tục dùng `effectivePovertyTypeSql` để tránh lệch với các panel số hộ hiện tại.

### Map Page

Trang `ho-ngheo/ban-do` không gọi thêm API summary. Ba chỉ số nhân khẩu được tính trực tiếp từ tập `markers` đang tải trong FE:

- chỉ cộng các marker có `povertyType` là `POOR` hoặc `NEAR_POOR`
- dùng `memberCount ?? 0`
- số liệu thay đổi theo đúng bộ lọc bản đồ đang áp dụng vì `markers` đã phản ánh bộ lọc đó

## Backend Design

File chính: `BE/src/handlers/admin/resources/poverty/poverty.repository.ts`

Thay đổi:

1. Mở rộng `getDashboard` để lấy thêm `memberTotals`
2. Cộng `memberCount` từ `poorHouseholds`
3. Tách helper nhỏ để chuẩn hóa số:

- `total`
- `poor`
- `nearPoor`

Mục tiêu là giữ phần query số hộ hiện có ổn định, chỉ thêm một nhánh summary song song cho nhân khẩu.

### Behavior Rules

- Nếu `memberCount` là `null`, tính là `0`
- Nếu không có hộ phù hợp bộ lọc, cả ba giá trị đều trả `0`
- `total` phải bằng `poor + nearPoor`

## Frontend Design

### `ho-ngheo/dashboard`

File chính: `FE/src/components/poverty/PovertyDashboardPage.tsx`

Thêm ba stat card mới vào cụm tổng quan:

- `Tổng nhân khẩu hộ nghèo/cận nghèo`
- `Nhân khẩu hộ nghèo`
- `Nhân khẩu hộ cận nghèo`

Yêu cầu:

- Giữ cùng pattern card hiện tại
- Dùng tone màu tách biệt nhưng cùng hệ visual hiện có
- Không đổi luồng fetch dữ liệu
- Bố cục cần tách 3 card nhân khẩu thành một cụm riêng bên dưới nhóm chỉ số lõi để tránh 9 card dàn phẳng trên cùng một hàng

### `ho-ngheo/dashboard-dieu-hanh`

File chính: `FE/src/components/poverty/PovertyCommandDashboardPage.tsx`

Thêm một panel riêng cho nhân khẩu nhóm hộ mục tiêu, đặt cạnh các panel summary hiện có ở cột trái.

Nội dung panel:

- Tổng nhân khẩu nghèo/cận nghèo
- Nhân khẩu hộ nghèo
- Nhân khẩu hộ cận nghèo

Lý do tách panel:

- Giữ riêng phần “quy mô dân cư chung” và “quy mô nhân khẩu của nhóm hộ mục tiêu”
- Không làm panel hiện có quá dày đặc

### `ho-ngheo/ban-do`

File chính: `FE/src/components/poverty/PovertyLeafletMap.tsx`

Thêm ba panel riêng cho nhân khẩu, lấy từ utility cộng `memberCount` trên `markers`.

Yêu cầu:

- Không tạo request mới
- Cập nhật tức thời khi `markers` thay đổi theo bộ lọc
- Dùng cùng ngôn ngữ hiển thị với dashboard để người dùng đọc số liệu nhất quán

## FE Utility Split

Để tránh nhồi logic cộng `memberCount` trực tiếp trong component bản đồ, tạo utility thuần nhỏ ở FE cho:

- nhận `PovertyMarker[]`
- trả ra `total`, `poor`, `nearPoor`

Utility này là nơi test chính cho trang bản đồ.

## Testing

### Backend

Thêm test fail-first trong:

- `BE/src/handlers/admin/resources/poverty/poverty.repository.test.ts`

Các case bắt buộc:

- cộng đúng tổng `memberCount` của `POOR`
- cộng đúng tổng `memberCount` của `NEAR_POOR`
- `total = poor + nearPoor`
- `null` hoặc thiếu `memberCount` được tính là `0`

### Frontend

Thêm test utility cho logic cộng `markers`:

- `POOR`
- `NEAR_POOR`
- marker loại khác không được cộng vào tổng mục tiêu
- `memberCount` thiếu hoặc `null` phải về `0`

Kiểm tra kỹ thuật sau khi sửa:

- FE `eslint`
- FE `tsc --noEmit`
- test BE của repository poverty
- test FE của utility mới

## Risks And Constraints

- Số liệu bản đồ và số liệu dashboard cùng dùng `memberCount`, nhưng một bên lấy từ API dashboard, một bên lấy từ `markers`. Điều này chấp nhận được vì cả hai đều dựa trên cùng dữ liệu hộ sau khi áp dụng bộ lọc.
- Nếu sau này `markers` không còn mang đủ `memberCount`, trang bản đồ sẽ cần chuyển sang dùng summary API. Thay đổi này chưa nằm trong phạm vi hiện tại.

## Implementation Summary

Thay đổi sẽ tập trung vào một luồng đơn giản:

1. Backend dashboard trả thêm `memberTotals`
2. FE dashboard và command dashboard render thêm panel từ `memberTotals`
3. FE map page tính nhân khẩu từ `markers` và render thêm panel
4. Mọi logic cộng số đều có test trước khi viết code
