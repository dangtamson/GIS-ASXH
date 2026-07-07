# Poverty Public Area Detail Design

## Goal

Biến tab `Khu vực/Ấp` trên trang public ward map thành điểm vào một trang chi tiết riêng cho từng ấp/khu vực, có URL public đẹp, có modal `Thông tin hành chính - Địa lý`, có danh sách hộ trực quan và có bản đồ nhỏ chỉ hiển thị các hộ thuộc đúng ấp đó.

## Scope

Thay đổi bao gồm:

- điều hướng từ tab `Khu vực/Ấp` sang route public mới
- endpoint public mới cho chi tiết ấp/khu vực
- route/page/component FE mới cho area detail
- modal `Thông tin hành chính - Địa lý`
- danh sách hộ và block bản đồ nhỏ ở cuối trang area detail

Không thay đổi:

- route public ward map hiện có
- route public household detail hiện có
- quyền public không cần đăng nhập
- cơ chế cluster/marker public map đã hoàn thiện

## Current Problem

Hiện tab `Khu vực/Ấp` trên trang public map chỉ đổi state nội bộ rồi quay ngược lại tab danh sách hộ. Cách này không tạo được một trang chi tiết public riêng cho từng ấp, không có URL chia sẻ được, không thể hiển thị bộ thông tin hành chính - địa lý của ấp và cũng không tạo được trải nghiệm khám phá dữ liệu theo đúng cấp khu vực.

## URL And Navigation

### Public area route

Trang chi tiết ấp/khu vực dùng route:

- `/ban-do-ho-ngheo-cong-khai/[slug]/khu-vuc/[areaSlug]`

Trong đó:

- `slug` là public ward slug đã có
- `areaSlug` là slug public đẹp cho ấp/khu vực

### Navigation flow

- Từ tab `Khu vực/Ấp` trên public ward page, click vào card area sẽ điều hướng sang route mới thay vì `setActiveExplorerTab("list")`
- Trên trang area detail sẽ có nút `Quay lại bản đồ` để quay về public ward page
- Từ danh sách hộ trong area detail, click vào từng hộ sẽ điều hướng sang route public household detail hiện tại

## Data Design

## Public area response

Backend cần một endpoint public riêng để load trực tiếp area detail khi người dùng mở URL:

- `GET /public/poverty/wards/:slug/areas/:areaSlug`

Response nên gồm 4 nhóm dữ liệu:

1. `share`
- `publicSlug`
- `wardCode`
- `provinceCode`
- `wardName`
- `provinceName`
- `currentYear`

2. `area`
- `id`
- `name`
- `code`
- `naturalArea`
- `description`
- `note`
- `secretaryName`
- `secretaryPhone`
- `hamletHeadName`
- `hamletHeadPhone`
- `securityTeamLeaderName`
- `securityTeamLeaderPhone`

3. `summary`
- `total`
- `poor`
- `nearPoor`
- `normal`

4. `households`
- danh sách `PublicPovertyMarker` thuộc đúng area đó để render grid danh sách hộ và bản đồ nhỏ

## Area slug strategy

`areaSlug` phải đẹp với người xem nhưng vẫn resolve ổn định ở server.

Thiết kế khuyến nghị:

- slug được tạo từ `areaName`
- có hậu tố ổn định dựa trên `areaId` rút gọn để tránh trùng tên
- backend không dùng slug text để truy vấn trực tiếp; backend parse slug rồi resolve về đúng `areaId` trong đúng ward công khai

Ví dụ hướng thiết kế:

- `phu-tri-b1--0d7ce58c`

Điều này giữ URL dễ đọc nhưng vẫn an toàn khi có nhiều ấp trùng tên hoặc đổi tên nhẹ theo thời gian.

## UI Design

## Hero section

Trang area detail sẽ bám tinh thần hiện đại của public ward page và public household detail page:

- breadcrumb: `Tỉnh/Thành phố > Xã/Phường > Khu vực/Ấp`
- nút `Quay lại bản đồ`
- tên area nổi bật
- nút `Thông tin hành chính`
- nền hero xanh, sáng, có chiều sâu tương tự mockup đã duyệt

## Summary cards

Phía dưới hero là 4 thẻ thống kê:

- `Hộ gia đình`
- `Hộ thường`
- `Hộ cận nghèo`
- `Hộ nghèo`

Các thẻ dùng cùng ngôn ngữ màu với hệ public hiện tại:

- xanh cho tổng
- xanh lá cho hộ thường
- vàng/amber cho cận nghèo
- đỏ/rose cho nghèo

## Note block

Khối ghi chú của area sẽ ưu tiên:

