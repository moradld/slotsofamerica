
-- Chime accounts
INSERT INTO public.payment_gateway_accounts (gateway_id, account_name, account_number, deep_link, priority_order, is_active)
VALUES
  ('0e6cddd4-e635-4fc7-8df9-d5641e2c52df', 'Chime Account 1', '$Amanda-Guerrero-1', 'chime://', 1, true),
  ('0e6cddd4-e635-4fc7-8df9-d5641e2c52df', 'Chime Account 2', '$ChimeUser2', 'chime://', 2, true),
  ('0e6cddd4-e635-4fc7-8df9-d5641e2c52df', 'Chime Account 3', '$ChimeUser3', 'chime://', 3, true);

-- PayPal accounts
INSERT INTO public.payment_gateway_accounts (gateway_id, account_name, account_number, deep_link, priority_order, is_active)
VALUES
  ('d8d8312b-e063-4680-8be5-5984835221ae', 'PayPal Primary', 'kaziagencygroup@gmail.com', 'paypal://send?recipient=kaziagencygroup@gmail.com', 1, true),
  ('d8d8312b-e063-4680-8be5-5984835221ae', 'PayPal Backup', 'paypal-backup@gmail.com', 'paypal://send?recipient=paypal-backup@gmail.com', 2, true);

-- USDC accounts (no deep links for crypto)
INSERT INTO public.payment_gateway_accounts (gateway_id, account_name, account_number, deep_link, priority_order, is_active)
VALUES
  ('10cec206-4598-43ec-93bb-bb76cee65ee7', 'USDC Wallet 1', '0x1E287E35F8fD9abc66f913F453979B369ec5926b', NULL, 1, true),
  ('10cec206-4598-43ec-93bb-bb76cee65ee7', 'USDC Wallet 2', '0xABCD1234567890EFGH', NULL, 2, true);

-- Zelle accounts
INSERT INTO public.payment_gateway_accounts (gateway_id, account_name, account_number, deep_link, priority_order, is_active)
VALUES
  ('64811273-79a2-4aa8-83d1-adf3689d6caf', 'Zelle Primary', 'Adarsh.kazi87@gmail.com', 'zelle://', 1, true),
  ('64811273-79a2-4aa8-83d1-adf3689d6caf', 'Zelle Backup', 'zelle-backup@gmail.com', 'zelle://', 2, true),
  ('64811273-79a2-4aa8-83d1-adf3689d6caf', 'Zelle Reserve', 'zelle-reserve@gmail.com', 'zelle://', 3, true);
