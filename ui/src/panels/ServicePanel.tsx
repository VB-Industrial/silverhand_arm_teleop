import {
  appState,
  finishExecution,
  interactionMode,
  safetyState,
  setFault,
  startJoystickServoing,
  stopJoystickServoing,
} from "../store/appState";

export function ServicePanel() {
  return (
    <section className="panel service-bar">
      <div className="service-bar-label">
        <span className="section-overline">Сервис</span>
        <strong>Mock и отладка</strong>
      </div>
      <div className="service-actions">
        <button
          className={interactionMode.value === "servo_joystick" ? "secondary-action accent-amber" : "secondary-action"}
          disabled={appState.value === "executing"}
          onClick={() => {
            if (interactionMode.value === "servo_joystick") {
              stopJoystickServoing();
            } else {
              startJoystickServoing();
            }
          }}
          type="button"
        >
          {interactionMode.value === "servo_joystick" ? "Остановить сервоинг" : "Сымитировать сервоинг"}
        </button>

        <button
          className="secondary-action"
          disabled={appState.value !== "executing"}
          onClick={finishExecution}
          type="button"
        >
          Завершить mock
        </button>

        <button
          className={safetyState.value.noFaults ? "ghost-button" : "ghost-button active-danger"}
          onClick={() => setFault(safetyState.value.noFaults)}
          type="button"
        >
          {safetyState.value.noFaults ? "Сымитировать fault" : "Сбросить fault"}
        </button>
      </div>
    </section>
  );
}
