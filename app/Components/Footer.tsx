export function Footer() {
  return (
    <footer className="border-t border-border bg-card/30 backdrop-blur mt-4">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 
              className="text-sm font-semibold text-foreground mb-3 transition-all duration-300 hover:[text-shadow:0_0_10px_currentColor,0_0_20px_currentColor] cursor-pointer"
              style={{ fontFamily: "var(--font-pixel), var(--font-press-start), monospace", fontWeight: 600, fontSize: "1.1rem", letterSpacing: "0.05em" }}
            >
              About
            </h3>
            <p className="text-sm text-muted-foreground transition-colors duration-300 hover:text-white cursor-pointer">
              Create stunning ASCII art from text and images with our advanced
              generator.
            </p>
          </div>
          <div>
            <h3 
              className="text-sm font-semibold text-foreground mb-3 transition-all duration-300 hover:[text-shadow:0_0_10px_currentColor,0_0_20px_currentColor] cursor-pointer"
              style={{ fontFamily: "var(--font-pixel), var(--font-press-start), monospace", fontWeight: 600, fontSize: "1.1rem", letterSpacing: "0.05em" }}
            >
              Features
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside ml-4 cursor-pointer">
              <li className="transition-colors duration-300 hover:text-white">Text to ASCII conversion</li>
              <li className="transition-colors duration-300 hover:text-white">Image to ASCII conversion</li>
              <li className="transition-colors duration-300 hover:text-white">Adjustable density & size</li>
              <li className="transition-colors duration-300 hover:text-white">Download & copy functions</li>
            </ul>
          </div>
          <div>
            <h3 
              className="text-sm font-semibold text-foreground mb-3 transition-all duration-300 hover:[text-shadow:0_0_10px_currentColor,0_0_20px_currentColor] cursor-pointer"
              style={{ fontFamily: "var(--font-pixel), var(--font-press-start), monospace", fontWeight: 600, fontSize: "1.1rem", letterSpacing: "0.05em" }}
            >
              Usage
            </h3>
            <p className="text-sm text-muted-foreground transition-colors duration-300 hover:text-white cursor-pointer">
              Enter text or upload an image, adjust settings, and generate
              beautiful ASCII art instantly.
            </p>
          </div>
        </div>
        <div className="border-t border-border mt-8 pt-8">
          <p className="text-center text-sm text-muted-foreground">
            
            © 2025 ASCII Art Generator. created by <a href="https://github.com/max-de-bug" className="text-primary hover:text-primary/80" target="_blank" rel="noopener noreferrer">Connor</a>
            {' '}•{' '}
            <a href="https://x.com/CryptoMax_07" className="text-primary hover:text-primary/80" target="_blank" rel="noopener noreferrer">X(Twitter)</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
