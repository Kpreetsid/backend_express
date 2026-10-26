import { body } from 'express-validator';

const ASSET_TYPES = [
  'Equipment', 'Motor', 'Flexible', 'Rigid', 'Belt_Pulley', 'Gearbox',
  'Fan_Blower', 'Pumps', 'Compressor', 'Chillers', 'CNC', 'Other'
];
const COMPONENT_TYPES = [
  'Motor', 'Flexible', 'Rigid', 'Belt_Pulley', 'Gearbox',
  'Fan_Blower', 'Pumps', 'Compressor'
];
const MONGO_ID = /^[a-f\d]{24}$/i;

const isPlainObject = (value: unknown): value is Record<string, any> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isPositiveFinite = (value: unknown): boolean => {
  if (value === '' || value === null || value === undefined) return false;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 && numericValue <= 1000000000;
};

const validateComponent = (value: unknown, expectedType: string): boolean => {
  if (!isPlainObject(value)) return false;
  if (Object.keys(value).length === 0) return true;
  if (typeof value.asset_name !== 'string' || !value.asset_name.trim() || value.asset_name.trim().length > 160) return false;
  if (value.asset_type !== expectedType) return false;
  if (value.id !== undefined && !MONGO_ID.test(String(value.id))) return false;
  return true;
};

const validateGraphAndComponents = (payload: any): boolean => {
  if (!isPlainObject(payload) || !isPlainObject(payload.Equipment)) return false;
  const componentRecords: Array<{ type: string; name: string; record: Record<string, any> }> = [];
  for (const type of COMPONENT_TYPES) {
    const value = payload[type];
    const records = Array.isArray(value) ? value : [value];
    for (const record of records) {
      if (isPlainObject(record) && Object.keys(record).length > 0) {
        componentRecords.push({ type, name: String(record.asset_name || '').trim(), record });
      }
    }
  }
  if (componentRecords.length === 0) return false;
  const variableRotation = payload.Equipment.rotation_type === 'varRotation';
  for (const { type, record } of componentRecords) {
    if (!['Flexible', 'Rigid'].includes(type)) {
      const minimum = Number(record.minInputRotation);
      if (!isPositiveFinite(minimum)) return false;
      if (variableRotation) {
        const maximum = Number(record.maxInputRotation);
        if (!isPositiveFinite(maximum) || maximum < minimum) return false;
      }
    }
    if (['Belt_Pulley', 'Gearbox'].includes(type) && variableRotation) {
      const minimumOutput = Number(record.minOutputRotation);
      const maximumOutput = Number(record.maxOutputRotation);
      if (!isPositiveFinite(maximumOutput) || maximumOutput < minimumOutput) return false;
    }
  }

  const nodes = payload.Equipment?.imageNodeData?.nodes;
  if (!Array.isArray(nodes) || nodes.length < 1 || nodes.length > 100) return false;
  const nodeKeys = new Set<string>();
  const nodeIds = new Set<string>();
  for (const node of nodes) {
    if (!isPlainObject(node) || !isPlainObject(node.data)) return false;
    const type = String(node.data.type || '').trim();
    const label = String(node.data.label || '').trim();
    if (!COMPONENT_TYPES.includes(type) || !label || label.length > 160) return false;
    const key = `${type}\u0000${label.toLowerCase()}`;
    if (nodeKeys.has(key)) return false;
    nodeKeys.add(key);
    if (node.data.id !== undefined && node.data.id !== null) {
      const id = String(node.data.id);
      if (nodeIds.has(id)) return false;
      nodeIds.add(id);
    }
    const x = Number(node.position?.x);
    const y = Number(node.position?.y);
    if ((node.position !== undefined) && (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 100000 || Math.abs(y) > 100000)) {
      return false;
    }
  }

  if (nodeKeys.size !== componentRecords.length) return false;
  return componentRecords.every(({ type, name }) => nodeKeys.has(`${type}\u0000${name.toLowerCase()}`));
};

const validateImage = (value: unknown): boolean => {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value !== 'string' || value.length > 10 * 1024 * 1024) return false;
  if (/^data:image\/(png|jpeg|jpg);base64,[a-z\d+/=\r\n]+$/i.test(value)) return true;
  return /^[a-z\d][a-z\d._/-]{0,299}$/i.test(value) && !value.includes('..');
};

