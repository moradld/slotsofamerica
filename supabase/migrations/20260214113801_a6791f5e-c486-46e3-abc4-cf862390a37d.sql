
-- Add balance column to profiles
ALTER TABLE public.profiles ADD COLUMN balance NUMERIC NOT NULL DEFAULT 0;

-- Create a server-side function for admin to approve/reject transactions
CREATE OR REPLACE FUNCTION public.process_transaction(_transaction_id UUID, _action TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _txn RECORD;
  _admin_id UUID;
BEGIN
  _admin_id := auth.uid();
  
  -- Verify caller is admin
  IF NOT has_role(_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get the transaction
  SELECT * INTO _txn FROM public.transactions WHERE id = _transaction_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found or already processed';
  END IF;

  IF _action = 'approved' THEN
    -- Update transaction status
    UPDATE public.transactions
    SET status = 'approved', reviewed_by = _admin_id, reviewed_at = now()
    WHERE id = _transaction_id;

    -- Update wallet balance based on type
    IF _txn.type IN ('deposit') THEN
      UPDATE public.profiles SET balance = balance + _txn.amount WHERE id = _txn.user_id;
    ELSIF _txn.type IN ('withdraw', 'redeem', 'transfer') THEN
      UPDATE public.profiles SET balance = balance - _txn.amount WHERE id = _txn.user_id;
    END IF;

    -- Notify user
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      _txn.user_id,
      'Transaction Approved',
      'Your ' || _txn.type || ' of $' || _txn.amount::TEXT || ' has been approved.',
      'success'
    );

  ELSIF _action = 'rejected' THEN
    UPDATE public.transactions
    SET status = 'rejected', reviewed_by = _admin_id, reviewed_at = now()
    WHERE id = _transaction_id;

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      _txn.user_id,
      'Transaction Rejected',
      'Your ' || _txn.type || ' of $' || _txn.amount::TEXT || ' has been rejected.',
      'warning'
    );
  ELSE
    RAISE EXCEPTION 'Invalid action. Use approved or rejected.';
  END IF;
END;
$$;
