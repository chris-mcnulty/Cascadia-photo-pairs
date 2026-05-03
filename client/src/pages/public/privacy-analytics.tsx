import PublicLayout from "@/components/public-layout";
import { useSEO } from "@/hooks/use-seo";

export default function PrivacyAnalytics() {
  useSEO({
    title: "Analytics & Privacy",
    description: "How chrismcnulty.net measures site traffic and what data we keep.",
  });
  return (
    <PublicLayout heroTitle="Analytics & Privacy" showHero>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 prose prose-slate">
        <h2>What we measure</h2>
        <p>
          We log a row for each page you load on chrismcnulty.net so we can see which
          galleries, posts and store items people are looking at. We also count clicks
          on links from our newsletter and social posts so we can tell what content is
          working.
        </p>

        <h2>What we store</h2>
        <ul>
          <li>The page path you viewed and the referring site (e.g. instagram.com)</li>
          <li>UTM tags if your link has them</li>
          <li>A short-lived session id stored in a first-party cookie (<code>cmnAnalyticsSid</code>, 30 minutes)</li>
          <li>
            A daily-rotating one-way hash of your IP + user agent. We do <strong>not</strong>{" "}
            store your raw IP, and the hash is unrecoverable after the day rolls over.
          </li>
          <li>Whether your browser looks like a mobile, tablet, desktop or bot</li>
        </ul>

        <h2>Google Analytics 4</h2>
        <p>
          If GA4 is configured, the same page-view events are also sent to Google
          Analytics for cross-checking. Google's own retention and cookie policies apply
          to that data.
        </p>

        <h2>What we do not do</h2>
        <ul>
          <li>We do not sell your data.</li>
          <li>We do not use third-party advertising trackers.</li>
          <li>We do not link analytics rows to your account beyond the 30-minute session window.</li>
        </ul>

        <h2>Opting out</h2>
        <p>
          Set the standard <em>Do Not Track</em> or <em>Global Privacy Control</em> signal
          in your browser, or use a script blocker. You can also ask us to delete
          analytics rows tied to your session by emailing{" "}
          <a href="mailto:privacy@chrismcnulty.net">privacy@chrismcnulty.net</a>.
        </p>
      </div>
    </PublicLayout>
  );
}
