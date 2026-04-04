import { useEffect, useRef, useState } from "preact/hooks";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import URDFLoader from "urdf-loader";
import { PAPER_DH_GEOMETRY_METERS } from "../kinematics";
import type { OrientationQuaternion } from "../kinematics";

const JOINT_NAMES = ["arm_joint_1", "arm_joint_2", "arm_joint_3", "arm_joint_4", "arm_joint_5", "arm_joint_6"];
const HAND_JOINT_NAMES = ["hand_left_finger_joint", "hand_right_finger_joint"];
const GIZMO_GRAB_WRIST_PRESET_DEG: [number, number, number] = [0, 90, 0];
const HAND_MAX_OPENING = 0.01;
const HAND_TCP_OFFSET = new THREE.Vector3(0, 0, 0.0642);
const HAND_GRASP_FORWARD_OFFSET = 0.05;
const ARM_LINK6_TCP_OFFSET = new THREE.Vector3(0, 0, PAPER_DH_GEOMETRY_METERS.d6);

type KinematicSceneProps = {
  realJoints: number[];
  targetJoints: number[];
  realGripperPercent: number;
  targetGripperPercent: number;
  targetTcp: [number, number, number];
  targetQuaternion: OrientationQuaternion;
  gizmoWristPresetArmed: boolean;
  interactionMode: "idle" | "servo_joystick" | "servo_gripper" | "planner_gizmo" | "planner_joint" | "planner_tcp";
  onTcpPositionChange?: (positions: { real: [number, number, number]; target: [number, number, number] }) => void;
  onInitialTargetSync?: (position: [number, number, number], quaternion: OrientationQuaternion) => void;
  onTargetJointPoseSync?: (position: [number, number, number], quaternion: OrientationQuaternion) => void;
  onConsumeGizmoWristPreset?: () => void;
  onTargetQuaternionChange?: (quaternion: OrientationQuaternion) => void;
  onTargetTcpChange?: (position: [number, number, number]) => void;
};

type LoadedSceneRefs = {
  realSystem: any | null;
  targetSystem: any | null;
  robotRoot: THREE.Group | null;
  armBase: THREE.Object3D | null;
  realTool: THREE.Object3D | null;
  targetTool: THREE.Object3D | null;
  realLeftFinger: THREE.Object3D | null;
  realRightFinger: THREE.Object3D | null;
  targetLeftFinger: THREE.Object3D | null;
  targetRightFinger: THREE.Object3D | null;
  gizmoAnchor: THREE.Object3D | null;
};

