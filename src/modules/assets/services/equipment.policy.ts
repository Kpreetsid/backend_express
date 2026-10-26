const EQUIPMENT_FIELDS = [
  'id', 'asset_name', 'asset_type', 'image_path', 'rotation_type', 'asset_id',
  'asset_orient', 'powUnit', 'description', 'locationId', 'userList',
  'asset_timezone', 'loadType', 'asset_build_type', 'asset_model',
  'manufacturer', 'year', 'assigned_to', 'imageNodeData'
] as const;

const MOTOR_FIELDS = [
  'id', 'asset_name', 'asset_id', 'asset_type', 'asset_build_type', 'motorType',
  'lineFreq', 'asset_behavior', 'specificFrequency', 'mounting', 'minInputRotation',
  'maxInputRotation', 'rotationUnit', 'powerRating', 'speedUnit',
  'motorRatedEfficiencyPercent', 'vfdDriven', 'ratedCurrentA', 'ratedVoltageV',
  'nominalPowerFactor', 'asset_model', 'manufacturer', 'year'
] as const;

const FLEXIBLE_FIELDS = [
  'id', 'asset_name', 'asset_id', 'asset_type', 'asset_build_type', 'element',
  'image_path', 'description', 'asset_model', 'manufacturer', 'year'
] as const;

const RIGID_FIELDS = [
  'id', 'asset_name', 'asset_id', 'asset_type', 'asset_build_type', 'image_path',
  'description', 'asset_model', 'manufacturer', 'year'
] as const;

const BELT_FIELDS = [
  'id', 'asset_name', 'asset_id', 'asset_type', 'asset_build_type',
  'minInputRotation', 'maxInputRotation', 'minOutputRotation', 'maxOutputRotation',
  'drivingPulleyDia', 'drivenPulleyDia', 'drivingPulleyDiaUnit', 'beltLength',
  'outputRPM', 'noOfGroove', 'image_path'
] as const;

const GEARBOX_FIELDS = [
  'id', 'asset_name', 'asset_id', 'asset_type', 'asset_build_type', 'bearingType',
  'mounting', 'minInputRotation', 'maxInputRotation', 'minOutputRotation',
  'maxOutputRotation', 'noStages', 'stage_1st_driving_teeth',
  'stage_1st_driven_teeth', 'stage_2nd_driving_teeth', 'stage_2nd_driven_teeth',
  'stage_3rd_driving_teeth', 'stage_3rd_driven_teeth', 'stage_4th_driving_teeth',
  'stage_4th_driven_teeth', 'image_path', 'description', 'asset_model',
  'manufacturer', 'year'
] as const;

const FAN_FIELDS = [
  'id', 'asset_name', 'asset_id', 'asset_type', 'asset_build_type', 'brandMake',
  'brandId', 'bearingType', 'mounting', 'mountType', 'bladeCount',
  'minInputRotation', 'maxInputRotation', 'specificFrequency', 'image_path',
  'description', 'asset_model', 'manufacturer', 'year'
] as const;

const PUMP_FIELDS = [
  'id', 'asset_name', 'asset_id', 'asset_type', 'asset_build_type', 'brand',
  'pump_model', 'casing', 'impellerType', 'impellerBladeCount', 'minInputRotation',
  'maxInputRotation', 'specificFrequency', 'image_path', 'description',
  'asset_model', 'manufacturer', 'year', 'ratedFlowM3h', 'ratedHeadM',
  'bepFlowM3h', 'bepHeadM', 'bepEfficiencyPercent',
  'minimumContinuousStableFlowM3h', 'motorToPumpSpeedRatio'
] as const;

const COMPRESSOR_FIELDS = [
  'id', 'asset_name', 'asset_id', 'asset_type', 'asset_build_type', 'mountType',
  'brandModel', 'pinionGearTeethCount', 'timingGearTeethCount', 'powerRating',
  'minInputRotation', 'maxInputRotation', 'specificFrequency', 'image_path',
  'description', 'asset_model', 'manufacturer', 'year'
] as const;

