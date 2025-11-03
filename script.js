// Import Three.js modules
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Water } from 'three/addons/objects/Water.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Three.js 3D Waterfall & Pond Scene
let scene, camera, renderer, controls;
let waterfall, pond, terrain, water;
let particleSystem = [];
let waterParticles = [];
let mist = [];
let animationId;
let sun;

// Scene setup
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xff9966, 0.012); // Warm sunset fog

    // Camera setup
    camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 8, 25);
    camera.lookAt(0, 5, 0);

    // Renderer setup
    const canvas = document.getElementById('three-canvas');
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: false
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;

    // No camera controls - static view
    // controls = new OrbitControls(camera, renderer.domElement);

    // Create environment
    createLighting();
    createRealisticSky();
    createTerrain();
    // createCliffRock(); // Removed
    // createWaterfallMesh(); // Removed - just grey block
    // createWaterfall(); // Removed waterfall particles
    createRealisticWater();
    // createRocks(); // Removed - grey circles around water
    // create3DTrees(); // Removed - not working correctly
    // createParticles(); // Removed - these are the white squares floating around
    // createMist(); // Removed - white squares
    create3DText();
    createBoatBow();
    createFishingGear(); // Initialize fishing mechanics

    // Start animation
    animate();

    // Hide loading screen
    setTimeout(() => {
        const loading = document.getElementById('loading');
        loading.classList.add('hidden');
    }, 500);
}

// Lighting setup - Sunset atmosphere
function createLighting() {
    // Warm ambient light for sunset
    const ambient = new THREE.AmbientLight(0xffa366, 0.5);
    scene.add(ambient);

    // Sunset sun - lower angle, orange/red color
    const sun = new THREE.DirectionalLight(0xff7744, 1.3);
    sun.position.set(-30, 20, 40); // Lower angle for sunset
    sun.castShadow = true;
    sun.shadow.camera.left = -50;
    sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50;
    sun.shadow.camera.bottom = -50;
    sun.shadow.camera.near = 0.1;
    sun.shadow.camera.far = 200;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.bias = -0.0001;
    scene.add(sun);

    // Hemisphere light for sunset sky/ground colors
    const hemiLight = new THREE.HemisphereLight(
        0xff9955, // Golden-orange sky
        0xff6633, // Warmer orange ground
        0.5
    );
    scene.add(hemiLight);

    // Warm point light near water for sunset reflection
    const waterfallLight = new THREE.PointLight(0xffaa77, 0.8, 40);
    waterfallLight.position.set(0, 5, 0);
    scene.add(waterfallLight);

    // Additional sunset fill light
    const fillLight = new THREE.DirectionalLight(0xffaa77, 0.4);
    fillLight.position.set(40, 15, -30);
    scene.add(fillLight);
}

// Realistic Sky - No visible sun circle
function createRealisticSky() {
    const sky = new Sky();
    sky.scale.setScalar(450000);
    scene.add(sky);

    sun = new THREE.Vector3();

    const skyUniforms = sky.material.uniforms;
    skyUniforms['turbidity'].value = 6; // Less haze for clearer sunset colors
    skyUniforms['rayleigh'].value = 1.5; // Less scattering for warmer horizon
    skyUniforms['mieCoefficient'].value = 0.008;
    skyUniforms['mieDirectionalG'].value = 0.8;

    // Sunset position - at horizon for vibrant glow
    const phi = THREE.MathUtils.degToRad(90); // 90 = at horizon
    const theta = THREE.MathUtils.degToRad(180);

    sun.setFromSphericalCoords(1, phi, theta);
    skyUniforms['sunPosition'].value.copy(sun);
}

// Old skybox function - replaced with Sky
function createSkybox() {
    const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
    const skyMaterial = new THREE.ShaderMaterial({
        uniforms: {
            topColor: { value: new THREE.Color(0x87CEEB) },
            bottomColor: { value: new THREE.Color(0xe0f7ff) },
            offset: { value: 33 },
            exponent: { value: 0.6 }
        },
        vertexShader: `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform float offset;
            uniform float exponent;
            varying vec3 vWorldPosition;
            void main() {
                float h = normalize(vWorldPosition + offset).y;
                gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
            }
        `,
        side: THREE.BackSide
    });
    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    scene.add(sky);
}

// Terrain - More realistic rolling hills
function createTerrain() {
    const simplex = new SimplexNoise('ocean-breeze-149'); // Fixed seed for consistent terrain
    const geometry = new THREE.PlaneGeometry(200, 200, 256, 256); // Larger, higher detail
    const vertices = geometry.attributes.position.array;
    const colors = new Float32Array(vertices.length);

    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const y = vertices[i + 1];

        // Multiple octaves of noise for more realistic terrain
        const noise1 = simplex.noise2D(x * 0.02, y * 0.02) * 8; // Large features
        const noise2 = simplex.noise2D(x * 0.08, y * 0.08) * 2; // Medium details
        const noise3 = simplex.noise2D(x * 0.15, y * 0.15) * 0.5; // Fine details

        // Combine noises and lower below water
        const height = (noise1 + noise2 + noise3) - 5;
        vertices[i + 2] = height;

        // Color based on height - gradient from sand to grass
        let r, g, b;
        if (height < -1) {
            // Deep underwater - darker brown/green
            r = 0.2; g = 0.3; b = 0.2;
        } else if (height < 0) {
            // Shallow water/beach transition - sandy
            const t = (height + 1) / 1;
            r = 0.7 + t * 0.1;
            g = 0.6 + t * 0.2;
            b = 0.4 + t * 0.1;
        } else if (height < 1) {
            // Beach to grass transition
            const t = height / 1;
            r = 0.8 - t * 0.3;
            g = 0.7 - t * 0.1;
            b = 0.5 - t * 0.3;
        } else {
            // Higher grass/vegetation
            r = 0.3 + Math.random() * 0.1;
            g = 0.5 + Math.random() * 0.2;
            b = 0.2 + Math.random() * 0.1;
        }

        colors[i] = r;
        colors[i + 1] = g;
        colors[i + 2] = b;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    // Create material with vertex colors
    const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.95,
        metalness: 0.0,
        flatShading: false,
    });

    terrain = new THREE.Mesh(geometry, material);
    terrain.rotation.x = -Math.PI / 2;
    terrain.receiveShadow = true;
    terrain.castShadow = false;
    scene.add(terrain);

    // Store geometry for fishing height checks
    terrainGeometry = geometry;

    // Vegetation removed - didn't show up
}

// Animated grass - removed, didn't work
// function addVegetation removed - didn't show up

// Animated grass
let grassField;
function createGrass() {
    const grassCount = 15000;
    const grassGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(grassCount * 3 * 3); // 3 vertices per blade, 3 coords each
    const colors = new Float32Array(grassCount * 3 * 3);

    const simplex = new SimplexNoise();

    // Helper to get terrain height
    function getTerrainHeight(x, z) {
        const noise1 = simplex.noise2D(x * 0.02, z * 0.02) * 8;
        const noise2 = simplex.noise2D(x * 0.08, z * 0.08) * 2;
        const noise3 = simplex.noise2D(x * 0.15, z * 0.15) * 0.5;
        return (noise1 + noise2 + noise3) - 5;
    }

    let idx = 0;
    for (let i = 0; i < grassCount; i++) {
        const x = (Math.random() - 0.5) * 180;
        const z = (Math.random() - 0.5) * 180;
        const terrainHeight = getTerrainHeight(x, z);

        // Only place grass on land above water
        if (terrainHeight < 0.3) continue;

        const height = Math.random() * 0.5 + 0.3;
        const width = 0.05;

        // Random bend for natural look
        const bendX = (Math.random() - 0.5) * 0.15;
        const bendZ = (Math.random() - 0.5) * 0.15;

        // Blade of grass (triangle)
        // Bottom left
        positions[idx * 9] = x - width;
        positions[idx * 9 + 1] = terrainHeight;
        positions[idx * 9 + 2] = z;

        // Bottom right
        positions[idx * 9 + 3] = x + width;
        positions[idx * 9 + 4] = terrainHeight;
        positions[idx * 9 + 5] = z;

        // Top (with bend)
        positions[idx * 9 + 6] = x + bendX;
        positions[idx * 9 + 7] = terrainHeight + height;
        positions[idx * 9 + 8] = z + bendZ;

        // Grass color variation
        const greenShade = 0.3 + Math.random() * 0.3;
        for (let j = 0; j < 3; j++) {
            colors[idx * 9 + j * 3] = greenShade * 0.2;
            colors[idx * 9 + j * 3 + 1] = greenShade;
            colors[idx * 9 + j * 3 + 2] = greenShade * 0.15;
        }

        idx++;
    }

    // Trim arrays to actual size
    grassGeometry.setAttribute('position', new THREE.BufferAttribute(positions.slice(0, idx * 9), 3));
    grassGeometry.setAttribute('color', new THREE.BufferAttribute(colors.slice(0, idx * 9), 3));
    grassGeometry.computeVertexNormals();

    const grassMaterial = new THREE.MeshStandardMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        roughness: 1.0,
        metalness: 0.0,
    });

    grassField = new THREE.Mesh(grassGeometry, grassMaterial);
    grassField.castShadow = false;
    grassField.receiveShadow = false;
    scene.add(grassField);
}

