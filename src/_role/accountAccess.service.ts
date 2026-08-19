import { IAccount } from "../models/account.model";
import { Permission, RoleManager, RoleMenu } from "./accountRoleMenu";
import { RoleManager as UserRoleManager } from "./newUserRoles";
import { normalizeExperienceProfile } from "./experienceProfile";

export type AccountAction = "view" | "add" | "edit" | "delete" | "import" | "export";
type PlatformControl = Record<string, Record<string, boolean>>;
type PlatformActionRule = { menuKey: string | string[]; action: AccountAction };

const ACCOUNT_ACTIONS: AccountAction[] = ["view", "add", "edit", "delete", "import", "export"];
const ACCOUNT_ADDITIVE_FEATURE_KEYS = [
  "master_alarm",
  "alarm_overview",
  "alarm_configuration",
  "master_library",
  "work_order_templates",
  "procedures",
  "asset_alarms",
  "ai_chatbot",
  "oem_report",
  "pump_asset_health",
  "pdm_location_filter"
];

const PLATFORM_ACTION_RULES: Record<string, Record<string, PlatformActionRule>> = {
  asset: {
    add_asset: { menuKey: "asset", action: "add" },
    delete_asset: { menuKey: "asset", action: "delete" },
    add_child_asset: { menuKey: "child_asset", action: "add" },
    edit_asset: { menuKey: "asset", action: "edit" },
    create_report: { menuKey: "report_asset", action: "add" },
    delete_report: { menuKey: "report_asset", action: "delete" },
    download_report: { menuKey: "report_asset", action: "export" },
    edit_report: { menuKey: "report_asset", action: "edit" },
    config_alarm: { menuKey: "config_alarm", action: "edit" },
    add_observation: { menuKey: "observation", action: "add" },
    create_endpoint: { menuKey: "endpoint", action: "add" },
    edit_endpoint: { menuKey: "endpoint", action: "edit" },
    delete_end_point: { menuKey: "endpoint", action: "delete" },
    attach_sensor: { menuKey: "attach_sensor", action: "add" },
    update_config: { menuKey: "config", action: "edit" }
  },
  location: {
    add_location: { menuKey: "location", action: "add" },
    delete_location: { menuKey: "location", action: "delete" },
    add_child_location: { menuKey: "child_location", action: "add" },
    edit_location: { menuKey: "location", action: "edit" },
    create_report: { menuKey: "location_report", action: "add" },
    delete_report: { menuKey: "location_report", action: "delete" },
    download_report: { menuKey: "location_report", action: "export" }
  },
  workOrder: {
    create_work_order: { menuKey: "work_order", action: "add" },
    edit_work_order: { menuKey: "work_order", action: "edit" },
    delete_work_order: { menuKey: "work_order", action: "delete" },
    update_work_order_status: { menuKey: "work_order_status", action: "edit" },
    add_comment_work_order: { menuKey: "comment_work_order", action: "add" },
    add_task_work_order: { menuKey: "inspections", action: "add" },
    update_parts_work_order: { menuKey: "parts_work_order", action: "edit" }
  },
  floorMap: {
    create_kpi: { menuKey: ["floor_map", "location_floor_map"], action: "add" },
    view_floor_map: { menuKey: ["floor_map", "location_floor_map"], action: "view" },
    delete_kpi: { menuKey: ["floor_map", "location_floor_map"], action: "delete" },
    upload_floor_map: { menuKey: ["floor_map", "location_floor_map"], action: "edit" }
  }
};

const PLATFORM_MODULE_RULES: Record<string, string> = {
  preventive: "preventive",
  form: "form",
  form_category: "form_category",
  work_request: "work_request",
  posts: "posts",
  inventory: "inventory",
  gateways: "gateways",
  peripheral_sensors: "peripheral_sensors",
  users: "users",
  permission: "permission",
  asset_mail: "asset_mail"
};

const PARENT_PLATFORM_MODULE_RULES: Record<string, string> = {
  admin_panel: "master_admin_panel",
  devices: "master_devices"
};

const PLATFORM_MODULE_VIEW_RULES: Record<string, string | string[]> = {
  asset: "asset",
  location: "location",
  workOrder: "work_order",
  floorMap: ["floor_map", "location_floor_map"],
  preventive: "preventive",
  form: "form",
  form_category: "form_category",
  work_request: "work_request",
  posts: "posts",
  inventory: "inventory",
  devices: "master_devices",
  gateways: "gateways",
  peripheral_sensors: "peripheral_sensors",
  admin_panel: "master_admin_panel",
  users: "users",
  permission: "permission",
  asset_mail: "asset_mail"
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value || {}));

const isRecord = (value: unknown): value is Record<string, any> => {
  return !!value && typeof value === "object" && !Array.isArray(value);
};

