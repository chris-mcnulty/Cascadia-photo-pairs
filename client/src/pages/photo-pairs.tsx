import PublicLayout from "@/components/public-layout";
import Home from "./home";

// The Photo Pairs voting experience is the primary landing page.
// PublicLayout provides the single unified header/footer with site-wide
// navigation (including admin links when an admin is logged in), so the
// inner voting header and footer inside Home are suppressed here.
export default function PhotoPairs() {
  return (
    <PublicLayout showHero={false} contentBleed>
      <Home showHeader={false} showFooter={false} />
    </PublicLayout>
  );
}
