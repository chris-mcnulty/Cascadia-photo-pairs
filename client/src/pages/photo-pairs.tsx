import PublicLayout from "@/components/public-layout";
import Home from "./home";

// The Photo Pairs voting experience lives at /photo-pairs.
// We wrap the existing voting Home page with the public site's top nav so
// the chrome stays consistent across the rest of chrismcnulty.net. The
// voting page renders its own internal header below.
export default function PhotoPairs() {
  return (
    <PublicLayout showHero={false} contentBleed>
      <Home />
    </PublicLayout>
  );
}
