import {
  relativeToAbsoluteTcpOrientationDeg,
  PAPER_DH_GEOMETRY_METERS,
  PAPER_TO_URDF_FRAME_CALIBRATION,
  paperToUrdfJointsDeg,
  type PaperDhGeometry,
} from "./armGeometry";
import { selectBestSolution } from "./selectBestSolution";
import type { AnalyticIkCandidate, AnalyticIkResult, AnalyticIkSolver, JointVector, TcpPose } from "./types";

export type SolveAnalyticIkOptions = {
  currentJointsDeg: JointVector;
  solver: AnalyticIkSolver | null;
  maxJumpDeg?: number;
};

export function solveAnalyticIkPreview(targetPose: TcpPose, options: SolveAnalyticIkOptions): AnalyticIkResult {
  if (!options.solver) {
    return {
      status: "solver_unavailable",
      selected: null,
      candidates: [],
      message: "Analytic IK solver is not configured yet.",
    };
  }

  const candidates = normalizeCandidates(options.solver(targetPose));

  if (candidates.length === 0) {
    return {
      status: "unreachable",
      selected: null,
      candidates: [],
      message: "Target pose is unreachable.",
    };
  }

  const selection = selectBestSolution(candidates, options.currentJointsDeg, {
    maxJumpDeg: options.maxJumpDeg,
  });

  if (!selection.selected) {
    return {
      status: "jump_rejected",
      selected: null,
      candidates,
      message: "All IK branches were rejected by limits or jump filtering.",
    };
  }

  return {
    status: "ok",
    selected: selection.selected,
    candidates,
    message: "",
  };
}

function normalizeCandidates(candidates: AnalyticIkCandidate[]): AnalyticIkCandidate[] {
  return candidates.filter((candidate) => candidate.jointsDeg.length === 6);
}

export function createPaperAnalyticIkSolver(geometry: PaperDhGeometry = PAPER_DH_GEOMETRY_METERS): AnalyticIkSolver {
  return (targetPose) => solvePaperAnalyticIk(targetPose, geometry);
}

function solvePaperAnalyticIk(targetPose: TcpPose, geometry: PaperDhGeometry): AnalyticIkCandidate[] {
  const absoluteOrientationUrdf = relativeToAbsoluteTcpOrientationDeg([
    targetPose.orientation.roll,
    targetPose.orientation.pitch,
    targetPose.orientation.yaw,
  ]);
  const targetRotationUrdf = rotationMatrixFromRpyDeg(
    absoluteOrientationUrdf[0],
    absoluteOrientationUrdf[1],
    absoluteOrientationUrdf[2],
  );
  const { position: targetPosition, rotation: targetRotation } = urdfPoseToPaperFrame(
    {
      x: targetPose.position.x,
      y: targetPose.position.y,
      z: targetPose.position.z,
    },
    targetRotationUrdf,
  );

  const toolDirection = [targetRotation[0][2], targetRotation[1][2], targetRotation[2][2]] as const;
  const wristCenter = {
    x: targetPosition.x - geometry.d6 * toolDirection[0],
    y: targetPosition.y - geometry.d6 * toolDirection[1],
    z: targetPosition.z - geometry.d6 * toolDirection[2],
  };

  // q1 is determined from the TCP ray projected back by the wrist-5 length
  // plus the gripper/TCP length. This matches the current manipulator geometry
  // better than using only the paper's d6 wrist-center shift.
  const baseHeadingPoint = {
    x: targetPosition.x - (geometry.d4 + geometry.d6) * toolDirection[0],
    y: targetPosition.y - (geometry.d4 + geometry.d6) * toolDirection[1],
    z: targetPosition.z - (geometry.d4 + geometry.d6) * toolDirection[2],
  };

  const c = Math.hypot(wristCenter.x, wristCenter.y);
  const b = wristCenter.z - geometry.d1;
  const radial = Math.hypot(c, b);
  const alpha = Math.atan2(geometry.d4, geometry.a3);
  const wristTriangle = Math.hypot(geometry.a3, geometry.d4);

  if (radial < EPSILON || wristTriangle < EPSILON) {
    return [];
  }

  const gammaArg = clampToUnit(
    (geometry.a2 * geometry.a2 + wristTriangle * wristTriangle - radial * radial) / (2 * geometry.a2 * wristTriangle),
  );
  const lambdaArg = clampToUnit(
    (geometry.a2 * geometry.a2 + radial * radial - wristTriangle * wristTriangle) / (2 * geometry.a2 * radial),
  );

  if (gammaArg === null || lambdaArg === null) {
    return [];
  }

  const theta1 = Math.PI / 2 + Math.atan2(baseHeadingPoint.y, baseHeadingPoint.x);
  const mu = Math.atan2(b, c);
  const gamma = Math.acos(gammaArg);
  const lambda = Math.acos(lambdaArg);

  const candidates: AnalyticIkCandidate[] = [];

  for (const elbowSign of [1, -1] as const) {
    const theta2 = Math.PI / 2 + mu - elbowSign * lambda;
    const theta3 = Math.PI + theta2 - alpha - elbowSign * gamma;

    const r03 = rotation03(theta1, theta2, theta3, geometry);
    const r36 = multiplyMatrix3(transposeMatrix3(r03), targetRotation);
    const wristSolutions = solveWristOrientation(r36);

    wristSolutions.forEach((wrist, index) => {
      const jointsRad: JointVector = [
        wrapToPi(theta1),
        wrapToPi(theta2),
        wrapToPi(theta3),
        wrapToPi(wrist[0]),
        wrapToPi(wrist[1]),
        wrapToPi(wrist[2]),
      ];

      candidates.push({
        jointsDeg: paperToUrdfJointsDeg(jointsRad.map(radToDeg) as JointVector),
        branchId: `elbow_${elbowSign > 0 ? "up" : "down"}_wrist_${index}`,
      });
    });
  }

  return dedupeCandidates(candidates);
}

