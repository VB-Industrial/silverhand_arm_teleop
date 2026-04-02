import { createPaperAnalyticIkSolver, solveAnalyticIkPreview } from "./analyticIk";
import { areJointLimitsSatisfied, DEFAULT_JOINT_LIMITS_DEG } from "./jointLimits";
import type {
  AnalyticIkSolver,
  JointVector,
  PreviewComputationResult,
  PreviewValidation,
  TcpPose,
} from "./types";

export type PreviewController = {
  computePosePreview: (targetPose: TcpPose, currentJointsDeg: JointVector) => PreviewComputationResult;
};

export function createPreviewController(options?: {
  solver?: AnalyticIkSolver | null;
  maxJumpDeg?: number;
}): PreviewController {
  const solver = options?.solver ?? createPaperAnalyticIkSolver();
  const maxJumpDeg = options?.maxJumpDeg ?? 120;

  return {
    computePosePreview(targetPose, currentJointsDeg) {
      const ik = solveAnalyticIkPreview(targetPose, {
        currentJointsDeg,
        solver,
        maxJumpDeg,
      });

      const validation = buildValidation(ik.status, ik.selected?.jointsDeg ?? null);

      return {
        status: ik.status,
        previewJointsDeg: ik.selected?.jointsDeg ?? null,
        candidates: ik.candidates,
        validation,
      };
    },
  };
}

function buildValidation(status: string, previewJointsDeg: JointVector | null): PreviewValidation {
  if (!previewJointsDeg) {
    return {
      valid: false,
      reachable: false,
      withinJointLimits: false,
      jumpAccepted: false,
      message: status === "solver_unavailable" ? "Analytic IK solver is unavailable." : "Preview target is unavailable.",
    };
  }

  return {
    valid: status === "ok",
    reachable: status === "ok",
    withinJointLimits: areJointLimitsSatisfied(previewJointsDeg, DEFAULT_JOINT_LIMITS_DEG),
    jumpAccepted: status === "ok",
    message: status === "ok" ? "" : "Preview target is unavailable.",
  };
}