export function KinematicScene(props: KinematicSceneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const latestPropsRef = useRef(props);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sceneRefs = useRef<LoadedSceneRefs>({
    realSystem: null,
    targetSystem: null,
    robotRoot: null,
    armBase: null,
    realTool: null,
    targetTool: null,
    realLeftFinger: null,
    realRightFinger: null,
    targetLeftFinger: null,
    targetRightFinger: null,
    gizmoAnchor: null,
  });
  const translateTransformRef = useRef<TransformControls | null>(null);
  const rotateTransformRef = useRef<TransformControls | null>(null);
  const draggingRef = useRef(false);
  const sphereDraggingRef = useRef(false);
  const sphereHoveredRef = useRef(false);
  const activeHoverModeRef = useRef<"translate" | "rotate" | "none">("none");
  const syncingGizmoRef = useRef(false);
  const initializedFromToolRef = useRef(false);
  const gizmoGrabPresetAppliedRef = useRef(false);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  latestPropsRef.current = props;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = null;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 0.8;
    controls.maxDistance = 6;
    controls.maxPolarAngle = Math.PI * 0.495;
    applyDefaultView(camera, controls);
    cameraRef.current = camera;
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 1.7));

    const hemiLight = new THREE.HemisphereLight(0xdde7ff, 0x0e1117, 1.5);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    keyLight.position.set(3, 4, 2);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x7db5ff, 0.55);
    fillLight.position.set(-2, 1.5, -1.5);
    scene.add(fillLight);

    const grid = new THREE.GridHelper(4, 24, 0x3f5066, 0x25303e);
    scene.add(grid);

    const axes = new THREE.AxesHelper(0.45);
    axes.position.set(0, 0.01, 0);
    scene.add(axes);

    const robotRoot = new THREE.Group();
    robotRoot.rotation.x = -Math.PI / 2;
    scene.add(robotRoot);

    const gizmoAnchor = new THREE.Object3D();
    scene.add(gizmoAnchor);

    const gizmoVisual = createGizmoVisual();
    gizmoAnchor.add(gizmoVisual);
    const gizmoHandles = gizmoVisual.children.filter(
      (child) => child.name === "gizmo_shell" || child.name === "gizmo_core" || child.name === "gizmo_hit_target",
    );

    const translateTransform = new TransformControls(camera, renderer.domElement);
    translateTransform.setMode("translate");
    translateTransform.setSpace("world");
    translateTransform.size = 1.38;
    translateTransform.enabled = false;
    translateTransform.attach(gizmoAnchor);
    configureTranslateHelper(translateTransform);

    const rotateTransform = new TransformControls(camera, renderer.domElement);
    rotateTransform.setMode("rotate");
    rotateTransform.setSpace("local");
    rotateTransform.size = 0.88;
    rotateTransform.enabled = false;
    rotateTransform.attach(gizmoAnchor);
    configureRotateHelper(rotateTransform);

    const updateDragState = (value: boolean) => {
      const latest = latestPropsRef.current;
      if (value) {
        primeGizmoGrabPreset(
          sceneRefs.current,
          latest.targetJoints,
          latest.targetGripperPercent,
          latest.gizmoWristPresetArmed,
          latest.targetQuaternion,
          latest.onConsumeGizmoWristPreset,
          latest.onTargetQuaternionChange,
          syncingGizmoRef,
        );
        gizmoGrabPresetAppliedRef.current = true;
      } else {
        gizmoGrabPresetAppliedRef.current = false;
      }

      draggingRef.current = value;
      controls.enabled = !value;
      if (!value && !sphereDraggingRef.current) {
        translateTransform.axis = null;
        rotateTransform.axis = null;
        setActiveControl("none");
      }
    };

    translateTransform.addEventListener("dragging-changed", (event) => {
      updateDragState(Boolean(event.value));
    });
    rotateTransform.addEventListener("dragging-changed", (event) => {
      updateDragState(Boolean(event.value));
    });

    translateTransform.addEventListener("objectChange", () => {
      const latest = latestPropsRef.current;
      if (syncingGizmoRef.current || !sceneRefs.current.armBase || !latest.onTargetTcpChange) {
        return;
      }

      const local = sceneRefs.current.armBase.worldToLocal(gizmoAnchor.position.clone());
      const next: [number, number, number] = [
        roundToMillimeters(local.x),
        roundToMillimeters(local.y),
        roundToMillimeters(local.z),
      ];

      if (!tcpArraysEqual(next, latest.targetTcp)) {
        latest.onTargetTcpChange(next);
      }
    });

    rotateTransform.addEventListener("objectChange", () => {
      const latest = latestPropsRef.current;
      if (syncingGizmoRef.current || !sceneRefs.current.armBase || !latest.onTargetQuaternionChange) {
        return;
      }

      const orientation = tcpQuaternionFromWorld(sceneRefs.current.armBase, gizmoAnchor.quaternion);
      if (!quaternionArraysEqual(orientation, latest.targetQuaternion)) {
        latest.onTargetQuaternionChange(orientation);
      }
    });

    const translateHelper = translateTransform.getHelper();
    const rotateHelper = rotateTransform.getHelper();
    patchHelperVisibility(translateHelper, pruneTranslateHandles);
    patchHelperVisibility(rotateHelper, pruneRotateHandles);
    scene.add(translateHelper);
    scene.add(rotateHelper);
    translateTransformRef.current = translateTransform;
    rotateTransformRef.current = rotateTransform;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const dragPlane = new THREE.Plane();
    const dragIntersection = new THREE.Vector3();
    const dragOffset = new THREE.Vector3();

    const setActiveControl = (mode: "translate" | "rotate" | "none") => {
      if (activeHoverModeRef.current !== mode) {
        translateTransform.axis = null;
        rotateTransform.axis = null;
        activeHoverModeRef.current = mode;
      }

      translateTransform.enabled = mode === "translate";
      rotateTransform.enabled = mode === "rotate";
      renderer.domElement.style.cursor = mode === "none" ? "" : "grab";
    };

    const setSphereHover = (hovered: boolean) => {
      if (sphereHoveredRef.current === hovered) {
        return;
      }

      sphereHoveredRef.current = hovered;
      gizmoVisual.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!("material" in mesh) || !mesh.material) {
          return;
        }

        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((material) => {
          const typed = material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
          if (object.name === "gizmo_core") {
            if ("color" in typed) {
              typed.color.set(hovered ? 0xffd35c : 0x6bc7ff);
            }
            if ("emissive" in typed) {
              typed.emissive.set(hovered ? 0xffb200 : 0x6bc7ff).multiplyScalar(hovered ? 0.28 : 0.18);
            }
          }
          if (object.name === "gizmo_shell") {
            if ("color" in typed) {
              typed.color.set(hovered ? 0xffd35c : 0x6bc7ff);
            }
            typed.opacity = hovered ? 0.2 : 0.1;
          }
        });
      });
      gizmoVisual.scale.setScalar(hovered ? 1.08 : 1);
    };

    const pruneHelpers = () => {
      pruneTranslateHandles(translateHelper);
      pruneRotateHandles(rotateHelper);
    };

    const updatePointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const resolveHoveredHandle = () => {
      pruneHelpers();
      raycaster.setFromCamera(pointer, camera);

      const translatePicker = (translateTransform as unknown as { _gizmo?: { picker?: Record<string, THREE.Object3D> } })._gizmo?.picker?.translate;
      const rotatePicker = (rotateTransform as unknown as { _gizmo?: { picker?: Record<string, THREE.Object3D> } })._gizmo?.picker?.rotate;

      const translateHit = translatePicker ? intersectPickerAxis(raycaster, translatePicker, ["X", "Y", "Z"]) : null;
      const rotateHit = rotatePicker ? intersectPickerAxis(raycaster, rotatePicker, ["X", "Y", "Z"]) : null;

      if (translateHit && rotateHit) {
        return translateHit.distance <= rotateHit.distance ? "translate" : "rotate";
      }
      if (translateHit) {
        return "translate";
      }
      if (rotateHit) {
        return "rotate";
      }
      return "none";
    };

    const isSphereHovered = () => {
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(gizmoHandles, false).length > 0;
    };

    const emitTargetTcpFromAnchor = () => {
      const latest = latestPropsRef.current;
      if (syncingGizmoRef.current || !sceneRefs.current.armBase || !latest.onTargetTcpChange) {
        return;
      }

      const local = sceneRefs.current.armBase.worldToLocal(gizmoAnchor.position.clone());
      const next: [number, number, number] = [
        roundToMillimeters(local.x),
        roundToMillimeters(local.y),
        roundToMillimeters(local.z),
      ];

      if (!tcpArraysEqual(next, latest.targetTcp)) {
        latest.onTargetTcpChange(next);
      }
    };

    const onSpherePointerDown = (event: PointerEvent) => {
      if (draggingRef.current) {
        return;
      }

      updatePointer(event);
      if (!isSphereHovered()) {
        return;
      }

      const latest = latestPropsRef.current;
      if (!gizmoGrabPresetAppliedRef.current) {
        primeGizmoGrabPreset(
          sceneRefs.current,
          latest.targetJoints,
          latest.targetGripperPercent,
          latest.gizmoWristPresetArmed,
          latest.targetQuaternion,
          latest.onConsumeGizmoWristPreset,
          latest.onTargetQuaternionChange,
          syncingGizmoRef,
        );
        gizmoGrabPresetAppliedRef.current = true;
      }

      const cameraDirection = new THREE.Vector3();
      camera.getWorldDirection(cameraDirection);
      dragPlane.setFromNormalAndCoplanarPoint(cameraDirection, gizmoAnchor.position.clone());
      if (!raycaster.ray.intersectPlane(dragPlane, dragIntersection)) {
        return;
      }

      sphereDraggingRef.current = true;
      controls.enabled = false;
      dragOffset.copy(gizmoAnchor.position).sub(dragIntersection);
      renderer.domElement.style.cursor = "grabbing";
      setSphereHover(true);
      event.preventDefault();
      event.stopPropagation();
    };

    const onSpherePointerMove = (event: PointerEvent) => {
      if (!sphereDraggingRef.current || draggingRef.current) {
        updatePointer(event);
        const sphereHovered = isSphereHovered();
        setSphereHover(sphereHovered);
        if (!draggingRef.current) {
          setActiveControl(sphereHovered ? "none" : resolveHoveredHandle());
        }
        return;
      }

      updatePointer(event);
      raycaster.setFromCamera(pointer, camera);
      if (!raycaster.ray.intersectPlane(dragPlane, dragIntersection)) {
        return;
      }

      gizmoAnchor.position.copy(dragIntersection).add(dragOffset);
      emitTargetTcpFromAnchor();
      emitTcpPositions(sceneRefs.current, latestPropsRef.current.onTcpPositionChange);
    };

    const stopSphereDrag = () => {
      if (!sphereDraggingRef.current) {
        setSphereHover(false);
        return;
      }

      sphereDraggingRef.current = false;
      gizmoGrabPresetAppliedRef.current = false;
      controls.enabled = !draggingRef.current;
      setSphereHover(false);
      setActiveControl("none");
    };

    renderer.domElement.addEventListener("pointerdown", onSpherePointerDown);
    renderer.domElement.addEventListener("pointermove", onSpherePointerMove);
    window.addEventListener("pointerup", stopSphereDrag);
    window.addEventListener("pointercancel", stopSphereDrag);

    const packageMap = {
      silverhand_rover_model: "/assets/rover_model",
      silverhand_arm_description: "/assets/arm",
      silverhand_arm_model: "/assets/arm",
      silverhand_hand_model: "/assets/hand",
    };

    const loader = new URDFLoader();
    loader.packages = packageMap;

    let disposed = false;

    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (width === 0 || height === 0) {
        return;
      }
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    Promise.all([
      loader.loadAsync("/assets/system/urdf/silverhand_system.urdf"),
      loader.loadAsync("/assets/system/urdf/silverhand_system.urdf"),
    ])
      .then(([realSystem, targetSystem]) => {
        if (disposed) {
          return;
        }

        realSystem.traverse((object: THREE.Object3D) => {
          const mesh = object as THREE.Mesh;
          if ("material" in mesh && mesh.material) {
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            materials.forEach((material) => {
              const typed = material as THREE.MeshStandardMaterial;
              typed.roughness = 0.9;
              typed.metalness = 0.1;
            });
          }
        });

        configureTargetRobot(targetSystem);
        targetSystem.scale.setScalar(1.003);

        robotRoot.add(realSystem);
        robotRoot.add(targetSystem);

        const armBase = realSystem.getObjectByName("arm_base_link") ?? targetSystem.getObjectByName("arm_base_link");
        const realTool = realSystem.getObjectByName("hand_gripper_link") ?? realSystem.getObjectByName("arm_link_6");
        const targetTool = targetSystem.getObjectByName("hand_gripper_link") ?? targetSystem.getObjectByName("arm_link_6");
        const realLeftFinger = realSystem.getObjectByName("hand_left_finger");
        const realRightFinger = realSystem.getObjectByName("hand_right_finger");
        const targetLeftFinger = targetSystem.getObjectByName("hand_left_finger");
        const targetRightFinger = targetSystem.getObjectByName("hand_right_finger");
        const realTcpAxes = createTcpAxes(getTcpLocalOffset(realTool, realLeftFinger, realRightFinger), 0.95, 1);
        const targetTcpAxes = createTcpAxes(getTcpLocalOffset(targetTool, targetLeftFinger, targetRightFinger), 0.72, 1.08);
        realTool?.add(realTcpAxes);
        targetTool?.add(targetTcpAxes);
        sceneRefs.current = {
          realSystem,
          targetSystem,
          robotRoot,
          armBase,
          realTool,
          targetTool,
          realLeftFinger,
          realRightFinger,
          targetLeftFinger,
          targetRightFinger,
          gizmoAnchor,
        };

        applyArmJointValues(realSystem, props.realJoints);
        applyArmJointValues(targetSystem, props.targetJoints);
        applyHandJointValues(realSystem, props.realGripperPercent);
        applyHandJointValues(targetSystem, props.targetGripperPercent);
        initializeGizmoFromTool(
          sceneRefs.current,
          props.targetTcp,
          props.targetQuaternion,
          props.onInitialTargetSync,
          props.onTargetTcpChange,
          props.onTargetQuaternionChange,
          syncingGizmoRef,
          initializedFromToolRef,
        );
        targetSystem.visible = hasTargetDelta(
          props.realJoints,
          props.targetJoints,
          props.realGripperPercent,
          props.targetGripperPercent,
        );
        emitTcpPositions(sceneRefs.current, latestPropsRef.current.onTcpPositionChange);

        setLoadState("ready");
      })
      .catch((error: unknown) => {
        if (disposed) {
          return;
        }
        setLoadState("error");
        setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить URDF");
      });

    let animationFrame = 0;
    const renderLoop = () => {
      controls.update();
      pruneHelpers();
      if (sceneRefs.current.targetSystem) {
        configureTargetRobot(sceneRefs.current.targetSystem);
      }
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(renderLoop);
    };
    renderLoop();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
      controls.dispose();
      controlsRef.current = null;
      cameraRef.current = null;
      renderer.domElement.removeEventListener("pointerdown", onSpherePointerDown);
      renderer.domElement.removeEventListener("pointermove", onSpherePointerMove);
      window.removeEventListener("pointerup", stopSphereDrag);
      window.removeEventListener("pointercancel", stopSphereDrag);
      setSphereHover(false);
      translateTransform.dispose();
      rotateTransform.dispose();
      translateTransformRef.current = null;
      rotateTransformRef.current = null;
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    if (!sceneRefs.current.realSystem || !sceneRefs.current.targetSystem) {
      return;
    }

    applyArmJointValues(sceneRefs.current.realSystem, props.realJoints);
    applyArmJointValues(sceneRefs.current.targetSystem, props.targetJoints);
    applyHandJointValues(sceneRefs.current.realSystem, props.realGripperPercent);
    applyHandJointValues(sceneRefs.current.targetSystem, props.targetGripperPercent);
    sceneRefs.current.targetSystem.visible = hasTargetDelta(
      props.realJoints,
      props.targetJoints,
      props.realGripperPercent,
      props.targetGripperPercent,
    );
    emitTcpPositions(sceneRefs.current, latestPropsRef.current.onTcpPositionChange);
  }, [props.realJoints, props.targetJoints, props.realGripperPercent, props.targetGripperPercent]);

  useEffect(() => {
    if (
      props.interactionMode !== "planner_joint" ||
      !sceneRefs.current.gizmoAnchor ||
      !sceneRefs.current.armBase ||
      !sceneRefs.current.targetTool ||
      draggingRef.current ||
      sphereDraggingRef.current
    ) {
      return;
    }

    const targetPosition = tcpPositionInReferenceFrame(
      sceneRefs.current.armBase,
      sceneRefs.current.targetTool,
      sceneRefs.current.targetLeftFinger,
      sceneRefs.current.targetRightFinger,
    );
    const targetToolQuaternion = new THREE.Quaternion();
    sceneRefs.current.targetTool.getWorldQuaternion(targetToolQuaternion);
    const targetQuaternion = tcpQuaternionFromWorld(sceneRefs.current.armBase, targetToolQuaternion);

    props.onTargetJointPoseSync?.(targetPosition, targetQuaternion);
    setGizmoAnchorPose(
      sceneRefs.current.gizmoAnchor,
      sceneRefs.current.armBase,
      targetPosition,
      targetQuaternion,
      syncingGizmoRef,
    );
    emitTcpPositions(sceneRefs.current, latestPropsRef.current.onTcpPositionChange);
  }, [props.targetJoints, props.targetGripperPercent, props.interactionMode]);

  useEffect(() => {
    if (
      props.interactionMode === "planner_joint" ||
      !sceneRefs.current.gizmoAnchor ||
      !sceneRefs.current.armBase ||
      draggingRef.current ||
      sphereDraggingRef.current
    ) {
      return;
    }

    setGizmoAnchorPose(
      sceneRefs.current.gizmoAnchor,
      sceneRefs.current.armBase,
      props.targetTcp,
      props.targetQuaternion,
      syncingGizmoRef,
    );
    emitTcpPositions(sceneRefs.current, latestPropsRef.current.onTcpPositionChange);
  }, [
    props.targetTcp[0],
    props.targetTcp[1],
    props.targetTcp[2],
    props.targetQuaternion[0],
    props.targetQuaternion[1],
    props.targetQuaternion[2],
    props.targetQuaternion[3],
  ]);

  return (
    <div className="model-canvas-shell" ref={hostRef}>
      {loadState !== "ready" ? (
        <div className="model-loading-overlay">
          <span>{loadState === "error" ? errorMessage ?? "Ошибка загрузки модели" : "Загрузка URDF..."}</span>
        </div>
      ) : null}
    </div>
  );
}

