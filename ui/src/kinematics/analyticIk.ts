import { PAPER_DH_GEOMETRY_METERS, type PaperDhGeometry } from "./armGeometry";
import { normalizeQuaternion } from "./quaternion";
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
  const targetRotation = rotationMatrixFromQuaternion(targetPose.orientationQuaternion);
  const targetPosition = {
    x: targetPose.position.x,
    y: targetPose.position.y,
    z: targetPose.position.z,
  };

  const toolDirection = [targetRotation[0][2], targetRotation[1][2], targetRotation[2][2]] as const;
  const targetWristCenter = {
    x: targetPosition.x - geometry.d6 * toolDirection[0],
    y: targetPosition.y - geometry.d6 * toolDirection[1],
    z: targetPosition.z - geometry.d6 * toolDirection[2],
  };

  const theta1 = Math.atan2(targetWristCenter.y, targetWristCenter.x);
  const shoulderOrigin = {
    x: geometry.shoulderOffsetPlanar * Math.cos(theta1),
    y: geometry.shoulderOffsetPlanar * Math.sin(theta1),
  };
  const shoulderRelativeWristCenter = {
    x: targetWristCenter.x - shoulderOrigin.x,
    y: targetWristCenter.y - shoulderOrigin.y,
  };

  const wristCenterPlanarRadius = Math.hypot(shoulderRelativeWristCenter.x, shoulderRelativeWristCenter.y);
  const wristCenterHeightFromShoulder = targetWristCenter.z - geometry.d1;
  const shoulderToWristDistance = Math.hypot(wristCenterPlanarRadius, wristCenterHeightFromShoulder);
  const elbowToWristLength = Math.hypot(geometry.a3, geometry.d4);

  if (shoulderToWristDistance < EPSILON || elbowToWristLength < EPSILON) {
    return [];
  }

  const gammaArg = clampToUnit(
    (geometry.a2 * geometry.a2 +
      elbowToWristLength * elbowToWristLength -
      shoulderToWristDistance * shoulderToWristDistance) /
      (2 * geometry.a2 * elbowToWristLength),
  );
  const lambdaArg = clampToUnit(
    (geometry.a2 * geometry.a2 +
      shoulderToWristDistance * shoulderToWristDistance -
      elbowToWristLength * elbowToWristLength) /
      (2 * geometry.a2 * shoulderToWristDistance),
  );

  if (gammaArg === null || lambdaArg === null) {
    return [];
  }

  const mu = Math.atan2(wristCenterHeightFromShoulder, wristCenterPlanarRadius);
  const gamma =  Math.acos(gammaArg);
  const lambda = Math.acos(lambdaArg);

  const candidates: AnalyticIkCandidate[] = [];

  for (const elbowSign of [1, -1] as const) {
    const theta2 = Math.PI - (mu + elbowSign * lambda);
    const theta3 = - elbowSign * gamma; //Math.PI + theta2 - alpha -

    const r03 = rotation03Urdf(theta1, theta2, theta3);
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
      const refinedJoints =
        refineFullPoseNumerically(targetPosition, targetRotation, jointsRad) ?? jointsRad;

      candidates.push({
        jointsDeg: refinedJoints.map(radToDeg) as JointVector,
        branchId: `elbow_${elbowSign > 0 ? "up" : "down"}_wrist_${index}`,
      });
    });
  }

  return dedupeCandidates(candidates);
}

function solveWristOrientation(r36: Matrix3): [number, number, number][] {
  const seeds = analyticWristSeeds(r36);
  seeds.push([0, 0, 0]);
  seeds.push([Math.PI / 2, 0, 0]);
  seeds.push([-Math.PI / 2, 0, 0]);

  const solutions: [number, number, number][] = [];
  for (const seed of seeds) {
    const refined = refineWristOrientationNumerically(r36, seed);
    if (!refined) {
      continue;
    }
    solutions.push(refined);
  }

  return dedupeWristSolutions(solutions);
}

