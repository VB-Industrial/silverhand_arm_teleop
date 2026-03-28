# State Machine

## Goal

This state machine defines the top-level GUI behavior for the operator console.

The same model is intended to remain valid beyond Iteration 1.

## Core State Concepts

The UI distinguishes four concepts:

1. `real_state`
   Current real robot state. In Iteration 1 this is mock data.
2. `preview_target`
   The target currently being edited by the operator.
3. `locked_target`
   The target explicitly confirmed by the operator.
4. `execution_state`
   High-level motion execution status.

## Top-Level States

### `idle`

Neutral state.

- no active preview
- no locked target
- nothing is executing

### `preview`

The operator is editing a target.

- preview target exists
- target is not yet confirmed

### `target_locked`

The operator confirmed a target.

- locked target exists
- execution can be started

### `executing`

Motion execution is in progress.

### `stopped`

Execution was stopped normally by the operator.

### `estop_active`

Emergency stop is active.

- normal motion is blocked
- editing is blocked
- only reset is allowed

### `fault`

System fault is active.

- execution is blocked
- normal flow is interrupted

## Events

### User events

- `joint_changed`
- `tcp_changed`
- `gripper_changed`
- `lock_target_clicked`
- `execute_clicked`
- `stop_clicked`
- `reset_clicked`
- `estop_clicked`
- `reset_estop_clicked`
- `fault_on`
- `fault_off`

### Internal events

- `execution_started`
- `execution_finished`
- `execution_stopped`

## Allowed Transitions

### From `idle`

- `joint_changed` -> `preview`
- `tcp_changed` -> `preview`
- `gripper_changed` -> `preview`
- `estop_clicked` -> `estop_active`
- `fault_on` -> `fault`

### From `preview`

- `joint_changed` -> `preview`
- `tcp_changed` -> `preview`
- `gripper_changed` -> `preview`
- `lock_target_clicked` -> `target_locked`
- `reset_clicked` -> `idle`
- `estop_clicked` -> `estop_active`
- `fault_on` -> `fault`

### From `target_locked`

- `execute_clicked` -> `executing`
- `joint_changed` -> `preview`
- `tcp_changed` -> `preview`
- `gripper_changed` -> `preview`
- `reset_clicked` -> `idle`
- `estop_clicked` -> `estop_active`
- `fault_on` -> `fault`

### From `executing`

- `execution_finished` -> `idle`
- `stop_clicked` -> `stopped`
- `estop_clicked` -> `estop_active`
- `fault_on` -> `fault`

### From `stopped`

- `reset_clicked` -> `idle`
- `joint_changed` -> `preview`
- `tcp_changed` -> `preview`
- `gripper_changed` -> `preview`
- `estop_clicked` -> `estop_active`
- `fault_on` -> `fault`

### From `estop_active`

- `reset_estop_clicked` -> `idle`

All other transitions are blocked.

### From `fault`

- `fault_off` -> `idle`
- `estop_clicked` -> `estop_active`

All other transitions are blocked.

## UI Rules Per State

### `idle`

- `Движение` disabled
- `Зафиксировать цель` disabled
- `Стоп` disabled
- editing controls enabled

### `preview`

- `Движение` disabled
- `Зафиксировать цель` enabled
- `Стоп` disabled
- `Сброс` enabled

### `target_locked`

- `Движение` enabled
- `Сброс` enabled
- any value change returns the UI to `preview`

### `executing`

- `Движение` disabled
- `Стоп` enabled
- editing controls disabled

### `stopped`

- `Движение` disabled
- `Сброс` enabled
- editing controls enabled

### `estop_active`

- all normal controls disabled
- `Сброс аварийного стопа` enabled

### `fault`

- `Движение` disabled
- execution blocked

## Priority

State priority is:

1. `estop_active`
2. `fault`
3. `executing`
4. `target_locked`
5. `preview`
6. `idle`

This means:

- emergency stop overrides everything
- fault overrides normal operation
- execution cannot be silently replaced by preview editing

## Emergency Stop Rules

When `estop_clicked` occurs:

- clear `preview_target`
- clear `locked_target`
- transition to `estop_active`
- disable motion controls

When `reset_estop_clicked` occurs:

- transition to `idle`
- do not restore previous targets automatically

## Stop Rules

`stop_clicked` is a normal motion stop.

- only valid in `executing`
- transitions to `stopped`
- does not activate emergency state

## Target Locking Rules

`lock_target_clicked`:

- only valid in `preview`
- copies `preview_target` into `locked_target`
- transitions to `target_locked`

Any further target edit invalidates the lock and transitions back to `preview`.
