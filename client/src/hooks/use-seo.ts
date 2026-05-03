import { useEffect } from "react";

interface SEOOptions {
  title?: string;
  description?: string;
  imageUrl?: string;
}

function setMeta(name: string, content: string, attr: "name" | "property" = "name") {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export function useSEO({ title, description, imageUrl }: SEOOptions) {
  useEffect(() => {
    const baseTitle = "Chris McNulty | Cascadia Oceanic";
    const fullTitle = title ? `${title} | Chris McNulty` : baseTitle;
    if (document.title !== fullTitle) document.title = fullTitle;

    if (description) {
      setMeta("description", description);
      setMeta("og:description", description, "property");
      setMeta("twitter:description", description);
    }
    setMeta("og:title", fullTitle, "property");
    setMeta("twitter:title", fullTitle);
    setMeta("twitter:card", "summary_large_image");
    if (imageUrl) {
      setMeta("og:image", imageUrl, "property");
      setMeta("twitter:image", imageUrl);
    }
  }, [title, description, imageUrl]);
}
