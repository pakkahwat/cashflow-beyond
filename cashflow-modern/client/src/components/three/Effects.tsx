import { EffectComposer, Bloom, Vignette, ToneMapping, N8AO, SMAA } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

export interface EffectsProps {
  enabled: boolean;
  quality: 'high' | 'low';
}

/** Post-FX pass. N8AO grounds objects with contact AO; Bloom glows the active tile;
 *  AgX tone mapping for filmic highlights; SMAA cleans glowing edges (last). */
export default function Effects({ enabled, quality }: EffectsProps) {
  if (!enabled) return null;
  return (
    <EffectComposer>
      <N8AO aoRadius={1.3} distanceFalloff={1} intensity={2.4} halfRes={quality !== 'high'} />
      <Bloom intensity={0.8} luminanceThreshold={0.6} luminanceSmoothing={0.2} mipmapBlur />
      <Vignette eskil={false} offset={0.25} darkness={0.7} />
      <ToneMapping mode={ToneMappingMode.AGX} />
      <SMAA />
    </EffectComposer>
  );
}
