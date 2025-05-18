import * as net from "net";
import { RedisEntry } from "../../types";
import { server } from "../../main";

export default {
    data: {
        name: "keys",
        description: "Returns all keys in the current in-memory database (supports only the '*' pattern).",
    },

    async run(
        connection: net.Socket,
        args: string[],
        Data: Map<string, RedisEntry>,
        Server: server
    ) {
        // Accept either zero or one argument.  If omitted, treat as '*'.
        const pattern = args[0] ?? "*";

        if (pattern !== "*") {
            connection.write(
                Server.RESPEncoder({
                    type: "simpleError",
                    content: "Only Supports '*' pattern",
                })
            );
            return;
        }

        // Every key is stored directly on the Map – no "db0" wrapper.
        const keys = Array.from(Data.keys());

        connection.write(
            Server.RESPEncoder({
                type: "array",
                // RESPEncoder expects its `content` to be a JSON-encoded array of
                // RESP objects, so we build that just like the older code did.
                content: JSON.stringify(
                    keys.map((k) => ({ type: "bulkString", content: k }))
                ),
            })
        );
    },
};
