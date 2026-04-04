import type { OrientationQuaternion } from "./types";

const EPSILON = 1e-8;

export function identityQuaternion(): OrientationQuaternion {
  return [0, 0, 0, 1];
}

export function normalizeQuaternion(quaternion: OrientationQuaternion): OrientationQuaternion {
  const length = Math.hypot(quaternion[0], quaternion[1], quaternion[2], quaternion[3]);
  if (length < EPSILON) {
    return identityQuaternion();
  }

  return [
    quaternion[0] / length,
    quaternion[1] / length,
    quaternion[2] / length,
    quaternion[3] / length,
  ];
}

export function multiplyQuaternions(
  left: OrientationQuaternion,
  right: OrientationQuaternion,
): OrientationQuaternion {
  const [lx, ly, lz, lw] = left;
  const [rx, ry, rz, rw] = right;

  return normalizeQuaternion([
    lw * rx + lx * rw + ly * rz - lz * ry,
    lw * ry - lx * rz + ly * rw + lz * rx,
    lw * rz + lx * ry - ly * rx + lz * rw,
    lw * rw - lx * rx - ly * ry - lz * rz,
  ]);
}

export function quaternionFromEulerDeg(
  rollDeg: number,
  pitchDeg: number,
  yawDeg: number,
): OrientationQuaternion {
  const roll = degToRad(rollDeg) * 0.5;
  const pitch = degToRad(pitchDeg) * 0.5;
  const yaw = degToRad(yawDeg) * 0.5;

  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);

  return normalizeQuaternion([
    sr * cp * cy - cr * sp * sy,
    cr * sp * cy + sr * cp * sy,
    cr * cp * sy - sr * sp * cy,
    cr * cp * cy + sr * sp * sy,
  ]);
}

export function eulerDegFromQuaternion(quaternion: OrientationQuaternion): [number, number, number] {
  const [x, y, z, w] = normalizeQuaternion(quaternion);

  const sinrCosp = 2 * (w * x + y * z);
  const cosrCosp = 1 - 2 * (x * x + y * y);
  const roll = Math.atan2(sinrCosp, cosrCosp);

  const sinp = 2 * (w * y - z * x);
  const pitch = Math.abs(sinp) >= 1 ? Math.sign(sinp) * (Math.PI / 2) : Math.asin(sinp);

  const sinyCosp = 2 * (w * z + x * y);
  const cosyCosp = 1 - 2 * (y * y + z * z);
  const yaw = Math.atan2(sinyCosp, cosyCosp);

  return [radToDeg(roll), radToDeg(pitch), radToDeg(yaw)];
}

export function quaternionFromAngularVelocityDeg(
  angularVelocityDegPerSec: [number, number, number],
  dtSec: number,
): OrientationQuaternion {
  const angleRad = Math.hypot(
    degToRad(angularVelocityDegPerSec[0]) * dtSec,
    degToRad(angularVelocityDegPerSec[1]) * dtSec,
    degToRad(angularVelocityDegPerSec[2]) * dtSec,
  );

  if (angleRad < EPSILON) {
    return identityQuaternion();
  }

  const axis: [number, number, number] = [
    (degToRad(angularVelocityDegPerSec[0]) * dtSec) / angleRad,
    (degToRad(angularVelocityDegPerSec[1]) * dtSec) / angleRad,
    (degToRad(angularVelocityDegPerSec[2]) * dtSec) / angleRad,
  ];
  const halfAngle = angleRad * 0.5;
  const sinHalf = Math.sin(halfAngle);

  return normalizeQuaternion([
    axis[0] * sinHalf,
    axis[1] * sinHalf,
    axis[2] * sinHalf,
    Math.cos(halfAngle),
  ]);
}

export function roundEulerDeg(eulerDeg: [number, number, number]): [number, number, number] {
  return [
    roundToTenth(eulerDeg[0]),
    roundToTenth(eulerDeg[1]),
    roundToTenth(eulerDeg[2]),
  ];
}

export function quaternionsEqual(
  left: OrientationQuaternion,
  right: OrientationQuaternion,
  epsilon = 1e-5,
): boolean {
  return (
    Math.abs(left[0] - right[0]) < epsilon &&
    Math.abs(left[1] - right[1]) < epsilon &&
    Math.abs(left[2] - right[2]) < epsilon &&
    Math.abs(left[3] - right[3]) < epsilon
  );
}

function degToRad(value: number): number {
  return (value * Math.PI) / 180;
}

function radToDeg(value: number): number {
  return (value * 180) / Math.PI;
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}
