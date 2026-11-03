export interface PersonJsonLdProps {
  name: string;
  alternateName?: string;
  description?: string;
  url: string;
}

export function PersonJsonLd({
  name,
  alternateName,
  description,
  url,
}: PersonJsonLdProps) {
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    alternateName,
    description,
    url,
  }).replace(/</g, "\\u003c");

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLd }}
    />
  );
}
