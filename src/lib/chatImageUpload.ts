import { supabase } from "@/integrations/supabase/client";

const MAX_SIZE = 1 * 1024 * 1024; // 1MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg"];

export async function uploadChatImage(file: File, userId: string): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Only PNG and JPG images are allowed");
  }
  if (file.size > MAX_SIZE) {
    throw new Error("Image must be under 1MB");
  }

  const ext = file.name.split(".").pop() || "png";
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("chat-images")
    .upload(path, file, { contentType: file.type });

  if (error) throw error;

  const { data } = supabase.storage
    .from("chat-images")
    .getPublicUrl(path);

  return data.publicUrl;
}
