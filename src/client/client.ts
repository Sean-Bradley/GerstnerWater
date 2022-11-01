import * as THREE from "three";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { GUI } from "dat.gui";
import { Water } from "three/examples/jsm/objects/Water.js";
import { Sky } from "three/examples/jsm/objects/Sky";
import * as CANNON from "cannon-es";

const lightShift = new THREE.Vector3(0, 1, 0);
const v = new THREE.Vector3();
let banking = false;
let climbing = false;
let pitching = false;
let yawing = false;
let stableLift = 14.7;
let thrust = new CANNON.Vec3(0, 5, 0);
const keyMap: { [id: string]: boolean } = {};
const onDocumentKey = (e: KeyboardEvent) => {
  keyMap[e.key] = e.type === "keydown";
};
document.addEventListener("keydown", onDocumentKey, false);
document.addEventListener("keyup", onDocumentKey, false);
const waves = [
  {
    direction: 45,
    steepness: 0.1,
    wavelength: 7,
  },
  {
    direction: 306,
    steepness: 0.2,
    wavelength: 32,
  },
  {
    direction: 196,
    steepness: 0.3,
    wavelength: 59,
  },
];

function getWaveInfo(x: number, z: number, time: number) {
  const pos = new THREE.Vector3();
  const tangent = new THREE.Vector3(1, 0, 0);
  const binormal = new THREE.Vector3(0, 0, 1);
  Object.keys(waves).forEach((wave: any): void => {
    const w = waves[wave];
    const k = (Math.PI * 2) / w.wavelength;
    const c = Math.sqrt(9.8 / k);
    const d = new THREE.Vector2(
      Math.sin((w.direction * Math.PI) / 180),
      -Math.cos((w.direction * Math.PI) / 180)
    );
    const f = k * (d.dot(new THREE.Vector2(x, z)) - c * time);
    const a = w.steepness / k;
    pos.x += d.y * (a * Math.cos(f));
    pos.y += a * Math.sin(f);
    pos.z += d.x * (a * Math.cos(f));
    tangent.x += -d.x * d.x * (w.steepness * Math.sin(f));
    tangent.y += d.x * (w.steepness * Math.cos(f));
    tangent.z += -d.x * d.y * (w.steepness * Math.sin(f));
    binormal.x += -d.x * d.y * (w.steepness * Math.sin(f));
    binormal.y += d.y * (w.steepness * Math.cos(f));
    binormal.z += -d.y * d.y * (w.steepness * Math.sin(f));
  });
  const normal = binormal.cross(tangent).normalize();
  return {
    position: pos,
    normal: normal,
  };
}
function updateHelipads(delta: number) {
  const t = water.material.uniforms["time"].value;
  helipadMeshes.forEach(function (b, i) {
    const waveInfo = getWaveInfo(b.position.x, b.position.z, t);
    b.position.y = waveInfo.position.y;
    const quat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(waveInfo.normal.x, waveInfo.normal.y, waveInfo.normal.z)
    );
    b.quaternion.rotateTowards(quat, delta * 0.5);
    helipadBodies[i].quaternion.set(
      b.quaternion.x,
      b.quaternion.y,
      b.quaternion.z,
      b.quaternion.w
    );
    helipadBodies[i].position.set(b.position.x, b.position.y, b.position.z);
  });
}

const renderer = new THREE.WebGLRenderer();
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
//
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x909497);
//scene.fog = new THREE.FogExp2(0x909497, 0.005)
const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  1,
  50000
);
camera.position.set(30, 30, 100);
const chaseCam = new THREE.Object3D();
chaseCam.position.set(0, 0, 0);
const chaseCamPivot = new THREE.Object3D();
chaseCamPivot.position.set(0, 2, 4);
chaseCam.add(chaseCamPivot);
scene.add(chaseCam);
const light = new THREE.DirectionalLight();
light.castShadow = true;
light.shadow.mapSize.width = 512;
light.shadow.mapSize.height = 512;
light.shadow.camera.near = 0.001;
light.shadow.camera.far = 10;
light.shadow.camera.top = 10;
light.shadow.camera.bottom = -10;
light.shadow.camera.left = -10;
light.shadow.camera.right = 10;
scene.add(light);
scene.add(light.target);

const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);

