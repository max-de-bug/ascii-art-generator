import Image from "next/image";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import AsciiArtGenerator from "./components/Ascii-art-generator";
import { Sidebar } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <Sidebar />
      <AsciiArtGenerator />
      <Footer />
    </div>
  );
}