// Cliff rock
function createCliffRock() {
    const cliffGroup = new THREE.Group();
    const cliffGeometry = new THREE.BoxGeometry(15, 20, 8);
    const cliffMaterial = new THREE.MeshStandardMaterial({
        color: 0x4a4a4a,
        roughness: 0.95,
        metalness: 0.05
    });

    const cliff = new THREE.Mesh(cliffGeometry, cliffMaterial);
    cliff.position.set(0, 10, -5);
    cliff.castShadow = true;
    cliff.receiveShadow = true;

    const vertices = cliffGeometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
        vertices[i] += (Math.random() - 0.5) * 1.5;
        vertices[i + 1] += (Math.random() - 0.5) * 1.5;
        vertices[i + 2] += (Math.random() - 0.5) * 1.5;
    }
    cliffGeometry.computeVertexNormals();

    cliffGroup.add(cliff);

    for (let i = 0; i < 8; i++) {
        const rockSize = Math.random() * 2 + 1;
        const rockGeo = new THREE.DodecahedronGeometry(rockSize, 0);
        const rock = new THREE.Mesh(rockGeo, cliffMaterial);
        rock.position.set(
            (Math.random() - 0.5) * 12,
            Math.random() * 15 + 5,
            (Math.random() - 0.5) * 6 - 5
        );
        rock.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );
        rock.castShadow = true;
        cliffGroup.add(rock);
    }

    scene.add(cliffGroup);
}

// Waterfall mesh (flowing water surface)
let waterfallMesh;
function createWaterfallMesh() {
    const waterfallGeometry = new THREE.PlaneGeometry(6, 15, 32, 64);

    // Custom flowing water shader
    const waterfallMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            waterColor: { value: new THREE.Color(0x6eb8d4) },
            foamColor: { value: new THREE.Color(0xffffff) }
        },
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vPosition;
            uniform float time;
            
            void main() {
                vUv = uv;
                vPosition = position;
                
                vec3 pos = position;
                // Create flowing water ripples
                float wave1 = sin(pos.y * 3.0 - time * 2.0) * 0.15;
                float wave2 = sin(pos.y * 5.0 - time * 3.0) * 0.1;
                pos.x += wave1 + wave2;
                
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 waterColor;
            uniform vec3 foamColor;
            uniform float time;
            varying vec2 vUv;
            varying vec3 vPosition;
            
            void main() {
                // Flowing texture effect
                float flow = fract(vUv.y * 3.0 - time * 0.5);
                
                // Add foam streaks
                float foam = step(0.85, flow);
                
                // Shimmer effect
                float shimmer = sin(vUv.x * 20.0 + time * 2.0) * 0.5 + 0.5;
                shimmer *= sin(vUv.y * 15.0 - time * 3.0) * 0.5 + 0.5;
                
                vec3 color = mix(waterColor, foamColor, foam * 0.6);
                color += shimmer * 0.2;
                
                // Add depth gradient
                float alpha = 0.6 + vUv.y * 0.3;
                
                gl_FragColor = vec4(color, alpha);
            }
        `,
        transparent: true,
        side: THREE.DoubleSide
    });

    waterfallMesh = new THREE.Mesh(waterfallGeometry, waterfallMaterial);
    waterfallMesh.position.set(0, 12.5, -4.9);
    waterfallMesh.receiveShadow = true;
    scene.add(waterfallMesh);
}

// Waterfall particles
function createWaterfall() {
    const particleCount = 3000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];

    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        positions[i3] = (Math.random() - 0.5) * 6;
        positions[i3 + 1] = Math.random() * 20 + 5;
        positions[i3 + 2] = (Math.random() - 0.5) * 2 - 4;

        velocities.push({
            x: (Math.random() - 0.5) * 0.1,
            y: -(Math.random() * 0.3 + 0.2),
            z: (Math.random() - 0.5) * 0.05
        });
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        color: 0xadd8e6,
        size: 0.2,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    waterfall = new THREE.Points(geometry, material);
    waterfall.userData.velocities = velocities;
    scene.add(waterfall);
}

// Realistic Ocean-like Water - Full width
function createRealisticWater() {
    // Make water stretch across entire view
    const waterGeometry = new THREE.PlaneGeometry(200, 200, 128, 128);

    water = new Water(
        waterGeometry,
        {
            textureWidth: 512,
            textureHeight: 512,
            waterNormals: new THREE.TextureLoader().load(
                'https://threejs.org/examples/textures/waternormals.jpg',
                function (texture) {
                    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                }
            ),
            sunDirection: new THREE.Vector3(),
            sunColor: 0xffaa66, // Bright golden-orange sunset reflection
            waterColor: 0x1a4d6b, // Lighter, warmer blue for sunset
            distortionScale: 3.7,
            fog: scene.fog !== undefined
        }
    );

    water.rotation.x = -Math.PI / 2;
    water.position.y = 0;
    scene.add(water);
}

// Old pond function - replaced with realistic water
function createPond() {
    const pondGeometry = new THREE.CircleGeometry(12, 64);

    const waterMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            waterColor: { value: new THREE.Color(0x1e6eb8) },
            foamColor: { value: new THREE.Color(0xd4f1f9) }
        },
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vPosition;
            uniform float time;
            
            void main() {
                vUv = uv;
                vPosition = position;
                vec3 pos = position;
                float wave1 = sin(pos.x * 2.0 + time) * 0.1;
                float wave2 = sin(pos.y * 3.0 + time * 1.5) * 0.1;
                pos.z = wave1 + wave2;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 waterColor;
            uniform vec3 foamColor;
            uniform float time;
            varying vec2 vUv;
            varying vec3 vPosition;
            
            void main() {
                float dist = length(vUv - 0.5);
                float ripple = sin(dist * 20.0 - time * 3.0) * 0.5 + 0.5;
                vec3 color = mix(waterColor, foamColor, ripple * 0.3);
                float alpha = 0.85 - dist * 0.2;
                gl_FragColor = vec4(color, alpha);
            }
        `,
        transparent: true,
        side: THREE.DoubleSide
    });

    pond = new THREE.Mesh(pondGeometry, waterMaterial);
    pond.rotation.x = -Math.PI / 2;
    pond.position.y = 0.1;
    pond.receiveShadow = true;
    scene.add(pond);

    // Re-add water surface shimmer particles
    createWaterSurfaceParticles();
}

// Water surface shimmer
function createWaterSurfaceParticles() {
    const particleCount = 500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 11;
        const i3 = i * 3;
        positions[i3] = Math.cos(angle) * radius;
        positions[i3 + 1] = 0.2;
        positions[i3 + 2] = Math.sin(angle) * radius;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.1,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending
    });

    const shimmer = new THREE.Points(geometry, material);
    waterParticles.push(shimmer);
    scene.add(shimmer);
}

