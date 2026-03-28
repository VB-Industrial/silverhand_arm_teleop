type SliderRowProps = {
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  value: number;
  disabled: boolean;
  onInput: (value: number) => void;
};

export function SliderRow(props: SliderRowProps) {
  return (
    <label className={props.disabled ? "slider-row disabled" : "slider-row"}>
      <div className="slider-head">
        <span>{props.label}</span>
        <strong>
          {Number.isInteger(props.value) ? props.value : props.value.toFixed(2)}
          {props.unit}
        </strong>
      </div>
      <input
        disabled={props.disabled}
        max={props.max}
        min={props.min}
        onInput={(event) => {
          props.onInput(Number((event.currentTarget as HTMLInputElement).value));
        }}
        step={props.step}
        type="range"
        value={props.value}
      />
    </label>
  );
}
