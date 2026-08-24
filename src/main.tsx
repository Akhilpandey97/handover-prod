import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const rootElement = document.getElementById("root");

const showBootError = () => {
	if (!rootElement || rootElement.dataset.appMounted === "true") return;
	rootElement.innerHTML = "<div style=\"min-height:100vh;display:grid;place-items:center;padding:24px;text-align:center;font-family:Georgia,serif;color:#17324d\"><div><h1>Handover could not load</h1><p>Refresh the page to try again.</p></div></div>";
};

try {
	if (!rootElement) throw new Error("Root element is missing");
	rootElement.dataset.appMounted = "true";
	createRoot(rootElement).render(<App />);
} catch (error) {
	console.error("Application boot failed:", error);
	if (rootElement) {
		delete rootElement.dataset.appMounted;
		showBootError();
	}
}
