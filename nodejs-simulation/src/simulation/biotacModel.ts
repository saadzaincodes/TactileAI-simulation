export const SENSOR_ROWS = 6;
export const SENSOR_COLS = 8;
export const ELECTRODE_COUNT = SENSOR_ROWS * SENSOR_COLS;

// ── Data types ──────────────────────────────────────────────

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

export type ControlMode = 'ai' | 'traditional';

export interface ArmState {
  gripForce: number;
  slipEvent: SlipEvent;
  sensorReading: BioTacReading;
  jointAngles: number[];
  aiConfidence: number;
  objectDropped: boolean;
  objectY: number;          // object vertical position (0 = held, negative = falling)
  objectVelocityY: number;
  cumulativeSlip: number;
  gripScore: number;        // 0–100 performance score
  dropCount: number;
  holdTime: number;         // seconds successfully held
  forceHistory: number[];
  slipHistory: number[];
}

export interface SimulationState {
  time: number;
  ai: ArmState;
  pid: ArmState;
  scenario: Scenario;
  scenarioTimer: number;
  objectWeight: number;
  objectFriction: number;
  baseWeight: number;
  baseFriction: number;
  isPaused: boolean;
}

// ── Scenarios ───────────────────────────────────────────────

export type ScenarioType = 'steady' | 'weight_surge' | 'friction_drop' | 'vibration' | 'stress_test';

export interface Scenario {
  type: ScenarioType;
  label: string;
  description: string;
  duration: number;
  active: boolean;
}

export const SCENARIOS: Record<ScenarioType, Omit<Scenario, 'active'>> = {
  steady: {
    type: 'steady',
    label: 'Steady State',
    description: 'Normal grip conditions — baseline comparison',
    duration: Infinity,
  },
  weight_surge: {
    type: 'weight_surge',
    label: 'Sudden Weight',
    description: 'Object weight triples suddenly — tests reaction speed',
    duration: 8,
  },
  friction_drop: {
    type: 'friction_drop',
    label: 'Oil Spill',
    description: 'Surface friction drops sharply — tests adaptive grip',
    duration: 8,
  },
  vibration: {
    type: 'vibration',
    label: 'Vibration',
    description: 'External perturbation shakes the object rapidly',
    duration: 8,
  },
  stress_test: {
    type: 'stress_test',
    label: 'Stress Test',
    description: 'Escalating difficulty — weight up, friction down over time',
    duration: 12,
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
      const base = gaussian * gripForce * friction;
      row.push(Math.max(0, Math.min(1, base)));
    }
    grid.push(row);
  }
  return grid;
}

