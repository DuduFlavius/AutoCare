INSERT INTO support_chat_messages(id,"threadId","authorId","authorName","authorRole",body,"createdAt")
SELECT 'imported-'||m.id,m."threadId",m."authorId",u.name,
CASE WHEN m."authorRole" IN ('user','assistant','admin','founder','system') THEN m."authorRole" ELSE 'user' END,m.message,m."createdAt"
FROM support_messages m JOIN app_user u ON u.id=m."authorId"
JOIN support_threads t ON t.id=m."threadId"
ON CONFLICT(id) DO NOTHING;
