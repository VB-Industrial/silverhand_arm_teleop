# silverhand_arm_teleop

Веб-UI и телепульт для установленной на rover руки SilverHand.

Текущее состояние:
- локальный `preview IK` и кинематическая сцена
- управление рукой через `joint` и `TCP/gizmo`
- управление захватом
- передача по websocket к шлюзу на стороне робота
- работа как с непосредственным `ros2_control`, так и с `MoveIt`, если это скрыто за `ws_gateway`

## Требования

- Ubuntu 24.04
- Node.js + npm (Node **20.19+** или **22.12+**, иначе `vite` не соберётся)
- ROS 2 Jazzy

Минимум:

```bash
sudo apt-get update
sudo apt-get install -y ros-jazzy-xacro
```

Node.js (рекомендуется через `nvm`, чтобы не зависеть от версии из `apt`):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22
node -v
```

Если нужен **системный** Node.js (через `apt`, требует root), ставьте Node 22 из репозитория NodeSource:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key -o /tmp/nodesource.gpg.key
sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg /tmp/nodesource.gpg.key

echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list
sudo apt-get update
sudo apt-get install -y nodejs
node -v
```

## Зависимости UI

```bash
cd ~/silver_ws/src/silverhand_arm_teleop/ui
npm install
```

## Ассеты модели

GUI использует уже подготовленные ассеты из:

- `ui/public/assets/system/urdf/silverhand_system.urdf`
- `ui/public/assets/rover/...`
- `ui/public/assets/arm/...`

Если модели/URDF были изменены, ассеты нужно регенерировать отдельно. В обычном сценарии разработки этого делать не требуется на каждый запуск.

## Запуск GUI

### Режим разработки

```bash
cd ~/silver_ws/src/silverhand_arm_teleop/ui
npm run dev -- --host 0.0.0.0 --port 4173
```

Открыть:

- `http://localhost:4173/`
- или `http://<YOUR_HOST_IP>:4173/`

### Сборка для production

```bash
cd ~/silver_ws/src/silverhand_arm_teleop/ui
npm run build
```

### Запуск собранного UI без Vite

В репозитории есть helper-скрипт:

```bash
cd ~/silver_ws/src/silverhand_arm_teleop
./silverhand_arm_teleop_start.sh
```

По умолчанию он поднимает статическую раздачу на:

- `http://0.0.0.0:4173`

Можно переопределить:

```bash
HOST=0.0.0.0 PORT=4174 ./silverhand_arm_teleop_start.sh
```

## systemd

Шаблон systemd-сервиса:

- `systemd/system/silverhand-arm-teleop.service`

Установка:

```bash
sudo install -Dm644 systemd/system/silverhand-arm-teleop.service /etc/systemd/system/silverhand-arm-teleop.service
sudo systemctl daemon-reload
```

Перед запуском сервиса UI должен быть собран:

```bash
cd ~/silver_ws/src/silverhand_arm_teleop/ui
npm install
npm run build
```

Запуск:

```bash
sudo systemctl enable --now silverhand-arm-teleop.service
```

Автозапуск при старте системы уже обеспечивает systemd.

Полезные команды:

```bash
systemctl status silverhand-arm-teleop.service
journalctl -u silverhand-arm-teleop.service -f
sudo systemctl restart silverhand-arm-teleop.service
```

## Подключение к роботу

GUI сам по себе не ходит в ROS напрямую. Он подключается к шлюзу websocket на стороне робота.

URL задаётся в сервисной панели, типичный пример:

```text
ws://192.168.0.100:8765
```

Внизу панели сейчас показываются:

- текущее состояние серверной части
- несколько последних status/fault сообщений

Это основной способ быстро понять:

- дошёл ли goal
- что вернул `MoveIt`
- есть ли fault / stop / estop

## Типовые сценарии

### 1. Локальный GUI + удалённый шлюз робота

Самый частый режим:

1. На robot machine поднимаются:
   - `silverhand_system_bringup`
   - `silverhand_ws_gateway`
2. Здесь запускается только GUI.
3. В GUI указывается `ws://<robot-ip>:8765`.

### 2. Полностью локальная smoke-проверка

Для smoke/test режима можно поднять:

- `ros2 run silverhand_ws_gateway gateway --mode mock`

и подключить GUI к:

```text
ws://127.0.0.1:8765
```

## Что уже стабильно работает

- preview IK с учётом бокового оффсета плеча
- `gizmo` в TCP цели
- `ghost target` в кинематической сцене
- сглаживание входящих `joint_state` из websocket
- журнал сервиса внизу панели

## Связанные пакеты

Часть на стороне робота живёт отдельно:

- [silverhand_system_bringup](../silverhand_system_bringup)
- [silverhand_ws_gateway](../silverhand_ws_gateway)

Именно там запускаются:

- непосредственный `ros2_control`
- `MoveIt`
- websocket bridge к GUI

## Краткая памятка по systemd

Общая схема для всех сервисов в проекте одинаковая:

1. Собрать workspace:

```bash
cd ~/silver_ws
source /opt/ros/jazzy/setup.bash
colcon build
```

2. Установить нужный `.service` или template в `/etc/systemd/system/`
3. Выполнить:

```bash
sudo systemctl daemon-reload
```

4. Включить нужный сервис:

```bash
sudo systemctl enable --now silverhand-arm-teleop.service
sudo systemctl enable --now silverhand-ws-gateway@arm_moveit.service
sudo systemctl enable --now silverhand-system-bringup@arm_hand_moveit.service
```

5. Смотреть статус и логи:

```bash
systemctl status silverhand-ws-gateway@arm_moveit.service
journalctl -u silverhand-ws-gateway@arm_moveit.service -f
```
