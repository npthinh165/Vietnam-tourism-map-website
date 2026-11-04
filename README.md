# Bản đồ Du lịch Việt Nam

Ứng dụng dùng **Python 3.11+ + Flask + psycopg + PostgreSQL** cho toàn bộ API và nghiệp vụ; Waitress phục vụ production. Giao diện React 19/TypeScript, Vite, Tailwind CSS và Leaflet được giữ để bảo toàn bản đồ, tìm kiếm, bộ lọc và các tương tác trên trình duyệt. JavaScript vẫn cần cho giao diện web; Node.js dùng để build/dev frontend và chạy PGlite local, không xử lý API.

Python giữ nguyên API, bảng PostgreSQL, ID, bcrypt, cookie phiên và CSRF của bản cũ. Không cần đăng ký lại tài khoản hay chuyển đổi dữ liệu. PostgreSQL có thể chạy độc lập hoặc dùng Supabase. Giao diện, thông báo và hạng thành viên bằng tiếng Việt.

## Chạy ứng dụng

### Chuẩn bị Python (một lần)

Cài Python 3.11+ và Node.js 22.12+. Trên Windows/PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
```

Trên macOS/Linux:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
```

Các lệnh npm tự chọn Python trong `.venv`; có thể đặt biến `PYTHON` thành đường dẫn interpreter khác. Production chỉ cần [requirements.txt](./requirements.txt); phát triển/kiểm thử dùng [requirements-dev.txt](./requirements-dev.txt).

### Chạy local nhanh

```sh
npm ci
npm run dev
```

Mở http://localhost:3000. Một lệnh chạy cả Vite và API Python. Có thể chạy trực tiếp `python -m backend dev` sau khi kích hoạt môi trường ảo. Nếu chưa đặt `DATABASE_URL`, chế độ dev tạo database PGlite tương thích PostgreSQL trong `.runtime/postgres`, áp dụng migration và nạp điểm đến. Tài khoản, phiên và nội dung được giữ sau khi tắt/mở ứng dụng; thư mục này không đưa lên Git. Database được cấu hình sẵn nhưng mất kết nối sẽ báo lỗi, không chuyển sang database khác. Chỉ chạy một tiến trình dev cho database local này. Python nhận diện lịch sử migration PGlite/Prisma cũ; không xóa hoặc khởi tạo lại dữ liệu.

Nếu Vite đang chạy riêng, dùng `npm run dev:api` để khởi động API cùng database local, hoặc dừng Vite cũ rồi chạy `npm run dev`. `npm run dev:web` chỉ chạy frontend. Không xóa `.runtime` nếu muốn giữ tài khoản local. `npm start` luôn yêu cầu PostgreSQL đã cấu hình.

### Tài khoản quản trị

Với database local, dừng tiến trình dev trước khi tạo admin:

```sh
npm run admin:create -- admin@example.com
npm run dev
```

Lệnh tạo admin mới và hiển thị mật khẩu ngẫu nhiên một lần để lưu lại. Có thể đặt `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` trong môi trường hoặc `.env.local`; mật khẩu tối thiểu 12 ký tự, tối đa 72 byte UTF-8. Lệnh từ chối email đã tồn tại và không tự nâng quyền tài khoản cũ. Với PostgreSQL riêng, lệnh sử dụng `DATABASE_URL` đã cấu hình.

Bấm biểu tượng khiên trên thanh đầu trang hoặc **Đăng nhập quản trị viên** trong hộp thoại đăng nhập. Sau khi đăng nhập, admin được đưa tới **Trang quản trị** để xem thống kê và danh sách thành viên. Có thể mở trực tiếp `?tab=admin`. API kiểm tra quyền `ADMIN` cho mỗi yêu cầu, kể cả khi truy cập trực tiếp; đăng ký công khai chỉ tạo vai trò `USER`.

### Nội dung khám phá và quản lý địa điểm