function applyArmJointValues(robot: any, joints: number[]) {
  JOINT_NAMES.forEach((jointName, index) => {
    const valueDeg = joints[index] ?? 0;
    robot.setJointValue(jointName, THREE.MathUtils.degToRad(valueDeg));
  });
}

function applyHandJointValues(robot: any, percent: number) {
  const opening = HAND_MAX_OPENING * THREE.MathUtils.clamp(percent / 100, 0, 1);
  HAND_JOINT_NAMES.forEach((jointName) => {
    robot.setJointValue(jointName, opening);
  });
}

function primeGizmoGrabPreset(
  refs: LoadedSceneRefs,
  currentJoints: number[],
  gripperPercent: number,
  presetArmed: boolean,
  currentQuaternion: OrientationQuaternion,
  onConsumePreset: KinematicSceneProps["onConsumeGizmoWristPreset"],
  onTargetQuaternionChange: KinematicSceneProps["onTargetQuaternionChange"],
  syncingRef: { current: boolean },
) {
  if (
    !refs.targetSystem ||
    !refs.targetTool ||
    !refs.armBase ||
    !refs.gizmoAnchor ||
    !onTargetQuaternionChange ||
    !presetArmed
  ) {
    return;
  }

  const presetJoints = [
    currentJoints[0] ?? 0,
    currentJoints[1] ?? 0,
    currentJoints[2] ?? 0,
    GIZMO_GRAB_WRIST_PRESET_DEG[0],
    GIZMO_GRAB_WRIST_PRESET_DEG[1],
    GIZMO_GRAB_WRIST_PRESET_DEG[2],
  ];

  applyArmJointValues(refs.targetSystem, presetJoints);
  applyHandJointValues(refs.targetSystem, gripperPercent);
  refs.armBase.updateWorldMatrix(true, true);
  refs.targetTool.updateWorldMatrix(true, true);

  const toolQuaternion = new THREE.Quaternion();
  refs.targetTool.getWorldQuaternion(toolQuaternion);
  const presetQuaternion = tcpQuaternionFromWorld(refs.armBase, toolQuaternion);

  applyArmJointValues(refs.targetSystem, currentJoints);
  applyHandJointValues(refs.targetSystem, gripperPercent);
  refs.armBase.updateWorldMatrix(true, true);
  refs.targetTool.updateWorldMatrix(true, true);

  if (quaternionArraysEqual(presetQuaternion, currentQuaternion)) {
    return;
  }

  syncingRef.current = true;
  setAnchorOrientation(refs.gizmoAnchor, refs.armBase, presetQuaternion);
  queueMicrotask(() => {
    syncingRef.current = false;
  });
  onConsumePreset?.();
  onTargetQuaternionChange(presetQuaternion);
}

