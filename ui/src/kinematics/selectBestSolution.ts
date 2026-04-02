import { ARM_JOINT_NAMES, type AnalyticIkCandidate, type BranchSelectionResult, type JointDistanceWeights, type JointVector } from "./types";
import { areJointLimitsSatisfied, DEFAULT_JOINT_LIMITS_DEG } from "./jointLimits";

const DEFAULT_WEIGHTS: Record<(typeof ARM_JOINT_NAMES)[number], number> = {
  arm_joint_1: 1,
  arm_joint_2: 1,
  arm_joint_3: 1,
  arm_joint_4: 1,
  arm_joint_5: 1,
  arm_joint_6: 1,
};

export function selectBestSolution(
  candidates: AnalyticIkCandidate[],
  currentJointsDeg: JointVector,
  options?: {
    maxJumpDeg?: number;
    weights?: JointDistanceWeights;
  },
): BranchSelectionResult {
  const weights = { ...DEFAULT_WEIGHTS, ...(options?.weights ?? {}) };

  const scored = candidates
    .filter((candidate) => areJointLimitsSatisfied(candidate.jointsDeg, DEFAULT_JOINT_LIMITS_DEG))
    .map((candidate) => ({
      candidate,
      maxJointJumpDeg: maxJointJump(candidate.jointsDeg, currentJointsDeg),
      cost: jointDistanceCost(candidate.jointsDeg, currentJointsDeg, weights),
    }))
    .sort((left, right) => left.cost - right.cost);

  return {
    selected: scored[0]?.candidate ?? null,
    rejected: candidates.filter((candidate) => candidate !== scored[0]?.candidate),
  };
}

function jointDistanceCost(
  candidate: JointVector,
  current: JointVector,
  weights: Record<(typeof ARM_JOINT_NAMES)[number], number>,
): number {
  return ARM_JOINT_NAMES.reduce((acc, jointName, index) => {
    const diff = shortestAngularDistanceDeg(candidate[index], current[index]);
    return acc + weights[jointName] * diff * diff;
  }, 0);
}

function maxJointJump(candidate: JointVector, current: JointVector): number {
  return candidate.reduce((max, value, index) => Math.max(max, Math.abs(shortestAngularDistanceDeg(value, current[index]))), 0);
}

function shortestAngularDistanceDeg(target: number, current: number): number {
  let diff = target - current;
  while (diff <= -180) {
    diff += 360;
  }
  while (diff > 180) {
    diff -= 360;
  }
  return diff;
}
