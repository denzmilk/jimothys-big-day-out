import * as THREE from 'three';
import { CAMERA } from '../core/Constants.js';

// Two modes. Follow (default) is a pull-cam: yaw derives from the camera→
// Jimothy line, so it rotates only when he displaces sideways — walking
// toward the camera backs it up instead of whipping behind his new facing
// (which would flip camera-relative controls mid-press). Orbit (pointer
// locked): mouse drives yaw/pitch. Yaw is continuous across mode switches.
export class CameraSystem {
  constructor(camera, jimothy, input) {
    this.camera = camera;
    this.jimothy = jimothy;
    this.input = input;
    this.mode = 'follow';
    this.yaw = jimothy.yaw;
    this.pitch = Math.asin(
      CAMERA.FOLLOW_HEIGHT /
        Math.hypot(CAMERA.FOLLOW_DISTANCE, CAMERA.FOLLOW_HEIGHT),
    );
    this._desired = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._computeFollowDesired();
    this.camera.position.copy(this._desired);
    this.camera.lookAt(this._lookTarget());
  }

  _computeFollowDesired() {
    const jp = this.jimothy.group.position;
    this._desired.set(
      jp.x - Math.sin(this.yaw) * CAMERA.FOLLOW_DISTANCE,
      jp.y + CAMERA.FOLLOW_HEIGHT,
      jp.z - Math.cos(this.yaw) * CAMERA.FOLLOW_DISTANCE,
    );
    return this._desired;
  }

  _computeOrbitDesired() {
    const jp = this.jimothy.group.position;
    const dist = CAMERA.FOLLOW_DISTANCE;
    const horiz = Math.cos(this.pitch) * dist;
    this._desired.set(
      jp.x - Math.sin(this.yaw) * horiz,
      jp.y + CAMERA.LOOK_HEIGHT + Math.sin(this.pitch) * dist,
      jp.z - Math.cos(this.yaw) * horiz,
    );
    return this._desired;
  }

  _lookTarget() {
    const jp = this.jimothy.group.position;
    return this._look.set(jp.x, jp.y + CAMERA.LOOK_HEIGHT, jp.z);
  }

  /** Jump the camera to where it should be, with no lerp — used after a
   *  teleport so camera-relative input is immediately meaningful. */
  snapToTarget() {
    if (this.mode === 'orbit') this._computeOrbitDesired();
    else this._computeFollowDesired();
    this.camera.position.copy(this._desired);
    this.camera.lookAt(this._lookTarget());
  }

  update(delta) {
    if (this.input.pointerLocked) {
      this.mode = 'orbit';
      const d = this.input.consumeMouseDelta();
      this.yaw -= d.x * CAMERA.MOUSE_SENS;
      this.pitch = THREE.MathUtils.clamp(
        this.pitch + d.y * CAMERA.MOUSE_SENS,
        CAMERA.PITCH_MIN,
        CAMERA.PITCH_MAX,
      );
      this._computeOrbitDesired();
    } else {
      this.mode = 'follow';
      const jp = this.jimothy.group.position;
      this.yaw = Math.atan2(jp.x - this.camera.position.x, jp.z - this.camera.position.z);
      this._computeFollowDesired();
    }
    this.camera.position.lerp(this._desired, 1 - Math.exp(-CAMERA.FOLLOW_LERP * delta));
    this.camera.lookAt(this._lookTarget());
  }
}