class AccountAccessService {
  isKnownFeature(menuKey: string): boolean {
    if (!menuKey) return false;
    return !!RoleManager.getRoleMenu("standard_account")[menuKey]
      || !!UserRoleManager.getAdminRoleMenu()[menuKey]
      || ACCOUNT_ADDITIVE_FEATURE_KEYS.includes(menuKey)
      || !!PLATFORM_MODULE_RULES[menuKey]
      || !!PARENT_PLATFORM_MODULE_RULES[menuKey]
      || !!PLATFORM_MODULE_VIEW_RULES[menuKey];
  }

  isKnownAction(action: string): action is AccountAction {
    return ACCOUNT_ACTIONS.includes(action as AccountAction);
  }

  isEffectivePermissionEnabled(roleMenu: RoleMenu, menuKey: string, action: AccountAction = "view"): boolean {
    const permission = roleMenu?.[menuKey];
    if (!permission || permission.view !== true) {
      return false;
    }

    if (permission.parent && roleMenu?.[permission.parent]?.view !== true) {
      return false;
    }

    return action === "view" ? true : permission[action] === true;
  }

  getAccountRoleMenu(account: IAccount | any): RoleMenu {
    const accountObject = typeof account?.toObject === "function" ? account.toObject() : account;
    const experienceProfile = normalizeExperienceProfile(accountObject?.experience_profile);
    const defaults = RoleManager.getRoleMenu(experienceProfile);
    const storedMenu = isRecord(accountObject?.account_role_menu) ? accountObject.account_role_menu : {};
    const storedProfile = accountObject?.account_role_menu_profile
      ? normalizeExperienceProfile(accountObject.account_role_menu_profile)
      : RoleManager.detectRoleMenuProfile(storedMenu);
    if (storedProfile && storedProfile !== experienceProfile) {
      return defaults;
    }
    const merged = clone(defaults);

    for (const [key, value] of Object.entries(storedMenu)) {
      if (!isRecord(value)) {
        continue;
      }
      merged[key] = {
        ...(merged[key] || {}),
        ...value
      } as Permission;
    }

    return merged;
  }

  getEffectivePermissions(userRoleData: any, account: IAccount | any): { platformControl: PlatformControl; roleMenu: RoleMenu } {
    const accountRoleMenu = this.getAccountRoleMenu(account);
    return {
      platformControl: this.applyPlatformControlCap(userRoleData?.data || {}, accountRoleMenu),
      roleMenu: this.applyRoleMenuCap(userRoleData?.roleMenu || {}, accountRoleMenu)
    };
  }

  applyRoleMenuCap(userRoleMenu: any, accountRoleMenu: RoleMenu): RoleMenu {
    const effectiveRoleMenu = clone(userRoleMenu);

    for (const menuKey of ACCOUNT_ADDITIVE_FEATURE_KEYS) {
      if (!effectiveRoleMenu[menuKey] && accountRoleMenu[menuKey]) {
        effectiveRoleMenu[menuKey] = this.createLegacyFeaturePermission(accountRoleMenu[menuKey]);
      }
    }

    for (const [menuKey, permission] of Object.entries(effectiveRoleMenu)) {
      if (!isRecord(permission) || !accountRoleMenu[menuKey]) {
        continue;
      }

      for (const action of ACCOUNT_ACTIONS) {
        if (typeof permission[action] === "boolean") {
          permission[action] = permission[action] && this.isAccountPermissionEnabled(accountRoleMenu, menuKey, action);
        }
      }
    }

    return effectiveRoleMenu;
  }

  private createLegacyFeaturePermission(accountPermission: Permission): Permission {
    return {
      level: accountPermission.level,
      ...(accountPermission.parent ? { parent: accountPermission.parent } : {}),
      view: accountPermission.view === true,
      ...(accountPermission.level === 1
        ? { add: false, edit: false, delete: false, import: false, export: false }
        : {})
    };
  }

  applyPlatformControlCap(platformControl: any, accountRoleMenu: RoleMenu): PlatformControl {
    const effectivePlatformControl = clone(platformControl);

    for (const [moduleName, actions] of Object.entries(effectivePlatformControl)) {
      if (!isRecord(actions)) {
        continue;
      }

      for (const [actionName, allowed] of Object.entries(actions)) {
        if (typeof allowed !== "boolean") {
          continue;
        }
        actions[actionName] = allowed && this.isPlatformActionAllowed(accountRoleMenu, moduleName, actionName);
      }
    }

    return effectivePlatformControl;
  }

  filterConfigurablePlatformControl(platformControl: any, accountRoleMenu: RoleMenu): PlatformControl {
    const filtered: PlatformControl = {};
    if (!isRecord(platformControl)) {
      return filtered;
    }

    for (const [moduleName, actions] of Object.entries(platformControl)) {
      if (!isRecord(actions) || !this.isPlatformModuleVisible(accountRoleMenu, moduleName)) {
        continue;
      }
      filtered[moduleName] = this.applyPlatformControlCap({ [moduleName]: actions }, accountRoleMenu)[moduleName];
    }

    return filtered;
  }

