import { editingDisabled, interactionMode, realTarget, updateGripper } from "../store/appState";

export function GripperPanel() {
  return (
    <section
      className={interactionMode.value === "servo_gripper" ? "panel gripper-panel active-control-panel" : "panel gripper-panel"}
    >
      <div className="panel-head">
        <h2>Управление захватом</h2>
        <span className="muted-text">Позиция прямого управления: {Math.round(realTarget.value.gripper)}%</span>
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
          value={realTarget.value.gripper}
        />
        <div className="gripper-actions">
          <button className="secondary-action" disabled={editingDisabled.value} onClick={() => updateGripper(100)} type="button">
            Открыть
          </button>
          <button className="secondary-action" disabled={editingDisabled.value} onClick={() => updateGripper(0)} type="button">
            Закрыть
          </button>
        </div>
      </div>
    </section>
  );
}
