import { cameraSummary } from "../camera/cameraStore";
import { appState, estopActive, safetyState } from "../store/appState";
import { translateState } from "../app/viewModel";

export function FooterStatusBar() {
  return (
    <footer className="bottombar panel">
      <FooterBadge label="Манипулятор готов" active={safetyState.value.armReady} />
      <FooterBadge label="Контроль активен" active={safetyState.value.controlActive} />
      <FooterBadge label="Ошибок нет" active={safetyState.value.noFaults} />
      <FooterBadge label="Связь установлена" active={safetyState.value.connectionReady} />
      <FooterBadge
        label={`Камеры ${cameraSummary.value.liveCount}/${cameraSummary.value.totalPrimary}`}
        active={!cameraSummary.value.hasErrors && cameraSummary.value.unconfiguredCount === 0}
      />
      <FooterBadge label={translateState(appState.value)} active={!estopActive.value} />
    </footer>
  );
}

function FooterBadge(props: { label: string; active: boolean }) {
  return (
    <div className={props.active ? "footer-badge active" : "footer-badge"}>
      <span className={props.active ? "status-dot green" : "status-dot red"} />
      <span>{props.label}</span>
    </div>
  );
}
