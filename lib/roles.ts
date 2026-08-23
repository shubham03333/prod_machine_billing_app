export const ROLE_ADMIN = "admin";
export const ROLE_READONLY_ADMIN = "readonly_admin";
export const ROLE_OPERATOR = "operator";
export const ROLE_FIELD_OPERATOR = "field_operator";
export const LEGACY_READONLY_PIN = "9823";

export type RoleUser = {
  role?: string | null;
  pin?: string | null;
} | null;

export function isReadOnlyAdmin(user: RoleUser): boolean {
  if (!user) return false;
  return user.role === ROLE_READONLY_ADMIN || user.pin === LEGACY_READONLY_PIN;
}

export function canAccessAdminDashboard(user: RoleUser): boolean {
  if (!user) return false;
  const role = (user.role || "").trim().toLowerCase();
  if (role === ROLE_OPERATOR || role === ROLE_FIELD_OPERATOR) return false;
  if (user.pin === LEGACY_READONLY_PIN) return true;
  return (
    role === ROLE_ADMIN ||
    role === ROLE_READONLY_ADMIN ||
    role.includes("readonly")
  );
}

export function canEditAdminData(user: RoleUser): boolean {
  return canAccessAdminDashboard(user) && !isReadOnlyAdmin(user);
}
