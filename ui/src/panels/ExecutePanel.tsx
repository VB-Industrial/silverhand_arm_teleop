import {
  activateEstop,
  appState,
  canExecute,
  canReset,
  canStop,
  estopActive,
  executeTarget,
  interactionMode,
  resetState,
  resetEstop,
  stopExecution,
} from "../store/appState";
import { translateInteractionMode, translateState } from "../app/viewModel";

export function ExecutePanel() {
  return (
    <section className="panel execute-panel">
      <div className="panel-head">
        <h2>Управление движением</h2>
        <span className="muted-text">{translateState(appState.value)}</span>
      </div>

      <div className="execution-summary">
        <span className="summary-label">Текущий контур</span>
        <strong className="summary-value">{translateInteractionMode(interactionMode.value)}</strong>
      </div>

      <div className="execution-actions">
        <button className="execute-action" disabled={!canExecute.value} onClick={executeTarget} type="button">
          Движение
        </button>
        <button className="secondary-action" disabled={!canStop.value} onClick={stopExecution} type="button">
          Стоп
        </button>
        <button className="secondary-action" disabled={!canReset.value} onClick={resetState} type="button">
          Сброс
        </button>
      </div>

      <div className="estop-actions">
        <button className="kill-switch inline" onClick={activateEstop} type="button">
          <span>АВАРИЙНЫЙ СТОП</span>
          <small>KILL SWITCH</small>
        </button>
        <button
          className="secondary-action danger-outline"
          disabled={!estopActive.value}
          onClick={resetEstop}
          type="button"
        >
          Сброс АС
        </button>
      </div>
    </section>
  );
}
