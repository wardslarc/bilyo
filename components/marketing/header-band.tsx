import { SiteHeader } from "@/components/marketing/site-header";

/**
 * The ink band that carries SiteHeader on interior marketing pages.
 *
 * The landing page does NOT use this — there the header is fused into the hero
 * so the band runs on behind the headline. Every other marketing page wants the
 * band to stop at the header, which is what this does.
 */
export function HeaderBand({ children }: { children?: React.ReactNode }) {
  return (
    <div className="bg-ink text-paper">
      <div className="mx-auto w-full max-w-360 px-5 lg:px-30">
        <SiteHeader />
        {children}
      </div>
    </div>
  );
}
