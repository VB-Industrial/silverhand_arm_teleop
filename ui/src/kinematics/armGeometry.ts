export type PaperDhGeometry = {
  d1: number;
  shoulderOffsetPlanar: number;
  a2: number;
  a3: number;
  d4: number;
  d6: number;
};

// This mapping is for the analytic IK formulas from course_paper_4-9.pdf
// (pages 13-16). The values are inferred from the current URDF chain at zero pose.
// They should be treated as the GUI preview geometry until the exact robot-side
// analytic solver implementation is wired in.
export const PAPER_DH_GEOMETRY_METERS: PaperDhGeometry = {
  // Base height from joint 1 frame to the shoulder plane.
  d1: 0.169525,
  // Planar offset from joint 1 axis to joint 2 axis.
  shoulderOffsetPlanar: 0.064146,
  // Effective shoulder-to-elbow link length.
  a2: 0.305001,
  // Small elbow offset used in the paper's DH model.
  a3: 0.00675,
  // Wrist offset from the paper's DH model.
  d4: 0.22225,
  // Tool offset from joint 6 to the TCP between the fingers.
  d6: 0.08537,
};