function refineFullPoseNumerically(
  targetPosition: { x: number; y: number; z: number },
  targetRotation: Matrix3,
  seed: JointVector,
): JointVector | null {
  let q: JointVector = [...seed] as JointVector;

  for (let iteration = 0; iteration < 18; iteration += 1) {
    const current = tcpPoseFromJointsUrdf(q);
    const error = fullPoseErrorVector(current.position, current.rotation, targetPosition, targetRotation);
    const positionError = Math.hypot(error[0], error[1], error[2]);
    const rotationError = Math.hypot(error[3], error[4], error[5]);

    if (positionError < 0.002 && rotationError < 0.02) {
      return q.map(wrapToPi) as JointVector;
    }

    const jacobian = numericalFullPoseJacobian(q, targetPosition, targetRotation);
    const step = solveLeastSquares6x6(jacobian, error);
    if (!step) {
      break;
    }

    const stepNorm = Math.hypot(...step);
    const scale = Math.min(1, 0.22 / Math.max(EPSILON, stepNorm));
    q = q.map((value, index) => wrapToPi(value + step[index] * scale)) as JointVector;
  }

  const finalPose = tcpPoseFromJointsUrdf(q);
  const finalError = fullPoseErrorVector(finalPose.position, finalPose.rotation, targetPosition, targetRotation);
  return Math.hypot(finalError[0], finalError[1], finalError[2]) < 0.01 ? (q.map(wrapToPi) as JointVector) : null;
}

function rotation03Urdf(theta1: number, theta2: number, theta3: number): Matrix3 {
  const root = rotationMatrixFromRpyRad(0, 0, 1.5708);
  const j1 = multiplyMatrix3(rotationMatrixFromRpyRad(Math.PI, 0, 0), rotationAroundAxis([0, 0, -1], theta1));
  const j2 = multiplyMatrix3(rotationMatrixFromRpyRad(1.5708, -1.0472, -1.5708), rotationAroundAxis([0, 0, -1], theta2));
  const j3 = multiplyMatrix3(rotationMatrixFromRpyRad(0, 0, 2.0708), rotationAroundAxis([0, 0, -1], theta3));
  return multiplyMatrix3(multiplyMatrix3(multiplyMatrix3(root, j1), j2), j3);
}

function rotationMatrixFromQuaternion(quaternion: TcpPose["orientationQuaternion"]): Matrix3 {
  const [x, y, z, w] = normalizeQuaternion(quaternion);

  return [
    [
      1 - 2 * (y * y + z * z),
      2 * (x * y - z * w),
      2 * (x * z + y * w),
    ],
    [
      2 * (x * y + z * w),
      1 - 2 * (x * x + z * z),
      2 * (y * z - x * w),
    ],
    [
      2 * (x * z - y * w),
      2 * (y * z + x * w),
      1 - 2 * (x * x + y * y),
    ],
  ];
}

