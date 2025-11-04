import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import AsciiArtGenerator from "./components/Ascii-art-generator";
import Sidebar from "./components/Sidebar/Sidebar";

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