function configureTargetRobot(robot: any) {
  robot.traverse((object: THREE.Object3D) => {
    if (object.name === "__target_ghost_mesh__" || object.name === "__target_outline__") {
      return;
    }

    if (object === robot) {
      return;
    }

    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !("material" in mesh) || !mesh.material) {
      return;
    }

    if (!hasManipulatorAncestor(object)) {
      object.visible = false;
      return;
    }

    if (!(mesh.geometry instanceof THREE.BufferGeometry) || !mesh.parent) {
      return;
    }

    if (mesh.userData.__targetGhostPatched) {
      return;
    }

    mesh.userData.__targetGhostPatched = true;

    mesh.visible = false;

    const ghostMesh = new THREE.Mesh(
      mesh.geometry,
      new THREE.MeshBasicMaterial({
        color: 0xb8bec8,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
        depthTest: false,
        side: THREE.FrontSide,
      }),
    );
    ghostMesh.name = "__target_ghost_mesh__";
    ghostMesh.userData.__targetGhostPatched = true;
    ghostMesh.position.copy(mesh.position);
    ghostMesh.quaternion.copy(mesh.quaternion);
    ghostMesh.scale.copy(mesh.scale);
    ghostMesh.renderOrder = 2;
    mesh.parent.add(ghostMesh);

    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry, 25),
      new THREE.LineBasicMaterial({
        color: 0xcfd5de,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        depthTest: false,
      }),
    );
    outline.name = "__target_outline__";
    outline.renderOrder = 3;
    ghostMesh.add(outline);
  });
}

