import {
  editingDisabled,
  gripperGoalPercent,
  interactionMode,
  realTarget,
  resetGripperGoal,
  syncGripperGoalToCurrent,
  updateGripper,
} from "../store/appState";
import { sendGripperGoalToRobot, sendGripperStopToRobot } from "../transport/robotConnectionStore";

export function GripperPanel() {
  return (
    <section
      className={interactionMode.value === "servo_gripper" ? "panel gripper-panel active-control-panel" : "panel gripper-panel"}
    >
      <div className="panel-head">
        <h2>Управление захватом</h2>
        <span className="muted-text">Текущее: {Math.round(realTarget.value.gripper)}% / Цель: {Math.round(gripperGoalPercent.value)}%</span>
      </div>

      <div className="gripper-stack">
        <input
          disabled={editingDisabled.value}
          max={100}
          min={0}
          onInput={(event) => {
            updateGripper(Number((event.currentTarget as HTMLInputElement).value));
          }}
          type="range"
          value={gripperGoalPercent.value}
        />
        <div className="gripper-actions">
          <button className="execute-action" disabled={editingDisabled.value} onClick={sendGripperGoalToRobot} type="button">
            Движение
          </button>
          <button
            className="secondary-action"
            disabled={editingDisabled.value}
            onClick={() => {
              syncGripperGoalToCurrent();
              sendGripperStopToRobot();
            }}
            type="button"
          >
            Стоп
          </button>
          <button className="secondary-action" disabled={editingDisabled.value} onClick={resetGripperGoal} type="button">
            Сброс
          </button>
        </div>
      </div>
    </section>
  );
}
