# Protocol

## Goal

This document defines the runtime protocol between the operator GUI and two ROS 2 websocket bridges:

1. `preview_bridge`
   Local bridge on the operator workstation.
   Connected to local `ROS 2 + MoveIt 2`.
   Used only for preview, IK, collision checks, and validation.

2. `robot_bridge`
   Remote bridge on the robot computer.
   Connected to robot-side `MoveIt 2 / ros2_control / executor`.
   Used only for real robot state and real execution.

The GUI talks to both bridges directly over `WebSocket + JSON`.

## Design Rules

1. Preview and execution are separate flows.
2. Local `MoveIt 2` never executes hardware motion.
3. Remote executor never computes UI preview for the operator.
4. The robot only receives confirmed targets.
5. The local preview bridge must always be synchronized with the current real joint state from the robot.

## Runtime Topology

### Operator workstation

- `ui`
- `preview_bridge`
- local `ROS 2 + MoveIt 2`

### Robot computer

- `robot_bridge`
- remote `MoveIt 2 / execution layer`
- `ros2_control`
- manipulator and gripper hardware

## Transport

Initial transport:

- `WebSocket`
- `JSON`

Later upgrade is allowed:

- `WebSocket`
- `protobuf`

## Connection Endpoints

Recommended initial websocket endpoints:

- `ws://127.0.0.1:8766`
  `preview_bridge`

- `ws://<robot-host>:8765`
  `robot_bridge`

These exact ports are not mandatory, but the logical separation is mandatory.

## Envelope

Every websocket message uses one envelope shape:

```json
{
  "type": "message_type",
  "seq": 42,
  "ts": 1760000000.123,
  "payload": {}
}
```

Fields:

- `type`
  Stable English message id.

- `seq`
  Monotonic sender-local sequence number.

- `ts`
  Sender timestamp in seconds.

- `payload`
  Message-specific body.

## Shared Data Shapes

### Joint State

```json
{
  "joint_names": [
    "arm_joint_1",
    "arm_joint_2",
    "arm_joint_3",
    "arm_joint_4",
    "arm_joint_5",
    "arm_joint_6"
  ],
  "joint_positions_deg": [0, 0, 0, 0, 0, 0],
  "gripper_percent": 55.0
}
```

Notes:

- arm joints are always in degrees in the GUI-facing protocol
- gripper is exposed as `0..100`

### TCP Pose

```json
{
  "position_m": {
    "x": 0.12,
    "y": -0.03,
    "z": 0.41
  },
  "orientation_deg": {
    "roll": 12.0,
    "pitch": -8.0,
    "yaw": 21.0
  }
}
```

### Validation State

```json
{
  "valid": true,
  "reachable": true,
  "collision": false,
  "singularity": false,
  "message": ""
}
```

### Execution State

```json
{
  "state": "idle",
  "message": ""
}
```

Allowed `state` values:

- `idle`
- `accepted`
- `executing`
- `stopped`
- `completed`
- `fault`
- `estop_active`
- `rejected`

## Preview Bridge

### Responsibility

`preview_bridge` is responsible for:

- syncing real joint state into local preview state
- solving IK
- collision checking
- producing preview joint solutions
- returning validation results

It never sends commands to the robot.

### GUI -> Preview Bridge

#### `sync_real_joint_state`

Purpose:
Synchronize local preview backend with the current real state from the robot.

Payload:

```json
{
  "joint_state": {
    "joint_names": ["arm_joint_1", "arm_joint_2", "arm_joint_3", "arm_joint_4", "arm_joint_5", "arm_joint_6"],
    "joint_positions_deg": [0, 0, 0, 0, 0, 0],
    "gripper_percent": 55.0
  }
}
```

#### `preview_joint_target`

Purpose:
Request preview/validation for a joint target.

Payload:

```json
{
  "joint_positions_deg": [10, 20, 30, 0, 45, -10]
}
```

#### `preview_pose_target`

Purpose:
Request preview/validation for a cartesian TCP target.

Payload:

```json
{
  "tcp_pose": {
    "position_m": {
      "x": 0.12,
      "y": -0.03,
      "z": 0.41
    },
    "orientation_deg": {
      "roll": 12.0,
      "pitch": -8.0,
      "yaw": 21.0
    }
  }
}
```

#### `preview_ping`

Purpose:
Connectivity check.

Payload:

```json
{}
```

### Preview Bridge -> GUI

#### `preview_joint_solution`

Purpose:
Return computed joint solution for preview.

Payload:

