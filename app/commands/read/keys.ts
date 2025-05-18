import * as net from "net";
import { RedisEntry } from "../../types";
import { server } from "../../main";

/**
 * KEYS command implementation
 * Only pattern supported for now: "*" (return all keys)
 * Responds using the RESP bulk‑array format expected by the tester.
 */
export default {
    data: {
        name: "keys",
        description: "Return all keys matching a pattern (supports only '*')."
    },
    run(connection: net.Socket, args: string[], Data: Map<string, RedisEntry>, Server: server) {
        // Accept both `KEYS *` and bare `KEYS` (treated as '*').
        const pattern = (args[0] ?? "*").toString();

        if (pattern !== "*") {
            // Pattern matching is out of scope for this stage.
            connection.write(Server.RESPEncoder({ type: "simpleError", content: "ERR only '*' pattern supported" }));
            return;
        }

        const keys = Array.from(Data.keys());

        // Build RESP array manually because it's the simplest way and avoids extra dependencies.
        let resp = `*${keys.length}\r\n`;
        for (const key of keys) {
            const byteLen = Buffer.byteLength(key);
            resp += `$${byteLen}\r\n${key}\r\n`;
        }

        connection.write(resp);
    }
};

