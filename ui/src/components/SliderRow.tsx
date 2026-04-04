type SliderRowProps = {
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  value: number;
  displayValue?: number;
  disabled: boolean;
  onInput: (value: number) => void;
  onCommit?: () => void;
  resetToZeroOnCommit?: boolean;
  variant?: "default" | "velocity";
};

export function SliderRow(props: SliderRowProps) {
  const armCommitOnRelease = (input?: HTMLInputElement | null) => {
    if (!props.onCommit) {
      return;
    }

    let committed = false;
    const commitOnce = () => {
      if (committed) {
        return;
      }
      committed = true;
      if (props.resetToZeroOnCommit && input) {
        input.value = "0";
      }
      props.onCommit?.();
      window.removeEventListener("pointerup", commitOnce);
      window.removeEventListener("pointercancel", commitOnce);
      window.removeEventListener("mouseup", commitOnce);
      window.removeEventListener("touchend", commitOnce);
      window.removeEventListener("blur", commitOnce);
    };

    window.addEventListener("pointerup", commitOnce, { once: true });
    window.addEventListener("pointercancel", commitOnce, { once: true });
    window.addEventListener("mouseup", commitOnce, { once: true });
    window.addEventListener("touchend", commitOnce, { once: true });
    window.addEventListener("blur", commitOnce, { once: true });
  };

  const isVelocity = props.variant === "velocity";
  const range = props.max - props.min || 1;
  const normalized = ((props.value - props.min) / range) * 100;

  return (
    <label className={props.disabled ? "slider-row disabled" : "slider-row"}>
      <div className="slider-head">
        <span>{props.label}</span>
        <strong>
          {Number.isInteger(props.displayValue ?? props.value)
            ? props.displayValue ?? props.value
            : (props.displayValue ?? props.value).toFixed(2)}
          {props.unit}
        </strong>
      </div>
      <input
        className={isVelocity ? "velocity-slider" : undefined}
        disabled={props.disabled}
        max={props.max}
        min={props.min}
        onInput={(event) => {
          props.onInput(Number((event.currentTarget as HTMLInputElement).value));
        }}
        onPointerDown={(event) => {
          armCommitOnRelease(event.currentTarget as HTMLInputElement);
        }}
        onTouchStart={(event) => {
          armCommitOnRelease(event.currentTarget as HTMLInputElement);
        }}
        onPointerUp={(event) => {
          if (props.resetToZeroOnCommit) {
            (event.currentTarget as HTMLInputElement).value = "0";
          }
          props.onCommit?.();
        }}
        onMouseUp={(event) => {
          if (props.resetToZeroOnCommit) {
            (event.currentTarget as HTMLInputElement).value = "0";
          }
          props.onCommit?.();
        }}
        onTouchEnd={(event) => {
          if (props.resetToZeroOnCommit) {
            (event.currentTarget as HTMLInputElement).value = "0";
          }
          props.onCommit?.();
        }}
        step={props.step}
        onBlur={() => {
          props.onCommit?.();
        }}
        style={
          isVelocity
            ? {
                "--slider-progress": `${normalized}%`,
              }
            : undefined
        }
        type="range"
        value={props.value}
      />
    </label>
  );
}