  mergeConfigurablePlatformControl(existingControl: any, submittedControl: any, accountRoleMenu: RoleMenu): PlatformControl {
    const merged = clone(isRecord(existingControl) ? existingControl : {});
    if (!isRecord(submittedControl)) {
      return merged;
    }

    for (const [moduleName, existingActions] of Object.entries(merged)) {
      const submittedActions = submittedControl[moduleName];
      if (
        !isRecord(existingActions)
        || !isRecord(submittedActions)
        || !this.isPlatformModuleVisible(accountRoleMenu, moduleName)
      ) {
        continue;
      }

      for (const actionName of Object.keys(existingActions)) {
        if (
          typeof submittedActions[actionName] === "boolean"
          && this.isPlatformActionAllowed(accountRoleMenu, moduleName, actionName)
        ) {
          existingActions[actionName] = submittedActions[actionName];
        }
      }
    }

    return merged;
  }

  toConfigurableRole(role: any, accountRoleMenu: RoleMenu): any {
    const roleObject = typeof role?.toObject === "function" ? role.toObject() : clone(role);
    return {
      ...roleObject,
      data: this.filterConfigurablePlatformControl(roleObject?.data, accountRoleMenu),
      roleMenu: this.applyRoleMenuCap(roleObject?.roleMenu || {}, accountRoleMenu)
    };
  }

  isPlatformActionAllowed(accountRoleMenu: RoleMenu, moduleName: string, actionName: string): boolean {
    const mappedRule = PLATFORM_ACTION_RULES[moduleName]?.[actionName];
    if (mappedRule) {
      const keys = Array.isArray(mappedRule.menuKey) ? mappedRule.menuKey : [mappedRule.menuKey];
      return keys.some(menuKey => this.isAccountPermissionEnabled(accountRoleMenu, menuKey, mappedRule.action));
    }

    const action = this.toAccountAction(actionName);
    const directMenuKey = PLATFORM_MODULE_RULES[moduleName] || (accountRoleMenu[moduleName] ? moduleName : "");
    if (directMenuKey && action) {
      return this.isAccountPermissionEnabled(accountRoleMenu, directMenuKey, action);
    }

    const parentMenuKey = PARENT_PLATFORM_MODULE_RULES[moduleName];
    if (parentMenuKey) {
      return this.isAccountPermissionEnabled(accountRoleMenu, parentMenuKey, "view");
    }

    return true;
  }

  isAccountPermissionEnabled(accountRoleMenu: RoleMenu, menuKey: string, action: AccountAction): boolean {
    const accountPermission = accountRoleMenu[menuKey];
    if (!accountPermission) {
      return true;
    }

    if (accountPermission.parent) {
      const parentPermission = accountRoleMenu[accountPermission.parent];
      if (parentPermission && parentPermission.view === false) {
        return false;
      }
    }

    if (accountPermission.view === false) {
      return false;
    }

    const actionValue = accountPermission[action];
    if (typeof actionValue === "boolean") {
      return actionValue;
    }

    return action === "view" ? accountPermission.view === true : true;
  }

  private isPlatformModuleVisible(accountRoleMenu: RoleMenu, moduleName: string): boolean {
    const menuKeys = PLATFORM_MODULE_VIEW_RULES[moduleName];
    if (!menuKeys) {
      return true;
    }
    const keys = Array.isArray(menuKeys) ? menuKeys : [menuKeys];
    return keys.some(menuKey => this.isAccountPermissionEnabled(accountRoleMenu, menuKey, "view"));
  }

  validateRoleMenuShape(roleMenu: unknown, profile: string = "standard_account"): string[] {
    const errors: string[] = [];
    if (!isRecord(roleMenu)) {
      return ["account_role_menu must be an object"];
    }

    const template = RoleManager.getRoleMenu(profile);
    for (const [menuKey, permission] of Object.entries(roleMenu)) {
      if (!template[menuKey]) {
        errors.push(`Unknown permission module: ${menuKey}`);
        continue;
      }
      if (!isRecord(permission)) {
        errors.push(`${menuKey} must be an object`);
        continue;
      }
      if (typeof permission.level !== "number") {
        errors.push(`${menuKey}.level must be a number`);
      }
      if (permission.parent && !template[permission.parent]) {
        errors.push(`${menuKey}.parent is invalid`);
      }
      for (const action of ACCOUNT_ACTIONS) {
        if (permission[action] !== undefined && typeof permission[action] !== "boolean") {
          errors.push(`${menuKey}.${action} must be boolean`);
        }
      }
    }

    return errors;
  }

  private toAccountAction(actionName: string): AccountAction | null {
    return ACCOUNT_ACTIONS.includes(actionName as AccountAction) ? actionName as AccountAction : null;
  }
}

export const accountAccessService = new AccountAccessService();
