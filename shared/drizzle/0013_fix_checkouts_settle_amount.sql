-- Fix Financial Precision Loss in checkouts table
-- Issue: settle_amount column uses REAL (floating point) which causes precision loss
-- Solution: Change to TEXT to preserve full precision for crypto amounts
-- Example: 0.00000001 stored as 0.0 with REAL, but preserved as "0.00000001" with TEXT

-- Alter the settle_amount column from REAL to TEXT
ALTER TABLE checkouts 
ALTER COLUMN settle_amount TYPE TEXT;

-- Note: This migration is safe because:
-- 1. TEXT can store any numeric string representation without precision loss
-- 2. Application code already handles settle_amount as string in most cases
-- 3. No data loss occurs during type conversion (PostgreSQL converts REAL to TEXT accurately)

-- Verification query (run after migration):
-- SELECT id, settle_amount FROM checkouts WHERE settle_amount IN ('0.00000001', '123456.78901234');
-- Should return the exact values without rounding

