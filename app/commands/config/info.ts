import * as net from "net";
import { RedisEntry } from "../../types";
import { server } from "../../main";

/**
 * INFO command – replication section.
 * Now returns:
 *   role:<master|slave>
 *   master_replid:<40‑char id>      (master only in this stage)
 *   master_repl_offset:0            (master only – starts at 0)
 *
 * Encoded as a RESP bulk string.
 */

const REPL_ID = "8371b4fb1155b71f4a04d3e1bc3e18c4a990aeeb"; // 40‑char constant
const REPL_OFFSET = 0;

export default {
    data: {
        name: "info",
        description: "Return information about the server (replication section only)",
    },
    run(connection: net.Socket, args: string[], _Data: Map<string, RedisEntry>, Server: server) {
        // We only care when the first argument is "replication" (case‑insensitive).
        const section = (args[0] ?? "").toLowerCase();

        if (section !== "replication") {
            connection.write("$-1\r\n");
            return;
        }

        const isReplica = process.argv.includes("--replicaof");
        const lines: string[] = [];

        if (isReplica) {
            lines.push("role:slave");
            // Later stages will add more replica‑specific fields.
        } else {
            lines.push("role:master");
            lines.push(`master_replid:${REPL_ID}`);
            lines.push(`master_repl_offset:${REPL_OFFSET}`);
        }

        const payload = lines.join("\r\n");
        connection.write(Server.RESPEncoder({ type: "bulkString", content: payload }));
    },
};

