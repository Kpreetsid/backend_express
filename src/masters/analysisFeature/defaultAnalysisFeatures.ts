export const DEFAULT_ANALYSIS_FEATURES = [
  {
    id: "vibration",
    serialNumber: 1,
    categoryName: "Vibration",
    subCategory: [
      { id: "velocity-rms", name: "Velocity RMS", isSelected: true, serialNumber: 1, aggregated: true, dblClickAction: "spectrum" },
      { id: "velocity-peak", name: "Velocity Peak", isSelected: false, serialNumber: 2, aggregated: true, dblClickAction: "spectrum" },
      { id: "velocity-peak_to_peak", name: "Velocity Peak to Peak", isSelected: false, serialNumber: 3, aggregated: true, dblClickAction: "spectrum" },
      { id: "velocity-kurtosis", name: "Velocity Kurtosis", isSelected: false, serialNumber: 4, aggregated: true, dblClickAction: "spectrum" },
      { id: "acceleration-rms", name: "Acceleration RMS", isSelected: true, serialNumber: 5, aggregated: true, dblClickAction: "spectrum" },
      { id: "acceleration-peak", name: "Acceleration Peak", isSelected: false, serialNumber: 6, aggregated: true, dblClickAction: "spectrum" },
      { id: "acceleration-peak_to_peak", name: "Acceleration Peak to Peak", isSelected: true, serialNumber: 7, aggregated: true, dblClickAction: "spectrum" },
      { id: "acceleration-kurtosis", name: "Acceleration Kurtosis", isSelected: false, serialNumber: 8, aggregated: true, dblClickAction: "spectrum" },
      { id: "displacement-rms", name: "Displacement RMS", isSelected: false, serialNumber: 9, aggregated: true, dblClickAction: "spectrum" },
      { id: "displacement-peak", name: "Displacement Peak", isSelected: false, serialNumber: 10, aggregated: true, dblClickAction: "spectrum" },
      { id: "displacement-peak_to_peak", name: "Displacement Peak to Peak", isSelected: false, serialNumber: 11, aggregated: true, dblClickAction: "spectrum" },
      { id: "displacement-kurtosis", name: "Displacement Kurtosis", isSelected: false, serialNumber: 12, aggregated: true, dblClickAction: "spectrum" },
      { id: "envelope-rms", name: "Envelope RMS", isSelected: false, serialNumber: 13, aggregated: true, dblClickAction: "spectrum" },
      { id: "envelope-peak_to_peak", name: "Envelope Peak to Peak", isSelected: false, serialNumber: 14, aggregated: true, dblClickAction: "spectrum" },
      { id: "EHNR", name: "EHNR", isSelected: false, serialNumber: 15, aggregated: false, dblClickAction: "spectrum" },
      { id: "BFF-bsf_amp", name: "BFF Bsf", isSelected: false, serialNumber: 16, aggregated: false, dblClickAction: "spectrum" },
      { id: "BFF-bpfi_amp", name: "BFF BPFI", isSelected: false, serialNumber: 17, aggregated: false, dblClickAction: "spectrum" },
      { id: "BFF-bpfo_amp", name: "BFF BPFO", isSelected: false, serialNumber: 18, aggregated: false, dblClickAction: "spectrum" },
      { id: "BFF-ftf_amp", name: "BFF FTF", isSelected: false, serialNumber: 19, aggregated: false, dblClickAction: "spectrum" },
      { id: "Harmonics-one_amp", name: "Harmonics Velocity 1x", isSelected: false, serialNumber: 20, aggregated: false, dblClickAction: "spectrum" },
      { id: "Harmonics-two_amp", name: "Harmonics Velocity 2x", isSelected: false, serialNumber: 21, aggregated: false, dblClickAction: "spectrum" },
      { id: "Harmonics-three_amp", name: "Harmonics Velocity 3x", isSelected: false, serialNumber: 22, aggregated: false, dblClickAction: "spectrum" },
      { id: "Harmonics-four_amp", name: "Harmonics Velocity 4x", isSelected: false, serialNumber: 23, aggregated: false, dblClickAction: "spectrum" },
      { id: "Harmonics-five_amp", name: "Harmonics Velocity 5x", isSelected: false, serialNumber: 24, aggregated: false, dblClickAction: "spectrum" }
    ]
  },
  {
    id: "energy",
    serialNumber: 2,
    categoryName: "Energy",
    subCategory: [
      { id: "current_rms", name: "Current RMS", isSelected: true, serialNumber: 1, aggregated: true, dblClickAction: "energy_spectrum" },
      { id: "voltage_rms", name: "Voltage RMS", isSelected: true, serialNumber: 2, aggregated: true, dblClickAction: "energy_spectrum" },
      { id: "active_power", name: "Active Power", isSelected: false, serialNumber: 3, aggregated: false, dblClickAction: "energy_spectrum" },
      { id: "reactive_power", name: "Reactive Power", isSelected: false, serialNumber: 4, aggregated: false, dblClickAction: "energy_spectrum" },
      { id: "apparent_power", name: "Apparent Power", isSelected: false, serialNumber: 5, aggregated: false, dblClickAction: "energy_spectrum" },
      { id: "power_factor", name: "Power Factor", isSelected: false, serialNumber: 6, aggregated: false, dblClickAction: "energy_spectrum" }
    ]
  },
  {
    id: "temperature",
    serialNumber: 3,
    categoryName: "Temperature",
    subCategory: [
      { id: "temperature", name: "Temperature", isSelected: true, serialNumber: 1, aggregated: true, dblClickAction: "spectrum", colors: ["#ff0000", "#1237ff", "#00d711", "#F4C5F3", "#777581", "#FFE200", "#78FCFF", "#FA8349", "#19A0A6", "#73273F", "#9F09D2"] }
    ]
  },
  {
    id: "acoustic",
    serialNumber: 4,
    categoryName: "Acoustic",
    subCategory: [
      { id: "acoustic", name: "Acoustic Trend", isSelected: false, serialNumber: 1, aggregated: false, dblClickAction: "acoustic_trend", colors: ["#ff0000", "#F4C5F3", "#777581", "#FFE200", "#78FCFF", "#FA8349", "#19A0A6", "#73273F", "#9F09D2", "#D9E3F0", "#F2E8D5"] }
    ]
  },
  {
    id: "magnetic-flux",
    serialNumber: 5,
    categoryName: "Magnetic Flux",
    subCategory: [
      { id: "magnetic-flux", name: "Magnetic Flux Trend", isSelected: false, serialNumber: 1, aggregated: false, dblClickAction: "magnetic_flux" }
    ]
  }
];