```json
{
  "joint_state": {
    "joint_names": ["arm_joint_1", "arm_joint_2", "arm_joint_3", "arm_joint_4", "arm_joint_5", "arm_joint_6"],
    "joint_positions_deg": [10, 20, 30, 0, 45, -10],
    "gripper_percent": 55.0
  }
}
```

#### `preview_tcp_pose`

Purpose:
Return preview TCP pose.

Payload:

```json
{
  "tcp_pose": {
    "position_m": {
      "x": 0.12,
      "y": -0.03,
      "z": 0.41
    },
    "orientation_deg": {
      "roll": 12.0,
      "pitch": -8.0,
      "yaw": 21.0
    }
  }
}
```

#### `preview_validation`

Purpose:
Return validity information for the currently requested preview target.

Payload:

```json
{
  "validation": {
    "valid": true,
    "reachable": true,
    "collision": false,
    "singularity": false,
    "message": ""
  }
}
```

#### `preview_pong`

Purpose:
Connectivity acknowledgement.

Payload:

```json
{}
```

#### `preview_fault`

Purpose:
Report local preview backend problems.

Payload:

```json
{
  "message": "IK solver unavailable"
}
```

## Robot Bridge

### Responsibility

`robot_bridge` is responsible for:

- publishing current real robot state
- executing confirmed arm targets
- executing gripper commands
- stop / estop routing
- exposing execution and fault state

It does not compute operator preview.

### GUI -> Robot Bridge

#### `execute_joint_target`

Purpose:
Execute a confirmed joint target on the real robot.

Payload:

```json
{
  "joint_positions_deg": [10, 20, 30, 0, 45, -10]
}
```

#### `execute_pose_target`

Purpose:
Execute a confirmed cartesian target on the real robot.

Payload:

```json
{
  "tcp_pose": {
    "position_m": {
      "x": 0.12,
      "y": -0.03,
      "z": 0.41
    },
    "orientation_deg": {
      "roll": 12.0,
      "pitch": -8.0,
      "yaw": 21.0
    }
  }
}
```

#### `gripper_command`

Purpose:
Direct gripper command.

Payload:

```json
{
  "mode": "percent",
  "gripper_percent": 55.0
}
```

Allowed `mode` values initially:

- `percent`
- `open`
- `close`

#### `stop`

Purpose:
Normal stop of current execution.

Payload:

```json
{}
```

#### `estop`

Purpose:
Emergency stop.

Payload:

```json
{}
```

#### `reset_estop`

Purpose:
Request reset of emergency stop state.

Payload:

```json
{}
```

#### `robot_ping`

Purpose:
Connectivity check / heartbeat.

Payload:

```json
{}
```

### Robot Bridge -> GUI

#### `joint_state`

Purpose:
Current real joint state of the robot.

Payload:

```json
{
  "joint_state": {
    "joint_names": ["arm_joint_1", "arm_joint_2", "arm_joint_3", "arm_joint_4", "arm_joint_5", "arm_joint_6"],
    "joint_positions_deg": [0, 0, 0, 0, 0, 0],
    "gripper_percent": 55.0
  }
}
```

#### `current_tcp_pose`

Purpose:
Current real TCP pose of the robot.

Payload:

```json
{
  "tcp_pose": {
    "position_m": {
      "x": 0.12,
      "y": -0.03,
      "z": 0.41
    },
    "orientation_deg": {
      "roll": 12.0,
      "pitch": -8.0,
      "yaw": 21.0
    }
  }
}
```

#### `execution_status`

Purpose:
Report arm execution lifecycle.

Payload:

```json
{
  "execution": {
    "state": "executing",
    "message": ""
  }
}
```

#### `gripper_state`

Purpose:
Report current gripper state.

Payload:

```json
{
  "gripper_percent": 55.0
}
```

#### `robot_ready`

Purpose:
Robot availability status.

Payload:

```json
{
  "ready": true,
  "message": ""
}
```

#### `robot_fault`

Purpose:
Fault or alarm report.

Payload:

```json
{
  "active": false,
  "message": ""
}
```

#### `robot_pong`

Purpose:
Connectivity acknowledgement.

Payload:

```json
{}
```

## GUI Logic Rule

The GUI must follow this rule strictly:

1. receive `joint_state` from `robot_bridge`
2. forward that state into `preview_bridge` via `sync_real_joint_state`
3. request preview/validation locally
4. only after operator confirmation send confirmed target to `robot_bridge`

This keeps local preview and real execution synchronized while preserving separation of responsibilities.

## Naming Rule

Use stable English message ids internally.
Use Russian only for UI labels and operator-facing text.

