/** UI categories only: shared by the sidebar, page header and Home shortcuts.
 * Keep document/print styles independent of these colors. */
export const workspaceCategories = {
  home: "home", dashboard: "documents", templates: "documents", editor: "documents",
  register: "documents", tasks: "tasks", office: "tasks", projects: "projects",
  inventory: "inventory", reports: "reports", budget: "reports",
  calendar: "calendar", bookings: "calendar", laws: "reference",
  guide: "reference", settings: "reference",
} as const;
