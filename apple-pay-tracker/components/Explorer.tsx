import React, { useCallback, useState } from "react";
import DetailScreen, { DetailTarget } from "../screens/DetailScreen";
import TransactionDetailScreen from "../screens/TransactionDetailScreen";
import { Payment } from "../lib/types";

type Frame =
  | { kind: "payment"; payment: Payment }
  | { kind: "detail"; target: DetailTarget };

/**
 * Piccolo stack di navigazione per l'esplorazione dei dettagli.
 *
 * Da una spesa si arriva all'esercente e da li' a un'altra spesa: senza uno
 * stack il tasto indietro riporterebbe alla radice invece che al passo
 * precedente, perdendo il filo di quello che si stava guardando.
 */
export function useExplorer(onChanged: () => void) {
  const [frames, setFrames] = useState<Frame[]>([]);

  const openPayment = useCallback((payment: Payment) => {
    setFrames((current) => [...current, { kind: "payment", payment }]);
  }, []);

  const openDetail = useCallback((target: DetailTarget) => {
    setFrames((current) => [...current, { kind: "detail", target }]);
  }, []);

  const back = useCallback(() => {
    setFrames((current) => current.slice(0, -1));
  }, []);

  const top = frames[frames.length - 1];

  const overlay = !top ? null : top.kind === "payment" ? (
    <TransactionDetailScreen
      payment={top.payment}
      onBack={back}
      onChanged={onChanged}
      onOpenMerchant={(id, title) =>
        openDetail({ kind: "merchant", id, title })
      }
    />
  ) : (
    <DetailScreen
      target={top.target}
      onBack={back}
      onOpenPayment={openPayment}
    />
  );

  return { overlay, openPayment, openDetail, isOpen: frames.length > 0 };
}
