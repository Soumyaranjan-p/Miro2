import { useState } from "react";

import { useModel } from "../../app/model";

type ThemeChoice = "dark" | "light" | "system";

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
      </div>
    </div>
  );
}
