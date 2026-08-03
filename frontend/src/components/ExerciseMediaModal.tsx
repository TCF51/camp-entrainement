interface Props {
  name: string;
  imageBase64: string | null;
  videoUrl: string | null;
  onClose: () => void;
}

export default function ExerciseMediaModal({ name, imageBase64, videoUrl, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-xl p-4 max-w-md w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display uppercase tracking-wide text-lg">{name}</h3>
          <button onClick={onClose} className="text-muted hover:text-accent text-xl leading-none">
            ✕
          </button>
        </div>
        {imageBase64 && <img src={imageBase64} alt={name} className="w-full rounded-md mb-3" />}
        {videoUrl && (
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center bg-accent hover:bg-accentSoft transition-colors text-bg font-semibold rounded-md py-2"
          >
            ▶ Voir la video explicative
          </a>
        )}
        {!imageBase64 && !videoUrl && (
          <p className="text-muted text-sm">Aucune photo ou video disponible pour cet exercice.</p>
        )}
      </div>
    </div>
  );
}
