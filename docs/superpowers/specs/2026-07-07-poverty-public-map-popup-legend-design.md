# Poverty Public Map Popup And Legend Design

## Goal

Mở rộng popup trên bản đồ công khai để hiển thị nhiều thông tin hơn cho từng hộ gia đình, đồng thời làm cho chú thích và marker trên bản đồ khớp hoàn toàn với 3 loại dữ liệu công khai: `Hộ nghèo`, `Hộ cận nghèo`, `Hộ thường`.

## Scope

Thay đổi chỉ áp dụng cho phần bản đồ công khai đang dùng trong:

- `FE/src/components/poverty/PovertyPublicMapStage.tsx`
- các helper marker/cluster public map liên quan
- style marker public map trong `FE/src/app/globals.css` nếu cần thêm biến thể cho `Hộ thường`

Không thay đổi:

- logic cluster gom cụm
- layout tổng thể của trang public map
- điều hướng sang trang chi tiết hộ
- backend hoặc cấu trúc dữ liệu public API

## Current Problem

Hiện popup public map còn ngắn, mới tập trung vào tên hộ, địa bàn, loại hộ, số thành viên và số ảnh. Đồng thời legend đang hiển thị 3 loại dữ liệu nhưng marker public thực tế mới chỉ có 2 kiểu hình ảnh, khiến `Hộ thường` không có biểu diễn riêng trên bản đồ và không khớp với chú thích.

## UX Design

### Popup content

Popup mới giữ phong cách gọn, hiện đại, ưu tiên quét nhanh trên mobile và desktop.

Nội dung popup gồm 3 lớp:

1. `Header`
- tên chủ hộ hoặc mã hộ nếu thiếu tên
- tag phân loại hộ theo màu

2. `Thông tin nhận diện`
- mã hộ
- địa chỉ
- khu vực/ấp
- xã/phường

3. `Thông tin nhanh`
- số thành viên
- số ảnh hiện trường
- tọa độ rút gọn để người xem dễ đối chiếu vị trí

Footer giữ nút:

- `Xem chi tiết hộ`

Các trường trống sẽ có fallback ngắn gọn như `Chưa cập nhật` hoặc `-`, tránh popup bị vỡ bố cục.

### Legend

Legend dưới bản đồ sẽ tiếp tục hiển thị đủ 3 loại:

- `Hộ nghèo`
- `Hộ cận nghèo`
- `Hộ thường`

Legend phải dùng đúng màu hoặc hình thái tương ứng với marker thực tế để người ngoài nhìn bản đồ là hiểu ngay.

## Marker Design

### Existing markers

- `Hộ nghèo`: giữ marker ảnh đỏ hiện tại
- `Hộ cận nghèo`: giữ marker ảnh vàng/cam hiện tại

### New normal-household marker

Thêm một biến thể marker public riêng cho `Hộ thường`:

- tông xanh dương
- cùng kích thước, nhịp pulse và silhouette với 2 marker hiện có
- không dùng lại marker `Hộ cận nghèo` để tránh hiểu nhầm

Nếu codebase đã có asset phù hợp thì tái sử dụng. Nếu chưa có asset xanh dương, dùng cùng cấu trúc `divIcon` hiện tại nhưng với class màu riêng để tạo marker khác biệt rõ ràng.

## Technical Design

### `PovertyPublicMapStage.tsx`

Sửa `PublicMarkerPopupContent` để:

- mở rộng cấu trúc popup
- nhóm trường theo block rõ ràng
- hiển thị tọa độ rút gọn từ `latitude` và `longitude`

Legend trong component này sẽ được chỉnh để:

- khớp thứ tự và màu với 3 marker thực tế
- không còn trường hợp legend nói 3 loại nhưng marker chỉ có 2 kiểu

### Public marker helper

Sửa helper marker public để map đủ 3 loại:

- `POOR` -> marker đỏ
- `NEAR_POOR` -> marker vàng/cam
- `NONE` hoặc dữ liệu không thuộc 2 nhóm trên -> marker xanh dương kiểu `Hộ thường`

Cluster helper giữ nguyên hành vi hiện tại:

- cùng ngưỡng kích thước cluster
- cùng màu cluster
- không chia cluster theo loại hộ

### Styling

Nếu cần, thêm class marker mới theo cùng pattern hiện tại:

- `.poverty-map-marker--normal`

Class này chỉ bổ sung màu hoặc asset cho public marker loại `Hộ thường`, không làm thay đổi marker admin hiện có.

## Data Handling

Popup chỉ dùng dữ liệu đã có sẵn trong `PublicPovertyMarker`:

- `headFullName`
- `code`
- `address`
- `areaName`
- `wardName`
- `memberCount`
- `fieldPhotoCount`
- `latitude`
- `longitude`
- `povertyType`

Không mở rộng API, không thêm request mới.

## Error Handling

- Nếu thiếu tên chủ hộ: ưu tiên `code`, nếu vẫn thiếu thì hiện `Hộ gia đình`
- Nếu thiếu địa chỉ hoặc địa bàn: hiện `Chưa cập nhật`
- Nếu thiếu tọa độ hợp lệ: marker không render như logic hiện tại, nên popup không phát sinh trường hợp mồ côi

## Testing

Thêm hoặc cập nhật test cho helper public marker để khóa các rule:

- `POOR` dùng marker đỏ
- `NEAR_POOR` dùng marker vàng/cam
- `NONE` hoặc dữ liệu thường dùng marker xanh dương
- cluster size threshold giữ nguyên

Kiểm tra TypeScript và eslint cho phần public map sau khi sửa.

Manual smoke check:

- mở một ward public có đủ cả 3 loại hộ
- kiểm tra legend khớp với marker trên bản đồ
- bấm từng loại marker để xác nhận popup hiển thị đầy đủ trường mới
- kiểm tra nút `Xem chi tiết hộ` vẫn điều hướng đúng
- kiểm tra map embedded trong trang chi tiết hộ vẫn hiển thị marker đúng loại hộ

## Non-Goals

- không thêm bộ lọc mới trong popup
- không thay cluster thành nhiều màu theo loại
- không chỉnh lại layout tổng thể của trang public map hoặc trang chi tiết hộ