function hasManipulatorAncestor(object: THREE.Object3D | null): boolean {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (current.name.startsWith("arm_") || current.name.startsWith("hand_")) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function jointArraysEqual(a: number[], b: number[]) {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((value, index) => Math.abs(value - b[index]) < 0.0001);
}

function hasTargetDelta(realJoints: number[], targetJoints: number[], realGripperPercent: number, targetGripperPercent: number) {
  return !jointArraysEqual(realJoints, targetJoints) || Math.abs(realGripperPercent - targetGripperPercent) > 0.001;
}

function createTcpAxes(offset: THREE.Vector3, opacity: number, scale: number) {
  const group = new THREE.Group();
  group.name = "tcp_axes";
  group.position.copy(offset);
  group.scale.setScalar(scale);

  group.add(createAxisLine(new THREE.Vector3(0.05, 0, 0), 0xf0645b, opacity));
  group.add(createAxisLine(new THREE.Vector3(0, 0.05, 0), 0x59a7ff, opacity));
  group.add(createAxisLine(new THREE.Vector3(0, 0, 0.05), 0x7fd55c, opacity));

  return group;
}

function createAxisLine(direction: THREE.Vector3, color: number, opacity: number) {
  const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), direction]);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthWrite: false,
  });
  return new THREE.Line(geometry, material);
}

