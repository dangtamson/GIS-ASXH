# Poverty Dashboard Monthly Trend Design

## Goal

Mở rộng phần `Biến động qua các năm` trên trang `ho-ngheo/dashboard` để người dùng có thể chuyển giữa hai chế độ:

- `Theo năm`
- `Theo tháng`

Trong đó chế độ `Theo tháng` hiển thị đủ 12 tháng của một năm được chọn, và dữ liệu tháng được tính theo `decisionDate` của lần đánh giá hộ.

## Scope

Thiết kế này bao gồm:

- mở rộng response của endpoint dashboard hiện tại
- bổ sung dữ liệu `monthlyTrend` theo năm
- bổ sung control chọn `Theo năm / Theo tháng`
- bổ sung `Select năm` khi ở chế độ tháng
- cập nhật chart panel FE để render linh hoạt theo mode

Thiết kế này không bao gồm:

- tạo endpoint dashboard mới
- thay đổi bộ lọc địa bàn hiện tại của dashboard
- thay đổi các panel thống kê khác ngoài panel xu hướng
- thêm cột dữ liệu tháng mới vào bảng đánh giá

## Current Problem

Dashboard hiện chỉ có `Biến động qua các năm`, dùng dữ liệu tổng hợp theo `poorHouseholds.year`. Người dùng không xem được diễn biến chi tiết theo tháng trong một năm cụ thể, nên khó theo dõi nhịp thay đổi ngắn hạn của hộ nghèo/cận nghèo sau các đợt đánh giá.

## Requirements

### Functional Requirements

- Panel xu hướng phải hỗ trợ hai chế độ:
  - `Theo năm`
  - `Theo tháng`
- Chế độ mặc định là `Theo năm`.
- Khi chuyển sang `Theo tháng`, UI phải hiển thị thêm `Select năm`.
- `Select năm` chỉ chứa các năm thực sự có dữ liệu tháng khả dụng.
- Chế độ `Theo tháng` hiển thị đủ 12 tháng của năm đã chọn:
  - tháng không có dữ liệu phải hiện giá trị `0`
- Cả hai chế độ đều phải giữ 3 series:
  - `Hộ nghèo`
  - `Hộ cận nghèo`
  - `Tổng cộng`
- Dữ liệu năm tiếp tục tính theo `assessmentYear`.
- Dữ liệu tháng lấy `month` từ `decisionDate` của bản ghi đánh giá.
- Chỉ những đánh giá có `decisionDate` hợp lệ mới được đưa vào xu hướng tháng.
- Nếu đang ở chế độ tháng và năm được chọn không còn hợp lệ sau khi đổi bộ lọc dashboard, FE phải tự fallback về năm hợp lệ mới nhất.

### UX Requirements

- Không tạo thêm chart panel mới; giữ nguyên một panel xu hướng duy nhất.
- Tiêu đề panel đổi thành `Biến động hộ nghèo/cận nghèo`.
- Chuyển mode phải cập nhật biểu đồ ngay, không reload toàn trang.
- Tooltip phải đổi theo mode:
  - `Năm 2025`
  - `Tháng 1`, `Tháng 2`, ...
- Empty state phải rõ ràng:
  - `Chưa có dữ liệu theo năm`
  - `Chưa có dữ liệu theo tháng cho năm đã chọn`

### Non-Functional Requirements

- Giữ nguyên endpoint dashboard hiện tại.
- FE không cần gọi request riêng chỉ để chuyển mode năm/tháng.
- Backend phải trả dữ liệu tháng theo shape ổn định để FE không phải tự suy diễn hoặc tự vá tháng thiếu.

## Recommended Approach

Mở rộng endpoint dashboard hiện có để trả cả `yearlyTrend`, `trendAvailableYears`, và `monthlyTrendByYear`, sau đó để FE giữ một state `trendMode` và một state `selectedTrendYear` để chuyển biểu đồ trong cùng một panel.

