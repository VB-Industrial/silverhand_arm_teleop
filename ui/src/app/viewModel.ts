export const JOINT_LABELS = ["Звено 1", "Звено 2", "Звено 3", "Звено 4", "Звено 5", "Звено 6"];
export const TCP_LABELS = ["X", "Y", "Z", "Крен", "Тангаж", "Рыскание"];

export function translateState(state: string): string {
  switch (state) {
    case "idle":
      return "Ожидание";
    case "preview":
      return "Предпросмотр";
    case "target_locked":
      return "Цель зафиксирована";
    case "executing":
      return "Выполнение";
    case "stopped":
      return "Остановлено";
    case "estop_active":
      return "Аварийный стоп";
    case "fault":
      return "Ошибка";
    default:
      return state;
  }
}

export function translateSource(source: string): string {
  switch (source) {
    case "joystick":
      return "Джойстик";
    case "keyboard_mouse":
      return "Клавиатура + мышь";
    case "sliders":
      return "Слайдеры";
    default:
      return source;
  }
}

export function translateInteractionMode(mode: string): string {
  switch (mode) {
    case "idle":
      return "Ожидание команды";
    case "servo_joystick":
      return "Прямой сервоинг джойстиком";
    case "servo_gripper":
      return "Прямое управление захватом";
    case "planner_gizmo":
      return "Цель планировщика: gizmo";
    case "planner_joint":
      return "Цель планировщика: звенья";
    case "planner_tcp":
      return "Цель планировщика: TCP";
    default:
      return mode;
  }
}

export function stateTone(state: string): "green" | "amber" | "red" | "blue" {
  switch (state) {
    case "idle":
      return "blue";
    case "preview":
      return "amber";
    case "target_locked":
      return "amber";
    case "executing":
      return "green";
    case "stopped":
      return "amber";
    case "estop_active":
      return "red";
    case "fault":
      return "red";
    default:
      return "blue";
  }
}

export function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
