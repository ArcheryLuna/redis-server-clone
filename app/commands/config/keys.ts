import * as net from "net";
import { DatabaseSchema, RedisEntry } from "../../types";
import { server } from "../../main";

export default {
    data: {
        name: "keys",
        description: "Returns all keys in the selected database (only supports *)"
    },
    async run(connection: net.Socket, args: any[], Data: Map<string, RedisEntry>, Server: server) {
        const pattern = args[0];

        if (pattern !== "*") {
            connection.write(Server.RESPEncoder({
                type: "simpleError",
                content: "Only Supports '*' pattern"
            }))
            return;
        }

        const db = Data.get("db0") || {};
        const keys = Object.keys(db);

        const encoded = Server.RESPEncoder({
            type: "array",
            content: JSON.stringify(
                keys.map(key => ({ type: "bulkString", content: key }))
            )
        });

        connection.write(encoded);
    }
}

