# Architecture

## Goal

`silverhand_arm_teleop` is a teleoperation system for a rover-mounted manipulator arm.

The current target architecture is split into two runtime layers:

1. `ui`
   The operator console. Displays cameras, kinematic model, controls, safety state, and execution state.
   Keeps local preview, FK, gizmo logic, and UI-side IK helpers.
2. `robot websocket server`
   Remote transport layer on the robot computer. Connected to robot-side `MoveIt 2 / ros2_control / executor`. Used for real robot state and real execution.

## Design Principles

1. The GUI stays lightweight.
2. Preview and execution are still strictly separate concepts.
3. Local GUI preview does not require local `MoveIt 2`.
4. Real motion only starts by explicit operator action.
5. `E-STOP` overrides every other action.

## Iteration 1 Scope

Iteration 1 only implements the operator console skeleton and local UI logic.

Included:

- screen layout
- Russian UI labels
- mock panels
- mock robot state
- mock execution state
- top-level state machine

Not included yet:

- real ROS 2
- remote websocket transport
- real cameras
- real joystick
- real execution on hardware

## Planned Runtime Topology

### Operator workstation

- `ui`
- local preview / FK / gizmo / IK UI logic

### Robot computer

- websocket server
- remote `MoveIt 2 / execution layer`
- `ros2_control`
- manipulator and gripper hardware

## Data Flow

### Current iteration

`UI controls -> local state machine -> mock preview/execution state -> UI`

### Target architecture

`robot websocket server -> UI`

for current real joint state and execution status, and

`UI -> robot websocket server -> robot`

for confirmed planning and execution commands.

## Safety Model

There are two separate stop concepts:

1. `Stop`
   A normal stop of current motion.
2. `E-STOP`
   A hard emergency stop that disables normal control flow until reset.

## Core UI Concepts

The UI always distinguishes:

1. current real state
2. preview target
3. validated target
4. execution state

Only confirmed targets may be sent to the remote robot websocket server for real execution.
