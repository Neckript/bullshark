type TFailureDecision = 'forget' | 'retry';

// Le serveur rejette un jeton invalide dans createContext
// (apps/server/src/utils/wss.ts) et ferme la socket sans envoyer d'erreur
// tRPC : le client ne reçoit qu'un événement WebSocket nu, sans `data`. Ce
// prédicat ne reconnaît donc QUE le refus explicite d'une procédure, jamais le
// refus au niveau de la connexion.
const isAuthenticationError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'data' in error &&
  typeof (error as { data?: { code?: string } }).data?.code === 'string' &&
  (error as { data: { code: string } }).data.code === 'UNAUTHORIZED';

// Décide du sort de la session après un échec de connexion.
//
// L'erreur seule ne suffit pas : un jeton refusé et un serveur injoignable
// produisent le même objet, `TRPCClientError` avec `message: 'Unknown error'`
// et un événement WebSocket en `cause`. La joignabilité du serveur est ce qui
// les sépare. Si /info répond, le serveur est debout et nous a quand même
// refusés : c'est le jeton, pas le réseau, et faire patienter l'utilisateur
// devant « connexion automatique » ne changera rien. S'il ne répond pas, c'est
// le cas que la session persistante protège - serveur qui redémarre, machine
// qui se réveille, réseau qui change - et il faut réessayer.
const decideAfterConnectFailure = (
  error: unknown,
  serverReachable: boolean
): TFailureDecision =>
  isAuthenticationError(error) || serverReachable ? 'forget' : 'retry';

export { decideAfterConnectFailure, isAuthenticationError };
export type { TFailureDecision };