const boxGeometry = new THREE.BoxGeometry(5, 1, 5);
const numHelipads = 10;
const helipadMeshes: THREE.Mesh[] = [];
const helipadBodies: CANNON.Body[] = [];
const material = new THREE.MeshStandardMaterial({});
for (let i = 0; i < numHelipads; i++) {
  const box = new THREE.Mesh(boxGeometry, material);
  box.position.set(Math.random() * 500 - 250, 20, Math.random() * 500 - 250);
  box.receiveShadow = true;
  scene.add(box);
  helipadMeshes.push(box);
  const shape = new CANNON.Box(new CANNON.Vec3(2.5, 0.5, 2.5));
  const body = new CANNON.Body({ mass: 0 });
  body.addShape(shape);
  body.position.x = helipadMeshes[i].position.x;
  body.position.y = helipadMeshes[i].position.y;
  body.position.z = helipadMeshes[i].position.z;
  world.addBody(body);
  helipadBodies.push(body);
}
const heliBodyGeometry = new THREE.SphereGeometry(0.66);
const heliBodyMesh = new THREE.Mesh(heliBodyGeometry, material);
heliBodyMesh.position.y = 2;
heliBodyMesh.castShadow = true;
scene.add(heliBodyMesh);
heliBodyMesh.add(chaseCam);
const heliTailGeometry = new THREE.BoxGeometry(0.1, 0.1, 2);
const heliTailMesh = new THREE.Mesh(heliTailGeometry, material);
heliTailMesh.position.z = 1;
heliTailMesh.castShadow = true;
heliBodyMesh.add(heliTailMesh);
const skidGeometry = new THREE.BoxGeometry(0.1, 0.05, 1.5);
const skidLeftMesh = new THREE.Mesh(skidGeometry, material);
const skidRightMesh = new THREE.Mesh(skidGeometry, material);
skidLeftMesh.position.set(-0.5, -0.45, 0);
skidRightMesh.position.set(0.5, -0.45, 0);
skidLeftMesh.castShadow = true;
skidRightMesh.castShadow = true;
heliBodyMesh.add(skidLeftMesh);
heliBodyMesh.add(skidRightMesh);
const heliBodyShape = new CANNON.Box(new CANNON.Vec3(0.6, 0.5, 0.6));
const heliBody = new CANNON.Body({ mass: 0.5 });
heliBody.addShape(heliBodyShape);
heliBody.position.x = heliBodyMesh.position.x;
heliBody.position.y = heliBodyMesh.position.y;
heliBody.position.z = heliBodyMesh.position.z;
heliBody.angularDamping = 0.9; //so it doesn't pendulum so much
world.addBody(heliBody);

const rotorGeometry = new THREE.BoxGeometry(0.1, 0.01, 5);
const rotorMesh = new THREE.Mesh(rotorGeometry, material);
rotorMesh.position.x = 0;
rotorMesh.position.y = 100;
rotorMesh.position.z = 0;
scene.add(rotorMesh);
const rotorShape = new CANNON.Sphere(0.1);
const rotorBody = new CANNON.Body({ mass: 1 });
rotorBody.addShape(rotorShape);
rotorBody.position.x = rotorMesh.position.x;
rotorBody.position.y = rotorMesh.position.y;
rotorBody.position.z = rotorMesh.position.z;
rotorBody.linearDamping = 0.5; //simulates auto altitude
world.addBody(rotorBody);
const rotorConstraint = new CANNON.PointToPointConstraint(
  heliBody,
  new CANNON.Vec3(0, 1, 0),
  rotorBody,
  new CANNON.Vec3()
);
rotorConstraint.collideConnected = false;
world.addConstraint(rotorConstraint);

let waterCompiled = false;

const geometry = new THREE.BufferGeometry();

const thetaSegments = 128;
const phiSegments = 1024;
const thetaStart = 0;
const thetaLength = Math.PI * 2;

const indices = [];
const vertices = [];
const normals = [];
const uvs = [];

let radius = 0;
let radiusStep = 1;
const vertex = new THREE.Vector3();
const uv = new THREE.Vector2();

for (let j = 0; j <= phiSegments; j++) {
  for (let i = 0; i <= thetaSegments; i++) {
    const segment = thetaStart + (i / thetaSegments) * thetaLength;
    vertex.x = radius * Math.cos(segment);
    vertex.y = radius * Math.sin(segment);
    vertices.push(vertex.x, vertex.y, vertex.z);
    normals.push(0, 0, 1);
    uv.x = (vertex.x + 1) / 2;
    uv.y = (vertex.y + 1) / 2;
    uvs.push(uv.x, uv.y);
  }
  radiusStep = radiusStep * 1.01;
  radius += radiusStep;
}

