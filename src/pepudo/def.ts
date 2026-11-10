import { GameDef } from "@/games/net";
import { Action, GameState, MAX_PLAYERS, addPlayer, apply, newGame, removePlayer, viewFor } from "./engine";
import { botMove, botName } from "./bot";

export const pepudo: GameDef<GameState, Action> = {
  id: "pepudo",
  maxPlayers: MAX_PLAYERS,
  create: newGame,
  addPlayer,
  removePlayer,
  apply,
  viewFor,
  hostOnly: ["start"],
  toMove: (s) => (s.phase === "bidding" ? s.turn : null),
  botMove,
  safeMove: (s) => (s.bid ? { type: "dudo" } : { type: "bid", qty: 1, face: 2 }),
  botName,
  botDelay: () => 900 + Math.random() * 1300,
};
