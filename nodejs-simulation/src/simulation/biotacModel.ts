export const SENSOR_ROWS = 6;
export const SENSOR_COLS = 8;
export const ELECTRODE_COUNT = SENSOR_ROWS * SENSOR_COLS;

// ── Data types ──────────────────────────────────────────────

export interface BioTacReading {
  electrodes: number[][];
  pressure: number;
  temperature: number;
  impedance: number;
}

export interface SlipEvent {
  detected: boolean;
  magnitude: number;
  direction: [number, number];
  confidence: number;
}

export type ControlMode = 'ai' | 'traditional';
export type ScenarioType = 'steady' | 'weight_surge' | 'friction_drop' | 'vibration' | 'stress_test';

export interface ControllerState {
  gripForce: number;
  slipEvent: SlipEvent;
  sensorReading: BioTacReading;
  cumulativeSlip: number;
  objectDropped: boolean;
  objectY: number;
  objectVelocityY: number;
  dropCount: number;
  gripScore: number;
  forceHistory: number[];
  slipHistory: number[];
}

export interface Scenario {
  type: ScenarioType;
  label: string;
  description: string;
  duration: number;
  active: boolean;
}

export interface SimulationState {
  time: number;
  activeMode: ControlMode;        // which controller drives the visual arm
  ai: ControllerState;            // AI controller (always running)
  pid: ControllerState;           // PID controller (always running)
  scenario: Scenario;
  scenarioTimer: number;
  objectWeight: number;
  objectFriction: number;
  baseWeight: number;
  baseFriction: number;
  jointAngles: number[];          // arm kinematics (driven by activeMode)
}

// ── Scenarios ───────────────────────────────────────────────

export const SCENARIOS: Record<ScenarioType, Omit<Scenario, 'active'>> = {
  steady: {
    type: 'steady',
    label: 'Steady State',
    description: 'Normal conditions — baseline comparison',
    duration: Infinity,
  },
  weight_surge: {
    type: 'weight_surge',
    label: 'Sudden Weight',
    description: 'Object weight triples — tests reaction speed',
    duration: 10,
  },
  friction_drop: {
    type: 'friction_drop',
    label: 'Oil Spill',
    description: 'Surface friction drops 70% — tests adaptive grip',
    duration: 10,
  },
  vibration: {
    type: 'vibration',
    label: 'Vibration',
    description: 'Rapid external perturbation shakes the object',
    duration: 10,
  },
  stress_test: {
    type: 'stress_test',
    label: 'Stress Test',
    description: 'Escalating difficulty over time',
    duration: 15,
  },
};

// ── Sensor model ────────────────────────────────────────────

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
      row.push(Math.max(0, Math.min(1, gaussian * gripForce * friction)));
    }
    grid.push(row);
  }
  return grid;
}

function addSlipPattern(grid: number[][], mag: number, dir: [number, number], time: number): number[][] {
  return grid.map((row, r) =>
    row.map((val, c) => {
      const phase = (c * dir[0] + r * dir[1]) * 0.5 + time * 8;
      const wave = Math.sin(phase) * 0.5 + 0.5;
      return Math.max(0, Math.min(1, val + wave * mag * 0.4 + (Math.random() - 0.5) * mag * 0.15));
    })
  );
}

function generateSensorReading(gripForce: number, friction: number, slip: SlipEvent, time: number): BioTacReading {
  let grid = generateBasePattern(gripForce, friction);
  if (slip.detected) grid = addSlipPattern(grid, slip.magnitude, slip.direction, time);
  // Add noise
  grid = grid.map(row => row.map(v => Math.max(0, Math.min(1, v + (Math.random() - 0.5) * 0.03))));
  const avg = grid.flat().reduce((s, v) => s + v, 0) / ELECTRODE_COUNT;
  return {
    electrodes: grid,
    pressure: avg * gripForce,
    temperature: 25 + gripForce * 2 + Math.random() * 0.5,
    impedance: 1000 - avg * 400 + Math.random() * 20,
  };
}

