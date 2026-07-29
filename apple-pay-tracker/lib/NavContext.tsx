import React, { createContext, useContext } from "react";

export type SettingsPage =
  | "root"
  | "categories"
  | "limits"
  | "recurring"
  | "people"
  | "automations";

type Nav = {
  /** Porta alla scheda Impostazioni gia' aperta su una sua sottopagina. */
  openSettings: (page: SettingsPage) => void;
};

const NavContext = createContext<Nav>({ openSettings: () => {} });

export const NavProvider = NavContext.Provider;

/**
 * Le poche navigazioni che attraversano le schede — dal riquadro del limite
 * in Home alla pagina dei limiti in Impostazioni — passano di qui invece che
 * da una catena di props che toccherebbe schermate a cui non interessa.
 */
export function useNav() {
  return useContext(NavContext);
}
