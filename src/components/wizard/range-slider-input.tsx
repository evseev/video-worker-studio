"use client";

import { useEffect, useState } from "react";

type RangeSliderInputProps = {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  suffix?: string;
  onChange: (value: number) => void;
};

function clampToRange(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function RangeSliderInput({
  label,
  min,
  max,
  step = 1,
  value,
  suffix,
  onChange,
}: RangeSliderInputProps) {
  const [inputValue, setInputValue] = useState(String(value));

  useEffect(() => {
    setInputValue(String(value));
  }, [value]);

  const displayValue = `${value}${suffix ? ` ${suffix}` : ""}`;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm text-zinc-400">{label}</label>
        <span className="text-xs font-medium text-violet-300">{displayValue}</span>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const next = Number(e.target.value);
            onChange(clampToRange(next, min, max));
            setInputValue(String(next));
          }}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/10 accent-violet-500"
          aria-label={label}
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            const next = Number(e.target.value);
            if (!Number.isNaN(next)) {
              onChange(clampToRange(next, min, max));
            }
          }}
          onBlur={() => {
            const parsed = Number(inputValue);
            const next = Number.isNaN(parsed) ? value : clampToRange(parsed, min, max);
            setInputValue(String(next));
            onChange(next);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const parsed = Number(inputValue);
              const next = Number.isNaN(parsed) ? value : clampToRange(parsed, min, max);
              setInputValue(String(next));
              onChange(next);
            }
          }}
          className="w-24 rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white focus:border-violet-500/50 focus:outline-none"
        />
      </div>
    </div>
  );
}
