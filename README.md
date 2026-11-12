# EduFunnel Dashboard

EduFunnel adalah dashboard funnel penerimaan mahasiswa berbasis HTML, CSS, JavaScript vanilla, Chart.js, dan Supabase.

## Setup Supabase

1. Buka project Supabase.
2. Masuk ke menu **SQL Editor**.
3. Buka file `supabase_schema.sql` dari project ini.
4. Salin seluruh isi file tersebut ke SQL Editor.
5. Klik **Run**.

SQL tersebut akan membuat tabel:

- `summary_metrics`
- `funnel_sources`
- `monthly_channel_traffic`
- `daily_channel_traffic`

SQL juga mengaktifkan Row Level Security dan membuat policy `select` untuk role `anon`, sehingga dashboard frontend bisa membaca data menggunakan publishable/anon key.

## Konfigurasi Supabase

Konfigurasi ada di bagian atas `js/main.js`:

```js
const SUPABASE_URL = "https://tyjgxjawjqwerwemzkhy.supabase.co";
const SUPABASE_ANON_KEY = "isi_dengan_publishable_anon_key";
```

Project ini sudah diisi dengan URL Supabase dan publishable key yang diberikan. Jika memakai project Supabase lain, ganti dua nilai tersebut. Gunakan hanya publishable/anon key di frontend. Jangan memakai service role key atau secret key di file frontend.

## Setup Login User

Login dan register user memakai **Supabase Auth**.

1. Buka Supabase Dashboard.
2. Masuk ke **Authentication**.
3. Buka menu **Users** untuk melihat user yang sudah register dari dashboard.
4. Jika ingin register langsung bisa login tanpa cek email, buka **Authentication > Providers > Email** lalu matikan **Confirm email**.
5. Jika **Confirm email** aktif, user harus membuka email verifikasi terlebih dahulu sebelum login.

Data email dan password tidak disimpan di `localStorage`. Session login dikelola oleh Supabase Auth.

## Menjalankan Project

Cara paling mudah:

1. Buka folder project di VS Code.
2. Install extension **Live Server** jika belum ada.
3. Klik kanan `index.html`.
4. Pilih **Open with Live Server**.

Dashboard akan mencoba mengambil data dari Supabase terlebih dahulu. Jika Supabase belum bisa diakses, query gagal, atau schema belum dijalankan, dashboard otomatis menggunakan fallback dari `data_funnel.json` atau `js/data_funnel.js`.

## Struktur Data

Data Supabase di-mapping kembali ke format lama agar UI dashboard tetap compatible:

- `summary`
- `metric_cards`
- `funnel_stages`
- `funnel_data`
- `sources`
- `monthly_channel_traffic`
- `daily_channel_traffic`

Sumber data berdasarkan filter periode:

- **Last 7 Days** memakai `daily_channel_traffic`.
- **This Month** memakai `monthly_channel_traffic` bulan terakhir.
- **This Year** memakai `summary_metrics` dan `funnel_sources`, dengan chart bulanan dari `monthly_channel_traffic`.

Dengan mapping ini, fitur lama tetap berjalan:

- metric cards
- funnel overview
- channel analysis
- monthly traffic chart
- filter periode
- filter channel
- search data
- download report

## Catatan Keamanan

- Jangan commit service role key.
- Jangan simpan secret key di JavaScript frontend.
- Publishable/anon key boleh digunakan di frontend selama policy Supabase sudah dibatasi sesuai kebutuhan.
- User authentication memakai Supabase Auth, bukan penyimpanan password manual di browser.
