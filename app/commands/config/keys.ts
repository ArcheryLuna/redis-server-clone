import * as net from "net";
import { RedisEntry } from "../../types";
import { server } from "../../main";

/**
 * KEYS command implementation
 * Only pattern supported for now: "*" (return all keys)
 * Responds using the RESP bulk-array format expected by the tester.
 */
export default {
    data: {
        name: "get",
        description: "Retrieve the string value of a key",
    },
    run(connection: net.Socket, args: string[], Data: Map<string, RedisEntry>, Server: server) {
        if (args.length === 0) {
            connection.write(Server.RESPEncoder({ type: "simpleError", content: "ERR wrong number of arguments for 'get' command" }));
            return;
        }

        const key = args[0];
        const entry = Data.get(key);

        if (!entry) {
            // Non‑existent key → null bulk string
            connection.write("$-1\r\n");
            return;
        }

        const value = entry.value;
        if (typeof value !== "string") {
            connection.write(Server.RESPEncoder({ type: "simpleError", content: "ERR wrong type of value" }));
            return;
        }

        connection.write(Server.RESPEncoder({ type: "bulkString", content: value }));
    },
};

