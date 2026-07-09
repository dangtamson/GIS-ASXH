# GIS Sign-In Page Redesign Design

## Goal

Thiết kế lại trang đăng nhập của hệ thống theo phong cách hiện đại, mang bản sắc `GIS bản đồ số`, nhưng vẫn giữ cảm giác nghiêm túc, tin cậy và phù hợp với một hệ thống điều hành nghiệp vụ.

## Scope

Thiết kế này bao gồm:

- làm mới giao diện trang đăng nhập tại `FE/src/components/auth/SignInForm.tsx`
- điều chỉnh phần khung auth tại `FE/src/app/(full-width-pages)/(auth)/layout.tsx` nếu cần để đồng bộ bố cục trái-phải
- bổ sung các lớp trình bày cần thiết cho chủ đề GIS như panel bản đồ, grid tọa độ, node dữ liệu, card chỉ số nhỏ và copy giới thiệu ngắn
- tối ưu responsive để vẫn giữ chất GIS trên mobile mà không làm giảm tốc độ thao tác đăng nhập

Thiết kế này không bao gồm:

- thay đổi logic đăng nhập, validate tài khoản hoặc flow session
- thay đổi API auth, shape response, xử lý token hoặc SSO
- thêm chức năng nghiệp vụ mới trên trang đăng nhập
- thay đổi cấu trúc route auth hiện tại

## Current Problem

Trang đăng nhập hiện tại hoạt động đúng chức năng nhưng phần trình bày còn khá cơ bản:

- khối form đơn giản, thiếu điểm nhấn sản phẩm
- panel phải mới chỉ là nền tối và logo, chưa thể hiện ngữ cảnh `GIS bản đồ số`
- chưa có hệ phân cấp thị giác rõ ràng giữa nhận diện nền tảng, form thao tác và nội dung hỗ trợ
- trải nghiệm desktop chưa tận dụng không gian để truyền tải cảm giác một nền tảng điều hành dữ liệu không gian

Kết quả là trang đăng nhập chưa tạo được ấn tượng hiện đại và chưa phản ánh bản sắc của hệ thống.

## Requirements

### Functional Requirements

- Trang đăng nhập phải giữ nguyên đầy đủ các hành vi hiện tại:
  - nhập tài khoản hoặc email
  - nhập mật khẩu
  - hiển thị lỗi validate
  - nút đăng nhập chính
  - tùy chọn `Ghi nhớ đăng nhập`
  - nút `Đăng nhập SSO` khi backend cho phép
- Việc redesign không được thay đổi API call, logic redirect, xử lý password change required hoặc hydrate session.
- Theme tối hiện có vẫn phải tiếp tục hoạt động ở mức chấp nhận được, dù thiết kế mới ưu tiên trải nghiệm sáng ở trang auth.

### UX Requirements

- Trang phải thể hiện rõ chất `điều hành bản đồ số hiện đại` ngay khi mở ra.
- Form đăng nhập phải là vùng tương tác nổi bật nhất ở nửa trái màn hình.
- Panel nửa phải phải gợi hình ảnh bản đồ số bằng các yếu tố đồ họa trừu tượng, không cần nhúng bản đồ thật.
- Ngôn ngữ thị giác phải bám hệ màu sẵn có của project, ưu tiên đỏ gạch, cam ấm, kem sáng và than đậm thay vì chuyển hẳn sang tông xanh-cyber.
- Giao diện phải trông hiện đại hơn hiện tại nhưng không được quá “marketing landing page” hoặc quá khoa trương.
- Trên mobile, người dùng vẫn phải tập trung vào thao tác đăng nhập nhanh; các yếu tố GIS chỉ đóng vai trò nền hỗ trợ nhẹ.

### Non-Functional Requirements

- Không thêm phụ thuộc frontend mới chỉ để dựng hiệu ứng thị giác.
- Phần minh họa GIS nên được xây dựng bằng CSS utility, gradient, shape layout, hoặc SVG/HTML nhẹ nếu cần.
- Không làm trang auth nặng đáng kể hoặc gây jank khi load.
- Cấu trúc JSX sau khi redesign vẫn phải đủ rõ để bảo trì và chỉnh sửa tiếp.

## Recommended Approach

