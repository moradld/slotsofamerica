import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useVerificationCheck() {
  const { user } = useAuth();
  const [isVerified, setIsVerified] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase
      .from("profiles")
      .select("email_verified, phone_verified")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setIsVerified(!!(data as any).email_verified || !!data.phone_verified);
        }
        setLoading(false);
      });
  }, [user]);

  return { isVerified, loading };
}
