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
      className={`cover-art ${compact ? "cover-art--compact" : "cover-art--portrait"}`}
      style={{
        backgroundImage: coverUrl
          ? `linear-gradient(180deg, rgba(255,255,247,0.08), rgba(47,51,40,0.32)), url(${coverUrl})`
          : "linear-gradient(145deg, rgba(130,183,235,0.70), rgba(243,255,155,0.74) 48%, rgba(255,255,247,0.92))",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="cover-art__overlay" />
      <div className="cover-art__copy">
        <p className="cover-art__brand">
          Meloday
        </p>
        <h3
          className={`cover-art__title ${compact ? "cover-art__title--compact" : ""}`}
        >
          {title}
        </h3>
        {summary ? (
          <p className="cover-art__summary">{summary}</p>
        ) : null}
      </div>
    </div>
  );
}