function urdfPoseToPaperFrame(
  positionUrdf: { x: number; y: number; z: number },
  rotationUrdf: Matrix3,
): { position: { x: number; y: number; z: number }; rotation: Matrix3 } {
  const calibrationRotation = PAPER_TO_URDF_FRAME_CALIBRATION.rotation;
  const calibrationTranslation = PAPER_TO_URDF_FRAME_CALIBRATION.translationMeters;
  const inverseRotation = transposeMatrix3(calibrationRotation);
  const translated: [number, number, number] = [
    positionUrdf.x - calibrationTranslation[0],
    positionUrdf.y - calibrationTranslation[1],
    positionUrdf.z - calibrationTranslation[2],
  ];
  const positionPaper = multiplyMatrix3Vector(inverseRotation, translated);
  const rotationPaper = multiplyMatrix3(inverseRotation, rotationUrdf);

  return {
    position: {
      x: positionPaper[0],
      y: positionPaper[1],
      z: positionPaper[2],
    },
    rotation: rotationPaper,
  };
}

function solveWristOrientation(r36: Matrix3): [number, number, number][] {
  const r13 = r36[0][2];
  const r23 = r36[1][2];
  const r31 = r36[2][0];
  const r32 = r36[2][1];
  const r33 = r36[2][2];

  const q5 = Math.acos(clamp(r33, -1, 1));
  const sinQ5 = Math.sin(q5);

  if (Math.abs(sinQ5) < 1e-5) {
    const combined = Math.atan2(r36[1][0], r36[0][0]);
    return [[0, q5, wrapToPi(combined)]];
  }

  const q4 = Math.atan2(r23, r13);
  const q6 = Math.atan2(r32, -r31);

  return [
    [q4, q5, q6],
    [wrapToPi(q4 + Math.PI), wrapToPi(-q5), wrapToPi(q6 + Math.PI)],
  ];
}

function rotation03(theta1: number, theta2: number, theta3: number, geometry: PaperDhGeometry): Matrix3 {
  const t1 = transformFromDh(0, Math.PI / 2, geometry.d1, theta1);
  const t2 = transformFromDh(geometry.a2, 0, 0, theta2 + Math.PI / 2);
  const t3 = transformFromDh(geometry.a3, Math.PI / 2, 0, theta3);

  const t03 = multiplyMatrix4(multiplyMatrix4(t1, t2), t3);
  return [
    [t03[0][0], t03[0][1], t03[0][2]],
    [t03[1][0], t03[1][1], t03[1][2]],
    [t03[2][0], t03[2][1], t03[2][2]],
  ];
}