Đây là phương án tốt nhất vì:

- không làm dashboard dài thêm
- không tạo thêm endpoint hoặc request dư thừa
- tránh lệch logic tổng hợp giữa FE và BE
- phù hợp với panel xu hướng hiện tại vốn đã là một điểm nhìn tổng hợp

## Alternatives Considered

### Alternative 1: Tạo 2 panel riêng cho năm và tháng

Reject. Tốn không gian, tăng nhiễu thị giác, và khiến dashboard dài hơn không cần thiết.

### Alternative 2: Tạo tab riêng cho `Theo năm` và `Theo tháng`

Khả thi nhưng không phải lựa chọn khuyến nghị. Tab làm UI nặng hơn trong khi yêu cầu chỉ cần đổi cách nhìn cùng một loại dữ liệu xu hướng.

### Alternative 3: Gọi API lại khi người dùng đổi giữa năm và tháng

Reject. Tăng độ trễ và độ phức tạp state management, trong khi dữ liệu dashboard đủ nhỏ để trả một lần trong cùng response.

## Backend Design

### Existing Response

Response hiện có:

- `totals`
- `overview`
- `byArea`
- `yearlyTrend`

### Proposed Response Extension

Mở rộng `PovertyDashboard` với:

- `trendAvailableYears?: number[]`
- `monthlyTrendByYear?: { year: number; months: { month: number; poor: number; nearPoor: number; total: number }[] }[]`

Shape đầy đủ:

```ts
type PovertyDashboard = {
  totals?: {
    total?: number;
    poor?: number;
    nearPoor?: number;
    active?: number;
  };
  overview?: PovertyDashboardOverview | null;
  byArea?: PovertyReportRow[];
  yearlyTrend?: {
    year: number;
    poor: number;
    nearPoor: number;
    total: number;
  }[];
  trendAvailableYears?: number[];
  monthlyTrendByYear?: {
    year: number;
    months: {
      month: number;
      poor: number;
      nearPoor: number;
      total: number;
    }[];
  }[];
};
```

### Data Source Rules

#### Yearly trend

Giữ nguyên như hiện tại:

- group theo `poorHouseholds.year`
- đếm `POOR`, `NEAR_POOR`, `total`

#### Monthly trend

Nguồn dữ liệu:

- bảng `householdAssessments`
- `assessmentYear` xác định năm logic của đợt đánh giá
- `decisionDate` xác định tháng

Quy tắc:

- chỉ lấy bản ghi có `decisionDate` hợp lệ
- chỉ tính vào group tháng nếu `extract(year from decisionDate) = assessmentYear`
  - mục tiêu là tránh lệch dữ liệu nếu `decisionDate` bị nhập sang năm khác
- group theo:
  - `assessmentYear`
  - `extract(month from decisionDate)`
  - `povertyType`
- backend phải fill đủ tháng `1..12` cho từng năm khả dụng, kể cả khi tháng đó không có bản ghi

### Available Years

`trendAvailableYears` nên được build từ tập năm có ít nhất một bản ghi đánh giá kèm `decisionDate` hợp lệ sau khi áp bộ lọc dashboard hiện tại.

Thứ tự:

- sắp tăng dần ở response
- FE có thể chọn phần tử cuối cùng làm năm mặc định cho mode tháng

## Frontend Design

### Main Page Changes

Trang `FE/src/components/poverty/PovertyDashboardPage.tsx` tiếp tục fetch dashboard như hiện tại, nhưng thêm state:

- `trendMode: "yearly" | "monthly"`
- `selectedTrendYear?: number`

Khởi tạo:

- `trendMode = "yearly"`
- `selectedTrendYear = năm mới nhất của trendAvailableYears` khi response có dữ liệu

### Trend Panel UI

Panel đổi từ:

- `Biến động qua các năm`

thành:

- `Biến động hộ nghèo/cận nghèo`

