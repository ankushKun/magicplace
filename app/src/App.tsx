import { PixelCanvas } from "./components/pixel-canvas";
import "./index.css";
import StartUsing from "./components/start-using";
import { SessionBalanceProvider } from "./components/session-balance-provider";

export function App() {
  return (
    <StartUsing>
      <SessionBalanceProvider>
        {/* Main pixel canvas */}
        <PixelCanvas />
      </SessionBalanceProvider>
    </StartUsing>
  );
}

export default App;