- **Lịch trình** có các hành trình mẫu để xem trước và sao chép vào bản nháp riêng sau khi đăng nhập. **Cộng đồng** có các bài minh họa được ghi nhãn riêng, không tạo tài khoản hay lượt tương tác giả.
- Chọn tỉnh trên bản đồ để đọc giới thiệu, lịch sử, cảnh quan, ẩm thực và lễ hội; chọn địa điểm để đọc phần giới thiệu và bài mô tả đầy đủ.
- Trong **Trang quản trị → Quản lý địa điểm**, admin có thể thêm hoặc sửa địa điểm: tỉnh/thành, tên, danh mục, mùa, tọa độ, địa chỉ, ảnh HTTPS, giới thiệu và bài mô tả. Nội dung lưu thành công được công khai trên bản đồ; bài mô tả hỗ trợ xuống dòng và được hiển thị như văn bản, không thực thi HTML.
- API `POST /api/admin/places` và `PUT /api/admin/places/:id` kiểm tra quyền ADMIN, CSRF và dữ liệu; cập nhật yêu cầu `version` để tránh ghi đè thay đổi của người khác. `GET /api/v1/places` cung cấp danh sách công khai.
- Database local tự áp dụng [migration nội dung](./prisma/migrations/202610200001_place_content/migration.sql) khi khởi động lại `npm run dev`. Với PostgreSQL riêng, chạy `npm run db:deploy` trước khi khởi động lại. Seed không ghi đè nội dung địa điểm đã có.

### Dùng PostgreSQL riêng

Yêu cầu Python 3.11+, Node.js 22.12+ để build frontend, npm và PostgreSQL 15+. Runtime production sau khi build không cần Node.js hoặc Prisma Client.

1. Sao chép [.env.example](./.env.example) thành `.env` và điền `DATABASE_URL` của database riêng cho ứng dụng. Dùng tài khoản database có quyền tạo bảng khi triển khai migration.
2. Cài đặt và chuẩn bị database:

```sh
npm ci
npm run db:deploy
npm run db:seed
```

3. Chạy API và frontend ở hai terminal:

```sh
npm run api
```

```sh
npm run dev:web
```

Mở http://localhost:3000. Vite chuyển `/api` tới API ở port `PORT` (mặc định 3002). `APP_URL` phải khớp origin trên trình duyệt (bao gồm port); môi trường dev chấp nhận thêm tên loopback tương đương `localhost`/`127.0.0.1`. Production vẫn yêu cầu origin chính xác. Các thao tác ghi bị từ chối nếu origin không khớp. API production không tự tạo database hay chuyển sang dữ liệu giả khi mất kết nối.

## Các module

- [App.tsx](./src/App.tsx): điều hướng và tích hợp các module, xóa trạng thái riêng tư khi đổi tài khoản.
- [auth.tsx](./src/features/auth.tsx), [routes.py](./backend/routes.py): đăng ký, đăng nhập, đăng xuất; bcrypt cost 12; mật khẩu tối thiểu 12 ký tự và tối đa 72 byte UTF-8; email chuẩn hóa và ràng buộc duy nhất. Phiên opaque 256 bit lưu hash SHA-256 trong database, hết hạn sau 7 ngày. Cookie HttpOnly, SameSite=Lax, Secure và tiền tố `__Host-` trong production; token không nằm trong localStorage. Đăng xuất thu hồi phiên trên máy chủ. Tối đa 5 phiên/tài khoản.
- [security.py](./backend/security.py), [app.py](./backend/app.py): kiểm tra origin, CSRF token ràng buộc với phiên, rate limit lưu trong PostgreSQL để dùng nhiều process, giới hạn payload, security headers/CSP và lỗi API tiếng Việt. Dữ liệu cá nhân không được trả về trong author công khai.
- [rewards.py](./backend/rewards.py), [domain.py](./backend/domain.py), [LoyaltyProfile.tsx](./src/features/LoyaltyProfile.tsx): ledger bất biến, thưởng tự động trong cùng transaction với hành động, chống thưởng trùng và hạn mức theo ngày Việt Nam. Hạng tính trên tổng điểm: Đồng 0, Bạc 200, Vàng 500, Kim Cương 1000.
- [VietnamMap.tsx](./src/components/VietnamMap.tsx): marker tỉnh/thành, icon ẩm thực/di tích/bãi biển/thiên nhiên, tìm không dấu, lọc miền/mùa/điểm sao, fitBounds, điều khiển bàn phím và giải phóng Leaflet khi unmount. [catalog.ts](./src/services/catalog.ts) dùng cùng danh mục với seed database, đóng gói ảnh đúng đường dẫn production.
- [CommunityFeed.tsx](./src/features/CommunityFeed.tsx): bài viết CRUD, ảnh HTTPS, phân trang bằng cursor, like lạc quan có rollback và khóa thao tác đang gửi, bình luận thêm/sửa/xóa, kiểm tra quyền tác giả trên máy chủ. API like nhận trạng thái mong muốn thay vì toggle, nên gửi lại cùng request không đảo ngược kết quả.
- [ItineraryPlanner.tsx](./src/features/ItineraryPlanner.tsx): CRUD ngày/hoạt động/khung giờ/chi phí, kiểm tra trùng giờ, lưu riêng tư hoặc công khai, liên kết chia sẻ, bản nháp sessionStorage theo tài khoản. `version` bảo vệ khi sửa ở nhiều tab; lỗi 409 giữ nội dung trong trình soạn thảo. Đóng trình soạn thảo rồi tải lại danh sách để mở phiên bản hiện hành.
- [DestinationDialog.tsx](./src/features/DestinationDialog.tsx): đánh giá và check-in có kiểm tra khoảng cách; cập nhật lại điểm, bản đồ và hồ sơ sau thành công.
- [schema.prisma](./prisma/schema.prisma) và [migration.sql](./prisma/migrations/202610170001_initial/migration.sql): quan hệ, foreign key, cascade delete, index, ràng buộc duy nhất và CHECK constraints.