Header panel gồm:

- control chọn `Theo năm / Theo tháng`
- `Select năm` chỉ hiện khi `trendMode === "monthly"`

### Chart Behavior

#### Yearly mode

- trục X: danh sách năm
- tooltip: `Năm 2024`
- giữ nguyên 3 line series

#### Monthly mode

- trục X: `T1 ... T12`
- tooltip: `Tháng 1`, `Tháng 2`, ...
- dữ liệu đọc từ `monthlyTrendByYear` của năm đang chọn
- vẫn giữ 3 line series

### Fallback Rules

- nếu `trendAvailableYears` rỗng:
  - disable hoặc ẩn `Select năm`
  - hiển thị empty state theo tháng
- nếu người dùng đang chọn một năm không còn tồn tại sau khi đổi địa bàn:
  - tự fallback sang năm mới nhất khả dụng
- nếu không có `monthlyTrendByYear` cho năm đã chọn:
  - FE coi như không có dữ liệu tháng cho năm đó

## Component Design

Khuyến nghị refactor `YearlyTrendPanel` hiện tại thành panel tổng quát hơn thay vì nhét hết logic mới vào tên cũ.

Hai hướng hợp lệ:

### Preferred

Đổi component thành một panel tổng quát, ví dụ:

- `PovertyTrendPanel`

Component này nhận:

- `yearlyData`
- `monthlyDataByYear`
- `availableYears`
- `trendMode`
- `selectedTrendYear`
- `onTrendModeChange`
- `onTrendYearChange`

### Acceptable

Giữ file `YearlyTrendPanel.tsx` nhưng mở rộng props để hỗ trợ cả tháng và năm.

Nếu chọn cách này, nên cân nhắc đổi tên component sau cùng để tên không gây hiểu nhầm.

## Error Handling And Edge Cases

- `decisionDate` null hoặc sai định dạng:
  - bỏ qua khỏi monthly trend
- `decisionDate` có năm khác `assessmentYear`:
  - bỏ qua khỏi monthly trend để tránh dữ liệu tháng sai logic
- năm có dữ liệu năm nhưng không có dữ liệu tháng:
  - vẫn được tính trong `yearlyTrend`
  - không xuất hiện trong `trendAvailableYears`
- tất cả tháng đều bằng `0`:
  - vẫn có thể render chart nếu năm đó nằm trong monthly trend
  - nhưng nếu không có year khả dụng thì dùng empty state

## Testing Strategy

### Backend Tests

Thêm test cho repository/dashboard:

- `yearlyTrend` không đổi behavior cũ
- `monthlyTrendByYear` nhóm đúng theo `assessmentYear + decisionDate month`
- tháng thiếu được fill `0`
- `trendAvailableYears` chỉ chứa năm có `decisionDate` hợp lệ
- bản ghi có `decisionDate` lệch năm bị loại khỏi monthly trend

### Frontend Tests

Ưu tiên test logic thuần nếu tách helper:

- derive năm mặc định mới nhất
- map monthly trend thành categories `T1..T12`
- fallback khi năm đang chọn không còn hợp lệ
- empty state text theo từng mode

### Manual Verification

- dashboard mở mặc định ở `Theo năm`
- chuyển sang `Theo tháng` hiện `Select năm`
- chọn năm khác thì chart đổi đúng
- đổi bộ lọc địa bàn vẫn cập nhật đúng mode và năm
- tooltip, trục X, và series name đổi đúng theo mode

## Implementation Notes

- Không nên để FE tự tổng hợp tháng từ raw assessments; backend phải trả sẵn shape chart-ready.
- Nếu giữ `YearlyTrendPanel`, ít nhất phần props và tiêu đề phải phản ánh rằng component đã hỗ trợ cả tháng lẫn năm.
- Nên tái sử dụng màu series hiện tại để người dùng không phải học lại legend khi đổi mode.