// Rocks around pond
function createRocks() {
    const rockMaterial = new THREE.MeshStandardMaterial({
        color: 0x5a5a5a,
        roughness: 0.9,
        metalness: 0.1
    });

    for (let i = 0; i < 20; i++) {
        const size = Math.random() * 1.5 + 0.5;
        const rockGeo = new THREE.DodecahedronGeometry(size, 1);
        const rock = new THREE.Mesh(rockGeo, rockMaterial);

        const angle = (i / 20) * Math.PI * 2;
        const radius = 11 + Math.random() * 3;

        rock.position.set(
            Math.cos(angle) * radius,
            size * 0.3,
            Math.sin(angle) * radius
        );

        rock.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );

        rock.castShadow = true;
        rock.receiveShadow = true;
        scene.add(rock);
    }
}

// Trees - More realistic
function create3DTrees() {
    const trunkMaterial = new THREE.MeshStandardMaterial({
        color: 0x4a3520,
        roughness: 0.95,
        metalness: 0.0
    });
    const foliageMaterial = new THREE.MeshStandardMaterial({
        color: 0x2d5016,
        roughness: 0.9,
        metalness: 0.0,
        flatShading: true
    });

    // Helper function to get terrain height at position
    const simplex = new SimplexNoise();
    function getTerrainHeight(x, z) {
        const noise1 = simplex.noise2D(x * 0.02, z * 0.02) * 8;
        const noise2 = simplex.noise2D(x * 0.08, z * 0.08) * 2;
        const noise3 = simplex.noise2D(x * 0.15, z * 0.15) * 0.5;
        return (noise1 + noise2 + noise3) - 5;
    }

    const treePositions = [
        { x: -20, z: -15, scale: 1.2 },
        { x: -18, z: -10, scale: 1.0 },
        { x: -15, z: -18, scale: 1.4 },
        { x: 20, z: -15, scale: 1.1 },
        { x: 18, z: -10, scale: 1.3 },
        { x: 15, z: -18, scale: 0.9 },
        { x: -20, z: 15, scale: 1.0 },
        { x: -15, z: 18, scale: 1.2 },
        { x: -18, z: 20, scale: 1.1 },
        { x: 20, z: 15, scale: 1.3 },
        { x: 15, z: 18, scale: 1.0 },
        { x: 18, z: 20, scale: 1.1 },
        { x: -25, z: -8, scale: 0.8 },
        { x: 25, z: -8, scale: 1.0 },
        { x: -25, z: 8, scale: 1.1 },
        { x: 25, z: 8, scale: 0.9 },
        // Additional trees on land
        { x: -30, z: -20, scale: 1.0 },
        { x: 30, z: -20, scale: 1.1 },
        { x: -30, z: 20, scale: 0.9 },
        { x: 30, z: 20, scale: 1.2 }
    ];

    treePositions.forEach(pos => {
        // Check if terrain is above water level (water is at y=0)
        const terrainHeight = getTerrainHeight(pos.x, pos.z);

        // Only place tree if terrain is above water
        if (terrainHeight < 0.5) {
            return; // Skip this tree, it would be underwater
        }

        const tree = new THREE.Group();
        const scale = pos.scale || 1.0;

        // More realistic trunk with texture
        const trunkGeo = new THREE.CylinderGeometry(0.25 * scale, 0.35 * scale, 6 * scale, 8);
        const trunk = new THREE.Mesh(trunkGeo, trunkMaterial);
        trunk.position.y = 3 * scale;
        trunk.castShadow = true;
        trunk.receiveShadow = true;

        // Add trunk texture variation
        const vertices = trunkGeo.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            vertices[i] += (Math.random() - 0.5) * 0.05 * scale;
            vertices[i + 2] += (Math.random() - 0.5) * 0.05 * scale;
        }
        trunkGeo.computeVertexNormals();

        tree.add(trunk);

        // More realistic foliage with multiple layers and variety
        const foliageLayers = 4;
        for (let i = 0; i < foliageLayers; i++) {
            const radius = (2.5 - i * 0.4) * scale;
            const height = (2.5 - i * 0.2) * scale;
            const yPos = 5.5 + i * 1.3 * scale;

            // Use dodecahedron for more organic shape
            const foliageGeo = new THREE.DodecahedronGeometry(radius, 1);

            // Deform for natural look
            const foliageVerts = foliageGeo.attributes.position.array;
            for (let j = 0; j < foliageVerts.length; j += 3) {
                foliageVerts[j] += (Math.random() - 0.5) * 0.3 * scale;
                foliageVerts[j + 1] += (Math.random() - 0.5) * 0.2 * scale;
                foliageVerts[j + 2] += (Math.random() - 0.5) * 0.3 * scale;
            }
            foliageGeo.computeVertexNormals();

            const foliage = new THREE.Mesh(foliageGeo, foliageMaterial);
            foliage.position.y = yPos;
            foliage.castShadow = true;
            foliage.receiveShadow = true;
            tree.add(foliage);
        }

        // Add slight rotation variation
        tree.rotation.y = Math.random() * Math.PI * 2;

        // Add slight lean for realism
        tree.rotation.z = (Math.random() - 0.5) * 0.1;

        // Position tree at terrain height
        tree.position.set(pos.x, terrainHeight, pos.z);
        scene.add(tree);
    });
}

// Boat Bow - Load from GLTF model
let boatBow;
function createBoatBow() {
    const loader = new GLTFLoader();

    console.log('Loading boat model from img/scene.gltf...');

    // Load with proper path - the textures will be loaded relative to the gltf file location
    loader.load('./img/scene.gltf',
        function (gltf) {
            console.log('Boat model loaded successfully:', gltf);
            boatBow = gltf.scene;

            // The boat model is in negative Y space, so we need to offset it
            // Adjust scale based on screen size
            const isMobile = window.innerWidth < 768;
            const scale = isMobile ? 6 : 9;
            const minY = -0.47093404730292754 * scale; // Bottom of boat when scaled
            const offsetY = -minY + 0.3; // Lift just slightly above water

            boatBow.position.set(0, offsetY, 15); // Position with proper offset
            boatBow.rotation.y = Math.PI; // Rotated to face forward
            boatBow.scale.set(scale, scale, scale);

            console.log('Boat positioned at Y:', offsetY, 'Bottom should be at:', offsetY + minY);

            // Enable shadows
            boatBow.traverse(function (child) {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    console.log('Mesh found:', child.name, 'Material:', child.material);
                }
            });

            scene.add(boatBow);

            // After adding to scene, check actual position
            setTimeout(() => {
                const box = new THREE.Box3().setFromObject(boatBow);
                console.log('Actual boat position after adding to scene - min Y:', box.min.y, 'max Y:', box.max.y);
            }, 100);
        },
        function (progress) {
            if (progress.total > 0) {
                console.log('Loading progress:', Math.round(progress.loaded / progress.total * 100) + '%');
            }
        },
        function (error) {
            console.error('Error loading boat model:', error);
        }
    );
}

// 3D Text
let textMesh;
function create3DText() {
    const loader = new FontLoader();

    loader.load('https://threejs.org/examples/fonts/helvetiker_bold.typeface.json', function (font) {
        // Adjust text size based on screen size
        const isMobile = window.innerWidth < 768;
        const textSize = isMobile ? 1.25 : 2.5; // 2x smaller on mobile instead of 3x

        const textGeometry = new TextGeometry('natecarlson.org', {
            font: font,
            size: textSize,
            height: 0.5,
            curveSegments: 12,
            bevelEnabled: true,
            bevelThickness: 0.1,
            bevelSize: 0.05,
            bevelSegments: 5
        });

        textGeometry.center();

        // Create gradient-like material with sunset colors
        const textMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            metalness: 0.3,
            roughness: 0.4,
            emissive: 0xffbb77,
            emissiveIntensity: 0.5
        });

        textMesh = new THREE.Mesh(textGeometry, textMaterial);
        textMesh.position.set(0, 18, -30); // Moved further back to show water reflection
        textMesh.castShadow = true;
        textMesh.receiveShadow = true;

        scene.add(textMesh);

        // Fade in animation
        textMesh.material.transparent = true;
        textMesh.material.opacity = 0;
        gsap.to(textMesh.material, {
            opacity: 1,
            duration: 2,
            delay: 1,
            ease: 'power3.out'
        });
        gsap.from(textMesh.position, {
            y: 20,
            duration: 2,
            delay: 1,
            ease: 'power3.out'
        });
    });
}

