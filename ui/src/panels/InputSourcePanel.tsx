import { inputSource, setInputSource } from "../store/appState";

export function InputSourcePanel() {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Источник ввода</h2>
      </div>
      <div className="stacked-buttons">
        <ToggleButton active={inputSource.value === "joystick"} label="Джойстик" onClick={() => setInputSource("joystick")} />
        <ToggleButton
          active={inputSource.value === "keyboard_mouse"}
          label="Клавиатура + мышь"
          onClick={() => setInputSource("keyboard_mouse")}
        />
        <ToggleButton active={inputSource.value === "sliders"} label="Слайдеры" onClick={() => setInputSource("sliders")} />
      </div>
    </section>
  );
}

function ToggleButton(props: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button className={props.active ? "stack-button active" : "stack-button"} onClick={props.onClick} type="button">
      {props.label}
    </button>
  );
}
