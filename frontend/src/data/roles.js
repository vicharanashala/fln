export const ROLES = [
  { key: "superadmin", label: "Super Admin", email: "superadmin@fln.org" },
];

export function dashboardPath(role) {
  switch (role) {
    case "superadmin":
      return "/superadmin";
    default:
      return "/";
  }
}