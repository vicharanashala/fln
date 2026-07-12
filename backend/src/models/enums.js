const ROLES = Object.freeze({
  SUPERADMIN: "superadmin",
  ADMIN: "admin",
  DISTRICT_ADMIN: "district_admin",
  BLOCK_ADMIN: "block_admin",
  SCHOOL: "school",
  TEACHER: "teacher",
  VOLUNTEER: "volunteer",
});

const ALL_ROLES = Object.values(ROLES);

module.exports = { ROLES, ALL_ROLES };