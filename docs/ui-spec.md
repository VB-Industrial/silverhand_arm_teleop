# UI Specification

## Main Screen

The main screen is a single operator workspace.

It contains:

1. top status bar
2. three primary camera panels
3. one optional auxiliary camera panel
4. one kinematic model panel
5. right-side control column

## Main Areas

### Header

Shows:

- application title
- overall system state
- robot connection
- camera state
- arm ready
- control state
- fault state

### Primary Cameras

Three large tiles:

1. `Камера водителя`
2. `Камера на манипуляторе`
3. `Диагональная камера ровера`

These are the highest visual priority on the screen.

### Auxiliary Camera

One smaller optional tile:

- `Передняя полусфера`

This must be visually secondary.

### Kinematic Model

One large technical panel:

- `Кинематическая модель`

Iteration 1 uses a mock placeholder.
Later iterations replace it with a URDF-driven viewport.

### Right Control Column

Contains:

1. `Управление звеньями`
2. `Управление TCP`
3. `Управление захватом`
4. `Управление движением`
5. `Сервисные действия`

### Emergency Stop

Integrated into the motion control panel:

- `АВАРИЙНЫЙ СТОП`

It must remain visually stronger than normal motion controls.

## Execution Controls

The main execution actions are:

- `Движение`
- `Стоп`
- `Сброс`
- `Сброс аварийного стопа`

Which controls are visible or enabled depends on the current top-level state.

## Service Actions

The service area contains only mock and debug controls, for example:

- joystick servoing simulation
- mock execution completion
- fault simulation

## Interaction Rules

- joystick motion starts direct servoing
- click in the kinematic viewport selects the gizmo/planner contour
- joint sliders move the planner target in joint space
- TCP sliders move the planner target in Cartesian space
- gripper controls use direct servoing and apply immediately
- gripper direct control does not block manipulator planning controls
- only direct joystick servoing bypasses the planner target
- `Выполнить` sends the current planner target for execution

## Iteration 1 Rules

1. UI labels are in Russian.
2. Camera panels are placeholders.
3. Kinematic model is a placeholder.
4. State is mock-driven.
5. Layout and control hierarchy must already match the intended product.
