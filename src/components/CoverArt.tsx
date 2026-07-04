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
      className={`relative overflow-hidden rounded-[8px] border border-white/75 bg-[#82b7eb]/28 shadow-[0_4px_8px_rgba(73,78,55,0.12)] ${
        compact ? "aspect-[4/3]" : "aspect-[3/4]"
      }`}
      style={{
        backgroundImage: coverUrl
          ? `linear-gradient(180deg, rgba(255,255,247,0.08), rgba(47,51,40,0.32)), url(${coverUrl})`
          : "linear-gradient(145deg, rgba(130,183,235,0.70), rgba(243,255,155,0.74) 48%, rgba(255,255,247,0.92))",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,247,0)_36%,rgba(47,51,40,0.66)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 p-4 text-white">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#f3ff9b]">
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
