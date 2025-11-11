import { Footer } from "./Components/Footer";
import { Header } from "./Components/Header";
import AsciiArtGenerator from "./Components/Ascii-art-generator";
import Sidebar from "./Components/Sidebar/Sidebar";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <AsciiArtGenerator />
      </div>
      <Footer />
    </div>
  );
}