export const equipmentValidator = [
  body('Equipment').isObject().withMessage('Equipment must be an object'),
  body('Equipment.id').optional().isMongoId().withMessage('Invalid equipment ID'),
  body('Equipment.asset_name')
    .isString().withMessage('Equipment name must be a string')
    .trim().notEmpty().withMessage('Equipment name is required')
    .isLength({ max: 160 }).withMessage('Equipment name must not exceed 160 characters'),
  body('Equipment.asset_type').isIn(ASSET_TYPES).withMessage('Invalid equipment asset type'),
  body('Equipment.locationId').isMongoId().withMessage('A valid location is required'),
  body('Equipment.userList').isArray({ min: 1, max: 500 }).withMessage('Select between 1 and 500 users'),
  body('Equipment.userList.*').isMongoId().withMessage('Every selected user ID must be valid'),
  body('Equipment.userList').custom((value: any[]) => new Set(value.map(String)).size === value.length)
    .withMessage('Selected users must be unique'),
  body('Equipment.rotation_type').isIn(['fixedRotation', 'varRotation']).withMessage('Invalid rotation type'),
  body('Equipment.asset_orient').isIn(['horizontal', 'vertical']).withMessage('Invalid asset orientation'),
  body('Equipment.powUnit').isIn(['kw', 'hp']).withMessage('Invalid power unit'),
  body('Equipment.loadType').isIn(['fixedLoad', 'varLoad']).withMessage('Invalid load type'),
  body('Equipment.asset_timezone')
    .isString().trim().notEmpty().isLength({ max: 100 })
    .custom((value: string) => {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
        return true;
      } catch {
        return false;
      }
    }).withMessage('Invalid asset time zone'),
  body('Equipment.description').optional({ nullable: true }).isString().trim().isLength({ max: 2000 }),
  body('Equipment.asset_id').optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
  body('Equipment.image_path').optional({ nullable: true }).custom(validateImage).withMessage('Invalid equipment image'),
  body('Equipment.imageNodeData').isObject().withMessage('Equipment schematic is required'),
  body('Equipment.imageNodeData.nodes').isArray({ min: 1, max: 100 }).withMessage('Equipment schematic must contain between 1 and 100 nodes'),

  body('Motor').custom((value) => validateComponent(value, 'Motor')).withMessage('Invalid motor data'),
  body('Flexible').custom((value) => validateComponent(value, 'Flexible')).withMessage('Invalid flexible coupling data'),
  body('Rigid').custom((value) => validateComponent(value, 'Rigid')).withMessage('Invalid rigid coupling data'),
  body('Fan_Blower').custom((value) => validateComponent(value, 'Fan_Blower')).withMessage('Invalid fan or blower data'),
  body('Pumps').custom((value) => validateComponent(value, 'Pumps')).withMessage('Invalid pump data'),
  body('Compressor').custom((value) => validateComponent(value, 'Compressor')).withMessage('Invalid compressor data'),
  body('Belt_Pulley').isArray({ max: 25 }).withMessage('Belt and pulley data must contain at most 25 items'),
  body('Belt_Pulley.*').custom((value) =>
    validateComponent(value, 'Belt_Pulley') &&
    isPositiveFinite(value.minInputRotation) && isPositiveFinite(value.minOutputRotation) &&
    (value.outputRPM !== 'auto' || (isPositiveFinite(value.drivingPulleyDia) && isPositiveFinite(value.drivenPulleyDia)))
  ).withMessage('Invalid belt and pulley data'),
  body('Gearbox').isArray({ max: 25 }).withMessage('Gearbox data must contain at most 25 items'),
  body('Gearbox.*').custom((value) => {
    if (!validateComponent(value, 'Gearbox') || !isPositiveFinite(value.minInputRotation) || !isPositiveFinite(value.minOutputRotation)) return false;
    const stages = Number(value.noStages);
    if (!Number.isInteger(stages) || stages < 1 || stages > 4) return false;
    const suffixes = ['1st', '2nd', '3rd', '4th'];
    for (let index = 0; index < stages; index++) {
      if (!isPositiveFinite(value[`stage_${suffixes[index]}_driving_teeth`]) ||
          !isPositiveFinite(value[`stage_${suffixes[index]}_driven_teeth`])) return false;
    }
    return true;
  }).withMessage('Invalid gearbox data'),
  body().custom(validateGraphAndComponents).withMessage('Equipment schematic does not match its component data')
];
