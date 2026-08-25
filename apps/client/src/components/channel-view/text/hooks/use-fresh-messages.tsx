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
      // Le fournisseur reste monté même quand le salon est vide (sinon le
      // tout premier message d'un salon vide ne serait jamais frais : il
      // n'y aurait personne pour poser la ligne d'eau avant son arrivée).
      // On seed donc DÈS ce rendu de changement de salon si les données sont
      // déjà là : pour un salon avec historique, tout l'historique est
      // absorbé d'un coup (rien n'anime, scénario 1) ; pour un salon vide,
      // la ligne d'eau se pose à 0 et le premier message qui arrive (id > 0)
      // est fresh par construction (scénario 4). Si le changement de salon
      // rend AVANT que les données soient chargées, `seeded` reste false et
      // la branche suivante rattrape dès que `loading` retombe.
      watermarkRef.current = { channelId, highestId, seeded: !loading };
      if (fresh.size) setFresh(new Set());
    } else if (!loading && !watermarkRef.current.seeded) {
      // Filet de sécurité : le rendu de changement de salon est arrivé
      // pendant que `loading` était encore vrai, donc rien n'a été seedé.
      // Ce rendu-ci a maintenant les données : elles deviennent la ligne
      // d'eau, sans rien animer.
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
