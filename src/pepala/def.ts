import { GameDef } from "@/games/net";
import { Action, GameState, MAX_PLAYERS, addPlayer, animMs, apply, newGame, removePlayer, toMove, viewFor } from "./engine";
import { botMove, botName, safeMove } from "./bot";

export const pepala: GameDef<GameState, Action> = {
  id: "pepala",
  maxPlayers: MAX_PLAYERS,
  create: newGame,
  addPlayer,
  removePlayer,
  apply,
  viewFor,
  hostOnly: ["start", "config"],
  toMove,
  botMove,
  safeMove,
  botName,
  // Let the last move finish playing out on screen before the bot answers.
  botDelay: (s) => animMs(s.anim) + 500 + Math.random() * 600,
};
