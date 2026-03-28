import { JOINT_LABELS } from "../app/viewModel";
import { controlMode, editingDisabled, interactionMode, previewTarget, setControlMode, setInteractionMode, updateJoint } from "../store/appState";
import { SliderRow } from "../components/SliderRow";

export function JointControlPanel() {
  return (
    <section
      className={interactionMode.value === "planner_joint" ? "panel active-control-panel" : "panel"}
      onPointerDown={() => {
        setControlMode("joint");
        setInteractionMode("planner_joint");
      }}
    >
      <div className="panel-head">
        <h2>Управление звеньями</h2>
        <span className="muted-text">{controlMode.value === "joint" ? "Сдвигает цель планировщика" : "Клик активирует контур звеньев"}</span>
      </div>

      <div className="slider-list">
        {previewTarget.value.joints.map((value, index) => (
          <SliderRow
            key={JOINT_LABELS[index]}
            label={JOINT_LABELS[index]}
            min={-180}
            max={180}
            step={1}
            unit="°"
            value={value}
            disabled={editingDisabled.value}
            onInput={(next) => updateJoint(index, next)}
          />
        ))}
      </div>
    </section>
  );
}
