import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

const PhospheneVisualization = () => {
  const mountRef = useRef(null);
  const [isStarted, setIsStarted] = useState(false);
  const [isDesignMode, setIsDesignMode] = useState(true); // Default to design mode
  const [backgroundColor, setBackgroundColor] = useState('#000000');
  const [clusterSize, setClusterSize] = useState(20);
  const [sphereColor, setSphereColor] = useState('#ac86ea');
  const [outlineColor, setOutlineColor] = useState('#000000');
  const [glowColor, setGlowColor] = useState('#FFFFFF');
  const [outlineThickness, setOutlineThickness] = useState(0.03);
  const [glowIntensity, setGlowIntensity] = useState(0.7);
  // Use a fixed size for the sphere and make the outline and glow relative to it
  const [sphereScale, setSphereScale] = useState(1.0);
  const [outlineScale, setOutlineScale] = useState(1.1); // 10% larger than sphere
  const [glowScale, setGlowScale] = useState(1.2);       // 20% larger than sphere
  const [sharpness, setSharpness] = useState(0.7);
  const [sceneRef, setSceneRef] = useState(null);
  const [controlsEnabled, setControlsEnabled] = useState(true);
  
  // New state for flickering effect
  const [enableFlickering, setEnableFlickering] = useState(false);
  const [flickerFrequency, setFlickerFrequency] = useState(0.02); // Time in seconds between flickers
  const [flickerMinOpacity, setFlickerMinOpacity] = useState(0.5); // Minimum opacity during flicker

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    // Start visualization immediately
    setIsStarted(true);
  }, []);

  useEffect(() => {
    if (!isStarted) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);
    setSceneRef(scene);

    // Camera setup
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    // Enhanced renderer setup with physically correct lighting
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    });
    renderer.setSize(window.innerWidth * 0.9, window.innerHeight * 0.9);
    renderer.physicallyCorrectLights = true; // Enable physically correct lighting
    renderer.outputColorSpace = THREE.SRGBColorSpace; // Better color reproduction
    renderer.toneMapping = THREE.ACESFilmicToneMapping; // Cinematic tone mapping
    renderer.toneMappingExposure = 1.2; // Slightly brighter exposure
    renderer.shadowMap.enabled = true; // Enable shadow mapping
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soft shadows
    mountRef.current.appendChild(renderer.domElement);

    // Add OrbitControls for design mode
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.enabled = controlsEnabled;

    // Enhanced lighting setup for better depth
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3); // Reduce ambient light
    scene.add(ambientLight);
    
    // Main directional light to create shadows
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);
    
    // Additional lights for rim lighting to enhance depth
    const backLight = new THREE.PointLight(0xffffff, 0.6);
    backLight.position.set(-5, -2, -5);
    scene.add(backLight);
    
    const fillLight = new THREE.PointLight(0xffffff, 0.4);
    fillLight.position.set(-3, 3, 5);
    scene.add(fillLight);

    // Material for the spheres - enhance depth perception with less reflective properties
    const sphereMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(sphereColor),
      metalness: 0.1,
      roughness: 1 - sharpness,
      clearcoat: 0.5,          // Reduced clearcoat for less reflection
      clearcoatRoughness: 0.3, // More roughness on clearcoat 
      reflectivity: 0.3,       // Less reflectivity to reduce glare
      envMapIntensity: 0.7,    // Reduced environment reflections
      flatShading: false,      // Keep smooth shading for realistic appearance
      emissive: new THREE.Color(sphereColor).multiplyScalar(0.05), // Very slight self-illumination
      transparent: true,       // Enable transparency for flickering effect
      opacity: 1.0             // Start fully visible
    });
    
    // Material for the black outline
    const outlineMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(outlineColor),
      side: THREE.BackSide,
      transparent: true,       // Enable transparency for flickering effect
      opacity: 1.0             // Start fully visible
    });

    // Create clusters
    const clusters = [];
    const createCluster = (startingZ) => {
      const mainCluster = new THREE.Group();
      const outlineCluster = new THREE.Group();

      // Track geometry for creating silhouette
      const allSphereGeometries = [];
      const allSpherePositions = [];
      
      // Create spheres and position them in a realistic grape-like cluster
      const sphereCount = Math.floor(Math.random() * clusterSize) + 10;
      
      // First, create a central "core" sphere
      const spheres = [];
      const baseRadius = Math.random() * 0.05 + 0.08; // Core sphere size
      
      // Add the first sphere at the center
      spheres.push({
        radius: baseRadius,
        position: new THREE.Vector3(0, 0, 0)
      });
      
      // Now add additional spheres, each touching at least one existing sphere
      for (let i = 1; i < sphereCount; i++) {
        const newRadius = Math.random() * 0.04 + 0.07; // Slight size variation
        
        // Try to find a valid position (touching another sphere but not intersecting)
        let validPosition = null;
        let attempts = 0;
        const maxAttempts = 100;
        
        while (!validPosition && attempts < maxAttempts) {
          // Pick a random existing sphere to connect to
          const connectToIndex = Math.floor(Math.random() * spheres.length);
          const connectTo = spheres[connectToIndex];
          
          // Generate a random direction from the center of the existing sphere
          const direction = new THREE.Vector3(
            Math.random() * 2 - 1,
            Math.random() * 2 - 1,
            Math.random() * 2 - 1
          ).normalize();
          
          // Position the new sphere so it's touching the existing one
          // Distance between centers = sum of radii
          const distance = connectTo.radius + newRadius;
          const newPosition = new THREE.Vector3().copy(connectTo.position)
            .add(direction.multiplyScalar(distance));
          
          // Check if this position intersects with any existing sphere
          let isValid = true;
          for (const existingSphere of spheres) {
            // Calculate distance between centers
            const centerDistance = newPosition.distanceTo(existingSphere.position);
            // Allow a tiny bit of intersection (5%) to make clusters more dense
            const minAllowedDistance = (existingSphere.radius + newRadius) * 0.85;
            
            if (centerDistance < minAllowedDistance) {
              isValid = false;
              break;
            }
          }
          
          if (isValid) {
            validPosition = newPosition;
          }
          
          attempts++;
        }
        
        // If we couldn't find a valid position, try placing it near the cluster center
        if (!validPosition) {
          const clusterCenter = new THREE.Vector3();
          // Find average center of existing spheres
          for (const sphere of spheres) {
            clusterCenter.add(sphere.position);
          }
          clusterCenter.divideScalar(spheres.length);
          
          // Add small random offset from center
          validPosition = new THREE.Vector3(
            clusterCenter.x + (Math.random() * 0.05 - 0.025), // Reduced offset for tighter grouping
            clusterCenter.y + (Math.random() * 0.05 - 0.025),
            clusterCenter.z + (Math.random() * 0.05 - 0.025)
          );
        }
        
        // Add the new sphere to our collection
        spheres.push({
          radius: newRadius,
          position: validPosition
        });
      }
      
      // Now create actual THREE.js meshes for each positioned sphere
      for (const sphere of spheres) {
        // Create the main sphere (purple) - scaled by sphereScale
        const sphereRadius = sphere.radius * sphereScale;
        const geometry = new THREE.SphereGeometry(sphereRadius, 48, 48);
        
        // Store geometry and position for silhouette creation
        allSphereGeometries.push(geometry);
        allSpherePositions.push(sphere.position);
        
        // Create a unique material instance for each sphere to add subtle variation
        const uniqueMaterial = sphereMaterial.clone();
        // Add slight color variations to enhance depth perception
        const hue = new THREE.Color(sphereColor);
        const variance = 0.05; // Subtle variance
        uniqueMaterial.color.setRGB(
          hue.r * (1 + (Math.random() - 0.5) * variance),
          hue.g * (1 + (Math.random() - 0.5) * variance),
          hue.b * (1 + (Math.random() - 0.5) * variance)
        );
        
        const mainSphere = new THREE.Mesh(geometry, uniqueMaterial);
        mainSphere.position.copy(sphere.position);
        mainCluster.add(mainSphere);
        
        // Create outline sphere - scaled by outlineScale relative to base radius
        const outlineRadius = sphere.radius * outlineScale;
        const outlineGeometry = new THREE.SphereGeometry(outlineRadius, 48, 48);
        const outline = new THREE.Mesh(outlineGeometry, outlineMaterial.clone());
        outline.position.copy(sphere.position);
        outlineCluster.add(outline);
      }

      // Position the clusters
      const clusterPosition = isDesignMode 
        ? new THREE.Vector3(0, 0, 0)
        : new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            startingZ
          );
      
      mainCluster.position.copy(clusterPosition);
      outlineCluster.position.copy(clusterPosition);

      // Add more subtle random rotation - less extreme angles
      const rotation = new THREE.Euler(
        Math.random() * Math.PI * 0.5,
        Math.random() * Math.PI * 0.5,
        Math.random() * Math.PI * 0.5
      );
      
      mainCluster.rotation.copy(rotation);
      outlineCluster.rotation.copy(rotation);

      // Only add movement properties if not in design mode
      if (!isDesignMode) {
        const userData = {
          rotationSpeed: {
            // Reduce rotation speed to be more subtle
            x: (Math.random() - 0.5) * 0.005,
            y: (Math.random() - 0.5) * 0.005,
            z: (Math.random() - 0.5) * 0.005
          },
          movementSpeed: 0.03 + Math.random() * 0.02,
          sideMovement: {
            x: (Math.random() - 0.5) * 0.01,
            y: (Math.random() - 0.5) * 0.01
          }
        };
        
        mainCluster.userData = userData;
        outlineCluster.userData = userData;
      }

      // Create a glow edge effect around the outline of the entire cluster
      // First, get the bounding box of the cluster to calculate its size
      const bbox = new THREE.Box3().setFromObject(outlineCluster);
      const size = new THREE.Vector3();
      bbox.getSize(size);
      
      // Create a slightly enlarged clone of the outline cluster for the glow effect
      const glowOutlineCluster = outlineCluster.clone();
      
      // Scale each child mesh in the glow outline cluster to be slightly larger
      glowOutlineCluster.children.forEach((child, i) => {
        // Scale by glowScale relative to the original outline scale
        child.scale.set(glowScale/outlineScale, glowScale/outlineScale, glowScale/outlineScale);
      });
      
      // Create a custom material for the glow effect
      const glowMaterial = new THREE.ShaderMaterial({
        uniforms: {
          glowColor: { value: new THREE.Color(glowColor) },
          glowIntensity: { value: glowIntensity },
          viewVector: { value: new THREE.Vector3() },
          opacity: { value: 1.0 }  // Add uniform for controlling opacity
        },
        vertexShader: `
          uniform vec3 viewVector;
          varying float intensity;
          void main() {
            gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
            vec3 actual_normal = normalize(normalMatrix * normal);
            vec3 actual_view = normalize(viewVector);
            intensity = pow(1.0 - abs(dot(actual_normal, actual_view)), 2.0);
          }
        `,
        fragmentShader: `
          uniform vec3 glowColor;
          uniform float glowIntensity;
          uniform float opacity;
          varying float intensity;
          void main() {
            vec3 glow = glowColor * intensity * glowIntensity;
            gl_FragColor = vec4(glow, intensity * glowIntensity * opacity);
          }
        `,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false
      });
      
      // Apply the glow material to all children of the glow outline cluster
      glowOutlineCluster.children.forEach(child => {
        child.material = glowMaterial.clone();
      });
      
      // Position and rotate the glow outline cluster the same as the others
      glowOutlineCluster.position.copy(clusterPosition);
      glowOutlineCluster.rotation.copy(rotation);
      
      // Add the same userData for animation if not in design mode
      if (!isDesignMode) {
        glowOutlineCluster.userData = mainCluster.userData;
      }

      // Add to scene in the correct order (back to front)
      scene.add(glowOutlineCluster); // Glow effect (furthest back)
      scene.add(outlineCluster);     // Black outline
      scene.add(mainCluster);        // Purple spheres (closest to camera)
      
      clusters.push({
        main: mainCluster,
        outline: outlineCluster,
        glow: glowOutlineCluster
      });

      return {
        main: mainCluster,
        outline: outlineCluster,
        glow: glowOutlineCluster
      };
    };

    // Create clusters based on mode
    if (isDesignMode) {
      createCluster(0); // Single cluster at center for design mode
    } else {
      // Start with just one cluster far away
      createCluster(-60);
    }

    // Variables for flickering effect
    let lastFlickerTime = 0;
    let isFullOpacity = true;

    // Animation loop
    const animate = (timestamp) => {
      requestAnimationFrame(animate);

      // Handle flickering effect
      if (enableFlickering) {
        const currentTime = timestamp / 1000; // Convert to seconds
        if (currentTime - lastFlickerTime >= flickerFrequency) {
          // Time to flicker
          isFullOpacity = !isFullOpacity;
          lastFlickerTime = currentTime;
          
          // Set the opacity for all clusters
          const targetOpacity = isFullOpacity ? 1.0 : flickerMinOpacity;
          
          clusters.forEach(cluster => {
            // Main cluster (spheres)
            cluster.main.children.forEach(child => {
              if (child.material) {
                child.material.opacity = targetOpacity;
              }
            });
            
            // Outline
            cluster.outline.children.forEach(child => {
              if (child.material) {
                child.material.opacity = targetOpacity;
              }
            });
            
            // Glow effect
            cluster.glow.children.forEach(child => {
              if (child.material && child.material.uniforms && child.material.uniforms.opacity) {
                child.material.uniforms.opacity.value = targetOpacity;
              }
            });
          });
        }
      }

      // Update camera view vector for all glow shader materials
      clusters.forEach(cluster => {
        // Update all the glow spheres in the cluster
        if (cluster.glow.children) {
          cluster.glow.children.forEach(glowSphere => {
            if (glowSphere.material && glowSphere.material.uniforms) {
              // Get the camera position in world space
              const cameraPosition = new THREE.Vector3();
              camera.getWorldPosition(cameraPosition);
              
              // Set the view vector to point from the camera to the center of the cluster
              glowSphere.material.uniforms.viewVector.value.copy(cameraPosition);
              
              // Update the glow intensity
              glowSphere.material.uniforms.glowIntensity.value = glowIntensity;
            }
          });
        }
      });

      if (isDesignMode) {
        // In design mode, just update the controls
        controls.update();
      } else {
        // In regular mode, animate clusters
        let shouldSpawnNew = false;
        
        // Use a reverse loop to safely remove items
        for (let i = clusters.length - 1; i >= 0; i--) {
          const cluster = clusters[i];
          // Get all parts of the cluster
          const main = cluster.main;
          const outline = cluster.outline;
          const glow = cluster.glow;
          
          // Get movement data
          const userData = main.userData;
          
          // Rotate all components together
          main.rotation.x += userData.rotationSpeed.x;
          main.rotation.y += userData.rotationSpeed.y;
          main.rotation.z += userData.rotationSpeed.z;
          
          outline.rotation.copy(main.rotation);
          glow.rotation.copy(main.rotation);

          // Move the cluster toward the camera
          main.position.z += userData.movementSpeed;
          outline.position.z += userData.movementSpeed;
          glow.position.z += userData.movementSpeed;

          // Add slight side movement as it gets closer
          if (main.position.z > -15) {
            main.position.x += userData.sideMovement.x;
            main.position.y += userData.sideMovement.y;
            
            outline.position.x += userData.sideMovement.x;
            outline.position.y += userData.sideMovement.y;
            
            glow.position.x += userData.sideMovement.x;
            glow.position.y += userData.sideMovement.y;
          }

          // Check if this cluster is approaching the camera and we need to spawn a new one
          if (main.position.z > 0 && main.position.z < 2 && clusters.length < 2) {
            shouldSpawnNew = true;
          }

          // Remove clusters that have passed far beyond the camera
          if (main.position.z > 15 || 
              Math.abs(main.position.x) > 5 || 
              Math.abs(main.position.y) > 5) {
            // Remove all components
            scene.remove(main);
            scene.remove(outline);
            scene.remove(glow);
            
            clusters.splice(i, 1);
          }
          
          // Add gradual fade out as cluster passes the camera
          if (main.position.z > 2 && main.position.z < 10) {
            // Calculate fade based on position (1.0 at z=2, 0.0 at z=10)
            const fadeAmount = 1.0 - ((main.position.z - 2) / 8);
            const currentOpacity = isFullOpacity ? fadeAmount : fadeAmount * flickerMinOpacity;
            
            // Fade the main cluster
            main.children.forEach(child => {
              if (child.material) {
                child.material.opacity = currentOpacity;
              }
            });
            
            // Fade the outline
            outline.children.forEach(child => {
              if (child.material) {
                child.material.opacity = currentOpacity;
              }
            });
            
            // The glow is already transparent, just reduce its intensity
            glow.children.forEach(child => {
              if (child.material && child.material.uniforms && child.material.uniforms.glowIntensity) {
                child.material.uniforms.glowIntensity.value = glowIntensity * currentOpacity;
              }
            });
          }
        }
        
        // Spawn a new cluster if needed
        if (shouldSpawnNew) {
          createCluster(-60);
        }
      }

      // Render the scene
      renderer.render(scene, camera);
    };

    animate(0);

    // Handle window resize
    const handleResize = () => {
      const width = isFullscreen ? window.innerWidth : window.innerWidth * 0.6;
      const height = isFullscreen ? window.innerHeight : window.innerHeight * 0.6;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial resize

    // Cleanup - capture mountRef.current in a variable to avoid React hooks warning
    const currentRef = mountRef.current;
    return () => {
      window.removeEventListener('resize', handleResize);
      if (currentRef && currentRef.contains(renderer.domElement)) {
        currentRef.removeChild(renderer.domElement);
      }
      scene.clear();
    };
  }, [isStarted, isDesignMode, backgroundColor, clusterSize, sphereColor, outlineColor, glowColor, outlineThickness, glowIntensity, sphereScale, outlineScale, glowScale, sharpness, controlsEnabled, enableFlickering, flickerFrequency, flickerMinOpacity, isFullscreen]);

  const handleViewMode = () => {
    setIsDesignMode(false);
    setControlsEnabled(false);
  };

  const handleDesignMode = () => {
    setIsDesignMode(true);
    setControlsEnabled(true);
  };

  const handleReset = () => {
    window.location.reload();
  };

  const toggleFullscreen = () => {
    const elem = mountRef.current;
    if (!document.fullscreenElement) {
      elem.requestFullscreen().then(() => setIsFullscreen(true)).catch(err => console.error(err));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(err => console.error(err));
    }
  };

  return (
    <div className="flex flex-row w-full h-full bg-gray-900">
      {/* Control panel */}
      <div className="w-1/3 p-4 bg-gray-900 text-gray-200 overflow-y-auto max-h-screen border-r border-gray-700">
        <h2 className="text-xl mb-4 font-semibold text-purple-400">Phosphene Visualization</h2>
        
        <div className="mb-4">
          <label className="block text-gray-300 mb-2">Background Color:</label>
          <div className="flex items-center">
            <input 
              type="color" 
              value={backgroundColor} 
              onChange={(e) => setBackgroundColor(e.target.value)} 
              className="p-1 rounded border border-gray-600 bg-gray-800"
            />
            <span className="ml-2 text-gray-400">{backgroundColor}</span>
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-300 mb-2">Sphere Color:</label>
          <div className="flex items-center">
            <input 
              type="color" 
              value={sphereColor} 
              onChange={(e) => setSphereColor(e.target.value)} 
              className="p-1 rounded border border-gray-600 bg-gray-800"
            />
            <span className="ml-2 text-gray-400">{sphereColor}</span>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-gray-300 mb-2">Outline Color:</label>
          <div className="flex items-center">
            <input 
              type="color" 
              value={outlineColor} 
              onChange={(e) => setOutlineColor(e.target.value)} 
              className="p-1 rounded border border-gray-600 bg-gray-800"
            />
            <span className="ml-2 text-gray-400">{outlineColor}</span>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-gray-300 mb-2">Glow Color:</label>
          <div className="flex items-center">
            <input 
              type="color" 
              value={glowColor} 
              onChange={(e) => setGlowColor(e.target.value)} 
              className="p-1 rounded border border-gray-600 bg-gray-800"
            />
            <span className="ml-2 text-gray-400">{glowColor}</span>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-gray-300 mb-2">Number of Balls in Clusters:</label>
          <input 
            type="range" 
            min="5" 
            max="40" 
            value={clusterSize} 
            onChange={(e) => setClusterSize(parseInt(e.target.value))} 
            className="w-full bg-gray-700"
          />
          <span className="text-gray-300">{clusterSize}</span>
        </div>

        <div className="mb-4">
          <label className="block text-gray-300 mb-2">Outline Size:</label>
          <input 
            type="range" 
            min="1.01" 
            max="1.2" 
            step="0.01"
            value={outlineScale} 
            onChange={(e) => setOutlineScale(parseFloat(e.target.value))} 
            className="w-full bg-gray-700"
          />
          <span className="text-gray-300">×{outlineScale.toFixed(2)}</span>
        </div>

        <div className="mb-4">
          <label className="block text-gray-300 mb-2">Glow Intensity:</label>
          <input 
            type="range" 
            min="0.1" 
            max="1" 
            step="0.1"
            value={glowIntensity} 
            onChange={(e) => setGlowIntensity(parseFloat(e.target.value))} 
            className="w-full bg-gray-700"
          />
          <span className="text-gray-300">{glowIntensity.toFixed(1)}</span>
        </div>

        <div className="mb-4">
          <label className="block text-gray-300 mb-2">Glow Size:</label>
          <input 
            type="range" 
            min="1.1" 
            max="2.0" 
            step="0.05"
            value={glowScale} 
            onChange={(e) => setGlowScale(parseFloat(e.target.value))} 
            className="w-full bg-gray-700"
          />
          <span className="text-gray-300">×{glowScale.toFixed(2)}</span>
        </div>

        <div className="mb-4">
          <label className="block text-gray-300 mb-2">Edge Sharpness:</label>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.1"
            value={sharpness} 
            onChange={(e) => setSharpness(parseFloat(e.target.value))} 
            className="w-full bg-gray-700"
          />
          <span className="text-gray-300">{sharpness.toFixed(1)}</span>
        </div>

        {/* New controls for flickering effect */}
        <div className="mt-6 p-3 bg-gray-800 rounded-md border border-gray-700">
          <h3 className="text-lg text-purple-400 mb-2">Flickering Effect</h3>
          
          <div className="mb-4 flex items-center">
            <input 
              type="checkbox" 
              id="enableFlickering" 
              checked={enableFlickering} 
              onChange={(e) => setEnableFlickering(e.target.checked)}
              className="mr-2 rounded"
            />
            <label htmlFor="enableFlickering" className="text-gray-300">Enable Flickering</label>
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-300 mb-2">Flicker Frequency (seconds):</label>
            <input 
              type="range" 
              min="0.005" 
              max="1.0" 
              step="0.01"
              value={flickerFrequency} 
              onChange={(e) => setFlickerFrequency(parseFloat(e.target.value))} 
              className="w-full bg-gray-700"
              disabled={!enableFlickering}
            />
            <span className="text-gray-300">{flickerFrequency.toFixed(2)}s</span>
          </div>
          
          
          <div className="mb-2">
            <label className="block text-gray-300 mb-2">Minimum Opacity:</label>
            <input 
              type="range" 
              min="0.1" 
              max="0.9" 
              step="0.1"
              value={flickerMinOpacity} 
              onChange={(e) => setFlickerMinOpacity(parseFloat(e.target.value))} 
              className="w-full bg-gray-700"
              disabled={!enableFlickering}
            />
            <span className="text-gray-300">{flickerMinOpacity.toFixed(1)}</span>
          </div>
        </div>

        <div className="flex gap-4 mt-6">
          <button 
            onClick={handleDesignMode} 
            className={`px-4 py-2 ${isDesignMode ? 'bg-purple-900 ring-2 ring-purple-500' : 'bg-purple-800'} text-white rounded hover:bg-purple-700 transition-colors`}
          >
            Design Mode
          </button>
          <button 
            onClick={handleViewMode} 
            className={`px-4 py-2 ${!isDesignMode ? 'bg-indigo-900 ring-2 ring-indigo-500' : 'bg-indigo-800'} text-white rounded hover:bg-indigo-700 transition-colors`}
          >
            Animation Mode
          </button>
          <button 
            onClick={handleReset} 
            className="px-4 py-2 bg-red-800 text-white rounded hover:bg-red-700 transition-colors"
          >
            Reset
          </button>
          <button
            onClick={toggleFullscreen}
            className="px-4 py-2 bg-green-800 text-white rounded hover:bg-green-700 transition-colors"
          >
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
        </div>
        
        {isDesignMode && (
          <p className="mt-4 text-sm text-gray-400 bg-gray-800 p-3 rounded-md border border-gray-700">
            Design Mode: Use mouse to rotate, zoom and pan the cluster.
          </p>
        )}
      </div>

      {/* Visualization area */}
      <div className="w-2/3 flex items-center justify-center bg-black">
        <div ref={mountRef} className="rounded-lg overflow-hidden border-2 border-gray-800 shadow-lg shadow-purple-900/20"></div>
      </div>
    </div>
  );
};

export default PhospheneVisualization;
