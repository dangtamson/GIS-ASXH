# Poverty Route Normalization

## Objective

Chuẩn hóa các trang thuộc hệ hộ nghèo vào namespace `/ho-ngheo` để dễ quản lý route, feature config và sidebar.

## New Routes

- `/ho-ngheo`: danh sách hộ nghèo/cận nghèo.
- `/ho-ngheo/[id]`: chi tiết hộ.
- `/ho-ngheo/ban-do`: bản đồ hộ nghèo/cận nghèo.
- `/ho-ngheo/dashboard`: dashboard hộ nghèo hiện tại.
- `/ho-ngheo/dashboard-dieu-hanh`: dashboard điều hành 3D.
- `/ho-ngheo/bao-cao`: báo cáo hộ nghèo.

## Backward Compatibility

Các route cũ vẫn tồn tại nhưng chỉ redirect sang route mới:

- `/ban-do-ho-ngheo` -> `/ho-ngheo/ban-do`
- `/dashboard-ho-ngheo` -> `/ho-ngheo/dashboard`
- `/dashboard-dieu-hanh-ho-ngheo` -> `/ho-ngheo/dashboard-dieu-hanh`
- `/bao-cao-ho-ngheo` -> `/ho-ngheo/bao-cao`

Query string phải được giữ nguyên khi redirect, ví dụ `/ban-do-ho-ngheo?householdId=abc` sang `/ho-ngheo/ban-do?householdId=abc`.

## Internal Link Updates

Các link nội bộ trong frontend phải chuyển sang route mới:

- Link từ danh sách hộ sang bản đồ dùng `/ho-ngheo/ban-do`.
- Link từ chi tiết hộ quay lại bản đồ dùng `/ho-ngheo/ban-do`.
- Link popup bản đồ sang chi tiết hộ giữ `/ho-ngheo/[id]`.

## Feature Configuration

Các feature đã lưu trong DB nên được cập nhật sang route mới. Redirect đảm bảo dữ liệu cũ không gãy ngay, nhưng cấu hình mới nên dùng route chuẩn.

## Verification

- Truy cập route mới render đúng trang.
- Truy cập route cũ redirect đúng route mới và giữ query string.
- Chức năng “xem trên bản đồ” từ danh sách hộ vẫn fly tới hộ nếu có tọa độ.
- Chi tiết hộ mở từ bản đồ quay lại đúng `/ho-ngheo/ban-do`.
- Cấu hình trang mặc định có thể chọn route mới.
