import React from "react";
import ReactDOM from "react-dom/client";
import { isMobileDevice } from "./mobile/isMobileDevice";

async function bootstrap() {
  const root = document.getElementById("root");
  if (!root) {
    return;
  }

  if (isMobileDevice()) {
    await import("./mobile/mobile.css");
    const { default: MobileApp } = await import("./mobile/MobileApp");
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <MobileApp />
      </React.StrictMode>
    );
    return;
  }

  await import("./styles.css");
  const { default: App } = await import("./App");
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

void bootstrap();
