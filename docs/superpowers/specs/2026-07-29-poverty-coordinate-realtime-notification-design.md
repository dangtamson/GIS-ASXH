# Thông báo realtime cập nhật tọa độ hộ nghèo

## Mục tiêu

Khi người dùng cập nhật tọa độ hộ nghèo từ `ho-ngheo/thu-thap`, tất cả người đang mở `ho-ngheo/ban-do` trong cùng workspace nhận được thông báo realtime. Bản đồ không tự tải lại và marker không tự di chuyển.

## Phạm vi

- Theo dõi thay đổi latitude/longitude phát sinh từ luồng thu thập.
- Gửi thông báo tới các phiên bản trang bản đồ đang subscribe cùng workspace.
- Nội dung thông báo gồm tên người thao tác, tên chủ hộ và thời gian cập nhật.
- Không thông báo cho cập nhật tọa độ từ chức năng chỉnh sửa trực tiếp trên bản đồ.
- Không thay đổi dữ liệu nghiệp vụ, cách tải marker hoặc layout bản đồ.

## Thiết kế

### Backend phát sự kiện

Sau khi handler cập nhật hộ lưu thành công, backend so sánh latitude/longitude trước và sau. Chỉ khi có thay đổi và request có `changeSource: "COLLECTION"`, backend phát một Supabase Realtime Broadcast vào channel:

`poverty-household-coordinate-updates:{workspaceId}`

Payload:

```ts
type PovertyCoordinateUpdateEvent = {
  householdId: string;
  householdHeadName: string;
  actorName: string;
  updatedAt: string;
};
```

`actorName` được lấy từ `accounts.full_name` theo `req.accountId`; `householdHeadName` và `updatedAt` lấy từ bản ghi hộ sau cập nhật. Không gửi latitude/longitude trong event vì yêu cầu chỉ là thông báo.

Broadcast dùng Supabase server client có quyền phát sự kiện. Lỗi khởi tạo hoặc gửi Broadcast được bắt và ghi log, không làm thất bại response cập nhật tọa độ.

### Nhận sự kiện trên frontend

Frontend dùng `@supabase/supabase-js` với các biến môi trường public:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Hook/client realtime riêng tạo channel theo workspace đang lưu trong session. `PovertyMapPage` đăng ký khi mount hoặc workspace thay đổi và gỡ subscription khi unmount.

Khi nhận event, trang gọi Ant Design notification với nội dung:

`{actorName} đã thu thập cập nhật hộ: {householdHeadName} lúc {time}`

Thời gian định dạng theo locale `vi-VN`. Event không làm thay đổi state marker và không gọi lại API bản đồ.

### Phân biệt nguồn cập nhật

Payload cập nhật từ `ho-ngheo/thu-thap` thêm `changeSource: "COLLECTION"`. Schema backend cho phép giá trị này cùng các payload cũ không có trường; luồng cập nhật trực tiếp từ bản đồ tiếp tục gửi `changeSource: "MAP"` hoặc không gửi trường và không phát thông báo thu thập.

Việc phát chỉ xảy ra ở handler sau khi đã kiểm tra quyền địa bàn và cập nhật thành công, nên không tạo event cho validation error, not found, forbidden hoặc cập nhật không đổi tọa độ.

## Luồng dữ liệu

1. Người dùng lưu bước tọa độ tại `ho-ngheo/thu-thap`.
2. Frontend gọi PATCH hộ với `changeSource: "COLLECTION"`.
3. Backend xác thực payload, quyền workspace/địa bàn và đọc bản ghi cũ.
4. Backend cập nhật hộ; nếu tọa độ thay đổi, truy vấn tên người thao tác và phát Broadcast theo workspace.
5. Các trang `ho-ngheo/ban-do` cùng workspace nhận event và hiển thị toast.
6. Kết quả cập nhật và dữ liệu bản đồ hiện tại không bị thay đổi bởi event.

## Kiểm thử

- Backend: kiểm tra schema chấp nhận `changeSource`, từ chối giá trị khác.
- Backend: kiểm tra không phát event khi tọa độ không đổi, không phải nguồn `COLLECTION`, hoặc thao tác cập nhật thất bại.
- Backend: kiểm tra payload có đúng `householdId`, tên chủ hộ, tên người dùng và `updatedAt`.
- Frontend: kiểm tra hook tạo đúng channel theo workspace, hiển thị đúng thông báo và dọn subscription.
- Frontend: kiểm tra event không gọi reload marker hoặc thay đổi danh sách marker.
- Chạy lint, typecheck và test phù hợp cho BE/FE.

## Ngoài phạm vi

- Hiển thị latitude/longitude trong toast.
- Tự động cập nhật hoặc di chuyển marker.
- Thông báo cho cập nhật từ `ho-ngheo/ban-do`.
- Lưu thêm bảng notification nghiệp vụ hoặc thay đổi hệ thống notification hiện tại.
