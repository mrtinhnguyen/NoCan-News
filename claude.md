# Dự án: NoCan News (News Noise Canceling)

> **Quan trọng:** Bất cứ khi nào có thay đổi về cấu trúc dự án, cấu hình, logic, v.v., tài liệu này (CLAUDE.md) cũng phải được cập nhật.

---

## 1. Tổng quan Dự án

- Hiện đang hoạt động Production

* **Mô tả:** Dịch vụ tuyển chọn email chặn tin tức bán nỗi lo âu, thay vào đó mang lại cảm giác an tâm và sự thấu hiểu.
* **Giá trị Cốt lõi:** "Tắt tiếng ồn, Bật ngữ cảnh (Noise Off, Context On)."
* **Đối tượng Mục tiêu:** Những cá nhân mệt mỏi với thông tin giật gân nhưng có nhu cầu tri thức và không muốn bỏ lỡ dòng chảy của thế giới.
* **Nền tảng:**
  - **Landing:** Web (Next.js) - Giới thiệu triết lý và đăng ký.
  - **Dịch vụ:** Daily Email Newsletter - Tự động gửi vào 7:00 sáng hàng ngày.

---

## 2. Triết lý Cốt lõi (Dựa trên Peter Wessel Zapffe)

1. **Isolation (Cô lập):**
   - AI chặn trước các 'Thông tin độc hại (Toxic Info)' như giết người, tội phạm tình dục, chuyện phiếm giải trí, phỉ báng chính trị.
   - Cung cấp cảm giác hiệu quả: "Hôm nay bạn đã được bảo vệ khỏi 300 tin rác".

2. **Anchoring (Neo đậu):**
   - Trung hòa (Neutralize) các tiêu đề câu view gây lo lắng bằng 'sự thật khô khan'.
   - Nhóm các thông tin phân mảnh theo cấu trúc [Hiện tượng - Bối cảnh - Hàm ý] để mang lại cảm giác kiểm soát tri thức cho độc giả.

---

## 3. Kiến trúc & Tech Stack (Đã cập nhật)

> Kiến trúc **Producer-Consumer** tách biệt giữa "Cửa hàng (Frontend)" và "Nhà máy (Backend)".

### 3.1 Cấu trúc Repository (Dual Repo)

| Phân loại | Vai trò          | Tên Repository (Ví dụ) | Tech Stack            | Môi trường Deploy     |
| --------- | ---------------- | ---------------------- | --------------------- | --------------------- |
| Consumer  | Frontend (Web)   | NoCan-News-Web         | Next.js, Tailwind CSS | Vercel (Serverless)   |
| Producer  | Backend (Worker) | NoCan-News-Worker      | NestJS (Standalone)   | GitHub Actions (Cron) |
| Storage   | Database         | (Tài nguyên chung)     | Supabase (PostgreSQL) | Cloud Hosted          |

### 3.2 Stack Chi tiết

**Frontend (Web):**

- **Framework:** Next.js (App Router)
- **Styling:** Tailwind CSS (Thiết kế Digital Brutalism)
- **Auth/DB:** `@supabase/supabase-js` (Sử dụng Anon Key)

**Backend (Worker):**

- **Framework:** NestJS (Standalone Mode để xử lý Batch)
- **Scraping:** `rss-parser` (Google News), `cheerio` (Nội dung bài viết)
- **AI Engine:** Gemini API (`gemini-2.5-flash`)
- **Email:** `resend` (Dịch vụ gửi email Resend)
- **DB Access:** Supabase Client (Sử dụng Service Role Key - Bỏ qua RLS)

### 3.3 Luồng hệ thống End-to-End

1. **Subscribe (Web):** Người dùng truy cập trang đích -> Nhập email -> Supabase INSERT (Next.js).
2. **Trigger (Worker):** 07:00 KST hàng ngày, GitHub Actions chạy NestJS worker.
3. **Fetch Users:** SELECT danh sách người đăng ký có `is_active: true` từ Supabase.
4. **Collect Data:** Thu thập Google News RSS (Kinh tế, Công nghệ, Chính sách, Xã luận).
5. **AI Process:**
   - **Filter:** Loại bỏ tin tức độc hại (giết người, phỉ báng, v.v.).
   - **Detox:** Trung hòa tiêu đề và tóm tắt [Fact-Context-Implication].
   - **Synthesis:** Phân tích tích hợp xã luận tả/hữu (Cấu trúc Chính-Phản-Hợp).
