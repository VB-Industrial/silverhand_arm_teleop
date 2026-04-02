export const ARM_JOINT_NAMES = [
  "arm_joint_1",
  "arm_joint_2",
  "arm_joint_3",
  "arm_joint_4",
  "arm_joint_5",
  "arm_joint_6",
] as const;

export type ArmJointName = (typeof ARM_JOINT_NAMES)[number];

export type JointVector = [number, number, number, number, number, number];

export type CartesianPosition = {
  x: number;
  y: number;
  z: number;
};

export type CartesianOrientation = {
  roll: number;
  pitch: number;
  yaw: number;
};

export type TcpPose = {
  position: CartesianPosition;
  orientation: CartesianOrientation;
};

export type JointLimit = {
  minDeg: number;
  maxDeg: number;
};

export type JointLimitMap = Record<ArmJointName, JointLimit>;

export type JointDistanceWeights = Partial<Record<ArmJointName, number>>;

export type AnalyticIkCandidate = {
  jointsDeg: JointVector;
  branchId: string;
};

export type AnalyticIkStatus =
  | "ok"
  | "unreachable"
  | "collision"
  | "joint_limit_violation"
  | "jump_rejected"
  | "solver_unavailable";

export type AnalyticIkResult = {
  status: AnalyticIkStatus;
  selected: AnalyticIkCandidate | null;
  candidates: AnalyticIkCandidate[];
  message: string;
};

export type AnalyticIkSolver = (targetPose: TcpPose) => AnalyticIkCandidate[];

export type BranchSelectionResult = {
  selected: AnalyticIkCandidate | null;
  rejected: AnalyticIkCandidate[];
};

export type PreviewValidation = {
  valid: boolean;
  reachable: boolean;
  withinJointLimits: boolean;
  jumpAccepted: boolean;
  message: string;
};

export type PreviewComputationResult = {
  status: AnalyticIkStatus;
  previewJointsDeg: JointVector | null;
  candidates: AnalyticIkCandidate[];
  validation: PreviewValidation;
};