function analyticWristSeeds(r36: Matrix3): [number, number, number][] {
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

function refineWristOrientationNumerically(
  targetR36: Matrix3,
  seed: [number, number, number],
): [number, number, number] | null {
  let q: [number, number, number] = [seed[0], seed[1], seed[2]];

  for (let iteration = 0; iteration < 24; iteration += 1) {
    const current = wristRotationUrdf(q[0], q[1], q[2]);
    const error = rotationErrorVector(current, targetR36);
    const errorNorm = Math.hypot(error[0], error[1], error[2]);

    if (errorNorm < 1e-4) {
      return [wrapToPi(q[0]), wrapToPi(q[1]), wrapToPi(q[2])];
    }

    const jacobian = numericalWristJacobian(q, targetR36);
    const step = solveLinear3x3(jacobian, error) ?? multiplyMatrix3Vector(transposeMatrix3(jacobian), error);
    const scale = Math.min(1, 0.35 / Math.max(EPSILON, Math.hypot(step[0], step[1], step[2])));

    q = [
      wrapToPi(q[0] + step[0] * scale),
      wrapToPi(q[1] + step[1] * scale),
      wrapToPi(q[2] + step[2] * scale),
    ];
  }

  const finalError = rotationErrorVector(wristRotationUrdf(q[0], q[1], q[2]), targetR36);
  return Math.hypot(finalError[0], finalError[1], finalError[2]) < 2e-3
    ? [wrapToPi(q[0]), wrapToPi(q[1]), wrapToPi(q[2])]
    : null;
}

function numericalWristJacobian(
  q: [number, number, number],
  targetR36: Matrix3,
): Matrix3 {
  const step = 1e-4;
  const baseError = rotationErrorVector(wristRotationUrdf(q[0], q[1], q[2]), targetR36);
  const columns: [number, number, number][] = [0, 1, 2].map((index) => {
    const nextQ: [number, number, number] = [q[0], q[1], q[2]];
    nextQ[index] += step;
    const nextError = rotationErrorVector(wristRotationUrdf(nextQ[0], nextQ[1], nextQ[2]), targetR36);
    return [
      (baseError[0] - nextError[0]) / step,
      (baseError[1] - nextError[1]) / step,
      (baseError[2] - nextError[2]) / step,
    ];
  }) as [number, number, number][];

  return [
    [columns[0][0], columns[1][0], columns[2][0]],
    [columns[0][1], columns[1][1], columns[2][1]],
    [columns[0][2], columns[1][2], columns[2][2]],
  ];
}

function wristRotationUrdf(q4: number, q5: number, q6: number): Matrix3 {
  const j4 = multiplyMatrix3(rotationMatrixFromRpyRad(1.5708, -1.2554, -1.5708), rotationAroundAxis([0, 0, -1], q4));
  const j5 = multiplyMatrix3(rotationMatrixFromRpyRad(1.5708, 0, -2.8262), rotationAroundAxis([1, 0, 0], q5));
  const j6 = multiplyMatrix3(rotationMatrixFromRpyRad(0, 0, -1.5708), rotationAroundAxis([0, 0, 1], q6));
  return multiplyMatrix3(multiplyMatrix3(j4, j5), j6);
}

function tcpPoseFromJointsUrdf(joints: JointVector): {
  position: { x: number; y: number; z: number };
  rotation: Matrix3;
} {
  let transform = identityTransform4();
  transform = multiplyTransform4(transform, transformFromRpyTranslation(0, 0, 1.5708, 0, 0, 0));
  transform = multiplyTransform4(transform, jointTransformFromUrdf(Math.PI, 0, 0, 0, 0, 0.003445, [0, 0, -1], joints[0]));
  transform = multiplyTransform4(
    transform,
    jointTransformFromUrdf(1.5708, -1.0472, -1.5708, 0, 0.064146, -0.16608, [0, 0, -1], joints[1]),
  );
  transform = multiplyTransform4(
    transform,
    jointTransformFromUrdf(0, 0, 2.0708, 0.1525, -0.26414, 0, [0, 0, -1], joints[2]),
  );
  transform = multiplyTransform4(
    transform,
    jointTransformFromUrdf(1.5708, -1.2554, -1.5708, 0, 0, 0.00675, [0, 0, -1], joints[3]),
  );
  transform = multiplyTransform4(
    transform,
    jointTransformFromUrdf(1.5708, 0, -2.8262, 0, 0, -0.22225, [1, 0, 0], joints[4]),
  );
  transform = multiplyTransform4(
    transform,
    jointTransformFromUrdf(0, 0, -1.5708, -0.000294, 0, 0.02117, [0, 0, 1], joints[5]),
  );
  transform = multiplyTransform4(transform, transformFromRpyTranslation(0, 0, 0, 0, 0, 0.0642));

  return {
    position: {
      x: transform[0][3],
      y: transform[1][3],
      z: transform[2][3],
    },
    rotation: [
      [transform[0][0], transform[0][1], transform[0][2]],
      [transform[1][0], transform[1][1], transform[1][2]],
      [transform[2][0], transform[2][1], transform[2][2]],
    ],
  };
}

function fullPoseErrorVector(
  currentPosition: { x: number; y: number; z: number },
  currentRotation: Matrix3,
  targetPosition: { x: number; y: number; z: number },
  targetRotation: Matrix3,
): [number, number, number, number, number, number] {
  const rotationError = rotationErrorVector(currentRotation, targetRotation);
  return [
    targetPosition.x - currentPosition.x,
    targetPosition.y - currentPosition.y,
    targetPosition.z - currentPosition.z,
    rotationError[0],
    rotationError[1],
    rotationError[2],
  ];
}

function numericalFullPoseJacobian(
  joints: JointVector,
  targetPosition: { x: number; y: number; z: number },
  targetRotation: Matrix3,
): number[][] {
  const step = 1e-4;
  const basePose = tcpPoseFromJointsUrdf(joints);
  const baseError = fullPoseErrorVector(basePose.position, basePose.rotation, targetPosition, targetRotation);
  return [0, 1, 2, 3, 4, 5].map((jointIndex) => {
    const next = [...joints] as JointVector;
    next[jointIndex] += step;
    const nextPose = tcpPoseFromJointsUrdf(next);
    const nextError = fullPoseErrorVector(nextPose.position, nextPose.rotation, targetPosition, targetRotation);
    return baseError.map((value, rowIndex) => (value - nextError[rowIndex]) / step);
  });
}

function solveLeastSquares6x6(jacobianColumns: number[][], error: [number, number, number, number, number, number]): number[] | null {
  const jt = transposeRectangular(jacobianColumns);
  const jtj = multiplyRectangular(jt, jacobianColumns);
  for (let i = 0; i < 6; i += 1) {
    jtj[i][i] += 1e-4;
  }
  const jte = multiplyRectangularVector(jt, error);
  return solveLinearSystem(jtj, jte);
}

function rotationErrorVector(current: Matrix3, target: Matrix3): [number, number, number] {
  const delta = multiplyMatrix3(target, transposeMatrix3(current));
  return rotationLogVector(delta);
}

function rotationLogVector(rotation: Matrix3): [number, number, number] {
  const trace = rotation[0][0] + rotation[1][1] + rotation[2][2];
  const cosAngle = clamp((trace - 1) * 0.5, -1, 1);
  const angle = Math.acos(cosAngle);

  if (angle < 1e-7) {
    return [
      0.5 * (rotation[2][1] - rotation[1][2]),
      0.5 * (rotation[0][2] - rotation[2][0]),
      0.5 * (rotation[1][0] - rotation[0][1]),
    ];
  }

  const sinAngle = Math.sin(angle);
  if (Math.abs(sinAngle) < 1e-7) {
    return [0, 0, 0];
  }

  const scale = angle / (2 * sinAngle);
  return [
    scale * (rotation[2][1] - rotation[1][2]),
    scale * (rotation[0][2] - rotation[2][0]),
    scale * (rotation[1][0] - rotation[0][1]),
  ];
}

type Transform4 = [
  [number, number, number, number],
  [number, number, number, number],
  [number, number, number, number],
  [number, number, number, number],
];

function identityTransform4(): Transform4 {
  return [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
}

function transformFromRpyTranslation(
  roll: number,
  pitch: number,
  yaw: number,
  x: number,
  y: number,
  z: number,
): Transform4 {
  const rotation = rotationMatrixFromRpyRad(roll, pitch, yaw);
  return [
    [rotation[0][0], rotation[0][1], rotation[0][2], x],
    [rotation[1][0], rotation[1][1], rotation[1][2], y],
    [rotation[2][0], rotation[2][1], rotation[2][2], z],
    [0, 0, 0, 1],
  ];
}

function jointTransformFromUrdf(
  roll: number,
  pitch: number,
  yaw: number,
  x: number,
  y: number,
  z: number,
  axis: [number, number, number],
  angle: number,
): Transform4 {
  const origin = transformFromRpyTranslation(roll, pitch, yaw, x, y, z);
  const jointRotation = rotationAroundAxis(axis, angle);
  const rotationTransform: Transform4 = [
    [jointRotation[0][0], jointRotation[0][1], jointRotation[0][2], 0],
    [jointRotation[1][0], jointRotation[1][1], jointRotation[1][2], 0],
    [jointRotation[2][0], jointRotation[2][1], jointRotation[2][2], 0],
    [0, 0, 0, 1],
  ];
  return multiplyTransform4(origin, rotationTransform);
}

function multiplyTransform4(a: Transform4, b: Transform4): Transform4 {
  const out = identityTransform4();
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      out[row][col] = 0;
      for (let k = 0; k < 4; k += 1) {
        out[row][col] += a[row][k] * b[k][col];
      }
    }
  }
  return out;
}

