const clampChannel = (value: number) =>
  Math.max(0, Math.min(255, Math.round(value)));

const rgbToHex = (red: number, green: number, blue: number) =>
  `#${[red, green, blue]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, '0'))
    .join('')}`;

// Windows peint la superposition de la barre de titre à partir d'une couleur
// qu'il sait lire ; nos jetons sont en oklch. getComputedStyle ne suffit pas :
// Chromium ne garantit pas de sérialiser une couleur oklch en rgb(), il peut
// rendre oklab() ou color(). Peindre un pixel puis le relire donne le sRGB
// exact, quelle que soit la sérialisation du moteur.
const tokenToHex = (token: string): string | null => {
  try {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(token)
      .trim();

    if (!value) return null;

    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;

    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!context) return null;

    context.fillStyle = '#000000';
    context.fillStyle = value;

    // fillStyle refuse silencieusement une valeur illisible et garde la
    // précédente : le noir de repli signale alors une couleur non comprise.
    context.fillRect(0, 0, 1, 1);

    const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;

    return rgbToHex(red!, green!, blue!);
  } catch {
    // Un canevas peut être refusé par un navigateur durci ; la barre de titre
    // gardera simplement ses couleurs provisoires.
    return null;
  }
};

export { rgbToHex, tokenToHex };
