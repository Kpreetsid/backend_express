const labels: Record<string, string> = {
  'pa-fan-power': 'Fan electrical power', 'pa-fan-speed': 'Fan speed',
  'pa-fan-frequency': 'VFD frequency', 'pa-fan-airflow': 'Fan airflow',
  'pa-fan-pressures': 'Fan inlet and outlet pressures', 'pa-fan-load': 'Fan load',
  'pa-fan-damper': 'Damper position', 'pa-fan-motor-current': 'Fan motor current',
  'pa-fan-bearing-temperatures': 'Fan bearing temperatures',
  'pa-fan-pressure-rise': 'Fan pressure rise', 'pa-fan-air-power': 'Estimated fan air power',
  'pa-fan-efficiency': 'Estimated electrical-to-air efficiency',
  'pa-fan-specific-power': 'Specific fan power', 'pa-fan-bearing-max': 'Maximum bearing temperature',
  'pa-fan-operating-state': 'Fan operating state',
};
const instruments: [string, string][] = [
  ...['a','b','c','d','e','f'].map(letter => [`pt_8313${letter}`, `Pressure measurement ${letter.toUpperCase()}`] as [string, string]),
  ['ptca_8322a','Pressure control measurement A'], ['ptca_8324','Pressure control measurement B'],
  ['te_8319a','Temperature measurement A'], ['te_8319b','Temperature measurement B'],
  ['te_8313b','Temperature measurement C'], ['te_8303','Temperature measurement D'],
  ['te_8304','Temperature measurement E'], ['tv_8329zc','Temperature control signal'],
  ['ft_8301','Flow measurement 1'], ['ft_8302','Flow measurement 2'], ['ft_8306a','Flow measurement A'],
  ['air_8301a','Air-related measurement A'], ['ft_8306b','Flow measurement B'], ['air_8301b','Air-related measurement B'],
  ['yfj3_ai','Motor current (YFJ3 AI)'], ['yfj3_zd1','Vibration measurement 1'], ['yfj3_zd2','Vibration measurement 2'],
  ['te_8332a','Temperature measurement F'],
];
for (const [field, label] of instruments) labels['pa-fan-' + field.replace(/_/g, '-')] = label + ' (' + field.toUpperCase() + ')';
export const PA_FAN_ANALYSIS_FEATURES = {
  id: 'pa_fan', serialNumber: 7, categoryName: 'PA Fan Operations',
  subCategory: Object.entries(labels).map(([id, name], index) =>
    ({ id, name, isSelected: false, serialNumber: index + 1, aggregated: false })),
};
