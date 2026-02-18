diff --git a/game.js b/game.js
new file mode 100644
index 0000000000000000000000000000000000000000..a530013aedbbf785bbd19b1ebf95a3040d12401b
--- /dev/null
+++ b/game.js
@@ -0,0 +1,271 @@
+import * as THREE from "https://unpkg.com/three@0.162.0/build/three.module.js";
+
+const canvas = document.getElementById("gameCanvas");
+const statusEl = document.getElementById("status");
+const lockButton = document.getElementById("lockButton");
+
+const scene = new THREE.Scene();
+scene.fog = new THREE.Fog(0x0e1620, 40, 280);
+
+const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
+const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
+renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
+renderer.setSize(window.innerWidth, window.innerHeight);
+renderer.shadowMap.enabled = true;
+renderer.shadowMap.type = THREE.PCFSoftShadowMap;
+
+const hemi = new THREE.HemisphereLight(0xbddaff, 0x162130, 0.65);
+scene.add(hemi);
+const dir = new THREE.DirectionalLight(0xffffff, 1.1);
+dir.position.set(20, 30, 10);
+dir.castShadow = true;
+dir.shadow.mapSize.set(1024, 1024);
+scene.add(dir);
+
+const skyGeo = new THREE.SphereGeometry(500, 32, 24);
+const skyMat = new THREE.MeshBasicMaterial({
+  color: 0x1a2e47,
+  side: THREE.BackSide,
+});
+scene.add(new THREE.Mesh(skyGeo, skyMat));
+
+const player = {
+  radius: 0.8,
+  height: 2,
+  position: new THREE.Vector3(0, 3, 0),
+  velocity: new THREE.Vector3(),
+  yaw: 0,
+  pitch: -0.12,
+  onGround: false,
+};
+
+const playerMesh = new THREE.Mesh(
+  new THREE.CapsuleGeometry(player.radius, player.height - player.radius * 2, 4, 10),
+  new THREE.MeshStandardMaterial({ color: 0x00d4ff, metalness: 0.15, roughness: 0.35 })
+);
+playerMesh.castShadow = true;
+scene.add(playerMesh);
+
+const courseObjects = [];
+
+function addPlatform(x, y, z, w, h, d, color = 0x8bc6ff) {
+  const mesh = new THREE.Mesh(
+    new THREE.BoxGeometry(w, h, d),
+    new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.05 })
+  );
+  mesh.position.set(x, y, z);
+  mesh.castShadow = true;
+  mesh.receiveShadow = true;
+  scene.add(mesh);
+  courseObjects.push({ mesh, half: new THREE.Vector3(w / 2, h / 2, d / 2), dynamic: null });
+  return mesh;
+}
+
+function addMovingPlatform(x, y, z, w, h, d, axis = "x", amp = 6, speed = 0.8, phase = 0) {
+  const mesh = addPlatform(x, y, z, w, h, d, 0xffb86b);
+  const object = courseObjects[courseObjects.length - 1];
+  object.dynamic = { axis, base: axis === "x" ? x : z, amp, speed, phase };
+  return mesh;
+}
+
+addPlatform(0, 0, 0, 25, 2, 25, 0x6dd6ff);
+addPlatform(0, -4, -25, 180, 2, 180, 0x243545);
+
+for (let i = 1; i <= 22; i += 1) {
+  const y = i * 5;
+  const angle = i * 0.75;
+  const radius = 12 + i * 0.75;
+  const x = Math.cos(angle) * radius;
+  const z = Math.sin(angle) * radius;
+  const w = 4 + (i % 3);
+  const d = 4 + ((i + 1) % 3);
+
+  if (i % 5 === 0) {
+    addMovingPlatform(x, y, z, w, 1.2, d, i % 2 === 0 ? "x" : "z", 7, 0.9 + i * 0.03, i);
+  } else {
+    addPlatform(x, y, z, w, 1.2, d, i % 2 ? 0x8fe7ff : 0x8fffcb);
+  }
+
+  if (i % 6 === 0) {
+    addPlatform(x + 8, y + 3, z - 6, 3.2, 1, 3.2, 0xff88cf);
+  }
+}
+
+const goal = addPlatform(-18, 118, 8, 10, 1.5, 10, 0xffe066);
+const goalPole = new THREE.Mesh(
+  new THREE.CylinderGeometry(0.25, 0.25, 10),
+  new THREE.MeshStandardMaterial({ color: 0xffffff })
+);
+goalPole.position.set(goal.position.x, goal.position.y + 5.7, goal.position.z);
+scene.add(goalPole);
+
+const goalFlag = new THREE.Mesh(
+  new THREE.PlaneGeometry(4, 2.2),
+  new THREE.MeshStandardMaterial({ color: 0xff4466, side: THREE.DoubleSide })
+);
+goalFlag.position.set(goal.position.x + 2, goal.position.y + 9, goal.position.z);
+scene.add(goalFlag);
+
+const keys = new Set();
+const mouseSensitivity = 0.0023;
+let locked = false;
+
+window.addEventListener("keydown", (e) => {
+  keys.add(e.code);
+});
+window.addEventListener("keyup", (e) => {
+  keys.delete(e.code);
+});
+
+document.addEventListener("pointerlockchange", () => {
+  locked = document.pointerLockElement === canvas;
+  lockButton.style.display = locked ? "none" : "inline-block";
+});
+
+lockButton.addEventListener("click", () => {
+  canvas.requestPointerLock();
+});
+
+window.addEventListener("mousemove", (e) => {
+  if (!locked) return;
+  player.yaw -= e.movementX * mouseSensitivity;
+  player.pitch = THREE.MathUtils.clamp(player.pitch - e.movementY * mouseSensitivity, -1.2, 1.2);
+});
+
+function playerAABB() {
+  return {
+    min: new THREE.Vector3(player.position.x - player.radius, player.position.y - player.height / 2, player.position.z - player.radius),
+    max: new THREE.Vector3(player.position.x + player.radius, player.position.y + player.height / 2, player.position.z + player.radius),
+  };
+}
+
+function resolveCollisions(delta) {
+  player.onGround = false;
+  const pBox = playerAABB();
+
+  for (const obj of courseObjects) {
+    const boxMin = obj.mesh.position.clone().sub(obj.half);
+    const boxMax = obj.mesh.position.clone().add(obj.half);
+
+    const overlapX = Math.min(pBox.max.x, boxMax.x) - Math.max(pBox.min.x, boxMin.x);
+    const overlapY = Math.min(pBox.max.y, boxMax.y) - Math.max(pBox.min.y, boxMin.y);
+    const overlapZ = Math.min(pBox.max.z, boxMax.z) - Math.max(pBox.min.z, boxMin.z);
+
+    if (overlapX > 0 && overlapY > 0 && overlapZ > 0) {
+      if (overlapY <= overlapX && overlapY <= overlapZ) {
+        if (player.position.y > obj.mesh.position.y) {
+          player.position.y += overlapY;
+          player.velocity.y = Math.max(player.velocity.y, 0);
+          player.onGround = true;
+          if (obj.dynamic) {
+            const axis = obj.dynamic.axis;
+            player.position[axis] += Math.cos(clock.elapsedTime * obj.dynamic.speed + obj.dynamic.phase) * obj.dynamic.amp * delta * obj.dynamic.speed;
+          }
+        } else {
+          player.position.y -= overlapY;
+          player.velocity.y = Math.min(player.velocity.y, 0);
+        }
+      } else if (overlapX < overlapZ) {
+        player.position.x += player.position.x > obj.mesh.position.x ? overlapX : -overlapX;
+        player.velocity.x = 0;
+      } else {
+        player.position.z += player.position.z > obj.mesh.position.z ? overlapZ : -overlapZ;
+        player.velocity.z = 0;
+      }
+    }
+  }
+}
+
+function updateMovement(delta) {
+  const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
+  const right = new THREE.Vector3(forward.z, 0, -forward.x);
+
+  let moveDir = new THREE.Vector3();
+  if (keys.has("KeyW")) moveDir.add(forward);
+  if (keys.has("KeyS")) moveDir.sub(forward);
+  if (keys.has("KeyA")) moveDir.sub(right);
+  if (keys.has("KeyD")) moveDir.add(right);
+
+  if (moveDir.lengthSq() > 0) {
+    moveDir.normalize();
+  }
+
+  const sprint = keys.has("ShiftLeft") || keys.has("ShiftRight");
+  const accel = player.onGround ? 48 : 20;
+  const maxSpeed = sprint ? 15 : 10;
+
+  const targetVx = moveDir.x * maxSpeed;
+  const targetVz = moveDir.z * maxSpeed;
+
+  player.velocity.x = THREE.MathUtils.damp(player.velocity.x, targetVx, accel, delta);
+  player.velocity.z = THREE.MathUtils.damp(player.velocity.z, targetVz, accel, delta);
+
+  if (!player.onGround) {
+    player.velocity.y -= 26 * delta;
+  } else if (keys.has("Space")) {
+    player.velocity.y = 11;
+    player.onGround = false;
+  } else {
+    player.velocity.y = Math.max(player.velocity.y, -1);
+  }
+
+  player.position.addScaledVector(player.velocity, delta);
+  resolveCollisions(delta);
+
+  if (player.position.y < -30) {
+    player.position.set(0, 4, 0);
+    player.velocity.set(0, 0, 0);
+    statusEl.textContent = "落下！ スタート地点に戻りました。";
+  }
+
+  const distGoal = player.position.distanceTo(goal.position);
+  if (distGoal < 6 && player.position.y > 116) {
+    statusEl.textContent = "クリア！ すごい登頂力！";
+  } else {
+    const progress = Math.max(0, Math.min(100, Math.round((player.position.y / 118) * 100)));
+    statusEl.textContent = `高度: ${player.position.y.toFixed(1)}m / 118m (進行度 ${progress}%)`;
+  }
+}
+
+function updateDynamicPlatforms(t) {
+  for (const obj of courseObjects) {
+    if (!obj.dynamic) continue;
+    const { axis, base, amp, speed, phase } = obj.dynamic;
+    obj.mesh.position[axis] = base + Math.sin(t * speed + phase) * amp;
+  }
+}
+
+const clock = new THREE.Clock();
+
+function animate() {
+  const delta = Math.min(clock.getDelta(), 0.033);
+  const t = clock.elapsedTime;
+
+  updateDynamicPlatforms(t);
+  updateMovement(delta);
+
+  playerMesh.position.copy(player.position);
+  playerMesh.rotation.y = player.yaw;
+
+  const cameraOffset = new THREE.Vector3(0, 3.2, -8)
+    .applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw)
+    .applyAxisAngle(new THREE.Vector3(1, 0, 0), player.pitch * 0.45);
+
+  const targetCam = player.position.clone().add(cameraOffset);
+  camera.position.lerp(targetCam, 1 - Math.exp(-9 * delta));
+  const lookTarget = player.position.clone().add(new THREE.Vector3(0, 1.3, 0));
+  camera.lookAt(lookTarget);
+
+  goalFlag.rotation.y = Math.sin(t * 1.4) * 0.45;
+
+  renderer.render(scene, camera);
+  requestAnimationFrame(animate);
+}
+
+window.addEventListener("resize", () => {
+  camera.aspect = window.innerWidth / window.innerHeight;
+  camera.updateProjectionMatrix();
+  renderer.setSize(window.innerWidth, window.innerHeight);
+});
+
+animate();
