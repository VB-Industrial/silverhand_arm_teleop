import { useEffect, useRef, useState } from "preact/hooks";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import URDFLoader from "urdf-loader";

const JOINT_NAMES = ["arm_joint_1", "arm_joint_2", "arm_joint_3", "arm_joint_4", "arm_joint_5", "arm_joint_6"];

type KinematicSceneProps = {
  realJoints: number[];
  targetJoints: number[];
  gripperPercent: number;
};

type LoadedSceneRefs = {
  realSystem: any | null;
  targetSystem: any | null;
  realGripper: THREE.Group | null;
  targetGripper: THREE.Group | null;
};

export function KinematicScene(props: KinematicSceneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRefs = useRef<LoadedSceneRefs>({
    realSystem: null,
    targetSystem: null,
    realGripper: null,
    targetGripper: null,
  });
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    camera.position.set(2.2, 1.45, 2.15);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 0.8;
    controls.maxDistance = 6;
    controls.target.set(0, 0.45, 0);

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

    const packageMap = {
      silverhand_rover_model: "/assets/rover_model",
      silverhand_arm_description: "/assets/arm",
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

        robotRoot.add(realSystem);
        robotRoot.add(targetSystem);

        const realGripper = createGripperIndicator(0x9ae476, 0.95);
        const targetGripper = createGripperIndicator(0x6bc7ff, 0.42);

        const realTool = realSystem.getObjectByName("arm_link_6");
        const targetTool = targetSystem.getObjectByName("arm_link_6");
        realTool?.add(realGripper);
        targetTool?.add(targetGripper);

        sceneRefs.current = {
          realSystem,
          targetSystem,
          realGripper,
          targetGripper,
        };

        applyArmJointValues(realSystem, props.realJoints);
        applyArmJointValues(targetSystem, props.targetJoints);
        setGripperIndicator(realGripper, props.gripperPercent);
        setGripperIndicator(targetGripper, props.gripperPercent);
        targetSystem.visible = !jointArraysEqual(props.realJoints, props.targetJoints);

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
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(renderLoop);
    };
    renderLoop();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
      controls.dispose();
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
    sceneRefs.current.targetSystem.visible = !jointArraysEqual(props.realJoints, props.targetJoints);
  }, [props.realJoints, props.targetJoints]);

  useEffect(() => {
    if (sceneRefs.current.realGripper) {
      setGripperIndicator(sceneRefs.current.realGripper, props.gripperPercent);
    }
    if (sceneRefs.current.targetGripper) {
      setGripperIndicator(sceneRefs.current.targetGripper, props.gripperPercent);
    }
  }, [props.gripperPercent]);

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

function configureTargetRobot(robot: any) {
  robot.traverse((object: THREE.Object3D) => {
    if (object === robot) {
      return;
    }

    const mesh = object as THREE.Mesh;
    if (!("material" in mesh) || !mesh.material) {
      return;
    }

    if (!hasArmAncestor(object)) {
      object.visible = false;
      return;
    }

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const nextMaterials = materials.map((material) => {
      const source = material as THREE.MeshStandardMaterial;
      const tinted = source.clone();
      tinted.color = new THREE.Color(0x6bc7ff);
      tinted.transparent = true;
      tinted.opacity = 0.22;
      tinted.depthWrite = false;
      tinted.emissive = new THREE.Color(0x6bc7ff).multiplyScalar(0.08);
      return tinted;
    });

    mesh.material = Array.isArray(mesh.material) ? nextMaterials : nextMaterials[0];
  });
}

function hasArmAncestor(object: THREE.Object3D | null): boolean {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (current.name.startsWith("arm_")) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function createGripperIndicator(color: number, opacity: number) {
  const group = new THREE.Group();
  group.name = "gripper_indicator";
  group.position.set(0, 0, 0.08);

  const jawGeometry = new THREE.BoxGeometry(0.01, 0.045, 0.01);
  const palmGeometry = new THREE.BoxGeometry(0.018, 0.02, 0.018);
  const material = new THREE.MeshStandardMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    roughness: 0.45,
    metalness: 0.18,
  });

  const palm = new THREE.Mesh(palmGeometry, material.clone());
  const leftJaw = new THREE.Mesh(jawGeometry, material.clone());
  const rightJaw = new THREE.Mesh(jawGeometry, material.clone());

  leftJaw.name = "left_jaw";
  rightJaw.name = "right_jaw";
  leftJaw.position.set(-0.012, 0.028, 0);
  rightJaw.position.set(0.012, 0.028, 0);
  palm.position.set(0, 0, 0);

  group.add(palm);
  group.add(leftJaw);
  group.add(rightJaw);
  return group;
}

function setGripperIndicator(group: THREE.Group, percent: number) {
  const opening = 0.012 + 0.028 * (percent / 100);
  const leftJaw = group.getObjectByName("left_jaw");
  const rightJaw = group.getObjectByName("right_jaw");

  if (leftJaw) {
    leftJaw.position.x = -opening * 0.5;
  }

  if (rightJaw) {
    rightJaw.position.x = opening * 0.5;
  }
}

function jointArraysEqual(a: number[], b: number[]) {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((value, index) => Math.abs(value - b[index]) < 0.0001);
}
