CREATE UNIQUE INDEX IF NOT EXISTS app_user_email_normalized_unique ON app_user (lower(btrim(email)));
