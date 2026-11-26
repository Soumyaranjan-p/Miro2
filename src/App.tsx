import { NotchProvider } from "./app/model";
import Notch from "./notch/Notch";

export default function App() {
  return (
    <NotchProvider>
      <Notch />
    </NotchProvider>
  );
}
