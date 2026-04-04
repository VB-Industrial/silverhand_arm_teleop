import {
  appState,
  finishExecution,
  interactionMode,
  safetyState,
  setFault,
  startJoystickServoing,
  stopJoystickServoing,
} from "../store/appState";
import {
  connectRobot,
  disconnectRobot,
  reconnectRobot,
  robotConnectionError,
  robotConnectionState,
  robotConnectionUrl,
  setRobotConnectionUrl,
} from "../transport/robotConnectionStore";

export function ServicePanel() {
  return (
    <section className="panel service-bar">
      <div className="service-bar-label">
        <span className="section-overline">Сервис</span>
        <strong>Mock, отладка и сеть</strong>
      </div>
      <div className="service-actions">
        <label className="service-url-input">
          <span>WS</span>
          <input
            onInput={(event) => setRobotConnectionUrl((event.currentTarget as HTMLInputElement).value)}
            placeholder="ws://127.0.0.1:8765"
            type="text"
            value={robotConnectionUrl.value}
          />
        </label>

        <button
          className={robotConnectionState.value === "connected" ? "secondary-action accent-amber" : "secondary-action"}
          onClick={() => {
            if (robotConnectionState.value === "connected" || robotConnectionState.value === "connecting") {
              disconnectRobot();
            } else {
              connectRobot();
            }
          }}
          type="button"
        >
          {robotConnectionState.value === "connected" || robotConnectionState.value === "connecting" ? "Отключить WS" : "Подключить WS"}
        </button>

        <button className="secondary-action" onClick={reconnectRobot} type="button">
          Переподключить WS
        </button>

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
      {robotConnectionError.value ? <span className="service-status-text">{robotConnectionError.value}</span> : null}
    </section>
  );
}
