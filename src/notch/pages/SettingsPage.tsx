import { useEffect, useState } from "react";

import { useModel } from "../../app/model";
import {
  getUsageSettings,
  isTauri,
  setUsageSettings,
} from "../../ipc/client";
import { mockUsageSettings } from "../../ipc/mock";
import type { UsageSettings } from "../../ipc/types";

type ThemeChoice = "dark" | "light" | "system";

const USAGE_PROVIDERS: Array<{ id: string; name: string }> = [
  { id: "zcode", name: "Zcode" },
  { id: "opencode", name: "OpenCode" },
  { id: "claude", name: "Claude Code" },
  { id: "codex", name: "Codex" },
];

function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      className="switch"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      onClick={onChange}
    />
  );
}

export function SettingsPage() {
  const { snapshot } = useModel();
  const [theme, setTheme] = useState<ThemeChoice>(() => {
    const current = document.documentElement.dataset.theme;
    return current === "light" || current === "dark"
      ? current
      : (snapshot.settings.theme as ThemeChoice);
  });
  const [minimal, setMinimal] = useState(snapshot.notch.minimal);
  const [showClockDate, setShowClockDate] = useState(
    snapshot.notch.showClockDate,
  );
  const [hideOnFullscreen, setHideOnFullscreen] = useState(
    snapshot.settings.hideOnFullscreen,
  );
  const [usage, setUsage] = useState<UsageSettings>({ providers: {} });

  useEffect(() => {
    let cancelled = false;
    void (isTauri ? getUsageSettings() : Promise.resolve(mockUsageSettings())).then(
      (loaded) => {
        if (!cancelled) setUsage(loaded);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleProvider = (id: string) => {
    const current = usage.providers[id] ?? { enabled: true, limitOverride: null };
    const next: UsageSettings = {
      providers: {
        ...usage.providers,
        [id]: { ...current, enabled: !current.enabled },
      },
    };
    setUsage(next);
    void setUsageSettings(next);
  };

  const chooseTheme = (next: ThemeChoice) => {
    setTheme(next);
    const resolved =
      next === "system"
        ? window.matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark"
        : next;
    document.documentElement.dataset.theme = resolved;
  };

  return (
    <div className="page settings-page">
      <div className="settings-column">
        <p className="settings-heading t-label">Appearance</p>
        <div className="settings-row">
          <span className="t-body">Theme</span>
          <div className="segmented" role="group" aria-label="Theme">
            {(["dark", "light", "system"] as const).map((choice) => (
              <button
                key={choice}
                type="button"
                aria-pressed={theme === choice}
                onClick={() => chooseTheme(choice)}
              >
                {choice === "dark" ? "Dark" : choice === "light" ? "Light" : "Auto"}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-row">
          <span className="t-body">Minimal notch</span>
          <Switch
            label="Minimal notch"
            checked={minimal}
            onChange={() => setMinimal((value) => !value)}
          />
        </div>
      </div>

      <div className="settings-column">
        <p className="settings-heading t-label">Behaviour</p>
        <div className="settings-row">
          <span className="t-body">Hide in fullscreen</span>
          <Switch
            label="Hide in fullscreen"
            checked={hideOnFullscreen}
            onChange={() => setHideOnFullscreen((value) => !value)}
          />
        </div>
        <div className="settings-row">
          <span className="t-body">Clock &amp; date</span>
          <Switch
            label="Clock and date"
            checked={showClockDate}
            onChange={() => setShowClockDate((value) => !value)}
          />
        </div>
        <div className="settings-row">
          <span className="t-body">AI usage</span>
          <div className="usage-toggles">
            {USAGE_PROVIDERS.map(({ id, name }) => {
              const enabled = (usage.providers[id] ?? { enabled: true }).enabled;
              return (
                <span key={id} className="usage-toggle" title={`${name} usage`}>
                  <Switch
                    label={`${name} usage`}
                    checked={enabled}
                    onChange={() => toggleProvider(id)}
                  />
                  <span className="t-meta usage-toggle-mark" aria-hidden="true">
                    {name.charAt(0)}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
