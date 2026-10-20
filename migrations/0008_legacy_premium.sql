INSERT INTO premium_grants(id,"userId","grantedBy","grantedAt","expiresAt",note)
SELECT 'legacy-premium-'||"userId","userId",NULL,now(),"periodEnd",'Acces manual existent înainte de upgrade; fără abonament la procesator. Nu reprezintă venit.'
FROM subscriptions WHERE status='active' AND "subscriptionId" IS NULL AND "periodEnd">now()
ON CONFLICT(id) DO NOTHING;
