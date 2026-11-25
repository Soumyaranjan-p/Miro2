import { isTauri } from "./ipc/client";
import LiveNotch from "./notch/LiveNotch";
import Preview from "./preview/Preview";

export default function App() {
  return isTauri ? <LiveNotch /> : <Preview />;
}
