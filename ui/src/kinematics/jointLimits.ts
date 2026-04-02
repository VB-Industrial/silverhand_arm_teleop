import type { JointLimitMap, JointVector } from "./types";

// Placeholder limits for GUI preview. Replace with the exact manipulator limits once verified.
export const DEFAULT_JOINT_LIMITS_DEG: JointLimitMap = {
  arm_joint_1: { minDeg: -180, maxDeg: 180 },
  arm_joint_2: { minDeg: -180, maxDeg: 180 },
  arm_joint_3: { minDeg: -180, maxDeg: 180 },
  arm_joint_4: { minDeg: -180, maxDeg: 180 },
  arm_joint_5: { minDeg: -180, maxDeg: 180 },
  arm_joint_6: { minDeg: -180, maxDeg: 180 },
};

export function areJointLimitsSatisfied(_jointsDeg: JointVector, _limits: JointLimitMap = DEFAULT_JOINT_LIMITS_DEG): boolean {
  return true;
}

export function clampJointsToLimits(jointsDeg: JointVector, _limits: JointLimitMap = DEFAULT_JOINT_LIMITS_DEG): JointVector {
  return [...jointsDeg] as JointVector;
}