1. `description`
2. fallback sang `note`
3. nếu cả hai thiếu: `Chưa có mô tả công khai cho khu vực này.`

Khối này hiển thị như card information dịu màu, dễ đọc và đồng nhất với mockup.

## Household list block

Đây là nội dung chính của trang:

- tiêu đề `Danh sách hộ gia đình`
- search box
- bộ lọc `Tất cả / Hộ nghèo / Hộ cận nghèo / Hộ thường`
- card household giống phong cách public list hiện tại nhưng tinh chỉnh theo mockup area detail

Mỗi household card hiển thị:

- tên chủ hộ
- mã hộ
- địa chỉ ngắn hoặc địa bàn
- tag phân loại hộ
- số thành viên
- CTA ngầm `Xem chi tiết`

Click card household sẽ đi sang trang household detail public hiện có.

## Administrative modal

Nút `Thông tin hành chính` trong hero sẽ mở modal `Thông tin hành chính - Địa lý`.

Modal này hiển thị đầy đủ:

- `Bí thư`
- `Số điện thoại bí thư`
- `Trưởng ấp`
- `Số điện thoại trưởng ấp`
- `Tổ trưởng TANTTCS`
- `Số điện thoại Tổ trưởng TANTTCS`
- `Diện tích tự nhiên`
- `Mô tả`
- `Ghi chú`

Thiết kế modal:

- header xanh nổi bật
- body trắng
- bố cục dòng `nhãn / giá trị` rõ ràng như mockup
- footer chỉ cần nút `Đóng`

Nếu trường nào trống thì hiện `Chưa cập nhật`, không ẩn dòng.

## Map block

Cuối trang có block bản đồ nhỏ:

- chỉ hiển thị marker/cluster của hộ thuộc đúng area
- tái dùng `PovertyPublicMapStage`
- chiều cao vừa phải
- vai trò hỗ trợ định vị, không lấn át danh sách hộ

## Frontend Architecture

Khuyến nghị tách rõ:

- route file mới cho area detail
- component mới `PovertyPublicAreaDetailPage.tsx`
- utility public map mở rộng để build URL area detail và lọc household theo area
- component modal riêng `PovertyPublicAreaAdministrativeModal.tsx`

Tab `Khu vực/Ấp` ở `PovertyPublicMapPage.tsx` chỉ còn trách nhiệm:

- render danh sách area
- build URL area detail
- `router.push(...)` khi click area card

## Backend Architecture

Backend public poverty handlers/repository cần thêm:

- logic resolve `slug -> ward public link`
- logic resolve `areaSlug -> areaId` trong đúng ward
- query area metadata
- query households public của đúng area
- query summary theo area

Response phải chỉ chứa dữ liệu thuộc area đã resolve và cùng ward với public slug, tránh lộ area từ ward khác.

## Error Handling

### Invalid public ward slug

Nếu `slug` không hợp lệ hoặc ward chưa public:

- endpoint trả `404`
- FE hiển thị trạng thái lỗi public rõ ràng

### Invalid area slug

Nếu `areaSlug` không resolve được hoặc area không thuộc ward của `slug`:

- endpoint trả `404`
- FE hiển thị trạng thái `Không tìm thấy khu vực/ấp công khai`

### Empty area

Nếu area tồn tại nhưng chưa có household public:

- vẫn hiển thị hero, summary, note, modal hành chính
- danh sách hộ hiển thị `Empty`
- block bản đồ hiển thị trạng thái trống

### Missing metadata

Nếu thiếu `description`, `note`, hoặc các trường hành chính:

- dùng fallback text ngắn gọn
- không làm sập layout

## Testing

## Backend tests

- resolve `areaSlug` đúng `areaId`
- endpoint chỉ trả household thuộc đúng area
- `404` khi `areaSlug` không tồn tại
- `404` khi `areaSlug` tồn tại nhưng không thuộc ward của `slug`
- summary area tính đúng `total`, `poor`, `nearPoor`, `normal`

## Frontend tests

- utility build public area detail URL đúng định dạng
- utility parse/build `areaSlug` nếu được đặt ở FE
- type checks cho response mới và component mới
- lint cho page/component mới

## Manual smoke checks

- từ tab `Khu vực/Ấp` bấm một area và đi sang đúng route mới
- nút `Quay lại bản đồ` quay về public ward page
- nút `Thông tin hành chính` mở đúng modal
- bấm từng household card đi sang household detail page
- bản đồ nhỏ cuối trang chỉ hiện household thuộc area hiện tại

## Non-Goals

- không biến area detail thành trang dashboard phức tạp nhiều tab
- không yêu cầu đăng nhập
- không thay đổi logic public household detail
- không thêm bộ lọc theo năm
