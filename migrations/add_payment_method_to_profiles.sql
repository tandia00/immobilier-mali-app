-- Add payment_method column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS payment_method text;

-- Add comment to explain the column values
COMMENT ON COLUMN profiles.payment_method IS 'Preferred payment method (orange_money, moov_money, malitel_money, wave, card, cash)';
