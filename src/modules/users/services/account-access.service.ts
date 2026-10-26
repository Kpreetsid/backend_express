import { IAccount } from "../../company/models/account.model";
import { Permission, RoleManager, RoleMenu } from "../constants/account-role-menu.constant";
import { RoleManager as UserRoleManager } from "../../../common/constants/new-user-roles.constant";
import { normalizeExperienceProfile } from "../../../common/constants/experience-profile.constant";

export type AccountAction = "view" | "add" | "edit" | "delete" | "import" | "export";
type PlatformControl = Record<string, Record<string, boolean>>;
type PlatformActionRule = { menuKey: string | string[]; action: AccountAction };

const ACCOUNT_ACTIONS: AccountAction[] = ["view", "add", "edit", "delete", "import", "export"];

export const CHILD_TO_PARENT_MODULE_MAP: Record<string, string> = {
  // master_asset
  asset: "master_asset",
  child_asset: "master_asset",
  report_asset: "master_asset",
  asset_sensors: "master_asset",
  endpoint: "master_asset",
  observation: "master_asset",
  config: "master_asset",
  config_alarm: "master_asset",
  attach_sensor: "master_asset",
  pump_asset_health: "master_asset",
  asset_alarms: "master_asset",
  ai_chatbot: "master_asset",

  // master_location
  location: "master_location",
  child_location: "master_location",
  location_report: "master_location",
  location_floor_map: "master_location",

  // master_dashboard
  floor_map: "master_dashboard",
  pdm: "master_dashboard",
  cmms: "master_dashboard",
  pdm_location_filter: "master_dashboard",

  // master_report
  reports_monitoring: "master_report",
  reports_health_monitoring: "master_report",
  reports_sensor_data_tracking: "master_report",
  oem_report: "master_report",

  // master_alarm
  alarm_overview: "master_alarm",
  alarm_configuration: "master_alarm",

  // master_work_order
  work_order: "master_work_order",
  comment_work_order: "master_work_order",
  parts_work_order: "master_work_order",
  work_order_status: "master_work_order",

  // master_inspections
  inspections: "master_inspections",

  // master_preventive
  preventive: "master_preventive",

  // master_form
  form: "master_form",
  form_category: "master_form",

  // master_work_request
  work_request: "master_work_request",
  work_request_status: "master_work_request",

  // master_posts
  posts: "master_posts",

  // master_inventory
  inventory: "master_inventory",

  // master_devices
  devices: "master_devices",
  gateways: "master_devices",
  peripheral_sensors: "master_devices",

  // master_admin_panel
  admin_panel: "master_admin_panel",
  users: "master_admin_panel",
  permission: "master_admin_panel",
  asset_mail: "master_admin_panel",

  // master_library
  master_library: "master_library",
  work_order_templates: "master_library",
  procedures: "master_library"
};

const ACCOUNT_ADDITIVE_FEATURES: Record<string, { level: number; parent?: string; defaultView: boolean }> = {
  master_alarm: { level: 0, defaultView: true },
  alarm_overview: { level: 1, parent: "master_alarm", defaultView: true },
  alarm_configuration: { level: 1, parent: "master_alarm", defaultView: true },
  master_library: { level: 0, defaultView: true },
  work_order_templates: { level: 1, parent: "master_library", defaultView: true },
  procedures: { level: 1, parent: "master_library", defaultView: true },
  asset_alarms: { level: 1, parent: "master_asset", defaultView: true },
  ai_chatbot: { level: 1, parent: "master_asset", defaultView: true },
  oem_report: { level: 1, parent: "master_report", defaultView: false },
  pump_asset_health: { level: 1, parent: "master_asset", defaultView: false },
  pdm_location_filter: { level: 1, parent: "master_dashboard", defaultView: true }
};

