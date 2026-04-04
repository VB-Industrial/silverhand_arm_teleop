import { CameraGridPanel } from "../panels/CameraGridPanel";
import { ExecutePanel } from "../panels/ExecutePanel";
import { GripperPanel } from "../panels/GripperPanel";
import { HeaderBar } from "../panels/HeaderBar";
import { JointControlPanel } from "../panels/JointControlPanel";
import { KinematicViewportPanel } from "../panels/KinematicViewportPanel";
import { PosePresetPanel } from "../panels/PosePresetPanel";
import { ServicePanel } from "../panels/ServicePanel";
import { TcpControlPanel } from "../panels/TcpControlPanel";

export function App() {
  return (
    <main className="console-shell">
      <HeaderBar />

      <section className="workspace-grid">
        <CameraGridPanel />

        <section className="control-row">
          <JointControlPanel />
          <KinematicViewportPanel />
          <div className="action-stack">
            <ExecutePanel />
            <PosePresetPanel />
            <GripperPanel />
          </div>
          <TcpControlPanel />
        </section>

        <section className="service-row">
          <ServicePanel />
        </section>
      </section>
    </main>
  );
}
