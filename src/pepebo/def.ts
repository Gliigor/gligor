import { GameDef } from "@/games/net";
import { botName } from "@/pepudo/bot";
import { Action, GameState, MAX_PLAYERS, addPlayer, apply, newGame, removePlayer, viewFor } from "./engine";
import { botMove, safeMove } from "./bot";

export const pepebo: GameDef<GameState, Action> = {
  id: "pepebo",
  maxPlayers: MAX_PLAYERS,
  create: newGame,
  addPlayer,
  removePlayer,
  apply,
  viewFor,
  hostOnly: ["start", "config"],
  toMove: (s) => (s.phase === "playing" ? s.turn : null),
  botMove,
  safeMove,
  botName,
  botDelay: () => 650 + Math.random() * 500,
};
