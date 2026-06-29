# Configurable Default Feature

## Objective

Cho phép quản trị viên cấu hình một chức năng động làm trang mặc định của workspace. Khi người dùng truy cập `/`, hệ thống chuyển đến chức năng đã cấu hình nếu người dùng có quyền truy cập.

## Configuration

- Lưu UUID chức năng tại `system_configs.general.defaultFeatureId`.
- Không tạo bảng cấu hình mới.
- Trang **Cấu hình hệ thống** bổ sung trường chọn **Trang mặc định** trong tab cấu hình chung.
- Danh sách lựa chọn lấy từ các chức năng đang bật, có UUID và `path` hợp lệ.
- Không cho chọn chức năng có `path="/"` để tránh vòng lặp chuyển hướng.
- Khi chức năng được đổi `path`, cấu hình vẫn hợp lệ vì lưu UUID thay vì đường dẫn.

## Root Route Behavior

Khi người dùng truy cập `/`:

1. Tải cấu hình hệ thống của workspace hiện tại.
2. Tải các chức năng người dùng được quyền truy cập:
   - Super admin sử dụng toàn bộ chức năng đang bật.
   - Người dùng thường sử dụng danh sách role-feature của role hiện tại.
3. Nếu `defaultFeatureId` trùng một chức năng được quyền truy cập và chức năng có đường dẫn hợp lệ, chuyển đến đường dẫn đó.
4. Nếu người dùng không có quyền vào chức năng mặc định, chuyển đến chức năng được quyền đầu tiên theo `orderIndex`.
5. Nếu không có chức năng hợp lệ, giữ lại dashboard tổng quan cũ tại `/`.

## Frontend Components

### System Configuration

- Mở rộng kiểu `SystemConfig.general` với `defaultFeatureId?: string | null`.
- Trang cấu hình hệ thống tải danh sách chức năng từ API hiện có.
- Select hiển thị tên chức năng và đường dẫn để tránh chọn nhầm.
- Khi lưu, `defaultFeatureId` được gửi trong `general`.

### Root Page

- Chuyển nội dung dashboard tổng quan cũ thành component fallback.
- Root page sử dụng client-side resolver vì quyền và workspace hiện được lấy từ trạng thái đăng nhập phía trình duyệt.
- Trong lúc phân giải trang mặc định, hiển thị trạng thái tải gọn để tránh dashboard cũ nháy trước khi redirect.
- Dùng `router.replace()` để `/` không nằm lại trong lịch sử điều hướng.

## Backend

- Cấu trúc `general` hiện là JSON nên không cần migration database.
- Schema cập nhật cấu hình hiện chấp nhận section động; không cần thay đổi API payload.
- API danh sách chức năng và role-feature hiện có được tái sử dụng.

## Error Handling

- Lỗi tải cấu hình hoặc danh sách chức năng: hiển thị dashboard tổng quan cũ.
- UUID cấu hình không còn tồn tại hoặc feature bị tắt: dùng feature được quyền đầu tiên.
- Feature thiếu path, path rỗng hoặc path `/`: bỏ qua.
- Không chuyển hướng đến URL ngoài hệ thống; chỉ chấp nhận path bắt đầu bằng `/` và không bắt đầu bằng `//`.

## Testing

- Chọn và lưu một chức năng mặc định.
- Truy cập `/` với người có quyền và xác nhận chuyển đúng trang.
- Truy cập `/` với người không có quyền và xác nhận chuyển đến feature đầu tiên được cấp.
- Tắt hoặc xoá feature đã cấu hình và xác nhận fallback.
- Không có feature hợp lệ và xác nhận dashboard tổng quan cũ vẫn hiển thị.
- Xác nhận không tạo redirect loop khi dữ liệu cấu hình sai.