// ── Slip + controllers ──────────────────────────────────────

function computeSlip(gripForce: number, weight: number, friction: number): SlipEvent {
  const holdingForce = gripForce * friction * 2;
  const ratio = Math.max(0, 1 - holdingForce / Math.max(weight, 0.01));
  const mag = ratio * ratio;
  const angle = Math.random() * Math.PI * 2;
  return {
    detected: mag > 0.05,
    magnitude: mag,
    direction: [Math.cos(angle), Math.sin(angle)],
    confidence: mag > 0.05 ? 0.7 + Math.random() * 0.3 : 0.1 + Math.random() * 0.2,
  };
}

function aiControl(force: number, slip: SlipEvent): number {
  if (slip.detected) return Math.min(1, force + slip.magnitude * 1.2 * slip.confidence);
  return Math.max(0.15, force - 0.003);
}

function pidControl(force: number, slip: SlipEvent): number {
  if (slip.detected) return Math.min(1, force + 0.06);
  return Math.max(0.15, force - 0.001);
}

// ── Scenario effects ────────────────────────────────────────

function applyScenario(bw: number, bf: number, sc: Scenario, timer: number, time: number) {
  if (!sc.active) return { weight: bw, friction: bf };
  switch (sc.type) {
    case 'steady': return { weight: bw, friction: bf };
    case 'weight_surge': return { weight: bw + (timer > 1 ? 2 * bw : 0), friction: bf };
    case 'friction_drop': return { weight: bw, friction: bf * (timer > 1 ? 0.3 : 1) };
    case 'vibration': {
      const v = Math.sin(time * 25) * 0.3 + Math.sin(time * 37) * 0.15;
      return { weight: bw + v * bw, friction: bf };
    }
    case 'stress_test': {
      const p = Math.min(timer / sc.duration, 1);
      return { weight: bw + p * 1.5 * bw, friction: bf * (1 - p * 0.6) };
    }
    default: return { weight: bw, friction: bf };
  }
}

// ── Controller state stepping ───────────────────────────────

const HISTORY_LEN = 120;
const DROP_THRESHOLD = 0.6;
const GRAVITY = 9.8;

function createControllerState(): ControllerState {
  const noSlip: SlipEvent = { detected: false, magnitude: 0, direction: [0, 0], confidence: 0 };
  return {
    gripForce: 0.3,
    slipEvent: noSlip,
    sensorReading: generateSensorReading(0.3, 0.6, noSlip, 0),
    cumulativeSlip: 0,
    objectDropped: false,
    objectY: 0,
    objectVelocityY: 0,
    dropCount: 0,
    gripScore: 100,
    forceHistory: new Array(HISTORY_LEN).fill(0.3),
    slipHistory: new Array(HISTORY_LEN).fill(0),
  };
}

function stepController(
  cs: ControllerState,
  mode: ControlMode,
  weight: number,
  friction: number,
  dt: number,
  time: number,
): ControllerState {
  // Falling object
  if (cs.objectDropped) {
    const vy = cs.objectVelocityY - GRAVITY * dt;
    let y = cs.objectY + vy * dt;
    if (y < -1.65) {
      y = -1.65;
      if (Math.abs(vy) < 0.5) {
        return { ...cs, objectY: y, objectVelocityY: 0,
          slipHistory: [...cs.slipHistory.slice(1), 1],
          forceHistory: [...cs.forceHistory.slice(1), cs.gripForce] };
      }
      return { ...cs, objectY: y, objectVelocityY: -vy * 0.3,
        slipHistory: [...cs.slipHistory.slice(1), 1],
        forceHistory: [...cs.forceHistory.slice(1), cs.gripForce] };
    }
    return { ...cs, objectY: y, objectVelocityY: vy,
      slipHistory: [...cs.slipHistory.slice(1), 1],
      forceHistory: [...cs.forceHistory.slice(1), cs.gripForce] };
  }

  const slip = computeSlip(cs.gripForce, weight, friction);
  const gripForce = mode === 'ai' ? aiControl(cs.gripForce, slip) : pidControl(cs.gripForce, slip);
  const sensor = generateSensorReading(gripForce, friction, slip, time);

  let cumSlip = cs.cumulativeSlip;
  if (slip.detected) cumSlip += slip.magnitude * dt * 3;
  else cumSlip = Math.max(0, cumSlip - dt * 0.3);

  const dropped = cumSlip > DROP_THRESHOLD;
  const objY = slip.detected ? -slip.magnitude * 0.08 : 0;
  const score = Math.max(0, Math.min(100, 100 - cumSlip * 50 - cs.dropCount * 30));

  return {
    gripForce,
    slipEvent: slip,
    sensorReading: sensor,
    cumulativeSlip: cumSlip,
    objectDropped: dropped,
    objectY: dropped ? 0 : objY,
    objectVelocityY: dropped ? -0.5 : 0,
    dropCount: cs.dropCount,
    gripScore: score,
    forceHistory: [...cs.forceHistory.slice(1), gripForce],
    slipHistory: [...cs.slipHistory.slice(1), slip.magnitude],
  };
}

