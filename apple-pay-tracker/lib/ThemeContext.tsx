import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";
import { darkPalette, lightPalette, Palette } from "./theme";

export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "theme-preference";

type ThemeContextValue = {
  palette: Palette;
  dark: boolean;
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === "light" || stored === "dark" || stored === "system") {
        setPreferenceState(stored);
      }
    });
  }, []);

  const setPreference = useCallback((value: ThemePreference) => {
    setPreferenceState(value);
    AsyncStorage.setItem(STORAGE_KEY, value);
  }, []);

  const dark =
    preference === "system" ? systemScheme === "dark" : preference === "dark";

  const value = useMemo<ThemeContextValue>(
    () => ({
      palette: dark ? darkPalette : lightPalette,
      dark,
      preference,
      setPreference,
    }),
    [dark, preference, setPreference]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme deve essere usato dentro <ThemeProvider>");
  }
  return context;
}