const isPlainObject = (value: unknown): value is Record<string, any> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const cloneAllowedValue = (value: any): any => {
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((entry) =>
      typeof entry === 'string' ? entry.trim() : entry
    ).filter((entry) => ['string', 'number', 'boolean'].includes(typeof entry));
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  return value;
};

const pickRecord = (value: unknown, fields: readonly string[], assetType?: string): Record<string, any> => {
  if (!isPlainObject(value)) return {};
  const result: Record<string, any> = {};
  for (const field of fields) {
    if (value[field] !== undefined && value[field] !== null) {
      result[field] = cloneAllowedValue(value[field]);
    }
  }
  if (assetType && Object.keys(result).length > 0) {
    result.asset_type = assetType;
  }
  return result;
};

const sanitizeGraph = (value: unknown): { nodes: any[] } => {
  const nodes = isPlainObject(value) && Array.isArray(value.nodes) ? value.nodes : [];
  return {
    nodes: nodes.slice(0, 100).flatMap((node: any) => {
      if (!isPlainObject(node) || !isPlainObject(node.data)) return [];
      const type = typeof node.data.type === 'string' ? node.data.type.trim() : '';
      const label = typeof node.data.label === 'string' ? node.data.label.trim() : '';
      if (!type || !label) return [];
      const rawId = node.data.id;
      const id = typeof rawId === 'string' || typeof rawId === 'number' ? rawId : undefined;
      const image = typeof node.data.image === 'string' ? node.data.image.trim() : undefined;
      const x = Number(node.position?.x);
      const y = Number(node.position?.y);
      return [{
        data: { id, label, type, image },
        position: {
          x: Number.isFinite(x) ? x : 0,
          y: Number.isFinite(y) ? y : 0
        }
      }];
    })
  };
};

export interface SanitizedEquipmentPayload {
  Equipment: Record<string, any>;
  Motor: Record<string, any>;
  Flexible: Record<string, any>;
  Rigid: Record<string, any>;
  Belt_Pulley: Record<string, any>[];
  Gearbox: Record<string, any>[];
  Fan_Blower: Record<string, any>;
  Pumps: Record<string, any>;
  Compressor: Record<string, any>;
}

export const sanitizeEquipmentPayload = (value: unknown): SanitizedEquipmentPayload => {
  if (!isPlainObject(value) || !isPlainObject(value.Equipment)) {
    throw Object.assign(new Error('Equipment payload is required'), { status: 400 });
  }

  const equipment = pickRecord(value.Equipment, EQUIPMENT_FIELDS);
  equipment.userList = Array.isArray(equipment.userList)
    ? Array.from(new Set(equipment.userList.map((id: any) => String(id).trim()).filter(Boolean))).slice(0, 500)
    : [];
  equipment.imageNodeData = sanitizeGraph(value.Equipment.imageNodeData);

  return {
    Equipment: equipment,
    Motor: pickRecord(value.Motor, MOTOR_FIELDS, 'Motor'),
    Flexible: pickRecord(value.Flexible, FLEXIBLE_FIELDS, 'Flexible'),
    Rigid: pickRecord(value.Rigid, RIGID_FIELDS, 'Rigid'),
    Belt_Pulley: (Array.isArray(value.Belt_Pulley) ? value.Belt_Pulley : [])
      .slice(0, 25)
      .map((item) => pickRecord(item, BELT_FIELDS, 'Belt_Pulley')),
    Gearbox: (Array.isArray(value.Gearbox) ? value.Gearbox : [])
      .slice(0, 25)
      .map((item) => pickRecord(item, GEARBOX_FIELDS, 'Gearbox')),
    Fan_Blower: pickRecord(value.Fan_Blower, FAN_FIELDS, 'Fan_Blower'),
    Pumps: pickRecord(value.Pumps, PUMP_FIELDS, 'Pumps'),
    Compressor: pickRecord(value.Compressor, COMPRESSOR_FIELDS, 'Compressor')
  };
};
