import { Composition } from "remotion";
import { InsightsVideo } from "./InsightsVideo";
import type { InsightsData } from "./types";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="InsightsVideo"
      component={InsightsVideo}
      durationInFrames={630}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{} as InsightsData}
    />
  );
};
