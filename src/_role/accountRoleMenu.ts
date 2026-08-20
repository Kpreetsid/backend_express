import { ExperienceProfile, normalizeExperienceProfile } from "./experienceProfile";

export type Permission = {
  level: number;
  parent?: string;
  view: boolean;
  add?: boolean;
  edit?: boolean;
  delete?: boolean;
  import?: boolean;
  export?: boolean;
};

export type RoleMenu = Record<string, Permission>;

export const ACCOUNT_ROLE_MENU_SCHEMA_VERSION = 2;

export class RoleManager {
  private static readonly STANDARD_ACCOUNT_ROLES: RoleMenu = {
    master_asset: { level: 0, view: true },
    master_location: { level: 0, view: true },
    master_dashboard: { level: 0, view: true },
    master_report: { level: 0, view: true },
    master_alarm: { level: 0, view: true },
    master_work_order: { level: 0, view: true },
    master_work_request: { level: 0, view: true },
    master_preventive: { level: 0, view: true },
    master_posts: { level: 0, view: true },
    master_inventory: { level: 0, view: true },
    master_devices: { level: 0, view: true },
    master_admin_panel: { level: 0, view: true },
    master_inspections: { level: 0, view: true },
    master_library: { level: 0, view: true },
    oem_report: { level: 1, parent: "master_report", view: false },
    pump_asset_health: { level: 1, parent: "master_asset", view: false },
    pdm_location_filter: { level: 1, parent: "master_dashboard", view: true },
    users: { level: 1, parent: "master_admin_panel", view: true },
    permission: { level: 1, parent: "master_admin_panel", view: true },
    asset_mail: { level: 1, parent: "master_admin_panel", view: true }
  };

  private static readonly OEM_ROLES: RoleMenu = {
    master_asset: { level: 0, view: true },
    master_location: { level: 0, view: true },
    master_dashboard: { level: 0, view: true },
    master_report: { level: 0, view: true },
    master_alarm: { level: 0, view: true },
    master_work_order: { level: 0, view: true },
    master_work_request: { level: 0, view: true },
    master_preventive: { level: 0, view: true },
    master_posts: { level: 0, view: true },
    master_inventory: { level: 0, view: true },
    master_devices: { level: 0, view: true },
    master_admin_panel: { level: 0, view: false },
    master_inspections: { level: 0, view: true },
    master_library: { level: 0, view: true },
    oem_report: { level: 1, parent: "master_report", view: true },
    pump_asset_health: { level: 1, parent: "master_asset", view: true },
    pdm_location_filter: { level: 1, parent: "master_dashboard", view: false },
    users: { level: 1, parent: "master_admin_panel", view: false },
    permission: { level: 1, parent: "master_admin_panel", view: false },
    asset_mail: { level: 1, parent: "master_admin_panel", view: false }
  };

  private static cloneRoleMenu(roleMenu: RoleMenu): RoleMenu {
    return JSON.parse(JSON.stringify(roleMenu));
  }

  private static roleMenuMatchesTemplate(roleMenu: unknown, template: RoleMenu): boolean {
    if (!roleMenu || typeof roleMenu !== "object" || Array.isArray(roleMenu)) {
      return false;
    }

    const candidate = roleMenu as Record<string, any>;
    const templateKeys = Object.keys(template);
    const candidateKeys = Object.keys(candidate);

    if (candidateKeys.length === 0) {
      return false;
    }

    return templateKeys.every((key) => {
      const expected = template[key];
      const actual = candidate[key];
      if (actual === undefined) return false;

      if (typeof actual === "boolean") {
        return actual === expected.view;
      }
      if (typeof actual === "object" && actual !== null) {
        return actual.view === expected.view;
      }
      return false;
    });
  }

  public static detectRoleMenuProfile(roleMenu: unknown): ExperienceProfile | null {
    for (const profile of ["standard_account", "oem"] as const) {
      if (this.roleMenuMatchesTemplate(roleMenu, this.getRoleMenu(profile))) {
        return profile;
      }
    }
    return null;
  }

  public static getRoleMenu(role: string = "standard_account"): RoleMenu {
    switch (normalizeExperienceProfile(role)) {
      case "standard_account": {
        return this.cloneRoleMenu(this.STANDARD_ACCOUNT_ROLES);
      }
      case "oem": {
        return this.cloneRoleMenu(this.OEM_ROLES);
      }
    }
  }
}
