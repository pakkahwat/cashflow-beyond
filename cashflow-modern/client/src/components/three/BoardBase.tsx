// Premium board base: a raised beveled platform, glowing accent rims (picked up
// by Bloom), and a center pedestal where the dice sit. Shared by both rings.

export interface BoardBaseProps {
  radius: number;
  quality: 'high' | 'low';
}

export default function BoardBase({ radius, quality }: BoardBaseProps) {
  const high = quality === 'high';
  return (
    <group>
      {/* raised platform (the "table") */}
      <mesh position={[0, -0.4, 0]} receiveShadow={high} castShadow={high}>
        <cylinderGeometry args={[radius + 1.9, radius + 2.2, 0.7, 96]} />
        <meshStandardMaterial color="#0d1430" roughness={0.55} metalness={0.6} />
      </mesh>

      {/* polished top surface (catches the environment) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow={high}>
        <circleGeometry args={[radius + 1.6, 96]} />
        <meshStandardMaterial color="#141d3c" roughness={0.32} metalness={0.7} />
      </mesh>

      {/* outer glowing rim */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <torusGeometry args={[radius + 1.55, 0.07, 16, 140]} />
        <meshStandardMaterial color="#3aa0ff" emissive="#3aa0ff" emissiveIntensity={2.2} toneMapped={false} />
      </mesh>

      {/* inner gold accent ring (just inside the tiles) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <torusGeometry args={[radius - 1.4, 0.05, 16, 140]} />
        <meshStandardMaterial color="#f1c40f" emissive="#f1c40f" emissiveIntensity={1.5} toneMapped={false} />
      </mesh>

      {/* center pedestal for the dice */}
      <mesh position={[0, 0.0, 0]} receiveShadow={high} castShadow={high}>
        <cylinderGeometry args={[1.7, 1.95, 0.5, 64]} />
        <meshStandardMaterial color="#101a37" roughness={0.4} metalness={0.65} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.26, 0]}>
        <ringGeometry args={[1.5, 1.68, 64]} />
        <meshStandardMaterial color="#3aa0ff" emissive="#3aa0ff" emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
    </group>
  );
}
