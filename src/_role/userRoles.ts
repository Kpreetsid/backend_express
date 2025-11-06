export const platformControlData = async (role: string) => {
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

export const adminRoles = {
    asset: {
        add_asset: true,
        delete_asset: true,
        add_child_asset: true,
        edit_asset: true,
        create_report: true,
        delete_report: true,
        download_report: true,
        edit_report: true,
        config_alarm: true,
        add_observation: true,
        create_endpoint: true,
        edit_endpoint: true,
        delete_end_point: true,
        attach_sensor: true,
        update_config: true
    },
    location: {
        add_location: true,
        delete_location: true,
        add_child_location: true,
        edit_location: true,
        create_report: true,
        delete_report: true,
        download_report: true
    },
    workOrder: {
        create_work_order: true,
        edit_work_order: true,
        delete_work_order: true,
        update_work_order_status: true,
        add_comment_work_order: true,
        add_task_work_order: true,
        update_parts_work_order: true
    },
    floorMap: {
        create_kpi: true,
        view_floor_map: true,
        delete_kpi: true,
        upload_floor_map: true
    }
}

export const managerRoles = {
    asset: {
        add_asset: false,
        delete_asset: false,
        add_child_asset: false,
        edit_asset: false,
        create_report: false,
        delete_report: false,
        download_report: false,
        edit_report: false,
        config_alarm: false,
        add_observation: false,
        create_endpoint: false,
        edit_endpoint: false,
        delete_end_point: false,
        attach_sensor: false,
        update_config: false
    },
    location: {
        add_location: false,
        delete_location: false,
        add_child_location: false,
        edit_location: false,
        create_report: false,
        delete_report: false,
        download_report: false
    },
    workOrder: {
        create_work_order: false,
        edit_work_order: false,
        delete_work_order: false,
        update_work_order_status: false,
        add_comment_work_order: false,
        add_task_work_order: false,
        update_parts_work_order: false
    },
    floorMap: {
        create_kpi: false,
        view_floor_map: false,
        delete_kpi: false,
        upload_floor_map: false
    }
}

export const employeeRoles = {
    asset: {
        add_asset: false,
        delete_asset: false,
        add_child_asset: false,
        edit_asset: false,
        create_report: false,
        delete_report: false,
        download_report: false,
        edit_report: false,
        config_alarm: false,
        add_observation: false,
        create_endpoint: false,
        edit_endpoint: false,
        delete_end_point: false,
        attach_sensor: false,
        update_config: false
    },
    location: {
        add_location: false,
        delete_location: false,
        add_child_location: false,
        edit_location: false,
        create_report: false,
        delete_report: false,
        download_report: false
    },
    workOrder: {
        create_work_order: false,
        edit_work_order: false,
        delete_work_order: false,
        update_work_order_status: false,
        add_comment_work_order: false,
        add_task_work_order: false,
        update_parts_work_order: false
    },
    floorMap: {
        create_kpi: false,
        view_floor_map: false,
        delete_kpi: false,
        upload_floor_map: false
    }
}

export const customerRoles = {
    asset: {
        add_asset: false,
        delete_asset: false,
        add_child_asset: false,
        edit_asset: false,
        create_report: false,
        delete_report: false,
        download_report: false,
        edit_report: false,
        config_alarm: false,
        add_observation: false,
        create_endpoint: false,
        edit_endpoint: false,
        delete_end_point: false,
        attach_sensor: false,
        update_config: false
    },
    location: {
        add_location: false,
        delete_location: false,
        add_child_location: false,
        edit_location: false,
        create_report: false,
        delete_report: false,
        download_report: false
    },
    workOrder: {
        create_work_order: false,
        edit_work_order: false,
        delete_work_order: false,
        update_work_order_status: false,
        add_comment_work_order: false,
        add_task_work_order: false,
        update_parts_work_order: false
    },
    floorMap: {
        create_kpi: false,
        view_floor_map: false,
        delete_kpi: false,
        upload_floor_map: false
    }
}