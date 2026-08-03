import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import { resizeImageFile } from "../lib/image";
import { CATEGORY_CATALOG, EQUIPMENT_CATALOG } from "../lib/equipment";

export interface Exercise {
  id: string;
  name: string;
  description: string | null;
  unit: "REPS" | "SECONDS";
  category?: string | null;
  equipment?: string | null;
  isCustom: boolean;
}

interface Props {
  selected: string[];
  onChange: (ids: string[]) => void;
}

export default function ExercisePicker({ selected, onChange }: Props) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [customUnit, setCustomUnit] = useState<"REPS" | "SECONDS">("REPS");
  const [customCategory, setCustomCategory] = useState("");
  const [customEquipment, setCustomEquipment] = useState<string[]>([]);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [customVideoUrl, setCustomVideoUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function load() {
    api.get<Exercise[]>("/exercises").then(setExercises);
  }
  useEffect(load, []);

  const filtered = useMemo(
    () =>
      exercises.filter(
        (e) =>
          e.name.toLowerCase().includes(search.toLowerCase()) && (!categoryFilter || e.category === categoryFilter)
      ),
    [exercises, search, categoryFilter]
  );

  function toggle(id: string) {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  }

  function toggleEquipment(key: string) {
    setCustomEquipment((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function onImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await resizeImageFile(file, 400);
    setCustomImage(dataUrl);
  }

  async function addCustom() {
    if (!customName.trim()) return;
    const created = await api.post<Exercise>("/exercises", {
      name: customName.trim(),
      description: customDescription.trim() || undefined,
      unit: customUnit,
      category: customCategory || undefined,
      equipment: customEquipment.length > 0 ? customEquipment : undefined,
      imageBase64: customImage || undefined,
      videoUrl: customVideoUrl.trim() || undefined,
    });
    setExercises((prev) => [...prev, created]);
    onChange([...selected, created.id]);
    setCustomName("");
    setCustomDescription("");
    setCustomCategory("");
    setCustomEquipment([]);
    setCustomImage(null);
    setCustomVideoUrl("");
    setShowCustomForm(false);
  }

  return (
    <div>
      <input
        placeholder="Rechercher un exercice..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-surface2 border border-border rounded-md px-3 py-2 mb-2"
      />

      <div className="flex flex-wrap gap-1.5 mb-3">
        <button
          type="button"
          onClick={() => setCategoryFilter(null)}
          className={`text-xs px-2.5 py-1 rounded-full border ${
            !categoryFilter ? "bg-accent/20 border-accent text-text" : "bg-surface2 border-border text-muted"
          }`}
        >
          Tous
        </button>
        {CATEGORY_CATALOG.map((c) => (
          <button
            type="button"
            key={c.key}
            onClick={() => setCategoryFilter(c.key)}
            className={`text-xs px-2.5 py-1 rounded-full border ${
              categoryFilter === c.key ? "bg-accent/20 border-accent text-text" : "bg-surface2 border-border text-muted"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1 mb-3">
        {filtered.map((exo) => {
          const isSelected = selected.includes(exo.id);
          return (
            <button
              type="button"
              key={exo.id}
              onClick={() => toggle(exo.id)}
              className={`text-left border rounded-md px-3 py-2 transition-colors ${
                isSelected ? "bg-accent/15 border-accent text-text" : "bg-surface2 border-border text-muted hover:text-text"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{exo.name}</span>
                <span className="text-[10px] font-mono uppercase text-muted">
                  {exo.unit === "REPS" ? "reps" : "sec"}
                </span>
              </div>
              {exo.description && <p className="text-xs text-muted mt-0.5 truncate">{exo.description}</p>}
            </button>
          );
        })}
      </div>

      {!showCustomForm ? (
        <button
          type="button"
          onClick={() => setShowCustomForm(true)}
          className="text-sm text-accent hover:text-accentSoft"
        >
          + Ajouter un exercice qui n'est pas dans la liste
        </button>
      ) : (
        <div className="bg-surface2 border border-border rounded-md p-3 space-y-2">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs text-muted mb-1">Nom de l'exercice</label>
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full bg-surface border border-border rounded-md px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Unite</label>
              <select
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value as "REPS" | "SECONDS")}
                className="bg-surface border border-border rounded-md px-2 py-1.5 text-sm"
              >
                <option value="REPS">Répétitions</option>
                <option value="SECONDS">Secondes (durée tenue)</option>
              </select>
            </div>
          </div>

          <div className="w-full">
            <label className="block text-xs text-muted mb-1">Description (optionnel)</label>
            <input
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              placeholder="Ex : bras tendus, dos droit..."
              className="w-full bg-surface border border-border rounded-md px-2 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Categorie (optionnel)</label>
            <select
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              className="w-full bg-surface border border-border rounded-md px-2 py-1.5 text-sm"
            >
              <option value="">Non precisee</option>
              {CATEGORY_CATALOG.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Materiel necessaire (optionnel)</label>
            <div className="flex flex-wrap gap-1">
              {EQUIPMENT_CATALOG.map((eq) => (
                <button
                  type="button"
                  key={eq.key}
                  onClick={() => toggleEquipment(eq.key)}
                  className={`text-[11px] px-2 py-1 rounded border ${
                    customEquipment.includes(eq.key)
                      ? "bg-accent/20 border-accent text-text"
                      : "bg-surface border-border text-muted"
                  }`}
                >
                  {eq.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="block text-xs text-muted mb-1">Photo (optionnel)</label>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={onImageChange} className="hidden" id="exoImage" />
              <label
                htmlFor="exoImage"
                className="inline-block cursor-pointer bg-surface hover:bg-border transition-colors border border-border rounded-md px-2 py-1.5 text-xs"
              >
                {customImage ? "Photo ajoutee ✓" : "Choisir une photo"}
              </label>
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs text-muted mb-1">Lien video (optionnel)</label>
              <input
                value={customVideoUrl}
                onChange={(e) => setCustomVideoUrl(e.target.value)}
                placeholder="https://youtube.com/..."
                className="w-full bg-surface border border-border rounded-md px-2 py-1.5 text-xs"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={addCustom}
              className="bg-accent text-bg font-semibold rounded-md px-3 py-1.5 text-sm"
            >
              Ajouter
            </button>
            <button type="button" onClick={() => setShowCustomForm(false)} className="text-muted text-sm px-2">
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
