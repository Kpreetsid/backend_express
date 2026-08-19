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
    master_library: { level: 0, view: true }
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
    master_library: { level: 0, view: true }
  };

  private static cloneRoleMenu(roleMenu: RoleMenu): RoleMenu {
    return JSON.parse(JSON.stringify(roleMenu));
  }

  private static roleMenuMatchesTemplate(roleMenu: unknown, template: RoleMenu): boolean {
    if (!roleMenu || typeof roleMenu !== "object" || Array.isArray(roleMenu)) {
      return false;
    }

    const candidate = roleMenu as RoleMenu;
    if (Object.keys(candidate).length !== Object.keys(template).length) {
      return false;
    }

    return Object.entries(template).every(([key, expectedPermission]) => {
      const actualPermission = candidate[key];
      if (!actualPermission || typeof actualPermission !== "object" || Array.isArray(actualPermission)) {
        return false;
      }

      const expectedKeys = Object.keys(expectedPermission).sort();
      const actualKeys = Object.keys(actualPermission).sort();
      return expectedKeys.length === actualKeys.length
        && expectedKeys.every((field, index) => field === actualKeys[index])
        && expectedKeys.every((field) => actualPermission[field as keyof Permission] === expectedPermission[field as keyof Permission]);
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