Các module Express/Prisma cũ trong [server/](./server/) được giữ để đối chiếu, không chạy trong ứng dụng. Các entry point cũ và lệnh npm đều chuyển tới [backend/](./backend/). Prisma Client chỉ còn được dùng làm client độc lập trong kiểm thử tương thích database. Các thành phần demo và dịch vụ Supabase/localStorage cũ không được import vào luồng chính hay mount vào máy chủ. Không tự động chuyển tài khoản Supabase hoặc dữ liệu localStorage cũ sang database mới; tài khoản hiện dùng đăng ký bằng backend này. Không có đăng nhập giả, mật khẩu mặc định hay endpoint tự cộng điểm. OAuth, xác minh email và khôi phục mật khẩu chưa thuộc backend mới.

## Quy tắc điểm

| Hành động | Điểm | Giới hạn thưởng |
| --- | ---: | --- |
| Đăng ký | 50 | Một lần/tài khoản |
| Đánh giá | 20 | Một lần/địa điểm; tối đa 5 địa điểm/ngày |
| Tạo lịch trình | 30 | Một lần/ID lịch trình; tối đa 3/ngày |
| Check-in | 10 | Một lần/địa điểm/ngày; tối đa 5/ngày |

Sửa nội dung không cộng điểm. Ledger vẫn tồn tại khi xóa lịch trình; xóa rồi tạo thêm vẫn chịu quota trong ngày. Hành động vượt hạn mức vẫn lưu được và có ledger 0 điểm. Các transaction dùng Serializable và thử lại khi gặp xung đột.

Check-in chỉ nhận vị trí mới trong vòng 2 phút, accuracy <= 200 m và khoảng cách <= 1 km. Tọa độ chỉ dùng để kiểm tra, không lưu vị trí chính xác của người dùng. GPS trình duyệt có thể bị giả mạo; cơ chế này phù hợp điểm cộng đồng, không đủ chứng minh hiện diện để đổi tiền hoặc phần thưởng có giá trị. Đăng ký chưa xác minh email nên không chống được việc một người tạo nhiều tài khoản.

## API

Tất cả phản hồi lỗi có dạng `{ "error": "..." }`, lỗi validation có thêm `fields`. API danh sách dùng `{ items, nextCursor }` và `?cursor=...`, 20 mục/trang. Lấy `csrfToken` từ `/api/auth/session`, gửi `X-CSRF-Token` khi ghi, giữ cookie của phiên và `Content-Type: application/json` (kể cả DELETE). Đăng ký/đăng nhập kiểm tra origin mà không yêu cầu phiên trước.

