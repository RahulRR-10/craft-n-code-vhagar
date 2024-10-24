import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    server: {
        host: "0.0.0.0", // This allows access from your network
        port: 3000, // Optional: set the port (default is 5173)
    },
});
