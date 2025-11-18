# 🏕️ Karang Taruna - Sistem Manajemen Kas

Website modern untuk mengelola kas Karang Taruna dengan desain clean dan fitur lengkap.

## ✨ Fitur Utama

### 🔐 Autentikasi & RBAC
- **2 Role Pengguna:**
  - **Bendahara** (Anita & Astika): Full access - bisa create, read, update, delete
  - **Anggota**: Read-only access - hanya bisa melihat data

### 👥 Data Anggota & Pembayaran Kas
- Tabel anggota dengan 27 anggota Karang Taruna (urut alfabetis)
- **2 Card Saldo** yang bisa diedit:
  - Saldo Cash (hijau)
  - Saldo M-Banking (biru)
- **Popup Metode Pembayaran**: Pilih Cash atau Transfer saat klik checkbox
- **Range Bulan Custom**: Atur periode pembayaran sesuai kebutuhan (default: Juli-November 2025)
- Checkbox berwarna sesuai metode:
  - Hijau = Cash → Saldo cash +Rp 5.000
  - Biru = Transfer → Saldo m-banking +Rp 5.000
- Tambah/hapus anggota (khusus bendahara)
- Otomatis update saldo saat checkbox dicentang

### 💰 Pemasukan & Pengeluaran
- Catat semua transaksi kas
- Filter: Pemasukan atau Pengeluaran
- Summary cards: Total pemasukan, pengeluaran, dan sisa saldo
- Form lengkap dengan tanggal, nominal, dan keterangan
- History transaksi dengan visual yang menarik

### 📅 Acara Kumpulan Rutin
- Catat acara kumpulan bulanan
- Input topik pembahasan
- Tracking total kas yang terkumpul saat acara
- Catatan tambahan untuk setiap acara
- Grid view dengan card yang interaktif

### 📊 Laporan Keuangan (NEW!)
- **Ringkasan Keuangan Lengkap**:
  - Saldo Cash & M-Banking
  - Total Saldo Kas
  - Saldo Akhir (Pemasukan - Pengeluaran)
  - Breakdown Pemasukan (Iuran + Pertemuan + Lainnya)
  - Total Pengeluaran
- **Daftar Anggota Belum Lunas**:
  - Tabel lengkap dengan detail pembayaran per anggota
  - Highlight bulan yang belum dibayar
  - Total tunggakan per anggota
  - Persentase pembayaran
- **Filter Periode Custom**: Atur range bulan untuk laporan
- **Export Laporan**: Download laporan dalam format JSON

## 🎨 Desain

- **Clean White Design**: Minimalis, fokus pada konten
- **Smooth Animations**: Hover effects, transitions
- **Icon-based UI**: Menggunakan Lucide icons
- **Responsive Design**: Mobile-friendly dengan sidebar yang bisa dibuka/tutup
- **Color Palette**: 
  - Primary: Blue (#2563eb)
  - Success: Green (Cash)
  - Info: Blue (Transfer)
  - Danger: Red (Pengeluaran)
  - Background: White & Light Gray

## 🚀 Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Icons**: Lucide React

## 📦 Instalasi

1. **Install dependencies**
```bash
npm install
```

2. **Setup environment variables**
Buat file `.env.local` di root folder:
```env
NEXT_PUBLIC_SUPABASE_URL=https://ftyllyybmngxvuialcke.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

3. **Update Database Schema**
Jalankan SQL di Supabase SQL Editor (file: `database-update.sql`):
```sql
ALTER TABLE monthly_payments 
ADD COLUMN IF NOT EXISTS payment_method TEXT CHECK (payment_method IN ('cash', 'transfer'));

CREATE INDEX IF NOT EXISTS idx_payment_method ON monthly_payments(payment_method);
```

4. **Jalankan development server**
```bash
npm run dev
```

5. **Buka browser**
```
http://localhost:3000
```

## 👤 Akun Demo

### Bendahara (Full Access)
- Email: `anita@karangtaruna.com` / Password: `anita123`
- Email: `astika@karangtaruna.com` / Password: `astika123`

### Anggota (Read-Only)
- Email: `anggota@karangtaruna.com` / Password: `anggota123`

## 🗄️ Database Schema

### Tables
1. **members** - Data anggota Karang Taruna
2. **profiles** - User profiles dengan role
3. **monthly_payments** - Record pembayaran kas bulanan (+ `payment_method` column)
4. **transactions** - Catatan pemasukan & pengeluaran
5. **meetings** - Data acara kumpulan rutin

### Row Level Security (RLS)
- Semua tabel sudah diproteksi dengan RLS
- Bendahara: Full CRUD access
- Anggota: Read-only access

## 📱 Fitur per Role

### Bendahara
✅ Lihat semua data  
✅ Edit saldo cash & m-banking  
✅ Pilih metode pembayaran (cash/transfer)  
✅ Atur range bulan custom  
✅ Tambah anggota baru (auto alfabetis)  
✅ Hapus anggota  
✅ Tambah transaksi  
✅ Hapus transaksi  
✅ Tambah acara kumpulan  
✅ Hapus acara kumpulan  
✅ Lihat laporan keuangan lengkap  
✅ Export laporan  

### Anggota
✅ Lihat data anggota  
✅ Lihat status pembayaran  
✅ Lihat transaksi kas  
✅ Lihat acara kumpulan  
✅ Lihat laporan keuangan  
❌ Tidak bisa edit/hapus apapun  

## 🎯 Halaman Aplikasi

1. **Login** (`/login`) - Autentikasi user
2. **Data Anggota** (`/dashboard/members`) - Kelola anggota & pembayaran kas
3. **Pemasukan & Pengeluaran** (`/dashboard/transactions`) - Transaksi keuangan
4. **Acara Kumpulan** (`/dashboard/meetings`) - Event management
5. **Laporan Keuangan** (`/dashboard/reports`) - Laporan & analisis (NEW!)

## 🚀 Deploy ke Vercel

1. **Push code ke GitHub**
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo>
git push -u origin main
```

2. **Deploy di Vercel**
- Login ke [vercel.com](https://vercel.com)
- Klik "New Project"
- Import dari GitHub repository
- Tambahkan Environment Variables (dari `.env.local`)
- Deploy!

3. **Domain Custom** (Opsional)
- Di Vercel dashboard → Settings → Domains
- Tambahkan custom domain jika punya

## 🆕 Update Terbaru

### v2.0 - Fitur Laporan & Metode Pembayaran
- ✅ Halaman Laporan Keuangan lengkap
- ✅ Daftar anggota dengan pembayaran belum lunas
- ✅ Pilihan metode pembayaran (Cash/Transfer)
- ✅ 2 Saldo terpisah (Cash & M-Banking)
- ✅ Range bulan custom
- ✅ Urutan alfabetis otomatis
- ✅ Export laporan JSON

## 📝 Lisensi

© 2025 Karang Taruna. All rights reserved.

---

**Dibuat dengan ❤️ menggunakan Next.js & Supabase**
