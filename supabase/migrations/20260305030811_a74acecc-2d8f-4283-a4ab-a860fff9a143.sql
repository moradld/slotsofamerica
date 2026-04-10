UPDATE game_unlock_requests gur
SET username = p.username
FROM profiles p
WHERE p.id = gur.user_id AND p.username IS NOT NULL AND gur.username = 'unknown';