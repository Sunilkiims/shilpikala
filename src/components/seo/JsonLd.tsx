type JsonLdProps = {
  data: object;
};

/**
 * Renders a single JSON-LD <script> tag. Escapes `<` so content
 * containing something like `</script>` (e.g. inside a review body)
 * can never break out of the script tag — standard practice for
 * embedding untrusted strings (review text) in JSON-LD.
 */
export function JsonLd({ data }: JsonLdProps) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
  );
}
