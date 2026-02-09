import { Composition } from "remotion";
import { InsightsVideo } from "./InsightsVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="InsightsVideo"
      component={InsightsVideo}
      durationInFrames={900}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        data: null as any,
      }}
    />
  );
};
