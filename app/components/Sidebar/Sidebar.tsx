import { GlobalSettings } from "./sections/GlobalSettings";
import { GenerateImageSection } from "./sections/GenerateImageSection";
import { BasicAdjustments } from "./sections/BasicAdjustments";
import { DitheringOptions } from "./sections/DitheringOptions";
import { CharacterSet } from "./sections/CharacterSet";
import { EdgeDetection } from "./sections/EdgeDetection";
import { DisplaySettings } from "./sections/DisplaySettings";
import { ResetButton } from "./sections/ResetButton";
import { GenerateTextSection } from "./sections/GenerateTextSection";

const Sidebar = () => {
  return (
    <aside className="w-80 bg-card border-r rounded-r-sm border-border overflow-y-auto p-6 space-y-6 shrink-0 h-full ">
      <GlobalSettings />
      <GenerateImageSection />
      <GenerateTextSection />
      <BasicAdjustments />
      <DitheringOptions />
      <CharacterSet />
      <EdgeDetection />
      <DisplaySettings />
      <ResetButton />
    </aside>
  );
};

export default Sidebar;
