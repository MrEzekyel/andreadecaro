import React, { createContext, useContext } from "react";

export type SettingsPage =
  | "root"
  | "categories"
  | "limits"
  | "recurring"
  | "people"
  | "friends"
  | "automations"
  | "export"
  | "subscription"
  | "referral"
  | "changelog"
  | "guide";

type Nav = {
  /** Porta alla scheda Impostazioni gia' aperta su una sua sottopagina. */
  openSettings: (page: SettingsPage) => void;
  /** Apre il foglio "Nuovo introito", lo stesso che apre il tasto centrale
   *  della tabbar quando la scheda Movimenti e' su Entrate — gli introiti
   *  non vivono piu' dentro Impostazioni, quindi "aggiungine uno" e'
   *  un'azione diretta e non piu' una pagina da raggiungere. */
  openAddIncome: () => void;
};

const NavContext = createContext<Nav>({
  openSettings: () => {},
  openAddIncome: () => {},
});

export const NavProvider = NavContext.Provider;

/**
 * Le poche navigazioni che attraversano le schede — dal riquadro del limite
 * in Home alla pagina dei limiti in Impostazioni — passano di qui invece che
 * da una catena di props che toccherebbe schermate a cui non interessa.
 */
export function useNav() {
  return useContext(NavContext);
}
