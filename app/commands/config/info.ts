import * as net from "net";
import { RedisEntry } from "../../types";
import { server } from "../../main";

/**
 * INFO command – supports only the `replication` section for now.
 * Reply format: RESP bulk string, e.g. `$11\r\nrole:master\r\n`.
 */
export default {
    data: {
        name: "info",
        description: "Return information about the server (replication section only)",
    },
    run(connection: net.Socket, args: string[], _Data: Map<string, RedisEntry>, Server: server) {
        // We only care when the first argument is "replication" (case‑insensitive).
        const section = (args[0] ?? "").toLowerCase();

        if (section !== "replication") {
            // For any other section or no args, respond with empty bulk string for now.
            connection.write("$-1\r\n");
            return;
        }

        // Decide role dynamically: if the launcher included --replicaof, we are a replica
        const isReplica = process.argv.includes("--replicaof");
        const payload = `role:${isReplica ? "slave" : "master"}`; // later stages will append more lines
        connection.write(Server.RESPEncoder({ type: "bulkString", content: payload }));
    },
};

