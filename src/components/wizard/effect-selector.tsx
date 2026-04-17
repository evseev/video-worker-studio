"use client";

import type { EffectOption } from "@/lib/effects";

export function EffectSelector<T extends string>({
  options,
  value,
  onChange,
}: {
  options: EffectOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((option) => {
        const isSelected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              if (!isSelected) onChange(option.id);
            }}
            className={`rounded-lg border p-2 text-left transition-all ${
              isSelected
                ? "border-blue-500 bg-blue-500/10 ring-2 ring-blue-500"
                : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
            }`}
          >
            <div className="text-sm font-medium text-white">{option.label}</div>
            <div className="mt-0.5 text-xs text-gray-400">{option.description}</div>
          </button>
        );
      })}
    </div>
  );
}