for (let j = 0; j < phiSegments; j++) {
  const thetaSegmentLevel = j * (thetaSegments + 1);
  for (let i = 0; i < thetaSegments; i++) {
    const segment = i + thetaSegmentLevel;
    const a = segment;
    const b = segment + thetaSegments + 1;
    const c = segment + thetaSegments + 2;
    const d = segment + 1;
    indices.push(a, b, d);
    indices.push(b, c, d);
  }
}

geometry.setIndex(indices);
geometry.setAttribute(
  "position",
  new THREE.Float32BufferAttribute(vertices, 3)
);
geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));

// geometry.computeBoundingBox();
// console.log(geometry)

// const m = new THREE.Mesh(geometry,new THREE.MeshNormalMaterial)
// m.rotation.x = -Math.PI / 2
// scene.add(m)

const water = new Water(geometry, {
  textureWidth: 512,
  textureHeight: 512,
  waterNormals: new THREE.TextureLoader().load(
    "./textures/waternormals.jpg",
    function (texture) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    }
  ),
  sunDirection: new THREE.Vector3(),
  sunColor: 0xffffff,
  waterColor: 0x001e0f,
  distortionScale: 8,
  fog: scene.fog !== undefined,
});
//water.material.wireframe = true
water.rotation.x = -Math.PI / 2;
water.material.onBeforeCompile = function (shader) {
  shader.uniforms.offsetX = { value: 0 };
  shader.uniforms.offsetZ = { value: 0 };
  shader.uniforms.waveA = {
    value: [
      Math.sin((waves[0].direction * Math.PI) / 180),
      Math.cos((waves[0].direction * Math.PI) / 180),
      waves[0].steepness,
      waves[0].wavelength,
    ],
  };
  shader.uniforms.waveB = {
    value: [
      Math.sin((waves[1].direction * Math.PI) / 180),
      Math.cos((waves[1].direction * Math.PI) / 180),
      waves[1].steepness,
      waves[1].wavelength,
    ],
  };
  shader.uniforms.waveC = {
    value: [
      Math.sin((waves[2].direction * Math.PI) / 180),
      Math.cos((waves[2].direction * Math.PI) / 180),
      waves[2].steepness,
      waves[2].wavelength,
    ],
  };
  shader.vertexShader = `
                uniform mat4 textureMatrix;
                uniform float time;

                varying vec4 mirrorCoord;
                varying vec4 worldPosition;

                #include <common>
                #include <fog_pars_vertex>
                #include <shadowmap_pars_vertex>
                #include <logdepthbuf_pars_vertex>

                uniform vec4 waveA;
                uniform vec4 waveB;
                uniform vec4 waveC;

                uniform float offsetX;
                uniform float offsetZ;

                varying vec3 lastPosition;
                varying vec3 vNormal;

                struct WaveInfo {
                  vec3 position;
                  vec3 tangent;
                  vec3 binormal;
                };

                WaveInfo GerstnerWave (vec4 wave, vec3 p, vec3 t, vec3 b) {
                    float steepness = wave.z;
                    float wavelength = wave.w;
                    float k = 2.0 * PI / wavelength;
                    float c = sqrt(9.8 / k);
                    vec2 d = normalize(wave.xy);
                    float f = k * (dot(d, vec2(p.x, p.y)) - c * time);
                    float a = steepness / k;

                    t.x += -d.x * d.x * (steepness * sin(f));
                    t.y += d.x * (steepness * cos(f));
                    t.z += -d.x * d.y * (steepness * sin(f));

                    b.x += -d.x * d.y * (steepness * sin(f));
                    b.y += d.y * (steepness * cos(f));
                    b.z += -d.y * d.y * (steepness * sin(f));

                    return WaveInfo(
                      vec3(
                        d.x * (a * cos(f)),
                        d.y * (a * cos(f)),
                        a * sin(f)
                      ),
                      t,
                      b
                    );
                }

                void main() {

                    mirrorCoord = modelMatrix * vec4( position, 1.0 );
                    worldPosition = mirrorCoord.xyzw;
                    mirrorCoord = textureMatrix * mirrorCoord;
                    vec4 mvPosition =  modelViewMatrix * vec4( position, 1.0 );
                    
                    vec3 gridPoint = position.xyz;
                    //gridPoint = normalize(gridPoint);
                    //gridPoint = gridPoint * 64.0;
                    vec3 tangent = vec3(1, 0, 0);
                    vec3 binormal = vec3(0, 0, 1);
                    vec3 p = gridPoint;
                    vec3 t = tangent;
                    vec3 b = binormal;
                    gridPoint.x += offsetX;
                    gridPoint.y -= offsetZ;
                    WaveInfo wi = GerstnerWave(waveA, gridPoint, tangent, binormal);
                    p += wi.position;
                    t += wi.tangent;
                    b += wi.binormal;
                    wi = GerstnerWave(waveB, gridPoint, tangent, binormal);
                    p += wi.position;
                    t += wi.tangent;
                    b += wi.binormal;
                    wi = GerstnerWave(waveC, gridPoint, tangent, binormal);        
                    p += wi.position;
                    t += wi.tangent;
                    b += wi.binormal;

                    vNormal = normalize(cross(t, b));

                    gl_Position = projectionMatrix * modelViewMatrix * vec4( p.x, p.y, p.z, 1.0);
                    
                    

                    #include <beginnormal_vertex>
                    #include <defaultnormal_vertex>
                    #include <logdepthbuf_vertex>
                    #include <fog_vertex>
                    #include <shadowmap_vertex>
                }`;
  // shader.fragmentShader = `
  //               uniform sampler2D mirrorSampler;
  //               uniform float alpha;
  //               uniform float time;
  //               uniform float size;
  //               uniform float distortionScale;
  //               uniform sampler2D normalSampler;
  //               uniform vec3 sunColor;
  //               uniform vec3 sunDirection;
  //               uniform vec3 eye;
  //               uniform vec3 waterColor;

  //               varying vec4 mirrorCoord;
  //               varying vec4 worldPosition;

  //               uniform float offsetX;
  //               uniform float offsetZ;

  //               varying vec3 vNormal;

  //               vec4 getNoise( vec2 uv ) {
  //                   vec2 uv0 = ( uv / 103.0 ) + vec2(time / 17.0, time / 29.0);
  //                   vec2 uv1 = uv / 107.0-vec2( time / -19.0, time / 31.0 );
  //                   vec2 uv2 = uv / vec2( 8907.0, 9803.0 ) + vec2( time / 101.0, time / 97.0 );
  //                   vec2 uv3 = uv / vec2( 1091.0, 1027.0 ) - vec2( time / 109.0, time / -113.0 );
  //                   vec4 noise = texture2D( normalSampler, uv0 ) +
  //                       texture2D( normalSampler, uv1 ) +
  //                       texture2D( normalSampler, uv2 ) +
  //                       texture2D( normalSampler, uv3 );
  //                   return noise * 0.5 - 1.0;
  //               }

  //               void sunLight( const vec3 surfaceNormal, const vec3 eyeDirection, float shiny, float spec, float diffuse, inout vec3 diffuseColor, inout vec3 specularColor ) {
  //                   vec3 reflection = normalize( reflect( -sunDirection, surfaceNormal ) );
  //                   float direction = max( 0.0, dot( eyeDirection, reflection ) );
  //                   specularColor += pow( direction, shiny ) * sunColor * spec;
  //                   diffuseColor += max( dot( sunDirection, surfaceNormal ), 0.0 ) * sunColor * diffuse;
  //               }             

  //               #include <common>
  //               #include <packing>
  //               #include <bsdfs>
  //               #include <fog_pars_fragment>
  //               #include <logdepthbuf_pars_fragment>
  //               #include <lights_pars_begin>
  //               #include <shadowmap_pars_fragment>
  //               #include <shadowmask_pars_fragment>

  //               void main() {

  //                   #include <logdepthbuf_fragment>

  //                   vec4 noise = getNoise( (worldPosition.xz) + vec2(offsetX/12.5,offsetZ/12.5) * size );
  //                   vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );

  //                   vec3 diffuseLight = vec3(0.0);
  //                   vec3 specularLight = vec3(0.0);

  //                   vec3 worldToEye = eye-worldPosition.xyz;
  //                   vec3 eyeDirection = normalize( worldToEye );
  //                   sunLight( surfaceNormal, eyeDirection, 100.0, 2.0, 0.5, diffuseLight, specularLight );

  //                   float distance = length(worldToEye);

  //                   vec2 distortion = surfaceNormal.xz * ( 0.001 + 1.0 / distance ) * distortionScale;
  //                   vec3 reflectionSample = vec3( texture2D( mirrorSampler, mirrorCoord.xy / mirrorCoord.w + distortion ) );

  //                   float theta = max( dot( eyeDirection, surfaceNormal ), 0.0 );
  //                   float rf0 = 0.3;
  //                   float reflectance = rf0 + ( 1.0 - rf0 ) * pow( ( 1.0 - theta ), 5.0 );
  //                   vec3 scatter = max( 0.0, dot( surfaceNormal, eyeDirection ) ) * waterColor;
  //                   vec3 albedo = mix( ( sunColor * diffuseLight * 0.3 + scatter ) , ( vec3( 0.1 ) + reflectionSample * 0.9 + reflectionSample * specularLight ), reflectance);
                    
  //                   float whiteWash = acos(dot( surfaceNormal, vNormal ));
  //                   //vec3 outgoingLight = mix(albedo, vec3( 1, 1, 1 ), whiteWash);
  //                   vec3 outgoingLight = albedo;
  //                   gl_FragColor = vec4( outgoingLight, alpha );

  //                   //gl_FragColor = vec4( vNormal, 1.0 );

  //                   #include <tonemapping_fragment>
  //                   #include <fog_fragment>
  //               }`;
  shader.uniforms.size.value = 10.0;
  waterCompiled = true;
};
scene.add(water);