// Atmospheric mist
function createMist() {
    const mistCount = 200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(mistCount * 3);

    for (let i = 0; i < mistCount; i++) {
        const i3 = i * 3;
        positions[i3] = (Math.random() - 0.5) * 30;
        positions[i3 + 1] = Math.random() * 15;
        positions[i3 + 2] = (Math.random() - 0.5) * 30;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 2,
        transparent: true,
        opacity: 0.2,
        blending: THREE.NormalBlending,
        depthWrite: false
    });

    const mistParticles = new THREE.Points(geometry, material);
    mist.push(mistParticles);
    scene.add(mistParticles);
}

// Floating particles (fireflies)
function createParticles() {
    const particleCount = 100;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        positions[i3] = (Math.random() - 0.5) * 50;
        positions[i3 + 1] = Math.random() * 20;
        positions[i3 + 2] = (Math.random() - 0.5) * 50;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        color: 0xffff99,
        size: 0.2,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });

    const fireflyParticles = new THREE.Points(geometry, material);
    particleSystem.push(fireflyParticles);
    scene.add(fireflyParticles);
}

// Animation loop
function animate() {
    animationId = requestAnimationFrame(animate);
    const time = performance.now() * 0.001;

    // Update realistic water
    if (water) {
        water.material.uniforms['time'].value = time;
    }

    // Animate 3D text
    if (textMesh) {
        textMesh.rotation.y = Math.sin(time * 0.3) * 0.05;
        textMesh.position.y = 18 + Math.sin(time * 0.5) * 0.3; // Updated for y: 18
    }

    // Update fishing mechanics
    updateFishing(time);

    // Gentle boat rocking - disabled while debugging position
    // if (boatBow) {
    //     boatBow.rotation.z = Math.sin(time * 0.8) * 0.02;
    //     boatBow.rotation.x = Math.sin(time * 0.6) * 0.015;
    //     boatBow.position.y = 2 + Math.sin(time * 0.7) * 0.1;
    // }

    // Update waterfall mesh shader - REMOVED
    // if (waterfallMesh) {
    //     waterfallMesh.material.uniforms.time.value = time;
    // }

    // Update waterfall particles - REMOVED
    // if (waterfall) {
    //     const positions = waterfall.geometry.attributes.position.array;
    //     const velocities = waterfall.userData.velocities;
    //     
    //     for (let i = 0; i < positions.length; i += 3) {
    //         const index = i / 3;
    //         positions[i] += velocities[index].x;
    //         positions[i + 1] += velocities[index].y;
    //         positions[i + 2] += velocities[index].z;
    //         
    //         if (positions[i + 1] < 0) {
    //             positions[i] = (Math.random() - 0.5) * 6;
    //             positions[i + 1] = 20 + Math.random() * 5;
    //             positions[i + 2] = (Math.random() - 0.5) * 2 - 4;
    //         }
    //     }
    //     waterfall.geometry.attributes.position.needsUpdate = true;
    // }

    // Update pond water shader
    // Old pond - replaced with Water object
    // if (pond) {
    //     pond.material.uniforms.time.value = time;
    // }

    // Animate water surface particles - REMOVED (white squares)
    // waterParticles.forEach(particle => {
    //     particle.rotation.y = time * 0.1;
    //     const positions = particle.geometry.attributes.position.array;
    //     for (let i = 1; i < positions.length; i += 3) {
    //         positions[i] = 0.2 + Math.sin(time * 2 + i) * 0.05;
    //     }
    //     particle.geometry.attributes.position.needsUpdate = true;
    // });

    // Animate fireflies - REMOVED (white squares floating around)
    // particleSystem.forEach(p => {
    //     const positions = p.geometry.attributes.position.array;
    //     for (let i = 0; i < positions.length; i += 3) {
    //         positions[i] += Math.sin(time + i) * 0.01;
    //         positions[i + 1] += Math.cos(time + i * 0.5) * 0.01;
    //         positions[i + 2] += Math.sin(time + i * 0.3) * 0.01;
    //     }
    //     p.geometry.attributes.position.needsUpdate = true;
    // });

    // No camera controls update needed
    // if (controls) controls.update();

    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Pause animation when tab not visible
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (animationId) cancelAnimationFrame(animationId);
    } else {
        animate();
    }
});

// ========== FISHING GAME MECHANICS ==========
let bobber = null;
let fishingLine = null;
let fishingRod3D = null; // 3D fishing rod model
let rodTipMarker = null; // Invisible marker at rod tip for line attachment
let exclamationMark = null; // Exclamation point for fish bite indicator
let fishingState = 'ready'; // ready, casting, waiting, biting, reeling
let biteTimeout = null;
let resetTimeout = null; // Track the 5-second reset timeout
let resetScheduled = false; // Track if reset timeout has been scheduled
let bobberTarget = { x: 0, y: 0, z: 0 };
let bobberStartPos = { x: 1.5, y: 6, z: 22 }; // Start from rod tip (top right)
let castProgress = 0;
let reelProgress = 0;
let caughtFish = null;
let currentCatchType = 'fish1'; // Track which fish type will be caught
let terrainGeometry = null; // Store terrain geometry for height checking
let rodDefaultRotation = { x: 0, y: 0, z: 0 }; // Store default rod rotation

// Fish collection system
let fishCollection = {
    fish1: 0,
    fish2: 0,
    fish3: 0,
    fish4: 0,
    fish5: 0,
    contact: 0
};
let newCatchText = null; // 3D text for "New Catch!"
let confettiParticles = [];
let bassModelCache = null; // Cache the bass model for UI rendering
let castCount = 0; // Track number of casts
let contactFormSubmitted = false; // Track if contact form was submitted

// Create a mini renderer for fish icons
function renderFishToCanvas(fishModel, width, height) {
    console.log('renderFishToCanvas called with:', fishModel, width, height);

    // Create offscreen renderer
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true // Important for toDataURL
    });
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0); // Transparent background

    // Create scene and camera for rendering
    const miniScene = new THREE.Scene();
    const miniCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    miniCamera.position.set(2, 1, 2); // Angle for better view
    miniCamera.lookAt(0, 0, 0);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    miniScene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(1, 2, 1);
    miniScene.add(directionalLight);
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight2.position.set(-1, -1, -1);
    miniScene.add(directionalLight2);

    // Clone the model with deep clone to preserve materials
    const fishClone = fishModel.clone(true);

    // Make sure materials are visible
    fishClone.traverse((child) => {
        if (child.isMesh) {
            if (child.material) {
                // Clone the material to avoid affecting original
                child.material = child.material.clone();
                child.material.needsUpdate = true;
            }
        }
    });

    // Rotate to match the in-game orientation (nose up)
    fishClone.rotation.x = -Math.PI / 2;
    fishClone.rotation.z = Math.PI / 4; // Slight angle for better view

    // Calculate bounding box to center and scale properly
    const box = new THREE.Box3().setFromObject(fishClone);
    const size = box.getSize(new THREE.Vector3());
    console.log('Fish size:', size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 1.5 / maxDim;
    fishClone.scale.multiplyScalar(scale);

    // Recalculate box after rotation and scale
    box.setFromObject(fishClone);
    const center = box.getCenter(new THREE.Vector3());
    fishClone.position.sub(center);

    miniScene.add(fishClone);

    // Render
    renderer.render(miniScene, miniCamera);

    console.log('Canvas created:', canvas.width, 'x', canvas.height);

    // Clean up
    renderer.dispose();

    return canvas;
}

