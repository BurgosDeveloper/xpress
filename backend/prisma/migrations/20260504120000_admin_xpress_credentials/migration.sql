WITH candidates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      ORDER BY
        CASE
          WHEN email = 'admin@xpress.com' THEN 0
          WHEN role = 'ADMIN' THEN 1
          WHEN username = 'admin' THEN 2
          ELSE 3
        END,
        "createdAt" ASC
    ) AS rn
  FROM "User"
  WHERE role = 'ADMIN'
     OR username = 'admin'
     OR email IN ('admin@xpress.local', 'admin@xpress.com')
), demoted AS (
  UPDATE "User" AS u
  SET
    username = CASE WHEN u.username = 'admin' THEN NULL ELSE u.username END,
    email = CASE
      WHEN u.email IN ('admin@xpress.local', 'admin@xpress.com') THEN CONCAT('legacy+', SUBSTRING(u.id, 1, 8), '@xpress.local')
      ELSE u.email
    END,
    "updatedAt" = NOW()
  FROM candidates AS c
  WHERE u.id = c.id
    AND c.rn > 1
    AND (u.username = 'admin' OR u.email IN ('admin@xpress.local', 'admin@xpress.com'))
  RETURNING u.id
), updated AS (
  UPDATE "User" AS u
  SET
    username = 'admin',
    email = 'admin@xpress.com',
    "passwordHash" = '$2a$10$gotTdvGZWOn0FG52//l18OH6SviQF7cWCwAXXIFYZkSEROnKhiJLG',
    role = 'ADMIN',
    "isActive" = TRUE,
    "updatedAt" = NOW()
  FROM candidates AS c
  WHERE u.id = c.id
    AND c.rn = 1
  RETURNING u.id
)
INSERT INTO "User" (id, username, email, "passwordHash", role, "isActive", "createdAt", "updatedAt")
SELECT
  'xpress_admin_user',
  'admin',
  'admin@xpress.com',
  '$2a$10$gotTdvGZWOn0FG52//l18OH6SviQF7cWCwAXXIFYZkSEROnKhiJLG',
  'ADMIN',
  TRUE,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM updated);