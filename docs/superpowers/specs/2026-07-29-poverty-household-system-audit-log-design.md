# Theo dõi thay đổi hộ nghèo trong nhật ký hệ thống

## Mục tiêu

Đưa các thay đổi nghiệp vụ của hộ nghèo vào nhật ký hệ thống tại `quan-tri/log-he-thong`, để quản trị viên theo dõi tập trung cùng các hoạt động khác. Bảng nhật ký hiện tại giữ nguyên giao diện và các cột đang hiển thị.

## Phạm vi

Ghi nhận các thao tác thành công sau:

- Thêm, sửa và xóa/ngưng hoạt động hộ nghèo.
- Thêm, sửa và xóa thành viên hộ.
- Cập nhật đánh giá hộ.
- Cập nhật hoàn cảnh hộ.
- Thêm, sửa và xóa hỗ trợ hộ.

Không mở rộng phạm vi cho import Excel, export, các thao tác đọc dữ liệu, hay các module nghèo khác.

## Thiết kế

### Backend audit log

Audit log được tạo ở các admin handler sau khi repository hoàn tất thao tác và trả về bản ghi thành công. Handler truyền `req` vào `createAuditLog` để cơ chế audit hiện tại tự thu thập actor, workspace, IP và user-agent.

Mỗi nhóm nghiệp vụ dùng action và entity type riêng, theo quy ước hiện có:

| Nghiệp vụ | Action | Entity type |
| --- | --- | --- |
| Hộ nghèo | `poverty_household_created`, `poverty_household_updated`, `poverty_household_deleted` | `poverty_household` |
| Thành viên | `poverty_member_created`, `poverty_member_updated`, `poverty_member_deleted` | `poverty_member` |
| Đánh giá | `poverty_assessment_created`, `poverty_assessment_updated` | `poverty_assessment` |
| Hoàn cảnh | `poverty_context_history_updated` | `poverty_context_history` |
| Hỗ trợ | `poverty_support_created`, `poverty_support_updated`, `poverty_support_deleted` | `poverty_support` |

`entityId` là ID của bản ghi trực tiếp bị thay đổi. `details` chứa tối thiểu `householdId`, `objectType`, `objectId`, `changeNote`; với thao tác sửa/xóa, thêm `oldData`, và với thao tác thêm/sửa, thêm `newData` từ kết quả nghiệp vụ hoặc dữ liệu lịch sử tương ứng.

Thao tác “xóa hộ nghèo” tiếp tục dùng cơ chế hiện tại chuyển hộ sang trạng thái `INACTIVE`; audit action vẫn là `poverty_household_deleted` để phản ánh ý nghĩa nghiệp vụ trong nhật ký.

### Tương thích với lịch sử chi tiết hộ

`household_change_logs` tiếp tục được ghi như hiện tại và là nguồn lịch sử chi tiết trong trang hộ nghèo. Audit log hệ thống là bản ghi tổng hợp thứ hai, không thay thế hoặc loại bỏ lịch sử này.

Audit log chỉ được tạo sau khi thao tác thành công. Nếu tạo audit log thất bại, lỗi được xử lý theo chính sách hiện tại của `createAuditLog` và không làm rollback hay làm thất bại thao tác nghiệp vụ chính.

### Frontend

Không thay đổi layout, cột, bộ lọc, phân trang hoặc API đọc của `quan-tri/log-he-thong`. Các bản ghi mới tự động xuất hiện trong bảng hiện tại thông qua endpoint `/admin/audit-logs`. Việc hiển thị action/entity vẫn theo dạng giá trị hiện có; không bổ sung modal hoặc cột chi tiết trong phạm vi này.

## Luồng dữ liệu

1. Admin handler xác thực payload và quyền địa bàn.
2. Handler gọi repository CRUD.
3. Repository cập nhật bảng nghiệp vụ và ghi `household_change_logs` như hiện tại.
4. Nếu trả về thành công, handler gọi `createAuditLog` với action/entity/IDs/details và request context.
5. Trang nhật ký hệ thống truy vấn endpoint hiện có và hiển thị bản ghi theo bảng hiện tại.

## Kiểm thử

- Kiểm tra các action/entity constant mới có giá trị nhất quán.
- Kiểm tra từng handler tạo đúng audit log sau thao tác thành công.
- Kiểm tra thao tác trả về not found hoặc validation error không tạo audit log.
- Kiểm tra `details` truyền đúng household ID, object ID, change note và dữ liệu cũ/mới theo loại thao tác.
- Chạy test/typecheck/lint phù hợp cho backend và frontend; không yêu cầu thay đổi snapshot API vì endpoint đọc không đổi.

## Ngoài phạm vi

- Thay đổi giao diện bảng nhật ký hệ thống.
- Hiển thị trực tiếp dữ liệu cũ/mới trên bảng.
- Bộ lọc riêng cho nhóm hộ nghèo.
- Import Excel và các thao tác hàng loạt.