// Create bobber and line
function createFishingGear() {
    // Load 3D fishing rod model
    const gltfLoader = new GLTFLoader();
    gltfLoader.load('img/rod/scene.gltf', (gltf) => {
        fishingRod3D = gltf.scene;

        // Position rod in world space, visible in lower right of view
        // Camera is at (0, 8, 25) looking at (0, 5, 0)
        const isMobile = window.innerWidth < 768;

        // Debug: Check the model's bounding box
        const box = new THREE.Box3().setFromObject(fishingRod3D);
        const size = box.getSize(new THREE.Vector3());
        console.log('Rod model size:', size);
        console.log('Rod model min/max:', box.min, box.max);

        if (isMobile) {
            fishingRod3D.position.set(0.5, 6, 22); // Left and down
            fishingRod3D.rotation.set(0.3, 0.1, -0.05);
            fishingRod3D.scale.set(0.08, 0.08, 0.08); // Smaller
            // Update bobber start position to rod tip (hardcoded)
            bobberStartPos.x = 3;
            bobberStartPos.y = 10;
            bobberStartPos.z = 20;
        } else {
            fishingRod3D.position.set(1, 6, 22); // Left and down
            fishingRod3D.rotation.set(0.3, 0.1, -0.05);
            fishingRod3D.scale.set(0.09, 0.09, 0.09); // Smaller
            // Update bobber start position to rod tip (hardcoded)
            bobberStartPos.x = 4;
            bobberStartPos.y = 11;
            bobberStartPos.z = 20;
        }

        // Store default rotation for animation
        rodDefaultRotation.x = fishingRod3D.rotation.x;
        rodDefaultRotation.y = fishingRod3D.rotation.y;
        rodDefaultRotation.z = fishingRod3D.rotation.z;

        // Create invisible marker at rod tip for line attachment
        // Find the actual tip by looking at the bounding box
        rodTipMarker = new THREE.Object3D();

        // The tip should be at the max Y of the bounding box in local space
        // Since we know the box min/max, use that to position the marker
        const localTipY = box.max.y; // Top of the rod
        const localTipX = (box.max.x + box.min.x) / 2; // Center X
        const localTipZ = (box.max.z + box.min.z) / 2; // Center Z

        rodTipMarker.position.set(localTipX, localTipY, localTipZ);
        fishingRod3D.add(rodTipMarker); // Attach to rod so it moves with it

        console.log('Rod tip marker position (local):', rodTipMarker.position);

        // Add to scene (not camera)
        scene.add(fishingRod3D);

        // Enable shadows
        fishingRod3D.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                console.log('Rod mesh found:', child.name, 'Material:', child.material);
            }
        });

        console.log('Fishing rod loaded at position:', fishingRod3D.position);
        console.log('Fishing rod rotation:', fishingRod3D.rotation);
        console.log('Fishing rod scale:', fishingRod3D.scale);
    }, undefined, (error) => {
        console.error('Error loading fishing rod:', error);
    });

    // Bobber (red and white float)
    const bobberGroup = new THREE.Group();

    const topHalf = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0xff3333, roughness: 0.3 })
    );
    topHalf.position.y = 0;
    bobberGroup.add(topHalf);

    const bottomHalf = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
    );
    bottomHalf.position.y = 0;
    bobberGroup.add(bottomHalf);

    bobber = bobberGroup;
    bobber.position.copy(bobberStartPos);
    bobber.visible = false;
    scene.add(bobber);

    // Fishing line
    const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x333333,
        linewidth: 2,
        transparent: true,
        opacity: 0.7
    });
    const lineGeometry = new THREE.BufferGeometry();
    const linePositions = new Float32Array([
        bobberStartPos.x, bobberStartPos.y, bobberStartPos.z,
        bobberStartPos.x, bobberStartPos.y, bobberStartPos.z
    ]);
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));

    fishingLine = new THREE.Line(lineGeometry, lineMaterial);
    fishingLine.visible = false;
    scene.add(fishingLine);

    // Create exclamation mark for bite indicator
    const exclamationGroup = new THREE.Group();

    // Exclamation line (vertical part)
    const lineShape = new THREE.Shape();
    lineShape.moveTo(-0.15, 0);
    lineShape.lineTo(0.15, 0);
    lineShape.lineTo(0.15, 1.2);
    lineShape.lineTo(-0.15, 1.2);

    const lineGeom = new THREE.ShapeGeometry(lineShape);
    const exclamationMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        side: THREE.DoubleSide
    });
    const exclamationLine = new THREE.Mesh(lineGeom, exclamationMaterial);
    exclamationGroup.add(exclamationLine);

    // Exclamation dot
    const dotGeom = new THREE.CircleGeometry(0.2, 16);
    const dot = new THREE.Mesh(dotGeom, exclamationMaterial);
    dot.position.y = -0.4;
    exclamationGroup.add(dot);

    // Position above bobber
    exclamationMark = exclamationGroup;
    exclamationMark.position.set(0, 1.5, 0);
    exclamationMark.visible = false;
    scene.add(exclamationMark);
}

// Check if position is in water (not on land)
function isInWater(x, z) {
    if (!terrainGeometry) return true;

    // Sample terrain height at position
    const simplex = new SimplexNoise('ocean-breeze-149');
    const noise1 = simplex.noise2D(x * 0.02, z * 0.02) * 8;
    const noise2 = simplex.noise2D(x * 0.08, z * 0.02) * 2;
    const noise3 = simplex.noise2D(x * 0.15, z * 0.15) * 0.5;
    const terrainHeight = (noise1 + noise2 + noise3) - 5;

    // Water is at y=0, so if terrain is below 0, it's water
    return terrainHeight < -0.5;
}

// Find random water position in front of boat
function getRandomWaterPosition() {
    let attempts = 0;
    let x, z;

    while (attempts < 50) {
        // Cast in front of boat (negative Z direction, within camera view)
        const distance = 15 + Math.random() * 30; // 15-45 units away
        const spread = 20; // Left-right spread

        x = (Math.random() - 0.5) * spread;
        z = -distance;

        if (isInWater(x, z)) {
            return { x, y: 0, z };
        }
        attempts++;
    }

    // Fallback: just return a position in front
    return { x: (Math.random() - 0.5) * 20, y: 0, z: -25 };
}

// Cast the line
function castLine() {
    if (fishingState !== 'ready') return;

    console.log('Casting line! Cast count will be:', castCount + 1);
    fishingState = 'casting';
    castProgress = 0;
    castCount++; // Increment cast counter

    // Animate 3D fishing rod
    if (fishingRod3D) {
        // Rod pulls back then forward
        const castRotation = rodDefaultRotation.x - 0.6; // Pull back more
        fishingRod3D.rotation.x = castRotation;

        setTimeout(() => {
            if (fishingRod3D) {
                fishingRod3D.rotation.x = rodDefaultRotation.x;
            }
        }, 600);
    }

    // Get random water position
    bobberTarget = getRandomWaterPosition();

    // Show bobber and line
    bobber.visible = true;
    fishingLine.visible = true;

    // Animation will happen in animate loop
}

