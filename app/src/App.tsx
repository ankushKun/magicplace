import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PixelCanvas } from "./components/pixel-canvas";
import "./index.css";

export function App() {
  return (
    <>
      {/* Wallet button overlay */}
      {/* <div className="absolute top-4 right-4 z-50">
        <WalletMultiButton />
      </div> */}
      
      {/* Main pixel canvas */}
      <PixelCanvas />
    </>
  );
}

export default App;