Áp dụng hướng `Atlas Control`: giữ bố cục hai nửa hiện có, nhưng biến nửa trái thành một `command card` đăng nhập sáng, rõ thao tác; đồng thời biến nửa phải thành một `GIS situation panel` mang ngôn ngữ bản đồ số điều hành với grid, tuyến nối, marker và các info card nổi nhẹ.

Đây là phương án phù hợp nhất vì:

- tận dụng được layout auth đang có thay vì thay khung toàn bộ
- tạo khác biệt thị giác rõ ràng mà không đụng đến luồng auth
- bám được nhận diện màu hiện tại của hệ thống
- phù hợp với ngữ cảnh một nền tảng GIS nghiệp vụ hơn là một landing page công nghệ chung chung

## Alternatives Considered

### Alternative 1: Chỉ restyle form, giữ nguyên panel phải

Reject. Phương án này ít rủi ro nhưng không giải quyết gốc vấn đề là trang chưa có bản sắc GIS rõ ràng.

### Alternative 2: Dùng glassmorphism tối toàn trang kiểu cyber map

Reject. Có thể ấn tượng lúc đầu nhưng dễ lệch phong cách hiện có của hệ thống và làm giảm cảm giác nghiêm túc cần thiết.

### Alternative 3: Biến nửa phải thành dashboard mini nhiều thông tin thật

Không khuyến nghị ở vòng này. Cách này đúng chủ đề nhưng tăng độ bận mắt và đòi hỏi nhiều dữ liệu trình bày không cần thiết cho màn hình đăng nhập.

## UI Design

### Overall Structure

Trang tiếp tục dùng bố cục split-screen:

- cột trái khoảng `42-46%` chiều rộng trên desktop
- cột phải khoảng `54-58%` chiều rộng trên desktop

Cột trái là khu vực thao tác chính:

- nền sáng, sạch, có khoảng thở lớn
- card đăng nhập nằm giữa theo trục dọc
- card có bo góc lớn, shadow sâu vừa phải, tạo cảm giác “trạm điều khiển” hơn là form mặc định

Cột phải là khu vực bản sắc:

- nền than đậm pha đỏ nâu
- có lớp grid tọa độ mờ
- có các route line mảnh, node phát sáng nhẹ, vài polygon hoặc vùng highlight
- có 2 đến 3 info chip hoặc stat card nhỏ để tăng cảm giác hệ thống đang hoạt động

### Left Column Experience

Khối form nên có thứ bậc thị giác mới:

- badge hoặc eyebrow nhỏ phía trên tiêu đề, ví dụ `Nền tảng GIS điều hành số`
- tiêu đề chính mạnh và rõ, ví dụ `Đăng nhập vào hệ thống`
- một dòng mô tả ngắn về giám sát và khai thác dữ liệu không gian tập trung
- các field input thoáng hơn, hiện đại hơn, viền và nền rõ ràng hơn hiện tại
- CTA `Đăng nhập` là điểm nhấn thị giác mạnh nhất ở khu vực form

Các thành phần hiện tại phải được giữ nhưng trình bày lại:

- checkbox `Ghi nhớ đăng nhập`
- trạng thái lỗi inline
- nút `Đăng nhập SSO` dạng secondary action, cùng ngôn ngữ hình khối nhưng kém nổi bật hơn CTA chính

### GIS Right Panel Experience

Panel phải không dùng ảnh raster tĩnh làm trung tâm. Thay vào đó, nó nên được dựng như một lớp `map canvas` trừu tượng gồm:

- nền gradient tối ấm
- lớp lưới tọa độ hoặc contour mảnh
- các node tròn nhỏ với vài điểm sáng nhấn màu amber hoặc brand
- route line hoặc connection line chạy ngang/dọc tạo cảm giác mạng lưới không gian
- các mini card nổi hiển thị nhãn ngắn như `Điểm dữ liệu`, `Kết nối vùng`, `Đồng bộ trạng thái`

Logo hiện tại vẫn có thể giữ, nhưng không nên là yếu tố duy nhất trong panel. Logo nên trở thành một phần của cụm nhận diện phía trên hoặc giữa panel, thay vì đứng trơ trên nền tối.

### Motion Direction

Animation cần tiết chế:

- card đăng nhập xuất hiện với fade và translate nhẹ
- một số node trên panel phải có pulse rất nhỏ hoặc glow chậm
- stat chips có thể dùng chuyển động nổi nhẹ khi load