// Create a fish from 3D model based on fish type
function createFish(fishType, callback) {
    // Special case for contact form - create a paper/form object
    if (fishType === 'contact') {
        const formGroup = new THREE.Group();

        // Create a rectangular paper/form
        const paperGeometry = new THREE.BoxGeometry(1.5, 2, 0.05);
        const paperMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.7,
            metalness: 0.1
        });
        const paper = new THREE.Mesh(paperGeometry, paperMaterial);

        // Add some lines to make it look like a form
        const lineGeometry = new THREE.BoxGeometry(1.2, 0.05, 0.06);
        const lineMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.8
        });

        for (let i = 0; i < 5; i++) {
            const line = new THREE.Mesh(lineGeometry, lineMaterial);
            line.position.y = 0.7 - (i * 0.35);
            line.position.z = 0.03;
            formGroup.add(line);
        }

        formGroup.add(paper);

        // Enable shadows
        formGroup.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        console.log('Contact form object created');
        if (callback) callback(formGroup);
        return;
    }

    // Map fish types to their model paths
    const fishModels = {
        fish1: 'img/bass/scene.gltf',
        fish2: 'img/bluegill/scene.gltf',
        fish3: 'img/boot/scene.gltf',
        fish4: 'img/nemo/scene.gltf',
        fish5: 'img/shark/scene.gltf'
    };

    const modelPath = fishModels[fishType] || 'img/bass/scene.gltf';

    const gltfLoader = new GLTFLoader();
    gltfLoader.load(modelPath, (gltf) => {
        const fishModel = gltf.scene;

        // Cache the bass model for UI rendering if not already cached
        if (fishType === 'fish1' && !bassModelCache) {
            bassModelCache = gltf.scene.clone();
        }

        // Scale and position the model appropriately
        fishModel.scale.set(0.5, 0.5, 0.5);

        // Enable shadows
        fishModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        console.log(fishType + ' loaded');
        if (callback) callback(fishModel);
    }, undefined, (error) => {
        console.error('Error loading fish model:', error);
        // Fallback to simple fish if model fails to load
        const fishGroup = new THREE.Group();
        const body = new THREE.Mesh(
            new THREE.SphereGeometry(0.4, 16, 16),
            new THREE.MeshStandardMaterial({
                color: 0x4a90e2,
                roughness: 0.4,
                metalness: 0.6
            })
        );
        body.scale.set(1.5, 1, 1);
        fishGroup.add(body);
        fishGroup.scale.set(0.8, 0.8, 0.8);
        if (callback) callback(fishGroup);
    });
}

// Start bite sequence
function startBiteSequence() {
    if (fishingState !== 'waiting') return;

    fishingState = 'biting';

    // Show exclamation mark
    if (exclamationMark && bobber) {
        exclamationMark.visible = true;
        exclamationMark.position.x = bobber.position.x;
        exclamationMark.position.y = bobber.position.y + 1.5;
        exclamationMark.position.z = bobber.position.z;
    }

    // Bobbing animation will be handled in animate loop
}

// Reel in the line
function reelIn(hasFish = true) {
    // Can reel in from waiting or biting states
    if (fishingState !== 'biting' && fishingState !== 'waiting') return;

    console.log('reelIn called! hasFish:', hasFish, 'state was:', fishingState);
    fishingState = 'reeling';
    reelProgress = 0;

    // Hide exclamation mark when reeling
    if (exclamationMark) {
        exclamationMark.visible = false;
    }

    // Clear any pending bite timeout
    if (biteTimeout) {
        clearTimeout(biteTimeout);
        biteTimeout = null;
    }

    // Animate 3D fishing rod
    if (fishingRod3D) {
        // Rod pulls back for reeling
        fishingRod3D.rotation.x = rodDefaultRotation.x - 0.3;
    }

    // Only create fish if actually biting
    if (hasFish) {
        createFish(currentCatchType, (fishModel) => {
            caughtFish = fishModel;
            // Scale and position based on fish type
            if (currentCatchType === 'contact') {
                // Contact form paper
                caughtFish.scale.set(1, 1, 1);
                caughtFish.position.set(0, -1.5, 0);
                caughtFish.rotation.x = 0;
                caughtFish.rotation.y = 0;
                caughtFish.rotation.z = 0;
            } else if (currentCatchType === 'fish4') {
                // Nemo - smaller scale
                caughtFish.scale.set(0.005, 0.005, 0.005);
                // Position below bobber
                caughtFish.position.set(0, -1.5, 0);
                // Rotate so it hangs naturally
                caughtFish.rotation.x = -Math.PI / 2; // Rotate 90 degrees so nose points up
                caughtFish.rotation.y = 0;
                caughtFish.rotation.z = 0;
            } else if (currentCatchType === 'fish3') {
                // Boot - upright position
                caughtFish.scale.set(8, 8, 8);
                // Position below bobber
                caughtFish.position.set(0, -1.5, 0);
                // Keep boot upright (sole facing down)
                caughtFish.rotation.x = 0;
                caughtFish.rotation.y = 0;
                caughtFish.rotation.z = 0;
            } else if (currentCatchType === 'fish2') {
                // Bluegill
                caughtFish.scale.set(3.1, 3.1, 3.1);
                // Position below bobber
                caughtFish.position.set(0, -1.5, 0);
                // Rotate so it hangs naturally
                caughtFish.rotation.x = -Math.PI / 2; // Rotate 90 degrees so nose points up
                caughtFish.rotation.y = 0;
                caughtFish.rotation.z = 0;
            } else if (currentCatchType === 'fish5') {
                // Shark - much smaller scale to see details
                caughtFish.scale.set(0.015, 0.015, 0.015);
                // Position below bobber
                caughtFish.position.set(0, -1.5, 0);
                // Rotate so it hangs naturally
                caughtFish.rotation.x = -Math.PI / 2; // Rotate 90 degrees so nose points up
                caughtFish.rotation.y = 0;
                caughtFish.rotation.z = 0;
            } else {
                // Default for bass and other fish - 5x bigger
                caughtFish.scale.set(10, 10, 10);
                // Position below bobber with nose facing up
                caughtFish.position.set(0, -2, 0);
                // Rotate so nose points upward (vertical, hanging from hook)
                caughtFish.rotation.x = -Math.PI / 2; // Rotate 90 degrees so nose points up
                caughtFish.rotation.y = 0;
                caughtFish.rotation.z = 0;
            }
            bobber.add(caughtFish);
        });
    }

    // Animation will happen in animate loop
}

// Click handler
function handleClick() {
    console.log('Click detected! Current state:', fishingState, 'reelProgress:', reelProgress);

    if (fishingState === 'ready') {
        castLine();
    } else if (fishingState === 'biting') {
        reelIn(true); // Caught a fish!
    } else if (fishingState === 'waiting') {
        reelIn(false); // Reeling in early, no fish
    } else if (fishingState === 'reeling' && reelProgress >= 1) {
        console.log('Dismissing spinning fish early');
        // If fish is being displayed and spinning, reset immediately on click

        // Clear the automatic reset timeout
        if (resetTimeout) {
            clearTimeout(resetTimeout);
            resetTimeout = null;
        }
        resetScheduled = false; // Reset the flag

        bobber.visible = false;
        fishingLine.visible = false;
        if (caughtFish) {
            bobber.remove(caughtFish);
            caughtFish = null;
        }
        fishingState = 'ready';
        reelProgress = 0; // Reset reel progress
        castProgress = 0; // Reset cast progress

        // Reset 3D rod rotation
        if (fishingRod3D) {
            fishingRod3D.rotation.x = rodDefaultRotation.x;
        }
        console.log('Reset complete. State:', fishingState, 'reelProgress:', reelProgress);
    }
}

// Add click listener
window.addEventListener('click', handleClick);
window.addEventListener('touchend', (e) => {
    // Prevent default to avoid double-firing with click event
    e.preventDefault();
    handleClick(e);
});