6. **Send:** Gửi email HTML qua Resend (Bao gồm liên kết hủy đăng ký ở Footer).
7. **Unsubscribe (Web):** Người dùng nhấp vào liên kết ở cuối thư -> Trang ẩn Next.js xử lý `UPDATE is_active = false`.

---

## 4. Chiến lược Database (Supabase)

### 4.1 Schema (`public.subscribers`)

```sql
create table public.subscribers (
  id uuid not null default gen_random_uuid (),
  email text not null,
  is_active boolean not null default true, -- Trạng thái đăng ký (Soft Delete)
  created_at timestamp with time zone not null default now(),
  constraint subscribers_pkey primary key (id),
  constraint subscribers_email_key unique (email)
);
```

### 4.2 Schema (`public.newsletters`) - Đã cập nhật

```sql
create table public.newsletters (
  id uuid not null default gen_random_uuid(),
  send_date date not null,
  title text not null,
  content_html text not null,
  content_data jsonb not null,
  all_keywords text[] default '{}',  -- Từ khóa trích xuất bởi AI (Dùng để theo dõi vấn đề)
  created_at timestamp with time zone not null default now(),
  constraint newsletters_pkey primary key (id),
  constraint newsletters_send_date_key unique (send_date)
);

-- GIN Index (Dùng cho tìm kiếm từ khóa)
create index idx_newsletters_keywords on newsletters using gin (all_keywords);
```

### 4.3 Schema (`public.issue_tracks`)

```sql
create table public.issue_tracks (
  id uuid not null default gen_random_uuid(),
  keyword text not null,              -- Từ khóa theo dõi (Ví dụ: "Tăng chỉ tiêu trường y")
  display_title text not null,        -- Tiêu đề hiển thị trên màn hình
  is_active boolean not null default true,
  last_report_html text,              -- HTML báo cáo do AI tạo
  last_report_data jsonb,             -- Dữ liệu cấu trúc để truy cập qua API
  last_updated_at timestamp with time zone default now(),
  created_at timestamp with time zone not null default now(),
  constraint issue_tracks_pkey primary key (id),
  constraint issue_tracks_keyword_key unique (keyword)
);
```

### 4.4 Schema (`public.payment_intent_logs`)

```sql
create table public.payment_intent_logs (
  id uuid not null default gen_random_uuid(),
  issue_track_id uuid references issue_tracks(id),
  target_issue text not null,         -- Từ khóa vấn đề đã nhấp
  ip_address inet,
  user_agent text,
  referrer text,
  clicked_at timestamp with time zone not null default now(),
  constraint payment_intent_logs_pkey primary key (id)
);
```

### 4.5 Chính sách Bảo mật (RLS)

- **Frontend (Anon Key):** Chỉ INSERT (subscribers), Chỉ SELECT (newsletters, issue_tracks)
- **Backend (Service Role Key):** SELECT, UPDATE tất cả. (Truy cập được mọi dữ liệu)

---

## 5. Tính năng Chính (Cấu trúc Nội dung)

### Phần 1. Protection Log (Nhật ký Bảo vệ)

- **Mục đích:** Trực quan hóa sự Cô lập (Isolation).
- **Hình thức:**
  > "Hôm nay AI đã quét tổng cộng 2,450 tin, chặn **120 tin giết người/tội phạm, 340 tin phỉ báng chính trị**."

### Phần 2. Headline Detox & Micro-Briefing (Trung hòa Tin tức)

- **Mục đích:** Neo đậu (Anchoring). Hiểu ngữ cảnh mà không cần nhấp chuột.
- **Cấu trúc:**
  - **[AI Chỉnh sửa]** Samsung Electronics, ghi nhận mức thấp mới trong 52 tuần do suy thoái ngành (Giọng điệu khô khan)
  - **3-Line Insight:** Fact / Context / Implication