const sun = new THREE.Vector3();
const sky = new Sky();
sky.scale.setScalar(10000);
scene.add(sky);

const skyUniforms = sky.material.uniforms;

skyUniforms["turbidity"].value = 10;
skyUniforms["rayleigh"].value = 2;
skyUniforms["mieCoefficient"].value = 0.005;
skyUniforms["mieDirectionalG"].value = 0.8;

const parameters = {
  elevation: 2,
  azimuth: 180,
};

const pmremGenerator = new THREE.PMREMGenerator(renderer);

function updateSun() {
  const phi = THREE.MathUtils.degToRad(90 - parameters.elevation);
  const theta = THREE.MathUtils.degToRad(parameters.azimuth);

  sun.setFromSphericalCoords(1, phi, theta);

  sky.material.uniforms["sunPosition"].value.copy(sun);
  water.material.uniforms["sunDirection"].value.copy(sun).normalize();

  scene.environment = pmremGenerator.fromScene(sky as any).texture;
}

updateSun();

const stats = Stats();
document.body.appendChild(stats.dom);

const gui = new GUI();
gui.close();
gui.add(water.material, "wireframe");
const waveAFolder = gui.addFolder("Wave A");
waveAFolder
  .add(waves[0], "direction", 0, 359)
  .name("Direction")
  .onChange(function (v) {
    const x = (v * Math.PI) / 180;
    water.material.uniforms.waveA.value[0] = Math.sin(x);
    water.material.uniforms.waveA.value[1] = Math.cos(x);
  });
