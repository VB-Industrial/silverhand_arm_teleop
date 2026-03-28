import { safetyState, setFault } from "../store/appState";

export function SafetyPanel() {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Безопасность</h2>
        <button
          className={safetyState.value.noFaults ? "ghost-button" : "ghost-button active-danger"}
          onClick={() => setFault(safetyState.value.noFaults)}
          type="button"
        >
          {safetyState.value.noFaults ? "Сымитировать fault" : "Сбросить fault"}
        </button>
      </div>

      <div className="safety-list">
        <SafetyRow label="Манипулятор готов" active={safetyState.value.armReady} />
        <SafetyRow label="Контроль активен" active={safetyState.value.controlActive} />
        <SafetyRow label="Ошибок нет" active={safetyState.value.noFaults} />
        <SafetyRow label="Связь установлена" active={safetyState.value.connectionReady} />
      </div>
    </section>
  );
}

function SafetyRow(props: { label: string; active: boolean }) {
  return (
    <div className="safety-row">
      <span className={props.active ? "status-dot green" : "status-dot red"} />
      <span>{props.label}</span>
    </div>
  );
}