### Phần 3. Editorial Synthesis (Tổng hợp Xã luận)

- **Mục đích:** Loại bỏ thiên kiến và nắm bắt các vấn đề cấu trúc.
- **Logic:** Khớp xã luận Bảo thủ vs Tự do -> AI viết báo cáo **[Vấn đề - Lập luận hai bên - Bản chất cấu trúc]**.

### Phần 4. Hidden Feature (Unsubscribe)

- **Mục đích:** Tôn trọng ý chí tự do của người dùng và ngăn chặn xử lý spam.
- **Triển khai:** Cung cấp liên kết từ chối nhận tin cá nhân ở Footer email -> Kết nối đến trang Next.js `/unsubscribe`.

### Phần 5. Issue Deep Dive (Phân tích Sâu Vấn đề) - MỚI

- **Mục đích:** Nắm bắt dòng chảy thời gian của vấn đề bằng báo cáo AI được tạo sẵn (Pre-baked).
- **Luồng dữ liệu:**
  1. Quản trị viên đăng ký từ khóa vào `issue_tracks`.
  2. Sau khi gửi bản tin hàng ngày, nếu có tin tức liên quan, báo cáo tự động cập nhật.
  3. Frontend render ngay lập tức HTML đã tạo trước.
- **Test Fake Door:** Ghi lại `payment_intent_logs` khi nhấp nút nội dung cao cấp.

```
[Quản trị viên] → Đăng ký từ khóa vào bảng issue_tracks
                ↓
[Daily Cron] → Hoàn tất gửi bản tin
                ↓
[Worker] → Trích xuất từ khóa từ tin mới → Lưu vào newsletters.all_keywords
                ↓
[Worker] → Nếu có tin mới trong các vấn đề đang hoạt động → Tái tạo báo cáo AI
                ↓
[Frontend] → Người dùng nhấp vào vấn đề → Hiển thị ngay last_report_html
                ↓
[Frontend] → Nhấp nút "Premium" → Ghi lại payment_intent_logs → Công khai miễn phí
```

---

## 6. Chiến lược Dữ liệu & AI

### 6.1 Thu thập Dữ liệu

- **Nguồn:** Google News RSS (Topics + Custom Queries)
- **Thư viện:** `rss-parser`, `axios`, `cheerio`
- **Hằng số:** Sử dụng URL RSS được định nghĩa trong `constants.ts`.

### 6.2 AI Prompt Engineering (Gemini 2.5 Flash)

- **Role 1 (Filter/Detox):** Phân định `isToxic` và viết lại tiêu đề khô khan.
- **Role 2 (Synthesis):** Phân tích so sánh xã luận. Loại bỏ từ ngữ cảm xúc, trích xuất vấn đề logic.
- **Role 3 (Keywords):** Trích xuất từ khóa theo dõi vấn đề từ danh sách tin tức (Ưu tiên danh từ riêng, vấn đề theo dõi liên tục).

### 6.3 Cấu hình Gemini API

| Môi trường | Gói cước      | Ghi chú                                   |
| ---------- | ------------- | ----------------------------------------- |
| Production | Pay-as-you-go | Sử dụng `GEMINI_API_KEY`, tính phí theo lượng dùng |
| Dev        | Free Tier     | Sử dụng `GEMINI_API_KEY_DEV`, giới hạn 20 lần/ngày |

### 6.4 Xử lý Lỗi AI và Thử lại

- **Cơ chế thử lại:** Áp dụng exponential backoff cho mọi cuộc gọi API AI (1s → 2s → 4s, tối đa 3 lần).
- **Xử lý Fallback:** Nếu thất bại sau 3 lần thử lại, sử dụng giá trị mặc định, đặt cờ `isFallback: true`.
- **Phân loại Metric:** Ghi log tách biệt Thành công/Fallback/Thất bại.

---

## 7. Lộ trình Phát triển (Đã cập nhật)

### Giai đoạn 1: Landing Page & DB (Đã hoàn thành)