waveAFolder
  .add(waves[0], "steepness", 0, 1, 0.1)
  .name("Steepness")
  .onChange(function (v) {
    water.material.uniforms.waveA.value[2] = v;
  });
waveAFolder
  .add(waves[0], "wavelength", 1, 100)
  .name("Wavelength")
  .onChange(function (v) {
    water.material.uniforms.waveA.value[3] = v;
  });
//waveAFolder.open()
const waveBFolder = gui.addFolder("Wave B");
waveBFolder
  .add(waves[1], "direction", 0, 359)
  .name("Direction")
  .onChange(function (v) {
    const x = (v * Math.PI) / 180;
    water.material.uniforms.waveB.value[0] = Math.sin(x);
    water.material.uniforms.waveB.value[1] = Math.cos(x);
  });
waveBFolder
  .add(waves[1], "steepness", 0, 1, 0.1)
  .name("Steepness")
  .onChange(function (v) {
    water.material.uniforms.waveB.value[2] = v;
  });
waveBFolder
  .add(waves[1], "wavelength", 1, 100)
  .name("Wavelength")
  .onChange(function (v) {
    water.material.uniforms.waveB.value[3] = v;
  });
//waveBFolder.open()
const waveCFolder = gui.addFolder("Wave C");
waveCFolder
  .add(waves[2], "direction", 0, 359)
  .name("Direction")
  .onChange(function (v) {
    const x = (v * Math.PI) / 180;
    water.material.uniforms.waveC.value[0] = Math.sin(x);
    water.material.uniforms.waveC.value[1] = Math.cos(x);
  });
