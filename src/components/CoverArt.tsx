"use client";

type CoverArtProps = {
  title: string;
  summary?: string;
  coverUrl?: string;
  compact?: boolean;
};

export function CoverArt({ title, summary, coverUrl, compact = false }: CoverArtProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-[8px] border border-white/70 bg-[#dbe7e3] shadow-sm ${
        compact ? "aspect-[4/3]" : "aspect-[3/4]"
      }`}
      style={{
        backgroundImage: coverUrl
          ? `linear-gradient(180deg, rgba(255,255,255,0.1), rgba(17,32,31,0.28)), url(${coverUrl})`
          : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0)_40%,rgba(24,37,35,0.62)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 p-4 text-white">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/76">
          Meloday
        </p>
        <h3
          className={`mt-1 break-words font-semibold leading-tight tracking-normal ${
            compact ? "text-xl" : "text-3xl"
          }`}
        >
          {title}
        </h3>
        {summary ? (
          <p className="mt-2 line-clamp-2 text-sm leading-5 text-white/88">{summary}</p>
        ) : null}
      </div>
    </div>
  );
}
