/**
 * 3D 로봇 시각화 컴포넌트 - Three.js 기반 실시간 로봇 모델링
 */
import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useRobotState } from '../../contexts/RobotStateContext';

interface RobotJoint {
  position: [number, number, number];
  rotation: [number, number, number];
  length: number;
  radius: number;
}

// Doosan M0609 로봇 모델 컴포넌트
function RobotModel({ jointPositions }: { jointPositions: number[] }) {
  const groupRef = useRef<THREE.Group>(null);
  
  // 조인트 각도를 3D 회전으로 변환
  const jointAngles = jointPositions.map(angle => angle * Math.PI / 180);
  
  useFrame(() => {
    if (groupRef.current) {
      // 부드러운 회전 애니메이션 적용
      groupRef.current.rotation.y += 0.01;
    }
  });

  return (
    <group ref={groupRef}>
      {/* 베이스 */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.5, 0.6, 0.3, 16]} />
        <meshStandardMaterial color="#2563eb" />
      </mesh>
      
      {/* 조인트 1 - 베이스 회전 */}
      <group rotation={[0, jointAngles[0] || 0, 0]}>
        <mesh position={[0, 0.4, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.5, 16]} />
          <meshStandardMaterial color="#1e40af" />
        </mesh>
        
        {/* 조인트 2 - 어깨 */}
        <group position={[0, 0.65, 0]} rotation={[0, 0, jointAngles[1] || 0]}>
          <mesh position={[0.4, 0, 0]}>
            <boxGeometry args={[0.8, 0.2, 0.2]} />
            <meshStandardMaterial color="#3b82f6" />
          </mesh>
          
          {/* 조인트 3 - 상완 */}
          <group position={[0.8, 0, 0]} rotation={[0, 0, jointAngles[2] || 0]}>
            <mesh position={[0.35, 0, 0]}>
              <boxGeometry args={[0.7, 0.15, 0.15]} />
              <meshStandardMaterial color="#60a5fa" />
            </mesh>
            
            {/* 조인트 4 - 전완 회전 */}
            <group position={[0.7, 0, 0]} rotation={[jointAngles[3] || 0, 0, 0]}>
              <mesh position={[0.25, 0, 0]}>
                <cylinderGeometry args={[0.08, 0.08, 0.5, 12]} />
                <meshStandardMaterial color="#93c5fd" />
              </mesh>
              
              {/* 조인트 5 - 손목 피치 */}
              <group position={[0.5, 0, 0]} rotation={[0, 0, jointAngles[4] || 0]}>
                <mesh>
                  <sphereGeometry args={[0.1, 12, 8]} />
                  <meshStandardMaterial color="#bfdbfe" />
                </mesh>
                
                {/* 조인트 6 - 엔드 이펙터 */}
                <group rotation={[0, 0, jointAngles[5] || 0]}>
                  <mesh position={[0, 0, 0.15]}>
                    <cylinderGeometry args={[0.06, 0.06, 0.3, 8]} />
                    <meshStandardMaterial color="#dbeafe" />
                  </mesh>
                  
                  {/* 그리퍼 */}
                  <mesh position={[0.05, 0, 0.3]}>
                    <boxGeometry args={[0.1, 0.02, 0.1]} />
                    <meshStandardMaterial color="#ef4444" />
                  </mesh>
                  <mesh position={[-0.05, 0, 0.3]}>
                    <boxGeometry args={[0.1, 0.02, 0.1]} />
                    <meshStandardMaterial color="#ef4444" />
                  </mesh>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

export const Robot3DViewer: React.FC = () => {
  const { robotState } = useRobotState();
  const [cameraPosition, setCameraPosition] = useState<[number, number, number]>([3, 3, 3]);
  const [showGrid, setShowGrid] = useState(true);
  const [showAxes, setShowAxes] = useState(true);

  return (
    <div className="relative w-full h-96 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
      {/* 3D 컨트롤 UI */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <button
          onClick={() => setShowGrid(!showGrid)}
          className={`px-3 py-1 text-xs rounded ${
            showGrid 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
          }`}
        >
          그리드
        </button>
        <button
          onClick={() => setShowAxes(!showAxes)}
          className={`px-3 py-1 text-xs rounded ${
            showAxes 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
          }`}
        >
          축
        </button>
        <button
          onClick={() => setCameraPosition([3, 3, 3])}
          className="px-3 py-1 text-xs rounded bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
        >
          초기화
        </button>
      </div>

      {/* 조인트 값 표시 */}
      <div className="absolute bottom-4 left-4 z-10 bg-black/20 backdrop-blur-sm rounded-lg p-3 text-white text-sm">
        <div className="font-semibold mb-2">조인트 각도 (도)</div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          {robotState.jointPositions.map((angle, index) => (
            <div key={index} className="flex justify-between">
              <span>J{index + 1}:</span>
              <span className="font-mono">{angle.toFixed(1)}°</span>
            </div>
          ))}
        </div>
      </div>

      {/* Three.js Canvas */}
      <Canvas
        camera={{ position: cameraPosition, fov: 60 }}
        shadows
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'linear-gradient(to bottom, #f0f9ff, #e0e7ff)' }}
      >
        {/* 조명 설정 */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[10, 10, 5]}
          intensity={1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <pointLight position={[-10, -10, -10]} intensity={0.3} />
        
        {/* 환경 */}
        <Environment preset="warehouse" />
        
        {/* 그리드 */}
        {showGrid && (
          <Grid
            args={[10, 10]}
            cellSize={0.5}
            cellThickness={0.5}
            cellColor="#6b7280"
            sectionSize={5}
            sectionThickness={1}
            sectionColor="#374151"
            fadeDistance={30}
            fadeStrength={1}
            followCamera={false}
            infiniteGrid
          />
        )}
        
        {/* 좌표축 */}
        {showAxes && (
          <group>
            {/* X축 - 빨강 */}
            <mesh position={[0.5, 0, 0]}>
              <cylinderGeometry args={[0.01, 0.01, 1, 8]} />
              <meshBasicMaterial color="#ef4444" />
            </mesh>
            {/* Y축 - 초록 */}
            <mesh position={[0, 0.5, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.01, 0.01, 1, 8]} />
              <meshBasicMaterial color="#22c55e" />
            </mesh>
            {/* Z축 - 파랑 */}
            <mesh position={[0, 0, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.01, 0.01, 1, 8]} />
              <meshBasicMaterial color="#3b82f6" />
            </mesh>
          </group>
        )}
        
        {/* 로봇 모델 */}
        <RobotModel jointPositions={robotState.jointPositions} />
        
        {/* 카메라 컨트롤 */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          dampingFactor={0.05}
          autoRotate={false}
          maxDistance={20}
          minDistance={1}
        />
      </Canvas>
    </div>
  );
};

export default Robot3DViewer;