| Method | Path | Chức năng |
| --- | --- | --- |
| GET | `/api/health` | Kiểm tra database |
| GET | `/api/auth/session` | Danh tính hiện hành + CSRF |
| POST | `/api/auth/signup` | `{name,email,password}` |
| POST | `/api/auth/signin` | `{email,password}` |
| POST | `/api/auth/admin/signin` | `{email,password}`, yêu cầu vai trò ADMIN |
| GET | `/api/admin/overview` | Thống kê cho admin |
| GET | `/api/admin/users` | Danh sách thành viên, phân trang; chỉ admin |
| POST | `/api/auth/signout` | Thu hồi phiên hiện tại |
| PATCH | `/api/v1/profile` | `{name}` của tài khoản hiện tại |
| GET | `/api/v1/rewards` | Lịch sử điểm của tài khoản hiện tại |
| GET, POST | `/api/v1/posts` | Feed / tạo bài `{content,province,imageUrl}` |
| PATCH, DELETE | `/api/v1/posts/:id` | Sửa / xóa bài của mình |
| PUT | `/api/v1/posts/:id/like` | `{liked:boolean}` |
| GET, POST | `/api/v1/posts/:id/comments` | Danh sách / tạo bình luận `{content}` |
| PATCH, DELETE | `/api/v1/comments/:id` | Sửa / xóa bình luận của mình |
| GET, POST | `/api/v1/itineraries` | Danh sách công khai / tạo; `?mine=true` xem của mình |
| GET, PUT, DELETE | `/api/v1/itineraries/:id` | Xem / cập nhật / xóa; kiểm tra tác giả và quyền riêng tư |
| GET | `/api/v1/places/ratings` | Điểm trung bình và số đánh giá thật |
| GET | `/api/v1/places/:id/reviews` | Đánh giá theo điểm đến |
| PUT | `/api/v1/places/:id/review` | `{rating,content}`; upsert theo người dùng/địa điểm |
| POST | `/api/v1/places/:id/checkin` | `{latitude,longitude,accuracy,timestamp}` |
| GET | `/api/v1/checkins` | Các địa điểm và tỉnh/thành đã check-in |

Frontend kiểm tra request qua [travel.ts](./shared/travel.ts); Python kiểm tra độc lập bằng [domain.py](./backend/domain.py), giữ cùng giới hạn và định dạng. [catalog.json](./backend/catalog.json) lưu đúng 34 tỉnh/thành và 105 điểm đến; chạy `npm run catalog:export` nếu sửa nguồn danh mục. `npm run catalog:check` phát hiện dữ liệu chưa đồng bộ trong CI. Tạo lịch trình gửi thêm `id` UUID do client sinh để thử lại an toàn; PUT gửi `version` hiện hành; DELETE gửi `?version=N`. Mỗi ngày có `title` và `activities`; mỗi hoạt động có `time`, `endTime`, `title`, `place`, `notes`, `cost`. `visibility` là `PRIVATE` hoặc `PUBLIC`.

## Kiểm tra và preview độc lập

```sh
npm run db:generate # chỉ cần cho test tương thích dùng Prisma
npm run lint
npm test
npm run build
npm audit
```

[Test API](./tests/api.test.ts) gọi HTTP thật tới **tiến trình Python**, dùng PGlite trong RAM và Prisma độc lập để xác nhận dữ liệu còn tương thích. Các kiểm thử bao gồm bcrypt, cookie, CSRF, origin, phân quyền, quản lý địa điểm, riêng tư, lượt thích idempotent, bình luận, version conflict, cascade, thưởng trùng, quota, phân trang và thu hồi phiên.

[Test Python](./tests_python/) kiểm tra validation, transaction rollback, đồng thời cộng điểm, hạn mức, phiên cũ, migration/seed, cookie production và phục vụ bản build. Mặc định dùng PGlite trong RAM, không đọc `DATABASE_URL` và không chạm dữ liệu ứng dụng. Có thể đặt `TEST_DATABASE_URL` cho PostgreSQL kiểm thử riêng; mỗi lần chạy tạo/xóa schema tạm độc lập. CI chạy thêm PostgreSQL 16 để kiểm tra transaction thật; kết quả CI phải được xem riêng với lần chạy local. PGlite tuần tự hóa transaction, không thay thế load test PostgreSQL.

[Test domain](./tests/domain.test.ts) và [test tỉnh/thành](./tests/provinces.test.ts) giữ các kiểm tra frontend, ranh giới và ánh xạ dữ liệu. `npm run lint` kiểm tra cả TypeScript, Python và tính đồng nhất của danh mục.

