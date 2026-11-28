import { useEffect, useRef, useState } from "react";

import { setUsageSettings } from "../ipc/client";
import type { DockSide, ProviderSetting, UsageSettings } from "../ipc/types";
import { PROVIDER_META } from "./meta";

interface SettingsPanelProps {
  settings: UsageSettings;
  visible: boolean;
  onClose: () => void;
}

const LOCAL_PROVIDERS = ["zcode", "opencode", "claude", "codex"];

/**
 * Provider toggles, per-provider limits, and dock side. Updates are
 * optimistic locally and persisted through `usage_settings_set`; the Rust
 * thread picks them up on its next tick.
 */
export function SettingsPanel({ settings, visible, onClose }: SettingsPanelProps) {
  return (
    <div
      className="dock-settings"
      data-visible={visible || undefined}
      aria-hidden={!visible}
    >
      <div className="dock-settings-head">
        <span className="dock-pop-title">Usage settings</span>
        <button type="button" className="dock-close" aria-label="Close settings" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="dock-settings-row">
        <span className="dock-settings-label">Dock side</span>
        <div className="dock-seg" role="radiogroup" aria-label="Dock side">
          {(["left", "right"] as DockSide[]).map((side) => (
            <button
              key={side}
              type="button"
              role="radio"
              aria-checked={settings.dockSide === side}
              onClick={() => update({ ...settings, dockSide: side })}
            >
              {side === "left" ? "Left" : "Right"}
            </button>
          ))}
        </div>
      </div>

      {LOCAL_PROVIDERS.map((id) => {
        const meta = PROVIDER_META[id];
        const provider = settings.providers[id] ?? { enabled: true, limitOverride: null };
        return (
          <ProviderRow
            key={id}
            name={meta.name}
            setting={provider}
            onChange={(next) =>
              update({
                ...settings,
                providers: { ...settings.providers, [id]: next },
              })
            }
          />
        );
      })}

      <div className="dock-settings-row">
        <span className="dock-settings-label">Devin</span>
        <span className="dock-settings-note">Cloud — skipped</span>
      </div>
    </div>
  );
}

function ProviderRow({
  name,
  setting,
  onChange,
}: {
  name: string;
  setting: ProviderSetting;
  onChange: (next: ProviderSetting) => void;
}) {
  const [limitText, setLimitText] = useState(
    setting.limitOverride === null ? "" : String(setting.limitOverride),
  );

  // Keep the field in sync when an override is cleared from elsewhere.
  const lastOverride = useRef(setting.limitOverride);
  useEffect(() => {
    if (setting.limitOverride !== lastOverride.current) {
      lastOverride.current = setting.limitOverride;
      setLimitText(setting.limitOverride === null ? "" : String(setting.limitOverride));
    }
  }, [setting.limitOverride]);

  const commitLimit = () => {
    const parsed = Number(limitText.replace(/[^0-9]/g, ""));
    lastOverride.current = limitText.trim() === "" ? null : parsed;
    onChange({
      ...setting,
      limitOverride: limitText.trim() === "" || Number.isNaN(parsed) ? null : parsed,
    });
  };

  return (
    <div className="dock-settings-provider">
      <button
        type="button"
        className="dock-switch"
        role="switch"
        aria-checked={setting.enabled}
        aria-label={`Toggle ${name}`}
        onClick={() => onChange({ ...setting, enabled: !setting.enabled })}
      >
        <span className="dock-switch-knob" />
      </button>
      <span className="dock-settings-label">{name}</span>
      <input
        className="dock-limit tnum"
        inputMode="numeric"
        placeholder="Auto"
        value={limitText}
        aria-label={`${name} token limit`}
        onChange={(event) => setLimitText(event.target.value)}
        onBlur={commitLimit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        disabled={!setting.enabled}
      />
    </div>
  );
}

function update(settings: UsageSettings): void {
  void setUsageSettings(settings);
}
