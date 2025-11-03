import { GlobalSettings } from "./sections/GlobalSettings";
import { UploadImageSection } from "./sections/UploadImageSection";
import { BasicAdjustments } from "./sections/BasicAdjustments";
import { DitheringOptions } from "./sections/DitheringOptions";
import { CharacterSet } from "./sections/CharacterSet";
import { EdgeDetection } from "./sections/EdgeDetection";
import { DisplaySettings } from "./sections/DisplaySettings";
import { ResetButton } from "./sections/ResetButton";

const Sidebar = () => {
  return (
    <div className="flex-1 w-full bg-background">
      <div className="flex h-screen">
        <aside className="w-80 bg-card border-r border-border overflow-y-auto p-6 space-y-6">
          <GlobalSettings />
          <UploadImageSection />
          <BasicAdjustments />
          <DitheringOptions />
          <CharacterSet />
          <EdgeDetection />
          <DisplaySettings />
          <ResetButton />
        </aside>
      </div>
    </div>
  );
};

export default Sidebar;
