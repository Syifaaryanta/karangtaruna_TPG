-- ============================================
-- INISIALISASI BALANCE - JALANKAN INI DULU!
-- ============================================

-- 1. Tambah kolom balance di tabel members (jika belum ada)
ALTER TABLE members 
ADD COLUMN IF NOT EXISTS balance_cash INTEGER DEFAULT 0;

ALTER TABLE members 
ADD COLUMN IF NOT EXISTS balance_bank INTEGER DEFAULT 0;

-- 2. Set balance untuk semua member yang sudah ada
UPDATE members 
SET balance_cash = COALESCE(balance_cash, 0),
    balance_bank = COALESCE(balance_bank, 0);

-- 3. Tambah payment_method di transactions (jika belum ada)
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- 4. Tambah payment_method di monthly_payments (jika belum ada)
ALTER TABLE monthly_payments
ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- 5. Cek hasilnya - Harus ada kolom balance_cash dan balance_bank
SELECT id, name, balance_cash, balance_bank FROM members LIMIT 5;

-- SELESAI! Sekarang coba test di aplikasi.
