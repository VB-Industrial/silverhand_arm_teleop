# Analytic IK Preview

## Goal

This document describes the intended local GUI-side preview architecture when an analytic IK solution becomes available.

The GUI uses:

- analytic IK for preview only
- URDF scene graph for FK and rendering
- robot-side `MoveIt 2` for real execution

## Design

1. Operator changes TCP target with gizmo or sliders.
2. GUI builds a `TcpPose`.
3. Analytic IK returns all valid branch candidates.
4. GUI selects the best branch relative to the current real joint state.
5. Selected preview joints are applied to the URDF model.
6. Three.js scene graph provides FK for visualization.
7. Confirmed targets are later sent to the robot executor.

## Modules

The scaffold lives in:

- [types.ts](/home/r/silver_ws/src/silverhand_arm_teleop/ui/src/kinematics/types.ts)
- [armGeometry.ts](/home/r/silver_ws/src/silverhand_arm_teleop/ui/src/kinematics/armGeometry.ts)
- [jointLimits.ts](/home/r/silver_ws/src/silverhand_arm_teleop/ui/src/kinematics/jointLimits.ts)
- [selectBestSolution.ts](/home/r/silver_ws/src/silverhand_arm_teleop/ui/src/kinematics/selectBestSolution.ts)
- [analyticIk.ts](/home/r/silver_ws/src/silverhand_arm_teleop/ui/src/kinematics/analyticIk.ts)
- [previewController.ts](/home/r/silver_ws/src/silverhand_arm_teleop/ui/src/kinematics/previewController.ts)

Paper notes and extracted formulas live in:

- [analytic-ik-paper-notes.md](/home/r/silver_ws/src/silverhand_arm_teleop/docs/analytic-ik-paper-notes.md)

## Branch Selection

The default branch-selection strategy is:

1. reject joint-limit violations
2. reject solutions with excessive jump from the current configuration
3. select the minimum weighted squared distance to the current configuration

## What Is Still Missing

The following pieces still need real robot-specific implementation:

1. exact joint limits
2. exact tool frame / TCP definition
3. real analytic IK formula
4. optional branch-specific heuristics
5. optional preview smoothing / hysteresis
