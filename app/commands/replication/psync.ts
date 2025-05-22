/**
 * Handle PSYNC handshake from a replica.
 *
 * The replica always sends:  PSYNC ? -1
 * We reply: +FULLRESYNC <REPL_ID> 0\r\n
 *
 * <REPL_ID> should be whatever your server advertises in INFO replication.
 * If you haven’t stored it anywhere yet, hard-code the example value from
 * the spec below (you can swap it out later when you add persistence).
 */

import type net from "net";
import { RESPEncoder } from "../../utils/RESPEncoder"; // adjust path if needed
import { RedisEntry } from "../../types";
import { server } from "../../main";

// You almost certainly created this constant in an earlier stage.
// If not, define it here or import it from wherever you keep it.
const REPL_ID = "8371b4fb1155b71f4a04d3e1bc3e18c4a990aeeb";

export default {
  data: {
    name: "psync",
    description: "Initial synchronization request from replicas",
  },

  run(
    connection: net.Socket,
    args: any[], // ["?", "-1"] (ignored for now)
    Data: Map<string, RedisEntry>,
    Server: server,
  ) {
    const reply = `FULLRESYNC ${REPL_ID} 0`;
    connection.write(RESPEncoder({ type: "simpleString", content: reply }));
  },
};
