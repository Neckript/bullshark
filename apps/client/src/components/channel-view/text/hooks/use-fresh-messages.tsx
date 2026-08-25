import type { TJoinedMessage } from '@sharkord/shared';
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';

type TFreshMessages = {
  isFresh: (messageId: number) => boolean;
  markPlayed: (messageId: number) => void;
};

const FreshMessagesContext = createContext<TFreshMessages>({
  isFresh: () => false,
  markPlayed: () => {}
});

type TFreshMessagesProviderProps = {
  channelId: number;
  messages: TJoinedMessage[];
  loading: boolean;
  children: ReactNode;
};

/**
 * Décide quels messages ont le droit de jouer leur animation d'entrée.
 *
 * La liste des messages n'est pas virtualisée : c'est un `map` ordinaire, donc
 * un groupe qui se reforme remonte ses enfants et rejouerait l'animation sur
 * des messages déjà lus. On se déclenche donc sur l'IDENTIFIANT et jamais sur
 * le rendu : seuls les identifiants strictement supérieurs à la ligne d'eau
 * sont frais. La pagination ne peut pas les déclencher, puisqu'elle ajoute des
 * identifiants PLUS PETITS.
 */
const FreshMessagesProvider = memo(
  ({ channelId, messages, loading, children }: TFreshMessagesProviderProps) => {
    const watermarkRef = useRef({
      channelId: -1,
      highestId: 0,
      seeded: false
    });
    const [fresh, setFresh] = useState<ReadonlySet<number>>(() => new Set());

    const highestId = messages.reduce(
      (highest, message) => (message.id > highest ? message.id : highest),
      0
    );

    // Mise à jour d'état pendant le rendu : c'est le motif React « ajuster
    // l'état quand une prop change ». Le faire dans un effet peindrait une
    // frame sans la classe, donc le message à sa position finale avant de
    // sauter à l'opacité zéro : un clignotement.
    if (watermarkRef.current.channelId !== channelId) {
      watermarkRef.current = { channelId, highestId: 0, seeded: false };
      if (fresh.size) setFresh(new Set());
    } else if (!loading && !watermarkRef.current.seeded) {
      // Premier lot du salon : il devient la ligne d'eau, sans rien animer.
      watermarkRef.current = { channelId, highestId, seeded: true };
    } else if (
      watermarkRef.current.seeded &&
      highestId > watermarkRef.current.highestId
    ) {
      const previousHighestId = watermarkRef.current.highestId;
      watermarkRef.current = { channelId, highestId, seeded: true };

      setFresh((current) => {
        const next = new Set(current);

        messages.forEach((message) => {
          if (message.id > previousHighestId) next.add(message.id);
        });

        return next;
      });
    }

    const markPlayed = useCallback((messageId: number) => {
      setFresh((current) => {
        if (!current.has(messageId)) return current;

        const next = new Set(current);
        next.delete(messageId);

        return next;
      });
    }, []);

    const value = useMemo<TFreshMessages>(
      () => ({
        isFresh: (messageId: number) => fresh.has(messageId),
        markPlayed
      }),
      [fresh, markPlayed]
    );

    return (
      <FreshMessagesContext.Provider value={value}>
        {children}
      </FreshMessagesContext.Provider>
    );
  }
);

const useFreshMessages = () => useContext(FreshMessagesContext);

export { FreshMessagesProvider, useFreshMessages };