function rotationMatrixFromRpyRad(roll: number, pitch: number, yaw: number): Matrix3 {
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);

  return [
    [cy * cp, cy * sp * sr - sy * cr, cy * sp * cr + sy * sr],
    [sy * cp, sy * sp * sr + cy * cr, sy * sp * cr - cy * sr],
    [-sp, cp * sr, cp * cr],
  ];
}

function rotationAroundAxis(axis: [number, number, number], angle: number): Matrix3 {
  const [ax, ay, az] = normalizeVector3(axis);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const oneMinusC = 1 - c;

  return [
    [c + ax * ax * oneMinusC, ax * ay * oneMinusC - az * s, ax * az * oneMinusC + ay * s],
    [ay * ax * oneMinusC + az * s, c + ay * ay * oneMinusC, ay * az * oneMinusC - ax * s],
    [az * ax * oneMinusC - ay * s, az * ay * oneMinusC + ax * s, c + az * az * oneMinusC],
  ];
}

function normalizeVector3(vector: [number, number, number]): [number, number, number] {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  if (length < EPSILON) {
    return [0, 0, 1];
  }
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function solveLinear3x3(matrix: Matrix3, vector: [number, number, number]): [number, number, number] | null {
  const [[a, b, c], [d, e, f], [g, h, i]] = matrix;
  const determinant =
    a * (e * i - f * h) -
    b * (d * i - f * g) +
    c * (d * h - e * g);

  if (Math.abs(determinant) < 1e-8) {
    return null;
  }

  const invDet = 1 / determinant;
  const inverse: Matrix3 = [
    [(e * i - f * h) * invDet, (c * h - b * i) * invDet, (b * f - c * e) * invDet],
    [(f * g - d * i) * invDet, (a * i - c * g) * invDet, (c * d - a * f) * invDet],
    [(d * h - e * g) * invDet, (b * g - a * h) * invDet, (a * e - b * d) * invDet],
  ];

  return multiplyMatrix3Vector(inverse, vector);
}

function transposeRectangular(matrix: number[][]): number[][] {
  return matrix[0].map((_, columnIndex) => matrix.map((row) => row[columnIndex]));
}

function multiplyRectangular(a: number[][], b: number[][]): number[][] {
  return a.map((row) =>
    b[0].map((_, columnIndex) => row.reduce((sum, value, k) => sum + value * b[k][columnIndex], 0)),
  );
}

function multiplyRectangularVector(matrix: number[][], vector: number[]): number[] {
  return matrix.map((row) => row.reduce((sum, value, index) => sum + value * vector[index], 0));
}

function solveLinearSystem(matrix: number[][], vector: number[]): number[] | null {
  const n = vector.length;
  const a = matrix.map((row, index) => [...row, vector[index]]);

  for (let pivot = 0; pivot < n; pivot += 1) {
    let maxRow = pivot;
    for (let row = pivot + 1; row < n; row += 1) {
      if (Math.abs(a[row][pivot]) > Math.abs(a[maxRow][pivot])) {
        maxRow = row;
      }
    }

    if (Math.abs(a[maxRow][pivot]) < 1e-9) {
      return null;
    }

    [a[pivot], a[maxRow]] = [a[maxRow], a[pivot]];

    const pivotValue = a[pivot][pivot];
    for (let col = pivot; col <= n; col += 1) {
      a[pivot][col] /= pivotValue;
    }

    for (let row = 0; row < n; row += 1) {
      if (row === pivot) {
        continue;
      }
      const factor = a[row][pivot];
      for (let col = pivot; col <= n; col += 1) {
        a[row][col] -= factor * a[pivot][col];
      }
    }
  }

  return a.map((row) => row[n]);
}

function multiplyMatrix3Vector(matrix: Matrix3, vector: [number, number, number]): [number, number, number] {
  return [
    matrix[0][0] * vector[0] + matrix[0][1] * vector[1] + matrix[0][2] * vector[2],
    matrix[1][0] * vector[0] + matrix[1][1] * vector[1] + matrix[1][2] * vector[2],
    matrix[2][0] * vector[0] + matrix[2][1] * vector[1] + matrix[2][2] * vector[2],
  ];
}

function dedupeWristSolutions(solutions: [number, number, number][]): [number, number, number][] {
  const seen = new Set<string>();
  return solutions.filter((solution) => {
    const key = solution.map((value) => wrapToPi(value).toFixed(4)).join("|");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
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

const EPSILON = 1e-6;
