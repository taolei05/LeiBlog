INSERT INTO auth_provider_settings (provider, display_name, enabled, scopes)
VALUES ('google', 'Google', false, ARRAY['openid', 'profile', 'email'])
ON CONFLICT (provider) DO NOTHING;
