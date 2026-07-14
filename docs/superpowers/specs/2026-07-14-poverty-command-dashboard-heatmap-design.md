# Poverty Command Dashboard Heatmap Design

## Goal

Refactor trang `ho-ngheo/dashboard-dieu-hanh` để thay lớp điểm hộ nghèo/cận nghèo hiện tại bằng heatmap theo mật độ, đồng thời chỉnh lại các hiệu ứng nền dưới lớp 3D để giao diện gần hơn với ngôn ngữ thị giác của `sc-datav/src/pages/Demo1`.

## Scope

Thiết kế này bao gồm:

- thay lớp marker 3D dạng beam/glow/sphere bằng một lớp heatmap chính trên bản đồ điều hành
- giữ khả năng phân biệt hộ nghèo và cận nghèo thông qua legend, tooltip, và dữ liệu tổng hợp vùng
- tinh chỉnh lớp nền 3D phía dưới map như grid, ring, cloud, ánh sáng, và thứ tự render
- giữ nguyên cơ chế chọn tỉnh/xã, focus vùng, và các panel thống kê hiện có
- bổ sung kiểm thử cho phần chuyển đổi dữ liệu marker sang heatmap input và hành vi lọc theo vùng

Thiết kế này không bao gồm:

- thay đổi API backend
- thay đổi route hoặc layout tổng thể của trang dashboard điều hành
- thêm lớp heatmap riêng biệt cho từng loại hộ bằng hai màu chồng lên nhau
- thay đổi dashboard `ho-ngheo/dashboard` hoặc các trang leaflet 2D khác

## Current Problem

Trang điều hành hiện đang dùng `HouseholdPoint` để dựng từng hộ bằng cột sáng, quầng sáng, point light, và nhãn nổi. Cách thể hiện này có ba vấn đề:

- mật độ điểm dày làm lớp dữ liệu bị rối, nhất là khi số hộ lớn
- hiệu ứng marker và hiệu ứng nền dưới map đang tranh độ chú ý với nhau
- ngôn ngữ thị giác chưa đồng nhất với tham chiếu `Demo1`, nơi dữ liệu mật độ được đẩy lên thành lớp heatmap bám sát mặt bản đồ

## Requirements

### Functional Requirements

- Bản đồ điều hành không còn render từng `HouseholdPoint` riêng lẻ.
- Dữ liệu hộ có tọa độ phải được gom thành một lớp heatmap chính theo mật độ tổng.
- Heatmap phải bám theo cùng projection và cùng transform với map 3D hiện tại.
- Khi lọc theo tỉnh/xã hoặc focus vào một vùng, heatmap phải chỉ còn dữ liệu của vùng được chọn.
- Legend trên header vẫn phải thể hiện:
  - `Hộ nghèo`
  - `Cận nghèo`
- Tooltip hoặc thông tin vùng đang focus vẫn phải cho phép người dùng hiểu vùng đó có bao nhiêu hộ nghèo và cận nghèo.
- Các panel thống kê hai bên không thay đổi nghiệp vụ.

### UX Requirements

- Mặt bản đồ và heatmap phải là lớp trực quan chính.
- Lớp nền dưới map phải nhẹ hơn hiện tại và gần cảm giác của `Demo1` hơn:
  - ring/grid mềm hơn
  - cloud bớt nổi
  - ánh sáng tổng thể sáng và sạch hơn
- Khi zoom hoặc focus vùng, heatmap không được trông như một lớp overlay rời khỏi mặt bản đồ.
- Giao diện phải giữ cảm giác dashboard điều hành 3D, không bị phẳng như một overlay 2D thông thường.

### Non-Functional Requirements

- Không thêm request mới.
- Không làm vỡ logic focus hiện có trong `PovertyCommandMap.tsx`.
- Thay đổi phải đủ cô lập để có thể kiểm chứng bằng unit test cho phần transform dữ liệu và kiểm tra type/lint ở FE.

## Recommended Approach

Thay lớp marker 3D hiện tại bằng một `HeatmapLayer` dựng trong `react-three-fiber`, bám theo cùng projection với map và render trên một plane đặt ngay phía trên mặt extrude. Heatmap texture được sinh từ tập marker đã project sang tọa độ bản đồ, theo cách gần với `Demo1/map/heatmap.tsx`, nhưng dữ liệu đầu vào lấy trực tiếp từ marker thật của dashboard điều hành.

Đây là phương án tốt nhất vì:

- giữ được cảm giác heatmap nằm trong scene 3D thay vì phủ DOM lên trên
- tận dụng hạ tầng projection, focus, scale, và render hiện có của `PovertyCommandMap`
- giảm nhiễu thị giác mạnh hơn so với việc chỉ phóng to sprite hoặc làm marker mờ đi
- bám đúng yêu cầu tham khảo lại `Demo1`

## Alternatives Considered

### Alternative 1: Dùng heatmap 2D overlay ngoài canvas

Reject. Khi camera zoom/rotate hoặc focus vùng, lớp overlay sẽ khó khớp hoàn toàn với scene 3D và dễ lộ cảm giác “trôi” khỏi bản đồ.

### Alternative 2: Giữ marker nhưng thay bằng sprite glow lớn hơn

Reject. Cách này vẫn là marker-based rendering, chưa chuyển được ngôn ngữ dữ liệu sang mật độ như yêu cầu.

### Alternative 3: Dùng hai lớp heatmap tách màu cho nghèo và cận nghèo

Không chọn cho vòng này. Hai lớp chồng nhau làm scene nặng và khó đọc hơn trong bối cảnh dashboard đã có legend và panel tổng hợp để phân biệt loại hộ.

