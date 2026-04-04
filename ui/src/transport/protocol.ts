export const ROBOT_PROTOCOL_VERSION = 1 as const;

export const ROBOT_GROUP_NAMES = ["arm", "gripper"] as const;
export type RobotGroupName = (typeof ROBOT_GROUP_NAMES)[number];

export type ProtocolTimestampSec = number;
export type ProtocolSequence = number;
export type CommandId = string;

export type Vector3Meters = {
  x: number;
  y: number;
  z: number;
};

export type Quaternion = {
  x: number;
  y: number;
  z: number;
  w: number;
};

export type JointStatePayload = {
  group_name: RobotGroupName;
  name: string[];
  position_rad: number[];
  velocity_rad_s?: number[];
  effort?: number[];
};

export type PoseGoalPayload = {
  group_name: RobotGroupName;
  frame_id: string;
  link_name: string;
  position_m: Vector3Meters;
  orientation_q: Quaternion;
};

export type JointGoalPayload = {
  group_name: RobotGroupName;
  joint_names: string[];
  positions_rad: number[];
};

export type PlanOptionsPayload = {
  group_name: RobotGroupName;
  velocity_scale?: number;
  acceleration_scale?: number;
  planning_time_sec?: number;
  attempts?: number;
};

export type ExecutionStatus =
  | "idle"
  | "planning"
  | "planned"
  | "executing"
  | "succeeded"
  | "aborted"
  | "failed"
  | "stopped"
  | "estop_active";

export type FaultSeverity = "info" | "warning" | "error" | "fatal";

export type MessageEnvelope<TType extends string, TPayload> = {
  type: TType;
  seq: ProtocolSequence;
  ts: ProtocolTimestampSec;
  payload: TPayload;
};

export type HelloMessage = MessageEnvelope<
  "hello",
  {
    protocol_version: typeof ROBOT_PROTOCOL_VERSION;
    client_name: string;
    requested_groups: RobotGroupName[];
  }
>;

export type HelloAckMessage = MessageEnvelope<
  "hello_ack",
  {
    protocol_version: typeof ROBOT_PROTOCOL_VERSION;
    server_name: string;
    groups: RobotGroupName[];
  }
>;

export type PingMessage = MessageEnvelope<
  "ping",
  {
    heartbeat_id: string;
  }
>;

export type PongMessage = MessageEnvelope<
  "pong",
  {
    heartbeat_id: string;
  }
>;

export type SetJointGoalMessage = MessageEnvelope<
  "set_joint_goal",
  {
    command_id: CommandId;
    goal: JointGoalPayload;
  }
>;

export type SetPoseGoalMessage = MessageEnvelope<
  "set_pose_goal",
  {
    command_id: CommandId;
    goal: PoseGoalPayload;
  }
>;

export type PlanMessage = MessageEnvelope<
  "plan",
  {
    command_id: CommandId;
    options: PlanOptionsPayload;
  }
>;

export type ExecuteMessage = MessageEnvelope<
  "execute",
  {
    command_id: CommandId;
    group_name: RobotGroupName;
  }
>;

export type StopMessage = MessageEnvelope<
  "stop",
  {
    command_id: CommandId;
    group_name: RobotGroupName;
  }
>;

export type EstopMessage = MessageEnvelope<
  "estop",
  {
    command_id: CommandId;
  }
>;

export type ResetEstopMessage = MessageEnvelope<
  "reset_estop",
  {
    command_id: CommandId;
  }
>;

export type PlanningStateMessage = MessageEnvelope<
  "planning_state",
  {
    command_id: CommandId;
    group_name: RobotGroupName;
    status: Extract<ExecutionStatus, "idle" | "planning" | "planned" | "failed">;
    message: string;
  }
>;

export type ExecutionStateMessage = MessageEnvelope<
  "execution_state",
  {
    command_id: CommandId;
    group_name: RobotGroupName;
    status: ExecutionStatus;
    message: string;
  }
>;

export type JointStateMessage = MessageEnvelope<"joint_state", JointStatePayload>;

export type FaultStateMessage = MessageEnvelope<
  "fault_state",
  {
    active: boolean;
    severity: FaultSeverity;
    code: string;
    message: string;
  }
>;

export type GUIToRobotMessage =
  | HelloMessage
  | PingMessage
  | SetJointGoalMessage
  | SetPoseGoalMessage
  | PlanMessage
  | ExecuteMessage
  | StopMessage
  | EstopMessage
  | ResetEstopMessage;

export type RobotToGUIMessage =
  | HelloAckMessage
  | PongMessage
  | JointStateMessage
  | PlanningStateMessage
  | ExecutionStateMessage
  | FaultStateMessage;

export type RobotProtocolMessage = GUIToRobotMessage | RobotToGUIMessage;

export function isRobotGroupName(value: string): value is RobotGroupName {
  return (ROBOT_GROUP_NAMES as readonly string[]).includes(value);
}
