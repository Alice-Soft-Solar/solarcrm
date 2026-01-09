/**
 * Role constants for the application
 * Centralized to avoid hard-coded strings and ensure consistency
 */

export const ROLES = {
  SALES: 'Sales',
  SALES_LEAD: 'salesLead', // Database value is camelCase: 'salesLead'
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super Admin',
  INVENTORY: 'Inventory',
  BACK_OFFICE: 'BackOffice',
} as const;

export type RoleName = typeof ROLES[keyof typeof ROLES];

/**
 * Array of all allowed roles for validation
 */
export const ALLOWED_ROLES: readonly RoleName[] = [
  ROLES.SALES,
  ROLES.SALES_LEAD,
  ROLES.ADMIN,
  ROLES.SUPER_ADMIN,
  ROLES.INVENTORY,
  ROLES.BACK_OFFICE,
];

/**
 * Check if a role is an admin role (Admin or Super Admin)
 */
export function isAdminRole(roleName: string | null | undefined): boolean {
  return roleName === ROLES.ADMIN || roleName === ROLES.SUPER_ADMIN;
}

/**
 * Check if a role has inventory permissions
 */
export function isInventoryRole(roleName: string | null | undefined): boolean {
  return roleName === ROLES.INVENTORY;
}

/**
 * Check if a role has sales permissions
 */
export function isSalesRole(roleName: string | null | undefined): boolean {
  return roleName === ROLES.SALES;
}

/**
 * Check if a role is Sales Lead
 */
export function isSalesLeadRole(roleName: string | null | undefined): boolean {
  return roleName === ROLES.SALES_LEAD;
}

/**
 * Check if a role is BackOffice
 */
export function isBackOfficeRole(roleName: string | null | undefined): boolean {
  return roleName === ROLES.BACK_OFFICE;
}


