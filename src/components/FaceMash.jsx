import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

export default function EnhancedHandGestures() {
    const webcamRef = useRef(null);
    const canvasRef = useRef(null);
    const threeContainerRef = useRef(null);
    const [status, setStatus] = useState('Loading MediaPipe...');
    const [showInstructions, setShowInstructions] = useState(true);

    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const houseModelRef = useRef(null);
    const houseMaterialRef = useRef(null);
    const rightHandActiveRef = useRef(false);
    const leftHandActiveRef = useRef(false);
    const lastColorChangeTimeRef = useRef(0);
    const currentHouseSizeRef = useRef(1.0);
    const targetHouseSizeRef = useRef(1.0);
    const rotationEnabledRef = useRef(true);
    const lastTapTimeRef = useRef(0);
    const particlesRef = useRef([]);

    const dragModeRef = useRef(false);
    const dragStartPosRef = useRef({ x: 0, y: 0 });
    const housePositionRef = useRef({ x: 0, y: 0, z: 0 });
    const housePreviousPosRef = useRef({ x: 0, y: 0, z: 0 });

    const colorChangeDelay = 500;
    const smoothingFactor = 0.15;
    const doubleTapThreshold = 300;

    const leftHandLineColor = '#FF00FF';
    const rightHandLineColor = '#00FFFF';
    const fingertipColor = '#FF0000';

    useEffect(() => {
        const updateCanvasSize = () => {
            if (canvasRef.current) {
                canvasRef.current.width = window.innerWidth;
                canvasRef.current.height = window.innerHeight;
            }
        };

        const initializeLayout = () => {
            updateCanvasSize();
        };

        const handleResize = () => {
            initializeLayout();
            if (rendererRef.current) {
                rendererRef.current.setSize(window.innerWidth, window.innerHeight);
            }
            if (cameraRef.current) {
                cameraRef.current.aspect = window.innerWidth / window.innerHeight;
                cameraRef.current.updateProjectionMatrix();
            }
        };

        window.addEventListener('resize', handleResize);

        const getRandomHouseColor = () => {
            const houseColors = [
                0x8B4513,
                0xD2691E,
                0xA52A2A,
                0xCD5C5C,
                0xBC8F8F,
                0xF4A460,
                0xDAA520,
                0xB8860B,
                0x9370DB,
                0x3CB371,
                0x4682B4,
                0x6A5ACD
            ];
            return houseColors[Math.floor(Math.random() * houseColors.length)];
        };

        const initWebcam = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                        facingMode: 'user'
                    }
                });

                if (webcamRef.current) {
                    webcamRef.current.srcObject = stream;

                    return new Promise((resolve) => {
                        webcamRef.current.onloadedmetadata = () => {
                            initializeLayout();
                            resolve(webcamRef.current);
                        };
                    });
                }
            } catch (error) {
                setStatus(`Error accessing webcam: ${error.message}`);
                console.error('Error accessing webcam:', error);
                throw error;
            }
        };

        const createHouseModel = () => {
            const house = new THREE.Group();

            // House base (cube)
            const baseGeometry = new THREE.BoxGeometry(2, 1.5, 2);
            const baseMaterial = new THREE.MeshPhongMaterial({
                color: 0xA52A2A,
                transparent: true,
                opacity: 0.8
            });
            houseMaterialRef.current = baseMaterial;

            const baseHouse = new THREE.Mesh(baseGeometry, baseMaterial);
            baseHouse.position.y = 0.75;
            house.add(baseHouse);

            const roofGeometry = new THREE.ConeGeometry(1.8, 1.2, 4);
            const roofMaterial = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
            const roof = new THREE.Mesh(roofGeometry, roofMaterial);
            roof.position.y = 1.8;
            roof.rotation.y = Math.PI / 4;
            house.add(roof);

            const doorGeometry = new THREE.PlaneGeometry(0.5, 0.8);
            const doorMaterial = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
            const door = new THREE.Mesh(doorGeometry, doorMaterial);
            door.position.set(0, 0.4, 1.01);
            house.add(door);

            const windowGeometry = new THREE.PlaneGeometry(0.4, 0.4);
            const windowMaterial = new THREE.MeshPhongMaterial({
                color: 0xADD8E6,
                transparent: true,
                opacity: 0.7
            });

            const leftWindow = new THREE.Mesh(windowGeometry, windowMaterial);
            leftWindow.position.set(-0.7, 0.7, 1.01);
            house.add(leftWindow);

            const rightWindow = new THREE.Mesh(windowGeometry, windowMaterial);
            rightWindow.position.set(0.7, 0.7, 1.01);
            house.add(rightWindow);

            const leftSideWindow = leftWindow.clone();
            leftSideWindow.position.set(-1.01, 0.7, 0);
            leftSideWindow.rotation.y = Math.PI / 2;
            house.add(leftSideWindow);

            const rightSideWindow = rightWindow.clone();
            rightSideWindow.position.set(1.01, 0.7, 0);
            rightSideWindow.rotation.y = Math.PI / 2;
            house.add(rightSideWindow);

            const chimneyGeometry = new THREE.BoxGeometry(0.3, 0.8, 0.3);
            const chimneyMaterial = new THREE.MeshPhongMaterial({ color: 0x696969 });
            const chimney = new THREE.Mesh(chimneyGeometry, chimneyMaterial);
            chimney.position.set(0.6, 2, 0.5);
            house.add(chimney);

            const edges = new THREE.EdgesGeometry(baseGeometry);
            const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
            const wireframe = new THREE.LineSegments(edges, lineMaterial);
            wireframe.position.y = 0.75;
            house.add(wireframe);

            const roofEdges = new THREE.EdgesGeometry(roofGeometry);
            const roofWireframe = new THREE.LineSegments(roofEdges, lineMaterial);
            roofWireframe.position.y = 1.8;
            roofWireframe.rotation.y = Math.PI / 4;
            house.add(roofWireframe);

            return house;
        };

        const createGroundPlane = () => {
            const texture = new THREE.TextureLoader().load(
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAABrSURBVFhH7dcxDoAgDAXQ9v83m3aW0AZE6CJE8OkkHML2kATi2V5gZOwHZmT0ACNiPxAR+w0R0f0DEdE/ERGxvxAR+xMRsf8QEfsTEbH/ERGxPxER+x8Rsf8REfsfEbH/ARH7HxGx/wAR+x8Rsf8A2L0w/gU5I+YAAAAASUVORK5CYII='
            );
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(50, 50);

            const geometry = new THREE.PlaneGeometry(100, 100);
            const material = new THREE.MeshPhongMaterial({
                map: texture,
                transparent: true,
                opacity: 0.3
            });
            const plane = new THREE.Mesh(geometry, material);
            plane.rotation.x = -Math.PI / 2;
            plane.position.y = -0.75;
            return plane;
        };

        const createParticleSystem = () => {
            const particles = new THREE.Group();
            sceneRef.current.add(particles);
            return particles;
        };

        const spawnParticles = (position, color) => {
            const particleCount = 20;
            const geometry = new THREE.SphereGeometry(0.05, 8, 8);
            const material = new THREE.MeshBasicMaterial({ color });

            for (let i = 0; i < particleCount; i++) {
                const particle = new THREE.Mesh(geometry, material);
                particle.position.copy(position);
                particle.velocity = new THREE.Vector3(
                    (Math.random() - 0.5) * 0.1,
                    (Math.random() - 0.5) * 0.1,
                    (Math.random() - 0.5) * 0.1
                );
                particle.lifetime = 1 + Math.random();
                particlesRef.current.add(particle);
            }
        };

        const updateParticles = () => {
            particlesRef.current.children.forEach(particle => {
                particle.position.add(particle.velocity);
                particle.lifetime -= 0.016; // Assuming 60fps
                particle.material.opacity = particle.lifetime;
                if (particle.lifetime <= 0) {
                    particlesRef.current.remove(particle);
                }
            });
        };

        const initThreeJS = () => {
            const scene = new THREE.Scene();
            sceneRef.current = scene;

            const camera = new THREE.PerspectiveCamera(
                75,
                window.innerWidth / window.innerHeight,
                0.1,
                1000
            );
            camera.position.z = 5;
            cameraRef.current = camera;

            const renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true
            });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setClearColor(0x000000, 0);

            if (threeContainerRef.current) {
                while (threeContainerRef.current.firstChild) {
                    threeContainerRef.current.removeChild(threeContainerRef.current.firstChild);
                }
                threeContainerRef.current.appendChild(renderer.domElement);
            }

            rendererRef.current = renderer;

            const house = createHouseModel();
            houseModelRef.current = house;
            scene.add(house);

            const ground = createGroundPlane();
            scene.add(ground);

            particlesRef.current = createParticleSystem();

            housePositionRef.current = {
                x: house.position.x,
                y: house.position.y,
                z: house.position.z
            };
            housePreviousPosRef.current = { ...housePositionRef.current };

            const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
            scene.add(ambientLight);

            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(5, 10, 7);
            scene.add(directionalLight);
        };

        const animate = () => {
            requestAnimationFrame(animate);

            if (houseModelRef.current && !dragModeRef.current && rotationEnabledRef.current) {
                houseModelRef.current.rotation.y += 0.005;

                const time = Date.now() * 0.001;
                const breatheFactor = 0.05 * Math.sin(time) + 1;
                houseModelRef.current.scale.y = currentHouseSizeRef.current * breatheFactor;
            }

            updateParticles();

            if (rendererRef.current && sceneRef.current && cameraRef.current) {
                rendererRef.current.render(sceneRef.current, cameraRef.current);
            }
        };

        const calculateDistance = (point1, point2) => {
            const dx = point1.x - point2.x;
            const dy = point1.y - point2.y;
            const dz = point1.z - point2.z;
            return Math.sqrt(dx * dx + dy * dy + dz * dz);
        };

        const isPointNearHouse = (point) => {
            if (!houseModelRef.current) return false;

            const worldX = (point.x - 0.5) * 10;
            const worldY = (0.5 - point.y) * 10;
            const worldZ = 0;

            const housePos = new THREE.Vector3();
            houseModelRef.current.getWorldPosition(housePos);

            const distance = Math.sqrt(
                Math.pow(worldX - housePos.x, 2) +
                Math.pow(worldY - housePos.y, 2) +
                Math.pow(worldZ - housePos.z, 2)
            );

            const currentSize = houseModelRef.current.scale.x * 2;
            return distance < currentSize * 1.5;
        };

        const convertHandToWorldPosition = (handPoint) => {
            const worldX = (handPoint.x - 0.5) * 10;
            const worldY = (0.5 - handPoint.y) * 10;
            return { x: worldX, y: worldY, z: 0 };
        };

        const isFist = (landmarks) => {
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];
            const middleTip = landmarks[12];
            const ringTip = landmarks[16];
            const pinkyTip = landmarks[20];
            const wrist = landmarks[0];

            const fingerTips = [indexTip, middleTip, ringTip, pinkyTip];
            const maxDistance = fingerTips.reduce((max, tip) => {
                const dist = calculateDistance(wrist, tip);
                return Math.max(max, dist);
            }, 0);

            return maxDistance < 0.1 && calculateDistance(wrist, thumbTip) < 0.1;
        };

        const drawLandmarks = (landmarks, isLeft) => {
            if (!canvasRef.current) return;

            const canvasCtx = canvasRef.current.getContext('2d');
            if (!canvasCtx) return;

            const screenSize = Math.min(window.innerWidth, window.innerHeight);
            const lineWidth = Math.max(2, Math.min(5, screenSize / 300));
            const pointSize = Math.max(2, Math.floor(screenSize / 250));

            const connections = [
                [0, 1], [1, 2], [2, 3], [3, 4],
                [0, 5], [5, 6], [6, 7], [7, 8],
                [0, 9], [9, 10], [10, 11], [11, 12],
                [0, 13], [13, 14], [14, 15], [15, 16],
                [0, 17], [17, 18], [18, 19], [19, 20],
                [0, 5], [5, 9], [9, 13], [13, 17]
            ];

            const handColor = isLeft ? leftHandLineColor : rightHandLineColor;

            canvasCtx.lineWidth = lineWidth;
            canvasCtx.strokeStyle = handColor;

            connections.forEach(([i, j]) => {
                const start = landmarks[i];
                const end = landmarks[j];

                canvasCtx.beginPath();
                canvasCtx.moveTo(start.x * canvasRef.current.width, start.y * canvasRef.current.height);
                canvasCtx.lineTo(end.x * canvasRef.current.width, end.y * canvasRef.current.height);
                canvasCtx.stroke();
            });

            landmarks.forEach((landmark, index) => {
                let pointColor = handColor;
                if (index === 4 || index === 8) {
                    pointColor = fingertipColor;
                }

                canvasCtx.fillStyle = pointColor;
                canvasCtx.beginPath();
                canvasCtx.arc(
                    landmark.x * canvasRef.current.width,
                    landmark.y * canvasRef.current.height,
                    pointSize * (index === 4 || index === 8 ? 1.2 : 1),
                    0,
                    2 * Math.PI
                );
                canvasCtx.fill();
            });
        };

        const onResults = (results) => {
            if (!canvasRef.current) return;

            const canvasCtx = canvasRef.current.getContext('2d');
            if (!canvasCtx) return;

            canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

            if (canvasRef.current.width !== window.innerWidth ||
                canvasRef.current.height !== window.innerHeight) {
                updateCanvasSize();
            }

            rightHandActiveRef.current = false;
            leftHandActiveRef.current = false;

            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {

                let isDragging = false;
                let dragHandIndex = -1;

                if (results.multiHandLandmarks.length === 2) {
                    const leftHandLandmarks = results.multiHandedness[0].label === 'Left' ?
                        results.multiHandLandmarks[0] : results.multiHandLandmarks[1];
                    const rightHandLandmarks = results.multiHandedness[0].label === 'Right' ?
                        results.multiHandLandmarks[0] : results.multiHandLandmarks[1];

                    if (isFist(leftHandLandmarks) && isFist(rightHandLandmarks)) {
                        if (houseModelRef.current) {
                            houseModelRef.current.position.set(0, 0, 0);
                            houseModelRef.current.scale.set(1, 1, 1);
                            houseModelRef.current.rotation.set(0, 0, 0);
                            currentHouseSizeRef.current = 1.0;
                            targetHouseSizeRef.current = 1.0;
                            housePositionRef.current = { x: 0, y: 0, z: 0 };
                            housePreviousPosRef.current = { x: 0, y: 0, z: 0 };
                            rotationEnabledRef.current = true;
                            setStatus('Reset performed!');
                        }
                        return;
                    }
                }

                for (let handIndex = 0; handIndex < results.multiHandLandmarks.length; handIndex++) {
                    const landmarks = results.multiHandLandmarks[handIndex];
                    const handedness = results.multiHandedness[handIndex].label;
                    const isLeftHand = handedness === 'Left';

                    drawLandmarks(landmarks, isLeftHand);

                    if (!isLeftHand) {
                        const thumbTip = landmarks[4];
                        const indexTip = landmarks[8];
                        const middleTip = landmarks[12];

                        const pinchDistance = calculateDistance(thumbTip, indexTip);
                        const palmToMiddle = calculateDistance(landmarks[0], middleTip);
                        const isMiddleExtended = palmToMiddle > 0.15;

                        if (isMiddleExtended && isPointNearHouse(middleTip)) {
                            dragModeRef.current = true;

                            if (!isDragging) {
                                isDragging = true;
                                dragHandIndex = handIndex;
                                dragStartPosRef.current = convertHandToWorldPosition(middleTip);
                                housePreviousPosRef.current = {
                                    x: houseModelRef.current.position.x,
                                    y: houseModelRef.current.position.y,
                                    z: houseModelRef.current.position.z
                                };
                            }

                            if (isDragging && dragHandIndex === handIndex && houseModelRef.current) {
                                const currentPos = convertHandToWorldPosition(middleTip);
                                const deltaX = currentPos.x - dragStartPosRef.current.x;
                                const deltaY = currentPos.y - dragStartPosRef.current.y;

                                houseModelRef.current.position.x = housePreviousPosRef.current.x + deltaX;
                                houseModelRef.current.position.y = housePreviousPosRef.current.y + deltaY;

                                housePositionRef.current = {
                                    x: houseModelRef.current.position.x,
                                    y: houseModelRef.current.position.y,
                                    z: houseModelRef.current.position.z
                                };
                            }
                        } else if (!isMiddleExtended && dragModeRef.current) {
                            dragModeRef.current = false;
                            isDragging = false;

                            if (houseModelRef.current) {
                                housePreviousPosRef.current = {
                                    x: houseModelRef.current.position.x,
                                    y: houseModelRef.current.position.y,
                                    z: houseModelRef.current.position.z
                                };
                            }
                        }

                        if (!dragModeRef.current) {
                            if (pinchDistance < 0.05) {
                                targetHouseSizeRef.current = 0.5;
                            } else if (pinchDistance > 0.25) {
                                targetHouseSizeRef.current = 1.5;
                            } else {
                                targetHouseSizeRef.current = 0.5 + (pinchDistance - 0.05) * (1.5 - 0.5) / (0.25 - 0.05);
                            }

                            currentHouseSizeRef.current = currentHouseSizeRef.current +
                                (targetHouseSizeRef.current - currentHouseSizeRef.current) * smoothingFactor;

                            if (houseModelRef.current) {
                                houseModelRef.current.scale.set(
                                    currentHouseSizeRef.current,
                                    currentHouseSizeRef.current,
                                    currentHouseSizeRef.current
                                );
                            }
                        }

                        rightHandActiveRef.current = true;
                    } else {
                        const indexTip = landmarks[8];

                        if (isPointNearHouse(indexTip)) {
                            const currentTime = Date.now();
                            if (currentTime - lastTapTimeRef.current < doubleTapThreshold) {
                                rotationEnabledRef.current = !rotationEnabledRef.current;
                                setStatus(`Rotation ${rotationEnabledRef.current ? 'enabled' : 'disabled'}`);
                                lastTapTimeRef.current = 0;
                            } else {
                                lastTapTimeRef.current = currentTime;
                            }

                            const currentTimeColor = Date.now();
                            if (currentTimeColor - lastColorChangeTimeRef.current > colorChangeDelay) {
                                const newColor = getRandomHouseColor();
                                if (houseMaterialRef.current) {
                                    houseMaterialRef.current.color.setHex(newColor);
                                    const housePos = new THREE.Vector3();
                                    houseModelRef.current.getWorldPosition(housePos);
                                    spawnParticles(housePos, newColor);
                                }
                                lastColorChangeTimeRef.current = currentTimeColor;
                            }

                            leftHandActiveRef.current = true;
                        }
                    }
                }

            } else {
                setStatus('No hands detected');
                dragModeRef.current = false;
            }
        };

        const initMediaPipeHands = async () => {
            setStatus('Initializing MediaPipe Hands...');

            const hands = new Hands({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
                }
            });

            hands.setOptions({
                maxNumHands: 2,
                modelComplexity: 1,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            await hands.initialize();
            setStatus('Hand tracking ready!');

            hands.onResults(onResults);

            if (webcamRef.current) {
                const camera = new Camera(webcamRef.current, {
                    onFrame: async () => {
                        if (webcamRef.current) {
                            await hands.send({ image: webcamRef.current });
                        }
                    },
                    width: 1920,
                    height: 1080
                });

                camera.start();
            }
        };

        const startApp = async () => {
            try {
                await initWebcam();
                initThreeJS();
                initializeLayout();

                animate();
                await initMediaPipeHands();
            } catch (error) {
                setStatus(`Error: ${error.message}`);
                console.error('Error starting application:', error);
            }
        };

        startApp();

        return () => {
            window.removeEventListener('resize', handleResize);

            if (webcamRef.current && webcamRef.current.srcObject) {
                const tracks = webcamRef.current.srcObject.getTracks();
                tracks.forEach(track => track.stop());
            }

            if (rendererRef.current) {
                rendererRef.current.dispose();
            }
        };
    }, []);

    return (
        <div className="relative w-full h-screen overflow-hidden bg-black">
            <video
                ref={webcamRef}
                className="absolute w-full h-full object-cover transform scale-x-[-1]"
                autoPlay
                playsInline
            />
            <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full transform scale-x-[-1] pointer-events-none"
            />
            <div
                ref={threeContainerRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none z-5"
            />
            <div className="absolute top-5 right-5 text-white bg-black bg-opacity-75 p-4 rounded font-sans z-10 max-w-md">
                <h3 className="text-lg font-bold mb-2">Note:- </h3>
                <p>If hand recognition is not working so please wait sometime mediapipe is intializing..</p>
            </div>
            <p className="absolute top-0 left-0 font-sans text-base bg-green-500 bg-opacity-50 p-2">
                <a href="https://x.com/JAY_VEGAD_" target="_blank" rel="noreferrer" className="text-blue-800">Twitter</a> |
                <a href="https://github.com/Vegadjay/" target="_blank" rel="noreferrer" className="text-blue-800 ml-1">Source Code</a> |
                <a>❤️</a>
            </p>
        </div>
    );
}