function intersectPickerAxis(
  raycaster: THREE.Raycaster,
  root: THREE.Object3D,
  allowedAxes: string[],
): THREE.Intersection<THREE.Object3D> | null {
  const intersections = raycaster.intersectObject(root, true);
  for (const hit of intersections) {
    if (allowedAxes.includes(hit.object.name)) {
      return hit;
    }
  }
  return null;
}

function emitTcpPositions(
  refs: LoadedSceneRefs,
  onTcpPositionChange: KinematicSceneProps["onTcpPositionChange"],
) {
  if (!refs.armBase || !refs.realTool || !onTcpPositionChange) {
    return;
  }

  if (!refs.gizmoAnchor) {
    return;
  }

  refs.armBase.updateWorldMatrix(true, true);

  const real = tcpPositionInReferenceFrame(refs.armBase, refs.realTool, refs.realLeftFinger, refs.realRightFinger);
  const target = tcpPositionFromWorld(refs.armBase, refs.gizmoAnchor.position);
  onTcpPositionChange({ real, target });
}

function tcpPositionInReferenceFrame(
  reference: THREE.Object3D,
  tool: THREE.Object3D,
  leftFinger?: THREE.Object3D | null,
  rightFinger?: THREE.Object3D | null,
): [number, number, number] {
  const world = getTcpWorldPosition(tool, leftFinger, rightFinger);
  const local = reference.worldToLocal(world.clone());
  return [local.x, local.y, local.z];
}

