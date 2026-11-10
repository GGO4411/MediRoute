USE mediroute;

-- Inspect the application role-to-permission matrix.
SELECT u.user_id,u.email,u.role,rp.permission_code,p.description
FROM users u JOIN role_permissions rp ON rp.role_code=u.role
JOIN permissions p ON p.permission_code=rp.permission_code
ORDER BY u.role,u.email,rp.permission_code;

-- Example authorization check for the seeded administrator.
SET @demo_email='admin@mediroute.local';
SET @required_permission='ROUTING_MANAGE';
SELECT u.email,u.role,
 EXISTS(SELECT 1 FROM role_permissions rp
        WHERE rp.role_code=u.role AND rp.permission_code=@required_permission) AS permission_granted
FROM users u WHERE u.email=@demo_email;
