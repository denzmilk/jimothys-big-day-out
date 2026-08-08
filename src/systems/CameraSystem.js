import * as THREE from 'three';
import { CAMERA } from '../core/Constants.js';

// Two modes. Follow (default) is a pull-cam: yaw derives from the camera→
// Jimothy line, so it rotates only when he displaces sideways — walking
// toward the camera backs it up instead of whipping behind his new facing
// (which would flip camera-relative controls mid-press). Orbit (pointer
// locked): mouse drives yaw/pitch. Yaw is continuous across mode switches.
export class CameraSystem {
  constructor(camera, jimothy, input, voxels = null) {
    this.camera = camera;
    this.jimothy = jimothy;
    this.input = input;
    // Only so the boom can stop before it reaches solid (JIM-41). Read-only —
    // the camera never writes to the world.
    this.voxels = voxels;
    this.mode = 'follow';
    this.yaw = jimothy.yaw;
    // The pitch the follow camera sits at when nobody has touched the mouse.
    // It is also the ZERO of the aim (milestone 20): the shoulder view looks
    // 26.6 degrees down at him, and treating that as the aim tilted every
    // ordinary headbutt at the pavement — which is not a directional attack,
    // it is a regression. Aim is measured FROM here.
    this.neutralPitch = Math.asin(
      CAMERA.FOLLOW_HEIGHT /
        Math.hypot(CAMERA.FOLLOW_DISTANCE, CAMERA.FOLLOW_HEIGHT),
    );
    this.pitch = this.neutralPitch;
    this._desired = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._computeFollowDesired();
    this.camera.position.copy(this._desired);
    this.camera.lookAt(this._lookTarget());
  }

  /** Radians the player has deliberately tilted BELOW the resting view.
   *  Positive is down, negative is up, and neutral is exactly zero — so a
   *  headbutt with nobody aiming behaves as it always has. */
  get aimPitch() {
    return this.pitch - this.neutralPitch;
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

  /** Pull a boom endpoint in until the line from the look target to it is clear
   *  of solid world (JIM-41).
   *
   *  The camera used to have no occlusion test of any kind, which is invisible
   *  in a city of 7 m streets and catastrophic in a 3.6 x 2.9 m sewer, where a
   *  7 m boom simply cannot fit: measured with the eye inside rock and 40% of
   *  the boom buried. Back faces are culled, so the tunnel you are standing in
   *  vanishes and unrelated chunk faces are what is left over.
   *
   *  Applied to the DESIRED position and again to the camera's own position
   *  after the lerp. Clamping the target alone leaves the eye travelling
   *  through rock for as long as the lerp takes to arrive, which is exactly
   *  when it is most visible. */
  _pullIn(point) {
    if (!this.voxels) return point;
    const jp = this.jimothy.group.position;
    const ox = jp.x;
    const oy = jp.y + CAMERA.LOOK_HEIGHT;
    const oz = jp.z;
    const dx = point.x - ox;
    const dy = point.y - oy;
    const dz = point.z - oz;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) return point;
    const hit = this.voxels.raycast(ox, oy, oz, dx, dy, dz, len);
    if (!hit) return point;
    // Never past the wall, never inside him. In a pipe this bottoms out at
    // COLLIDE_MIN, which is what puts the underground camera near-first-person
    // — correct for the space, and why he fades at this range.
    const want = Math.max(hit.t - CAMERA.COLLIDE_MARGIN, CAMERA.COLLIDE_MIN);
    if (want >= len) return point;
    const k = want / len;
    return point.set(ox + dx * k, oy + dy * k, oz + dz * k);
  }

  /** How far the eye ended up from him. Drives his fade: a boom that has been
   *  cut to a metre means you are looking at the back of his skull. */
  get distance() {
    const jp = this.jimothy.group.position;
    return Math.hypot(
      this.camera.position.x - jp.x,
      this.camera.position.y - (jp.y + CAMERA.LOOK_HEIGHT),
      this.camera.position.z - jp.z,
    );
  }

  /** Jump the camera to where it should be, with no lerp — used after a
   *  teleport so camera-relative input is immediately meaningful. */
  snapToTarget() {
    if (this.mode === 'orbit') this._computeOrbitDesired();
    else this._computeFollowDesired();
    this.camera.position.copy(this._pullIn(this._desired));
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
      // Still off the camera's OWN position — the pull-cam depends on it. Safe
      // with a colliding boom because `_pullIn` scales the offset vector, which
      // shortens the boom without rotating it: the bearing it reads here is the
      // same whether or not a wall cut it short.
      this.yaw = Math.atan2(jp.x - this.camera.position.x, jp.z - this.camera.position.z);
      this._computeFollowDesired();
    }
    this._pullIn(this._desired);
    this.camera.position.lerp(this._desired, 1 - Math.exp(-CAMERA.FOLLOW_LERP * delta));
    this._pullIn(this.camera.position);
    this.camera.lookAt(this._lookTarget());
  }
}
