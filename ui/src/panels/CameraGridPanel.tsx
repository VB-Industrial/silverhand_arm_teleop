import { collapsedCameraIds, expandedCameraIds } from "../camera/cameraStore";
import { CameraTile } from "./CameraTile";

export function CameraGridPanel() {
  return (
    <section className="camera-stage panel">
      <div
        className="camera-grid"
        style={{
          gridTemplateColumns: `repeat(${Math.max(expandedCameraIds.value.length, 1)}, minmax(0, 1fr))`,
        }}
      >
        {expandedCameraIds.value.map((cameraId) => (
          <CameraTile cameraId={cameraId} key={cameraId} />
        ))}
      </div>

      {collapsedCameraIds.value.length > 0 ? (
        <aside className="camera-collapsed-column">
          {collapsedCameraIds.value.map((cameraId) => (
            <CameraTile cameraId={cameraId} compact key={cameraId} />
          ))}
        </aside>
      ) : null}
    </section>
  );
}
