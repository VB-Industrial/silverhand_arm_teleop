# silverhand_arm_teleop

Teleop + GUI for the SilverHand rover-mounted manipulator.

## Dependencies

### System packages

Required on Ubuntu:

```bash
sudo apt-get update
sudo apt-get install -y nodejs npm
```

### ROS 2 and xacro

The current setup expects ROS 2 Jazzy and `xacro` to be available:

```bash
source /opt/ros/jazzy/setup.bash
which xacro
```

If `xacro` is missing:

```bash
sudo apt-get update
sudo apt-get install -y ros-jazzy-xacro
```

### Local source repositories

The UI currently consumes robot descriptions from these local repos:

- `/home/r/silver_ws/src/silverhand_rover_control`
- `/home/r/silver_ws/src/silverhand_ros2`

In particular it uses:

- `/home/r/silver_ws/src/silverhand_rover_control/silverhand_rover_description`
- `/home/r/silver_ws/src/silverhand_ros2/silverhand_arm_description`

## UI dependencies

Install JavaScript dependencies:

```bash
cd /home/r/silver_ws/src/silverhand_arm_teleop/ui
npm install
```

Current npm packages:

- `preact`
- `@preact/signals`
- `three`
- `urdf-loader`
- `typescript`
- `vite`
- `@preact/preset-vite`
- `@types/three`

## Prepare URDF and mesh assets

The current kinematic viewport uses copied mesh assets and a generated rover URDF.

Run:

```bash
source /opt/ros/jazzy/setup.bash
export ROS_PACKAGE_PATH=/home/r/silver_ws/src/silverhand_rover_control:/home/r/silver_ws/src/silverhand_ros2:$ROS_PACKAGE_PATH

mkdir -p /home/r/silver_ws/src/silverhand_arm_teleop/ui/public/assets/rover/urdf
mkdir -p /home/r/silver_ws/src/silverhand_arm_teleop/ui/public/assets/rover/meshes
mkdir -p /home/r/silver_ws/src/silverhand_arm_teleop/ui/public/assets/arm/urdf
mkdir -p /home/r/silver_ws/src/silverhand_arm_teleop/ui/public/assets/arm/meshes

xacro \
  /home/r/silver_ws/src/silverhand_rover_control/silverhand_rover_description/urdf/silverhand_rover_model.urdf.xacro \
  > /home/r/silver_ws/src/silverhand_arm_teleop/ui/public/assets/rover/urdf/silverhand_rover.urdf

cp /home/r/silver_ws/src/silverhand_rover_control/silverhand_rover_description/meshes/* \
  /home/r/silver_ws/src/silverhand_arm_teleop/ui/public/assets/rover/meshes/

cp /home/r/silver_ws/src/silverhand_ros2/silverhand_arm_description/urdf/silverhand.urdf \
  /home/r/silver_ws/src/silverhand_arm_teleop/ui/public/assets/arm/urdf/silverhand.urdf

cp /home/r/silver_ws/src/silverhand_ros2/silverhand_arm_description/meshes/* \
  /home/r/silver_ws/src/silverhand_arm_teleop/ui/public/assets/arm/meshes/
```

## Run UI

Development server:

```bash
cd /home/r/silver_ws/src/silverhand_arm_teleop/ui
npm run dev -- --host 0.0.0.0 --port 4173
```

Production build:

```bash
cd /home/r/silver_ws/src/silverhand_arm_teleop/ui
npm run build
```
