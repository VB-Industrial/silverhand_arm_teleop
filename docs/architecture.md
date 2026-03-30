# Architecture

## Goal

`silverhand_arm_teleop` is a teleoperation system for a rover-mounted manipulator arm.

The current target architecture is split into three runtime layers:

1. `ui`
   The operator console. Displays cameras, kinematic model, controls, safety state, and execution state.
2. `preview_bridge`
   Local websocket bridge on the operator workstation. Connected to local `ROS 2 + MoveIt 2`. Used only for IK, collision checking, and preview validation.
3. `robot_bridge`
   Remote websocket bridge on the robot computer. Connected to robot-side `MoveIt 2 / ros2_control / executor`. Used only for real robot state and real execution.

## Design Principles

1. The GUI stays lightweight.
2. Preview and execution are strictly separate concepts.
3. Local `MoveIt 2` never commands hardware directly.
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
- real MoveIt 2
- real cameras
- real joystick
- real transport
- real execution on hardware

## Planned Runtime Topology

### Operator workstation

- `ui`
- `preview_bridge`
- local `ROS 2 + MoveIt 2`

### Robot computer

- `robot_bridge`
- remote `MoveIt 2 / execution layer`
- `ros2_control`
- manipulator and gripper hardware

## Data Flow

### Current iteration

`UI controls -> local state machine -> mock preview/execution state -> UI`

### Target architecture

`robot_bridge -> UI -> preview_bridge`

for current real state synchronization, and

`UI -> preview_bridge`

for preview and validation, and

`UI -> robot_bridge -> robot`

for confirmed execution.

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

Only validated targets may be sent to `robot_bridge` for real execution.
