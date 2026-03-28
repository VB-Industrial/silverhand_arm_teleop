import { activateEstop, estopActive, resetEstop } from "../store/appState";

export function KillSwitchPanel() {
  return (
    <section className="panel kill-card">
      <div className="panel-head">
        <h2>Аварийная остановка</h2>
        <span className={estopActive.value ? "status-dot red" : "status-dot muted"}>
          {estopActive.value ? "Активен" : "Не активен"}
        </span>
      </div>

      <button className="kill-switch" onClick={activateEstop} type="button">
        <span>АВАРИЙНЫЙ СТОП</span>
        <small>KILL SWITCH</small>
      </button>

      <button
        className="secondary-action danger-outline"
        disabled={!estopActive.value}
        onClick={resetEstop}
        type="button"
      >
        Сброс аварийного стопа
      </button>
    </section>
  );
}
