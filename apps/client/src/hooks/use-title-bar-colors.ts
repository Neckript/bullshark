import { tokenToHex } from '@/helpers/token-to-hex';
import { useEffect } from 'react';

// Le shell desktop peint la superposition de la barre de titre avec une
// couleur figée à la construction de la fenêtre. Bullshark a cinq thèmes plus
// un thème sur mesure : sans cette annonce, les boutons du système jureraient
// avec quatre thèmes sur cinq.
const useTitleBarColors = () => {
  useEffect(() => {
    if (!window.bullshark?.isDesktop) return;

    const publish = () => {
      const color = tokenToHex('--card');
      const symbolColor = tokenToHex('--foreground');

      if (!color || !symbolColor) return;

      window.bullshark?.setTitleBarColors?.({ color, symbolColor });
    };

    publish();

    // Le thème vit dans les classes de <html> (`dark`, `theme-*`) et le thème
    // sur mesure dans son attribut de style : observer les deux attributs
    // couvre tous les changements de thème sans connaître leur mécanique.
    const observer = new MutationObserver(publish);

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style']
    });

    return () => observer.disconnect();
  }, []);
};

export { useTitleBarColors };