// ── Main simulation ─────────────────────────────────────────

export function createInitialState(): SimulationState {
  return {
    time: 0,
    activeMode: 'ai',
    ai: createControllerState(),
    pid: createControllerState(),
    scenario: { ...SCENARIOS.steady, active: false },
    scenarioTimer: 0,
    objectWeight: 0.4,
    objectFriction: 0.6,
    baseWeight: 0.4,
    baseFriction: 0.6,
    jointAngles: [0, -0.4, 0.8, -0.4, 0, 0],
  };
}

export function activateScenario(state: SimulationState, type: ScenarioType): SimulationState {
  return {
    ...state,
    ai: createControllerState(),
    pid: createControllerState(),
    scenario: { ...SCENARIOS[type], active: true },
    scenarioTimer: 0,
    objectWeight: state.baseWeight,
    objectFriction: state.baseFriction,
  };
}

export function stepSimulation(state: SimulationState, dt: number): SimulationState {
  const time = state.time + dt;
  const scenarioTimer = state.scenarioTimer + dt;

  const { weight, friction } = applyScenario(state.baseWeight, state.baseFriction, state.scenario, scenarioTimer, time);

  let scenario = state.scenario;
  if (scenario.active && scenarioTimer > scenario.duration) {
    scenario = { ...scenario, active: false };
  }

  // Auto-reset dropped objects
  let ai = state.ai;
  let pid = state.pid;
  if (ai.objectDropped && ai.objectY <= -1.65 && ai.objectVelocityY === 0) {
    ai = { ...createControllerState(), dropCount: ai.dropCount + 1, gripScore: Math.max(0, ai.gripScore - 30) };
  }
  if (pid.objectDropped && pid.objectY <= -1.65 && pid.objectVelocityY === 0) {
    pid = { ...createControllerState(), dropCount: pid.dropCount + 1, gripScore: Math.max(0, pid.gripScore - 30) };
  }

  const newAi = stepController(ai, 'ai', weight, friction, dt, time);
  const newPid = stepController(pid, 'traditional', weight, friction, dt, time);

  // Arm kinematics driven by active mode
  const active = state.activeMode === 'ai' ? newAi : newPid;
  const armBase = Math.sin(time * 0.3) * 0.08;
  const jointAngles = [
    armBase,
    -0.4 + Math.sin(time * 0.5) * 0.04,
    0.8 + Math.sin(time * 0.4) * 0.03,
    -0.4 + Math.sin(time * 0.6) * 0.03,
    Math.sin(time * 0.2) * 0.04,
    active.gripForce * 0.3,
  ];

  return {
    time,
    activeMode: state.activeMode,
    ai: newAi,
    pid: newPid,
    scenario,
    scenarioTimer,
    objectWeight: weight,
    objectFriction: friction,
    baseWeight: state.baseWeight,
    baseFriction: state.baseFriction,
    jointAngles,
  };
}
