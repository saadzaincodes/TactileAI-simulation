export const SENSOR_ROWS = 6;
export const SENSOR_COLS = 8;
export const ELECTRODE_COUNT = SENSOR_ROWS * SENSOR_COLS;

export interface BioTacReading {
  electrodes: number[][];
  pressure: number;
  temperature: number;
  impedance: number;
  timestamp: number;
}

export interface SlipEvent {
  detected: boolean;
  magnitude: number;
  direction: [number, number];
  confidence: number;
}

export interface SimulationState {
  time: number;
  gripForce: number;
  targetForce: number;
  objectWeight: number;
  objectFriction: number;
  sensorReading: BioTacReading;
  slipEvent: SlipEvent;
  isGrasping: boolean;
  armJointAngles: number[];
  controlMode: 'ai' | 'traditional';
  aiConfidence: number;
  slipHistory: number[];
  forceHistory: number[];
  pressureHistory: number[];
}

function generateBasePattern(gripForce: number, friction: number): number[][] {
  const grid: number[][] = [];
  const cx = (SENSOR_COLS - 1) / 2;
  const cy = (SENSOR_ROWS - 1) / 2;

  for (let r = 0; r < SENSOR_ROWS; r++) {
    const row: number[] = [];
    for (let c = 0; c < SENSOR_COLS; c++) {
      const dx = (c - cx) / cx;
      const dy = (r - cy) / cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const gaussian = Math.exp(-dist * dist * 1.8);
      const base = gaussian * gripForce * friction;
      row.push(Math.max(0, Math.min(1, base)));
    }
    grid.push(row);
  }
  return grid;
}

function addSlipPattern(
  grid: number[][],
  slipMag: number,
  slipDir: [number, number],
  time: number
): number[][] {
  return grid.map((row, r) =>
    row.map((val, c) => {
      const phase = (c * slipDir[0] + r * slipDir[1]) * 0.5 + time * 8;
      const wave = Math.sin(phase) * 0.5 + 0.5;
      const slipEffect = wave * slipMag * 0.4;
      const jitter = (Math.random() - 0.5) * slipMag * 0.15;
      return Math.max(0, Math.min(1, val + slipEffect + jitter));
    })
  );
}

function addSensorNoise(grid: number[][], amount: number): number[][] {
  return grid.map(row =>
    row.map(val => {
      const noise = (Math.random() - 0.5) * amount;
      return Math.max(0, Math.min(1, val + noise));
    })
  );
}

export function computeSlip(
  gripForce: number,
  objectWeight: number,
  friction: number
): SlipEvent {
  const holdingForce = gripForce * friction * 2;
  const slipRatio = Math.max(0, 1 - holdingForce / Math.max(objectWeight, 0.01));
  const slipMag = slipRatio * slipRatio;
  const angle = Math.random() * Math.PI * 2;
  const detected = slipMag > 0.05;

  return {
    detected,
    magnitude: slipMag,
    direction: [Math.cos(angle), Math.sin(angle)],
    confidence: detected ? 0.7 + Math.random() * 0.3 : 0.1 + Math.random() * 0.2,
  };
}

export function generateSensorReading(
  gripForce: number,
  friction: number,
  slip: SlipEvent,
  time: number
): BioTacReading {
  let grid = generateBasePattern(gripForce, friction);

  if (slip.detected) {
    grid = addSlipPattern(grid, slip.magnitude, slip.direction, time);
  }

  grid = addSensorNoise(grid, 0.03);

  const avgPressure =
    grid.flat().reduce((s, v) => s + v, 0) / ELECTRODE_COUNT;

  return {
    electrodes: grid,
    pressure: avgPressure * gripForce,
    temperature: 25 + gripForce * 2 + Math.random() * 0.5,
    impedance: 1000 - avgPressure * 400 + Math.random() * 20,
    timestamp: time,
  };
}

export function aiController(
  currentForce: number,
  slip: SlipEvent,
  _sensorReading: BioTacReading
): { force: number; confidence: number } {
  if (slip.detected) {
    const boost = slip.magnitude * 0.8 * slip.confidence;
    return {
      force: Math.min(1, currentForce + boost),
      confidence: slip.confidence,
    };
  }
  const relax = 0.002;
  return {
    force: Math.max(0.1, currentForce - relax),
    confidence: 0.9 + Math.random() * 0.1,
  };
}

export function traditionalController(
  currentForce: number,
  slip: SlipEvent
): number {
  if (slip.detected) {
    return Math.min(1, currentForce + 0.15);
  }
  return Math.max(0.1, currentForce - 0.001);
}

const HISTORY_LENGTH = 120;

export function createInitialState(): SimulationState {
  return {
    time: 0,
    gripForce: 0.3,
    targetForce: 0.5,
    objectWeight: 0.4,
    objectFriction: 0.6,
    sensorReading: generateSensorReading(0.3, 0.6, { detected: false, magnitude: 0, direction: [0, 0], confidence: 0 }, 0),
    slipEvent: { detected: false, magnitude: 0, direction: [0, 0], confidence: 0 },
    isGrasping: true,
    armJointAngles: [0, -0.4, 0.8, -0.4, 0, 0],
    controlMode: 'ai',
    aiConfidence: 0.95,
    slipHistory: new Array(HISTORY_LENGTH).fill(0),
    forceHistory: new Array(HISTORY_LENGTH).fill(0.3),
    pressureHistory: new Array(HISTORY_LENGTH).fill(0.15),
  };
}

export function stepSimulation(
  state: SimulationState,
  dt: number,
  params: { objectWeight: number; objectFriction: number; controlMode: 'ai' | 'traditional' }
): SimulationState {
  const time = state.time + dt;
  const { objectWeight, objectFriction, controlMode } = params;

  const weightOscillation = Math.sin(time * 0.7) * 0.08 + Math.sin(time * 1.3) * 0.04;
  const effectiveWeight = objectWeight + weightOscillation;

  const slip = computeSlip(state.gripForce, effectiveWeight, objectFriction);

  let gripForce: number;
  let aiConfidence: number;

  if (controlMode === 'ai') {
    const result = aiController(state.gripForce, slip, state.sensorReading);
    gripForce = result.force;
    aiConfidence = result.confidence;
  } else {
    gripForce = traditionalController(state.gripForce, slip);
    aiConfidence = 0;
  }

  const sensorReading = generateSensorReading(gripForce, objectFriction, slip, time);

  const armBase = Math.sin(time * 0.3) * 0.1;
  const armJointAngles = [
    armBase,
    -0.4 + Math.sin(time * 0.5) * 0.05,
    0.8 + Math.sin(time * 0.4) * 0.03,
    -0.4 + Math.sin(time * 0.6) * 0.04,
    Math.sin(time * 0.2) * 0.05,
    gripForce * 0.3,
  ];

  const slipHistory = [...state.slipHistory.slice(1), slip.magnitude];
  const forceHistory = [...state.forceHistory.slice(1), gripForce];
  const pressureHistory = [...state.pressureHistory.slice(1), sensorReading.pressure];

  return {
    time,
    gripForce,
    targetForce: objectWeight / (objectFriction * 2),
    objectWeight: effectiveWeight,
    objectFriction,
    sensorReading,
    slipEvent: slip,
    isGrasping: true,
    armJointAngles,
    controlMode,
    aiConfidence,
    slipHistory,
    forceHistory,
    pressureHistory,
  };
}
