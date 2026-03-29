import { TCP_LABELS } from "../app/viewModel";
import { editingDisabled, interactionMode, previewTarget, setControlMode, setInteractionMode, updateTcp } from "../store/appState";
import { SliderRow } from "../components/SliderRow";

export function TcpControlPanel() {
  return (
    <section
      className={interactionMode.value === "planner_tcp" ? "panel active-control-panel" : "panel"}
      onPointerDown={() => {
        setControlMode("tcp");
        setInteractionMode("planner_tcp");
      }}
    >
      <div className="panel-head">
        <h2>Управление звеном захвата</h2>
      </div>

      <div className="slider-list">
        {previewTarget.value.tcp.map((value, index) => (
          <SliderRow
            key={TCP_LABELS[index]}
            label={TCP_LABELS[index]}
            min={index < 3 ? -1 : -180}
            max={index < 3 ? 1 : 180}
            step={index < 3 ? 0.01 : 1}
            unit={index < 3 ? "м" : "°"}
            value={value}
            disabled={editingDisabled.value}
            onInput={(next) => updateTcp(index, next)}
          />
        ))}
      </div>
    </section>
  );
}
