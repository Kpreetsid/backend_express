export const roleMenuData = async (role: string) => {
    var platformControl = adminRoles;
    switch (role) {
        case "admin": {
            platformControl = adminRoles;
            break;
        }
        case "manager": {
            platformControl = managerRoles;
            break;
        }
        case "employee": {
            platformControl = employeeRoles;
            break;
        }
        case "customer": {
            platformControl = customerRoles;
            break;
        }
    }
    return platformControl;
}

const adminRoles = {
    "asset" : { "view" : true, "add" : true, "edit" : true, "delete" : true, "import" : true, "export" : true },
    "child_asset" : { "view" : true, "add" : true, "edit" : true, "delete" : true, "import" : true, "export" : true },
    "report_asset" : { "view" : true, "add" : true, "edit" : true, "delete" : true, "import" : true, "export" : true },
    "location" : { "view" : true, "add" : true, "edit" : true, "delete" : true, "import" : true, "export" : true },
    "child_location" : { "view" : true, "add" : true, "edit" : true, "delete" : true, "import" : true, "export" : true },
    "report_location" : { "view" : true, "add" : true, "edit" : true, "delete" : true, "import" : true, "export" : true },
    "work_order" : { "view" : true, "add" : true, "edit" : true, "delete" : true, "import" : true, "export" : true },
    "comment_work_order" : { "view" : true, "add" : true, "edit" : true, "delete" : true, "import" : true, "export" : true },
    "task_work_order" : { "view" : true, "add" : true, "edit" : true, "delete" : true, "import" : true, "export" : true },
    "parts_work_order" : { "view" : true, "add" : true, "edit" : true, "delete" : true, "import" : true, "export" : true },
    "floor_map" : { "view" : true, "add" : true, "edit" : true, "delete" : true, "import" : true, "export" : true },
    "kpi" : { "view" : true, "add" : true, "edit" : true, "delete" : true, "import" : true, "export" : true },
    "pdm_dashboard" : { "view" : true, "add" : true, "edit" : true, "delete" : true, "import" : true, "export" : true },
    "cmms" : { "view" : true, "add" : true, "edit" : true, "delete" : true, "import" : true, "export" : true },
    "floor_mapping" : { "view" : true, "add" : true, "edit" : true, "delete" : true, "import" : true, "export" : true },
    "reports" : { "view" : true, "add" : true, "edit" : true, "delete" : true, "import" : true, "export" : true },
    "asset_sensors" : { "view" : true, "add" : true, "edit" : true, "delete" : true, "import" : true, "export" : true },
    "endpoint" : { "view" : true, "add" : true, "edit" : true, "delete" : true, "import" : true, "export" : true },
    "observation" : { "view" : true, "add" : true, "edit" : true, "delete" : true, "import" : true, "export" : true },
    "config" : { "view" : true, "add" : true, "edit" : true, "delete" : true, "import" : true, "export" : true },
    "config_alarm" : { "view" : true, "add" : true, "edit" : true, "delete" : true, "import" : true, "export" : true },
    "attach_sensor" : { "view" : true, "add" : true, "edit" : true, "delete" : true, "import" : true, "export" : true },
    "preventive" : { "view" : true, "add" : true, "edit" : true, "delete" : true, "import" : true, "export" : true },
    "form" : { "view" : true, "add" : true, "edit" : true, "delete" : true, "import" : true, "export" : true },
    "form_category" : { "view" : true, "add" : true, "edit" : true, "delete" : true, "import" : true, "export" : true },
    "work_request" : { "view" : true, "add" : true, "edit" : true, "delete" : true, "import" : true, "export" : true },
    "posts" : { "view" : true, "add" : true, "edit" : true, "delete" : true, "import" : true, "export" : true },
    "inventory" : { "view" : true, "add" : true, "edit" : true, "delete" : true, "import" : true, "export" : true },
    "devices" : { "view" : true, "add" : true, "edit" : true, "delete" : true, "import" : true, "export" : true },
    "peripheral_sensors" : { "view" : true, "add" : true, "edit" : true, "delete" : true, "import" : true, "export" : true },
    "gateways" : { "view" : true, "add" : true, "edit" : true, "delete" : true, "import" : true, "export" : true },
    "users" : { "view" : true, "add" : true, "edit" : true, "delete" : true, "import" : true, "export" : true },
    "permission" : { "view" : true, "add" : true, "edit" : true, "delete" : true, "import" : true, "export" : true },
    "asset_mail" : { "view" : true, "add" : true, "edit" : true, "delete" : true, "import" : true, "export" : true }
}

const managerRoles = {
    "asset" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "child_asset" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "report_asset" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "location" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "child_location" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "report_location" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "work_order" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "comment_work_order" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "task_work_order" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "parts_work_order" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "floor_map" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "kpi" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "pdm_dashboard" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "cmms" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "floor_mapping" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "reports" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "asset_sensors" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "endpoint" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "observation" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "config" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "config_alarm" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "attach_sensor" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "preventive" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "form" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "form_category" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "work_request" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "posts" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "inventory" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "devices" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "peripheral_sensors" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "gateways" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "users" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "permission" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "asset_mail" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false }
}

const employeeRoles = {
    "asset" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "child_asset" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "report_asset" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "location" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "child_location" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "report_location" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "work_order" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "comment_work_order" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "task_work_order" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "parts_work_order" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "floor_map" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "kpi" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "pdm_dashboard" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "cmms" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "floor_mapping" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "reports" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "asset_sensors" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "endpoint" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "observation" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "config" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "config_alarm" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "attach_sensor" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "preventive" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "form" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "form_category" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "work_request" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "posts" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "inventory" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "devices" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "peripheral_sensors" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "gateways" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "users" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "permission" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "asset_mail" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false }
}

const customerRoles = {
    "asset" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "child_asset" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "report_asset" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "location" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "child_location" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "report_location" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "work_order" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "comment_work_order" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "task_work_order" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "parts_work_order" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "floor_map" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "kpi" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "pdm_dashboard" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "cmms" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "floor_mapping" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "reports" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "asset_sensors" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "endpoint" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "observation" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "config" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "config_alarm" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "attach_sensor" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "preventive" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "form" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "form_category" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "work_request" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "posts" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "inventory" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "devices" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "peripheral_sensors" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "gateways" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "users" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "permission" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false },
    "asset_mail" : { "view": true, "add": false, "edit": false, "delete": false, "import": false, "export": false }
}