## Frontend Design

### Data Flow

Trang `PovertyCommandDashboardPage.tsx` giữ nguyên cách fetch `markers` và truyền dữ liệu vào `PovertyCommandMap`.

Trong `PovertyCommandMap.tsx`:

- tiếp tục dùng `filterCommandMapMarkersBySelection` để lấy đúng marker theo vùng chọn
- project marker sang tọa độ map như hiện tại
- thay vì trả danh sách marker point để render `HouseholdPoint`, chuyển sang build input cho `HeatmapLayer`

Khuyến nghị tách phần build input sang utility thuần để:

- dễ test
- không trộn logic transform dữ liệu với logic render scene

### Heatmap Layer

Tạo `HeatmapLayer` mới trong khu vực `command-dashboard` với các đặc điểm sau:

- nhận danh sách điểm đã project
- nhận kích thước plane dựa trên bbox của map hoặc bbox vùng đang focus
- sinh texture heatmap và greymap từ canvas
- render một plane dùng `shaderMaterial`
- plane được đặt trên mặt map, cao hơn mặt texture/extrude một khoảng nhỏ để tránh z-fighting

Quy tắc dữ liệu:

- mỗi hộ là một điểm heatmap
- hộ nghèo và cận nghèo cùng góp vào cường độ lớp chính
- có thể áp trọng số nhẹ nếu cần nhấn hộ nghèo hơn cận nghèo, nhưng vòng đầu nên để cùng trọng số để giữ cách đọc “mật độ hộ mục tiêu”

### Tooltip And Information Retention

Phân biệt hộ nghèo/cận nghèo sẽ không còn nằm ở marker đơn lẻ. Thay vào đó:

- legend ở header giữ nguyên hai màu loại hộ
- `DataBar` và nhãn vùng tiếp tục hiển thị tổng theo vùng
- nếu đang focus vùng, tooltip vùng vẫn hiển thị:
  - tên vùng
  - tổng số hộ
  - số hộ nghèo
  - số hộ cận nghèo

Không thêm tooltip theo từng hộ vì heatmap không còn đại diện cho một điểm household riêng lẻ để click.

### 3D Base And Effects

Lớp nền dưới 3D trong `PovertyCommandMap.tsx` sẽ được tinh chỉnh gần `Demo1` hơn:

- giảm opacity và độ tương phản của grid
- giảm độ gắt của ring quay
- giảm opacity hoặc mật độ cloud
- chỉnh light để map surface và heatmap sáng hơn nền
- xem lại `renderOrder`, `depthWrite`, và `blending` để heatmap không bị lớp nền xuyên lấn

Mục tiêu là giữ chiều sâu không gian nhưng không để nền trở thành lớp hút mắt hơn dữ liệu.

### Focus And Camera

Giữ nguyên:

- `CameraFocus`
- `OrbitControls`
- `getCommandMapFocusConfig`

Heatmap phải nằm trong cùng `group` với map regions để khi scale theo vùng chọn, lớp nhiệt vẫn bám đúng hình học và không cần cơ chế sync riêng.

## Component Design

### Existing Files To Change

- `FE/src/components/poverty/command-dashboard/PovertyCommandMap.tsx`
- `FE/src/components/poverty/command-dashboard/PovertyCommandMap.utils.ts`
- `FE/src/components/poverty/command-dashboard/PovertyCommandMap.utils.test.ts`

### New Units

Khuyến nghị thêm:

- một helper thuần để build heatmap points từ marker projected
- một component `HeatmapLayer` chuyên render plane + shader/canvas texture

Tách riêng như vậy để file map chính không tiếp tục phình thêm và giúp kiểm thử đơn vị rõ ràng hơn.

## Testing Strategy

### Unit Tests

Mở rộng test cho `PovertyCommandMap.utils.test.ts` để kiểm tra:

- marker ngoài vùng chọn không đi vào heatmap input
- marker không hợp lệ về tọa độ bị loại
- heatmap input dùng đúng projection output và shape ổn định
- fallback khi không có selected region vẫn dùng toàn bộ marker

### Verification Scenarios

- Dashboard không còn marker beam/sphere/halo cho từng hộ.
- Heatmap xuất hiện đúng trên mặt map.
- Khi đổi tỉnh/xã, heatmap cập nhật theo dữ liệu mới.
- Khi focus vùng, heatmap scale và bám đúng vùng đó.
- Grid/ring/cloud sau khi chỉnh không lấn át heatmap.

### Verification Commands

- `cd FE && npm test -- PovertyCommandMap.utils.test.ts`
- `cd FE && npx tsc --noEmit`
- `cd FE && npx eslint src/components/poverty/command-dashboard/PovertyCommandMap.tsx src/components/poverty/command-dashboard/PovertyCommandMap.utils.ts`

## Risks And Mitigations

- Risk: heatmap plane có thể bị lệch bbox khi focus vùng.
  Mitigation: derive plane size và offset từ cùng bbox/projection đang dùng cho map group.

- Risk: shader/canvas texture gây tăng chi phí render.
  Mitigation: chỉ rebuild texture khi marker input hoặc bbox thay đổi, không rebuild theo mỗi frame.

- Risk: mất khả năng nhận biết loại hộ sau khi bỏ marker đơn lẻ.
  Mitigation: giữ legend, giữ số liệu vùng, và làm rõ thông tin nghèo/cận nghèo trong tooltip vùng.

- Risk: lớp nền dưới map sau khi giảm quá tay có thể làm scene mất chiều sâu.
  Mitigation: tinh chỉnh theo hướng giảm nhiễu chứ không loại bỏ hoàn toàn ring/grid/cloud.