- [x] Tạo dự án Supabase và xây dựng bảng `subscribers`.
- [x] Thiết lập chính sách RLS (Anon: Insert Only).
- [x] Tạo dự án Next.js (NoCan-News-Web).
- [x] Thiết kế Landing Page (Digital Brutalism) và liên kết form đăng ký.
- [x] Hoàn tất deploy Vercel.

### Giai đoạn 2: Triển khai Logic Worker (Hiện tại)

- [x] Kết nối DB dự án NestJS (NoCan-News-Worker) (Inject Supabase Client).
- [x] Triển khai logic thu thập Google News và `rss-parser`.
- [x] Kết nối Gemini API và tinh chỉnh prompt (Filter/Detox).
- [x] Viết template Resend (Bao gồm liên kết Unsubscribe).

### Giai đoạn 3: Tự động hóa & Ra mắt

- [x] Viết workflow GitHub Actions (`cron: '0 22 * * *'`).
- [x] Test gửi email thực tế (Whitelist).
- [x] Service Launch (Mở MVP).

### Giai đoạn 4: Tính năng Theo dõi Vấn đề (Hiện tại)

- [x] Migration DB (`newsletters.all_keywords`, `issue_tracks`, `payment_intent_logs`)
- [x] Logic trích xuất từ khóa AI (`ai.service.ts`)
- [x] Module Issue Tracking (`src/modules/issue-tracking/`)
- [x] Script backfill từ khóa (`scripts/backfill-keywords.ts`)
- [ ] Trang danh sách/chi tiết vấn đề Frontend (NoCan-News-Web)
- [ ] Triển khai UI Fake Door Test

---

## 8. Chế độ Thực thi

### 8.1 NPM Scripts

| Script               | AI   | Email  | Report | Mục đích         |
| -------------------- | ---- | ------ | ------ | ---------------- |
| `npm run dev`        | Mock | Skip   | O      | Test cục bộ nhanh |
| `npm run dev:ai`     | Real | Skip   | O      | Kiểm tra chất lượng AI |
| `npm run start:prod` | Real | Send   | X      | Production       |

### 8.2 Biến Môi trường

| Biến                 | Mặc định | Mô tả                                |
| -------------------- | -------- | ------------------------------------ |
| `DEV_MODE`           | false    | Chế độ phát triển (Tạo báo cáo, verbose log) |
| `DEV_AI_ENABLED`     | false    | Bật AI trong chế độ dev              |
| `NEWSLETTER_DRY_RUN` | false    | Bỏ qua gửi email                     |
| `GEMINI_API_KEY`     | -        | Khóa API Gemini Production           |
| `GEMINI_API_KEY_DEV` | -        | Khóa API Gemini Dev                  |

### 8.3 Quality Gate (Cổng Chất lượng)

Tiêu chuẩn kiểm chứng chất lượng trước khi gửi bản tin:

| Mục kiểm tra    | Tiêu chuẩn               | Hành động khi thất bại |
| --------------- | ------------------------ | ---------------------- |
| Số lượng tin    | 8 tin trở lên            | Dừng gửi email         |
| Tỷ lệ scraping  | 60% trở lên              | Dừng gửi email         |
| AI Insight      | Loại bỏ bài viết thất bại | Tiếp tục tiến hành     |
| Khớp xã luận    | Tùy chọn                 | Gửi ngay cả khi không có |

### 8.4 Selection Report (Báo cáo Chọn lọc AI)

Báo cáo HTML được tạo tự động trong DEV_MODE:

- Vị trí: `reports/selection-report-YYYY-MM-DD-HHMM.html`
- Nội dung: Danh sách toàn bộ bài viết theo danh mục + Kết quả chọn lọc AI + Thống kê lọc
- Mục đích: Kiểm tra chất lượng chọn lọc của AI

### 8.5 Script Theo dõi Vấn đề

| Script | Mục đích |
|--------|----------|
| `npx ts-node scripts/backfill-keywords.ts` | Áp dụng hồi tố từ khóa cho các bản tin cũ |

**Biến môi trường cho script backfill:**
- `SUPABASE_URL`, `SUPABASE_SECRET_KEY`: Bắt buộc
- `GEMINI_API_KEY`: Dùng cho trích xuất từ khóa AI
