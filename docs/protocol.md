# Protocol

## Goal

This document defines the high-level message model for the project.

Iteration 1 does not use real transport yet, but the UI state and events should already match this model.

## Layers

The final system has three relevant communication boundaries:

1. `ui <-> operator_backend`
2. `operator_backend <-> robot_gateway`
3. `robot_gateway <-> robot_bridge`

Iteration 1 only simulates `ui <-> operator_backend`.

## Message Groups

### UI command messages

Commands initiated by the operator:

- `set_control_mode`
- `set_input_source`
- `joint_preview_update`
- `tcp_preview_update`
- `gripper_preview_update`
- `lock_target`
- `execute_target`
- `stop_motion`
- `reset_state`
- `estop`
- `reset_estop`

### UI state messages

Messages that update the operator console:

- `app_state`
- `safety_state`
- `execution_state`
- `robot_state`
- `preview_state`
- `connection_state`
- `camera_state`

## Iteration 1 State Shapes

### `app_state`

Contains:

- top-level state
- control mode
- input source

### `safety_state`

Contains:

- arm ready
- deadman
- enabled
- estop active
- fault active
- fault text

### `execution_state`

Contains:

- current execution mode
- whether a target is locked
- whether execution is active

### `robot_state`

Contains:

- joint values
- TCP values
- gripper value

### `preview_state`

Contains:

- preview joint values
- preview TCP values
- preview gripper value
- whether preview is valid

### `camera_state`

Contains:

- online/offline flags for each camera tile

## Transport Choice

### Iteration 1

No real transport.
Local in-memory state only.

### Later

Recommended initial transport:

- `WebSocket`
- `JSON`

Possible later upgrade:

- `WebSocket`
- `protobuf`

## Naming Rule

Use stable English message ids internally.
Use Russian only for UI labels and operator-facing text.

This keeps transport contracts stable while the visible interface stays Russian.
