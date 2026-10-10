/**
 * Renders a post body written as plain text: blank-line-separated
 * paragraphs, with "## " starting a heading. Text is rendered by React
 * (escaped) — no HTML is ever interpreted, so admin-entered content
 * can't inject markup.
 */
export function PostBody({ body }: { body: string }) {
  const blocks = body.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="grid gap-5 text-base leading-relaxed text-earth-brown/90">
      {blocks.map((block, i) =>
        block.startsWith("## ") ? (
          <h2 key={i} className="mt-4 text-2xl text-charcoal">
            {block.slice(3)}
          </h2>
        ) : (
          <p key={i} className="whitespace-pre-line">
            {block}
          </p>
        )
      )}
    </div>
  );
}
