import { useState } from "preact/hooks";
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
  robotBackendLog,
  robotBackendStatus,
  disconnectRobot,
  reconnectRobot,
  robotConnectionError,
  robotConnectionState,
  robotConnectionUrl,
  setRobotConnectionUrl,
} from "../transport/robotConnectionStore";

export function ServicePanel() {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <section className={collapsed ? "panel service-bar service-bar-collapsed" : "panel service-bar"}>
      <div className="service-bar-label">
        <span className="section-overline">Сервис</span>
        <strong>Mock, отладка и сеть</strong>
      </div>
      <div className="service-bar-toggle">
        <button className="secondary-action" onClick={() => setCollapsed((value) => !value)} type="button">
          {collapsed ? "Показать отладочную панель" : "Скрыть отладочную панель"}
        </button>
      </div>
      {!collapsed ? (
        <>
      <div className="service-actions">
        <label className="service-url-input">
          <span>WS</span>
          <input
            onInput={(event) => setRobotConnectionUrl((event.currentTarget as HTMLInputElement).value)}
            placeholder="ws://192.168.20.5:8765"
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
      <div className="service-status-block">
        <span className="service-status-text">{robotConnectionError.value || robotBackendStatus.value || "Статус backend появится после первого события."}</span>
        {robotBackendLog.value.length > 0 ? (
          <div className="service-status-log">
            {robotBackendLog.value.map((entry) => (
              <div className={`service-log-entry service-log-entry-${entry.level}`} key={`${entry.timestamp}-${entry.text}`}>
                {entry.text}
              </div>
            ))}
          </div>
        ) : null}
      </div>
        </>
      ) : null}
    </section>
  );
}
