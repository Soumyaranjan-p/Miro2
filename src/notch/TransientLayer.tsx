import { useCallback, useEffect, useRef, useState } from "react";

import { useModel } from "../app/model";
import { ChargingIcon, HeadphonesIcon } from "../ui/icons";

interface TransientBase {
  id: number;
}

interface ChargingTransient extends TransientBase {
  kind: "charging";
  batteryPercent: number | null;
}

interface BluetoothTransient extends TransientBase {
  kind: "bt-connect" | "bt-disconnect";
  name: string;
  batteryPercent: number | null;
}

type Transient = ChargingTransient | BluetoothTransient;

/** Omit must distribute over the union or the kind-specific keys vanish. */
type TransientInput = Omit<ChargingTransient, "id"> | Omit<BluetoothTransient, "id">;

/** Long enough to read, short enough to never feel like an interruption. */
const CHARGING_MS = 2_600;
const BLUETOOTH_MS = 3_000;
const EXIT_MS = 200;

const ttl = (transient: Transient) =>
  transient.kind === "charging" ? CHARGING_MS : BLUETOOTH_MS;

/**
 * Transient states, not pages: the charger being plugged in and Bluetooth
 * audio devices coming and going play a short animation inside the notch and
 * dismiss themselves. The layer is pointer-events: none, so it can never
 * block whatever the user is doing; events queue and play one at a time.
 * Enter and exit take the same vertical path (§7), exit is faster than enter,
 * and reduced motion swaps the movement for a cross-fade in CSS.
 */
export function TransientLayer() {
  const { power, bluetooth, phase } = useModel();
  const [current, setCurrent] = useState<Transient | null>(null);
  const [leaving, setLeaving] = useState(false);

  const queueRef = useRef<Transient[]>([]);
  const idRef = useRef(0);
  const currentRef = useRef<Transient | null>(null);
  const busyRef = useRef(false);
  const timerRef = useRef(0);
  const dismissRef = useRef<() => void>(() => undefined);
  const prevChargingRef = useRef<boolean | null>(null);
  const prevDevicesRef = useRef<Map<string, string> | null>(null);
  const previewPushedRef = useRef(false);

  /** Exit the current card along its entry path, then show the next one. */
  const dequeueAndShow = useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => {
      setLeaving(false);
      const next = queueRef.current.shift() ?? null;
      currentRef.current = next;
      setCurrent(next);
      if (next) {
        timerRef.current = window.setTimeout(() => dismissRef.current(), ttl(next));
      } else {
        busyRef.current = false;
      }
    }, EXIT_MS);
  }, []);

  const dismiss = useCallback(() => {
    window.clearTimeout(timerRef.current);
    dequeueAndShow();
  }, [dequeueAndShow]);

  useEffect(() => {
    dismissRef.current = dismiss;
  }, [dismiss]);

  const enqueue = useCallback(
    (transient: TransientInput) => {
      queueRef.current.push({ ...transient, id: ++idRef.current } as Transient);
      if (busyRef.current) return;
      busyRef.current = true;
      dequeueAndShow();
    },
    [dequeueAndShow],
  );

  // Charger transitions. The first read never animates: plugging in before
  // Miro starts is not an event, it is just the state of the machine.
  useEffect(() => {
    const charging = power?.charging ?? false;
    const prev = prevChargingRef.current;
    prevChargingRef.current = charging;
    if (prev === null || prev === charging || !charging) return;
    enqueue({ kind: "charging", batteryPercent: power?.batteryPercent ?? null });
  }, [power, enqueue]);

  // Bluetooth audio devices coming and going, diffed by endpoint id.
  useEffect(() => {
    const devices = bluetooth?.devices ?? [];
    const prev = prevDevicesRef.current;
    prevDevicesRef.current = new Map(
      devices.map((device) => [device.id, device.name]),
    );
    if (!prev) return;

    for (const device of devices) {
      if (!prev.has(device.id)) {
        enqueue({
          kind: "bt-connect",
          name: device.name,
          batteryPercent: device.batteryPercent,
        });
      }
    }
    for (const [id, name] of prev) {
      if (!prevDevicesRef.current.has(id)) {
        enqueue({ kind: "bt-disconnect", name, batteryPercent: null });
      }
    }
  }, [bluetooth, enqueue]);

  // Preview deep link: ?transient=charging|bt-connect|bt-disconnect plays
  // one event on load so the motion can be reviewed in a browser tab.
  useEffect(() => {
    if (!import.meta.env.DEV || previewPushedRef.current) return;
    previewPushedRef.current = true;
    const kind = new URLSearchParams(window.location.search).get("transient");
    if (kind === "charging") {
      enqueue({ kind: "charging", batteryPercent: 76 });
    } else if (kind === "bt-connect") {
      enqueue({ kind: "bt-connect", name: "Pixel Buds Pro", batteryPercent: 68 });
    } else if (kind === "bt-disconnect") {
      enqueue({ kind: "bt-disconnect", name: "Pixel Buds Pro", batteryPercent: null });
    }
  }, [enqueue]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  if (!current) return null;

  return (
    <div
      className="transient"
      data-phase={phase}
      data-leaving={leaving || undefined}
      role="status"
      aria-live="polite"
    >
      {current.kind === "charging" ? (
        <div className="transient-card" data-kind="charging">
          <span className="transient-well" aria-hidden="true">
            <ChargingIcon />
          </span>
          <span className="transient-copy">
            <span className="t-body transient-title">Charging</span>
            <span className="t-label transient-sub tnum">
              {current.batteryPercent == null
                ? "Plugged in"
                : `${current.batteryPercent}% battery`}
            </span>
          </span>
          {current.batteryPercent != null && (
            <span className="transient-batt" aria-hidden="true">
              <span
                className="transient-batt-fill"
                style={{ width: `${current.batteryPercent}%` }}
              />
            </span>
          )}
        </div>
      ) : (
        <div
          className="transient-card"
          data-kind={current.kind}
          data-muted={current.kind === "bt-disconnect" || undefined}
        >
          <span className="transient-well" aria-hidden="true">
            <HeadphonesIcon />
          </span>
          <span className="transient-copy">
            <span className="t-body transient-title">{current.name}</span>
            <span className="t-label transient-sub tnum">
              {current.kind === "bt-connect"
                ? current.batteryPercent != null
                  ? `Connected · ${current.batteryPercent}%`
                  : "Connected"
                : "Disconnected"}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
