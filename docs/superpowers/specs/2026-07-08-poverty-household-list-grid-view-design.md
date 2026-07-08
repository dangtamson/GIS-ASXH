# Poverty Household List Grid View Design

## Goal

Bổ sung chế độ xem `Lưới` cho trang quản lý hộ nghèo/cận nghèo tại `ho-ngheo`, cho phép người dùng chuyển qua lại giữa `Bảng` và `Lưới` mà không thay đổi API, bộ lọc, phân trang, quyền hạn hay luồng thao tác hiện có.

## Scope

Thiết kế này bao gồm:

- bổ sung nút chuyển chế độ xem `Bảng / Lưới`
- render danh sách hộ theo dạng card grid bên cạnh chế độ table hiện tại
- tái sử dụng cùng dataset, filter, pagination và permission logic
- gom các thao tác phụ của card vào một nút bấm mở menu

Thiết kế này không bao gồm:

- thay đổi backend API
- thay đổi route hoặc query param
- thay đổi bộ lọc tìm kiếm
- thay đổi luồng tạo, sửa, xem chi tiết, thu thập, bản đồ hoặc export/import
- lưu chế độ xem vào localStorage, URL hoặc server

## Current Problem

Trang `ho-ngheo` hiện chỉ có một cách xem là bảng. Bảng phù hợp khi cần rà soát nhiều cột dữ liệu, nhưng không tối ưu cho nhu cầu quét nhanh từng hộ theo dạng card, đặc biệt trên màn hình vừa và nhỏ hoặc khi người dùng chỉ cần nhìn các thông tin chính và thao tác nhanh.

## Requirements

### Functional Requirements

- Trang phải có hai chế độ xem:
  - `Bảng`
  - `Lưới`
- Chế độ xem mặc định vẫn là `Bảng`.
- Khi chuyển chế độ xem:
  - không gọi lại API chỉ vì đổi view
  - không làm mất filter hiện tại
  - không làm mất page và page size hiện tại
- Chế độ `Lưới` phải dùng cùng `items` hiện có từ endpoint phân trang hiện tại.
- Mỗi card ở chế độ `Lưới` phải hiển thị:
  - mã hộ
  - chủ hộ
  - loại hộ
  - trạng thái
  - địa bàn
  - nút `Xem` theo cùng hành vi đang áp dụng ở chế độ bảng
  - nút `Sửa` nếu có quyền
  - một nút thao tác phụ để mở menu
- Menu thao tác phụ phải tái sử dụng logic thao tác phụ hiện có:
  - `Thu thập hiện trường`
  - `Xem timeline đánh giá`
  - `Xem timeline hỗ trợ`
  - `Xem trên bản đồ`
  - `Ngưng hoạt động`
- Chế độ `Bảng` phải tiếp tục hoạt động như hiện tại.

### UX Requirements

- Nút chuyển chế độ xem phải nằm gần khối danh sách dữ liệu để người dùng hiểu rằng nó chỉ đổi cách hiển thị.
- Card grid phải gọn, dễ quét, không nhồi quá nhiều trường phụ.
- Loại hộ và trạng thái phải tiếp tục dùng `Tag` màu như chế độ bảng để giữ tính nhất quán.
- Card phải có trạng thái empty rõ ràng khi không có dữ liệu.
- Card grid phải responsive:
  - mobile: 1 cột
  - tablet: 2 cột
  - desktop lớn: 3 cột

### Non-Functional Requirements

- Không thêm request mới cho việc đổi chế độ xem.
- Không tách khác biệt dữ liệu giữa table và grid.
- Phần thay đổi phải hạn chế rủi ro regression cho các thao tác hiện có.

## Recommended Approach

Mở rộng `FE/src/components/poverty/PovertyHouseholdListPage.tsx` với một local state `viewMode` và thêm một nhánh render thứ hai cho grid cards.

Đây là phương án phù hợp nhất vì thay đổi được yêu cầu chỉ là thay đổi cách trình bày trên cùng một tập dữ liệu đã có. Reuse toàn bộ handlers và permission checks hiện tại giúp giảm rủi ro và tránh phát sinh khác biệt hành vi giữa table và grid.

## Alternatives Considered

### Alternative 1: Tạo component grid view riêng ngay từ đầu

Chấp nhận một phần nhưng không bắt buộc ở bước đầu. Nếu phần render card làm file chính khó đọc, có thể tách một component nhỏ như `PovertyHouseholdGridView`. Tuy nhiên, việc ép tách thành nhiều file ngay từ đầu không đem lại nhiều giá trị cho phạm vi thay đổi hiện tại.

### Alternative 2: Đồng bộ chế độ xem qua URL hoặc localStorage

Reject cho phạm vi này. Yêu cầu chỉ cần chuyển qua lại trên trang hiện tại. Persist view mode làm tăng phạm vi kiểm thử và đưa thêm quyết định UX chưa cần thiết.

