export function Footer() {
  return (
    <footer className="border-t border-border bg-card/30 backdrop-blur mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              About
            </h3>
            <p className="text-sm text-muted-foreground">
              Create stunning ASCII art from text and images with our advanced
              generator.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Features
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Text to ASCII conversion</li>
              <li>Image to ASCII conversion</li>
              <li>Adjustable density & size</li>
              <li>Download & copy functions</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Usage
            </h3>
            <p className="text-sm text-muted-foreground">
              Enter text or upload an image, adjust settings, and generate
              beautiful ASCII art instantly.
            </p>
          </div>
        </div>
        <div className="border-t border-border mt-8 pt-8">
          <p className="text-center text-sm text-muted-foreground">
            © 2025 ASCII Art Generator. Made with creativity.
          </p>
        </div>
      </div>
    </footer>
  );
}