Preview tạm thời để kiểm tra giao diện, dữ liệu mất khi dừng:

```sh
npm run build
npm run preview:api
```

Mở http://localhost:3302 và đăng ký tài khoản mới. Script chỉ bind loopback, không dùng trong production.

## Triển khai

1. Dùng PostgreSQL/Supabase riêng, bật TLS theo yêu cầu nhà cung cấp trong `DATABASE_URL` (ví dụ `sslmode=require`); giữ URL này trong secret phía server. Dùng kết nối trực tiếp hoặc session pooler cho migration.
2. Cài `requirements.txt`; chạy `npm ci`, `npm run build` để tạo frontend. Chạy `python -m backend migrate` và `python -m backend seed` với `DATABASE_URL`. Migration đọc SQL cũ trong [prisma/migrations/](./prisma/migrations/), nhận diện lịch sử `_prisma_migrations`/`_LocalMigration` và ghi lịch sử/checksum `_PythonMigration`. Seed không ghi đè địa điểm đã có.
3. Đặt `NODE_ENV=production`, `APP_URL=https://ten-mien-cua-ban`, `HOST`, `PORT`, `TRUST_PROXY_HOPS` theo reverse proxy thật. Chạy `python -m backend serve` trong môi trường Python đã cài dependency. Waitress phục vụ Flask, cả bản build và `/api` trên cùng origin. `npm start` là lệnh tương đương qua launcher.
4. Proxy TLS chuyển HTTP tới Python; health check `/api/health`. Giữ [backend/](./backend/), [dist/](./dist/), [public/](./public/) và các migration trong deployment. Không cần Express, Prisma Client hoặc Node.js trong runtime khi dùng PostgreSQL riêng. Cấu hình backup database và giám sát lỗi; cookie/mật khẩu không được ghi vào log.
5. Bản đồ dùng tile OpenStreetMap công cộng có attribution. Chọn nhà cung cấp tile phù hợp dung lượng truy cập khi triển khai lớn.

Danh mục hiển thị **34 tỉnh/thành sau sáp nhập, từ 01/07/2025**, đối chiếu [Nghị quyết 202/2025/QH15](https://baochinhphu.vn/quoc-hoi-thong-qua-viec-sap-xep-don-vi-hanh-chinh-cap-tinh-ca-nuoc-co-34-tinh-thanh-102250612100156988.htm). [provinces.ts](./shared/provinces.ts) là bảng ánh xạ dùng chung cho bản đồ, tìm kiếm, check-in và lịch trình; ID là mã nội bộ được giữ ổn định, không phải mã hành chính quốc gia. Tìm tên tỉnh cũ (kể cả không dấu) vẫn dẫn tới tỉnh/thành mới. Danh mục giữ toàn bộ 105 điểm du lịch cùng ID, tọa độ và liên kết đánh giá; địa chỉ chi tiết cũ được ghi là thông tin tham khảo.

`npm run build:geojson` gộp polygon gốc trước khi đơn giản hóa để bỏ đường ranh giới giữa các tỉnh đã hợp nhất; giữ Côn Đảo thuộc TP. Hồ Chí Minh và Phú Quốc thuộc An Giang. Ranh giới là bản minh họa từ nguồn geoBoundaries có sẵn, không phải bản đồ địa chính; GeoJSON chưa bao phủ đầy đủ các đảo ngoài khơi. File được sinh đồng nhất ở [data/](./data/) và [public/data/](./public/data/). Script dừng nếu thiếu, trùng hoặc bỏ sót vùng gốc.

Với PostgreSQL đang có dữ liệu, chạy `npm run db:deploy` để áp dụng [migration tỉnh/thành](./prisma/migrations/202610170003_provinces_34/migration.sql), rồi `npm run db:seed`. Migration chỉ đổi tỉnh của điểm đến, giữ nguyên tài khoản, đánh giá và check-in. Database local tự áp dụng khi khởi động lại `npm run dev`. Dữ liệu thống kê du lịch/dân số mẫu vẫn là tổng hợp từ bộ dữ liệu lịch sử, không phải thống kê năm 2025. Bộ ảnh điểm đến là ảnh minh họa có sẵn. Điểm sao trên bản đồ chỉ tính từ review trong database. Lịch trình do người dùng sắp xếp, chưa tự tối ưu thời gian di chuyển.