Không dùng hiệu ứng mạnh, liên tục hoặc màu sắc nhấp nháy gây cảm giác sci-fi quá mức.

## Responsive Design

### Desktop

- giữ split-screen đầy đủ
- panel GIS phải là điểm nhấn thương hiệu chính
- form luôn nằm trong vùng đọc thoải mái, không quá kéo dài theo chiều ngang

### Tablet

- vẫn có thể giữ hai cột, nhưng panel phải giản lược số lượng stat chip
- ưu tiên giữ bản đồ trừu tượng và headline rõ ràng

### Mobile

- chuyển về một cột tập trung vào form
- ẩn phần lớn panel GIS riêng biệt
- giữ nền map texture hoặc gradient nhẹ phía sau khu vực trên cùng của trang
- đảm bảo các thành phần form, lỗi và CTA không bị nén quá chặt

## Frontend Architecture

### Primary Files

Các file chính dự kiến thay đổi:

- `FE/src/components/auth/SignInForm.tsx`
- `FE/src/app/(full-width-pages)/(auth)/layout.tsx`

### Component Strategy

Khuyến nghị giữ logic auth trong `SignInForm` như hiện tại và chỉ tách thêm presentation block nếu phần JSX GIS trở nên quá lớn.

Hai hướng hợp lệ:

### Preferred

Refactor `SignInForm` thành hai lớp rõ ràng trong cùng file hoặc cùng vùng component:

- phần logic state và handlers giữ nguyên
- phần render chia thành:
  - login card section
  - GIS visual panel section

### Acceptable

Nếu phần panel phải quá dài, tách một component trình bày nhỏ như `AuthMapPanel` để giữ `SignInForm` dễ đọc hơn.

Không nên tách quá nhiều component nhỏ chỉ để phục vụ vài div trang trí.

## Visual System Details

### Color Direction

- nền sáng: trắng, kem nhạt, hồng đất rất nhẹ
- CTA chính: brand đỏ-cam hiện có
- panel tối: brand-950, gray-950, nhấn amber hoặc orange-400/500
- text chính: gray-800 đến gray-900

### Shape Direction

- card lớn bo tròn mềm nhưng không tròn quá mức
- input và button đồng bộ radius
- stat chip và badge nên bo vừa, giống control panel hiện đại

### Typography Direction

- tiếp tục dùng `Be Vietnam Pro`
- tăng độ tương phản rõ giữa eyebrow, title, subcopy và label
- tránh viết quá nhiều copy marketing; nội dung ngắn, dứt khoát, sản phẩm hóa

## Testing Strategy

### Verification Scenarios

- Trang `/signin` hiển thị giao diện mới mà không làm thay đổi luồng đăng nhập thành công.
- Validation lỗi email/tài khoản và mật khẩu vẫn hiển thị đúng.
- Nút SSO vẫn chỉ xuất hiện khi `ssoEnabled` là `true`.
- Trên desktop, split layout hiển thị ổn và panel GIS không chèn lên form.
- Trên mobile, form vẫn dễ thao tác và nội dung không tràn.
- Theme tối không bị vỡ layout hoặc mất tương phản nghiêm trọng.

### Verification Commands

- `cd FE && npx tsc --noEmit`
- kiểm tra lint hoặc file-level validation nếu cần cho các file đã chạm

## Risks and Mitigations

- Risk: panel GIS trở nên quá trang trí và làm giảm khả năng tập trung vào form.
  Mitigation: giữ form là vùng sáng có độ tương phản cao nhất và tiết chế số lượng chi tiết ở panel phải.

- Risk: dùng quá nhiều lớp gradient và shape làm JSX khó bảo trì.
  Mitigation: gom các lớp thị giác thành các khối trình bày có tên rõ ràng, tránh rải utility ngẫu nhiên.

- Risk: thiết kế desktop đẹp nhưng mobile bị mất bản sắc.
  Mitigation: giữ một lớp texture hoặc hero strip GIS tối giản trên mobile thay vì bỏ sạch hoàn toàn.

- Risk: dark mode hiện có không còn đẹp như bản sáng sau redesign.
  Mitigation: ưu tiên không để dark mode vỡ layout hoặc mất tương phản; không cố tối ưu dark mode vượt quá phạm vi redesign lần này.