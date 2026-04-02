export type PaperDhGeometry = {
  d1: number;
  a2: number;
  a3: number;
  d4: number;
  d6: number;
};

export type PaperToUrdfJointCalibration = {
  offsetsDeg: [number, number, number, number, number, number];
};

export type PaperToUrdfFrameCalibration = {
  // urdf_position = R * paper_position + t
  rotation: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ];
  translationMeters: [number, number, number];
};

export const TCP_ORIENTATION_ZERO_OFFSET_DEG: [number, number, number] = [0, 1.352, -90];

// This mapping is for the analytic IK formulas from course_paper_4-9.pdf
// (pages 13-16). The values are inferred from the current URDF chain at zero pose.
// They should be treated as the GUI preview geometry until the exact robot-side
// analytic solver implementation is wired in.
export const PAPER_DH_GEOMETRY_METERS: PaperDhGeometry = {
  // Base height from joint 1 frame to the shoulder plane.
  d1: 0.169525,
  // Effective shoulder-to-elbow link length.
  a2: 0.305001,
  // Small elbow offset used in the paper's DH model.
  a3: 0.00675,
  // Wrist offset from the paper's DH model.
  d4: 0.22225,
  // Tool offset from joint 6 to the TCP between the fingers.
  d6: 0.08537,
};

// GUI-side calibration that maps the paper's analytic IK joint variables into
// the current URDF/joint convention used by the teleop model.
// This is a preview calibration layer only.
export const PAPER_TO_URDF_JOINT_CALIBRATION: PaperToUrdfJointCalibration = {
  offsetsDeg: [16.2485, -51.8507, 90.498, -177.6956, -81.7473, -175.8128],
};

// Preview-only calibration from the paper TCP/base frame into the GUI/URDF TCP/base frame.
// It is derived from matching the direct kinematics of the paper model to the current URDF
// model in a known reference configuration. This keeps the analytic solver working in the
// paper convention while the GUI continues to speak in URDF coordinates.
export const PAPER_TO_URDF_FRAME_CALIBRATION: PaperToUrdfFrameCalibration = {
  rotation: [
    [-0.194521, -0.976724, 0.0904],
    [-0.806717, 0.211726, 0.551706],
    [-0.558005, 0.034391, -0.829125],
  ],
  translationMeters: [-0.0283, -0.1589, 0.3344],
};

export function paperToUrdfJointsDeg(
  paperJointsDeg: [number, number, number, number, number, number],
): [number, number, number, number, number, number] {
  return paperJointsDeg.map((value, index) => wrapTo180(value + PAPER_TO_URDF_JOINT_CALIBRATION.offsetsDeg[index])) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
}

export function urdfToPaperJointsDeg(
  urdfJointsDeg: [number, number, number, number, number, number],
): [number, number, number, number, number, number] {
  return urdfJointsDeg.map((value, index) => wrapTo180(value - PAPER_TO_URDF_JOINT_CALIBRATION.offsetsDeg[index])) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
}

export function relativeToAbsoluteTcpOrientationDeg(
  relativeOrientationDeg: [number, number, number],
): [number, number, number] {
  return [
    wrapTo180(relativeOrientationDeg[0] + TCP_ORIENTATION_ZERO_OFFSET_DEG[0]),
    wrapTo180(relativeOrientationDeg[1] + TCP_ORIENTATION_ZERO_OFFSET_DEG[1]),
    wrapTo180(relativeOrientationDeg[2] + TCP_ORIENTATION_ZERO_OFFSET_DEG[2]),
  ];
}

export function absoluteToRelativeTcpOrientationDeg(
  absoluteOrientationDeg: [number, number, number],
): [number, number, number] {
  return [
    wrapTo180(absoluteOrientationDeg[0] - TCP_ORIENTATION_ZERO_OFFSET_DEG[0]),
    wrapTo180(absoluteOrientationDeg[1] - TCP_ORIENTATION_ZERO_OFFSET_DEG[1]),
    wrapTo180(absoluteOrientationDeg[2] - TCP_ORIENTATION_ZERO_OFFSET_DEG[2]),
  ];
}

function wrapTo180(value: number): number {
  let wrapped = value;
  while (wrapped <= -180) {
    wrapped += 360;
  }
  while (wrapped > 180) {
    wrapped -= 360;
  }
  return wrapped;
}
