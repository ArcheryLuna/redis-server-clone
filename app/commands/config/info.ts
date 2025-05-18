import * as net from "net";
import { RedisEntry } from "../../types";
import { server, isReplica, options } from "../../main";

/**
 * INFO command – replication section.
 *
 * Master responds with:
 *   role:master\r\n
 *   master_replid:<ID>\r\n
 *   master_repl_offset:<offset>
 *
 * Replica responds with:
 *   role:slave
 *
 * Only the replication subsection is handled at this stage.
 * The payload is returned as a RESP bulk string.
 */

const REPL_ID = "8371b4fb1155b71f4a04d3e1bc3e18c4a990aeeb"; // 40-char fixed ID
const REPL_OFFSET = 0;

export default {
    data: {
        name: "info",
        description: "Return information about the server (replication section only)",
    },

    run(connection: net.Socket, args: string[], _Data: Map<string, RedisEntry>, Server: server) {
        // We are only required to handle `INFO replication` for now.
        const section = (args[0] ?? "").toLowerCase();
        if (section !== "replication") {
            connection.write("$-1\r\n"); // null bulk for any other section
            return;
        }

        const lines: string[] = [];
        if (isReplica) {
            lines.push("role:slave");
        } else {
            lines.push("role:master");
            lines.push(`master_replid:${REPL_ID}`);
            lines.push(`master_repl_offset:${REPL_OFFSET}`);
        }

        const payload = lines.join("\r\n");
        connection.write(Server.RESPEncoder({ type: "bulkString", content: payload }));
    },
};

