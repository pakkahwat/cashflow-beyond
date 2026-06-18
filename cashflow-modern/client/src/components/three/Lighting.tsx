import { Environment, Lightformer } from '@react-three/drei';

export interface LightingProps {
  quality: 'high' | 'low';
}

/** Key / fill / ambient + a soft preset environment. Shadows only on high quality. */
export default function Lighting({ quality }: LightingProps) {
  const high = quality === 'high';
  return (
    <>
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#8aa0ff', '#0b0f1d', 0.5]} />
      <directionalLight
        position={[6, 12, 6]}
        intensity={high ? 1.4 : 1.1}
        castShadow={high}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-camera-near={0.5}
        shadow-camera-far={40}
      />
      <directionalLight position={[-8, 5, -6]} intensity={0.45} color="#5b6bff" />
      {/* dramatic key spot over the board + subtle glow rising from the center */}
      <spotLight position={[0, 16, 2]} angle={0.55} penumbra={0.9} intensity={high ? 1.4 : 1} color="#dce6ff" />
      <pointLight position={[0, 1.6, 0]} intensity={0.7} distance={11} color="#3aa0ff" />
      {/* Art-directed studio reflections — no remote HDRI fetch. */}
      <Environment resolution={256} environmentIntensity={0.6}>
        <Lightformer form="ring" intensity={2} position={[0, 9, 0]} scale={12} color="#9fb4ff" />
        <Lightformer form="rect" intensity={1.4} position={[-7, 4, -6]} scale={[7, 7, 1]} color="#5b6bff" />
        <Lightformer form="rect" intensity={1} position={[7, 3, 6]} scale={[6, 6, 1]} color="#ffd98a" />
      </Environment>
    </>
  );
}