// Update fishing animation in main loop
function updateFishing(time) {
    if (!bobber || !fishingLine) return;

    // Update line positions - attach to rod tip if available
    const linePositions = fishingLine.geometry.attributes.position.array;

    if (rodTipMarker) {
        // Get world position of rod tip marker
        const tipWorldPos = new THREE.Vector3();
        rodTipMarker.getWorldPosition(tipWorldPos);
        linePositions[0] = tipWorldPos.x;
        linePositions[1] = tipWorldPos.y;
        linePositions[2] = tipWorldPos.z;
    } else {
        // Fallback to static position
        linePositions[0] = bobberStartPos.x;
        linePositions[1] = bobberStartPos.y;
        linePositions[2] = bobberStartPos.z;
    }

    linePositions[3] = bobber.position.x;
    linePositions[4] = bobber.position.y;
    linePositions[5] = bobber.position.z;
    fishingLine.geometry.attributes.position.needsUpdate = true;

    // Casting animation
    if (fishingState === 'casting') {
        castProgress += 0.02;

        if (castProgress >= 1) {
            castProgress = 1;
            fishingState = 'waiting';

            // Determine what will be caught
            if (castCount === 2 && fishCollection.contact === 0) {
                // Second cast catches contact form
                currentCatchType = 'contact';
                // Immediately trigger bite for contact form
                const biteDelay = 3000 + Math.random() * 5000; // 3-8 seconds
                biteTimeout = setTimeout(startBiteSequence, biteDelay);
            } else {
                // Random fish from the 5 available
                const fishTypes = ['fish1', 'fish2', 'fish3', 'fish4', 'fish5'];
                currentCatchType = fishTypes[Math.floor(Math.random() * fishTypes.length)];
                // FOR TESTING: Cycle through all fish in order (skip contact form in count)
                // const fishSequence = ['fish1', 'fish2', 'fish3', 'fish4', 'fish5'];
                // Count how many fish (not contact) we've caught
                // const fishCatchCount = castCount - (fishCollection.contact > 0 ? 1 : 0);
                // currentCatchType = fishSequence[(fishCatchCount - 1) % fishSequence.length];
                // Start bite timer (3-15 seconds)
                const biteDelay = 3000 + Math.random() * 12000;
                biteTimeout = setTimeout(startBiteSequence, biteDelay);
            }
        }

        // Smooth arc trajectory
        const t = castProgress;
        const easeOut = 1 - Math.pow(1 - t, 3);

        bobber.position.x = bobberStartPos.x + (bobberTarget.x - bobberStartPos.x) * easeOut;
        bobber.position.z = bobberStartPos.z + (bobberTarget.z - bobberStartPos.z) * easeOut;

        // Arc through air
        const arcHeight = 8;
        bobber.position.y = bobberStartPos.y +
            Math.sin(t * Math.PI) * arcHeight +
            (bobberTarget.y - bobberStartPos.y) * t;
    }

    // Waiting - gentle bobbing
    if (fishingState === 'waiting') {
        bobber.position.y = 0.1 + Math.sin(time * 1.5) * 0.05;
    }

    // Biting - aggressive bobbing
    if (fishingState === 'biting') {
        bobber.position.y = 0.1 + Math.sin(time * 8) * 0.3;
        bobber.rotation.z = Math.sin(time * 10) * 0.2;

        // Update exclamation mark position to follow bobber
        if (exclamationMark) {
            exclamationMark.position.x = bobber.position.x;
            exclamationMark.position.y = bobber.position.y + 1.5;
            exclamationMark.position.z = bobber.position.z;
        }
    }

    // Reeling in
    if (fishingState === 'reeling') {
        if (reelProgress === 0) {
            console.log('Starting to reel! reelProgress was 0, incrementing now');
        }
        reelProgress += 0.015;

        if (reelProgress >= 1) {
            reelProgress = 1;

            // Add catch to collection (only if we caught something)
            if (caughtFish) {
                // Only add once when first reaching the center
                if (!caughtFish.userData.addedToCollection) {
                    console.log('Catching:', currentCatchType);

                    // Check if this is the contact form catch (second cast)
                    if (currentCatchType === 'contact') {
                        addFishToCollection('contact');

                        // Immediately hide bobber and fish, show contact form
                        bobber.visible = false;
                        fishingLine.visible = false;
                        if (caughtFish) {
                            bobber.remove(caughtFish);
                            caughtFish = null;
                        }
                        fishingState = 'ready';
                        reelProgress = 0;
                        castProgress = 0;
                        resetScheduled = false;

                        // Reset rod rotation
                        if (fishingRod3D) {
                            fishingRod3D.rotation.x = rodDefaultRotation.x;
                        }

                        // Show contact form modal
                        showContactModal();
                        return; // Skip the normal delay
                    } else {
                        // Add the caught fish to collection
                        addFishToCollection(currentCatchType);
                    }
                    caughtFish.userData.addedToCollection = true;
                }
            }

            // Reset for next cast - longer delay to see fish (ONLY SCHEDULE ONCE)
            if (!resetScheduled) {
                resetScheduled = true;
                resetTimeout = setTimeout(() => {
                    bobber.visible = false;
                    fishingLine.visible = false;
                    if (caughtFish) {
                        bobber.remove(caughtFish);
                        caughtFish = null;
                    }
                    fishingState = 'ready';
                    reelProgress = 0; // Reset reel progress
                    castProgress = 0; // Reset cast progress

                    // Reset 3D rod rotation
                    if (fishingRod3D) {
                        fishingRod3D.rotation.x = rodDefaultRotation.x;
                    }
                    resetTimeout = null;
                    resetScheduled = false;
                }, 5000); // Increased to 5 seconds to admire the catch
            }
        }

        // Smooth return to center of screen (not rod tip)
        const t = reelProgress;
        const easeIn = 1 - Math.pow(1 - t, 2);

        const centerTarget = { x: 0, y: 8, z: 15 }; // Center of screen/boat area

        bobber.position.x = bobberTarget.x + (centerTarget.x - bobberTarget.x) * easeIn;
        bobber.position.z = bobberTarget.z + (centerTarget.z - bobberTarget.z) * easeIn;
        bobber.position.y = bobberTarget.y + (centerTarget.y - bobberTarget.y) * easeIn;

        // Reset bobber rotation during reel to prevent wobbling
        bobber.rotation.z = 0;

        // Spin the fish - rotate around Z axis (spinning like a clock) with head up
        if (caughtFish) {
            if (currentCatchType === 'contact') {
                // Contact form - spin like paper floating
                caughtFish.position.set(0, -1.8, 0);
                caughtFish.rotation.x = 0;
                caughtFish.rotation.y = time * 1.5; // Spin around vertical axis
                caughtFish.rotation.z = 0;
            } else if (currentCatchType === 'fish3') {
                // Boot - keep upright and spin around Y axis, positioned higher
                caughtFish.position.set(0, -2.3, 0);
                caughtFish.rotation.x = 0;
                caughtFish.rotation.y = time * 1.5; // Spin around vertical axis
                caughtFish.rotation.z = 0;
            } else if (currentCatchType === 'fish2') {
                // Bluegill - positioned higher
                caughtFish.position.set(0, -0.8, 0);
                caughtFish.rotation.x = -Math.PI / 2; // Keep head pointing up
                caughtFish.rotation.y = 0; // No Y rotation
                caughtFish.rotation.z = time * 1.5; // Z axis rotation only
            } else if (currentCatchType === 'fish5') {
                // Shark - much smaller and positioned
                caughtFish.position.set(0, -7, 0);
                caughtFish.rotation.x = -Math.PI / 2; // Keep head pointing up
                caughtFish.rotation.y = 0; // No Y rotation
                caughtFish.rotation.z = time * 1.5; // Z axis rotation only
            } else if (currentCatchType === 'fish1') {
                // Bass - positioned higher
                caughtFish.position.set(0, -1.8, 0);
                caughtFish.rotation.x = -Math.PI / 2; // Keep head pointing up
                caughtFish.rotation.y = 0; // No Y rotation
                caughtFish.rotation.z = time * 1.5; // Z axis rotation only
            } else if (currentCatchType === 'fish4') {
                // Nemo - positioned
                caughtFish.position.set(0, -1.1, 0);
                caughtFish.rotation.x = -Math.PI / 2; // Keep head pointing up
                caughtFish.rotation.y = 0; // No Y rotation
                caughtFish.rotation.z = time * 1.5; // Z axis rotation only
            } else {
                // Keep fish centered under bobber (no circular motion)
                caughtFish.position.set(0, -2.2, 0);
                // Fish - keep rotation fixed except for Z spin
                caughtFish.rotation.x = -Math.PI / 2; // Keep head pointing up
                caughtFish.rotation.y = 0; // No Y rotation
                caughtFish.rotation.z = time * 1.5; // Z axis rotation only
            }
        }
    }

    // Update confetti particles
    confettiParticles.forEach((particle, index) => {
        particle.position.y -= particle.velocity;
        particle.rotation.x += 0.1;
        particle.rotation.y += 0.1;

        if (particle.position.y < -10) {
            scene.remove(particle);
            confettiParticles.splice(index, 1);
        }
    });
}

