import { SiteFooter } from "@/components/marketing/site-footer";

/**
 * Shared shell for every marketing page. Only the footer lives here: the header
 * differs by page (fused into the hero on the landing page, a plain band
 * elsewhere via <HeaderBand />), so pages render their own.
 *
 * The root <body> is already `flex min-h-full flex-col`, so the flex-1 wrapper
 * is what pins the footer to the bottom on short pages.
 */
export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <div className="flex flex-1 flex-col">{children}</div>
      <SiteFooter />
    </>
  );
}
