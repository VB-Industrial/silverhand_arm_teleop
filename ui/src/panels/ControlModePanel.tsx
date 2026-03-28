import { controlMode, setControlMode } from "../store/appState";

export function ControlModePanel() {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Режим управления</h2>
      </div>
      <div className="segmented">
        <button
          className={controlMode.value === "joint" ? "segment active" : "segment"}
          onClick={() => setControlMode("joint")}
          type="button"
        >
          Углы манипулятора
        </button>
        <button
          className={controlMode.value === "tcp" ? "segment active" : "segment"}
          onClick={() => setControlMode("tcp")}
          type="button"
        >
          Декартовы координаты
        </button>
      </div>
    </section>
  );
}