// ========== FISH COLLECTION SYSTEM ==========

// Update fish collection UI
function updateFishCollectionUI() {
    Object.keys(fishCollection).forEach(fishType => {
        const slot = document.querySelector(`.fish-slot[data-fish="${fishType}"]`);
        if (slot) {
            const icon = slot.querySelector('.fish-icon');
            const count = slot.querySelector('.fish-count');
            const catchCount = fishCollection[fishType];

            count.textContent = `x ${catchCount}`;

            if (catchCount > 0) {
                slot.classList.add('unlocked');
                icon.classList.remove('locked');
                icon.textContent = '';
                icon.innerHTML = ''; // Clear any existing content

                if (fishType === 'contact') {
                    // Envelope icon for contact form
                    icon.innerHTML = '✉';
                    icon.style.fontSize = '2rem';
                    icon.style.color = '#64b5f6';
                    icon.style.background = 'transparent';
                } else {
                    // Use PNG image for each fish type
                    const fishImages = {
                        fish1: 'img/bass/bass.png',
                        fish2: 'img/bluegill/bluegill.png',
                        fish3: 'img/boot/boot.png',
                        fish4: 'img/nemo/nemo.png',
                        fish5: 'img/shark/shark.png'
                    };

                    icon.style.backgroundImage = `url(${fishImages[fishType]})`;
                    icon.style.backgroundSize = '100%';
                    icon.style.backgroundPosition = 'center';
                    icon.style.backgroundRepeat = 'no-repeat';
                    icon.style.borderRadius = '8px';
                }
            }
        }
    });
}

// Handle fish slot click
document.querySelectorAll('.fish-slot').forEach(slot => {
    slot.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent click from casting/reeling
        const fishType = slot.dataset.fish;
        const catchCount = fishCollection[fishType];

        if (catchCount > 0) {
            if (fishType === 'contact') {
                showContactModal();
            } else {
                showFishModal(fishType, catchCount);
            }
        }
    });
});

// Show fish modal
function showFishModal(fishType, catchCount) {
    const modal = document.getElementById('fish-modal');
    const fishName = document.getElementById('modal-fish-name');
    const fishImage = document.getElementById('modal-fish-image');
    const fishCount = document.getElementById('modal-fish-count');

    // Set content
    const fishNames = {
        fish1: 'Bass',
        fish2: 'Bluegill',
        fish3: 'Boot',
        fish4: 'Nemo',
        fish5: 'Shark'
    };

    fishName.textContent = fishNames[fishType];
    fishCount.textContent = `Caught: ${catchCount} time${catchCount !== 1 ? 's' : ''}`;

    console.log('showFishModal - fishType:', fishType, 'bassModelCache:', bassModelCache);

    // Clear any existing background and children
    fishImage.style.background = '';
    fishImage.style.backgroundImage = '';
    fishImage.innerHTML = ''; // Clear any existing content

    // Use PNG images for all fish types
    const fishImages = {
        fish1: 'img/bass/bass.png',
        fish2: 'img/bluegill/bluegill.png',
        fish3: 'img/boot/boot.png',
        fish4: 'img/nemo/nemo.png',
        fish5: 'img/shark/shark.png'
    };

    fishImage.style.backgroundImage = `url(${fishImages[fishType]})`;
    fishImage.style.backgroundSize = 'contain';
    fishImage.style.backgroundPosition = 'center';
    fishImage.style.backgroundRepeat = 'no-repeat';
    fishImage.style.borderRadius = '10px';

    modal.style.display = 'flex';
}

// Add fish to collection
function addFishToCollection(fishType) {
    const isFirstCatch = fishCollection[fishType] === 0;
    fishCollection[fishType]++;
    updateFishCollectionUI();

    if (isFirstCatch) {
        showNewCatchCelebration();
    }
}

// Create confetti effect
function createConfetti() {
    const colors = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3, 0xf38181];

    for (let i = 0; i < 50; i++) {
        const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        const material = new THREE.MeshBasicMaterial({
            color: colors[Math.floor(Math.random() * colors.length)]
        });
        const confetti = new THREE.Mesh(geometry, material);

        confetti.position.set(
            (Math.random() - 0.5) * 10,
            15 + Math.random() * 5,
            (Math.random() - 0.5) * 10
        );

        confetti.velocity = 0.05 + Math.random() * 0.05;

        scene.add(confetti);
        confettiParticles.push(confetti);
    }
}

// Show "New Catch!" text
function showNewCatchCelebration() {
    createConfetti();

    const loader = new FontLoader();
    loader.load('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/fonts/helvetiker_bold.typeface.json', (font) => {
        const textGeometry = new TextGeometry('New Catch!', {
            font: font,
            size: 0.25, // Half of 0.5
            height: 0.05,
            curveSegments: 12,
            bevelEnabled: true,
            bevelThickness: 0.01,
            bevelSize: 0.01,
            bevelSegments: 3
        });

        textGeometry.center();

        const textMaterial = new THREE.MeshStandardMaterial({
            color: 0xffff00,
            emissive: 0xffaa00,
            emissiveIntensity: 0.5
        });

        newCatchText = new THREE.Mesh(textGeometry, textMaterial);
        newCatchText.position.set(0, 9, 15); // Lower - closer to fish
        scene.add(newCatchText);

        // Remove after 5 seconds
        setTimeout(() => {
            if (newCatchText) {
                scene.remove(newCatchText);
                newCatchText = null;
            }
        }, 5000);
    });
}

// ========== CONTACT FORM MODAL ==========

// Show contact modal
function showContactModal() {
    const modal = document.getElementById('contact-modal');
    const formContainer = document.getElementById('contact-div');
    const successMessage = document.getElementById('contact-success-message');

    if (contactFormSubmitted) {
        // Show success message
        formContainer.style.display = 'none';
        successMessage.style.display = 'block';
    } else {
        // Show form
        formContainer.style.display = 'block';
        successMessage.style.display = 'none';
    }

    modal.style.display = 'flex';
}

// Initialize
window.addEventListener('load', () => {
    init();

    // Set up modal event listeners after DOM is loaded
    setupModalEventListeners();
});

// Setup all modal event listeners
function setupModalEventListeners() {
    // Fish modal
    const fishModalClose = document.querySelector('.close-modal');
    const fishModal = document.getElementById('fish-modal');
    const fishModalContent = document.querySelector('#fish-modal .modal-content');

    if (fishModalClose) {
        fishModalClose.addEventListener('click', (e) => {
            e.stopPropagation();
            fishModal.style.display = 'none';
        });
    }

    if (fishModal) {
        fishModal.addEventListener('click', (e) => {
            e.stopPropagation();
            if (e.target.id === 'fish-modal') {
                fishModal.style.display = 'none';
            }
        });
    }

    if (fishModalContent) {
        fishModalContent.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    // Contact modal
    const contactModalClose = document.querySelector('.close-contact-modal');
    const contactModal = document.getElementById('contact-modal');
    const contactModalContent = document.querySelector('#contact-modal .modal-content');

    if (contactModalClose) {
        contactModalClose.addEventListener('click', (e) => {
            e.stopPropagation();
            contactModal.style.display = 'none';
        });
    }

    if (contactModal) {
        contactModal.addEventListener('click', (e) => {
            e.stopPropagation();
            if (e.target.id === 'contact-modal') {
                contactModal.style.display = 'none';
            }
        });
    }

    if (contactModalContent) {
        contactModalContent.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    // Note: Contact form submission is now handled by EmailJS in index.html
}
