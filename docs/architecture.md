# Architecture

## Goal

`silverhand_arm_teleop` is a teleoperation system for a rover-mounted manipulator arm.

The system is split into four layers:

1. `ui`
   The operator console. Displays cameras, kinematic model, controls, safety state, and execution state.
2. `operator_backend`
   Local process on the operator workstation. Handles input devices, local preview logic, and later local MoveIt integration.
3. `robot_gateway`
   Network boundary on the robot side. Owns sessions, watchdog, and safety routing.
4. `robot_bridge`
   ROS 2 integration layer. Connects gateway commands to the real manipulator, gripper, and robot state.

## Design Principles

1. The GUI stays lightweight.
2. Safety logic is explicit and centralized.
3. Preview and execution are separate concepts.
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
- `operator_backend`
- later: local `ROS 2 + MoveIt 2`

### Robot computer

- `robot_gateway`
- `robot_bridge`
- manipulator controllers
- rover-side services

## Data Flow

### Current iteration

`UI controls -> local state machine -> mock preview/execution state -> UI`

### Target architecture

`UI -> operator_backend -> robot_gateway -> robot_bridge -> robot`

and

`robot -> robot_bridge -> robot_gateway -> operator_backend -> UI`

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
3. locked target
4. execution state

Even in Iteration 1, these concepts are preserved in mock form so that later backend integration does not require redesigning the UI model.