function tcpPositionFromWorld(root: THREE.Object3D, world: THREE.Vector3): [number, number, number] {
  const local = root.worldToLocal(world.clone());
  return [local.x, local.y, local.z];
}

function applyDefaultView(camera: THREE.PerspectiveCamera, controls: OrbitControls) {
  camera.position.set(2.2, 1.45, 2.15);
  controls.target.set(0, 0.45, 0);
  camera.updateProjectionMatrix();
  controls.update();
}

function setGizmoAnchorPose(
  anchor: THREE.Object3D,
  referenceFrame: THREE.Object3D,
  targetTcp: [number, number, number],
  targetQuaternion: OrientationQuaternion,
  syncingRef: { current: boolean },
) {
  const world = referenceFrame.localToWorld(new THREE.Vector3(targetTcp[0], targetTcp[1], targetTcp[2]));
  syncingRef.current = true;
  anchor.position.copy(world);
  setAnchorOrientation(anchor, referenceFrame, targetQuaternion);
  queueMicrotask(() => {
    syncingRef.current = false;
  });
}

function createGizmoVisual() {
  const group = new THREE.Group();
  group.name = "gizmo_visual";

  const coreMaterial = new THREE.MeshStandardMaterial({
    color: 0x6bc7ff,
    emissive: new THREE.Color(0x6bc7ff).multiplyScalar(0.18),
    roughness: 0.28,
    metalness: 0.08,
    transparent: true,
    opacity: 0.95,
  });

  const shellMaterial = new THREE.MeshStandardMaterial({
    color: 0x6bc7ff,
    emissive: new THREE.Color(0x6bc7ff).multiplyScalar(0.14),
    transparent: true,
    opacity: 0.1,
    roughness: 0.42,
    metalness: 0.06,
    depthWrite: false,
  });

  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.04, 24, 24), shellMaterial);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.013, 16, 16), coreMaterial);
  const hitTarget = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 18, 18),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  core.name = "gizmo_core";
  shell.name = "gizmo_shell";
  hitTarget.name = "gizmo_hit_target";

  group.add(shell);
  group.add(core);
  group.add(hitTarget);

  return group;
}

function getTcpLocalOffset(
  tool: THREE.Object3D | null,
  leftFinger?: THREE.Object3D | null,
  rightFinger?: THREE.Object3D | null,
): THREE.Vector3 {
  if (tool?.name === "hand_gripper_link" && leftFinger && rightFinger) {
    tool.updateWorldMatrix(true, true);
    leftFinger.updateWorldMatrix(true, true);
    rightFinger.updateWorldMatrix(true, true);
    const midpointWorld = getFingerMidpointWorld(leftFinger, rightFinger);
    return tool.worldToLocal(midpointWorld).add(new THREE.Vector3(0, 0, HAND_GRASP_FORWARD_OFFSET));
  }

  if (tool?.name === "hand_gripper_link") {
    return HAND_TCP_OFFSET.clone();
  }
  return ARM_LINK6_TCP_OFFSET.clone();
}

function getTcpWorldPosition(
  tool: THREE.Object3D,
  leftFinger?: THREE.Object3D | null,
  rightFinger?: THREE.Object3D | null,
): THREE.Vector3 {
  return tool.localToWorld(getTcpLocalOffset(tool, leftFinger, rightFinger).clone());
}

function getFingerMidpointWorld(leftFinger: THREE.Object3D, rightFinger: THREE.Object3D): THREE.Vector3 {
  const left = new THREE.Vector3();
  const right = new THREE.Vector3();
  leftFinger.getWorldPosition(left);
  rightFinger.getWorldPosition(right);
  return left.add(right).multiplyScalar(0.5);
}

function configureTranslateHelper(transform: TransformControls) {
  const helper = transform.getHelper();
  helper.traverse((object) => {
    if (!object.name) {
      return;
    }

    if (object.name === "XY" || object.name === "YZ" || object.name === "XZ" || object.name === "XYZ" || object.name === "XYZE") {
      object.visible = false;
      return;
    }

    if (object.name === "E") {
      object.visible = false;
      return;
    }

    if (object.name === "RX" || object.name === "RY" || object.name === "RZ") {
      object.visible = false;
      return;
    }

    object.visible = true;
  });
}

function configureRotateHelper(transform: TransformControls) {
  const helper = transform.getHelper();
  helper.traverse((object) => {
    if (!object.name) {
      return;
    }

    if (
      object.name === "X" ||
      object.name === "Y" ||
      object.name === "Z" ||
      object.name === "E" ||
      object.name === "XYZE" ||
      object.name === "XY" ||
      object.name === "YZ" ||
      object.name === "XZ" ||
      object.name === "XYZ" ||
      object.name === "START" ||
      object.name === "END" ||
      object.name === "DELTA"
    ) {
      object.visible = false;
      return;
    }

    object.visible = true;
  });
}

