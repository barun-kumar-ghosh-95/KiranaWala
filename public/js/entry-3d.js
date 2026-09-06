/**
 * KiranaWala — 3D Visual Anchor & Cinematic Motion Engine (Three.js)
 * 
 * Features:
 * - Procedural KiranaWala Kraft Paper Shopping Bag with realistic folded folds, handles & logo
 * - Modular architecture (seamlessly swappable with a future .glb model)
 * - Studio lighting setup (Key, Ambient, Warm Rim, Fill)
 * - Kinetic scroll interpolation with dampening (lerp)
 * - Mobile responsive framing and frustum scaling
 * - WebGL availability detection & prefers-reduced-motion handling
 */

(function () {
    'use strict';

    // Global namespace
    window.Kirana3D = {
        init: init,
        onScroll: onScroll,
        setReducedMotion: setReducedMotion
    };

    let scene, camera, renderer, bagGroup, logoTexture;
    let canvas, container, fallbackEl;
    let isReducedMotion = false;
    let isWebGLAvailable = true;
    let scrollProgress = 0;
    let targetScrollProgress = 0;
    let clock;

    // Cinematic Story Keyframes: [pos.x, pos.y, pos.z, rot.x, rot.y, rot.z, scale, opacity]
    const keyframes = [
        // 0.0: Hero (Floating prominently on right)
        { t: 0.00, pos: [1.8, 0.05, 0], rot: [0.08, -0.4, 0.04], scale: 1.15, opacity: 1.0 },
        // 0.25: 01 Discover Local (Glides to right-center, rotates to 3/4 front view)
        { t: 0.25, pos: [1.3, -0.15, 0], rot: [0.12, 0.35, -0.04], scale: 1.05, opacity: 1.0 },
        // 0.50: 02 Shop Local (Shifts left/center, revealing fresh goods perspective)
        { t: 0.50, pos: [-1.4, 0.1, 0.2], rot: [0.08, -0.65, 0.08], scale: 1.1, opacity: 1.0 },
        // 0.75: 03 Get It Home (Tilts dynamically forward suggesting doorstep delivery)
        { t: 0.75, pos: [1.35, -0.25, 0.4], rot: [-0.08, 0.45, -0.1], scale: 1.0, opacity: 1.0 },
        // 1.00: 04 Keep It Local / Gateways (Settles softly into resting position)
        { t: 1.00, pos: [0.0, -1.6, -0.8], rot: [0.0, 0.1, 0.0], scale: 0.7, opacity: 0.0 }
    ];

    document.addEventListener('DOMContentLoaded', () => {
        init();
    });

    function isWebGLSupported() {
        try {
            const testCanvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && (testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    }

    function init() {
        container = document.getElementById('kirana-3d-stage');
        canvas = document.getElementById('kirana-3d-canvas');
        fallbackEl = document.getElementById('kirana-3d-fallback');

        if (!container || !canvas) return;

        // Check reduced motion preference
        isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // Check WebGL availability or Three.js presence
        if (!isWebGLSupported() || typeof THREE === 'undefined') {
            isWebGLAvailable = false;
            showFallback();
            return;
        }

        try {
            clock = new THREE.Clock();
            setupScene();
            setupLighting();
            createShoppingBag();
            setupEvents();
            animate();
        } catch (err) {
            console.warn('KiranaWala 3D initialization fallback:', err);
            showFallback();
        }
    }

    function showFallback() {
        if (canvas) canvas.style.display = 'none';
        if (fallbackEl) fallbackEl.style.display = 'block';
    }

    function setupScene() {
        scene = new THREE.Scene();

        const aspect = window.innerWidth / window.innerHeight;
        camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
        camera.position.set(0, 0, 7.5);

        renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance'
        });

        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        if (renderer.outputEncoding !== undefined) {
            renderer.outputEncoding = THREE.sRGBEncoding;
        }
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        renderer.shadowMap.enabled = false; // Keep performant
    }

    function setupLighting() {
        // Soft ambient fill
        const ambientLight = new THREE.AmbientLight(0xFFF7ED, 0.85);
        scene.add(ambientLight);

        // Key Studio Light (Warm directional)
        const keyLight = new THREE.DirectionalLight(0xFFFFFF, 1.2);
        keyLight.position.set(5, 8, 5);
        scene.add(keyLight);

        // Rim Light (Warm Golden/Amber accent)
        const rimLight = new THREE.DirectionalLight(0xF59E0B, 0.7);
        rimLight.position.set(-6, -3, -4);
        scene.add(rimLight);

        // Fill Light (Soft cool contrast)
        const fillLight = new THREE.DirectionalLight(0x94A3B8, 0.4);
        fillLight.position.set(-5, 4, 3);
        scene.add(fillLight);
    }

    /**
     * Creates high-detail procedural KiranaWala Kraft Paper Shopping Bag
     * Includes kraft paper body, folded side gussets, top rim collar, braided handles, logo,
     * peeking fresh greens, grain box, and delivery tag
     */
    function createShoppingBag() {
        bagGroup = new THREE.Group();

        // Generate dynamic KiranaWala typographic insignia texture
        logoTexture = createLogoTexture();

        // 1. Kraft Paper Material with subtle grain and warmth
        const kraftColor = 0xD4A373; // Warm artisanal kraft brown
        const kraftMaterial = new THREE.MeshStandardMaterial({
            color: kraftColor,
            roughness: 0.82,
            metalness: 0.04
        });

        // 2. Front Face with KiranaWala Logo
        const frontMaterial = new THREE.MeshStandardMaterial({
            color: kraftColor,
            roughness: 0.82,
            metalness: 0.04,
            map: logoTexture
        });

        // Material Array: [Right, Left, Top, Bottom, Front, Back]
        const materials = [
            kraftMaterial, // Right
            kraftMaterial, // Left
            new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }), // Top (open)
            kraftMaterial, // Bottom
            frontMaterial, // Front (branded)
            kraftMaterial  // Back
        ];

        // Main Bag Body Geometry (Height: 2.8, Width: 2.2, Depth: 1.1)
        const bagGeo = new THREE.BoxGeometry(2.2, 2.8, 1.1, 4, 4, 4);
        const bagMesh = new THREE.Mesh(bagGeo, materials);
        bagGroup.add(bagMesh);

        // 3. Top Rim Collar (Folded Paper Edge)
        const rimGeo = new THREE.BoxGeometry(2.26, 0.18, 1.16);
        const rimMat = new THREE.MeshStandardMaterial({
            color: 0xC69262,
            roughness: 0.75
        });
        const rimMesh = new THREE.Mesh(rimGeo, rimMat);
        rimMesh.position.y = 1.35;
        bagGroup.add(rimMesh);

        // 4. Side Gusset Crease Accents (Artisanal folded bag lines)
        const creaseGeo = new THREE.PlaneGeometry(0.04, 2.5);
        const creaseMat = new THREE.MeshBasicMaterial({ color: 0xA67448 });

        const leftCrease = new THREE.Mesh(creaseGeo, creaseMat);
        leftCrease.position.set(-1.105, -0.05, 0);
        leftCrease.rotation.y = -Math.PI / 2;
        bagGroup.add(leftCrease);

        const rightCrease = new THREE.Mesh(creaseGeo, creaseMat);
        rightCrease.position.set(1.105, -0.05, 0);
        rightCrease.rotation.y = Math.PI / 2;
        bagGroup.add(rightCrease);

        // 5. Braided Kraft Cord Handles (Twin Torus Curves)
        const handleMat = new THREE.MeshStandardMaterial({
            color: 0x8B5A2B,
            roughness: 0.9,
            metalness: 0.0
        });

        // Front Handle
        const handleGeo = new THREE.TorusGeometry(0.55, 0.045, 12, 32, Math.PI);
        
        const frontHandle = new THREE.Mesh(handleGeo, handleMat);
        frontHandle.position.set(0, 1.38, 0.42);
        frontHandle.rotation.x = Math.PI; // Arch upwards
        bagGroup.add(frontHandle);

        // Back Handle
        const backHandle = new THREE.Mesh(handleGeo, handleMat);
        backHandle.position.set(0, 1.38, -0.42);
        backHandle.rotation.x = Math.PI;
        bagGroup.add(backHandle);

        // 6. Handle Anchor Washers / Eyelets
        const washerGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.04, 16);
        const washerMat = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.5 }); // Kirana green seal

        const positions = [
            [-0.55, 1.3, 0.56],
            [0.55, 1.3, 0.56],
            [-0.55, 1.3, -0.56],
            [0.55, 1.3, -0.56]
        ];

        positions.forEach(pos => {
            const washer = new THREE.Mesh(washerGeo, washerMat);
            washer.position.set(pos[0], pos[1], pos[2]);
            washer.rotation.x = Math.PI / 2;
            bagGroup.add(washer);
        });

        // 7. Subtle Grocery Items Peeking Out (Tactile charm)
        // Fresh greens / herbs bundle
        const greensGroup = new THREE.Group();
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803D, roughness: 0.6 });
        for (let i = 0; i < 4; i++) {
            const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.7, 8), leafMat);
            stalk.position.set(-0.55 + i * 0.12, 1.55 + Math.sin(i) * 0.08, 0.05 + Math.cos(i) * 0.08);
            stalk.rotation.z = -0.15 - i * 0.08;
            stalk.rotation.x = (i - 2) * 0.1;
            greensGroup.add(stalk);

            const leafHead = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), leafMat);
            leafHead.position.set(-0.62 + i * 0.12, 1.85 + Math.sin(i) * 0.08, 0.05);
            leafHead.scale.set(1.4, 0.8, 0.9);
            greensGroup.add(leafHead);
        }
        bagGroup.add(greensGroup);

        // Artisan Grain/Bread Package peeking on right
        const grainMat = new THREE.MeshStandardMaterial({ color: 0xFBBF24, roughness: 0.5 }); // Golden cereal/grain box
        const grainBox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.35), grainMat);
        grainBox.position.set(0.48, 1.5, -0.08);
        grainBox.rotation.z = 0.12;
        grainBox.rotation.y = 0.15;
        bagGroup.add(grainBox);

        // 8. Stitched Delivery / Receipt Tag on Side
        const tagMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.4 });
        const tagMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.55), tagMat);
        tagMesh.position.set(1.108, 0.5, 0.1);
        tagMesh.rotation.y = Math.PI / 2;
        bagGroup.add(tagMesh);

        // Initial keyframe placement
        bagGroup.position.set(keyframes[0].pos[0], keyframes[0].pos[1], keyframes[0].pos[2]);
        bagGroup.rotation.set(keyframes[0].rot[0], keyframes[0].rot[1], keyframes[0].rot[2]);
        bagGroup.scale.setScalar(keyframes[0].scale);

        scene.add(bagGroup);
    }

    /**
     * Creates an authentic KiranaWala brand stamp on canvas texture
     */
    function createLogoTexture() {
        const c = document.createElement('canvas');
        c.width = 512;
        c.height = 512;
        const ctx = c.getContext('2d');

        // Kraft background match
        ctx.fillStyle = '#D4A373';
        ctx.fillRect(0, 0, 512, 512);

        // Green Editorial Seal Accent
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 6;
        ctx.strokeRect(60, 110, 392, 292);

        // Tagline
        ctx.fillStyle = '#059669';
        ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('HYPERLOCAL COMMERCE', 256, 175);

        // Main Brand Title
        ctx.fillStyle = '#0A2540';
        ctx.font = '900 48px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('KIRANAWALA', 256, 250);

        // Subtitle
        ctx.fillStyle = '#8B5A2B';
        ctx.font = '600 20px "Inter", sans-serif';
        ctx.fillText('EST. YOUR NEIGHBORHOOD', 256, 305);

        // Stamp Leaf Accent
        ctx.fillStyle = '#059669';
        ctx.font = '32px sans-serif';
        ctx.fillText('🌿', 256, 360);

        const tex = new THREE.CanvasTexture(c);
        tex.needsUpdate = true;
        return tex;
    }

    /**
     * Scroll Progress Listener (0.0 to 1.0)
     */
    function onScroll(progress) {
        targetScrollProgress = Math.max(0, Math.min(1, progress));
    }

    function setReducedMotion(reduced) {
        isReducedMotion = reduced;
        if (isReducedMotion && bagGroup) {
            bagGroup.position.set(1.6, 0, 0);
            bagGroup.rotation.set(0.05, -0.3, 0);
            bagGroup.scale.setScalar(1.0);
        }
    }

    /**
     * Interpolates keyframes based on current normalized scroll (0.0 to 1.0)
     */
    function interpolateKeyframes(t) {
        if (keyframes.length === 0) return null;

        if (t <= keyframes[0].t) return keyframes[0];
        if (t >= keyframes[keyframes.length - 1].t) return keyframes[keyframes.length - 1];

        let i = 0;
        while (i < keyframes.length - 1 && keyframes[i + 1].t < t) {
            i++;
        }

        const k1 = keyframes[i];
        const k2 = keyframes[i + 1];
        const factor = (t - k1.t) / (k2.t - k1.t);
        // Smooth cubic ease
        const ease = factor * factor * (3 - 2 * factor);

        return {
            pos: [
                k1.pos[0] + (k2.pos[0] - k1.pos[0]) * ease,
                k1.pos[1] + (k2.pos[1] - k1.pos[1]) * ease,
                k1.pos[2] + (k2.pos[2] - k1.pos[2]) * ease
            ],
            rot: [
                k1.rot[0] + (k2.rot[0] - k1.rot[0]) * ease,
                k1.rot[1] + (k2.rot[1] - k1.rot[1]) * ease,
                k1.rot[2] + (k2.rot[2] - k1.rot[2]) * ease
            ],
            scale: k1.scale + (k2.scale - k1.scale) * ease,
            opacity: k1.opacity + (k2.opacity - k1.opacity) * ease
        };
    }

    function setupEvents() {
        window.addEventListener('resize', onWindowResize, { passive: true });
    }

    function onWindowResize() {
        if (!camera || !renderer) return;

        const width = window.innerWidth;
        const height = window.innerHeight;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }

    /**
     * 60fps Kinetic Render Loop
     */
    function animate() {
        requestAnimationFrame(animate);

        if (!renderer || !scene || !camera || !bagGroup) return;

        const elapsedTime = clock ? clock.getElapsedTime() : 0;

        if (isReducedMotion) {
            // Static, accessible display
            renderer.render(scene, camera);
            return;
        }

        // Kinetic Lerp for butter-smooth scroll motion
        scrollProgress += (targetScrollProgress - scrollProgress) * 0.08;

        const state = interpolateKeyframes(scrollProgress);
        if (state) {
            const isMobile = window.innerWidth < 768;
            const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;

            // Subtle floating levitation
            const floatOffset = Math.sin(elapsedTime * 1.8) * 0.06;
            const tiltOffset = Math.cos(elapsedTime * 1.4) * 0.02;

            if (isMobile) {
                // Mobile responsive placement: centered, slightly lower & scaled
                bagGroup.position.x = state.pos[0] * 0.35;
                bagGroup.position.y = state.pos[1] * 0.4 + floatOffset - 0.3;
                bagGroup.position.z = state.pos[2] - 0.8;
                bagGroup.scale.setScalar(state.scale * 0.68);
            } else if (isTablet) {
                bagGroup.position.x = state.pos[0] * 0.75;
                bagGroup.position.y = state.pos[1] + floatOffset;
                bagGroup.position.z = state.pos[2];
                bagGroup.scale.setScalar(state.scale * 0.88);
            } else {
                bagGroup.position.x = state.pos[0];
                bagGroup.position.y = state.pos[1] + floatOffset;
                bagGroup.position.z = state.pos[2];
                bagGroup.scale.setScalar(state.scale);
            }

            bagGroup.rotation.x = state.rot[0] + tiltOffset;
            bagGroup.rotation.y = state.rot[1] + (Math.sin(elapsedTime * 0.8) * 0.03);
            bagGroup.rotation.z = state.rot[2];

            // Smooth opacity fade near the bottom gateways
            if (canvas) {
                canvas.style.opacity = state.opacity.toFixed(3);
            }
        }

        renderer.render(scene, camera);
    }

})();
