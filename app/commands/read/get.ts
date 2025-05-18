import * as net from "net";
import { RedisEntry } from "../../types";
import { server } from "../../main";

/**
 * GET command implementation.
 * Behaviour summary:
 *   • If key is missing OR expired → respond with null bulk string ($-1)               
 *   • If key exists but value is not a string → -ERR wrong type of value              
 *   • Otherwise → bulk string with the stored value                                    
 */
export default {
    data: {
        name: "get",
        description: "Retrieve the string value of a key (honours expiry)",
    },
    run(connection: net.Socket, args: string[], Data: Map<string, RedisEntry>, Server: server) {
        // ── 1. Validate argument count ────────────────────────────────────────────
        if (args.length === 0) {
            connection.write(
                Server.RESPEncoder({
                    type: "simpleError",
                    content: "ERR wrong number of arguments for 'get' command",
                }),
            );
            return;
        }

        const key = args[0];
        const entry = Data.get(key);

        // ── 2. Key not present at all ─────────────────────────────────────────────
        if (!entry) {
            connection.write("$-1\r\n");
            return;
        }

        // ── 3. Key present – check expiration (epoch‑ms). ─────────────────────────
        if (entry.expiration !== undefined && Date.now() >= entry.expiration) {
            // Consider it expired: remove from dataset to mimic Redis’s behaviour.
            Data.delete(key);
            connection.write("$-1\r\n");
            return;
        }

        // ── 4. Type enforcement ───────────────────────────────────────────────────
        if (typeof entry.value !== "string") {
            connection.write(Server.RESPEncoder({ type: "simpleError", content: "ERR wrong type of value" }));
            return;
        }

        // ── 5. Success ────────────────────────────────────────────────────────────
        connection.write(Server.RESPEncoder({ type: "bulkString", content: entry.value }));
    },
};