function rotationMatrixFromRpyDeg(rollDeg: number, pitchDeg: number, yawDeg: number): Matrix3 {
  const roll = degToRad(rollDeg);
  const pitch = degToRad(pitchDeg);
  const yaw = degToRad(yawDeg);

  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);

  const rx: Matrix3 = [
    [1, 0, 0],
    [0, cr, -sr],
    [0, sr, cr],
  ];
  const ry: Matrix3 = [
    [cp, 0, sp],
    [0, 1, 0],
    [-sp, 0, cp],
  ];
  const rz: Matrix3 = [
    [cy, -sy, 0],
    [sy, cy, 0],
    [0, 0, 1],
  ];

  return multiplyMatrix3(multiplyMatrix3(rz, ry), rx);
}

function transformFromDh(a: number, alpha: number, d: number, theta: number): Matrix4 {
  const ct = Math.cos(theta);
  const st = Math.sin(theta);
  const ca = Math.cos(alpha);
  const sa = Math.sin(alpha);

  return [
    [ct, -st * ca, st * sa, a * ct],
    [st, ct * ca, -ct * sa, a * st],
    [0, sa, ca, d],
    [0, 0, 0, 1],
  ];
}

function transposeMatrix3(m: Matrix3): Matrix3 {
  return [
    [m[0][0], m[1][0], m[2][0]],
    [m[0][1], m[1][1], m[2][1]],
    [m[0][2], m[1][2], m[2][2]],
  ];
}

function multiplyMatrix3(left: Matrix3, right: Matrix3): Matrix3 {
  return [
    [
      left[0][0] * right[0][0] + left[0][1] * right[1][0] + left[0][2] * right[2][0],
      left[0][0] * right[0][1] + left[0][1] * right[1][1] + left[0][2] * right[2][1],
      left[0][0] * right[0][2] + left[0][1] * right[1][2] + left[0][2] * right[2][2],
    ],
    [
      left[1][0] * right[0][0] + left[1][1] * right[1][0] + left[1][2] * right[2][0],
      left[1][0] * right[0][1] + left[1][1] * right[1][1] + left[1][2] * right[2][1],
      left[1][0] * right[0][2] + left[1][1] * right[1][2] + left[1][2] * right[2][2],
    ],
    [
      left[2][0] * right[0][0] + left[2][1] * right[1][0] + left[2][2] * right[2][0],
      left[2][0] * right[0][1] + left[2][1] * right[1][1] + left[2][2] * right[2][1],
      left[2][0] * right[0][2] + left[2][1] * right[1][2] + left[2][2] * right[2][2],
    ],
  ];
}

function multiplyMatrix3Vector(matrix: Matrix3, vector: readonly [number, number, number]): [number, number, number] {
  return [
    matrix[0][0] * vector[0] + matrix[0][1] * vector[1] + matrix[0][2] * vector[2],
    matrix[1][0] * vector[0] + matrix[1][1] * vector[1] + matrix[1][2] * vector[2],
    matrix[2][0] * vector[0] + matrix[2][1] * vector[1] + matrix[2][2] * vector[2],
  ];
}

function multiplyMatrix4(left: Matrix4, right: Matrix4): Matrix4 {
  const result = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => 0)) as Matrix4;
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      for (let k = 0; k < 4; k += 1) {
        result[row][col] += left[row][k] * right[k][col];
      }
    }
  }
  return result;
}

function dedupeCandidates(candidates: AnalyticIkCandidate[]): AnalyticIkCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = candidate.jointsDeg.map((value) => value.toFixed(4)).join("|");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function degToRad(value: number): number {
  return (value * Math.PI) / 180;
}

function radToDeg(value: number): number {
  return (value * 180) / Math.PI;
}

function wrapToPi(value: number): number {
  let wrapped = value;
  while (wrapped <= -Math.PI) {
    wrapped += Math.PI * 2;
  }
  while (wrapped > Math.PI) {
    wrapped -= Math.PI * 2;
  }
  return wrapped;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}


function clampToUnit(value: number): number | null {
  if (Number.isNaN(value)) {
    return null;
  }
  if (value < -1 - EPSILON || value > 1 + EPSILON) {
    return null;
  }
  return clamp(value, -1, 1);
}

type Matrix3 = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
];

type Matrix4 = [
  [number, number, number, number],
  [number, number, number, number],
  [number, number, number, number],
  [number, number, number, number],
];

const EPSILON = 1e-6;
