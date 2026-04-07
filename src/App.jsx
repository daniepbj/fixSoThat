import FeatureHello from "./components/FeatureHello";
import AppLinks from "./components/AppLinks";

export default function App() {
  return (
    <main className="page-shell" style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      <FeatureHello />
      <AppLinks />
    </main>
  );
}
