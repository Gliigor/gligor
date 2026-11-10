import { GameDef } from "@/games/net";
import { Action, GameState, MAX_PLAYERS, addPlayer, apply, newGame, removePlayer, viewFor, waitingOn } from "./engine";
import { botMove, botName, safeMove } from "./bot";

export const pepe7: GameDef<GameState, Action> = {
  id: "pepe7",
  maxPlayers: MAX_PLAYERS,
  create: newGame,
  addPlayer,
  removePlayer,
  apply,
  viewFor,
  hostOnly: ["start", "config"],
  toMove: waitingOn,
  botMove,
  safeMove,
  botName,
  botDelay: () => 800 + Math.random() * 700,
};
