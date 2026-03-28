import { formatNumber } from "../app/viewModel";
import { KinematicScene } from "../scene/KinematicScene";
import { interactionMode, previewTarget, realTarget, setControlMode, setInteractionMode } from "../store/appState";

export function KinematicViewportPanel() {
  return (
    <div
      className={interactionMode.value === "planner_gizmo" ? "panel model-panel active-control-panel" : "panel model-panel"}
      onPointerDown={() => {
        setControlMode("tcp");
        setInteractionMode("planner_gizmo");
      }}
    >
      <div className="panel-head">
        <h2>Кинематическая модель</h2>
        <span className="muted-text">{interactionMode.value === "planner_gizmo" ? "Клик смещает цель через gizmo" : "TCP / gizmo viewport"}</span>
      </div>

      <div className="model-placeholder">
        <KinematicScene
          gripperPercent={realTarget.value.gripper}
          realJoints={realTarget.value.joints}
          targetJoints={previewTarget.value.joints}
        />
        <div className="pose-readout">
          <span>Текущие звенья: {realTarget.value.joints.map(formatNumber).join(" / ")}</span>
          <span>Цель планировщика: {previewTarget.value.joints.map(formatNumber).join(" / ")}</span>
        </div>
      </div>
    </div>
  );
}