waveCFolder
  .add(waves[2], "steepness", 0, 1, 0.1)
  .name("Steepness")
  .onChange(function (v) {
    water.material.uniforms.waveC.value[2] = v;
  });
waveCFolder
  .add(waves[2], "wavelength", 1, 100)
  .name("Wavelength")
  .onChange(function (v) {
    water.material.uniforms.waveC.value[3] = v;
  });
//waveCFolder.open()
//
window.addEventListener("resize", onWindowResize);
const clock = new THREE.Clock();
let delta = 0;
//cannonDebugRenderer = new CannonDebugRenderer(scene, world)

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
function animate() {
  requestAnimationFrame(animate);
  delta = Math.min(clock.getDelta(), 0.1);
  world.step(delta);
  //cannonDebugRenderer.update()

  rotorMesh.position.set(
    rotorBody.position.x,
    rotorBody.position.y,
    rotorBody.position.z
  );
  rotorMesh.rotateY(thrust.y * delta * 2);
  heliBodyMesh.position.set(
    heliBody.position.x,
    heliBody.position.y,
    heliBody.position.z
  );
  heliBodyMesh.quaternion.set(
    heliBody.quaternion.x,
    heliBody.quaternion.y,
    heliBody.quaternion.z,
    heliBody.quaternion.w
  );
  climbing = false;
  if (keyMap["w"]) {
    if (thrust.y < 40) {
      thrust.y += 5 * delta;
      climbing = true;
    }
  }
  if (keyMap["s"]) {
    if (thrust.y > 0) {
      thrust.y -= 5 * delta;
      climbing = true;
    }
  }
  yawing = false;
  if (keyMap["a"]) {
    if (rotorBody.angularVelocity.y < 2.0)
      rotorBody.angularVelocity.y += 5 * delta;
    yawing = true;
  }
  if (keyMap["d"]) {
    if (rotorBody.angularVelocity.y > -2.0)
      rotorBody.angularVelocity.y -= 5 * delta;
    yawing = true;
  }
  pitching = false;
  if (keyMap["8"]) {
    if (thrust.z >= -10.0) thrust.z -= 5 * delta;
    pitching = true;
  }
  if (keyMap["5"]) {
    if (thrust.z <= 10.0) thrust.z += 5 * delta;
    pitching = true;
  }
  banking = false;
  if (keyMap["4"]) {
    if (thrust.x >= -10.0) thrust.x -= 5 * delta;
    banking = true;
  }
  if (keyMap["6"]) {
    if (thrust.x <= 10.0) thrust.x += 5 * delta;
    banking = true;
  }
  //auto stabilise
  if (!yawing) {
    if (rotorBody.angularVelocity.y < 0)
      rotorBody.angularVelocity.y += 1 * delta;
    if (rotorBody.angularVelocity.y > 0)
      rotorBody.angularVelocity.y -= 1 * delta;
  }
  heliBody.angularVelocity.y = rotorBody.angularVelocity.y;
  if (!pitching) {
    if (thrust.z < 0) thrust.z += 2.5 * delta;
    if (thrust.z > 0) thrust.z -= 2.5 * delta;
  }
  if (!banking) {
    if (thrust.x < 0) thrust.x += 2.5 * delta;
    if (thrust.x > 0) thrust.x -= 2.5 * delta;
  }
  if (!climbing && heliBodyMesh.position.y > 4) {
    thrust.y = stableLift;
  }
  rotorBody.applyLocalForce(thrust, new CANNON.Vec3());
  camera.lookAt(heliBodyMesh.position);
  chaseCamPivot.getWorldPosition(v);
  if (v.y < 1) {
    v.y = 1;
  }
  camera.position.lerpVectors(camera.position, v, 0.05);
  water.material.uniforms["time"].value += delta;
  updateHelipads(delta);
  light.target.position.set(
    heliBodyMesh.position.x,
    heliBodyMesh.position.y,
    heliBodyMesh.position.z
  );
  light.position.copy(light.target.position).add(lightShift);
  if (waterCompiled) {
    water.position.x = heliBodyMesh.position.x;
    water.position.z = heliBodyMesh.position.z;
    water.material.uniforms["offsetX"].value = heliBodyMesh.position.x;
    water.material.uniforms["offsetZ"].value = heliBodyMesh.position.z;
  }
  render();
  stats.update();
}
function render() {
  renderer.render(scene, camera);
}

animate();