const PLATFORM_ACTION_RULES: Record<string, Record<string, PlatformActionRule>> = {
  asset: {
    add_asset: { menuKey: "master_asset", action: "add" },
    delete_asset: { menuKey: "master_asset", action: "delete" },
    add_child_asset: { menuKey: "master_asset", action: "add" },
    edit_asset: { menuKey: "master_asset", action: "edit" },
    create_report: { menuKey: "master_asset", action: "add" },
    delete_report: { menuKey: "master_asset", action: "delete" },
    download_report: { menuKey: "master_asset", action: "export" },
    edit_report: { menuKey: "master_asset", action: "edit" },
    config_alarm: { menuKey: "master_asset", action: "edit" },
    add_observation: { menuKey: "master_asset", action: "add" },
    create_endpoint: { menuKey: "master_asset", action: "add" },
    edit_endpoint: { menuKey: "master_asset", action: "edit" },
    delete_end_point: { menuKey: "master_asset", action: "delete" },
    attach_sensor: { menuKey: "master_asset", action: "add" },
    update_config: { menuKey: "master_asset", action: "edit" }
  },
  location: {
    add_location: { menuKey: "master_location", action: "add" },
    delete_location: { menuKey: "master_location", action: "delete" },
    add_child_location: { menuKey: "master_location", action: "add" },
    edit_location: { menuKey: "master_location", action: "edit" },
    create_report: { menuKey: "master_location", action: "add" },
    delete_report: { menuKey: "master_location", action: "delete" },
    download_report: { menuKey: "master_location", action: "export" }
  },
  workOrder: {
    create_work_order: { menuKey: "master_work_order", action: "add" },
    edit_work_order: { menuKey: "master_work_order", action: "edit" },
    delete_work_order: { menuKey: "master_work_order", action: "delete" },
    update_work_order_status: { menuKey: "master_work_order", action: "edit" },
    add_comment_work_order: { menuKey: "master_work_order", action: "add" },
    add_task_work_order: { menuKey: "master_work_order", action: "add" },
    update_parts_work_order: { menuKey: "master_work_order", action: "edit" }
  },
  floorMap: {
    create_kpi: { menuKey: "master_dashboard", action: "add" },
    view_floor_map: { menuKey: "master_dashboard", action: "view" },
    delete_kpi: { menuKey: "master_dashboard", action: "delete" },
    upload_floor_map: { menuKey: "master_dashboard", action: "edit" }
  }
};

const PLATFORM_MODULE_RULES: Record<string, string> = {
  preventive: "master_preventive",
  form: "master_form",
  form_category: "master_form",
  work_request: "master_work_request",
  posts: "master_posts",
  inventory: "master_inventory",
  devices: "master_devices",
  gateways: "master_devices",
  peripheral_sensors: "master_devices",
  admin_panel: "master_admin_panel",
  users: "master_admin_panel",
  permission: "master_admin_panel",
  asset_mail: "master_admin_panel"
};

const PARENT_PLATFORM_MODULE_RULES: Record<string, string> = {
  admin_panel: "master_admin_panel",
  devices: "master_devices"
};