function pruneTranslateHandles(root: THREE.Object3D) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    const geometryType = "geometry" in mesh && mesh.geometry ? mesh.geometry.type : null;

    if (
      object.name === "XY" ||
      object.name === "YZ" ||
      object.name === "XZ" ||
      object.name === "XYZ" ||
      object.name === "XYZE" ||
      object.name === "E" ||
      geometryType === "BoxGeometry"
    ) {
      object.visible = false;
    }
  });
}

function pruneRotateHandles(root: THREE.Object3D) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    const geometryType = "geometry" in mesh && mesh.geometry ? mesh.geometry.type : null;

    if (
      object.name === "E" ||
      object.name === "XYZE" ||
      object.name === "START" ||
      object.name === "END" ||
      object.name === "DELTA" ||
      geometryType === "SphereGeometry"
    ) {
      object.visible = false;
    }
  });
}

function patchHelperVisibility(root: THREE.Object3D, prune: (root: THREE.Object3D) => void) {
  const originalUpdateMatrixWorld = root.updateMatrixWorld.bind(root);
  root.updateMatrixWorld = (force?: boolean) => {
    originalUpdateMatrixWorld(force);
    prune(root);
  };
  prune(root);
}

function roundToMillimeters(value: number) {
  return Math.round(value * 1000) / 1000;
}

function tcpArraysEqual(a: [number, number, number], b: [number, number, number]) {
  return a.every((value, index) => Math.abs(value - b[index]) < 0.0005);
}

function quaternionArraysEqual(a: OrientationQuaternion, b: OrientationQuaternion) {
  return a.every((value, index) => Math.abs(value - b[index]) < 0.0005);
}

function setAnchorOrientation(
  anchor: THREE.Object3D,
  referenceFrame: THREE.Object3D,
  targetQuaternion: OrientationQuaternion,
) {
  const rootQuaternion = new THREE.Quaternion();
  referenceFrame.getWorldQuaternion(rootQuaternion);
  const localQuaternion = new THREE.Quaternion(
    targetQuaternion[0],
    targetQuaternion[1],
    targetQuaternion[2],
    targetQuaternion[3],
  );
  anchor.quaternion.copy(rootQuaternion.multiply(localQuaternion));
}

function tcpQuaternionFromWorld(root: THREE.Object3D, worldQuaternion: THREE.Quaternion): OrientationQuaternion {
  const rootQuaternion = new THREE.Quaternion();
  root.getWorldQuaternion(rootQuaternion);
  const localQuaternion = rootQuaternion.invert().multiply(worldQuaternion.clone());
  return [
    localQuaternion.x,
    localQuaternion.y,
    localQuaternion.z,
    localQuaternion.w,
  ];
}

function initializeGizmoFromTool(
  refs: LoadedSceneRefs,
  targetTcp: [number, number, number],
  targetQuaternion: OrientationQuaternion,
  onInitialTargetSync: KinematicSceneProps["onInitialTargetSync"],
  onTargetTcpChange: KinematicSceneProps["onTargetTcpChange"],
  onTargetQuaternionChange: KinematicSceneProps["onTargetQuaternionChange"],
  syncingRef: { current: boolean },
  initializedRef: { current: boolean },
) {
  if (initializedRef.current || !refs.armBase || !refs.targetTool || !refs.gizmoAnchor) {
    return;
  }

  refs.armBase.updateWorldMatrix(true, true);
  refs.targetTool.updateWorldMatrix(true, true);

  const toolPosition = tcpPositionInReferenceFrame(
    refs.armBase,
    refs.targetTool,
    refs.targetLeftFinger,
    refs.targetRightFinger,
  );
  const toolQuaternion = new THREE.Quaternion();
  refs.targetTool.getWorldQuaternion(toolQuaternion);
  const toolOrientation = tcpQuaternionFromWorld(refs.armBase, toolQuaternion);

  if (onInitialTargetSync) {
    onInitialTargetSync(toolPosition, toolOrientation);
  } else {
    if (!tcpArraysEqual(toolPosition, targetTcp) && onTargetTcpChange) {
      onTargetTcpChange(toolPosition);
    }

    if (!quaternionArraysEqual(toolOrientation, targetQuaternion) && onTargetQuaternionChange) {
      onTargetQuaternionChange(toolOrientation);
    }
  }

  setGizmoAnchorPose(refs.gizmoAnchor, refs.armBase, toolPosition, toolOrientation, syncingRef);
  initializedRef.current = true;
}
