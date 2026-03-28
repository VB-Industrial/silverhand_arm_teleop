import { appState, safetyState } from "../store/appState";
import { cameraSummary } from "../camera/cameraStore";
import { stateTone, translateState } from "../app/viewModel";

export function HeaderBar() {
  return (
    <header className="topbar panel">
      <div className="topbar-brand">
        <h1>SilverHand</h1>
      </div>

      <div className="topbar-status">
        <HeaderBadge label="Состояние" value={translateState(appState.value)} accent={stateTone(appState.value)} />
        <HeaderBadge
          label="Камеры"
          value={`${cameraSummary.value.liveCount}/${cameraSummary.value.totalPrimary} live`}
          accent={cameraSummary.value.hasErrors ? "red" : "green"}
        />
        <HeaderBadge label="Связь" value={safetyState.value.connectionReady ? "Установлена" : "Нет"} accent="green" />
        <HeaderBadge label="Манипулятор" value={safetyState.value.armReady ? "Готов" : "Не готов"} accent={safetyState.value.armReady ? "green" : "red"} />
        <HeaderBadge
          label="Контроль"
          value={safetyState.value.controlActive ? "Активен" : "Отключён"}
          accent={safetyState.value.controlActive ? "green" : "red"}
        />
        <HeaderBadge label="Ошибки" value={safetyState.value.noFaults ? "Нет" : "Есть"} accent={safetyState.value.noFaults ? "green" : "red"} />
      </div>
    </header>
  );
}

function HeaderBadge(props: { label: string; value: string; accent: "green" | "amber" | "red" | "blue" }) {
  return (
    <div className={`header-badge ${props.accent}`}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}
