import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import App from "./App";

const hellTheme = createTheme({
  cssVariables: true,
  palette: {
    mode: "dark",
    primary: { main: "#e24d35", contrastText: "#ffffff" },
    secondary: { main: "#e24d35", contrastText: "#e24d35" },
    error: { main: "#e24d35" },
    background: { default: "#0d0909", paper: "#2d1c1a" },
    text: { primary: "#f6ead8", secondary: "#cdbeb2" }
  },
  shape: { borderRadius: 8 },
  typography: { fontFamily: '"Segoe UI", "Helvetica Neue", Helvetica, sans-serif' }
});

const darkTheme = createTheme({
  cssVariables: true,
  palette: {
    mode: "dark",
    primary: { main: "#66bb6a", contrastText: "#102a13" },
    secondary: { main: "#81c784", contrastText: "#102a13" },
    error: { main: "#ef6c6c" },
    background: { default: "#121212", paper: "#242424" },
    text: { primary: "#f1f1f1", secondary: "#bdbdbd" }
  },
  shape: { borderRadius: 8 },
  typography: { fontFamily: '"Segoe UI", "Helvetica Neue", Helvetica, sans-serif' }
});

const lightTheme = createTheme({
  cssVariables: true,
  palette: {
    mode: "light",
    primary: { main: "#1976d2", contrastText: "#ffffff" },
    secondary: { main: "#1976d2", contrastText: "#ffffff" },
    error: { main: "#b42318" },
    background: { default: "#f3f6fb", paper: "#ffffff" },
    text: { primary: "#172b4d", secondary: "#52657a" }
  },
  shape: { borderRadius: 8 },
  typography: { fontFamily: '"Segoe UI", "Helvetica Neue", Helvetica, sans-serif' }
});

function PlaygroundRoot() {
  const [themeMode, setThemeMode] = useState<"hell" | "dark" | "light">("hell");
  const theme = themeMode === "hell" ? hellTheme : themeMode === "dark" ? darkTheme : lightTheme;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App themeMode={themeMode} onThemeToggle={setThemeMode} />
    </ThemeProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PlaygroundRoot />
  </StrictMode>
);
