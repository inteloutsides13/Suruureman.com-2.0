export function FooterDeveloperCredit() {
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-3 border-t border-accent/10 pt-8">
      <p className="text-xs tracking-widest text-muted-foreground">
        Developed &amp; Maintained by
      </p>
      <a
        href="https://thequantumforge.net"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="The Quantum Forge (opens in a new tab)"
        className="group flex flex-col items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card"
      >
        <img
          src={`${import.meta.env.BASE_URL}images/the-quantum-forge.webp`}
          alt="The Quantum Forge"
          width={512}
          height={512}
          decoding="async"
          className="h-auto w-[78px] max-w-full object-contain sm:w-24"
        />
        <span className="font-heading text-sm tracking-widest text-foreground transition-colors group-hover:text-accent">
          The Quantum Forge
        </span>
      </a>
    </div>
  );
}