function addSlipPattern(grid: number[][], slipMag: number, slipDir: [number, number], time: number): number[][] {
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

export function generateSensorReading(gripForce: number, friction: number, slip: SlipEvent, time: number): BioTacReading {
  let grid = generateBasePattern(gripForce, friction);
  if (slip.detected) {
    grid = addSlipPattern(grid, slip.magnitude, slip.direction, time);
  }
  grid = addSensorNoise(grid, 0.03);
  const avgPressure = grid.flat().reduce((s, v) => s + v, 0) / ELECTRODE_COUNT;

  return {
    electrodes: grid,
    pressure: avgPressure * gripForce,
    temperature: 25 + gripForce * 2 + Math.random() * 0.5,
    impedance: 1000 - avgPressure * 400 + Math.random() * 20,
    timestamp: time,
  };
}

// ── Slip computation ────────────────────────────────────────

export function computeSlip(gripForce: number, objectWeight: number, friction: number): SlipEvent {
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

// ── Controllers ─────────────────────────────────────────────

function aiController(currentForce: number, slip: SlipEvent, _sensor: BioTacReading): { force: number; confidence: number } {
  if (slip.detected) {
    // Fast, proportional response — reacts strongly to high-confidence slip
    const boost = slip.magnitude * 1.2 * slip.confidence;
    return {
      force: Math.min(1, currentForce + boost),
      confidence: slip.confidence,
    };
  }
  // Slow relaxation to avoid over-gripping
  return {
    force: Math.max(0.15, currentForce - 0.003),
    confidence: 0.9 + Math.random() * 0.1,
  };
}

function pidController(currentForce: number, slip: SlipEvent): number {
  if (slip.detected) {
    // Fixed increment — slower, less adaptive
    return Math.min(1, currentForce + 0.06);
  }
  return Math.max(0.15, currentForce - 0.001);
}

// ── Scenario effects ────────────────────────────────────────

function applyScenario(
  baseWeight: number,
  baseFriction: number,
  scenario: Scenario,
  timer: number,
  time: number,
): { weight: number; friction: number } {
  if (!scenario.active) return { weight: baseWeight, friction: baseFriction };

  const progress = Math.min(timer / scenario.duration, 1);

  switch (scenario.type) {
    case 'steady':
      return { weight: baseWeight, friction: baseFriction };

    case 'weight_surge': {
      // Weight triples at t=1s, stays for duration
      const surge = timer > 1 ? 2.0 : 0;
      return { weight: baseWeight + surge * baseWeight, friction: baseFriction };
    }

    case 'friction_drop': {
      // Friction drops to 30% at t=1s
      const drop = timer > 1 ? 0.7 : 0;
      return { weight: baseWeight, friction: baseFriction * (1 - drop) };
    }

    case 'vibration': {
      // Rapid weight oscillation simulating vibration
      const vib = Math.sin(time * 25) * 0.3 + Math.sin(time * 37) * 0.15;
      return { weight: baseWeight + vib * baseWeight, friction: baseFriction };
    }

    case 'stress_test': {
      // Gradual increase in difficulty
      const wBoost = progress * 1.5 * baseWeight;
      const fDrop = progress * 0.6;
      return { weight: baseWeight + wBoost, friction: baseFriction * (1 - fDrop) };
    }

    default:
      return { weight: baseWeight, friction: baseFriction };
  }
}

// ── Arm state management ────────────────────────────────────

const HISTORY_LENGTH = 120;
const DROP_THRESHOLD = 0.6;   // cumulative slip before drop
const GRAVITY = 9.8;

function createArmState(): ArmState {
  const emptySlip: SlipEvent = { detected: false, magnitude: 0, direction: [0, 0], confidence: 0 };
  return {
    gripForce: 0.3,
    slipEvent: emptySlip,
    sensorReading: generateSensorReading(0.3, 0.6, emptySlip, 0),
    jointAngles: [0, -0.4, 0.8, -0.4, 0, 0],
    aiConfidence: 0.95,
    objectDropped: false,
    objectY: 0,
    objectVelocityY: 0,
    cumulativeSlip: 0,
    gripScore: 100,
    dropCount: 0,
    holdTime: 0,
    forceHistory: new Array(HISTORY_LENGTH).fill(0.3),
    slipHistory: new Array(HISTORY_LENGTH).fill(0),
  };
}

function stepArm(
  arm: ArmState,
  mode: ControlMode,
  weight: number,
  friction: number,
  dt: number,
  time: number,
): ArmState {
  // If object is dropped, simulate falling
  if (arm.objectDropped) {
    const newVelY = arm.objectVelocityY - GRAVITY * dt;
    let newY = arm.objectY + newVelY * dt;

    // Bounce on ground
    if (newY < -1.65) {
      newY = -1.65;
      // Reset after hitting ground and settling
      if (Math.abs(newVelY) < 0.5) {
        // Object rests on ground, will auto-reset after a delay
        return {
          ...arm,
          objectY: newY,
          objectVelocityY: 0,
          slipHistory: [...arm.slipHistory.slice(1), 1],
          forceHistory: [...arm.forceHistory.slice(1), arm.gripForce],
        };
      }
      return {
        ...arm,
        objectY: newY,
        objectVelocityY: -newVelY * 0.3, // bounce with damping
        slipHistory: [...arm.slipHistory.slice(1), 1],
        forceHistory: [...arm.forceHistory.slice(1), arm.gripForce],
      };
    }

    return {
      ...arm,
      objectY: newY,
      objectVelocityY: newVelY,
      slipHistory: [...arm.slipHistory.slice(1), 1],
      forceHistory: [...arm.forceHistory.slice(1), arm.gripForce],
    };
  }

  // Normal operation
  const slip = computeSlip(arm.gripForce, weight, friction);

  let gripForce: number;
  let aiConfidence: number;

  if (mode === 'ai') {
    const result = aiController(arm.gripForce, slip, arm.sensorReading);
    gripForce = result.force;
    aiConfidence = result.confidence;
  } else {
    gripForce = pidController(arm.gripForce, slip);
    aiConfidence = 0;
  }

  const sensorReading = generateSensorReading(gripForce, friction, slip, time);

  // Accumulate slip
  let cumulativeSlip = arm.cumulativeSlip;
  if (slip.detected) {
    cumulativeSlip += slip.magnitude * dt * 3;
  } else {
    cumulativeSlip = Math.max(0, cumulativeSlip - dt * 0.3); // recover slowly
  }

  // Check for drop
  const objectDropped = cumulativeSlip > DROP_THRESHOLD;
  const objectY = slip.detected ? -slip.magnitude * 0.08 : 0;

  // Calculate score
  const holdTime = arm.holdTime + dt;
  const dropCount = arm.dropCount + (objectDropped ? 1 : 0);
  const gripScore = Math.max(0, Math.min(100,
    100 - cumulativeSlip * 50 - dropCount * 30
  ));

  // Arm kinematics
  const armBase = Math.sin(time * 0.3) * 0.08;
  const jointAngles = [
    armBase,
    -0.4 + Math.sin(time * 0.5) * 0.04,
    0.8 + Math.sin(time * 0.4) * 0.03,
    -0.4 + Math.sin(time * 0.6) * 0.03,
    Math.sin(time * 0.2) * 0.04,
    gripForce * 0.3,
  ];

  return {
    gripForce,
    slipEvent: slip,
    sensorReading,
    jointAngles,
    aiConfidence,
    objectDropped,
    objectY: objectDropped ? 0 : objectY,
    objectVelocityY: objectDropped ? -0.5 : 0,
    cumulativeSlip,
    gripScore,
    dropCount,
    holdTime,
    forceHistory: [...arm.forceHistory.slice(1), gripForce],
    slipHistory: [...arm.slipHistory.slice(1), slip.magnitude],
  };
}

// ── Main simulation ─────────────────────────────────────────

export function createInitialState(): SimulationState {
  return {
    time: 0,
    ai: createArmState(),
    pid: createArmState(),
    scenario: { ...SCENARIOS.steady, active: false },
    scenarioTimer: 0,
    objectWeight: 0.4,
    objectFriction: 0.6,
    baseWeight: 0.4,
    baseFriction: 0.6,
    isPaused: false,
  };
}

export function activateScenario(state: SimulationState, type: ScenarioType): SimulationState {
  // Reset both arms when starting a new scenario
  return {
    ...state,
    ai: createArmState(),
    pid: createArmState(),
    scenario: { ...SCENARIOS[type], active: true },
    scenarioTimer: 0,
    objectWeight: state.baseWeight,
    objectFriction: state.baseFriction,
  };
}

export function resetDroppedObject(state: SimulationState, mode: ControlMode): SimulationState {
  const arm = mode === 'ai' ? state.ai : state.pid;
  const resetArm: ArmState = {
    ...arm,
    objectDropped: false,
    objectY: 0,
    objectVelocityY: 0,
    cumulativeSlip: 0,
    gripForce: 0.3,
  };
  return {
    ...state,
    [mode === 'ai' ? 'ai' : 'pid']: resetArm,
  };
}

export function stepSimulation(state: SimulationState, dt: number): SimulationState {
  if (state.isPaused) return state;

  const time = state.time + dt;
  const scenarioTimer = state.scenarioTimer + dt;

  // Apply scenario effects
  const { weight, friction } = applyScenario(
    state.baseWeight,
    state.baseFriction,
    state.scenario,
    scenarioTimer,
    time,
  );

  // Check if scenario ended
  let scenario = state.scenario;
  if (scenario.active && scenarioTimer > scenario.duration) {
    scenario = { ...scenario, active: false };
  }

  // Auto-reset dropped objects after 3 seconds
  let ai = state.ai;
  let pid = state.pid;
  if (ai.objectDropped && ai.objectY <= -1.65 && ai.objectVelocityY === 0) {
    ai = { ...createArmState(), dropCount: ai.dropCount + 1, holdTime: ai.holdTime, gripScore: Math.max(0, ai.gripScore - 30) };
  }
  if (pid.objectDropped && pid.objectY <= -1.65 && pid.objectVelocityY === 0) {
    pid = { ...createArmState(), dropCount: pid.dropCount + 1, holdTime: pid.holdTime, gripScore: Math.max(0, pid.gripScore - 30) };
  }

  // Step both arms
  const newAi = stepArm(ai, 'ai', weight, friction, dt, time);
  const newPid = stepArm(pid, 'traditional', weight, friction, dt, time);

  return {
    time,
    ai: newAi,
    pid: newPid,
    scenario,
    scenarioTimer,
    objectWeight: weight,
    objectFriction: friction,
    baseWeight: state.baseWeight,
    baseFriction: state.baseFriction,
    isPaused: state.isPaused,
  };
}
