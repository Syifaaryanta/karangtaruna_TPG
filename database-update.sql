-- ============================================
-- DATABASE UPDATE SCRIPT
-- Karang Taruna Kas Management
-- ============================================

-- 1. Add payment_method column to monthly_payments table
ALTER TABLE monthly_payments 
ADD COLUMN IF NOT EXISTS payment_method TEXT CHECK (payment_method IN ('cash', 'transfer'));

-- 2. Update existing payments to NULL (unknown method)
-- Bendahara can later edit them via the UI

-- 3. Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_payment_method ON monthly_payments(payment_method);

-- 4. Add location column to meetings table
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS location TEXT;

-- 5. Add payment_method column to transactions table
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS payment_method TEXT CHECK (payment_method IN ('cash', 'transfer'));

-- 6. Create index for transactions payment_method
CREATE INDEX IF NOT EXISTS idx_transactions_payment_method ON transactions(payment_method);

-- 7. Add balance columns to members table
ALTER TABLE members
ADD COLUMN IF NOT EXISTS balance_cash INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS balance_bank INTEGER DEFAULT 0;

-- ============================================
-- HOW TO RUN THIS SCRIPT:
-- 1. Login to Supabase Dashboard
-- 2. Go to SQL Editor
-- 3. Copy and paste this script
-- 4. Click "Run" button
-- ============================================