### Alternative 3: Thay table bằng card hoàn toàn trên màn hình nhỏ

Reject. Yêu cầu của người dùng là bổ sung thêm chế độ xem, không thay thế một chế độ bằng logic responsive tự động.

## Interaction Design

### View Toggle

Thêm control chuyển chế độ xem với hai lựa chọn:

- `Bảng`
- `Lưới`

Control này nằm ở header của khối danh sách dữ liệu, phía trên phần render `Table` hoặc `Grid`.

### Table Mode

Giữ nguyên:

- cấu trúc table hiện tại
- cột dữ liệu hiện tại
- hành vi pagination
- hành vi action buttons

### Grid Mode

Render danh sách theo card.

Mỗi card hiển thị:

- dòng tiêu đề: `Mã hộ`
- dòng phụ nổi bật: `Chủ hộ`
- tag `Loại hộ`
- tag `Trạng thái`
- dòng `Địa bàn`
- cụm nút thao tác

Nút thao tác trên card:

- `Xem` phải bám cùng logic hiển thị và điều hướng đang có ở chế độ bảng để tránh lệch hành vi
- `Sửa` hiện nếu có quyền cập nhật
- nút `Thêm thao tác` mở `Dropdown`

Các thao tác phụ không hiển thị trực tiếp trên card mà chỉ xuất hiện sau khi người dùng bấm nút menu.

## Data And State Design

### New Local State

Thêm:

- `viewMode: "table" | "grid"`

State này:

- chỉ sống trong lifecycle của page
- không lưu vào URL
- không lưu vào localStorage
- reset về `table` khi reload trang

### Shared Derived Data

Table và grid phải dùng cùng:

- `items`
- `loading`
- `page`
- `limit`
- `total`
- `buildExtraActionMenuItems`

Điều này đảm bảo khi backend trả về cùng một page dữ liệu, hai chế độ chỉ khác nhau ở presentation.

### Shared Helpers

Khuyến nghị chuẩn hóa helper text cho grid và table nếu cần:

- helper build địa bàn từ `provinceName / wardName / areaName`
- helper điều hướng `Xem`
- helper mở menu thao tác phụ

Không cần tạo data adapter mới giữa `PoorHousehold` và card view.

## Frontend Architecture

### Main File

Thay đổi chính nằm trong:

- `FE/src/components/poverty/PovertyHouseholdListPage.tsx`

### Recommended Refactoring Boundary

Nếu render grid làm file dài thêm đáng kể, nên tách phần card list thành một component presentational nhỏ. Component này chỉ nhận:

- `items`
- `loading`
- các permission flags cần thiết
- callbacks `onView`, `onEdit`, `onOpenMenu`

Không chuyển logic fetch, form, filter, pagination hay modal ra khỏi page trong thay đổi này.

## Error Handling And Edge Cases

- Nếu `items` rỗng:
  - table mode hiển thị empty state như Ant Table hiện có
  - grid mode hiển thị `Empty` rõ ràng trong khối card
- Nếu một card không có `code`, hiển thị `-`
- Nếu một card không có `headFullName`, hiển thị fallback như hiện tại
- Nếu địa bàn thiếu dữ liệu chuẩn hóa, hiển thị các phần có sẵn hoặc `-`
- Nếu người dùng không có quyền `update`, không hiện nút `Sửa`
- Nếu menu phụ không có action nào khả dụng, không hiện nút menu phụ

## Testing Strategy

### Manual Verification

- Trang mặc định mở ở `Bảng`
- Bấm `Lưới` thì danh sách đổi sang card mà không reload dữ liệu
- Bấm lại `Bảng` thì quay về table với cùng filter và page hiện tại
- Pagination hoạt động giống nhau ở cả hai chế độ
- `Xem`, `Sửa` và menu phụ trên card gọi đúng luồng như bản table
- Các permission combinations khác nhau cho ra đúng bộ nút
- Empty state và loading state hiển thị đúng trong grid mode

### Automated Tests

Nếu repo đã có test phù hợp cho UI page này, ưu tiên thêm test cho:

- render toggle control
- render grid card fields chính
- ẩn/hiện action buttons theo permission
- không render menu phụ khi không có action khả dụng

Nếu hiện chưa có pattern test ổn định cho page component này, manual verification là mức tối thiểu bắt buộc cho thay đổi đầu tiên.

## Implementation Notes

- Giữ `Table` nguyên trạng để giảm regression risk.
- Dùng lại `buildExtraActionMenuItems` cho cả table và grid để tránh lệch permission logic.
- Card nên dùng cùng palette và `Tag` helpers đang có trong `poverty-utils`.
- Không thêm trường mới lên card ngoài phạm vi đã chốt, để giữ đúng yêu cầu `thẻ gọn`.
