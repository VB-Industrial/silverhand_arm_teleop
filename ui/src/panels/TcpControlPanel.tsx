import { useEffect, useState } from "preact/hooks";
import { TCP_LABELS } from "../app/viewModel";
import {
  editingDisabled,
  interactionMode,
  previewTarget,
  resetAllTcpOrientationRates,
  resetTcpOrientationRate,
  setControlMode,
  setInteractionMode,
  setTcpOrientationRate,
  updateTcp,
} from "../store/appState";
import { SliderRow } from "../components/SliderRow";

export function TcpControlPanel() {
  const [orientationInputs, setOrientationInputs] = useState<[number, number, number]>([0, 0, 0]);
  const [orientationResetVersion, setOrientationResetVersion] = useState(0);

  useEffect(() => {
    const resetOrientationInputs = () => {
      setOrientationInputs((current) => {
        if (current[0] === 0 && current[1] === 0 && current[2] === 0) {
          return current;
        }
        setOrientationResetVersion((value) => value + 1);
        return [0, 0, 0];
      });
      resetAllTcpOrientationRates();
    };

    window.addEventListener("pointerup", resetOrientationInputs);
    window.addEventListener("pointercancel", resetOrientationInputs);
    window.addEventListener("mouseup", resetOrientationInputs);
    window.addEventListener("touchend", resetOrientationInputs);
    window.addEventListener("blur", resetOrientationInputs);

    return () => {
      window.removeEventListener("pointerup", resetOrientationInputs);
      window.removeEventListener("pointercancel", resetOrientationInputs);
      window.removeEventListener("mouseup", resetOrientationInputs);
      window.removeEventListener("touchend", resetOrientationInputs);
      window.removeEventListener("blur", resetOrientationInputs);
    };
  }, []);

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
        {previewTarget.value.tcp.slice(0, 3).map((value, index) => (
          <SliderRow
            key={TCP_LABELS[index]}
            label={TCP_LABELS[index]}
            min={-1}
            max={1}
            step={0.01}
            unit="м"
            value={value}
            disabled={editingDisabled.value}
            onInput={(next) => updateTcp(index, next)}
          />
        ))}
        {previewTarget.value.tcp.slice(3).map((value, offset) => {
          const index = offset + 3;
          return (
            <SliderRow
              key={`${TCP_LABELS[index]}-${orientationResetVersion}`}
              label={TCP_LABELS[index]}
              min={-180}
              max={180}
              step={1}
              unit="°"
              value={orientationInputs[offset]}
              displayValue={value}
              disabled={editingDisabled.value}
              onInput={(next) => {
                const updated = [...orientationInputs] as [number, number, number];
                updated[offset] = next;
                setOrientationInputs(updated);
                setTcpOrientationRate(index as 3 | 4 | 5, next);
              }}
              onCommit={() => {
                const updated = [...orientationInputs] as [number, number, number];
                updated[offset] = 0;
                setOrientationInputs(updated);
                setOrientationResetVersion((current) => current + 1);
                resetTcpOrientationRate(index as 3 | 4 | 5);
              }}
              resetToZeroOnCommit
              variant="velocity"
            />
          );
        })}
      </div>
    </section>
  );
}
