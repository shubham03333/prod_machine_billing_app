-- Read-only admin: can view the admin dashboard and export CSVs, but cannot edit.
-- PIN: 9823  role: readonly_admin

USE machines_db;

INSERT INTO User (name, role, pin)
SELECT 'Admin Viewer', 'readonly_admin', '9823'
WHERE NOT EXISTS (SELECT 1 FROM User WHERE pin = '9823');

UPDATE User
SET role = 'readonly_admin', name = 'Admin Viewer'
WHERE pin = '9823';

SELECT id, name, role, pin FROM User WHERE pin = '9823' OR role = 'readonly_admin';