const PLATFORM_MODULE_VIEW_RULES: Record<string, string | string[]> = {
  asset: "master_asset",
  location: "master_location",
  workOrder: "master_work_order",
  floorMap: "master_dashboard",
  preventive: "master_preventive",
  form: "master_form",
  form_category: "master_form",
  work_request: "master_work_request",
  posts: "master_posts",
  inventory: "master_inventory",
  devices: "master_devices",
  gateways: "master_devices",
  peripheral_sensors: "master_devices",
  admin_panel: "master_admin_panel",
  users: "master_admin_panel",
  permission: "master_admin_panel",
  asset_mail: "master_admin_panel"
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
      || !!CHILD_TO_PARENT_MODULE_MAP[menuKey]
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
      if (typeof value === "boolean") {
        merged[key] = {
          ...(merged[key] || { level: CHILD_TO_PARENT_MODULE_MAP[key] ? 1 : 0 }),
          ...(CHILD_TO_PARENT_MODULE_MAP[key] ? { parent: CHILD_TO_PARENT_MODULE_MAP[key] } : {}),
          view: value
        } as Permission;
      } else if (isRecord(value)) {
        merged[key] = {
          ...(merged[key] || {}),
          ...value
        } as Permission;
      }
    }

    if (experienceProfile === "oem") {
      merged.master_admin_panel = { ...(merged.master_admin_panel || { level: 0 }), view: false };
      merged.users = { ...(merged.users || { level: 1, parent: "master_admin_panel" }), view: false };
      merged.permission = { ...(merged.permission || { level: 1, parent: "master_admin_panel" }), view: false };
      merged.asset_mail = { ...(merged.asset_mail || { level: 1, parent: "master_admin_panel" }), view: false };
      if (storedMenu.oem_report === undefined) {
        merged.oem_report = { ...(merged.oem_report || { level: 1, parent: "master_report" }), view: true };
      }
      if (storedMenu.pump_asset_health === undefined) {
        merged.pump_asset_health = { ...(merged.pump_asset_health || { level: 1, parent: "master_asset" }), view: true };
      }
      if (storedMenu.pdm_location_filter === undefined) {
        merged.pdm_location_filter = { ...(merged.pdm_location_filter || { level: 1, parent: "master_dashboard" }), view: false };
      }
    } else if (experienceProfile === "standard_account") {
      if (storedMenu.oem_report === undefined) {
        merged.oem_report = { ...(merged.oem_report || { level: 1, parent: "master_report" }), view: false };
      }
      if (storedMenu.pump_asset_health === undefined) {
        merged.pump_asset_health = { ...(merged.pump_asset_health || { level: 1, parent: "master_asset" }), view: false };
      }
      if (storedMenu.pdm_location_filter === undefined) {
        merged.pdm_location_filter = { ...(merged.pdm_location_filter || { level: 1, parent: "master_dashboard" }), view: true };
      }
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

    for (const [menuKey, additiveFeature] of Object.entries(ACCOUNT_ADDITIVE_FEATURES)) {
      if (!effectiveRoleMenu[menuKey]) {
        effectiveRoleMenu[menuKey] = this.createLegacyFeaturePermission(menuKey, additiveFeature, accountRoleMenu);
      }
    }

    for (const [menuKey, permission] of Object.entries(effectiveRoleMenu)) {
      if (!isRecord(permission)) {
        continue;
      }

      const parentKey = permission.parent || CHILD_TO_PARENT_MODULE_MAP[menuKey];
      const parentPermission = parentKey ? accountRoleMenu[parentKey] : undefined;
      const accountPermission = accountRoleMenu[menuKey];

      // If parent module is disabled in account, child view and actions must all be disabled
      if (parentPermission && parentPermission.view === false) {
        permission.view = false;
        for (const action of ACCOUNT_ACTIONS) {
          if (typeof permission[action] === "boolean") {
            permission[action] = false;
          }
        }
        continue;
      }

      // If direct module is disabled in account, view and actions must be disabled
      if (accountPermission && accountPermission.view === false) {
        permission.view = false;
        for (const action of ACCOUNT_ACTIONS) {
          if (typeof permission[action] === "boolean") {
            permission[action] = false;
          }
        }
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

  private createLegacyFeaturePermission(
    menuKey: string,
    additiveFeature: { level: number; parent?: string; defaultView: boolean },
    accountRoleMenu: RoleMenu
  ): Permission {
    const accountPermission = accountRoleMenu[menuKey];
    const parentPermission = additiveFeature.parent ? accountRoleMenu[additiveFeature.parent] : undefined;
    const viewEnabled = accountPermission
      ? accountPermission.view === true
      : parentPermission
        ? parentPermission.view === true && additiveFeature.defaultView
        : additiveFeature.defaultView;

    return {
      level: accountPermission?.level ?? additiveFeature.level,
      ...((accountPermission?.parent || additiveFeature.parent) ? { parent: accountPermission?.parent || additiveFeature.parent } : {}),
      view: viewEnabled,
      ...((accountPermission?.level ?? additiveFeature.level) === 1
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

    const parentMenuKey = PARENT_PLATFORM_MODULE_RULES[moduleName] || CHILD_TO_PARENT_MODULE_MAP[moduleName];
    if (parentMenuKey) {
      return this.isAccountPermissionEnabled(accountRoleMenu, parentMenuKey, "view");
    }

    return this.isAccountPermissionEnabled(accountRoleMenu, moduleName, action || "view");
  }

  isAccountPermissionEnabled(accountRoleMenu: RoleMenu, menuKey: string, action: AccountAction = "view"): boolean {
    if (!accountRoleMenu) {
      return true;
    }

    const accountPermission = accountRoleMenu[menuKey];
    if (accountPermission) {
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

    // If menuKey is not defined in accountRoleMenu, check if its parent module is disabled
    const parentKey = CHILD_TO_PARENT_MODULE_MAP[menuKey];
    if (parentKey) {
      const parentPermission = accountRoleMenu[parentKey];
      if (parentPermission && parentPermission.view === false) {
        return false;
      }
    }

    return true;
  }

  private isPlatformModuleVisible(accountRoleMenu: RoleMenu, moduleName: string): boolean {
    const menuKeys = PLATFORM_MODULE_VIEW_RULES[moduleName];
    if (!menuKeys) {
      const parentKey = CHILD_TO_PARENT_MODULE_MAP[moduleName];
      if (parentKey) {
        return this.isAccountPermissionEnabled(accountRoleMenu, parentKey, "view");
      }
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
      if (typeof permission === "boolean") {
        continue;
      }
      if (!isRecord(permission)) {
        errors.push(`${menuKey} must be an object or boolean`);
        continue;
      }
      if (typeof permission.level !== "number" && permission.level !== undefined) {
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

