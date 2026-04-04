# Protocol

## Goal

This document defines the runtime websocket protocol between:

- `ui`
- remote robot-side websocket server connected to `MoveIt 2 / ros2_control`

There is no local preview bridge in the current target architecture.
The GUI keeps local preview and FK, but real robot state and real execution come from the remote side.

## Design Rules

1. Transport is `WebSocket + JSON`.
2. Message shapes follow `MoveIt` concepts instead of ad-hoc GUI concepts.
3. `joint_state` is transferred in `rad / rad_s`.
4. `arm` and `gripper` use the same protocol shape via `group_name`.
5. TCP is not streamed back separately by default.
   The GUI computes FK locally from remote joint state.
6. Heartbeats exist in both directions.

## Runtime Topology

### Operator workstation

- `ui`
- local preview / FK / gizmo / IK UI logic

### Robot computer

- websocket server
- `MoveIt 2`
- `ros2_control`
- manipulator and gripper hardware

## Recommended Endpoint

- `ws://<robot-host>:8765`

Port is configurable. Logical message contract is the important part.

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

## Groups

Supported initial planning groups:

- `arm`
- `gripper`

## GUI -> Robot

### `hello`

Used once on connection.

```json
{
  "type": "hello",
  "payload": {
    "protocol_version": 1,
    "client_name": "silverhand_arm_teleop_ui",
    "requested_groups": ["arm", "gripper"]
  }
}
```

### `ping`

Heartbeat from GUI to robot.

```json
{
  "type": "ping",
  "payload": {
    "heartbeat_id": "hb-001"
  }
}
```

### `set_joint_goal`

```json
{
  "type": "set_joint_goal",
  "payload": {
    "command_id": "cmd-001",
    "goal": {
      "group_name": "arm",
      "joint_names": [
        "arm_joint_1",
        "arm_joint_2",
        "arm_joint_3",
        "arm_joint_4",
        "arm_joint_5",
        "arm_joint_6"
      ],
      "positions_rad": [0, 2.094, -0.524, 0, 1.571, 0]
    }
  }
}
```

### `set_pose_goal`

```json
{
  "type": "set_pose_goal",
  "payload": {
    "command_id": "cmd-002",
    "goal": {
      "group_name": "arm",
      "frame_id": "arm_base_link",
      "link_name": "hand_gripper_link",
      "position_m": { "x": 0.25, "y": 0.14, "z": 0.15 },
      "orientation_q": { "x": 0, "y": 0, "z": 0, "w": 1 }
    }
  }
}
```

### `plan`

```json
{
  "type": "plan",
  "payload": {
    "command_id": "cmd-003",
    "options": {
      "group_name": "arm",
      "velocity_scale": 0.3,
      "acceleration_scale": 0.3,
      "planning_time_sec": 2.0,
      "attempts": 1
    }
  }
}
```

### `execute`

```json
{
  "type": "execute",
  "payload": {
    "command_id": "cmd-004",
    "group_name": "arm"
  }
}
```

### `stop`

```json
{
  "type": "stop",
  "payload": {
    "command_id": "cmd-005",
    "group_name": "arm"
  }
}
```

### `estop`

```json
{
  "type": "estop",
  "payload": {
    "command_id": "cmd-006"
  }
}
```

### `reset_estop`

```json
{
  "type": "reset_estop",
  "payload": {
    "command_id": "cmd-007"
  }
}
```

## Robot -> GUI

### `hello_ack`

```json
{
  "type": "hello_ack",
  "payload": {
    "protocol_version": 1,
    "server_name": "silverhand_robot_ws",
    "groups": ["arm", "gripper"]
  }
}
```

### `pong`

```json
{
  "type": "pong",
  "payload": {
    "heartbeat_id": "hb-001"
  }
}
```

### `joint_state`

```json
{
  "type": "joint_state",
  "payload": {
    "group_name": "arm",
    "name": [
      "arm_joint_1",
      "arm_joint_2",
      "arm_joint_3",
      "arm_joint_4",
      "arm_joint_5",
      "arm_joint_6"
    ],
    "position_rad": [0, 2.094, -0.524, 0, 1.571, 0],
    "velocity_rad_s": [0, 0, 0, 0, 0, 0]
  }
}
```

### `planning_state`

```json
{
  "type": "planning_state",
  "payload": {
    "command_id": "cmd-003",
    "group_name": "arm",
    "status": "planned",
    "message": ""
  }
}
```

Allowed planning states:

- `idle`
- `planning`
- `planned`
- `failed`

### `execution_state`

```json
{
  "type": "execution_state",
  "payload": {
    "command_id": "cmd-004",
    "group_name": "arm",
    "status": "executing",
    "message": ""
  }
}
```

Allowed execution states:

- `idle`
- `planning`
- `planned`
- `executing`
- `succeeded`
- `aborted`
- `failed`
- `stopped`
- `estop_active`

### `fault_state`

```json
{
  "type": "fault_state",
  "payload": {
    "active": true,
    "severity": "error",
    "code": "move_group_failed",
    "message": "Planning failed"
  }
}
```

## Notes

1. The GUI computes TCP locally from `joint_state`.
2. The GUI may use quaternion orientation internally even if panels show human-readable Euler values.
3. `group_name` keeps the protocol uniform for both `arm` and `gripper`.

