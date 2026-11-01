# Link Shortener

یک سرویس ساده کوتاه‌کننده لینک با **Node.js، Express 5 و SQLite**. کاربر می‌تواند یک URL معتبر ارسال کند، یک کد کوتاه ۶ کاراکتری دریافت کند و با باز کردن لینک کوتاه به آدرس اصلی هدایت شود.

پروژه علاوه بر API، یک رابط وب فارسی و راست‌چین دارد که با Tailwind CSS ساخته شده است. تنظیمات برنامه از فایل `.env` خوانده می‌شوند و تست‌های خودکار، ESLint، هدرهای امنیتی و محدودیت تعداد درخواست نیز در پروژه قرار دارند.

## فهرست مطالب

- [امکانات](#امکانات)
- [پیش‌نیازها و نصب](#پیشنیازها-و-نصب)
- [تنظیم متغیرهای محیطی](#تنظیم-متغیرهای-محیطی)
- [اجرا](#اجرا)
- [تست و بررسی کیفیت کد](#تست-و-بررسی-کیفیت-کد)
- [استفاده از API و مثال‌های curl](#استفاده-از-api-و-مثالهای-curl)
- [رفتار Endpointها](#رفتار-endpointها)
- [تصاویر برنامه](#تصاویر-برنامه)
- [ایده‌های نسخه بعد](#ایدههای-نسخه-بعد)
- [ساختار پروژه](#ساختار-پروژه)
- [امنیت و مدیریت خطا](#امنیت-و-مدیریت-خطا)
- [فونت وزیر](#فونت-وزیر)
- [مستندات کد و JSDoc](#مستندات-کد-و-jsdoc)
- [Swagger و OpenAPI](#swagger-و-openapi)
- [استفاده از Postman](#استفاده-از-postman)
- [مشارکت و Fork](#مشارکت-و-fork)

## امکانات

- ساخت لینک کوتاه با کد تصادفی و یکتای ۶ کاراکتری.
- ذخیره نگاشت `code -> url` در دیتابیس SQLite.
- هدایت به آدرس اصلی با پاسخ HTTP `302`.
- رابط وب فارسی، راست‌چین و Responsive.
- کپی لینک کوتاه در Clipboard.
- استایل‌دهی با Tailwind CSS 4 و فونت محلی Vazir.
- بارگذاری تنظیمات از `.env` با استفاده از `dotenv`.
- Health Check در مسیر `/health`.
- مستندات تعاملی Swagger UI در `/api-docs` و OpenAPI JSON در `/api-docs.json`.
- مجموعه درخواست‌های Postman برای مسیرهای API و تست پاسخ 302.
- هدرهای امنیتی با Helmet و Rate Limiting.
- مدیریت متمرکز خطاها.
- تست خودکار با Node.js Test Runner و بررسی کد با ESLint.

## پیش‌نیازها و نصب

پیش‌نیازها:

- Node.js نسخه **20 یا بالاتر**
- npm

ابتدا نسخه‌های نصب‌شده را بررسی کن:

```bash
node --version
npm --version
```

مخزن یا پوشه پروژه را دریافت کن و در ریشه آن دستور نصب وابستگی‌ها را اجرا کن:

```bash
npm install
```

یا به‌شکل کوتاه‌تر:

```bash
npm i
```

## تنظیم متغیرهای محیطی

پروژه تنظیمات خود را از فایل `.env` می‌خواند. فایل `.env.example` نمونه‌ای از متغیرهای قابل تنظیم است.

ابتدا از روی فایل نمونه، فایل محلی خودت را بساز.

**Windows CMD:**

```bat
copy .env.example .env
```

**PowerShell:**

```powershell
Copy-Item .env.example .env
```

**Linux / macOS:**

```bash
cp .env.example .env
```

سپس فایل `.env` را باز کن و مقادیر موردنظر را تغییر بده. متغیرهای اصلی عبارت‌اند از:

| متغیر | مقدار نمونه | توضیح |
|---|---|---|
| `NODE_ENV` | `development` | محیط اجرا؛ برای استقرار مقدار `production` قرار بده. |
| `PORT` | `3000` | پورتی که سرور Express روی آن اجرا می‌شود. |
| `SHORT_URL_BASE` | `http://localhost:3000` | آدرس پایه‌ای که در `shorturl` برگردانده می‌شود. در Production باید HTTPS باشد. |
| `SHORTENER_DB_PATH` | `./data/urls.sqlite` | مسیر فایل دیتابیس SQLite؛ مسیر نسبی از ریشه پروژه محاسبه می‌شود. |
| `JSON_BODY_LIMIT` | `8kb` | حداکثر اندازه بدنه JSON درخواست‌ها. |
| `SHORTEN_RATE_LIMIT_WINDOW_MS` | `60000` | بازه زمانی محدودیت درخواست ساخت لینک، بر حسب میلی‌ثانیه. |
| `SHORTEN_RATE_LIMIT_MAX` | `10` | حداکثر تعداد درخواست ساخت لینک از هر IP در هر بازه. |
| `SHORT_CODE_LOOKUP_RATE_LIMIT_MAX` | `300` | حداکثر تعداد درخواست بازیابی/Redirect از هر IP در هر بازه. |
| `TRUST_PROXY_HOPS` | `0` | تعداد Reverse Proxyهای مورداعتماد جلوی Express؛ برای اجرای مستقیم `0` و برای دقیقاً یک Proxy مورداعتماد `1`. |
| `SHORTENER_ALLOWED_HOSTS` | خالی | فهرست اختیاری دامنه‌های مجاز برای مقصد لینک‌ها؛ دامنه‌ها با کاما جدا می‌شوند. |
| `SWAGGER_ENABLED` | `true` | فعال یا غیرفعال‌کردن Swagger UI و فایل OpenAPI؛ برای محیط عمومی در صورت نیاز مقدار `false` قرار بده. |

نمونه تنظیم دامنه‌های مجاز:

```dotenv
SHORTENER_ALLOWED_HOSTS=example.com,docs.example.org
```

در صورت خالی بودن `SHORTENER_ALLOWED_HOSTS`، هر URL معتبر با پروتکل HTTP یا HTTPS قابل کوتاه‌سازی است. در صورت تنظیم این مقدار، فقط hostnameهایی که دقیقاً در فهرست آمده‌اند پذیرفته می‌شوند؛ زیر‌دامنه‌ها به‌صورت خودکار مجاز نیستند.

### نکات مربوط به `.env`

- فایل `.env` مخصوص محیط محلی است و به‌وسیله `.gitignore` از Git کنار گذاشته شده است.
- فایل `.env.example` را می‌توان در مخزن نگهداری کرد؛ مقادیر محرمانه نباید در آن قرار بگیرند.
- متغیرهایی که در محیط سیستم‌عامل یا سرویس میزبانی تعریف شده‌اند، بر مقادیر `.env` اولویت دارند.
- وجود فایل `.env` اجباری نیست؛ در محیط استقرار می‌توان متغیرها را مستقیماً در تنظیمات سرور تعریف کرد.
- در Production مقدار `SHORT_URL_BASE` باید یک Origin معتبر HTTPS باشد؛ شامل مسیر، Query، Fragment یا اطلاعات ورود نباشد.
- اگر برنامه پشت Reverse Proxy اجرا می‌شود، تعداد Proxyهای مورداعتماد را در `TRUST_PROXY_HOPS` دقیقاً مشخص کن. این تنظیم روی تشخیص IP و Rate Limiting اثر مستقیم دارد.

### تنظیم Reverse Proxy و رفع خطای X-Forwarded-For

اگر میزبان، درخواست را از طریق Reverse Proxy به Express می‌فرستد و هدر `X-Forwarded-For` را اضافه می‌کند، تعداد Proxyهای مورداعتماد باید دقیقاً تنظیم شود. برای نمونه، اگر دقیقاً یک Proxy مورداعتماد بین مرورگر و برنامه وجود دارد، متغیر زیر را در تنظیمات Environment سرویس میزبانی قرار بده:

```dotenv
TRUST_PROXY_HOPS=1
```

در پنل میزبانی Pachim نیز این متغیر را در Environment Variables سرویس تنظیم کن؛ چون فایل `.env` واقعی در Git قرار نمی‌گیرد و تنظیم محلی به‌صورت خودکار به سرور منتقل نمی‌شود.

- `0` یعنی هدرهای Forwarded مورداعتماد نیستند و مقدار پیش‌فرض برای اجرای مستقیم یا توسعه محلی است.
- `1` یعنی فقط یک Proxy در زنجیره مورداعتماد است.
- اگر چند Proxy وجود دارد، عدد واقعی زنجیره را تنظیم کن؛ تعداد را حدس نزن.
- از `true` استفاده نکن. اعتماد به همه Proxyها می‌تواند تشخیص IP را قابل جعل کند و Rate Limiting را بی‌اثر سازد.
- برنامه باید فقط از مسیر Proxy مورداعتماد در دسترس باشد، یا Proxy باید هدر ورودی `X-Forwarded-For` ارسالی کاربر را پاک‌سازی و مقدار قابل‌اعتماد خودش را ثبت کند.

اگر تعداد Proxyهای سرویس میزبانی را نمی‌دانی، از مستندات میزبان یا پشتیبانی آن مقدار صحیح را بگیر. اشتباه بودن تعداد hopها می‌تواند باعث ثبت IP خود Proxy به‌جای IP کاربر یا اعتماد به مقدار نامعتبر شود.

نمونه تنظیمات اصلی برای Production:

```dotenv
NODE_ENV=production
PORT=3000
SHORT_URL_BASE=https://short.example.com
SHORTENER_DB_PATH=./data/urls.sqlite
```

## اجرا

پس از نصب وابستگی‌ها و تنظیم `.env`، سرور را در حالت توسعه اجرا کن:

```bash
npm run dev
```

برای اجرای عادی یا Production:

```bash
npm start
```

در حالت پیش‌فرض، سرور روی آدرس زیر در دسترس است:

```text
http://localhost:3000
```

با باز کردن این آدرس، رابط وب کوتاه‌کننده لینک نمایش داده می‌شود.

### دستورات تکمیلی

تولید CSS نهایی Tailwind:

```bash
npm run build:css
```

اجرای Tailwind در حالت Watch هنگام توسعه رابط کاربری (در یک ترمینال جداگانه):

```bash
npm run dev:css
```

اجرای نمونه استفاده از ماژول کوتاه‌کننده:

```bash
npm run demo
```

فایل CSS کامپایل‌شده در `public/assets/style.css` قرار دارد و از طریق Express سرو می‌شود. تغییر در فایل‌های استایل منبع باید با `npm run build:css` کامپایل شود. برای توسعه هم‌زمان، `npm run dev` و `npm run dev:css` را در دو ترمینال جدا اجرا کن.

## تست و بررسی کیفیت کد

اجرای تمام تست‌ها:

```bash
npm test
```

این دستور فقط فایل‌های داخل پوشه `tests/` را اجرا می‌کند. فایل نمونه `test-script.js` به‌صورت خودکار وارد چرخه تست نمی‌شود و فقط با `npm run demo` اجرا خواهد شد.

اجرای تست‌های مربوط به Swagger به‌صورت مستقل:

```bash
npm run test:docs
```

اجرای تست‌های مربوط به Reverse Proxy و Rate Limiting:

```bash
npm run test:proxy
```

اجرای تست‌ها در حالت Watch:

```bash
npm run test:watch
```

بررسی کد با ESLint:

```bash
npm run lint
```

اصلاح خودکار موارد قابل اصلاح:

```bash
npm run lint:fix
```

بررسی آسیب‌پذیری وابستگی‌ها:

```bash
npm run audit
```

تست‌ها بخش‌های زیر را پوشش می‌دهند:

- بارگذاری `.env`، اولویت متغیرهای محیط سیستم‌عامل و اعتبارسنجی تنظیمات.
- اعتبارسنجی URL و کد کوتاه.
- تولید کد، ذخیره و بازیابی اطلاعات SQLite.
- Allowlist دامنه‌های مقصد.
- ساخت لینک، پاسخ Redirect و وضعیت کد ناموجود.
- JSON نامعتبر، خطاهای HTTP و Rate Limiting.
- هدرهای امنیتی و سرو شدن HTML، CSS و JavaScript.
- تنظیم تعداد Proxyهای مورداعتماد و Rate Limiting بر اساس IP واقعی کاربر.
- تنظیم و سرو شدن فایل‌های محلی فونت وزیر.

## استفاده از API و مثال‌های curl

آدرس پایه مثال‌ها `http://localhost:3000` است. اگر `SHORT_URL_BASE` یا `PORT` را تغییر داده‌ای، آدرس درخواست‌ها را نیز مطابق تنظیمات خودت تغییر بده.

### ۱. ساخت لینک کوتاه — `POST /shorten`

درخواست:

```bash
curl -i -X POST http://localhost:3000/shorten \
  -H "Content-Type: application/json" \
  --data '{"url":"https://example.com/articles/node-js"}'
```

در Windows PowerShell می‌توانی از `curl.exe` استفاده کنی:

```powershell
curl.exe -i -X POST "http://localhost:3000/shorten" `
  -H "Content-Type: application/json" `
  --data '{"url":"https://example.com/articles/node-js"}'
```

پاسخ موفق با وضعیت `201 Created`، مشابه نمونه زیر است. مقدار `code` تصادفی است و در هر بار اجرا می‌تواند متفاوت باشد:

```json
{
  "code": "aB12xZ",
  "shorturl": "http://localhost:3000/aB12xZ"
}
```

### ۲. باز کردن لینک کوتاه — `GET /:code`

کد دریافت‌شده از پاسخ قبلی را در URL قرار بده:

```bash
curl -i http://localhost:3000/aB12xZ
```

در صورت وجود کد، سرور پاسخ `302 Found` می‌دهد و آدرس اصلی را در هدر `Location` قرار می‌دهد. برای اینکه curl مسیر Redirect را هم دنبال کند، از `-L` استفاده کن:

```bash
curl -i -L http://localhost:3000/aB12xZ
```

در Windows PowerShell:

```powershell
curl.exe -i "http://localhost:3000/aB12xZ"
```

### ۳. بررسی سلامت سرویس — `GET /health`

```bash
curl -i http://localhost:3000/health
```

پاسخ:

```json
{
  "ok": true
}
```

## رفتار Endpointها

### `POST /shorten`

- بدنه درخواست باید یک JSON Object و شامل فیلد `url` باشد.
- JSON خراب از نظر نحوی با پاسخ `400` و کد `invalid-json` رد می‌شود.
- URL نامعتبر، خالی یا مفقود با پاسخ `422` و کد `invalid-url` رد می‌شود.
- اگر بدنه JSON از نوع Object نباشد، پاسخ `422` با کد `invalid-request-body` برمی‌گردد.
- URL باید معتبر، مطلق و دارای پروتکل `http` یا `https` باشد.
- طول URL حداکثر ۲۰۴۸ کاراکتر است.
- پس از اعتبارسنجی، یک کد یکتای ۶ کاراکتری تولید و همراه URL در SQLite ذخیره می‌شود.
- پاسخ موفق شامل `code` و `shorturl` است.

نمونه پاسخ موفق:

```json
{
  "code": "aB12xZ",
  "shorturl": "http://localhost:3000/aB12xZ"
}
```

### `GET /:code`

- کد باید ۶ کاراکتر و شامل حروف انگلیسی یا اعداد باشد.
- اگر کد وجود داشته باشد، پاسخ `302 Found` به URL ذخیره‌شده Redirect می‌کند.
- اگر کد وجود نداشته باشد یا معتبر نباشد، پاسخ `404` برگردانده می‌شود.

پاسخ کد پیدا نشده:

```json
{
  "error": "404 Not Found"
}
```

### وضعیت‌های مهم HTTP

| وضعیت | کاربرد |
|---|---|
| `200` | پاسخ موفق Health Check یا دریافت عادی فایل استاتیک |
| `201` | لینک کوتاه با موفقیت ساخته و ذخیره شده است. |
| `302` | کد کوتاه پیدا شده و Redirect انجام می‌شود. |
| `400` | JSON از نظر نحوی خراب است (`invalid-json`) یا درخواست HTTP ناقص/نامعتبر است. |
| `403` | اعتبارسنجی بدنه درخواست رد شده است. |
| `404` | مسیر یا کد کوتاه پیدا نشده است. |
| `413` | اندازه بدنه درخواست از محدودیت مجاز بیشتر است. |
| `415` | نوع محتوای درخواست پشتیبانی نمی‌شود. |
| `422` | URL نامعتبر (`invalid-url`) یا بدنه JSON غیر Object (`invalid-request-body`). |
| `429` | محدودیت تعداد درخواست‌ها رد شده است. |
| `500` | خطای پیش‌بینی‌نشده داخلی سرور رخ داده است. |
| `503` | دیتابیس یا تولید کد موقتاً در دسترس نیست. |

## تصاویر برنامه

تصاویر زیر محل‌های درنظرگرفته‌شده برای Screenshot هستند. بعداً تصاویر واقعی را در این بخش قرار بده.

### صفحه اصلی

> **محل Screenshot صفحه اصلی**  
> تصویر رابط وب در حالت اولیه، قبل از وارد کردن URL.

<!-- TODO: Screenshot صفحه اصلی را اینجا اضافه کن. برای مثال: ![صفحه اصلی](docs/screenshots/homepage.png) -->

### نتیجه کوتاه‌سازی

> **محل Screenshot نتیجه**  
> تصویر فرم پس از ساخت لینک کوتاه و نمایش دکمه کپی.

<!-- TODO: Screenshot نتیجه کوتاه‌سازی را اینجا اضافه کن. برای مثال: ![نتیجه کوتاه‌سازی](docs/screenshots/shortened-url.png) -->

## ایده‌های نسخه بعد

### ۱. Dockerize کردن پروژه

- ایجاد `Dockerfile` و در صورت نیاز `docker-compose.yml`.
- تعریف تنظیمات محیطی برای کانتینر.
- اجرای برنامه با کاربر غیرریشه و Health Check کانتینر.

### ۲. ماندگاری و پشتیبان‌گیری دیتابیس

در حال حاضر SQLite اطلاعات را در فایل `data/urls.sqlite` نگهداری می‌کند و روی دیسک باقی می‌ماند. هنگام انتقال برنامه به Docker باید پوشه `data/` به یک Named Volume یا مسیر پایدار میزبان متصل شود؛ در غیر این صورت با حذف کانتینر ممکن است فایل دیتابیس نیز از دست برود. تهیه نسخه پشتیبان و آزمایش بازیابی نیز باید اضافه شود.

### ۳. Rate Limiting مشترک

انتقال Store محدودیت درخواست از حافظه محلی به Redis تا شمارنده‌ها بین چند نمونه برنامه مشترک باشند و پس از Restart برنامه از بین نروند.

### پیشنهادهای تکمیلی

- افزودن حساب کاربری و داشبورد مدیریت لینک‌ها.
- ثبت تعداد کلیک‌ها و آمار بازدید هر لینک.
- امکان تعیین کد دلخواه و تاریخ انقضای لینک.
- قابلیت غیرفعال‌سازی یا حذف لینک.
- ثبت رویدادها و مانیتورینگ خطاها.

## ساختار پروژه

```text
express-health-api/
├── public/
│   ├── index.html
│   └── assets/
│       ├── fonts/                 # فایل‌های محلی فونت Vazir
│       ├── style.css              # خروجی کامپایل‌شده Tailwind
│       └── script.js              # منطق فرم، Fetch و Clipboard
│
├── postman/
│   ├── Link-Shortener.postman_collection.json
│   └── Link-Shortener-Local.postman_environment.json
├── src/
│   ├── config/
│   │   ├── swagger.js             # تولید OpenAPI از JSDoc
│   │   ├── loadEnv.js             # بارگذاری فایل .env
│   │   └── settings.js            # خواندن و اعتبارسنجی تنظیمات
│   ├── db/
│   │   └── database.js            # راه‌اندازی SQLite
│   ├── middleware/
│   │   ├── errorHandler.js        # مدیریت متمرکز خطاها
│   │   └── notFound.js            # مدیریت مسیرهای ناشناخته
│   ├── repositories/
│   │   └── urlRepository.js       # Queryهای مربوط به URLها
│   ├── routes/
│   │   ├── health.js              # مسیر GET /health
│   │   └── shortner.js            # مسیرهای POST /shorten و GET /:code
│   ├── services/
│   │   ├── README.md              # راهنمای مسئولیت لایه‌های src
│   │   └── shortenerService.js    # منطق اصلی کوتاه‌کننده
│   ├── styles/
│   │   ├── components.css         # استایل‌های تکمیلی رابط
│   │   ├── fonts.css              # تعریف فونت‌های Vazir
│   │   └── tailwind.css           # ورودی Tailwind CSS
│   ├── app.js                     # ساخت و پیکربندی Express
│   └── shortner.js                # API سازگاری با ماژول قبلی
│
├── tests/                         # تست‌های خودکار؛ شامل بررسی Swagger در swagger.test.js
├── data/                          # فایل دیتابیس؛ هنگام اجرا ساخته می‌شود
├── .env                           # تنظیمات محلی (در Git نادیده گرفته می‌شود)
├── .env.example                   # نمونه تنظیمات قابل اشتراک
├── .gitignore
├── eslint.config.js
├── package.json
├── server.js                      # نقطه ورود سرور
├── setup-vazir-font.bat           # دانلود و تنظیم فونت وزیر در Windows
└── test-script.js                 # نمونه استفاده از ماژول کوتاه‌کننده
```

### مسئولیت لایه‌ها

| بخش | مسئولیت |
|---|---|
| `routes` | دریافت درخواست HTTP و ساخت پاسخ |
| `services` | اجرای منطق و قوانین کسب‌وکار |
| `repositories` | خواندن و نوشتن اطلاعات در دیتابیس |
| `db` | ایجاد و مدیریت اتصال SQLite |
| `middleware` | هدرهای امنیتی و مدیریت خطا |
| `config` | بارگذاری و اعتبارسنجی تنظیمات محیطی |
| `tests` | بررسی توابع، تنظیمات و رفتار HTTP |

## امنیت و مدیریت خطا

- فقط URLهای مطلق با پروتکل `http:` یا `https:` پذیرفته می‌شوند.
- URLهای دارای username یا password رد می‌شوند.
- طول URL به ۲۰۴۸ کاراکتر محدود شده است.
- اندازه بدنه JSON به‌صورت پیش‌فرض ۸ کیلوبایت است.
- Queryهای SQLite پارامتری هستند و ورودی کاربر مستقیماً به SQL الحاق نمی‌شود.
- کد کوتاه با مولد تصادفی رمزنگارانه Node.js ساخته می‌شود و کلید اصلی SQLite از ثبت کد تکراری جلوگیری می‌کند.
- Helmet هدرهای امنیتی را تنظیم می‌کند و هدر `X-Powered-By` غیرفعال است.
- برای ساخت لینک و بازیابی کد، Rate Limiting فعال است.
- خطاهای داخلی و جزئیات SQL در پاسخ عمومی API نمایش داده نمی‌شوند.

### محدودیت Redirect

سرویس کوتاه‌کننده لینک به‌طور طبیعی کاربر را به یک آدرس دیگر هدایت می‌کند؛ به همین دلیل ممکن است برای فریب کاربران یا انتشار لینک‌های نامطمئن سوءاستفاده شود. اعتبارسنجی HTTP/HTTPS به‌تنهایی قابل‌اعتماد بودن مقصد را تضمین نمی‌کند. برای محدودکردن مقصدها، متغیر `SHORTENER_ALLOWED_HOSTS` را تنظیم کن و برای استفاده عمومی، گزارش سوءاستفاده، مسدودسازی دامنه‌های مخرب و مانیتورینگ نیز در نظر بگیر.

برنامه URL مقصد را از سمت سرور Fetch نمی‌کند؛ بنابراین مسیر Redirect به‌خودی‌خود درخواست خروجی سرور یا SSRF ایجاد نمی‌کند، اما مرورگر کاربر مقصد را باز خواهد کرد.

### محدودیت Rate Limiting

Store پیش‌فرض `express-rate-limit` در حافظه همان پردازش قرار دارد؛ بنابراین شمارنده‌ها پس از Restart پاک می‌شوند و بین چند پردازش یا سرور به اشتراک گذاشته نمی‌شوند. برای استقرار چندنمونه‌ای، یک Store مشترک مانند Redis لازم است. اگر برنامه پشت Reverse Proxy اجرا می‌شود، تنظیم `trust proxy` باید فقط متناسب با Proxyهای مورد اعتماد انجام شود.

### مدیریت خطا

مدیریت خطا در `src/middleware/errorHandler.js` متمرکز است. خطاهای JSON، اندازه درخواست، Content-Type، URL نامعتبر، Rate Limit و خطاهای دیتابیس بر اساس نوع خود به وضعیت HTTP مناسب نگاشت می‌شوند. جزئیات داخلی و Stack Trace در پاسخ کاربر قرار نمی‌گیرند.

## فونت وزیر

رابط وب از فونت Vazir به‌صورت محلی استفاده می‌کند و در زمان اجرای معمول سایت به CDN فونت وابسته نیست.

برای دانلود وزن‌های فونت و فایل مجوز، در Windows فایل زیر را از ریشه پروژه اجرا کن:

```bat
setup-vazir-font.bat
```

این اسکریپت فایل‌های فونت را در مسیر زیر قرار می‌دهد:

```text
public/assets/fonts/
```

پس از دانلود فونت، در صورت نیاز CSS را دوباره بساز:

```bash
npm run build:css
```

تعریف فونت‌ها در `src/styles/fonts.css` قرار دارد. فایل مجوز `OFL.txt` را همراه فایل‌های فونت نگه دار.



## مستندات کد و JSDoc

توابع عمومی و بخش‌های مهم داخلی در `src/` با JSDoc مستند شده‌اند. مستندات کنار پیاده‌سازی قرار دارند تا برنامه‌نویس جدید بتواند هدف تابع، ورودی‌ها، خروجی‌ها، خطاهای احتمالی و مثال استفاده را بدون جابه‌جایی بین چند فایل متوجه شود.

| فایل | مسئولیت و توابع اصلی |
|---|---|
| `src/config/loadEnv.js` | `loadEnvironment()` برای خواندن `.env` و حفظ اولویت متغیرهای محیط سیستم‌عامل. |
| `src/config/settings.js` | `readPositiveInteger()`، `readPort()`، `validateShortUrlBase()`، `parseAllowedHosts()` و `readBoolean()` برای خواندن و اعتبارسنجی تنظیمات. |
| `src/config/swagger.js` | `buildSwaggerDocument()` برای تولید سند OpenAPI از توضیحات Routeها. |
| `src/db/database.js` | `getDatabase()` برای ایجاد/آماده‌سازی SQLite و `closeDatabase()` برای بستن اتصال. |
| `src/repositories/urlRepository.js` | `insertUrl()`، `findUrlByCode()` و `codeExists()` برای عملیات پایگاه داده با Prepared Statement. |
| `src/services/shortenerService.js` | `isvalidurl()`، `createcode()`، `saveurl()`، `geturl()` و `createShortUrl()` برای منطق اصلی کسب‌وکار. |
| `src/routes/health.js` | پیاده‌سازی Health Check و توضیح OpenAPI برای `GET /health`. |
| `src/routes/shortner.js` | `createShortenerRouter()` و مستندات کامل OpenAPI برای ساخت لینک و Redirect. |
| `src/middleware/errorHandler.js` | تبدیل خطاهای شناخته‌شده به پاسخ JSON استاندارد و مخفی‌کردن جزئیات داخلی. |
| `src/middleware/notFound.js` | پاسخ یکپارچه برای مسیرهای ناشناخته. |
| `src/app.js` | `createApp()` برای ساخت برنامه Express و ترتیب Middlewareها و Routeها. |

### قرارداد ماژول Shortener

- `isvalidurl(url)` یک مقدار را بررسی می‌کند و `boolean` برمی‌گرداند.
- `createcode()` یک کد یکتای شش‌کاراکتری رزرو می‌کند؛ رزرو موقت است و باید با `saveurl()` یا جریان اصلی `createShortUrl()` ذخیره شود.
- `saveurl(url, code)` نگاشت URL و کد را در SQLite درج می‌کند؛ کد تکراری با خطای عملیاتی `409` رد می‌شود.
- `geturl(code)` URL ذخیره‌شده را برمی‌گرداند؛ برای کد نامعتبر یا پیدا‌نشده `null` می‌دهد.
- `createShortUrl(url)` عملیات اصلی مورد استفاده Route است: اعتبارسنجی، تولید کد، ذخیره و بازگرداندن `{ code, url }`.

## Swagger و OpenAPI

پروژه از `swagger-jsdoc` برای ساخت سند OpenAPI از کامنت‌های JSDoc و از `swagger-ui-express` برای نمایش مستندات تعاملی استفاده می‌کند. وابستگی‌ها با `npm install` نصب می‌شوند.

بعد از اجرای سرور، آدرس‌های زیر در دسترس هستند:

| مسیر | کاربرد |
|---|---|
| `GET /api-docs` یا `/api-docs/` | رابط تعاملی Swagger UI برای دیدن و امتحان‌کردن Endpointها. |
| `GET /api-docs.json` | سند خام OpenAPI نسخه 3.0.3 در قالب JSON؛ برای ابزارهایی مثل Postman و Swagger Editor. |

تعریف هر Endpoint کنار Route مربوط به خودش قرار دارد:

- `src/routes/health.js`: مسیر Health Check.
- `src/routes/shortner.js`: ساخت لینک کوتاه، ساختار Body، پاسخ‌ها، خطاها و پاسخ Redirect با کد 302.

تنظیم مستندات از طریق متغیر محیطی انجام می‌شود:

```dotenv
SWAGGER_ENABLED=true
```

برای غیرفعال‌کردن مستندات در یک محیط عمومی یا Production:

```dotenv
SWAGGER_ENABLED=false
```

در حالت غیرفعال، مسیرهای `/api-docs` و `/api-docs.json` ثبت نمی‌شوند. برای فعال‌سازی دوباره مقدار را `true` قرار بده و سرور را Restart کن.

## استفاده از Postman

فایل‌های آماده Import در پوشه `postman/` قرار دارند:

- `Link-Shortener.postman_collection.json`: مجموعه درخواست‌ها و تست‌های خودکار.
- `Link-Shortener-Local.postman_environment.json`: تنظیمات محیط Local شامل `baseUrl`، `originalUrl` و `missingCode`.

روش Import:

1. در Postman از گزینه **Import** استفاده کن.
2. هر دو فایل Collection و Environment را انتخاب و Import کن.
3. سرور را با `npm run dev` اجرا کن.
4. از انتخاب‌گر Environment، گزینه **Link Shortener - Local** را انتخاب کن.
5. درخواست‌های پوشه **System** را اجرا کن.
6. درخواست **Create short URL** را اجرا کن. تست آن کد تولیدشده را در متغیر Collection با نام `shortCode` ذخیره می‌کند.
7. درخواست **Redirect using saved code (expect 302)** را اجرا کن. برای مشاهده مستقیم پاسخ 302، دنبال‌کردن خودکار Redirect در همین درخواست غیرفعال شده است.

مجموعه Postman این موارد را پوشش می‌دهد:

- `GET /health` و انتظار پاسخ `200`.
- مشاهده Swagger UI و دریافت OpenAPI JSON.
- `POST /shorten` و بررسی پاسخ `201`، کد شش‌کاراکتری و `shorturl`.
- `GET /:code` و بررسی پاسخ `302` و هدر `Location`.
- کد ناشناخته و انتظار پاسخ `404`.
- URL نامعتبر و انتظار پاسخ `422`.

در صورت تغییر پورت یا دامنه، مقدار `baseUrl` را در Environment و در صورت نیاز `SHORT_URL_BASE` را در فایل `.env` هماهنگ کن.

## مشارکت و Fork

از مشارکت در توسعه پروژه، گزارش باگ و پیشنهاد قابلیت‌های جدید استقبال می‌شود. برای ارسال تغییرات، می‌توانی ابتدا مخزن را Fork کنی و سپس تغییرات را از طریق Pull Request (در GitHub) یا Merge Request (در GitLab) پیشنهاد بدهی.

### ۱. Fork کردن مخزن

در صفحه مخزن اصلی، گزینه **Fork** را انتخاب کن تا یک کپی از پروژه در حساب کاربری خودت ساخته شود. سپس آدرس Fork خودت را جایگزین مقادیر نمونه در دستورهای زیر کن.

### ۲. دریافت کد و تنظیم Remoteها

```bash
git clone https://github.com/<YOUR-USERNAME>/<REPOSITORY>.git
cd <REPOSITORY>
```

Remote مربوط به مخزن اصلی را هم اضافه کن تا بعداً بتوانی تغییرات آن را دریافت کنی:

```bash
git remote add upstream https://github.com/<ORIGINAL-OWNER>/<REPOSITORY>.git
git remote -v
```

در این دستورها، `<YOUR-USERNAME>` نام کاربری خودت، `<ORIGINAL-OWNER>` مالک مخزن اصلی و `<REPOSITORY>` نام مخزن است. اگر پروژه روی سرویس دیگری میزبانی می‌شود، URLها را با آدرس Git همان سرویس جایگزین کن.

### ۳. ساخت Branch برای تغییرات

برای هر قابلیت یا اصلاح، یک Branch جداگانه بساز. برای مثال:

```bash
git switch main
git switch -c feature/add-link-expiration
```

برای رفع باگ می‌توانی نامی مانند `fix/invalid-url-validation` انتخاب کنی. اگر Branch اصلی پروژه `main` نیست، نام Branch درست مخزن را جایگزین کن.

### ۴. نصب و بررسی پروژه

وابستگی‌ها را نصب و فایل تنظیمات محلی را ایجاد کن:

```bash
npm install
```

**Windows CMD:**

```bat
copy .env.example .env
```

**PowerShell:**

```powershell
Copy-Item .env.example .env
```

**Linux / macOS:**

```bash
cp .env.example .env
```

سپس تست‌ها و بررسی کیفیت کد را اجرا کن:

```bash
npm test
npm run test:docs
npm run lint
```

اگر تغییرت روی ظاهر یا فایل‌های CSS اثر می‌گذارد، CSS را هم بساز:

```bash
npm run build:css
```

### ۵. ثبت و Push تغییرات

```bash
git add .
git commit -m "feat: add link expiration"
git push -u origin feature/add-link-expiration
```

پیام Commit را متناسب با تغییر خودت بنویس؛ برای مثال از پیشوندهای `feat:` برای قابلیت جدید، `fix:` برای رفع باگ، `test:` برای تست و `docs:` برای مستندات استفاده کن.

### ۶. ارسال Pull Request یا Merge Request

پس از Push، به صفحه مخزن Forkشده برو و یک Pull Request یا Merge Request به Branch اصلی مخزن مبدا باز کن. در توضیحات درخواست، موارد زیر را بنویس:

- چه مشکلی را حل می‌کند یا چه قابلیتی اضافه می‌کند؟
- مهم‌ترین فایل‌ها یا بخش‌های تغییرکرده کدام‌اند؟
- چه تست‌هایی اجرا شده‌اند و نتیجه چه بوده است؟
- آیا متغیر محیطی، وابستگی یا تغییر مستنداتی جدیدی لازم است؟

### راهنمای مشارکت

- برای تغییرات رفتاری، تست جدید اضافه کن یا تست‌های موجود را به‌روزرسانی کن.
- قبل از ارسال درخواست، `npm test` و `npm run lint` را اجرا کن.
- اگر تنظیمات یا روش استفاده تغییر می‌کند، README را نیز به‌روز کن.
- فایل `.env`، رمزها، توکن‌ها، اطلاعات شخصی و دیتابیس محلی را Commit نکن. فقط `.env.example` را با مقادیر نمونه و غیرمحرمانه به‌روزرسانی کن.
- تغییرات را تا حد امکان کوچک و متمرکز نگه دار و از تغییر فایل‌های نامرتبط خودداری کن.
- اگر تغییری را نتوانسته‌ای تست کنی، آن را در توضیحات Pull Request شفاف اعلام کن.

## مجوز

در صورت نبود فایل مجوز جداگانه، شرایط استفاده از پروژه مطابق مجوز تعریف‌شده در `package.json` (MIT) است. مجوز فونت Vazir جداگانه و از نوع SIL Open Font License است.
