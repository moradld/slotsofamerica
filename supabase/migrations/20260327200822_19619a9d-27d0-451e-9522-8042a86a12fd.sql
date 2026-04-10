CREATE OR REPLACE FUNCTION public.attach_transaction_proof(_transaction_id uuid, _proof_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id UUID;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.transactions
  SET deposit_proof_url = _proof_url
  WHERE id = _transaction_id
    AND user_id = _user_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found or not yours';
  END IF;
END;
$$;